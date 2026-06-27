import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/import/jobs
 *
 * Query params:
 *   - jobId: UUID (optional) - if provided, returns specific job status + logs
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (jobId) {
    // 1. Fetch specific job status
    const { data: job, error: jobErr } = await supabase
      .from('bulk_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // 2. Fetch any error logs for this job
    const { data: logs } = await supabase
      .from('import_logs')
      .select('*')
      .eq('import_id', jobId)
      .order('row_index', { ascending: true });

    return NextResponse.json({ job, logs: logs || [] });
  }

  // Fetch all jobs for current account
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 });
  }

  const { data: jobs } = await supabase
    .from('bulk_jobs')
    .select('*')
    .eq('account_id', profile.account_id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ jobs: jobs || [] });
}

/**
 * POST /api/import/jobs
 *
 * Body params:
 *   - jobId: UUID
 *   - action: 'cancel' | 'delete'
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { jobId: string; action: 'cancel' | 'delete' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { jobId, action } = body;
  if (!jobId || !action) {
    return NextResponse.json({ error: 'jobId and action are required' }, { status: 400 });
  }

  if (action === 'cancel') {
    const { error } = await supabase
      .from('bulk_jobs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Job cancelled successfully.' });
  }

  if (action === 'delete') {
    const { error } = await supabase
      .from('bulk_jobs')
      .delete()
      .eq('id', jobId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
