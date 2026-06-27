'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Trash2,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ArrowLeft,
} from 'lucide-react';

interface ImportExportHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: 'enquiry' | 'quotation' | 'proforma' | 'sales' | 'customer' | 'product';
}

export function ImportExportHistoryDialog({
  open,
  onOpenChange,
  module,
}: ImportExportHistoryDialogProps) {
  const { hasPermission } = usePermissions();
  const canDelete = hasPermission('data_management', 'history_delete');
  const canViewLogs = hasPermission('data_management', 'logs_view');

  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [loading, setLoading] = useState(true);
  const [imports, setImports] = useState<any[]>([]);
  const [exports, setExports] = useState<any[]>([]);

  // Detailed logs state
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [viewingHistoryFile, setViewingHistoryFile] = useState<string>('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/import/history?module=${module}`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setImports(data.imports || []);
      setExports(data.exports || []);
    } catch (err: any) {
      toast.error('Failed to load history: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    if (open) {
      fetchHistory();
      setViewingHistoryId(null);
    }
  }, [open, fetchHistory]);

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this import history entry and all associated logs? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/import/history?historyId=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete history entry');
      toast.success('History entry deleted.');
      setImports((prev) => prev.filter((item) => item.id !== id));
      if (viewingHistoryId === id) {
        setViewingHistoryId(null);
      }
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const handleViewLogs = async (historyId: string, filename: string) => {
    if (!canViewLogs) {
      toast.error('You do not have permission to view import logs.');
      return;
    }
    setViewingHistoryId(historyId);
    setViewingHistoryFile(filename);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/import/history?historyId=${historyId}`);
      if (!res.ok) throw new Error('Failed to fetch detailed logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      toast.error('Failed to load logs: ' + err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-4xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b border-slate-800 pb-4 shrink-0">
          <DialogTitle className="text-white flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" />
            <span>Audit History Log — {module.toUpperCase()}</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            View history and logs for all imports and exports in this module.
          </DialogDescription>
        </DialogHeader>

        {viewingHistoryId ? (
          /* Logs View */
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 py-4">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingHistoryId(null)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to List
              </Button>
              <span className="text-xs text-slate-400">
                Viewing validation logs for: <span className="font-semibold text-white">{viewingHistoryFile}</span>
              </span>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/40">
              {loadingLogs ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
                  <p className="text-xs">No errors or warnings recorded. All rows successfully processed!</p>
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-slate-900 sticky top-0 z-10">
                    <TableRow className="border-slate-850 hover:bg-transparent">
                      <TableHead className="w-16 text-center text-slate-400">Row</TableHead>
                      <TableHead className="w-24 text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Message</TableHead>
                      <TableHead className="text-slate-400">Row Data Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="border-slate-850 hover:bg-slate-900/40">
                        <TableCell className="text-center font-mono text-slate-400">{log.row_index || '—'}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                              log.status === 'error'
                                ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                                : log.status === 'warning'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {log.status === 'error' ? (
                              <XCircle className="h-3 w-3" />
                            ) : log.status === 'warning' ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {log.status.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-300 whitespace-pre-wrap max-w-xs">{log.message}</TableCell>
                        <TableCell className="font-mono text-[10px] text-slate-500 max-w-sm truncate" title={log.row_data}>
                          {log.row_data ? JSON.stringify(JSON.parse(log.row_data)) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 py-4 gap-4">
            {/* Tabs */}
            <div className="flex border-b border-slate-800 shrink-0">
              <button
                onClick={() => setActiveTab('import')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'import'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Import Logs
              </button>
              <button
                onClick={() => setActiveTab('export')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'export'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Export History
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/40">
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activeTab === 'import' ? (
                imports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                    <FileSpreadsheet className="h-8 w-8 opacity-40 mb-2" />
                    <p className="text-xs">No import records found.</p>
                  </div>
                ) : (
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-900 sticky top-0 z-10">
                      <TableRow className="border-slate-850 hover:bg-transparent">
                        <TableHead className="text-slate-400">Filename</TableHead>
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400 text-center">Status</TableHead>
                        <TableHead className="text-slate-400 text-right">Rows</TableHead>
                        <TableHead className="text-slate-400 text-right">Failed</TableHead>
                        <TableHead className="text-slate-400 text-right">Duration</TableHead>
                        <TableHead className="text-slate-400">Imported By</TableHead>
                        <TableHead className="text-slate-400 text-center w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {imports.map((item) => (
                        <TableRow
                          key={item.id}
                          onClick={() => handleViewLogs(item.id, item.filename)}
                          className="border-slate-850 hover:bg-slate-900/40 cursor-pointer"
                        >
                          <TableCell className="font-medium text-slate-200 flex items-center gap-1.5">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate max-w-[180px]" title={item.filename}>
                              {item.filename}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-400 text-[11px] whitespace-nowrap">
                            {new Date(item.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${
                                item.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : item.status === 'failed'
                                  ? 'bg-rose-500/10 text-rose-450'
                                  : 'bg-amber-500/10 text-amber-400'
                              }`}
                            >
                              {item.status.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-400">{item.rows_imported}</TableCell>
                          <TableCell className="text-right font-semibold text-rose-455">
                            {item.rows_failed > 0 ? (
                              <span className="text-red-400 font-bold">{item.rows_failed}</span>
                            ) : (
                              '0'
                            )}
                          </TableCell>
                          <TableCell className="text-right text-slate-400 whitespace-nowrap">
                            {item.duration ? `${(item.duration / 1000).toFixed(1)}s` : '—'}
                          </TableCell>
                          <TableCell className="text-slate-400 flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-500" />
                            <span>{item.creator?.full_name || 'System'}</span>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => handleDeleteHistory(item.id, e)}
                                  className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : exports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                  <FileText className="h-8 w-8 opacity-40 mb-2" />
                  <p className="text-xs">No export records found.</p>
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-slate-900 sticky top-0 z-10">
                    <TableRow className="border-slate-850 hover:bg-transparent">
                      <TableHead className="text-slate-400">Filename</TableHead>
                      <TableHead className="text-slate-400">Date</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400 text-right">Rows Exported</TableHead>
                      <TableHead className="text-slate-400">Filters Applied</TableHead>
                      <TableHead className="text-slate-400">Exported By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((item) => (
                      <TableRow key={item.id} className="border-slate-850 hover:bg-transparent">
                        <TableCell className="font-medium text-slate-200 flex items-center gap-1.5">
                          <FileText
                            className={`h-3.5 w-3.5 shrink-0 ${
                              item.export_type === 'excel'
                                ? 'text-emerald-500'
                                : item.export_type === 'pdf'
                                ? 'text-rose-500'
                                : 'text-sky-500'
                            }`}
                          />
                          <span className="truncate max-w-[200px]" title={item.filename}>
                            {item.filename}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(item.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="uppercase font-semibold tracking-wider text-[10px] text-slate-300">
                          {item.export_type}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-100">{item.rows_exported}</TableCell>
                        <TableCell className="text-slate-500 text-[10px] max-w-xs truncate" title={JSON.stringify(item.filters_used)}>
                          {item.filters_used && Object.keys(item.filters_used).length > 0
                            ? JSON.stringify(item.filters_used)
                            : 'None'}
                        </TableCell>
                        <TableCell className="text-slate-400 flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-500" />
                          <span>{item.creator?.full_name || 'System'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
