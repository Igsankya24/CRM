// ============================================================
// CRM Kanban API
// GET /api/crm/kanban — Get pipeline data for Kanban board
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CRM_STAGES, CrmStage } from '@/types/crm';

export async function GET(request: NextRequest) {
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

  // Get all active leads grouped by stage
  const { data: leads, error } = await supabase
    .from('crm_leads')
    .select('*, assigned_user:profiles!crm_leads_assigned_to_fkey(id, full_name, avatar_url)')
    .eq('account_id', profile.account_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by stage
  const stages: Record<string, { leads: typeof leads; count: number; value: number; hot: number; overdue: number }> = {};
  const now = new Date();

  for (const stage of CRM_STAGES) {
    stages[stage] = { leads: [], count: 0, value: 0, hot: 0, overdue: 0 };
  }

  for (const lead of leads || []) {
    const stage = lead.stage as CrmStage;
    if (stages[stage]) {
      stages[stage].leads.push(lead);
      stages[stage].count++;
      stages[stage].value += Number(lead.expected_value) || 0;
      if (lead.lead_category === 'HOT') stages[stage].hot++;
      if (lead.next_followup_at && new Date(lead.next_followup_at) < now) {
        stages[stage].overdue++;
      }
    }
  }

  // Get overview stats
  const { data: overview } = await supabase.rpc('get_crm_overview', {
    p_account_id: profile.account_id,
  });

  return NextResponse.json({ stages, overview: overview?.[0] || null });
}
