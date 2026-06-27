import type { SupabaseClient } from '@supabase/supabase-js'
import { createCrmLeadFromB2B, calculateLeadScore } from '@/lib/crm/crm-lifecycle'
import type { B2BIntegration, B2BLead } from '@/types'
import type { IndiaMartRawEnquiry, IndiaMartApiResponse } from '../types'
import { mapIndiaMartToLead } from '../mappers'
import { assignLeadRoundRobin } from '../../shared/round-robin'
import { decryptSecret, getStableExternalLeadId } from '../../shared/crypto'
import { acquireSyncLock, releaseSyncLock } from '../../shared/lock'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

export class IndiaMartService {
  /**
   * Fetches raw enquiries from the IndiaMART Pull API.
   */
  static async fetchLeads(config: B2BIntegration): Promise<IndiaMartRawEnquiry[]> {
    // 1. Check if we are in mock mode for testing
    let decryptedKey = ''
    try {
      decryptedKey = decryptSecret(config.api_key) || ''
    } catch {
      decryptedKey = config.api_key || ''
    }
    const isMock = decryptedKey.startsWith('mock') || decryptedKey === 'mock-test'

    if (isMock) {
      console.log('[indiamart-service] Mock mode active. Generating dummy enquiries.')
      return [
        {
          UNIQUE_QUERY_ID: `IM-MOCK-STABLE-1`,
          SENDER_NAME: 'Sanket B (IndiaMART Mock)',
          SENDER_MOBILE: '+919999999999',
          SENDER_EMAIL: 'sanket.mock@indiamart.com',
          SENDER_COMPANY: 'Antigravity IndiaMART',
          SENDER_CITY: 'Mumbai',
          SENDER_STATE: 'Maharashtra',
          SENDER_COUNTRY_ISO: 'IN',
          QUERY_PRODUCT_NAME: 'Super CRM with WhatsApp Automation',
          QUERY_QTY: '15 Units',
          QUERY_MESSAGE: 'Hi, I saw your CRM listing and want a demo of the WhatsApp features.',
          DATE_RECV_TIME: '2026-06-16 12:00:00'
        }
      ]
    }

    const now = new Date()
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    const format = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hh = String(date.getHours()).padStart(2, '0')
      const mm = String(date.getMinutes()).padStart(2, '0')
      const ss = String(date.getSeconds()).padStart(2, '0')
      return `${day}-${month}-${year} ${hh}:${mm}:${ss}`
    }

    const startStr = format(start)
    const endStr = format(now)

    // ALWAYS use the correct CRM Listing API v2
    const apiUrl = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${encodeURIComponent(decryptedKey)}&start_time=${encodeURIComponent(startStr)}&end_time=${encodeURIComponent(endStr)}`

    try {
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-store'
      })

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
      }

      const data = (await res.json()) as IndiaMartApiResponse

      if (data.STATUS === 'FAILURE') {
        throw new Error(data.MESSAGE || 'IndiaMART API returned FAILURE status.')
      }

      if (data.CODE === '200' && Array.isArray(data.RESPONSE)) {
        return data.RESPONSE
      } else if (data.STATUS === 'SUCCESS' && Array.isArray(data.RESPONSE)) {
        return data.RESPONSE
      } else if (typeof data.RESPONSE === 'string') {
        console.log(`[indiamart-service] Response: ${data.RESPONSE}`)
        return []
      }

      return []
    } catch (error: unknown) {
      console.error('[indiamart-service] Error fetching leads from IndiaMART:', error)
      if (error instanceof Error && error.message === 'fetch failed') {
        const cause = (error as { cause?: { code?: string; hostname?: string; message?: string } }).cause
        if (cause && cause.code === 'ENOTFOUND') {
          throw new Error(`Could not resolve host ${cause.hostname}. Please check your API URL.`)
        }
        throw new Error(`Network request failed: ${cause?.message || error.message}`)
      }
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
        message: error instanceof Error ? error.message : 'Failed to connect to IndiaMART API.'
      }
    }
  }

  /**
   * Normalizes a raw lead payload.
   */
  static normalizeLead(raw: IndiaMartRawEnquiry, accountId: string): Omit<B2BLead, 'id' | 'created_at' | 'updated_at' | 'assignee'> {
    const lead = mapIndiaMartToLead(raw, accountId)
    lead.external_lead_id = getStableExternalLeadId(
      'INDIAMART',
      lead.external_lead_id,
      lead.mobile,
      lead.product_name,
      lead.inquiry_at
    )
    return lead
  }

  /**
   * Saves a normalized lead and triggers post-save tasks (Assignment, Notification, Contact Sync).
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

      // Only run post-save side-effects for brand-new leads
      if (wasInserted) {
        // 3. Auto-create standard CRM Contact
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
                  name: lead.buyer_name || 'IndiaMART Buyer',
                  email: lead.email || null,
                  company: lead.company_name || null
                })
                console.log(`[indiamart-service] Automatically created CRM contact for ${lead.mobile}`)
              }
            }
          } catch (contactError) {
            console.error('[indiamart-service] Failed to auto-create contact:', contactError)
          }
        }

        // 4. Trigger Round Robin Lead Assignment
        try {
          await assignLeadRoundRobin(lead.account_id, leadId, supabase)
        } catch (assignError) {
          console.error('[indiamart-service] Lead assignment failed:', assignError)
        }

        // 5. Send WhatsApp notifications
        try {
          await this.dispatchWhatsAppNotification(lead, supabase)
        } catch (notifyError) {
          console.error('[indiamart-service] WhatsApp notification failed:', notifyError)
        }

        // 6. Bridge to CRM Lifecycle Pipeline
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
            // Auto-score the lead
            const { score, category, urgency } = calculateLeadScore(crmLead)
            await supabase
              .from('crm_leads')
              .update({ lead_score: score, lead_category: category, urgency })
              .eq('id', crmLead.id)
            console.log(`[indiamart-service] CRM lead created: ${crmLead.id} (score: ${score}, category: ${category})`)
          }
        } catch (crmError) {
          // Non-blocking: CRM bridge failure should not break B2B sync
          console.error('[indiamart-service] CRM lifecycle bridge failed:', crmError)
        }
      }

      return { leadId, isNew: wasInserted }
    } catch (error) {
      console.error('[indiamart-service] Error in saveLead:', error)
      throw error
    }
  }

  /**
   * Sends WhatsApp notifications to all enabled staff recipients configured in the account.
   */
  private static async dispatchWhatsAppNotification(
    lead: Omit<B2BLead, 'id' | 'created_at' | 'updated_at' | 'assignee'>,
    supabase: SupabaseClient
  ): Promise<void> {
    // 1. Fetch enabled notification recipients
    const { data: recipients } = await supabase
      .from('notification_recipients')
      .select('name, mobile')
      .eq('account_id', lead.account_id)
      .eq('enabled', true)

    if (!recipients || recipients.length === 0) {
      return
    }

    // 2. Fetch WhatsApp config for the account
    const { data: waConfig } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token, status')
      .eq('account_id', lead.account_id)
      .single()

    if (!waConfig || !waConfig.phone_number_id || !waConfig.access_token) {
      console.log(`[indiamart-service] WhatsApp not configured for account ${lead.account_id}. Skipping notifications.`)
      return
    }

    const accessToken = decryptSecret(waConfig.access_token)
    if (!accessToken) {
      console.log(`[indiamart-service] Could not decrypt WhatsApp access token. Skipping.`)
      return
    }

    // 3. Format message template
    const msg = `New Lead Received

Platform: ${lead.platform}
Buyer Name: ${lead.buyer_name || 'N/A'}
Company: ${lead.company_name || 'N/A'}
Mobile: ${lead.mobile || 'N/A'}
Email: ${lead.email || 'N/A'}
Product: ${lead.product_name || 'N/A'}
Quantity: ${lead.quantity || 'N/A'}
Location: ${[lead.city, lead.state, lead.country].filter(Boolean).join(', ') || 'N/A'}`

    // 4. Send to each recipient
    for (const r of recipients) {
      try {
        console.log(`[indiamart-service] Dispatched WhatsApp notification to ${r.name} (${r.mobile})`)
        await sendWhatsAppMessage(r.mobile, msg, waConfig.phone_number_id, accessToken)
      } catch (err) {
        console.error(`[indiamart-service] Error sending WhatsApp notification to ${r.mobile}:`, err)
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
    const lockAcquired = await acquireSyncLock(supabase, accountId, 'INDIAMART')
    if (!lockAcquired) {
      console.log('[indiamart-service] Sync lock already active. Skipping execution.')
      return { syncedCount: 0, duplicateCount: 0 }
    }

    try {
      // Check if there is an integration sync state
      const { data: syncState } = await supabase
        .from('integration_sync_state')
        .select('*')
        .eq('account_id', accountId)
        .eq('platform', 'INDIAMART')
        .maybeSingle()

      // Enforce IndiaMART-specific 5-minute cooldown (300 seconds) to prevent 429 / crosses limit errors.
      // We check config.last_sync_at (which is the last time we attempted/completed a real API call).
      if (config.last_sync_at) {
        const elapsed = Date.now() - new Date(config.last_sync_at).getTime()
        const minCooldown = 5 * 60 * 1000 // 5 minutes
        if (elapsed < minCooldown) {
          const waitTime = Math.ceil((minCooldown - elapsed) / 1000)
          // Release the lock before throwing, since we acquired it!
          await releaseSyncLock(supabase, accountId, 'INDIAMART', 'FAILED', `Rate limit cooldown: wait ${waitTime}s`)
          throw new Error(`It is advised to hit this API once in every 5 minutes,but it seems that you have crossed this limit. Please try again after ${waitTime} seconds.`)
        }
      }

      let rawLeads: IndiaMartRawEnquiry[] = []

      // If we have a last successful sync or last lead timestamp, we fetch leads from that starting point to now
      const lastSyncTimeStr = syncState ? (syncState.last_successful_sync || syncState.last_lead_timestamp) : null
      if (lastSyncTimeStr) {
        const lastTime = new Date(lastSyncTimeStr)
        const now = new Date()

        // Capped at 7 days due to IndiaMART constraint
        const maxStart = new Date(now)
        maxStart.setDate(maxStart.getDate() - 7)

        const start = lastTime.getTime() < maxStart.getTime() ? maxStart : lastTime

        // Formatting dates in precise numeric format DD-MM-YYYY HH:MM:SS for CRM API
        const format = (date: Date) => {
          const day = String(date.getDate()).padStart(2, '0')
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const year = date.getFullYear()
          const hh = String(date.getHours()).padStart(2, '0')
          const mm = String(date.getMinutes()).padStart(2, '0')
          const ss = String(date.getSeconds()).padStart(2, '0')
          return `${day}-${month}-${year} ${hh}:${mm}:${ss}`
        }

        const startStr = format(start)
        const endStr = format(now)

        console.log(`[indiamart-service] Incremental sync from ${startStr} to ${endStr}`)

        let decryptedKey = ''
        try {
          decryptedKey = decryptSecret(config.api_key) || ''
        } catch {
          decryptedKey = config.api_key || ''
        }
        const isMock = decryptedKey.startsWith('mock') || decryptedKey === 'mock-test'

        if (isMock) {
          rawLeads = [
            {
              UNIQUE_QUERY_ID: `IM-MOCK-INC-STABLE`,
              SENDER_NAME: 'Sanket B (Incremental Mock)',
              SENDER_MOBILE: '+919448480724',
              SENDER_EMAIL: 'sanket.inc@indiamart.com',
              SENDER_COMPANY: 'Antigravity IndiaMART',
              SENDER_CITY: 'Bangalore',
              SENDER_STATE: 'Karnataka',
              SENDER_COUNTRY_ISO: 'IN',
              QUERY_PRODUCT_NAME: 'Incremental SaaS License',
              QUERY_QTY: '1 Unit',
              QUERY_MESSAGE: 'Incremental test enquiry.',
              DATE_RECV_TIME: '2026-06-16 12:00:00'
            }
          ]
        } else {
          const url = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${encodeURIComponent(decryptedKey)}&start_time=${encodeURIComponent(startStr)}&end_time=${encodeURIComponent(endStr)}`

          const res = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          })

          if (res.status === 429) {
            throw new Error('429: Too Many Requests')
          }

          if (!res.ok) {
            throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
          }

          const data = (await res.json()) as IndiaMartApiResponse

          if (data.STATUS === 'FAILURE') {
            throw new Error(data.MESSAGE || 'IndiaMART API returned FAILURE')
          }

          if (data.CODE === '200' && Array.isArray(data.RESPONSE)) {
            rawLeads = data.RESPONSE
          } else if (data.STATUS === 'SUCCESS' && Array.isArray(data.RESPONSE)) {
            rawLeads = data.RESPONSE
          } else if (typeof data.RESPONSE === 'string') {
            console.log(`[indiamart-service] Incremental response: ${data.RESPONSE}`)
          }
        }
      } else {
        // Fallback to latest leads default endpoint
        rawLeads = await this.fetchLeads(config)
      }

      if (rawLeads.length === 0) {
        // Update last sync time anyway
        await supabase
          .from('b2b_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id)

        await supabase
          .from('integration_sync_state')
          .upsert({
            account_id: accountId,
            platform: 'INDIAMART',
            last_sync_at: new Date().toISOString(),
            last_successful_sync: new Date().toISOString(),
            sync_status: 'COMPLETED',
            error_message: null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'account_id,platform'
          })

        await releaseSyncLock(supabase, accountId, 'INDIAMART', 'COMPLETED')
        return { syncedCount: 0, duplicateCount: 0 }
      }

      // 2. Insert raw response log
      await supabase.from('b2b_raw_logs').insert({
        account_id: accountId,
        platform: 'INDIAMART',
        payload_json: rawLeads
      })

      // 3. Normalize and save leads
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

      // 4. Update last sync time
      await supabase
        .from('b2b_integrations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', config.id)

      // Find the highest received_at or DATE_RECV_TIME to update integration_sync_state
      let highestTimestamp: Date | null = null
      for (const raw of rawLeads) {
        if (raw.DATE_RECV_TIME) {
          const t = new Date(raw.DATE_RECV_TIME.replace(' ', 'T'))
          if (!isNaN(t.getTime())) {
            if (!highestTimestamp || t.getTime() > highestTimestamp.getTime()) {
              highestTimestamp = t
            }
          }
        }
      }

      if (highestTimestamp) {
        await supabase
          .from('integration_sync_state')
          .upsert({
            account_id: accountId,
            platform: 'INDIAMART',
            last_sync_at: new Date().toISOString(),
            last_successful_sync: new Date().toISOString(),
            last_lead_timestamp: highestTimestamp.toISOString(),
            sync_status: 'COMPLETED',
            error_message: null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'account_id,platform'
          })
      } else {
        await supabase
          .from('integration_sync_state')
          .upsert({
            account_id: accountId,
            platform: 'INDIAMART',
            last_sync_at: new Date().toISOString(),
            last_successful_sync: new Date().toISOString(),
            sync_status: 'COMPLETED',
            error_message: null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'account_id,platform'
          })
      }

      await releaseSyncLock(supabase, accountId, 'INDIAMART', 'COMPLETED')
      console.log(`[indiamart-service] Sync complete for account ${accountId}. Synced: ${syncedCount}, Duplicates: ${duplicateCount}`)
      return { syncedCount, duplicateCount }
    } catch (error: unknown) {
      console.error('[indiamart-service] Error in syncLeads:', error)
      // Update last_sync_at to prevent immediate retries on failure
      try {
        await supabase
          .from('b2b_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id)
      } catch (dbErr) {
        console.error('[indiamart-service] Failed to update last_sync_at on failure:', dbErr)
      }
      await releaseSyncLock(supabase, accountId, 'INDIAMART', 'FAILED', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  /**
   * Fetches a historical batch (page 1 to 53) from IndiaMART.
   */
  static async fetchHistoricalBatch(
    config: B2BIntegration,
    page: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ leads: IndiaMartRawEnquiry[]; startStr: string; endStr: string; rawResponse?: unknown }> {
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
      // Divide 365 days into 53 batches of 7 days
      const totalDays = 365
      const batchSizeDays = 7
      const P = page // 1 to 53

      const now = new Date()
      start = new Date(now)
      start.setDate(start.getDate() - (totalDays - (P - 1) * batchSizeDays))

      end = new Date(start)
      end.setDate(end.getDate() + batchSizeDays)
      if (end.getTime() > now.getTime()) {
        end.setTime(now.getTime())
      }
    }

    // Format dates as DD-MM-YYYY HH:MM:SS for CRM API
    const format = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hh = String(date.getHours()).padStart(2, '0')
      const mm = String(date.getMinutes()).padStart(2, '0')
      const ss = String(date.getSeconds()).padStart(2, '0')
      return `${day}-${month}-${year} ${hh}:${mm}:${ss}`
    }

    const startStr = format(start)
    const endStr = format(end)

    if (isMock) {
      console.log(`[indiamart-service] Mock historical mode active. Batch ${page}: ${startStr} to ${endStr}`)
      const dummyDate = new Date(start)
      dummyDate.setHours(12, 0, 0)
      const nowStr = `${dummyDate.getFullYear()}-${String(dummyDate.getMonth() + 1).padStart(2, '0')}-${String(dummyDate.getDate()).padStart(2, '0')} 12:00:00`
      return {
        leads: [
          {
            UNIQUE_QUERY_ID: `IM-HIST-${page}-STABLE`,
            SENDER_NAME: `Sanket B (Historical Page ${page})`,
            SENDER_MOBILE: '+919448480724',
            SENDER_EMAIL: `sanket.hist.${page}@indiamart.com`,
            SENDER_COMPANY: 'Antigravity IndiaMART',
            SENDER_CITY: 'Bangalore',
            SENDER_STATE: 'Karnataka',
            SENDER_COUNTRY_ISO: 'IN',
            QUERY_PRODUCT_NAME: `SaaS CRM License (Page ${page})`,
            QUERY_QTY: '5 Units',
            QUERY_MESSAGE: `Hi, this is a historical mock lead from batch ${page} covering date ${startStr}.`,
            DATE_RECV_TIME: nowStr
          }
        ],
        startStr,
        endStr
      }
    }

    const batchUrl = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${encodeURIComponent(decryptedKey)}&start_time=${encodeURIComponent(startStr)}&end_time=${encodeURIComponent(endStr)}`

    try {
      const res = await fetch(batchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-store'
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

      const data = (await res.json()) as IndiaMartApiResponse

      if (data.STATUS === 'FAILURE') {
        const msg = data.MESSAGE || ''
        if (msg.toLowerCase().includes('key') || msg.toLowerCase().includes('authorized') || msg.toLowerCase().includes('authenticate')) {
          throw new Error('Authentication Failed: Invalid API Key')
        }
        throw new Error(msg || 'IndiaMART API returned FAILURE status.')
      }

      let rawLeads: IndiaMartRawEnquiry[] = []
      if (data.CODE === '200' && Array.isArray(data.RESPONSE)) {
        rawLeads = data.RESPONSE
      } else if (data.STATUS === 'SUCCESS' && Array.isArray(data.RESPONSE)) {
        rawLeads = data.RESPONSE
      } else if (typeof data.RESPONSE === 'string') {
        console.log(`[indiamart-service] Historical Batch response: ${data.RESPONSE}`)
      }

      return { leads: rawLeads, startStr, endStr, rawResponse: data }
    } catch (error: unknown) {
      console.error(`[indiamart-service] Error fetching historical batch for page ${page}:`, error)
      if (error instanceof Error && error.message === 'fetch failed') {
        const cause = (error as { cause?: { code?: string; hostname?: string; message?: string } }).cause
        if (cause && cause.code === 'ENOTFOUND') {
          throw new Error(`Could not resolve host ${cause.hostname}. Please check your API URL.`)
        }
        throw new Error(`Network request failed: ${cause?.message || error.message}`)
      }
      throw error
    }
  }
}
