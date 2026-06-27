// ============================================================
// CRM Lead Activities API
// GET  /api/crm/leads/[id]/activities — Get activity timeline
// POST /api/crm/leads/[id]/activities — Add activity
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createActivity } from '@/lib/crm/crm-lifecycle';
import { CreateActivityRequest } from '@/types/crm';

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

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const type = searchParams.get('type');

  let query = supabase
    .from('crm_activities')
    .select('*, performer:profiles!crm_activities_performed_by_fkey(id, full_name, avatar_url)', { count: 'exact' })
    .eq('crm_lead_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq('activity_type', type);

  const { data: activities, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ activities, total: count });
}

export async function POST(
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
    .select('id, account_id')
    .eq('user_id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const body: CreateActivityRequest = await request.json();

  if (!body.activity_type || !body.title) {
    return NextResponse.json({ error: 'activity_type and title are required' }, { status: 400 });
  }

  const { activity, error } = await createActivity(supabase, profile.account_id, {
    crm_lead_id: id,
    activity_type: body.activity_type,
    title: body.title,
    description: body.description,
    metadata: body.metadata,
    performed_by: profile.id,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ activity }, { status: 201 });
}
