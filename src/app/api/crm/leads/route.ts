// ============================================================
// CRM Leads API — CRUD + Kanban data
// GET  /api/crm/leads         — List/filter leads
// POST /api/crm/leads         — Create a new CRM lead
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCrmLead, calculateLeadScore, detectSpam } from '@/lib/crm/crm-lifecycle';
import { CreateCrmLeadRequest } from '@/types/crm';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get account
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get('stage');
  const category = searchParams.get('category');
  const source = searchParams.get('source');
  const assigned_to = searchParams.get('assigned_to');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('crm_leads')
    .select('*, assigned_user:profiles!crm_leads_assigned_to_fkey(id, full_name, avatar_url)', { count: 'exact' })
    .eq('account_id', profile.account_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (stage) query = query.eq('stage', stage);
  if (category) query = query.eq('lead_category', category);
  if (source) query = query.eq('source', source);
  if (assigned_to) query = query.eq('assigned_to', assigned_to);
  if (search) {
    query = query.or(
      `buyer_name.ilike.%${search}%,company_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,product_name.ilike.%${search}%`,
    );
  }

  const { data: leads, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads, total: count });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, account_id')
    .eq('user_id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const body: CreateCrmLeadRequest = await request.json();

  if (!body.source) {
    return NextResponse.json({ error: 'source is required' }, { status: 400 });
  }

  const { lead, error } = await createCrmLead(
    supabase,
    profile.account_id,
    body,
    profile.id,
  );

  if (error) return NextResponse.json({ error }, { status: 500 });
  if (!lead) return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });

  // Calculate score and update
  const { score, category, urgency } = calculateLeadScore(lead);
  const isSpam = detectSpam(lead);

  await supabase
    .from('crm_leads')
    .update({
      lead_score: score,
      lead_category: category,
      urgency,
      is_spam: isSpam,
    })
    .eq('id', lead.id);

  return NextResponse.json({
    lead: { ...lead, lead_score: score, lead_category: category, urgency, is_spam: isSpam },
  }, { status: 201 });
}
