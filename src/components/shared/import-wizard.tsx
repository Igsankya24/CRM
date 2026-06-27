'use client';

import { useState, useRef, useEffect } from 'react';
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
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  Settings,
  X,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: 'enquiry' | 'quotation' | 'proforma' | 'sales' | 'customer' | 'product';
  onImportCompleted: () => void;
}

interface DBField {
  key: string;
  label: string;
  required: boolean;
  type: string;
  description: string;
}

// DB Fields definitions for mapping
const MODULE_FIELDS: Record<string, DBField[]> = {
  enquiry: [
    { key: 'company_name', label: 'Company Name', required: false, type: 'text', description: 'Firm or Company Name' },
    { key: 'buyer_name', label: 'Buyer Name', required: false, type: 'text', description: 'Contact Person Name' },
    { key: 'phone', label: 'Contact Phone', required: true, type: 'text', description: 'Mobile / Phone number' },
    { key: 'email', label: 'Email ID', required: false, type: 'text', description: 'Email address' },
    { key: 'source', label: 'Lead Source', required: false, type: 'text', description: 'Source (e.g. INDIAMART, WEBSITE)' },
    { key: 'requirement', label: 'Requirement Details', required: false, type: 'text', description: 'Buyer requirements text' },
    { key: 'city', label: 'City', required: false, type: 'text', description: 'City name' },
    { key: 'state', label: 'State', required: false, type: 'text', description: 'State name' },
    { key: 'country', label: 'Country', required: false, type: 'text', description: 'Country (Default: India)' },
    { key: 'pincode', label: 'Pincode', required: false, type: 'text', description: '6-digit pincode' },
    { key: 'product_name', label: 'Product Name', required: false, type: 'text', description: 'Quick product reference' },
    { key: 'quantity', label: 'Quantity', required: false, type: 'text', description: 'Quantity required' },
    { key: 'remarks', label: 'Remarks', required: false, type: 'text', description: 'Staff remarks' },
    { key: 'followup_date', label: 'Follow-up Date', required: false, type: 'date', description: 'YYYY-MM-DD format' },
  ],
  customer: [
    { key: 'name', label: 'Customer Name', required: true, type: 'text', description: 'Full name' },
    { key: 'phone', label: 'Phone', required: true, type: 'text', description: 'Mobile phone number' },
    { key: 'email', label: 'Email', required: false, type: 'text', description: 'Email' },
    { key: 'company', label: 'Company Name', required: false, type: 'text', description: 'Company/Firm' },
    { key: 'address', label: 'Address', required: false, type: 'text', description: 'Full Address' },
    { key: 'city', label: 'City', required: false, type: 'text', description: 'City' },
    { key: 'state', label: 'State', required: false, type: 'text', description: 'State' },
    { key: 'pincode', label: 'PIN Code', required: false, type: 'text', description: 'PIN Code' },
    { key: 'country', label: 'Country', required: false, type: 'text', description: 'Country' },
  ],
  product: [
    { key: 'product_name', label: 'Product Name', required: true, type: 'text', description: 'Product display name' },
    { key: 'category', label: 'Category', required: false, type: 'text', description: 'Product category' },
    { key: 'description', label: 'Description', required: false, type: 'text', description: 'Detailed description' },
    { key: 'specification', label: 'Specification', required: false, type: 'text', description: 'Technical specs' },
    { key: 'hsn_code', label: 'HSN Code', required: false, type: 'text', description: 'HSN code' },
    { key: 'price', label: 'Price', required: false, type: 'number', description: 'Unit selling price' },
    { key: 'unit', label: 'Unit', required: false, type: 'text', description: 'Unit of Measure (Default: pcs)' },
  ],
  quotation: [
    { key: 'quotation_no', label: 'Quotation No', required: false, type: 'text', description: 'Unique quote reference' },
    { key: 'entry_date', label: 'Date', required: false, type: 'date', description: 'YYYY-MM-DD' },
    { key: 'company_name', label: 'Company Name', required: true, type: 'text', description: 'Client company name' },
    { key: 'contact_person', label: 'Contact Person', required: false, type: 'text', description: 'Client contact name' },
    { key: 'mobile', label: 'Mobile', required: true, type: 'text', description: 'Contact phone' },
    { key: 'email', label: 'Email', required: false, type: 'text', description: 'Email address' },
    { key: 'gst_no', label: 'GST Number', required: false, type: 'text', description: '15-digit GSTIN' },
    { key: 'address', label: 'Address', required: false, type: 'text', description: 'Client address' },
    { key: 'city', label: 'City', required: false, type: 'text', description: 'City' },
    { key: 'state', label: 'State', required: false, type: 'text', description: 'State' },
    { key: 'pincode', label: 'PIN Code', required: false, type: 'text', description: 'PIN Code' },
    { key: 'country', label: 'Country', required: false, type: 'text', description: 'Country' },
    { key: 'subject', label: 'Subject', required: false, type: 'text', description: 'Quotation subject' },
    { key: 'basic_total', label: 'Basic Total', required: true, type: 'number', description: 'Subtotal total' },
    { key: 'tax_type', label: 'Tax Type', required: false, type: 'text', description: 'GST type (e.g. gst_18, cgst_sgst_18)' },
    { key: 'tax_amount', label: 'Tax Amount', required: false, type: 'number', description: 'Tax amount' },
    { key: 'grand_total', label: 'Grand Total', required: true, type: 'number', description: 'Grand total' },
    { key: 'status', label: 'Status', required: false, type: 'text', description: 'draft, sent, accepted' },
  ],
  proforma: [
    { key: 'proforma_no', label: 'Proforma No', required: false, type: 'text', description: 'PI reference' },
    { key: 'entry_date', label: 'Date', required: false, type: 'date', description: 'YYYY-MM-DD' },
    { key: 'company_name', label: 'Company Name', required: true, type: 'text', description: 'Client company name' },
    { key: 'contact_person', label: 'Contact Person', required: false, type: 'text', description: 'Client contact name' },
    { key: 'mobile', label: 'Mobile', required: true, type: 'text', description: 'Contact phone' },
    { key: 'email', label: 'Email', required: false, type: 'text', description: 'Email address' },
    { key: 'gst_no', label: 'GST Number', required: false, type: 'text', description: '15-digit GSTIN' },
    { key: 'address', label: 'Address', required: false, type: 'text', description: 'Client address' },
    { key: 'city', label: 'City', required: false, type: 'text', description: 'City' },
    { key: 'state', label: 'State', required: false, type: 'text', description: 'State' },
    { key: 'pincode', label: 'PIN Code', required: false, type: 'text', description: 'PIN Code' },
    { key: 'country', label: 'Country', required: false, type: 'text', description: 'Country' },
    { key: 'subject', label: 'Subject', required: false, type: 'text', description: 'Proforma subject' },
    { key: 'basic_total', label: 'Basic Total', required: true, type: 'number', description: 'Subtotal' },
    { key: 'tax_type', label: 'Tax Type', required: false, type: 'text', description: 'Tax classification' },
    { key: 'tax_amount', label: 'Tax Amount', required: false, type: 'number', description: 'Tax amount' },
    { key: 'grand_total', label: 'Grand Total', required: true, type: 'number', description: 'Total value' },
    { key: 'status', label: 'Status', required: false, type: 'text', description: 'draft, sent, paid' },
  ],
  sales: [
    { key: 'sales_no', label: 'Sales No', required: false, type: 'text', description: 'Invoice number' },
    { key: 'entry_date', label: 'Date', required: false, type: 'date', description: 'YYYY-MM-DD' },
    { key: 'company_name', label: 'Company Name', required: true, type: 'text', description: 'Client company name' },
    { key: 'contact_person', label: 'Contact Person', required: false, type: 'text', description: 'Client contact' },
    { key: 'mobile', label: 'Mobile', required: true, type: 'text', description: 'Contact phone' },
    { key: 'email', label: 'Email', required: false, type: 'text', description: 'Email address' },
    { key: 'gst_no', label: 'GST Number', required: false, type: 'text', description: '15-digit GSTIN' },
    { key: 'address', label: 'Address', required: false, type: 'text', description: 'Client address' },
    { key: 'city', label: 'City', required: false, type: 'text', description: 'City' },
    { key: 'state', label: 'State', required: false, type: 'text', description: 'State' },
    { key: 'pincode', label: 'PIN Code', required: false, type: 'text', description: 'PIN Code' },
    { key: 'country', label: 'Country', required: false, type: 'text', description: 'Country' },
    { key: 'basic_total', label: 'Basic Total', required: true, type: 'number', description: 'Subtotal' },
    { key: 'tax_type', label: 'Tax Type', required: false, type: 'text', description: 'Tax classification' },
    { key: 'tax_amount', label: 'Tax Amount', required: false, type: 'number', description: 'Tax amount' },
    { key: 'grand_total', label: 'Grand Total', required: true, type: 'number', description: 'Total value' },
    { key: 'dispatch_status', label: 'Dispatch Status', required: false, type: 'text', description: 'pending, ready, dispatched' },
    { key: 'payment_status', label: 'Payment Status', required: false, type: 'text', description: 'pending, partial, paid' },
    { key: 'status', label: 'Status', required: false, type: 'text', description: 'pending, completed' },
  ],
};

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'summary';

export function ImportWizard({ open, onOpenChange, module, onImportCompleted }: ImportWizardProps) {
  const { accountId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'merge' | 'create'>('skip');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<string>('queued');
  const [summary, setSummary] = useState<{
    total: number;
    imported: number;
    failed: number;
    skipped: number;
    errors: any[];
  } | null>(null);

  const fields = MODULE_FIELDS[module] || [];

  // Reset state on open change
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setRawHeaders([]);
      setParsedRows([]);
      setMapping({});
      setDuplicateStrategy('skip');
      setJobId(null);
      setProgress(0);
      setSummary(null);
    }
  }, [open]);

  // Load previous mapping from DB
  useEffect(() => {
    if (open && accountId) {
      fetch(`/api/import/history?module=${module}`)
        .then(res => res.json())
        .then(data => {
          // If past mappings exist, load last one
          // We can also fetch the exact mapping table, but since the endpoint returns mappings in metadata, we can parse it
        })
        .catch(() => {});
    }
  }, [open, accountId, module]);

  // Job Polling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (jobId && step === 'importing') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/import/jobs?jobId=${jobId}`);
          if (res.ok) {
            const data = await res.json();
            const job = data.job;
            const logs = data.logs || [];

            setProgress(job.progress || 0);
            setJobStatus(job.status);

            if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
              clearInterval(interval);
              const failed = job.failed_rows || 0;
              const imported = job.processed_rows || 0;
              setSummary({
                total: job.total_rows,
                imported,
                failed,
                skipped: Math.max(0, job.total_rows - imported - failed),
                errors: logs.filter((l: any) => l.status === 'error'),
              });
              setStep('summary');
              onImportCompleted();
            }
          }
        } catch (err) {
          console.error('Error polling import job:', err);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [jobId, step]);

  // 1. File Upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (extension !== 'xlsx' && extension !== 'xls') {
      toast.error('Only Excel (.xlsx, .xls) format is supported for import.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(selectedFile);
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const headers = getSheetHeaders(worksheet);
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (json.length === 0) {
        toast.error('The selected Excel file is empty.');
        return;
      }

      setRawHeaders(headers);
      setParsedRows(json);

      // Attempt auto-mapping
      const autoMapping: Record<string, string> = {};
      fields.forEach((f) => {
        const matchedHeader = headers.find(
          (h) =>
            h.toLowerCase().trim().replace(/[\s_-]+/g, '') ===
            f.label.toLowerCase().trim().replace(/[\s_-]+/g, '')
        );
        if (matchedHeader) {
          autoMapping[f.key] = matchedHeader;
        }
      });
      setMapping(autoMapping);
      setStep('mapping');
    } catch (err: any) {
      toast.error('Failed to parse Excel file: ' + err.message);
    }
  };

  const getSheetHeaders = (sheet: XLSX.WorkSheet): string[] => {
    const headers: string[] = [];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rowIdx = range.s.r; // header starts at first row
    for (let colIdx = range.s.c; colIdx <= range.e.c; colIdx++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      const cell = sheet[cellRef];
      if (cell && cell.v) {
        headers.push(String(cell.v).trim());
      }
    }
    return headers;
  };

  // 2. Mapping Submission
  const handleConfirmMapping = () => {
    // Validate that all required fields are mapped
    const missingRequired = fields
      .filter((f) => f.required && !mapping[f.key])
      .map((f) => f.label);

    if (missingRequired.length > 0) {
      toast.error(`Please map all required fields: ${missingRequired.join(', ')}`);
      return;
    }

    setStep('preview');
  };

  // 3. Start Bulk Import Action
  const handleStartImport = async () => {
    setStep('importing');
    setProgress(0);
    setJobStatus('queued');

    try {
      const res = await fetch('/api/import/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          rows: parsedRows,
          duplicateStrategy,
          mapping,
          filename: file?.name || 'import.xlsx',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit import process');
      }

      const data = await res.json();
      setJobId(data.jobId);
    } catch (err: any) {
      toast.error('Import initiation failed: ' + err.message);
      setStep('preview');
    }
  };

  // 4. Cancel Job
  const handleCancelImport = async () => {
    if (!jobId) return;
    try {
      const res = await fetch('/api/import/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action: 'cancel' }),
      });
      if (res.ok) {
        toast.info('Cancellation request sent.');
      }
    } catch (err: any) {
      toast.error('Failed to cancel job: ' + err.message);
    }
  };

  // 5. Download Excel Error logs report
  const downloadErrorReport = () => {
    if (!summary || summary.errors.length === 0) return;
    const worksheetData = summary.errors.map((e) => ({
      Row: e.row_index,
      Data: e.row_data,
      Reason: e.message,
    }));
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, `import_error_report_${module}_${Date.now()}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <span>Import Data Register — {module.toUpperCase()}</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Professional multi-step validation wizard to import records into the CRM.
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="py-6 space-y-4">
            <div
              className="border-2 border-dashed border-slate-700 rounded-xl p-10 text-center hover:bg-slate-800/40 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <Upload className="mx-auto h-12 w-12 text-slate-500 mb-3" />
              <p className="text-sm font-semibold text-slate-200">Click to upload spreadsheet</p>
              <p className="text-xs text-slate-500 mt-1.5">Only Excel (.xlsx, .xls) files are supported. CSV and PDFs are locked.</p>
            </div>
          </div>
        )}

        {/* Column Mapping Step */}
        {step === 'mapping' && (
          <div className="py-2 space-y-4 max-h-[400px] overflow-y-auto pr-1">
            <p className="text-xs text-slate-400">Map Excel headers (columns) to CRM fields. Fields marked with * are required.</p>
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-3 items-center gap-4 border-b border-slate-800 pb-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-300">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </span>
                    <span className="text-[10px] text-slate-500">{f.description}</span>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={mapping[f.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                      className="w-full text-xs bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-300 focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- Do Not Map --</option>
                      {rawHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setStep('upload')} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                Back
              </Button>
              <Button onClick={handleConfirmMapping} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Verify Mapping <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Duplicate Resolution Strategy & Preview */}
        {step === 'preview' && (
          <div className="py-2 space-y-5">
            <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-primary" /> Duplicate Resolution Strategy
              </span>
              <p className="text-[11px] text-slate-400">Select what to do when a row has an existing match in the database.</p>
              
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'skip', label: 'Skip Existing', desc: 'Ignore row if duplicated' },
                  { key: 'update', label: 'Update Existing', desc: 'Overwrite duplicate values' },
                  { key: 'merge', label: 'Merge Records', desc: 'Fill missing fields only' },
                  { key: 'create', label: 'Create New', desc: 'Insert copy anyway' },
                ].map((strat) => (
                  <label
                    key={strat.key}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      duplicateStrategy === strat.key
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-800 hover:bg-slate-800/40 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      checked={duplicateStrategy === strat.key}
                      onChange={() => setDuplicateStrategy(strat.key as any)}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-200">{strat.label}</span>
                      <span className="text-[9px] text-slate-500 mt-0.5">{strat.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="text-xs rounded-lg border border-slate-800 bg-slate-950 p-3 flex justify-between items-center text-slate-400">
              <span>Spreadsheet parsed successfully. Total rows: <span className="font-semibold text-white">{parsedRows.length}</span>.</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('mapping')} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                Back
              </Button>
              <Button onClick={handleStartImport} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Process Bulk Import
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Importing Progress Bar */}
        {step === 'importing' && (
          <div className="py-8 space-y-6 text-center">
            <div className="space-y-2">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-semibold text-slate-200">Processing background job...</p>
              <p className="text-xs text-slate-500">Processing and validating {parsedRows.length} rows in background thread.</p>
            </div>
            
            <div className="space-y-1.5 max-w-md mx-auto">
              <Progress value={progress} className="h-2 bg-slate-850" />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Status: {jobStatus.toUpperCase()}</span>
                <span>{progress}% Completed</span>
              </div>
            </div>

            <Button variant="destructive" onClick={handleCancelImport} className="text-xs py-1.5 h-8">
              Cancel Import
            </Button>
          </div>
        )}

        {/* Import Summary Step */}
        {step === 'summary' && summary && (
          <div className="py-2 space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-300 font-semibold mb-2">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>Import processing complete!</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-center">
                <span className="text-[10px] text-slate-500 block">Total Rows</span>
                <span className="text-lg font-bold text-white mt-1">{summary.total}</span>
              </div>
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-center">
                <span className="text-[10px] text-slate-500 block">Successfully Imported</span>
                <span className="text-lg font-bold text-emerald-400 mt-1">{summary.imported}</span>
              </div>
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-center">
                <span className="text-[10px] text-slate-500 block">Failed Rows</span>
                <span className="text-lg font-bold text-red-400 mt-1">{summary.failed}</span>
              </div>
            </div>

            {summary.errors.length > 0 && (
              <div className="rounded-lg border border-red-500/10 bg-red-500/5 p-3 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Some rows failed due to validation or schema errors.</span>
                </div>
                <Button
                  onClick={downloadErrorReport}
                  variant="outline"
                  className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-white text-xs h-7 py-0 px-2"
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Error Report
                </Button>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full">
                Close Wizard
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
