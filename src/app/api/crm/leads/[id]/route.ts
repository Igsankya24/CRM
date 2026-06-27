// ============================================================
// CRM Lead Detail API
// GET    /api/crm/leads/[id]  — Get lead with all related data
// PATCH  /api/crm/leads/[id]  — Update lead fields
// DELETE /api/crm/leads/[id]  — Soft delete lead
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Get lead with assigned user info
  const { data: lead, error } = await supabase
    .from('crm_leads')
    .select('*, assigned_user:profiles!crm_leads_assigned_to_fkey(id, full_name, avatar_url)')
    .eq('id', id)
    .eq('account_id', profile.account_id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Get related data in parallel
  const [requirements, quotations, orders, payments, activities, history] = await Promise.all([
    supabase.from('crm_requirements').select('*').eq('crm_lead_id', id).limit(1).maybeSingle(),
    supabase.from('crm_quotations').select('*').eq('crm_lead_id', id).order('created_at', { ascending: false }),
    supabase.from('crm_orders').select('*').eq('crm_lead_id', id).order('created_at', { ascending: false }),
    supabase.from('crm_payments').select('*').eq('crm_lead_id', id).order('created_at', { ascending: false }),
    supabase.from('crm_activities').select('*, performer:profiles!crm_activities_performed_by_fkey(id, full_name, avatar_url)')
      .eq('crm_lead_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('crm_lead_history').select('*').eq('crm_lead_id', id).order('created_at', { ascending: false }).limit(50),
  ]);

  return NextResponse.json({
    lead,
    requirements: requirements.data,
    quotations: quotations.data || [],
    orders: orders.data || [],
    payments: payments.data || [],
    activities: activities.data || [],
    history: history.data || [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const body = await request.json();

  // Only allow updating certain fields directly
  const allowedFields = [
    'buyer_name', 'company_name', 'phone', 'email',
    'city', 'state', 'country', 'product_name', 'quantity',
    'expected_value', 'currency', 'lead_category', 'urgency',
    'ai_summary', 'next_followup_at', 'last_contacted_at',
    'close_reason', 'customer_category', 'assigned_to',
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  if (body.assigned_to && !updateData.assigned_at) {
    updateData.assigned_at = new Date().toISOString();
  }

  const { data: lead, error } = await supabase
    .from('crm_leads')
    .update(updateData)
    .eq('id', id)
    .eq('account_id', profile.account_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ lead });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Soft delete — never truly delete
  const { error } = await supabase
    .from('crm_leads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', profile.account_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
