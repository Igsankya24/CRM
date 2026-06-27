'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
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

interface ImportSalesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportSalesModal({ open, onOpenChange, onImported }: ImportSalesModalProps) {
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

    try {
      // 1. Fetch default sales register terms from company settings
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('sales_register_terms_text, manager_name, manager_designation')
        .eq('account_id', accountId)
        .maybeSingle();

      const defaultTerms = companySettings?.sales_register_terms_text || '';
      const managerName = companySettings?.manager_name || 'Darshan Ladi';
      const managerDesignation = companySettings?.manager_designation || 'Manager';

      // 2. Process rows sequentially to handle RPC invoice numbering and related table inserts
      for (const row of parsedRows) {
        const getValue = (keys: string[]) => {
          const foundKey = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim().replace(/[\s_-]+/g, '')));
          return foundKey ? String(row[foundKey]).trim() : '';
        };

        const companyName = getValue(['companyname', 'company', 'firm', 'customer', 'customername']);
        if (!companyName) {
          failed++;
          continue;
        }

        const salesRegisterNoInput = getValue(['salesregisterno', 'invoiceno', 'salesno', 'number']);
        const entryDateInput = getValue(['entrydate', 'date', 'invoicedate']);
        const contactPerson = getValue(['contactperson', 'contact', 'name']);
        const email = getValue(['email', 'emailid', 'mail']);
        const mobile = getValue(['mobile', 'phone', 'contactnumber']);
        const altMobile = getValue(['altmobile', 'alternatephone']);
        const address = getValue(['address', 'billingaddress']);
        const state = getValue(['state']);
        const pincode = getValue(['pincode', 'zip', 'postal']);
        const gstNo = getValue(['gstno', 'gst', 'gstin']);
        const subject = getValue(['subject', 'description']);
        const basicTotal = parseFloat(getValue(['basictotal', 'basic', 'subtotal'])) || 0;
        const taxType = getValue(['taxtype', 'tax']) || 'none';
        const taxAmount = parseFloat(getValue(['taxamount', 'taxval'])) || 0;
        const grandTotal = parseFloat(getValue(['grandtotal', 'total', 'amount'])) || basicTotal + taxAmount;
        const amountWords = getValue(['amountwords', 'totalinwords']);
        const rawStatus = getValue(['status']);
        const status = ['pending', 'processing', 'completed', 'cancelled', 'delivered'].includes(rawStatus.toLowerCase())
          ? rawStatus.toLowerCase()
          : 'pending';

        // Get unique SR No
        let srNo = salesRegisterNoInput;
        if (!srNo) {
          const { data: nextNo } = await supabase.rpc('next_sales_register_no', { p_account_id: accountId });
          srNo = nextNo || `SR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const entryDate = entryDateInput
          ? new Date(entryDateInput).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        // Insert Master
        const { data: salesRegister, error: srErr } = await supabase
          .from('sales_registers')
          .insert({
            account_id: accountId,
            sales_register_no: srNo,
            entry_date: entryDate,
            company_name: companyName,
            contact_person: contactPerson || null,
            email: email || null,
            mobile: mobile || '0000000000',
            alt_mobile: altMobile || null,
            address: address || 'No address provided',
            state: state || null,
            pincode: pincode || null,
            gst_no: gstNo || null,
            subject: subject || null,
            basic_total: basicTotal,
            tax_type: taxType,
            tax_amount: taxAmount,
            grand_total: grandTotal,
            amount_words: amountWords || null,
            status,
            manager_name: managerName,
            manager_designation: managerDesignation,
          })
          .select()
          .single();

        if (srErr) {
          console.error('Error inserting sales register:', srErr.message);
          failed++;
          continue;
        }

        // Insert Terms
        await supabase
          .from('sales_register_terms')
          .insert({
            sales_register_id: salesRegister.id,
            terms_text: defaultTerms,
          });

        // Insert Status History
        await supabase
          .from('sales_register_status_history')
          .insert({
            sales_register_id: salesRegister.id,
            old_status: null,
            new_status: status,
            note: 'Imported from Excel/CSV file',
          });

        imported++;
      }
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error('Import processing failed: ' + err.message);
    }

    setResult({ imported, failed });
    setImporting(false);
    if (imported > 0) {
      toast.success(`Import completed!`);
      onImported();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Import Sales Registers</DialogTitle>
          <DialogDescription className="text-slate-400">
            Upload an Excel (.xlsx, .xls) or CSV (.csv) file of sales registers.
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
