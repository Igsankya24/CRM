import { NextRequest, NextResponse } from 'next/server';
import { generateTemplateExcel } from '@/lib/export-formatter';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // 1. Authenticate user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const module = searchParams.get('module');
  if (!module) {
    return NextResponse.json({ error: 'Module parameter is required' }, { status: 400 });
  }

  try {
    const buffer = await generateTemplateExcel(module);
    
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${module}_import_template.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('[templates-api] Error generating template:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
