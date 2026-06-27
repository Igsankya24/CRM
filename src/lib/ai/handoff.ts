/**
 * Human Handoff — transfers conversation from AI to human agent (Part 4).
 *
 * When the AI detects a handoff trigger:
 *   1. Disables ai_mode on the conversation
 *   2. Records the handoff reason and timestamp
 *   3. Generates a lead summary
 *   4. Assigns to a sales user (round-robin or specific)
 *   5. Updates crm_leads stage to ASSIGNED
 *   6. Sends WhatsApp notification to the assigned staff
 *
 * All operations use the SERVICE ROLE client to bypass RLS.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { getConversationMemory } from './memory'
import { sendAssignmentNotification } from './assignment-notification'

export interface HandoffInput {
  accountId: string
  conversationId: string
  contactId: string
  contactPhone: string
  contactName: string | null
  reason: string
  /** WhatsApp credentials for sending notification */
  whatsappConfig: {
    phoneNumberId: string
    accessToken: string
  }
}

export interface HandoffResult {
  success: boolean
  assignedToUserId: string | null
  assignedToName: string | null
  error?: string
}

/**
 * Executes the full human handoff flow.
 */
export async function executeHandoff(
  input: HandoffInput
): Promise<HandoffResult> {
  const supabase = getAdminClient()
  const now = new Date().toISOString()

  try {
    // 1. Disable ai_mode on conversation
    const { error: convError } = await supabase
      .from('conversations')
      .update({
        ai_mode: false,
        ai_handoff_reason: input.reason,
        ai_handed_off_at: now,
        updated_at: now,
      })
      .eq('id', input.conversationId)

    if (convError) {
      console.error('[handoff] Failed to disable ai_mode:', convError.message)
      return { success: false, assignedToUserId: null, assignedToName: null, error: convError.message }
    }

    // 2. Update ai_conversation_memory stage
    await supabase
      .from('ai_conversation_memory')
      .update({ stage: 'handed_off' })
      .eq('conversation_id', input.conversationId)

    // 3. Build lead summary from conversation memory
    const convMemory = await getConversationMemory(input.conversationId)
    const summaryParts: string[] = []

    if (input.contactName) summaryParts.push(`Buyer: ${input.contactName}`)
    if (convMemory?.customer_interest) summaryParts.push(`Interest: ${convMemory.customer_interest}`)
    if (convMemory?.product) summaryParts.push(`Product: ${convMemory.product}`)
    if (convMemory?.budget) summaryParts.push(`Budget: ${convMemory.budget}`)
    if (convMemory?.quantity) summaryParts.push(`Quantity: ${convMemory.quantity}`)
    if (convMemory?.urgency) summaryParts.push(`Urgency: ${convMemory.urgency}`)
    if (convMemory?.location) summaryParts.push(`Location: ${convMemory.location}`)
    if (convMemory?.need_date) summaryParts.push(`Need Date: ${convMemory.need_date}`)
    if (convMemory?.summary) summaryParts.push(`Summary: ${convMemory.summary}`)
    summaryParts.push(`Handoff Reason: ${input.reason}`)
    summaryParts.push(`Messages: ${convMemory?.message_count ?? 0}`)

    const aiSummary = summaryParts.join('\n')

    // 4. Find the linked crm_lead
    const { data: crmLead } = await supabase
      .from('crm_leads')
      .select('id, product_name, source, ai_score')
      .eq('account_id', input.accountId)
      .eq('conversation_id', input.conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 5. Assign to a sales user via round-robin
    const assignedTo = await assignToStaffRoundRobin(input.accountId, supabase)

    if (!assignedTo) {
      console.warn('[handoff] No staff available for assignment')
    }

    // 6. Update crm_lead with assignment and summary
    if (crmLead) {
      const leadUpdate: Record<string, unknown> = {
        ai_summary: aiSummary,
        ai_engagement_status: 'HANDED_OFF',
        stage: 'ASSIGNED',
      }
      if (assignedTo) {
        leadUpdate.assigned_to = assignedTo.id
        leadUpdate.assigned_at = now
      }

      await supabase
        .from('crm_leads')
        .update(leadUpdate)
        .eq('id', crmLead.id)
    }

    // 7. Update conversation with assigned agent
    if (assignedTo) {
      await supabase
        .from('conversations')
        .update({ assigned_agent_id: assignedTo.userId })
        .eq('id', input.conversationId)
    }

    // 8. Send WhatsApp notification to assigned staff
    if (assignedTo && input.whatsappConfig.phoneNumberId) {
      try {
        await sendAssignmentNotification({
          staffPhone: assignedTo.phone,
          staffName: assignedTo.name,
          buyerName: input.contactName ?? 'Unknown',
          buyerPhone: input.contactPhone,
          companyName: convMemory?.extracted_facts?.company ?? null,
          product: convMemory?.product ?? crmLead?.product_name ?? null,
          quantity: convMemory?.quantity ?? null,
          source: crmLead?.source ?? 'WhatsApp',
          priority: crmLead?.ai_score ?? 'WARM',
          conversationId: input.conversationId,
          whatsappConfig: input.whatsappConfig,
        })
      } catch (notifErr) {
        console.error('[handoff] Notification send failed:', notifErr)
        // Don't fail the handoff — notification is best-effort
      }
    }

    return {
      success: true,
      assignedToUserId: assignedTo?.userId ?? null,
      assignedToName: assignedTo?.name ?? null,
    }
  } catch (error) {
    console.error('[handoff] Unexpected error:', error)
    return {
      success: false,
      assignedToUserId: null,
      assignedToName: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Round-robin assignment to staff members.
 * Returns the assigned staff member's details.
 */
async function assignToStaffRoundRobin(
  accountId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ id: string; userId: string; name: string; phone: string | null } | null> {
  try {
    // Fetch eligible staff (owner, admin, agent roles)
    const { data: members, error: membersError } = await supabase
      .from('account_members')
      .select('user_id, role')
      .eq('account_id', accountId)
      .in('role', ['owner', 'admin', 'agent'])

    if (membersError || !members || members.length === 0) {
      console.error('[handoff] No staff members found:', membersError?.message)
      return null
    }

    // Get profiles for these users
    const userIds = members.map((m: { user_id: string }) => m.user_id)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email')
      .in('user_id', userIds)
      .order('id', { ascending: true })

    if (profileError || !profiles || profiles.length === 0) {
      return null
    }

    // Find last assigned lead to determine next in round-robin
    const { data: lastAssigned } = await supabase
      .from('crm_leads')
      .select('assigned_to')
      .eq('account_id', accountId)
      .not('assigned_to', 'is', null)
      .order('assigned_at', { ascending: false })
      .limit(1)

    let nextIndex = 0
    if (lastAssigned && lastAssigned.length > 0 && lastAssigned[0].assigned_to) {
      const lastIdx = profiles.findIndex(
        (p: { id: string }) => p.id === lastAssigned[0].assigned_to
      )
      if (lastIdx !== -1) {
        nextIndex = (lastIdx + 1) % profiles.length
      }
    }

    const assigned = profiles[nextIndex]

    // Try to get phone from notification_recipients
    const { data: notifRecipient } = await supabase
      .from('notification_recipients')
      .select('mobile')
      .eq('account_id', accountId)
      .eq('name', assigned.full_name)
      .eq('enabled', true)
      .limit(1)
      .maybeSingle()

    return {
      id: assigned.id,
      userId: assigned.user_id,
      name: assigned.full_name,
      phone: notifRecipient?.mobile ?? null,
    }
  } catch (err) {
    console.error('[handoff] Round-robin assignment failed:', err)
    return null
  }
}
