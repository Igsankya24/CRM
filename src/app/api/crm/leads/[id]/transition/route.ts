// ============================================================
// CRM Lead Stage Transition API
// POST /api/crm/leads/[id]/transition
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transitionStage } from '@/lib/crm/crm-lifecycle';
import { TransitionStageRequest, CrmStage } from '@/types/crm';

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

  const body: TransitionStageRequest = await request.json();

  if (!body.to_stage) {
    return NextResponse.json({ error: 'to_stage is required' }, { status: 400 });
  }

  const { success, error } = await transitionStage(
    supabase,
    profile.account_id,
    id,
    body.to_stage as CrmStage,
    profile.id,
    body.reason,
  );

  if (!success) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
