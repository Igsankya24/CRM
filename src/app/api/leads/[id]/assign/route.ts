/**
 * POST /api/leads/[id]/assign
 *
 * Assigns a B2B lead to a staff member.
 * Uses the existing `assign_lead_to_staff()` DB function which:
 *   1. Updates b2b_leads.assigned_to + sets status='assigned'
 *   2. Appends a row to lead_assignments for history tracking
 *
 * Agent+ role required (enforced by RLS on b2b_leads_modify policy).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { staff_id } = body

  if (!staff_id) {
    return NextResponse.json(
      { error: 'staff_id is required' },
      { status: 400 }
    )
  }

  // Verify the lead belongs to this account and is not deleted
  const { data: lead, error: leadError } = await supabase
    .from('b2b_leads')
    .select('id, account_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // Verify the staff member belongs to the same account
  const { data: staffProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, account_id')
    .eq('id', staff_id)
    .eq('account_id', lead.account_id)
    .single()

  if (profileError || !staffProfile) {
    return NextResponse.json(
      { error: 'Staff member not found in this account' },
      { status: 404 }
    )
  }

  // Call the DB function — atomically updates lead + inserts assignment history
  const { error: assignError } = await supabase.rpc('assign_lead_to_staff', {
    p_account_id: lead.account_id,
    p_lead_id: id,
    p_staff_id: staff_id,
  })

  if (assignError) {
    console.error('[/api/leads/[id]/assign] Assignment failed:', assignError)
    return NextResponse.json({ error: assignError.message }, { status: 500 })
  }

  // Audit log
  await supabase.rpc('log_audit_action', {
    p_module: 'leads',
    p_action: 'assign',
    p_old_value: null,
    p_new_value: { lead_id: id, staff_id, staff_name: staffProfile.full_name },
  })

  return NextResponse.json({
    success: true,
    message: `Lead assigned to ${staffProfile.full_name}`,
  })
}
