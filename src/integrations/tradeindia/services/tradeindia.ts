import type { SupabaseClient } from '@supabase/supabase-js'
import { createCrmLeadFromB2B, calculateLeadScore } from '@/lib/crm/crm-lifecycle'
import type { B2BIntegration, B2BLead } from '@/types'
import type { TradeIndiaRawEnquiry, TradeIndiaApiResponse } from '../types'
import { TRADEINDIA_CONFIG } from '../config'
import { mapTradeIndiaToLead } from '../mappers'
import { assignLeadRoundRobin } from '../../shared/round-robin'
import { decryptSecret, getStableExternalLeadId } from '../../shared/crypto'
import { acquireSyncLock, releaseSyncLock } from '../../shared/lock'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

export class TradeIndiaService {
  /**
   * Fetches raw enquiries from the TradeIndia API.
   */
  static async fetchLeads(
    config: B2BIntegration,
    fromDate?: string | null,
    toDate?: string | null
  ): Promise<TradeIndiaRawEnquiry[]> {
    let decryptedKey = ''
    try {
      decryptedKey = decryptSecret(config.api_key) || ''
    } catch {
      decryptedKey = config.api_key || ''
    }
    const isMock = decryptedKey.startsWith('mock') || decryptedKey === 'mock-test'

    if (isMock) {
      console.log('[tradeindia-service] Mock mode active. Generating dummy enquiries.')
      return [
        {
          inquiry_id: `TI-MOCK-STABLE-1`,
          sender_name: 'Jane Doe (TradeIndia Mock)',
          sender_mobile: '+918888888888',
          sender_email: 'jane.mock@tradeindia.com',
          sender_co: 'Doe Enterprises',
          sender_city: 'Delhi',
          sender_state: 'Delhi',
          sender_country: 'India',
          product_name: 'AI Lead Analyzer Plugin',
          quantity: '500 Pcs',
          message: 'Hello, I want to integrate your plugin in my ERP system.',
          generated_date: '2026-06-16T12:00:00.000Z'
        }
      ]
    }

    const baseUrl = config.api_url || TRADEINDIA_CONFIG.defaultUrl
    const url = new URL(baseUrl)
    url.searchParams.set('userid', config.username || '')
    url.searchParams.set('profile_id', config.client_id || '')
    url.searchParams.set('key', decryptedKey)

    let finalFrom = fromDate
    let finalTo = toDate

    if (!finalFrom || !finalTo) {
      const now = new Date()
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const format = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      finalFrom = format(start)
      finalTo = format(now)
    }

    url.searchParams.set('from_date', finalFrom)
    url.searchParams.set('to_date', finalTo)

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json, application/xml, text/xml, */*'
        }
      })

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
      }

      const text = await res.text()
      const trimmed = text.trim()

      if (trimmed.startsWith('<')) {
        return this.parseXmlToRawEnquiries(text)
      } else {
        try {
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed)) {
            return parsed as TradeIndiaRawEnquiry[]
          } else if (parsed && Array.isArray((parsed as TradeIndiaApiResponse).data)) {
            return (parsed as TradeIndiaApiResponse).data || []
          } else if (parsed && Array.isArray(parsed.leads)) {
            return parsed.leads
          } else if (parsed && Array.isArray(parsed.inquiries)) {
            return parsed.inquiries
          }
        } catch {
          // fallback to XML parsing if JSON parse fails
          return this.parseXmlToRawEnquiries(text)
        }
      }

      return []
    } catch (error) {
      console.error('[tradeindia-service] Error fetching leads from TradeIndia:', error)
      throw error
    }
  }

  /**
   * Simple regular-expression-based XML parser for TradeIndia flat elements.
   */
  private static parseXmlToRawEnquiries(xml: string): TradeIndiaRawEnquiry[] {
    const leads: TradeIndiaRawEnquiry[] = []
    const blocks = xml.split('</inquiry>')
    const extractTag = (block: string, tag: string): string => {
      const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`))
      return match ? match[1].trim() : ''
    }

    for (const block of blocks) {
      if (!block.includes('<inquiry>')) continue

      const inquiryId = extractTag(block, 'inquiry_id')
      if (!inquiryId) continue

      let senderMobile = extractTag(block, 'sender_mobile')
      const isPhoneJunk = (p: string) => !p || p.includes('/') || p.includes('.html') || p.includes('http') || p.replace(/[^\d]/g, '').length < 7
      
      if (isPhoneJunk(senderMobile)) {
        const otherMobile = extractTag(block, 'sender_other_mobiles')
        const landline = extractTag(block, 'landline_number')
        const mobileVal = extractTag(block, 'mobile')
        const phoneVal = extractTag(block, 'phone')
        const alternatives = [otherMobile, landline, mobileVal, phoneVal].map(p => p.trim()).filter(Boolean)
        for (const alt of alternatives) {
          if (!isPhoneJunk(alt)) {
            senderMobile = alt
            break
          }
        }
      }

      const generatedDate = extractTag(block, 'generated_date')
      const generatedTime = extractTag(block, 'generated_time')
      let genDateTime = generatedDate
      if (generatedDate && generatedTime) {
        genDateTime = `${generatedDate}T${generatedTime}`
      }

      leads.push({
        inquiry_id: inquiryId,
        sender_name: extractTag(block, 'sender_name') || null,
        sender_mobile: senderMobile || null,
        sender_email: extractTag(block, 'sender_email') || null,
        sender_co: extractTag(block, 'sender_co') || null,
        sender_city: extractTag(block, 'sender_city') || null,
        sender_state: extractTag(block, 'sender_state') || null,
        sender_country: extractTag(block, 'sender_country') || null,
        product_name: extractTag(block, 'subject') || 'Product Inquiry',
        quantity: extractTag(block, 'quantity') || null,
        message: extractTag(block, 'query_message') || null,
        generated_date: genDateTime || null
      })
    }
    return leads
  }

  /**
   * Fetches a historical batch from TradeIndia (pages 1 to 365, dividing 365 days into 1-day chunks)
   */
  static async fetchHistoricalBatch(
    config: B2BIntegration,
    page: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ leads: TradeIndiaRawEnquiry[]; startStr: string; endStr: string; rawResponse?: unknown }> {
    let decryptedKey = ''
    try {
      decryptedKey = decryptSecret(config.api_key) || ''
    } catch {
      decryptedKey = config.api_key || ''
    }
    const isMock = decryptedKey.startsWith('mock') || decryptedKey === 'mock-test'

    let start: Date
    let end: Date

    if (startDate && endDate) {
      start = startDate
      end = endDate
    } else {
      // Divide 365 days into 365 batches of 1 day
      const totalDays = 365
      const batchSizeDays = 1
      const P = page // 1 to 365

      const now = new Date()
      start = new Date(now)
      start.setDate(start.getDate() - (totalDays - (P - 1) * batchSizeDays))

      end = new Date(start)
      end.setDate(end.getDate() + batchSizeDays)
      if (end.getTime() > now.getTime()) {
        end.setTime(now.getTime())
      }
    }

    const format = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const startStr = format(start)
    const endStr = format(end)

    if (isMock) {
      console.log(`[tradeindia-service] Mock historical mode active. Batch ${page}: ${startStr} to ${endStr}`)
      const dummyDate = new Date(start)
      dummyDate.setHours(12, 0, 0, 0)
      return {
        leads: [
          {
            inquiry_id: `TI-HIST-${page}-STABLE`,
            sender_name: `Jane Doe (Historical Page ${page})`,
            sender_mobile: '+918888888888',
            sender_email: `jane.hist.${page}@tradeindia.com`,
            sender_co: 'Doe Enterprises',
            sender_city: 'Delhi',
            sender_state: 'Delhi',
            sender_country: 'India',
            product_name: `AI Lead Analyzer Plugin (Page ${page})`,
            quantity: '500 Pcs',
            message: `Hello, I want to integrate your plugin in my ERP system. Historical page ${page}.`,
            generated_date: dummyDate.toISOString()
          }
        ],
        startStr,
        endStr
      }
    }

    const baseUrl = config.api_url || TRADEINDIA_CONFIG.defaultUrl
    const url = new URL(baseUrl)
    url.searchParams.set('userid', config.username || '')
    url.searchParams.set('profile_id', config.client_id || '')
    url.searchParams.set('key', decryptedKey)
    url.searchParams.set('from_date', startStr)
    url.searchParams.set('to_date', endStr)

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json, application/xml, text/xml, */*'
        }
      })

      if (res.status === 429) {
        throw new Error('API Rate Limit Exceeded')
      }

      if (res.status === 401) {
        throw new Error('Authentication Failed: Invalid API Key')
      }

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
      }

      const text = await res.text()
      const trimmed = text.trim()

      if (trimmed.toLowerCase().includes('invalid key') || trimmed.toLowerCase().includes('unauthorized') || trimmed.toLowerCase().includes('wrong key')) {
        throw new Error('Authentication Failed: Invalid API Key')
      }

      let rawLeads: TradeIndiaRawEnquiry[] = []

      if (trimmed.startsWith('<')) {
        rawLeads = this.parseXmlToRawEnquiries(text)
      } else {
        try {
          const parsed = JSON.parse(text)
          if (parsed && (parsed.error || parsed.message?.toLowerCase().includes('invalid'))) {
            throw new Error(parsed.error || parsed.message)
          }
          if (Array.isArray(parsed)) {
            rawLeads = parsed as TradeIndiaRawEnquiry[]
          } else if (parsed && Array.isArray((parsed as TradeIndiaApiResponse).data)) {
            rawLeads = (parsed as TradeIndiaApiResponse).data || []
          } else if (parsed && Array.isArray(parsed.leads)) {
            rawLeads = parsed.leads
          } else if (parsed && Array.isArray(parsed.inquiries)) {
            rawLeads = parsed.inquiries
          }
        } catch (jsonErr) {
          if (jsonErr instanceof Error && jsonErr.message.includes('Authentication Failed')) {
            throw jsonErr
          }
          rawLeads = this.parseXmlToRawEnquiries(text)
        }
      }

      let rawResponse: unknown = null
      try {
        rawResponse = trimmed.startsWith('<') ? { xml: text } : JSON.parse(text)
      } catch {
        rawResponse = { rawText: text }
      }

      return { leads: rawLeads, startStr, endStr, rawResponse }
    } catch (error) {
      console.error(`[tradeindia-service] Error fetching historical batch for page ${page}:`, error)
      throw error
    }
  }


  /**
   * Tests the connection parameters.
   */
  static async testConnection(config: B2BIntegration): Promise<{ success: boolean; message?: string }> {
    try {
      const leads = await this.fetchLeads(config)
      return {
        success: true,
        message: `Connection successful. Retrieved ${leads.length} enquiries.`
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to connect to TradeIndia API.'
      }
    }
  }

  /**
   * Normalizes a raw lead payload.
   */
  static normalizeLead(raw: TradeIndiaRawEnquiry, accountId: string): Omit<B2BLead, 'id' | 'created_at' | 'updated_at' | 'assignee'> {
    const lead = mapTradeIndiaToLead(raw, accountId)
    lead.external_lead_id = getStableExternalLeadId(
      'TRADEINDIA',
      lead.external_lead_id,
      lead.mobile,
      lead.product_name,
      lead.inquiry_at
    )
    return lead
  }

  /**
   * Saves a normalized lead and triggers post-save tasks.
   */
  static async saveLead(
    lead: Omit<B2BLead, 'id' | 'created_at' | 'updated_at' | 'assignee'>,
    supabase: SupabaseClient
  ): Promise<{ leadId: string; isNew: boolean }> {
    try {
      // 1. Check if lead already exists
      const { data: existingLead, error: findError } = await supabase
        .from('b2b_leads')
        .select('id, status, assigned_to, notes, message, created_at')
        .eq('account_id', lead.account_id)
        .eq('platform', lead.platform)
        .eq('external_lead_id', lead.external_lead_id)
        .maybeSingle()

      if (findError) {
        throw findError
      }

      let leadId: string
      let wasInserted = false

      if (existingLead) {
        leadId = existingLead.id
        
        // Prepare updates for existing record.
        // Preserve: status (keep existing if not default/pending), assigned_to (keep existing assignee), notes (keep existing notes)
        // Update: message (take incoming or keep existing), updated_at
        
        const updatePayload: Record<string, unknown> = {
          message: lead.message ?? existingLead.message,
          updated_at: new Date().toISOString()
        }

        updatePayload.status = existingLead.status || lead.status || 'pending'
        updatePayload.assigned_to = existingLead.assigned_to || lead.assigned_to || null
        updatePayload.notes = existingLead.notes || lead.notes || null

        const { error: updateError } = await supabase
          .from('b2b_leads')
          .update(updatePayload)
          .eq('id', existingLead.id)

        if (updateError) {
          throw updateError
        }
      } else {
        // Not found -> Insert as a new lead
        wasInserted = true
        const { data: inserted, error: insertError } = await supabase
          .from('b2b_leads')
          .upsert(lead, {
            onConflict: 'platform,external_lead_id',
            ignoreDuplicates: false
          })
          .select('id')
          .single()

        if (insertError) {
          throw insertError
        }
        leadId = inserted.id
      }

      if (wasInserted) {
        if (lead.mobile) {
          try {
            const { data: existingContact } = await supabase
              .from('contacts')
              .select('id')
              .eq('account_id', lead.account_id)
              .eq('phone', lead.mobile)
              .limit(1)

            if (!existingContact || existingContact.length === 0) {
              const { data: acc } = await supabase
                .from('accounts')
                .select('owner_user_id')
                .eq('id', lead.account_id)
                .single()

              if (acc) {
                await supabase.from('contacts').insert({
                  account_id: lead.account_id,
                  user_id: acc.owner_user_id,
                  phone: lead.mobile,
                  name: lead.buyer_name || 'TradeIndia Buyer',
                  email: lead.email || null,
                  company: lead.company_name || null
                })
                console.log(`[tradeindia-service] Automatically created CRM contact for ${lead.mobile}`)
              }
            }
          } catch (contactError) {
            console.error('[tradeindia-service] Failed to auto-create contact:', contactError)
          }
        }

        try {
          await assignLeadRoundRobin(lead.account_id, leadId, supabase)
        } catch (assignError) {
          console.error('[tradeindia-service] Lead assignment failed:', assignError)
        }

        try {
          await this.dispatchWhatsAppNotification(lead, supabase)
        } catch (notifyError) {
          console.error('[tradeindia-service] WhatsApp notification failed:', notifyError)
        }

        // Bridge to CRM Lifecycle Pipeline
        try {
          const { lead: crmLead } = await createCrmLeadFromB2B(
            supabase,
            lead.account_id,
            {
              id: leadId,
              platform: lead.platform,
              buyer_name: lead.buyer_name ?? undefined,
              company_name: lead.company_name ?? undefined,
              mobile: lead.mobile ?? undefined,
              email: lead.email ?? undefined,
              city: lead.city ?? undefined,
              state: lead.state ?? undefined,
              country: lead.country ?? undefined,
              product_name: lead.product_name ?? undefined,
              quantity: lead.quantity ?? undefined,
              message: lead.message ?? undefined,
              inquiry_at: lead.inquiry_at ?? undefined,
            }
          )
          if (crmLead) {
            const { score, category, urgency } = calculateLeadScore(crmLead)
            await supabase
              .from('crm_leads')
              .update({ lead_score: score, lead_category: category, urgency })
              .eq('id', crmLead.id)
            console.log(`[tradeindia-service] CRM lead created: ${crmLead.id} (score: ${score})`)
          }
        } catch (crmError) {
          console.error('[tradeindia-service] CRM lifecycle bridge failed:', crmError)
        }
      }

      return { leadId, isNew: wasInserted }
    } catch (error) {
      console.error('[tradeindia-service] Error in saveLead:', error)
      throw error
    }
  }


  /**
   * Dispatches WhatsApp notifications to enabled account recipients.
   */
  private static async dispatchWhatsAppNotification(
    lead: Omit<B2BLead, 'id' | 'created_at' | 'updated_at' | 'assignee'>,
    supabase: SupabaseClient
  ): Promise<void> {
    const { data: recipients } = await supabase
      .from('notification_recipients')
      .select('name, mobile')
      .eq('account_id', lead.account_id)
      .eq('enabled', true)

    if (!recipients || recipients.length === 0) {
      return
    }

    const { data: waConfig } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('account_id', lead.account_id)
      .single()

    if (!waConfig || !waConfig.phone_number_id || !waConfig.access_token) {
      return
    }

    const accessToken = decryptSecret(waConfig.access_token)
    if (!accessToken) return

    const msg = `New Lead Received

Platform: ${lead.platform}
Buyer Name: ${lead.buyer_name || 'N/A'}
Company: ${lead.company_name || 'N/A'}
Mobile: ${lead.mobile || 'N/A'}
Email: ${lead.email || 'N/A'}
Product: ${lead.product_name || 'N/A'}
Quantity: ${lead.quantity || 'N/A'}
Location: ${[lead.city, lead.state, lead.country].filter(Boolean).join(', ') || 'N/A'}`

    for (const r of recipients) {
      try {
        await sendWhatsAppMessage(r.mobile, msg, waConfig.phone_number_id, accessToken)
      } catch (err) {
        console.error(`[tradeindia-service] WhatsApp notification failed for ${r.mobile}:`, err)
      }
    }
  }

  /**
   * Performs the complete lead fetch and storage flow.
   */
  static async syncLeads(
    accountId: string,
    supabase: SupabaseClient,
    config: B2BIntegration
  ): Promise<{ syncedCount: number; duplicateCount: number }> {
    const lockAcquired = await acquireSyncLock(supabase, accountId, 'TRADEINDIA')
    if (!lockAcquired) {
      console.log('[tradeindia-service] Sync lock already active. Skipping execution.')
      return { syncedCount: 0, duplicateCount: 0 }
    }

    try {
      // 1. Fetch or initialize the sync state to get the last sync point
      const { data: syncState } = await supabase
        .from('integration_sync_state')
        .select('*')
        .eq('account_id', accountId)
        .eq('platform', 'TRADEINDIA')
        .maybeSingle()

      const now = new Date();
      let start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // default 24 hours ago
      const lastSyncTimeStr = syncState ? (syncState.last_successful_sync || syncState.last_lead_timestamp) : null;
      if (lastSyncTimeStr) {
        start = new Date(lastSyncTimeStr);
      }

      const format = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      // Chunk requests into 24-hour blocks to respect TradeIndia limit
      const rawLeads: TradeIndiaRawEnquiry[] = []
      let currentStart = new Date(start)

      while (currentStart.getTime() < now.getTime()) {
        let currentEnd = new Date(currentStart.getTime() + 24 * 60 * 60 * 1000)
        if (currentEnd.getTime() > now.getTime()) {
          currentEnd = new Date(now)
        }

        const fromStr = format(currentStart)
        const toStr = format(currentEnd)

        console.log(`[tradeindia-service] Fetching chunk: ${fromStr} to ${toStr}`)
        try {
          const chunkLeads = await this.fetchLeads(config, fromStr, toStr)
          rawLeads.push(...chunkLeads)
        } catch (err) {
          // If a chunk fails, log it and rethrow to abort lock release
          console.error(`[tradeindia-service] Failed fetching chunk ${fromStr} to ${toStr}:`, err)
          throw err
        }

        // Increment currentStart by 24 hours
        currentStart = new Date(currentStart.getTime() + 24 * 60 * 60 * 1000)

        // Cooldown between chunks if more are remaining
        if (currentStart.getTime() < now.getTime()) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      if (rawLeads.length === 0) {
        await supabase
          .from('b2b_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id)
        
        await supabase
          .from('integration_sync_state')
          .upsert({
            account_id: accountId,
            platform: 'TRADEINDIA',
            last_sync_at: new Date().toISOString(),
            last_successful_sync: new Date().toISOString(),
            sync_status: 'COMPLETED',
            error_message: null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'account_id,platform'
          })

        await releaseSyncLock(supabase, accountId, 'TRADEINDIA', 'COMPLETED')
        return { syncedCount: 0, duplicateCount: 0 }
      }

      await supabase.from('b2b_raw_logs').insert({
        account_id: accountId,
        platform: 'TRADEINDIA',
        payload_json: rawLeads
      })

      let syncedCount = 0
      let duplicateCount = 0

      for (const raw of rawLeads) {
        const lead = this.normalizeLead(raw, accountId)
        const result = await this.saveLead(lead, supabase)
        if (result.isNew) {
          syncedCount++
        } else {
          duplicateCount++
        }
      }

      await supabase
        .from('b2b_integrations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', config.id)

      // Find the highest received_at or DATE_RECV_TIME to update integration_sync_state
      let highestTimestamp: Date | null = null
      for (const raw of rawLeads) {
        if (raw.generated_date) {
          const t = new Date(raw.generated_date)
          if (!isNaN(t.getTime())) {
            if (!highestTimestamp || t.getTime() > highestTimestamp.getTime()) {
              highestTimestamp = t
            }
          }
        }
      }

      const syncStateUpdate: Record<string, unknown> = {
        account_id: accountId,
        platform: 'TRADEINDIA',
        last_sync_at: new Date().toISOString(),
        last_successful_sync: new Date().toISOString(),
        sync_status: 'COMPLETED',
        error_message: null,
        updated_at: new Date().toISOString()
      };

      if (highestTimestamp) {
        syncStateUpdate.last_lead_timestamp = highestTimestamp.toISOString();
      }

      await supabase
        .from('integration_sync_state')
        .upsert(syncStateUpdate, {
          onConflict: 'account_id,platform'
        })

      await releaseSyncLock(supabase, accountId, 'TRADEINDIA', 'COMPLETED')
      return { syncedCount, duplicateCount }
    } catch (error: unknown) {
      console.error('[tradeindia-service] Error in syncLeads:', error)
      try {
        await supabase
          .from('b2b_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id)
      } catch (dbErr) {
        console.error('[tradeindia-service] Failed to update last_sync_at on failure:', dbErr)
      }
      await releaseSyncLock(supabase, accountId, 'TRADEINDIA', 'FAILED', error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}
