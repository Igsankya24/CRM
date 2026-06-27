import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enrichEnquiriesWithAI } from '@/lib/import-processor';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { leadIds: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { leadIds } = body;
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'leadIds array is required and must not be empty' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 });
  }

  // Trigger AI enrichment in the background
  enrichEnquiriesWithAI(profile.account_id, leadIds)
    .catch((err) => console.error('[AI/enrich] Enrichment background thread error:', err));

  return NextResponse.json({ success: true, message: 'AI lead enrichment triggered in background.' });
}
