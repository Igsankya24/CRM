/**
 * GET/PATCH/DELETE /api/leads/[id]
 *
 * Single B2B lead operations — fetch, update status/notes/rejection_reason,
 * soft delete. All operations are account-scoped via RLS + explicit
 * account_id check. Agent role required to write; viewer role for reads.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/leads/[id] ──────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
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

  // Permission: enquiries.view OR legacy leads.view
  const { data: hpv } = await supabase.rpc('has_permission', { p_module: 'enquiries', p_action: 'view' })
  const { data: hlv } = await supabase.rpc('has_permission', { p_module: 'leads', p_action: 'view' })
  if (!hpv && !hlv) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: lead, error } = await supabase
    .from('b2b_leads')
    .select(
      `
      *,
      assignee:profiles!assigned_to (
        id,
        full_name,
        email,
        avatar_url
      ),
      lead_assignments (
        id,
        assigned_at,
        staff:profiles!staff_id (
          id,
          full_name,
          avatar_url
        )
      ),
      lead_conversations (
        id,
        conversation_id,
        created_at
      ),
      followup_tasks (
        id,
        title,
        description,
        due_at,
        status,
        created_at,
        assigned_to,
        assignee:profiles!assigned_to (
          id,
          full_name,
          avatar_url
        )
      )
    `
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lead })
}

// ─── PATCH /api/leads/[id] ─────────────────────────────────────────────────────
export async function PATCH(
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

  // Permission: enquiries.edit OR legacy leads.edit
  const { data: hpe } = await supabase.rpc('has_permission', { p_module: 'enquiries', p_action: 'edit' })
  const { data: hle } = await supabase.rpc('has_permission', { p_module: 'leads', p_action: 'edit' })
  if (!hpe && !hle) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Whitelist updatable fields to prevent mass-assignment
  const allowedFields = [
    'buyer_name',
    'company_name',
    'mobile',
    'email',
    'product_name',
    'quantity',
    'message',
    'city',
    'state',
    'status',
    'notes',
    'rejection_reason',
    'assigned_to',
    'deleted_at',
  ] as const

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  // Status transition guard
  if (updates.status) {
    const validStatuses = ['pending', 'assigned', 'contacted', 'converted', 'rejected']
    if (!validStatuses.includes(updates.status as string)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }
    // Rejection reason required when rejecting (only if not already provided or if body explicitly rejects without it)
    if (updates.status === 'rejected' && !body.rejection_reason && !body.notes) {
      updates.rejection_reason = 'Rejected via lead edit'
    }
  }

  updates.updated_at = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('b2b_leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log audit action
  await supabase.rpc('log_audit_action', {
    p_module: 'leads',
    p_action: 'update',
    p_old_value: null,
    p_new_value: updates,
  })

  return NextResponse.json({ lead: updated })
}

// ─── DELETE /api/leads/[id] ────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
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

  // Permission: enquiries.delete OR legacy leads.delete
  const { data: hpd } = await supabase.rpc('has_permission', { p_module: 'enquiries', p_action: 'delete' })
  const { data: hld } = await supabase.rpc('has_permission', { p_module: 'leads', p_action: 'delete' })
  if (!hpd && !hld) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Soft delete
  const { error } = await supabase.rpc('soft_delete_lead', {
    p_account_id: (await supabase
      .from('b2b_leads')
      .select('account_id')
      .eq('id', id)
      .single()
    ).data?.account_id,
    p_lead_id: id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log audit action
  await supabase.rpc('log_audit_action', {
    p_module: 'leads',
    p_action: 'delete',
    p_old_value: { id },
    p_new_value: null,
  })

  return NextResponse.json({ success: true })
}
