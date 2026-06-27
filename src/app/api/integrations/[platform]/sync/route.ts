// Force Next.js route compilation
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { IndiaMartService } from '@/integrations/indiamart/services/indiamart'
import { TradeIndiaService } from '@/integrations/tradeindia/services/tradeindia'
import { ExportersIndiaService } from '@/integrations/exportersindia/services/exportersindia'
import { cleanAndParseDate } from '@/integrations/shared/date'
import type { Database } from '@/types/database.types'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params
    const platformUpper = platform.toUpperCase()

    if (!['INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA'].includes(platformUpper)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve account_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const accountId = profile.account_id

    const { data: syncState, error: dbError } = await supabase
      .from('integration_sync_state')
      .select('*')
      .eq('account_id', accountId)
      .eq('platform', platformUpper)
      .maybeSingle()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    if (!syncState) {
      return NextResponse.json({
        syncState: {
          platform: platformUpper,
          sync_status: 'IDLE',
          current_page: 1,
          last_sync_at: null,
          last_lead_timestamp: null,
          error_message: null
        }
      })
    }

    return NextResponse.json({ syncState })
  } catch (error) {
    console.error('[sync-route GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helpers for self-healing DB operations on sync_logs
async function saveSyncLog(
  supabase: any,
  payload: {
    account_id: string
    platform: string
    started_at: string
    finished_at?: string
    duration?: number
    status: 'SUCCESS' | 'FAILED' | 'RUNNING'
    error_message?: string | null
    records_imported?: number
    pages_processed?: number
    imported?: number
    skipped?: number
    failed?: number
    retry_count?: number
    last_successful_page?: number
    current_cursor?: string | null
    api_response_time?: number
  }
) {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .insert({
        account_id: payload.account_id,
        platform: payload.platform,
        started_at: payload.started_at,
        finished_at: payload.finished_at || null,
        duration: payload.duration || null,
        status: payload.status,
        records_imported: payload.imported || payload.records_imported || 0,
        error_message: payload.error_message || null,
        pages_processed: payload.pages_processed || 0,
        imported: payload.imported || 0,
        skipped: payload.skipped || 0,
        failed: payload.failed || 0,
        retry_count: payload.retry_count || 0,
        last_successful_page: payload.last_successful_page || null,
        current_cursor: payload.current_cursor || null,
        api_response_time: payload.api_response_time || null
      })
      .select('id')
      .single()

    if (!error) return data?.id
    if (error.code !== '42703') throw error
  } catch (err: any) {
    if (err.code !== '42703') throw err
  }

  // Fallback: columns don't exist
  const meta = {
    pages_processed: payload.pages_processed || 0,
    imported: payload.imported || 0,
    skipped: payload.skipped || 0,
    failed: payload.failed || 0,
    retry_count: payload.retry_count || 0,
    last_successful_page: payload.last_successful_page || null,
    current_cursor: payload.current_cursor || null,
    api_response_time: payload.api_response_time || null
  }
  const combinedErrorMessage = payload.error_message
    ? `${payload.error_message} | Metadata: ${JSON.stringify(meta)}`
    : `Metadata: ${JSON.stringify(meta)}`

  const { data, error } = await supabase
    .from('sync_logs')
    .insert({
      account_id: payload.account_id,
      platform: payload.platform,
      started_at: payload.started_at,
      finished_at: payload.finished_at || null,
      duration: payload.duration || null,
      status: payload.status,
      records_imported: payload.imported || payload.records_imported || 0,
      error_message: combinedErrorMessage
    })
    .select('id')
    .single()

  if (error) {
    console.error('[sync-route] Fallback DB error saving sync log:', error)
  }
  return data?.id
}

async function updateSyncState(
  supabase: any,
  syncStateId: string,
  payload: {
    account_id?: string
    platform?: string
    current_page: number
    sync_status: string
    last_sync_at: string
    error_message: string | null
    retry_count: number
    last_lead_timestamp?: string | null
    current_cursor?: string | null
    last_lead_id?: string | null
    current_date_filter?: string | null
    custom_start_date?: string | null
    custom_end_date?: string | null
  }
) {
  const isInsert = !syncStateId

  try {
    let res;
    if (isInsert) {
      res = await supabase
        .from('integration_sync_state')
        .insert({
          account_id: payload.account_id,
          platform: payload.platform,
          current_page: payload.current_page,
          sync_status: payload.sync_status,
          last_sync_at: payload.last_sync_at,
          error_message: payload.error_message,
          retry_count: payload.retry_count,
          last_lead_timestamp: payload.last_lead_timestamp || null,
          current_cursor: payload.current_cursor || null,
          last_lead_id: payload.last_lead_id || null,
          current_date_filter: payload.current_date_filter || null,
          custom_start_date: payload.custom_start_date || null,
          custom_end_date: payload.custom_end_date || null
        })
        .select('*')
        .single()
    } else {
      res = await supabase
        .from('integration_sync_state')
        .update({
          current_page: payload.current_page,
          sync_status: payload.sync_status,
          last_sync_at: payload.last_sync_at,
          error_message: payload.error_message,
          retry_count: payload.retry_count,
          last_lead_timestamp: payload.last_lead_timestamp || null,
          current_cursor: payload.current_cursor || null,
          last_lead_id: payload.last_lead_id || null,
          current_date_filter: payload.current_date_filter || null,
          custom_start_date: payload.custom_start_date || null,
          custom_end_date: payload.custom_end_date || null
        })
        .eq('id', syncStateId)
        .select('*')
        .single()
    }

    if (!res.error) return res.data
    if (res.error.code !== '42703') throw res.error
  } catch (err: any) {
    if (err.code !== '42703') throw err
  }

  // Fallback: columns don't exist
  let resFallback;
  if (isInsert) {
    resFallback = await supabase
      .from('integration_sync_state')
      .insert({
        account_id: payload.account_id,
        platform: payload.platform,
        current_page: payload.current_page,
        sync_status: payload.sync_status,
        last_sync_at: payload.last_sync_at,
        error_message: payload.error_message,
        retry_count: payload.retry_count,
        last_lead_timestamp: payload.last_lead_timestamp || null
      })
      .select('*')
      .single()
  } else {
    resFallback = await supabase
      .from('integration_sync_state')
      .update({
        current_page: payload.current_page,
        sync_status: payload.sync_status,
        last_sync_at: payload.last_sync_at,
        error_message: payload.error_message,
        retry_count: payload.retry_count,
        last_lead_timestamp: payload.last_lead_timestamp || null
      })
      .eq('id', syncStateId)
      .select('*')
      .single()
  }

  if (resFallback.error) {
    console.error('[sync-route] Fallback DB error updating sync state:', resFallback.error)
  }
  return resFallback.data
}

function calculatePageDateBounds(
  platform: string,
  page: number,
  dateFilter: string,
  customStartStr?: string | null,
  customEndStr?: string | null
) {
  const now = new Date()
  let endDateBound = now
  let startDateBound = new Date(now)

  if (dateFilter === '7d') {
    startDateBound.setDate(startDateBound.getDate() - 7)
  } else if (dateFilter === '30d') {
    startDateBound.setDate(startDateBound.getDate() - 30)
  } else if (dateFilter === '90d') {
    startDateBound.setDate(startDateBound.getDate() - 90)
  } else if (dateFilter === '180d') {
    startDateBound.setDate(startDateBound.getDate() - 180)
  } else if (dateFilter === '365d' || dateFilter === 'all') {
    const maxDays = platform === 'EXPORTERSINDIA' ? 60 : 365
    startDateBound.setDate(startDateBound.getDate() - maxDays)
  } else if (dateFilter === 'custom' && customStartStr && customEndStr) {
    startDateBound = new Date(customStartStr)
    endDateBound = new Date(customEndStr)
    if (isNaN(startDateBound.getTime())) startDateBound = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    if (isNaN(endDateBound.getTime())) endDateBound = now
  } else {
    const maxDays = platform === 'EXPORTERSINDIA' ? 60 : 365
    startDateBound.setDate(startDateBound.getDate() - maxDays)
  }

  // Enforce lookback bounds for ExportersIndia
  if (platform === 'EXPORTERSINDIA') {
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    if (startDateBound.getTime() < sixtyDaysAgo.getTime()) {
      startDateBound = sixtyDaysAgo
    }
  }

  const batchSizeDays = platform === 'TRADEINDIA' ? 1 : 7
  const totalTimeDiff = endDateBound.getTime() - startDateBound.getTime()
  const totalDays = Math.max(1, Math.ceil(totalTimeDiff / (24 * 60 * 60 * 1000)))
  const maxPages = Math.ceil(totalDays / batchSizeDays)

  // Calculate page bounds (page 1 starts at oldest bound and goes forward)
  const start = new Date(startDateBound)
  start.setDate(start.getDate() + (page - 1) * batchSizeDays)

  let end = new Date(start)
  end.setDate(end.getDate() + batchSizeDays)
  if (end.getTime() > endDateBound.getTime()) {
    end = new Date(endDateBound)
  }

  return { start, end, maxPages }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const startTime = Date.now()
  try {
    const { platform } = await params
    const platformUpper = platform.toUpperCase()

    if (!['INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA'].includes(platformUpper)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve account_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const accountId = profile.account_id

    // Parse body parameters
    let mode = 'incremental'
    let restart = false
    let dateFilter = '365d'
    let startDate: string | null = null
    let endDate: string | null = null

    try {
      const body = await req.json()
      if (body?.mode === 'historical') {
        mode = 'historical'
      }
      if (body?.restart === true) {
        restart = true
      }
      if (body?.dateFilter) {
        dateFilter = body.dateFilter
      }
      if (body?.startDate) {
        startDate = body.startDate
      }
      if (body?.endDate) {
        endDate = body.endDate
      }
    } catch {
      // Default to incremental
    }

    const adminSupabase = getAdminClient()

    interface RawB2BLead {
      QUERY_TIME?: string | null
      DATE_RECV_TIME?: string | null
      DATE_RECV?: string | null
      generated_date?: string | null
      enq_date?: string | null
      UNIQUE_QUERY_ID?: string | number
      inquiry_id?: string | number
      enquiry_id?: string | number
    }

    interface B2BPlatformService {
      syncLeads(
        accountId: string,
        supabase: ReturnType<typeof getAdminClient>,
        integration: Database['public']['Tables']['b2b_integrations']['Row']
      ): Promise<{ syncedCount: number; duplicateCount: number; rawLogId?: string | null }>
      normalizeLead(raw: unknown, accountId: string): unknown
      saveLead(lead: unknown, supabase: ReturnType<typeof getAdminClient>): Promise<{ leadId: string; isNew: boolean }>
      fetchHistoricalBatch(
        config: Database['public']['Tables']['b2b_integrations']['Row'],
        page: number,
        startDate?: Date,
        endDate?: Date
      ): Promise<{ leads: unknown[]; startStr: string; endStr: string; rawResponse?: unknown }>
    }

    const platformServices: Record<
      string,
      {
        service: B2BPlatformService
        getLeadTimestamp: (raw: RawB2BLead) => Date | null
        getRawLeadId: (raw: RawB2BLead) => string
      }
    > = {
      INDIAMART: {
        service: IndiaMartService as unknown as B2BPlatformService,
        getLeadTimestamp: (raw) => {
          const rawTime = raw.QUERY_TIME || raw.DATE_RECV_TIME || raw.DATE_RECV
          return cleanAndParseDate(rawTime)
        },
        getRawLeadId: (raw) => String(raw.UNIQUE_QUERY_ID || '')
      },
      TRADEINDIA: {
        service: TradeIndiaService as unknown as B2BPlatformService,
        getLeadTimestamp: (raw) => {
          return cleanAndParseDate(raw.generated_date)
        },
        getRawLeadId: (raw) => String(raw.inquiry_id || '')
      },
      EXPORTERSINDIA: {
        service: ExportersIndiaService as unknown as B2BPlatformService,
        getLeadTimestamp: (raw) => {
          return cleanAndParseDate(raw.enq_date)
        },
        getRawLeadId: (raw) => String(raw.enquiry_id || '')
      }
    }

    const platformInfo = platformServices[platformUpper]
    if (!platformInfo) {
      return NextResponse.json({ error: `Sync is not supported for platform: ${platformUpper}` }, { status: 400 })
    }

    // Auto-trigger historical if no leads exist
    if (mode === 'incremental') {
      const { count: leadCount, error: countErr } = await adminSupabase
        .from('b2b_leads')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('platform', platformUpper)

      if (!countErr && leadCount === 0) {
        console.log(`[sync-route] No leads exist in database for platform ${platformUpper} under account ${accountId}. Auto-switching to historical import mode.`)
        mode = 'historical'
      }
    }

    const { data: integration, error: dbError } = await adminSupabase
      .from('b2b_integrations')
      .select('*')
      .eq('account_id', accountId)
      .eq('platform', platformUpper)
      .maybeSingle()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    if (!integration) {
      return NextResponse.json({ error: 'Integration settings not configured.' }, { status: 400 })
    }

    if (!integration.enabled) {
      return NextResponse.json({ error: 'Integration is disabled. Please enable it in Settings.' }, { status: 400 })
    }

    // 1. Fetch or initialize the sync state
    let { data: syncState } = await adminSupabase
      .from('integration_sync_state')
      .select('*')
      .eq('account_id', accountId)
      .eq('platform', platformUpper)
      .maybeSingle()

    // Check sync lock to prevent overlapping executions
    if (syncState && syncState.sync_status === 'RUNNING') {
      const updatedAt = new Date(syncState.updated_at).getTime()
      const elapsedMinutes = (Date.now() - updatedAt) / (60 * 1000)
      if (elapsedMinutes < 10) {
        return NextResponse.json(
          { error: 'A synchronization job is already running for this platform.' },
          { status: 409 }
        )
      }
    }

    if (mode === 'historical') {
      if (restart || !syncState || syncState.sync_status === 'COMPLETED' || syncState.sync_status === 'FAILED') {
        const resetPayload = {
          account_id: accountId,
          platform: platformUpper,
          sync_status: 'RUNNING',
          current_page: 1,
          retry_count: 0,
          error_message: null,
          updated_at: new Date().toISOString(),
          current_date_filter: dateFilter,
          custom_start_date: startDate,
          custom_end_date: endDate
        }
        syncState = await updateSyncState(adminSupabase, syncState?.id || '', resetPayload as any)
      } else {
        // Resume using current filter state
        dateFilter = syncState.current_date_filter || dateFilter
        startDate = syncState.custom_start_date || startDate
        endDate = syncState.custom_end_date || endDate

        const resumePayload = {
          current_page: syncState.current_page,
          sync_status: 'RUNNING',
          error_message: null,
          updated_at: new Date().toISOString()
        }
        syncState = await updateSyncState(adminSupabase, syncState.id, resumePayload as any)
      }

      const currentPage = syncState.current_page

      // 2. Calculate dates for this page
      const { start: pageStart, end: pageEnd, maxPages } = calculatePageDateBounds(
        platformUpper,
        currentPage,
        dateFilter,
        startDate,
        endDate
      )

      try {
        console.log(`[sync-route] Syncing ${platformUpper} historical batch page ${currentPage} of ${maxPages} (${pageStart.toISOString()} to ${pageEnd.toISOString()})`)
        
        // Log started sync
        await saveSyncLog(adminSupabase, {
          account_id: accountId,
          platform: platformUpper,
          started_at: new Date(startTime).toISOString(),
          status: 'RUNNING'
        })

        // Fetch the historical batch
        const apiStartTime = Date.now()
        const batchResult = await platformInfo.service.fetchHistoricalBatch(
          integration,
          currentPage,
          pageStart,
          pageEnd
        )
        const apiResponseTime = Date.now() - apiStartTime

        // Save raw log (omit status and response_json to prevent DB exceptions)
        await adminSupabase.from('b2b_raw_logs').insert({
          account_id: accountId,
          platform: platformUpper,
          payload_json: batchResult.leads || []
        })

        // Save leads, checking for duplicates
        let imported = 0
        let skipped = 0
        let failed = 0
        let lastLeadId: string | null = null

        for (const raw of batchResult.leads) {
          try {
            const lead = platformInfo.service.normalizeLead(raw, accountId)
            const saveRes = await platformInfo.service.saveLead(lead, adminSupabase)
            if (saveRes.isNew) {
              imported++
              lastLeadId = saveRes.leadId || platformInfo.getRawLeadId(raw as RawB2BLead)
            } else {
              skipped++
            }
          } catch (leadSaveErr) {
            failed++
            console.error('[sync-route] Failed to save lead:', leadSaveErr)
          }
        }

        // Find highest timestamp
        let highestTimestamp: Date | null = null
        for (const raw of batchResult.leads) {
          const t = platformInfo.getLeadTimestamp(raw as RawB2BLead)
          if (t) {
            if (!highestTimestamp || t.getTime() > highestTimestamp.getTime()) {
              highestTimestamp = t
            }
          }
        }

        // Update sync state
        const nextPage = currentPage + 1
        const isFinished = nextPage > maxPages

        const statePayload = {
          current_page: isFinished ? 1 : nextPage,
          sync_status: isFinished ? 'COMPLETED' : 'RUNNING',
          last_sync_at: new Date().toISOString(),
          error_message: null,
          retry_count: 0,
          updated_at: new Date().toISOString(),
          last_lead_id: lastLeadId || syncState.last_lead_id,
          last_lead_timestamp: highestTimestamp ? highestTimestamp.toISOString() : syncState.last_lead_timestamp
        }

        const finalState = await updateSyncState(adminSupabase, syncState.id, statePayload)

        // Save finished sync log
        const duration = Date.now() - startTime
        await saveSyncLog(adminSupabase, {
          account_id: accountId,
          platform: platformUpper,
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
          duration,
          status: isFinished ? 'SUCCESS' : 'RUNNING',
          pages_processed: 1,
          imported,
          skipped,
          failed,
          retry_count: 0,
          last_successful_page: currentPage,
          current_cursor: null,
          api_response_time: apiResponseTime
        })

        return NextResponse.json({
          success: true,
          message: isFinished
            ? 'Historical import completed successfully!'
            : `Batch page ${currentPage} completed.`,
          syncState: finalState,
          imported,
          skipped,
          failed,
          totalPages: maxPages,
          dateRange: { start: batchResult.startStr, end: batchResult.endStr }
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[sync-route] Batch page ${currentPage} execution failed:`, err)

        const duration = Date.now() - startTime
        await saveSyncLog(adminSupabase, {
          account_id: accountId,
          platform: platformUpper,
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
          duration,
          status: 'FAILED',
          error_message: errorMsg,
          pages_processed: 1,
          imported: 0,
          skipped: 0,
          failed: 1,
          retry_count: (syncState.retry_count || 0) + 1,
          last_successful_page: currentPage - 1,
          current_cursor: null,
          api_response_time: 0
        })

        // Check if error is retryable
        const isRetryable =
          errorMsg.includes('429') ||
          errorMsg.includes('500') ||
          errorMsg.toLowerCase().includes('timeout') ||
          errorMsg.toLowerCase().includes('fetch failed') ||
          errorMsg.toLowerCase().includes('network')

        const currentRetryCount = (syncState.retry_count || 0) + 1
        const shouldKeepRunning = isRetryable && currentRetryCount <= 5

        const statePayload = {
          current_page: currentPage,
          sync_status: shouldKeepRunning ? 'RUNNING' : 'FAILED',
          error_message: errorMsg,
          retry_count: currentRetryCount,
          last_sync_at: new Date().toISOString()
        }

        const errorState = await updateSyncState(adminSupabase, syncState.id, statePayload)

        return NextResponse.json(
          {
            error: errorMsg,
            syncState: errorState || syncState,
            isRetryable
          },
          { status: errorMsg.includes('429') ? 429 : 500 }
        )
      }
    } else {
      // Incremental mode (standard auto sync)
      const result = await platformInfo.service.syncLeads(accountId, adminSupabase, integration)

      // Fetch final syncState to return
      const { data: finalSyncState } = await adminSupabase
        .from('integration_sync_state')
        .select('*')
        .eq('account_id', accountId)
        .eq('platform', platformUpper)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        message: `Sync completed successfully. Synced ${result.syncedCount} new leads.`,
        syncState: finalSyncState,
        imported: result.syncedCount,
        skipped: result.duplicateCount,
        failed: 0
      })
    }
  } catch (error) {
    console.error('[sync-route] Sync failed:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMsg || 'Sync failed due to server error' },
      { status: 500 }
    )
  }
}
