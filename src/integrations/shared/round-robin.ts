import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Automatically assigns a B2B Lead to a staff member in the account using a Round Robin algorithm.
 *
 * @param accountId - The account ID the lead belongs to
 * @param leadId - The lead ID to assign
 * @param supabase - The Supabase client (can be standard or admin)
 * @returns The assigned staff member profile ID or null if no agents are available
 */
export async function assignLeadRoundRobin(
  accountId: string,
  leadId: string,
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    // 1. Fetch all eligible staff in this account (owner, admin, agent)
    // We order by id stably so the list order is deterministic
    const { data: staff, error: staffError } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', accountId)
      .in('account_role', ['owner', 'admin', 'agent'])
      .order('id', { ascending: true })

    if (staffError) {
      console.error('[round-robin] Error fetching assignable staff:', staffError)
      return null
    }

    if (!staff || staff.length === 0) {
      console.log(`[round-robin] No eligible staff found for account ${accountId}`)
      return null
    }

    // 2. Fetch the most recently assigned lead in this account to see who was assigned last
    const { data: lastLeads, error: lastLeadError } = await supabase
      .from('b2b_leads')
      .select('assigned_to')
      .eq('account_id', accountId)
      .not('assigned_to', 'is', null) // only leads that are assigned
      .order('created_at', { ascending: false })
      .limit(1)

    if (lastLeadError) {
      console.error('[round-robin] Error fetching last assigned lead:', lastLeadError)
    }

    let nextIndex = 0
    if (lastLeads && lastLeads.length > 0 && lastLeads[0].assigned_to) {
      const lastAssignedId = lastLeads[0].assigned_to
      const lastIndex = staff.findIndex((s) => s.id === lastAssignedId)
      if (lastIndex !== -1) {
        nextIndex = (lastIndex + 1) % staff.length
      }
    }

    const assignedStaffId = staff[nextIndex].id

    // 3. Update the lead with the assigned staff member
    const { error: updateError } = await supabase
      .from('b2b_leads')
      .update({ assigned_to: assignedStaffId, status: 'assigned' })
      .eq('id', leadId)

    if (updateError) {
      console.error('[round-robin] Error updating lead assignment:', updateError)
      return null
    }

    // 4. Log the assignment in the lead_assignments history table
    const { error: historyError } = await supabase
      .from('lead_assignments')
      .insert({
        account_id: accountId,
        lead_id: leadId,
        staff_id: assignedStaffId,
        assigned_at: new Date().toISOString()
      })

    if (historyError) {
      console.error('[round-robin] Error inserting lead assignment history:', historyError)
    }

    console.log(`[round-robin] Lead ${leadId} successfully assigned to staff ${assignedStaffId}`)
    return assignedStaffId
  } catch (error) {
    console.error('[round-robin] Unexpected error in round-robin assignment:', error)
    return null
  }
}
