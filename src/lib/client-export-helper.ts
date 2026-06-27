import { createClient } from '@/lib/supabase/client';
import { generateExcelBuffer, generateCSVBuffer } from '@/lib/export-formatter';
import { toast } from 'sonner';

interface ExportConfig {
  module: 'enquiry' | 'quotation' | 'proforma' | 'sales' | 'customer' | 'product';
  title: string;
  headers: string[];
  colWidths: string[];
  data: any[][];
  filtersUsed?: any;
  filenamePrefix: string;
}

export async function exportToExcel({
  module,
  title,
  headers,
  data,
  filtersUsed,
  filenamePrefix,
}: ExportConfig) {
  const supabase = createClient();
  try {
    // 1. Get current user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const userName = profile?.full_name || 'System';

    // 2. Get company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();

    // 3. Generate Excel Buffer
    const buffer = await generateExcelBuffer({
      title,
      headers,
      data,
      companySettings: settings,
      generatedBy: userName,
    });

    // 4. Download file
    const filename = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 5. Post export audit log
    await fetch('/api/import/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module,
        exportType: 'excel',
        filtersUsed: filtersUsed || {},
        rowsExported: data.length,
        filename,
      }),
    });

    toast.success('Excel register exported and audited successfully!');
  } catch (err: any) {
    console.error('[export-excel] Error:', err);
    toast.error('Failed to export Excel: ' + err.message);
  }
}

export async function exportToCSV({
  module,
  headers,
  data,
  filtersUsed,
  filenamePrefix,
}: Omit<ExportConfig, 'title' | 'colWidths'>) {
  try {
    // 1. Generate CSV Buffer
    const buffer = generateCSVBuffer(headers, data);

    // 2. Download file
    const filename = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
    const blob = new Blob([new Uint8Array(buffer)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 3. Post export audit log
    await fetch('/api/import/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module,
        exportType: 'csv',
        filtersUsed: filtersUsed || {},
        rowsExported: data.length,
        filename,
      }),
    });

    toast.success('CSV register exported and audited successfully!');
  } catch (err: any) {
    console.error('[export-csv] Error:', err);
    toast.error('Failed to export CSV: ' + err.message);
  }
}

export async function exportToPDF({
  module,
  title,
  headers,
  colWidths,
  data,
  filtersUsed,
  filenamePrefix,
}: ExportConfig) {
  const supabase = createClient();
  try {
    // 1. Get current user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const userName = profile?.full_name || 'System';

    // 2. Get company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();

    // 3. Generate PDF Blob dynamically
    const { pdf } = await import('@react-pdf/renderer');
    const { RegisterPDFDocument } = await import('@/components/shared/register-pdf-document');
    const { createElement } = await import('react');

    const blob = await pdf(
      createElement(RegisterPDFDocument, {
        title,
        headers,
        colWidths,
        data: data.map(row => row.map(cell => String(cell ?? ''))),
        companySettings: settings,
        generatedBy: userName,
      }) as any
    ).toBlob();

    // 4. Download file
    const filename = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.pdf`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 5. Post export audit log
    await fetch('/api/import/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module,
        exportType: 'pdf',
        filtersUsed: filtersUsed || {},
        rowsExported: data.length,
        filename,
      }),
    });

    toast.success('PDF register exported and audited successfully!');
  } catch (err: any) {
    console.error('[export-pdf] Error:', err);
    toast.error('Failed to export PDF: ' + err.message);
  }
}

export function downloadTemplate(module: string) {
  try {
    const link = document.createElement('a');
    link.href = `/api/import/templates?module=${module}`;
    link.download = `${module}_import_template.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Import template download started.');
  } catch (err: any) {
    toast.error('Failed to download template: ' + err.message);
  }
}
