'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { safeUUID } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportLeadsModal({ open, onOpenChange, onImported }: ImportLeadsModalProps) {
  const supabase = createClient();
  const { accountId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
  } | null>(null);

  function reset() {
    setFile(null);
    setParsedRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);

    try {
      const data = await selected.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (json.length === 0) {
        toast.error('No rows found in the selected file.');
        return;
      }
      setParsedRows(json);
      toast.success(`Successfully parsed ${json.length} rows.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to parse file: ' + err.message);
    }
  }

  async function handleImport() {
    if (!accountId || parsedRows.length === 0) return;
    setImporting(true);

    let imported = 0;
    let failed = 0;

    // We will insert in chunks to avoid overloading or constraint errors
    const batch = parsedRows.map((row) => {
      // Find case-insensitive keys
      const getValue = (keys: string[]) => {
        const foundKey = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim().replace(/[\s_-]+/g, '')));
        return foundKey ? String(row[foundKey]).trim() : '';
      };

      const buyerName = getValue(['buyername', 'name', 'buyer', 'contactname', 'contact']);
      const companyName = getValue(['companyname', 'company', 'firm', 'organization']);
      const mobile = getValue(['mobile', 'phone', 'contactnumber', 'mobilenumber']);
      const altMobile = getValue(['altmobile', 'alternatephone', 'alternatemobile']);
      const email = getValue(['email', 'emailid', 'mail']);
      const city = getValue(['city', 'location']);
      const state = getValue(['state', 'region']);
      const country = getValue(['country']) || 'India';
      const productName = getValue(['productname', 'product', 'requirement', 'item']);
      const quantity = getValue(['quantity', 'qty', 'volume']);
      const message = getValue(['message', 'enquiry', 'query', 'requirementdetails']);
      
      const rawPlatform = getValue(['platform', 'source']);
      const platform = ['INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA'].includes(rawPlatform.toUpperCase())
        ? rawPlatform.toUpperCase()
        : 'INDIAMART';

      const rawStatus = getValue(['status']);
      const status = ['pending', 'assigned', 'contacted', 'converted', 'rejected'].includes(rawStatus.toLowerCase())
        ? rawStatus.toLowerCase()
        : 'pending';

      return {
        account_id: accountId,
        platform,
        external_lead_id: 'manual_' + safeUUID().replace(/-/g, '').slice(0, 16),
        buyer_name: buyerName || null,
        company_name: companyName || null,
        mobile: mobile || null,
        alternate_mobile: altMobile || null,
        email: email || null,
        city: city || null,
        state: state || null,
        country: country || null,
        product_name: productName || null,
        quantity: quantity || null,
        message: message || null,
        status,
        lead_source: 'B2B_MARKETPLACE',
        received_at: new Date().toISOString(),
      };
    });

    try {
      const { error } = await supabase.from('b2b_leads').insert(batch);
      if (error) throw error;
      imported = batch.length;
    } catch (err: any) {
      console.error(err);
      failed = batch.length;
      toast.error('Failed to import leads: ' + err.message);
    }

    setResult({ imported, failed });
    setImporting(false);
    if (imported > 0) {
      toast.success(`Import completed successfully!`);
      onImported();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Import Enquiries</DialogTitle>
          <DialogDescription className="text-slate-400">
            Upload an Excel (.xlsx, .xls) or CSV (.csv) file of enquiries.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => fileInputRef.current?.click()}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv, .xlsx, .xls"
                className="hidden"
              />
              <Upload className="mx-auto h-8 w-8 text-slate-500 mb-2" />
              <p className="text-xs font-semibold text-slate-300">Click to upload Excel or CSV file</p>
              <p className="text-[10px] text-slate-500 mt-1">Accepts Excel sheets and CSVs</p>
            </div>

            {file && (
              <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 text-xs flex justify-between items-center">
                <div className="truncate pr-4">
                  <span className="font-semibold text-slate-300 block truncate">{file.name}</span>
                  <span className="text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
                {parsedRows.length > 0 && (
                  <span className="shrink-0 bg-primary/10 text-primary px-2.5 py-0.5 rounded text-[10px] font-bold">
                    {parsedRows.length} rows parsed
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              {result.failed === 0 ? (
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400 shrink-0" />
              )}
              <span>Import finished</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs rounded-lg bg-slate-950 p-3 border border-slate-800">
              <div className="text-slate-500">Successfully Imported:</div>
              <div className="font-semibold text-emerald-400 text-right">{result.imported}</div>
              <div className="text-slate-500">Failed / Errors:</div>
              <div className="font-semibold text-red-400 text-right">{result.failed}</div>
            </div>
          </div>
        )}

        <DialogFooter className="bg-slate-900 border-slate-700">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={importing || parsedRows.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
