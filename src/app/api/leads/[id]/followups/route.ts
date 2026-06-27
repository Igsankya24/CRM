/**
 * GET  /api/leads/[id]/followups — list follow-up tasks for a lead
 * POST /api/leads/[id]/followups — create a new follow-up task
 * PATCH /api/leads/[id]/followups/[taskId] is handled per-task elsewhere;
 *   task-level updates (complete, cancel) are done via the b2b_leads detail page
 *   directly using the Supabase client with RLS.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/leads/[id]/followups ────────────────────────────────────────────
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

  const { data: tasks, error } = await supabase
    .from('followup_tasks')
    .select(
      `
      id,
      title,
      description,
      due_at,
      status,
      created_at,
      updated_at,
      assigned_to,
      assignee:profiles!assigned_to (
        id,
        full_name,
        avatar_url
      )
    `
    )
    .eq('lead_id', id)
    .order('due_at', { ascending: true, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tasks: tasks ?? [] })
}

// ─── POST /api/leads/[id]/followups ───────────────────────────────────────────
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
  const { title, description, due_at, assigned_to } = body

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json(
      { error: 'title is required' },
      { status: 400 }
    )
  }

  // Verify lead exists and belongs to user's account (RLS enforces this too)
  const { data: lead, error: leadError } = await supabase
    .from('b2b_leads')
    .select('id, account_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const { data: task, error } = await supabase
    .from('followup_tasks')
    .insert({
      account_id: lead.account_id,
      lead_id: id,
      title: title.trim(),
      description: description?.trim() || null,
      due_at: due_at || null,
      assigned_to: assigned_to || null,
      status: 'pending',
    })
    .select(
      `
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
    `
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task }, { status: 201 })
}
