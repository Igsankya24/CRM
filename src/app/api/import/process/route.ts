import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processImportInBackground } from '@/lib/import-processor';

export async function POST(request: NextRequest) {
  // 1. Authenticate user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get profile and account_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 });
  }

  const accountId = profile.account_id;

  // 3. Parse request body
  let body: {
    module: string;
    rows: any[];
    duplicateStrategy: 'skip' | 'update' | 'merge' | 'create';
    mapping: Record<string, string>;
    filename?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { module, rows, duplicateStrategy, mapping, filename } = body;
  if (!module || !rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'Module and rows are required' }, { status: 400 });
  }

  // 4. Save the mapping for future use (in background thread or right now)
  await supabase
    .from('import_mappings')
    .upsert({
      account_id: accountId,
      module,
      mapping,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id,module' });

  // 5. Create background job in bulk_jobs
  const { data: job, error: jobErr } = await supabase
    .from('bulk_jobs')
    .insert({
      account_id: accountId,
      user_id: user.id,
      job_type: 'import',
      module,
      status: 'queued',
      progress: 0,
      total_rows: rows.length,
      processed_rows: 0,
      failed_rows: 0,
      metadata: { duplicateStrategy, filename: filename || 'import.xlsx' },
    })
    .select()
    .single();

  if (jobErr || !job) {
    console.error('[import/process] Failed to create job:', jobErr);
    return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 });
  }

  // Start background processing loop asynchronously
  // We do not await this, so the API responds instantly with the jobId!
  processImportInBackground(job.id, accountId, user.id, module, rows, duplicateStrategy, mapping)
    .catch((err) => console.error('[import] Background job execution error:', err));

  return NextResponse.json({ jobId: job.id });
}
