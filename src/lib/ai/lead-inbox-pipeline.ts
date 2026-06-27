/**
 * Lead-to-Inbox Pipeline — auto-creates inbox conversation for new leads (Parts 1, 2).
 *
 * When a new lead arrives from any source (IndiaMART, TradeIndia,
 * ExportersIndia, Website, WhatsApp):
 *
 *   1. Find or create contact (using lead phone/name)
 *   2. Find or create conversation
 *   3. Create crm_leads record linked to conversation + contact
 *   4. Create ai_conversation_memory record
 *   5. Enable ai_mode on conversation
 *   6. Optionally send initial WhatsApp greeting
 *
 * This pipeline ensures every lead appears immediately in the inbox
 * and the AI agent can take over the conversation.
 *
 * All operations use the SERVICE ROLE client to bypass RLS.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'
import { decrypt } from '@/lib/whatsapp/encryption'

// ─── Types ──────────────────────────────────────────────────────────────

export interface LeadIngestInput {
  accountId: string
  /** Source platform */
  source: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'WEBSITE' | 'WHATSAPP' | 'MANUAL' | 'REFERRAL'
  /** Lead identity */
  buyerName: string | null
  companyName: string | null
  phone: string
  email: string | null
  /** Location */
  city: string | null
  state: string | null
  country: string | null
  /** Product interest */
  productName: string | null
  quantity: string | null
  message: string | null
  /** Optional B2B lead reference */
  b2bLeadId?: string
  /** Whether to send initial WhatsApp greeting */
  sendGreeting?: boolean
}

export interface LeadIngestResult {
  success: boolean
  contactId: string | null
  conversationId: string | null
  crmLeadId: string | null
  error?: string
}

// ─── Pipeline ───────────────────────────────────────────────────────────

/**
 * Executes the full lead-to-inbox pipeline.
 */
export async function ingestLeadToInbox(
  input: LeadIngestInput
): Promise<LeadIngestResult> {
  const supabase = getAdminClient()
  const phone = normalizePhone(input.phone)

  if (!phone) {
    return { success: false, contactId: null, conversationId: null, crmLeadId: null, error: 'Invalid phone number' }
  }

  try {
    // 1. Get the config owner (for attribution FKs)
    const { data: account } = await supabase
      .from('accounts')
      .select('owner_user_id')
      .eq('id', input.accountId)
      .single()

    if (!account) {
      return { success: false, contactId: null, conversationId: null, crmLeadId: null, error: 'Account not found' }
    }

    const ownerUserId = account.owner_user_id

    // 2. Find or create contact
    const { data: existingContactData } = await supabase
      .from('contacts')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('phone', phone)
      .limit(1)
      .maybeSingle()

    let contact = existingContactData as { id: string; name: string | null; email: string | null; company: string | null; phone: string } | null
    let contactCreated = false

    if (!contact) {
      const { data: newContact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          account_id: input.accountId,
          user_id: ownerUserId,
          phone,
          name: input.buyerName || phone,
          email: input.email,
          company: input.companyName,
        })
        .select()
        .single()

      if (contactErr) {
        console.error('[lead-pipeline] Failed to create contact:', contactErr.message)
        // Try to find if it was a race condition
        const { data: retryContact } = await supabase
          .from('contacts')
          .select('*')
          .eq('account_id', input.accountId)
          .eq('phone', phone)
          .limit(1)
          .maybeSingle()
        contact = retryContact
        if (!contact) {
          return { success: false, contactId: null, conversationId: null, crmLeadId: null, error: contactErr.message }
        }
      } else {
        contact = newContact
        contactCreated = true
      }
    } else {
      // Update contact info if we have more data
      const updates: Record<string, unknown> = {}
      if (input.buyerName && !contact.name) updates.name = input.buyerName
      if (input.email && !contact.email) updates.email = input.email
      if (input.companyName && !contact.company) updates.company = input.companyName

      if (Object.keys(updates).length > 0) {
        await supabase.from('contacts').update(updates).eq('id', contact.id)
      }
    }

    if (!contact) {
      return { success: false, contactId: null, conversationId: null, crmLeadId: null, error: 'Contact not found or created' }
    }

    // 3. Find or create conversation
    let conversation: { id: string; ai_mode: boolean } | null = null

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, ai_mode')
      .eq('account_id', input.accountId)
      .eq('contact_id', contact.id)
      .maybeSingle()

    if (existingConv) {
      conversation = existingConv

      // If conversation exists but AI mode is off, enable it for the new lead
      if (!existingConv.ai_mode) {
        await supabase
          .from('conversations')
          .update({
            ai_mode: true,
            status: 'open',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingConv.id)
      }
    } else {
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          account_id: input.accountId,
          user_id: ownerUserId,
          contact_id: contact.id,
          status: 'open',
          ai_mode: true,
          last_message_text: input.message || `New ${input.source} lead`,
          last_message_at: new Date().toISOString(),
          unread_count: 1,
        })
        .select('id, ai_mode')
        .single()

      if (convErr) {
        console.error('[lead-pipeline] Failed to create conversation:', convErr.message)
        return { success: false, contactId: contact.id, conversationId: null, crmLeadId: null, error: convErr.message }
      }
      conversation = newConv
    }

    // 4. Create crm_leads record (if not already linked)
    let crmLeadId: string | null = null

    const { data: existingLead } = await supabase
      .from('crm_leads')
      .select('id')
      .eq('account_id', input.accountId)
      .eq('conversation_id', conversation.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!existingLead) {
      const { data: newLead, error: leadErr } = await supabase
        .from('crm_leads')
        .insert({
          account_id: input.accountId,
          b2b_lead_id: input.b2bLeadId || null,
          contact_id: contact.id,
          conversation_id: conversation.id,
          buyer_name: input.buyerName,
          company_name: input.companyName,
          phone,
          email: input.email,
          city: input.city,
          state: input.state,
          country: input.country,
          source: input.source,
          stage: 'Customer',
          product_name: input.productName,
          quantity: input.quantity,
          ai_engagement_status: 'NOT_STARTED',
          inquiry_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (leadErr) {
        console.error('[lead-pipeline] Failed to create crm_lead:', leadErr.message)
      } else {
        crmLeadId = newLead.id
      }
    } else {
      crmLeadId = existingLead.id
    }

    // 5. Create ai_conversation_memory
    await supabase
      .from('ai_conversation_memory')
      .upsert(
        {
          account_id: input.accountId,
          conversation_id: conversation.id,
          stage: 'greeting',
          product: input.productName,
          quantity: input.quantity,
          location: [input.city, input.state].filter(Boolean).join(', ') || null,
          customer_message_count: 0,
          ai_message_count: 0,
          message_count: 0,
          extracted_facts: {
            ...(input.companyName ? { company: input.companyName } : {}),
            ...(input.productName ? { product_interest: input.productName } : {}),
          },
        },
        { onConflict: 'conversation_id' }
      )

    // 6. Update crm_lead AI engagement status
    if (crmLeadId) {
      await supabase
        .from('crm_leads')
        .update({ ai_engagement_status: 'IN_PROGRESS', stage: 'AI_ENGAGED' })
        .eq('id', crmLeadId)
    }

    // 7. Send initial WhatsApp greeting (optional)
    if (input.sendGreeting) {
      try {
        await sendInitialGreeting(input.accountId, phone, input.buyerName, conversation.id, supabase)
      } catch (greetErr) {
        console.error('[lead-pipeline] Greeting failed (non-fatal):', greetErr)
      }
    }

    console.log(
      `[lead-pipeline] Lead ingested: contact=${contact.id} conversation=${conversation.id} crm_lead=${crmLeadId} source=${input.source}`
    )

    return {
      success: true,
      contactId: contact.id,
      conversationId: conversation.id,
      crmLeadId,
    }
  } catch (error) {
    console.error('[lead-pipeline] Unexpected error:', error)
    return {
      success: false,
      contactId: null,
      conversationId: null,
      crmLeadId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Sends an initial WhatsApp greeting to a new lead.
 */
async function sendInitialGreeting(
  accountId: string,
  phone: string,
  buyerName: string | null,
  conversationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<void> {
  // Get WhatsApp config
  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token, ai_enabled')
    .eq('account_id', accountId)
    .eq('status', 'connected')
    .maybeSingle()

  if (!config || !config.phone_number_id || !config.access_token) {
    console.warn('[lead-pipeline] No WhatsApp config found for greeting')
    return
  }

  const accessToken = decrypt(config.access_token)

  // Get company name for the greeting
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('company_name')
    .eq('account_id', accountId)
    .maybeSingle()

  const companyName = companySettings?.company_name || 'our company'
  const name = buyerName || 'there'

  const greeting = `Hello ${name}! 👋\n\nThank you for your interest. Welcome to *${companyName}*!\n\nI'm your AI assistant and I'll help you with product information, pricing, and availability.\n\nHow can I help you today?`

  await sendWhatsAppMessage(phone, greeting, config.phone_number_id, accessToken)

  // Store greeting as a bot message
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'bot',
    content_type: 'text',
    content_text: greeting,
    status: 'sent',
  })

  // Update conversation
  await supabase
    .from('conversations')
    .update({
      last_message_text: greeting,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    })
    .eq('id', conversationId)
}
