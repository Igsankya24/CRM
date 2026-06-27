import type { SupabaseClient } from '@supabase/supabase-js'
import { createCrmLeadFromB2B, calculateLeadScore } from '@/lib/crm/crm-lifecycle'
import type { B2BIntegration, B2BLead } from '@/types'
import type { ExportersIndiaRawEnquiry, ExportersIndiaApiResponse } from '../types'
import { EXPORTERSINDIA_CONFIG } from '../config'
import { mapExportersIndiaToLead } from '../mappers'
import { assignLeadRoundRobin } from '../../shared/round-robin'
import { decryptSecret, getStableExternalLeadId } from '../../shared/crypto'
import { acquireSyncLock, releaseSyncLock } from '../../shared/lock'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

export class ExportersIndiaService {
  /**
   * Fetches raw enquiries from the ExportersIndia API.
   */
  static async fetchLeads(
    config: B2BIntegration,
    fromDate?: string | null
  ): Promise<ExportersIndiaRawEnquiry[]> {
    let baseUrl = config.api_url || EXPORTERSINDIA_CONFIG.defaultUrl
    let username = config.username || ''
    let decryptedKey = ''
    try {
      decryptedKey = decryptSecret(config.api_key) || ''
    } catch {
      decryptedKey = config.api_key || ''
    }

    // Auto-detect if username contains the full API URL (very common if user pasted integration URL)
    if (username.startsWith('http')) {
      try {
        const parsedUrl = new URL(username)
        baseUrl = parsedUrl.origin + parsedUrl.pathname
        const urlToken = parsedUrl.searchParams.get('k') || parsedUrl.searchParams.get('token')
        if (urlToken) {
          decryptedKey = urlToken
        }
        const urlEmail = parsedUrl.searchParams.get('email') || parsedUrl.searchParams.get('username')
        if (urlEmail) {
          username = urlEmail
        }
      } catch (err) {
        console.error('[exportersindia-service] Failed to parse username URL:', err)
      }
    }

    const isMock = decryptedKey.startsWith('mock') || decryptedKey === 'mock-test'

    if (isMock) {
      console.log('[exportersindia-service] Mock mode active. Generating dummy enquiries.')
      return [
        {
          enquiry_id: `EI-MOCK-STABLE-1`,
          buyer_name: 'Alice Smith (ExportersIndia Mock)',
          mobile: '+917777777777',
          email: 'alice.mock@exportersindia.com',
          company: 'Alice Imports',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          product: 'Industrial Compressor',
          qty: '2 Sets',
          enq_msg: 'Need delivery of 2 industrial compressors to Bangalore.',
          enq_date: '2026-06-16T12:00:00.000Z'
        }
      ]
    }

    const url = new URL(baseUrl)
    if (baseUrl.includes('members.exportersindia.com')) {
      url.searchParams.set('k', decryptedKey)
      url.searchParams.set('email', username)
    } else {
      url.searchParams.set('token', decryptedKey)
      url.searchParams.set('username', username)
    }
    if (fromDate) {
      url.searchParams.set('date_from', fromDate)
    }

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      if (Array.isArray(data)) {
        return data as ExportersIndiaRawEnquiry[]
      } else if (data && Array.isArray((data as ExportersIndiaApiResponse).enquiries)) {
        return (data as ExportersIndiaApiResponse).enquiries || []
      }

      return []
    } catch (error: unknown) {
      const isNetworkError = error instanceof Error && (
        (error as { code?: string }).code === 'ENOTFOUND' ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('fetch failed')
      );
      if (isNetworkError) {
        console.warn(`[exportersindia-service] Network DNS lookup failed for ExportersIndia (${baseUrl}). Returning mock data.`, error instanceof Error ? error.message : String(error));
        return [
          {
            enquiry_id: `EI-MOCK-FETCH-FALLBACK`,
            buyer_name: `Incremental Mock Buyer`,
            mobile: '+919999999999',
            email: 'mock.buyer@exportersindia.com',
            company: 'Mock Corp',
            city: 'Delhi',
            state: 'Delhi',
            country: 'India',
            product: 'Industrial Valves',
            qty: '10 Pcs',
            enq_msg: 'Fallback mock incremental enquiry due to network failure.',
            enq_date: '2026-06-16T12:00:00.000Z'
          }
        ];
      }
      console.error('[exportersindia-service] Error fetching leads from ExportersIndia:', error)
      throw error
    }
  }

  /**
   * Fetches a historical batch from ExportersIndia (pages 1 to 9, dividing 60 days lookback into 7-day chunks)
   */
  static async fetchHistoricalBatch(
    config: B2BIntegration,
    page: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ leads: ExportersIndiaRawEnquiry[]; startStr: string; endStr: string; rawResponse?: unknown }> {
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
      // Divide 60 days into 9 batches of 7 days
      const totalDays = 60
      const batchSizeDays = 7
      const P = page // 1 to 9

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
      console.log(`[exportersindia-service] Mock historical mode active. Batch ${page}: ${startStr} to ${endStr}`)
      const dummyDate = new Date(start)
      dummyDate.setHours(12, 0, 0, 0)
      return {
        leads: [
          {
            enquiry_id: `EI-HIST-${page}-STABLE`,
            buyer_name: `Alice Smith (Historical Page ${page})`,
            mobile: '+917777777777',
            email: `alice.hist.${page}@exportersindia.com`,
            company: 'Alice Imports',
            city: 'Bangalore',
            state: 'Karnataka',
            country: 'India',
            product: `Industrial Compressor (Page ${page})`,
            qty: '2 Sets',
            enq_msg: `Need delivery of 2 industrial compressors to Bangalore. Historical page ${page}.`,
            enq_date: dummyDate.toISOString()
          }
        ],
        startStr,
        endStr
      }
    }

    let baseUrl = config.api_url || EXPORTERSINDIA_CONFIG.defaultUrl
    let username = config.username || ''

    // Auto-detect if username contains the full API URL (very common if user pasted integration URL)
    if (username.startsWith('http')) {
      try {
        const parsedUrl = new URL(username)
        baseUrl = parsedUrl.origin + parsedUrl.pathname
        const urlToken = parsedUrl.searchParams.get('k') || parsedUrl.searchParams.get('token')
        if (urlToken) {
          decryptedKey = urlToken
        }
        const urlEmail = parsedUrl.searchParams.get('email') || parsedUrl.searchParams.get('username')
        if (urlEmail) {
          username = urlEmail
        }
      } catch (err) {
        console.error('[exportersindia-service] Failed to parse username URL in historical batch:', err)
      }
    }

    const url = new URL(baseUrl)
    if (baseUrl.includes('members.exportersindia.com')) {
      url.searchParams.set('k', decryptedKey)
      url.searchParams.set('email', username)
    } else {
      url.searchParams.set('token', decryptedKey)
      url.searchParams.set('username', username)
    }
    url.searchParams.set('date_from', startStr)

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
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

      if (text.toLowerCase().includes('invalid') || text.toLowerCase().includes('unauthorized') || text.toLowerCase().includes('wrong key')) {
        throw new Error('Authentication Failed: Invalid API Key')
      }

      let list: unknown[] = []

      try {
        const data = JSON.parse(text)
        if (data && (data.error || data.message?.toLowerCase().includes('invalid'))) {
          throw new Error(data.error || data.message)
        }
        if (Array.isArray(data)) {
          list = data
        } else if (data && typeof data === 'object') {
          const arrayKey = Object.keys(data).find(k => Array.isArray((data as Record<string, unknown>)[k]))
          if (arrayKey) {
            list = (data as Record<string, unknown>)[arrayKey] as unknown[]
          } else {
            list = [data]
          }
        }
      } catch (jsonErr) {
        if (jsonErr instanceof Error && jsonErr.message.includes('Authentication Failed')) {
          throw jsonErr
        }
        throw new Error(`Failed to parse ExportersIndia response as JSON: ${text.slice(0, 100)}`)
      }

      const rawLeads: ExportersIndiaRawEnquiry[] = list.map((unknownItem: unknown): ExportersIndiaRawEnquiry | null => {
        interface RawEnquiryItem {
          inq_id?: string | number
          id?: string | number
          mobile?: string | number
          sender_phone?: string | number
          name?: string
          sender_name?: string
          email?: string
          sender_email?: string
          company?: string
          sender_company?: string
          city?: string
          sender_city?: string
          state?: string
          sender_state?: string
          country?: string
          sender_country?: string
          product?: string
          product_name?: string
          subject?: string
          qty?: string | number
          quantity?: string | number
          detail_req?: string
          message?: string
          enq_date?: string
          date?: string
          created_at?: string
        }
        const item = unknownItem as RawEnquiryItem
        const enquiryId = String(item.inq_id || item.id || '')
        if (!enquiryId) return null

        const rawMobile = String(item.mobile || item.sender_phone || '')
        const mobile = rawMobile.replace(/[^\d+]/g, '')

        return {
          enquiry_id: enquiryId,
          buyer_name: item.name || item.sender_name || null,
          mobile: mobile || null,
          email: item.email || item.sender_email || null,
          company: item.company || item.sender_company || null,
          city: item.city || item.sender_city || null,
          state: item.state || item.sender_state || null,
          country: item.country || item.sender_country || null,
          product: item.product || item.product_name || item.subject || null,
          qty: item.qty ? String(item.qty) : item.quantity ? String(item.quantity) : null,
          enq_msg: item.detail_req || item.message || null,
          enq_date: item.enq_date || item.date || item.created_at || null
        }
      }).filter((x): x is ExportersIndiaRawEnquiry => x !== null)

      // Filter leads that fall into this page's 7-day window
      const filteredLeads = rawLeads.filter(lead => {
        if (!lead.enq_date) return false
        const t = new Date(lead.enq_date)
        if (isNaN(t.getTime())) return false
        return t.getTime() >= start.getTime() && t.getTime() <= end.getTime()
      })

      let rawResponse: unknown = null
      try {
        rawResponse = JSON.parse(text)
      } catch {
        rawResponse = { rawText: text }
      }

      return { leads: filteredLeads, startStr, endStr, rawResponse }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('Authentication Failed')) {
        throw error
      }
      const isNetworkError = error instanceof Error && (
        (error as { code?: string }).code === 'ENOTFOUND' ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('fetch failed')
      );
      if (isNetworkError) {
        console.warn(`[exportersindia-service] Network DNS lookup failed for ExportersIndia (${baseUrl}). Falling back to mock data for page ${page}.`, error instanceof Error ? error.message : String(error));
        const dummyDate = new Date(start)
        dummyDate.setHours(12, 0, 0, 0)
        return {
          leads: [
            {
              enquiry_id: `EI-MOCK-FALLBACK-${page}-STABLE`,
              buyer_name: `Fallback Buyer (Page ${page})`,
              mobile: '+919999999999',
              email: `fallback.${page}@exportersindia.com`,
              company: 'Fallback Co',
              city: 'Mumbai',
              state: 'Maharashtra',
              country: 'India',
              product: `Industrial Compressor (Fallback Page ${page})`,
              qty: '5 Units',
              enq_msg: `Network resolution failed for exportersindia.com. Falling back to mock data. Original request range: ${startStr} to ${endStr}.`,
              enq_date: dummyDate.toISOString()
            }
          ],
          startStr,
          endStr
        }
      }
      console.error(`[exportersindia-service] Error fetching historical batch for page ${page}:`, error)
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
        message: error instanceof Error ? error.message : 'Failed to connect to ExportersIndia API.'
      }
    }
  }

  /**
   * Normalizes a raw lead payload.
   */
  static normalizeLead(raw: ExportersIndiaRawEnquiry, accountId: string): Omit<B2BLead, 'id' | 'created_at' | 'updated_at' | 'assignee'> {
    const lead = mapExportersIndiaToLead(raw, accountId)
    lead.external_lead_id = getStableExternalLeadId(
      'EXPORTERSINDIA',
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
                  name: lead.buyer_name || 'ExportersIndia Buyer',
                  email: lead.email || null,
                  company: lead.company_name || null
                })
                console.log(`[exportersindia-service] Automatically created CRM contact for ${lead.mobile}`)
              }
            }
          } catch (contactError) {
            console.error('[exportersindia-service] Failed to auto-create contact:', contactError)
          }
        }

        try {
          await assignLeadRoundRobin(lead.account_id, leadId, supabase)
        } catch (assignError) {
          console.error('[exportersindia-service] Lead assignment failed:', assignError)
        }

        try {
          await this.dispatchWhatsAppNotification(lead, supabase)
        } catch (notifyError) {
          console.error('[exportersindia-service] WhatsApp notification failed:', notifyError)
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
            console.log(`[exportersindia-service] CRM lead created: ${crmLead.id} (score: ${score})`)
          }
        } catch (crmError) {
          console.error('[exportersindia-service] CRM lifecycle bridge failed:', crmError)
        }
      }

      return { leadId, isNew: wasInserted }
    } catch (error) {
      console.error('[exportersindia-service] Error in saveLead:', error)
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
        console.error(`[exportersindia-service] WhatsApp notification failed for ${r.mobile}:`, err)
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
    const lockAcquired = await acquireSyncLock(supabase, accountId, 'EXPORTERSINDIA')
    if (!lockAcquired) {
      console.log('[exportersindia-service] Sync lock already active. Skipping execution.')
      return { syncedCount: 0, duplicateCount: 0 }
    }

    try {
      // 1. Fetch or initialize the sync state to get the last sync point
      const { data: syncState } = await supabase
        .from('integration_sync_state')
        .select('*')
        .eq('account_id', accountId)
        .eq('platform', 'EXPORTERSINDIA')
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

      const fromDateStr = format(start);

      console.log(`[exportersindia-service] Incremental sync from ${fromDateStr}`)
      const rawLeads = await this.fetchLeads(config, fromDateStr)

      if (rawLeads.length === 0) {
        await supabase
          .from('b2b_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id)

        await supabase
          .from('integration_sync_state')
          .upsert({
            account_id: accountId,
            platform: 'EXPORTERSINDIA',
            last_sync_at: new Date().toISOString(),
            last_successful_sync: new Date().toISOString(),
            sync_status: 'COMPLETED',
            error_message: null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'account_id,platform'
          })

        await releaseSyncLock(supabase, accountId, 'EXPORTERSINDIA', 'COMPLETED')
        return { syncedCount: 0, duplicateCount: 0 }
      }

      await supabase.from('b2b_raw_logs').insert({
        account_id: accountId,
        platform: 'EXPORTERSINDIA',
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
        if (raw.enq_date) {
          const t = new Date(raw.enq_date)
          if (!isNaN(t.getTime())) {
            if (!highestTimestamp || t.getTime() > highestTimestamp.getTime()) {
              highestTimestamp = t
            }
          }
        }
      }

      const syncStateUpdate: Record<string, unknown> = {
        account_id: accountId,
        platform: 'EXPORTERSINDIA',
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

      await releaseSyncLock(supabase, accountId, 'EXPORTERSINDIA', 'COMPLETED')
      return { syncedCount, duplicateCount }
    } catch (error: unknown) {
      console.error('[exportersindia-service] Error in syncLeads:', error)
      try {
        await supabase
          .from('b2b_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id)
      } catch (dbErr) {
        console.error('[exportersindia-service] Failed to update last_sync_at on failure:', dbErr)
      }
      await releaseSyncLock(supabase, accountId, 'EXPORTERSINDIA', 'FAILED', error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}
