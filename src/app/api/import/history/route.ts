import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/import/history
 *
 * Query params:
 *   - module: string (optional) - filters by module
 *   - historyId: UUID (optional) - if provided, fetches logs for specific import_history record
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const module = searchParams.get('module');
  const historyId = searchParams.get('historyId');

  // Fetch logs for a specific history record
  if (historyId) {
    const { data: logs, error } = await supabase
      .from('import_logs')
      .select('*')
      .eq('import_id', historyId)
      .order('row_index', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ logs: logs || [] });
  }

  // Fetch all import/export history
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 });
  }

  const query = supabase
    .from('import_history')
    .select(`
      *,
      creator:profiles!inner(full_name)
    `)
    .eq('account_id', profile.account_id)
    .order('created_at', { ascending: false });

  if (module) {
    query.eq('module', module);
  }

  const { data: imports, error: importsErr } = await query;
  if (importsErr) return NextResponse.json({ error: importsErr.message }, { status: 500 });

  const { data: exports } = await supabase
    .from('export_history')
    .select(`
      *,
      creator:profiles!inner(full_name)
    `)
    .eq('account_id', profile.account_id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    imports: imports || [],
    exports: exports || [],
  });
}

/**
 * DELETE /api/import/history
 *
 * Query params:
 *   - historyId: UUID - deletes specific import history and its logs
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const historyId = searchParams.get('historyId');

  if (!historyId) {
    return NextResponse.json({ error: 'historyId parameter is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('import_history')
    .delete()
    .eq('id', historyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * POST /api/import/history
 *
 * Log an export action
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    module: string;
    exportType: string;
    filtersUsed?: any;
    rowsExported: number;
    filename: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { module, exportType, filtersUsed, rowsExported, filename } = body;
  if (!module || !exportType || !filename) {
    return NextResponse.json({ error: 'module, exportType and filename are required' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 });
  }

  const { error } = await supabase
    .from('export_history')
    .insert({
      account_id: profile.account_id,
      user_id: user.id,
      module,
      export_type: exportType,
      filters_used: filtersUsed || {},
      rows_exported: rowsExported,
      filename,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
