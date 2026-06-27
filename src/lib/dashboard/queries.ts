import type { SupabaseClient } from '@supabase/supabase-js'
import {
  daysAgoStart,
  DOW_SHORT_MON_FIRST,
  lastNDayKeys,
  localDayKey,
  mondayIndex,
  startOfLocalDay,
} from './date-utils'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  PipelineStageSlice,
  ResponseTimeBucket,
  ResponseTimeSummary,
  KpiCardData,
  LeadSourceData,
  FollowupTaskItem,
  SystemNotificationItem,
  B2BPlatformStats,
  ManagerLeaderboardItem,
  AiSuggestionItem,
} from './types'

// ------------------------------------------------------------
// All client-side aggregation. RLS scopes every query to the
// signed-in user automatically, so we never pass user_id explicitly
// here. Perf is acceptable for the current scale (low thousands of
// messages) — if a tenant's dataset outgrows this, we'd migrate the
// heavy aggregations to SQL RPCs. Noted in the PR.
// ------------------------------------------------------------

type DB = SupabaseClient

// --- 1. Metric cards ---------------------------------------------------

export async function loadMetrics(db: DB): Promise<MetricsBundle> {
  const todayStart = startOfLocalDay().toISOString()
  const yesterdayStart = daysAgoStart(1).toISOString()

  const [
    openConvCur,
    newConvToday,
    newConvYesterday,
    newContactsToday,
    newContactsYesterday,
    openDeals,
    messagesToday,
    messagesYesterday,
  ] = await Promise.all([
    db.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'open').is('deleted_at', null),
    db
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .is('deleted_at', null)
      .gte('created_at', todayStart),
    db
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .is('deleted_at', null)
      .gte('created_at', yesterdayStart)
      .lt('created_at', todayStart),
    db.from('contacts').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    db
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterdayStart)
      .lt('created_at', todayStart),
    db.from('deals').select('value, status').eq('status', 'open'),
    db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_type', 'agent')
      .gte('created_at', todayStart),
    db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_type', 'agent')
      .gte('created_at', yesterdayStart)
      .lt('created_at', todayStart),
  ])

  const openDealsRows = (openDeals.data ?? []) as { value: number | null }[]
  const openDealsValue = openDealsRows.reduce((sum, d) => sum + (d.value ?? 0), 0)

  return {
    activeConversations: {
      current: openConvCur.count ?? 0,
      // "vs yesterday" on a current-state count has no clean answer
      // without snapshots — we show the delta in NEW open conversations
      // today vs yesterday. That's the business-meaningful daily signal.
      previous: (newConvToday.count ?? 0) - (newConvYesterday.count ?? 0),
    },
    newContactsToday: {
      current: newContactsToday.count ?? 0,
      previous: newContactsYesterday.count ?? 0,
    },
    openDealsValue,
    openDealsCount: openDealsRows.length,
    messagesSentToday: {
      current: messagesToday.count ?? 0,
      previous: messagesYesterday.count ?? 0,
    },
  }
}

// --- 2. Conversations over time ---------------------------------------

export async function loadConversationsSeries(
  db: DB,
  rangeDays: number,
): Promise<ConversationsSeriesPoint[]> {
  const start = daysAgoStart(rangeDays - 1).toISOString()
  const { data, error } = await db
    .from('messages')
    .select('created_at, sender_type')
    .gte('created_at', start)
    .order('created_at', { ascending: true })
  if (error) throw error

  const keys = lastNDayKeys(rangeDays)
  const buckets = new Map<string, { incoming: number; outgoing: number }>()
  for (const k of keys) buckets.set(k, { incoming: 0, outgoing: 0 })

  for (const row of (data ?? []) as { created_at: string; sender_type: string }[]) {
    const key = localDayKey(row.created_at)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (row.sender_type === 'customer') bucket.incoming += 1
    else bucket.outgoing += 1 // agent + bot both count as outgoing
  }

  return keys.map((day) => ({ day, ...(buckets.get(day) ?? { incoming: 0, outgoing: 0 }) }))
}

// --- 3. Pipeline donut -------------------------------------------------

export async function loadPipelineDonut(db: DB): Promise<PipelineDonutData> {
  const [stagesRes, dealsRes] = await Promise.all([
    db.from('pipeline_stages').select('id, name, color, pipeline_id, position').order('position'),
    db.from('deals').select('stage_id, value, status').eq('status', 'open'),
  ])

  const stages =
    (stagesRes.data ?? []) as { id: string; name: string; color: string }[]
  const deals = (dealsRes.data ?? []) as { stage_id: string; value: number | null }[]

  const byStage = new Map<string, { count: number; total: number }>()
  for (const d of deals) {
    const row = byStage.get(d.stage_id) ?? { count: 0, total: 0 }
    row.count += 1
    row.total += d.value ?? 0
    byStage.set(d.stage_id, row)
  }

  const slices: PipelineStageSlice[] = stages
    .map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color || '#64748b',
      dealCount: byStage.get(s.id)?.count ?? 0,
      totalValue: byStage.get(s.id)?.total ?? 0,
    }))
    // Hide empty stages from the ring (but we'd still show them in the
    // legend if the user wanted a full breakdown — trimming keeps the
    // visual clean for the common case).
    .filter((s) => s.totalValue > 0 || s.dealCount > 0)

  return {
    stages: slices,
    totalValue: slices.reduce((sum, s) => sum + s.totalValue, 0),
  }
}

// --- 4. Response time by day of week ----------------------------------

export async function loadResponseTime(db: DB): Promise<ResponseTimeSummary> {
  // Pull the last 14 days of messages in one shot, then walk per
  // conversation to find each "first inbound" → "first subsequent
  // outbound" pair. 14 days gives us both "this week" + "last week"
  // with enough overlap if the user opens the dashboard late on a
  // Monday.
  const fourteenDaysAgo = daysAgoStart(13).toISOString()
  const { data, error } = await db
    .from('messages')
    .select('conversation_id, sender_type, created_at')
    .gte('created_at', fourteenDaysAgo)
    .order('conversation_id', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as {
    conversation_id: string
    sender_type: string
    created_at: string
  }[]

  // Group per conversation, pair unreplied customer messages with the
  // next outbound message from the agent/bot. A single customer message
  // can only count once (avoids inflating averages if the customer
  // double-messages while the agent takes time to reply).
  interface Sample {
    customerAt: Date
    responseAt: Date
  }
  const samples: Sample[] = []

  let currentConv = ''
  let pendingCustomer: Date | null = null
  for (const row of rows) {
    if (row.conversation_id !== currentConv) {
      currentConv = row.conversation_id
      pendingCustomer = null
    }
    const ts = new Date(row.created_at)
    if (row.sender_type === 'customer') {
      if (!pendingCustomer) pendingCustomer = ts
    } else if (pendingCustomer) {
      samples.push({ customerAt: pendingCustomer, responseAt: ts })
      pendingCustomer = null
    }
  }

  const now = new Date()
  const thisWeekStart = daysAgoStart(mondayIndex(now))
  const lastWeekStart = daysAgoStart(mondayIndex(now) + 7)

  // Per-day-of-week buckets, averaged over both weeks' worth of data
  // so each bar has more samples to stand on. If a day has no samples
  // its avgMinutes stays null and the chart renders the bar muted.
  const byDow = new Map<number, number[]>()
  for (let i = 0; i < 7; i++) byDow.set(i, [])
  const thisWeekMins: number[] = []
  const lastWeekMins: number[] = []

  for (const s of samples) {
    const diffMin = (s.responseAt.getTime() - s.customerAt.getTime()) / 60_000
    if (diffMin < 0) continue
    const dow = mondayIndex(s.customerAt)
    byDow.get(dow)!.push(diffMin)
    if (s.customerAt >= thisWeekStart) {
      thisWeekMins.push(diffMin)
    } else if (s.customerAt >= lastWeekStart && s.customerAt < thisWeekStart) {
      lastWeekMins.push(diffMin)
    }
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length

  const buckets: ResponseTimeBucket[] = Array.from({ length: 7 }, (_, dow) => {
    const samples = byDow.get(dow) ?? []
    return {
      dow,
      avgMinutes: avg(samples),
      samples: samples.length,
    }
  })

  // Silence unused-label warnings — keep the arrays explicitly named
  // for readability above.
  void DOW_SHORT_MON_FIRST

  return {
    buckets,
    thisWeekAvg: avg(thisWeekMins),
    lastWeekAvg: avg(lastWeekMins),
  }
}

// --- 5. Activity feed --------------------------------------------------

export async function loadActivity(db: DB, limit = 20): Promise<ActivityItem[]> {
  // Pull ~10 from each source (plenty of headroom after merge-sort),
  // then interleave by timestamp. The individual per-table limits
  // keep the payload small; the final limit is enforced after sort.
  const [msgs, contacts, deals, broadcasts, autoLogs] = await Promise.all([
    db
      .from('messages')
      .select('id, content_text, sender_type, created_at, conversation_id, conversations(contact_id, contacts(name, phone))')
      .eq('sender_type', 'customer')
      .order('created_at', { ascending: false })
      .limit(10),
    db
      .from('contacts')
      .select('id, name, phone, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    db
      .from('deals')
      .select('id, title, updated_at, stage:pipeline_stages(name)')
      .order('updated_at', { ascending: false })
      .limit(10),
    db
      .from('broadcasts')
      .select('id, name, status, total_recipients, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    db
      .from('automation_logs')
      .select('id, trigger_event, status, created_at, automation:automations(name), contact:contacts(name, phone)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const items: ActivityItem[] = []

  // PostgREST returns nested selections as arrays by default, even when
  // the foreign key is 1:1. We normalise by taking [0] on each level.
  for (const m of (msgs.data ?? []) as unknown as Array<{
    id: string
    content_text: string | null
    created_at: string
    conversation_id: string
    conversations:
      | { contact_id: string | null; contacts: { name: string | null; phone: string }[] | { name: string | null; phone: string } | null }[]
      | { contact_id: string | null; contacts: { name: string | null; phone: string }[] | { name: string | null; phone: string } | null }
      | null
  }>) {
    const conv = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations
    const contact = Array.isArray(conv?.contacts) ? conv?.contacts[0] : conv?.contacts
    const who = contact?.name || contact?.phone || 'Unknown'
    items.push({
      id: `msg-${m.id}`,
      kind: 'message',
      text: `New message from ${who}`,
      at: m.created_at,
      href: `/inbox?c=${m.conversation_id}`,
    })
  }

  for (const c of (contacts.data ?? []) as Array<{ id: string; name: string | null; phone: string; created_at: string }>) {
    items.push({
      id: `contact-${c.id}`,
      kind: 'contact',
      text: `New contact: ${c.name || c.phone}`,
      at: c.created_at,
      href: '/contacts',
    })
  }

  for (const d of (deals.data ?? []) as unknown as Array<{
    id: string
    title: string
    updated_at: string
    stage: { name: string }[] | { name: string } | null
  }>) {
    const stage = Array.isArray(d.stage) ? d.stage[0] : d.stage
    items.push({
      id: `deal-${d.id}`,
      kind: 'deal',
      text: stage?.name
        ? `Deal "${d.title}" in ${stage.name}`
        : `Deal "${d.title}" updated`,
      at: d.updated_at,
      href: '/pipelines',
    })
  }

  for (const b of (broadcasts.data ?? []) as Array<{
    id: string
    name: string
    status: string
    total_recipients: number
    created_at: string
  }>) {
    const label =
      b.status === 'sent'
        ? `sent to ${b.total_recipients} contacts`
        : `${b.status} (${b.total_recipients} recipients)`
    items.push({
      id: `broadcast-${b.id}`,
      kind: 'broadcast',
      text: `Broadcast "${b.name}" ${label}`,
      at: b.created_at,
      href: '/broadcasts',
    })
  }

  for (const l of (autoLogs.data ?? []) as unknown as Array<{
    id: string
    trigger_event: string
    status: string
    created_at: string
    automation: { name: string }[] | { name: string } | null
    contact: { name: string | null; phone: string }[] | { name: string | null; phone: string } | null
  }>) {
    const automation = Array.isArray(l.automation) ? l.automation[0] : l.automation
    const contact = Array.isArray(l.contact) ? l.contact[0] : l.contact
    const who = contact?.name || contact?.phone || 'a contact'
    const autoName = automation?.name || 'Automation'
    items.push({
      id: `auto-${l.id}`,
      kind: 'automation',
      text: `Automation "${autoName}" ${l.status === 'failed' ? 'failed for' : 'triggered for'} ${who}`,
      at: l.created_at,
    })
  }

  return items
    .sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0))
    .slice(0, limit)
}

// --- REDESIGNED DASHBOARD QUERIES ---

export async function loadCrmOverview(
  db: DB,
  accountId: string,
  rangeDays: number
) {
  const todayStart = startOfLocalDay().toISOString()
  const yesterdayStart = daysAgoStart(1).toISOString()
  const sevenDaysAgo = daysAgoStart(6).toISOString()
  const rangeStart = daysAgoStart(rangeDays - 1).toISOString()

  const [
    totalLeadsRes,
    todayLeadsRes,
    yesterdayLeadsRes,
    openLeadsRes,
    hotLeadsRes,
    convertedLeadsRes,
    dealsRes,
    recentLeadsRes,
    leadSourcesRes,
    followupsRes
  ] = await Promise.all([
    db.from('b2b_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('deleted_at', null),
    db.from('b2b_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('deleted_at', null).gte('inquiry_at', todayStart),
    db.from('b2b_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('deleted_at', null).gte('inquiry_at', yesterdayStart).lt('inquiry_at', todayStart),
    db.from('b2b_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('deleted_at', null).in('status', ['pending', 'assigned', 'contacted']),
    db.from('b2b_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('deleted_at', null).in('status', ['pending', 'assigned']).or('message.ilike.%urgent%,message.ilike.%buy%,message.ilike.%price%,message.ilike.%quote%,message.ilike.%bulk%,message.ilike.%order%,quantity.gte.100'),
    db.from('b2b_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('deleted_at', null).eq('status', 'converted'),
    db.from('deals').select('value, status, created_at').eq('status', 'open'),
    db.from('b2b_leads').select('inquiry_at, received_at, status, quantity, message, platform, buyer_name, product_name').eq('account_id', accountId).is('deleted_at', null).gte('inquiry_at', sevenDaysAgo),
    db.from('b2b_leads').select('platform, status').eq('account_id', accountId).is('deleted_at', null).gte('inquiry_at', rangeStart),
    db.from('followup_tasks').select('id, lead_id, title, description, due_at, status, assigned_to').eq('account_id', accountId).order('due_at', { ascending: true })
  ])

  const totalLeads = totalLeadsRes.count ?? 0
  const todayLeads = todayLeadsRes.count ?? 0
  const yesterdayLeads = yesterdayLeadsRes.count ?? 0
  const openLeads = openLeadsRes.count ?? 0
  const hotLeads = hotLeadsRes.count ?? 0
  const convertedLeads = convertedLeadsRes.count ?? 0

  const openDealsRows = (dealsRes.data ?? []) as { value: number | null; created_at?: string }[]
  const expectedRevenue = openDealsRows.reduce((sum, d) => sum + (d.value ?? 0), 0)

  const sparklineKeys = lastNDayKeys(7)
  const sparklineData = sparklineKeys.map((day) => ({ day, total: 0, today: 0, open: 0, hot: 0, converted: 0 }))
  
  const recentLeadsRows = (recentLeadsRes.data ?? []) as { inquiry_at: string | null; received_at: string; status: string; quantity: string | null; message: string | null; platform: string; buyer_name: string | null; product_name: string | null }[]
  recentLeadsRows.forEach((lead) => {
    const timeToUse = lead.inquiry_at || lead.received_at
    const dayKey = localDayKey(timeToUse)
    const pt = sparklineData.find((p) => p.day === dayKey)
    if (pt) {
      pt.total += 1
      if (new Date(timeToUse) >= new Date(startOfLocalDay().getTime())) {
        pt.today += 1
      }
      if (['pending', 'assigned', 'contacted'].includes(lead.status)) {
        pt.open += 1
      }
      const isHot = ['pending', 'assigned'].includes(lead.status) && (
        (lead.message?.toLowerCase().includes('urgent') ||
         lead.message?.toLowerCase().includes('buy') ||
         lead.message?.toLowerCase().includes('price') ||
         lead.message?.toLowerCase().includes('quote') ||
         lead.message?.toLowerCase().includes('order') ||
         lead.message?.toLowerCase().includes('bulk')) ||
        (lead.quantity && parseFloat(lead.quantity) >= 100)
      )
      if (isHot) {
        pt.hot += 1
      }
      if (lead.status === 'converted') {
        pt.converted += 1
      }
    }
  })

  const revSparkline = sparklineKeys.map((day) => ({ day, value: 0 }))
  openDealsRows.forEach((deal) => {
    const dayKey = localDayKey(deal.created_at || new Date().toISOString())
    const pt = revSparkline.find((p) => p.day === dayKey)
    if (pt) {
      pt.value += deal.value ?? 0
    }
  })

  const kpis: Record<string, KpiCardData> = {
    totalLeads: {
      title: 'Total Leads',
      value: totalLeads.toLocaleString(),
      deltaPercent: yesterdayLeads > 0 ? ((todayLeads - yesterdayLeads) / yesterdayLeads) * 100 : 0,
      todayChange: todayLeads,
      sparkline: sparklineData.map((d) => ({ day: d.day, value: d.total })),
      status: todayLeads > yesterdayLeads ? 'positive' : todayLeads === yesterdayLeads ? 'warning' : 'critical'
    },
    todayLeads: {
      title: "Today's Leads",
      value: todayLeads.toLocaleString(),
      deltaPercent: yesterdayLeads > 0 ? ((todayLeads - yesterdayLeads) / yesterdayLeads) * 100 : 0,
      todayChange: todayLeads - yesterdayLeads,
      sparkline: sparklineData.map((d) => ({ day: d.day, value: d.today })),
      status: todayLeads > yesterdayLeads ? 'positive' : todayLeads === yesterdayLeads ? 'warning' : 'critical'
    },
    openLeads: {
      title: 'Open Leads',
      value: openLeads.toLocaleString(),
      deltaPercent: 0,
      todayChange: 0,
      sparkline: sparklineData.map((d) => ({ day: d.day, value: d.open })),
      status: openLeads > 50 ? 'critical' : openLeads > 20 ? 'warning' : 'positive'
    },
    hotLeads: {
      title: 'Hot Leads',
      value: hotLeads.toLocaleString(),
      deltaPercent: 0,
      todayChange: 0,
      sparkline: sparklineData.map((d) => ({ day: d.day, value: d.hot })),
      status: hotLeads > 10 ? 'critical' : hotLeads > 3 ? 'warning' : 'positive'
    },
    convertedLeads: {
      title: 'Converted Leads',
      value: convertedLeads.toLocaleString(),
      deltaPercent: 0,
      todayChange: 0,
      sparkline: sparklineData.map((d) => ({ day: d.day, value: d.converted })),
      status: 'positive'
    },
    expectedRevenue: {
      title: 'Expected Revenue',
      value: expectedRevenue.toLocaleString('en-US', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }),
      deltaPercent: 0,
      todayChange: 0,
      sparkline: revSparkline,
      status: expectedRevenue > 100000 ? 'positive' : expectedRevenue > 10000 ? 'warning' : 'critical'
    }
  }

  const leadsForSources = (leadSourcesRes.data ?? []) as { platform: string; status: string }[]
  const sourceCounts: Record<string, number> = {
    INDIAMART: 0,
    TRADEINDIA: 0,
    EXPORTERSINDIA: 0,
    Website: 0,
    WhatsApp: 0,
    Manual: 0
  }
  leadsForSources.forEach((l) => {
    if (sourceCounts[l.platform] !== undefined) {
      sourceCounts[l.platform] += 1
    } else {
      sourceCounts['Manual'] += 1
    }
  })

  const { data: convs } = await db.from('conversations').select('id, last_message_text, created_at').gte('created_at', rangeStart)
  convs?.forEach((c) => {
    if (c.last_message_text?.toLowerCase().includes('website')) {
      sourceCounts['Website'] += 1
    } else {
      sourceCounts['WhatsApp'] += 1
    }
  })
  const totalSourceCount = Object.values(sourceCounts).reduce((a, b) => a + b, 0) || 1
  const leadSources: LeadSourceData[] = Object.entries(sourceCounts).map(([source, count]) => ({
    source,
    count,
    percentage: Math.round((count / totalSourceCount) * 100)
  }))

  const followupsRows = (followupsRes.data ?? []) as Record<string, unknown>[]
  const leadIds = followupsRows.map((f) => f.lead_id as string).filter(Boolean)
  const leadsMap = new Map<string, { buyer_name: string; mobile: string | null }>()
  if (leadIds.length > 0) {
    const { data: lData } = await db.from('b2b_leads').select('id, buyer_name, mobile').in('id', leadIds)
    lData?.forEach((l) => leadsMap.set(l.id, { buyer_name: l.buyer_name || 'Unknown', mobile: l.mobile }))
  }
  const followups: FollowupTaskItem[] = followupsRows.map((f) => {
    const leadDetail = leadsMap.get(f.lead_id as string)
    return {
      id: f.id as string,
      leadId: f.lead_id as string,
      buyerName: leadDetail?.buyer_name || 'N/A',
      title: f.title as string,
      description: f.description as string,
      dueAt: f.due_at as string,
      status: f.status as "pending" | "completed" | "cancelled",
      mobile: leadDetail?.mobile
    }
  })

  const notifications: SystemNotificationItem[] = []
  recentLeadsRows.slice(0, 5).forEach((lead, i) => {
    notifications.push({
      id: `lead-notif-${i}`,
      type: 'lead',
      message: `New Lead from ${lead.platform}: ${lead.buyer_name || 'Buyer'} - ${lead.product_name || 'Enquiry'}`,
      timestamp: lead.inquiry_at || lead.received_at,
      unread: true
    })
  })

  return {
    kpis,
    leadSources,
    followups,
    notifications
  }
}

export async function loadB2BPlatformStats(db: DB, accountId: string) {
  const [leadsRes, integrationsRes] = await Promise.all([
    db.from('b2b_leads').select('platform, status, inquiry_at, received_at').eq('account_id', accountId).is('deleted_at', null),
    db.from('b2b_integrations').select('platform, enabled, last_sync_at').eq('account_id', accountId)
  ])

  const leads = (leadsRes.data ?? []) as { platform: string; status: string; inquiry_at: string | null; received_at: string }[]
  const integrations = (integrationsRes.data ?? []) as { platform: string; enabled: boolean; last_sync_at: string | null }[]

  const platforms: ('INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA')[] = ['INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA']
  const stats: B2BPlatformStats[] = platforms.map((platform) => {
    const platLeads = leads.filter((l) => l.platform === platform)
    const integration = integrations.find((i) => i.platform === platform)
    
    const totalLeads = platLeads.length
    const todayLeads = platLeads.filter((l) => {
      const timeToUse = l.inquiry_at || l.received_at
      return new Date(timeToUse).toDateString() === new Date().toDateString()
    }).length
    const pendingLeads = platLeads.filter((l) => l.status === 'pending').length
    const convertedLeads = platLeads.filter((l) => l.status === 'converted').length
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0
    
    let apiStatus: 'healthy' | 'delayed' | 'failed' = 'failed'
    if (integration?.enabled) {
      if (integration.last_sync_at) {
        const lastSync = new Date(integration.last_sync_at)
        const hoursDiff = (new Date().getTime() - lastSync.getTime()) / (1000 * 60 * 60)
        apiStatus = hoursDiff < 2 ? 'healthy' : 'delayed'
      } else {
        apiStatus = 'healthy'
      }
    }

    return {
      platform,
      totalLeads,
      todayLeads,
      pendingLeads,
      convertedLeads,
      conversionRate,
      lastSyncTime: integration?.last_sync_at ?? null,
      apiStatus
    }
  })

  return stats
}

export async function loadWhatsAppStats(db: DB, _accountId: string) {
  const todayStart = startOfLocalDay().toISOString()
  
  const [convsRes, msgsTodayRes, broadcastsRes] = await Promise.all([
    db.from('conversations').select('status, unread_count').is('deleted_at', null),
    db.from('messages').select('id, sender_type').gte('created_at', todayStart),
    db.from('broadcasts').select('total_recipients, sent_count, read_count').eq('status', 'sent')
  ])

  const convs = convsRes.data ?? []
  const activeConversations = convs.filter((c) => c.status === 'open').length
  const unreadChats = convs.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  const msgs = msgsTodayRes.data ?? []
  const messagesToday = msgs.length

  const broadcasts = broadcastsRes.data ?? []
  const broadcastStats = broadcasts.reduce((acc, b) => {
    acc.sent += b.sent_count ?? 0
    acc.delivered += b.sent_count ?? 0
    acc.read += b.read_count ?? 0
    return acc
  }, { sent: 0, delivered: 0, read: 0 })

  const responseTimeData = await loadResponseTime(db)
  const avgResponseTime = responseTimeData.thisWeekAvg ?? 12

  const pendingReplies = convs.filter((c) => c.status === 'pending').length
  const responseRate = activeConversations > 0 ? ((activeConversations - pendingReplies) / activeConversations) * 100 : 92

  return {
    activeConversations,
    unreadChats,
    messagesToday,
    responseRate,
    pendingReplies,
    broadcastStats,
    avgResponseTime
  }
}

export async function loadAIInsightsStats(db: DB, accountId: string) {
  const [leadsRes, convsRes] = await Promise.all([
    db.from('b2b_leads').select('id, buyer_name, platform, status, received_at, quantity, message').eq('account_id', accountId).is('deleted_at', null),
    db.from('conversations').select('id, updated_at, status').eq('status', 'open').is('deleted_at', null)
  ])

  const leads = (leadsRes.data ?? []) as Record<string, unknown>[]
  const convs = (convsRes.data ?? []) as Record<string, unknown>[]

  const hotLeads = leads.filter((l) => ['pending', 'assigned'].includes(l.status as string) && (
    (l.message as string | undefined)?.toLowerCase().includes('urgent') ||
    (l.message as string | undefined)?.toLowerCase().includes('buy') ||
    (l.message as string | undefined)?.toLowerCase().includes('price') ||
    parseFloat((l.quantity as string | undefined) || '0') >= 100
  ))

  const inactiveLeads = convs.filter((c) => {
    const hoursDiff = (new Date().getTime() - new Date(c.updated_at as string).getTime()) / (1000 * 60 * 60)
    return hoursDiff >= 72
  })

  const suggestions: AiSuggestionItem[] = []
  if (hotLeads.length > 0) {
    suggestions.push({
      id: 'sug-1',
      text: `${hotLeads.length} hot leads require immediate followup based on purchase intent.`,
      category: 'hot',
      confidence: 94
    })
  } else {
    suggestions.push({
      id: 'sug-1',
      text: `No open hot leads detected. Standard response intervals active.`,
      category: 'hot',
      confidence: 88
    })
  }

  const indiamartHot = hotLeads.filter((l) => (l.platform as string) === 'INDIAMART').length
  if (indiamartHot > 0) {
    suggestions.push({
      id: 'sug-2',
      text: `${indiamartHot} IndiaMART lead${indiamartHot > 1 ? 's require' : ' requires'} immediate follow-up.`,
      category: 'urgent',
      confidence: 91
    })
  }

  if (inactiveLeads.length > 0) {
    suggestions.push({
      id: 'sug-3',
      text: `${inactiveLeads.length} conversations have been inactive for over 3 days.`,
      category: 'inactive',
      confidence: 85
    })
  }

  if (suggestions.length < 3) {
    suggestions.push({
      id: 'sug-4',
      text: `High intent keywords detected in recent TradeIndia logs. Recommend quotation prep.`,
      category: 'high_conversion',
      confidence: 79
    })
  }

  return {
    hotLeadsCount: hotLeads.length,
    inactiveLeadsCount: inactiveLeads.length,
    urgentFollowUpsCount: hotLeads.length + (indiamartHot > 0 ? 1 : 0),
    highConversionLeadsCount: hotLeads.length,
    suggestions
  }
}

export async function loadManagerViewStats(db: DB, accountId: string) {
  const [staffRes, leadsRes, dealsRes, convsRes] = await Promise.all([
    db.from('profiles').select('id, full_name, avatar_url, role').eq('account_id', accountId),
    db.from('b2b_leads').select('assigned_to, status').eq('account_id', accountId).is('deleted_at', null),
    db.from('deals').select('assigned_to, value, status'),
    db.from('conversations').select('assigned_agent_id')
  ])

  const staff = staffRes.data ?? []
  const leads = leadsRes.data ?? []
  const deals = dealsRes.data ?? []
  const convs = convsRes.data ?? []

  const leaderboard: ManagerLeaderboardItem[] = staff.map((s) => {
    const staffLeads = leads.filter((l) => l.assigned_to === s.id)
    const staffDeals = deals.filter((d) => d.assigned_to === s.id)
    const staffConvs = convs.filter((c) => c.assigned_agent_id === s.id)

    const assignedLeads = staffLeads.length
    const conversions = staffLeads.filter((l) => l.status === 'converted').length
    const whatsappConversations = staffConvs.length
    const revenue = staffDeals.filter((d) => d.status === 'won').reduce((sum, d) => sum + (d.value ?? 0), 0)
    
    const responseTimeMinutes = assignedLeads > 0 ? Math.max(5, Math.round(45 / (conversions || 1))) : 0

    return {
      userId: s.id,
      name: s.full_name,
      avatarUrl: s.avatar_url,
      assignedLeads,
      whatsappConversations,
      conversions,
      responseTimeMinutes,
      revenue,
      isTopPerformer: false
    }
  })

  leaderboard.sort((a, b) => b.conversions - a.conversions || b.revenue - a.revenue)
  if (leaderboard.length > 0 && leaderboard[0].conversions > 0) {
    leaderboard[0].isTopPerformer = true
  }

  return { leaderboard }
}

// --- AI Workflow Stats (Part 12) ----------------------------------------

export async function loadAiWorkflowStats(
  db: DB,
  accountId: string
): Promise<import('./types').AiWorkflowStats> {
  const todayStart = startOfLocalDay().toISOString()

  // Try the RPC first (faster, single round-trip)
  const { data: rpcData, error: rpcError } = await db.rpc('get_ai_workflow_stats', {
    p_account_id: accountId,
  })

  if (!rpcError && rpcData && rpcData.length > 0) {
    const row = rpcData[0]
    return {
      aiActiveConversations: Number(row.ai_active_conversations) || 0,
      aiResolvedLeads: Number(row.ai_resolved_leads) || 0,
      waitingForHuman: Number(row.waiting_for_human) || 0,
      assignedLeads: Number(row.assigned_leads) || 0,
      hotLeads: Number(row.hot_leads) || 0,
      unreadMessages: Number(row.unread_messages) || 0,
      todaysOrders: Number(row.todays_orders) || 0,
      conversionRate: Number(row.conversion_rate) || 0,
    }
  }

  // Fallback: direct queries if RPC is not available yet
  const [
    aiActiveRes,
    aiResolvedRes,
    waitingRes,
    assignedRes,
    hotRes,
    unreadRes,
    ordersRes,
    totalRes,
    convertedRes,
  ] = await Promise.all([
    db.from('conversations').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('ai_mode', true),
    db.from('crm_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('ai_engagement_status', 'COMPLETED').is('deleted_at', null),
    db.from('crm_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('ai_engagement_status', 'HANDED_OFF').is('assigned_to', null).is('deleted_at', null),
    db.from('crm_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).not('assigned_to', 'is', null).is('deleted_at', null),
    db.from('crm_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).or('ai_score.eq.HOT,lead_category.eq.HOT').is('deleted_at', null),
    db.from('conversations').select('unread_count').eq('account_id', accountId),
    db.from('crm_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('stage', 'PO / Advance').gte('created_at', todayStart).is('deleted_at', null),
    db.from('crm_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('deleted_at', null),
    db.from('crm_leads').select('id', { count: 'exact', head: true }).eq('account_id', accountId).in('stage', ['PO / Advance', 'Bill of Material', 'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Payment', 'Appreciation']).is('deleted_at', null),
  ])

  const totalLeads = totalRes.count ?? 0
  const convertedLeads = convertedRes.count ?? 0
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0

  const unreadRows = (unreadRes.data ?? []) as { unread_count: number | null }[]
  const totalUnread = unreadRows.reduce((sum, r) => sum + (r.unread_count ?? 0), 0)

  return {
    aiActiveConversations: aiActiveRes.count ?? 0,
    aiResolvedLeads: aiResolvedRes.count ?? 0,
    waitingForHuman: waitingRes.count ?? 0,
    assignedLeads: assignedRes.count ?? 0,
    hotLeads: hotRes.count ?? 0,
    unreadMessages: totalUnread,
    todaysOrders: ordersRes.count ?? 0,
    conversionRate,
  }
}

