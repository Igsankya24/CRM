"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Search, RefreshCw, Filter, ArrowUpDown,
  FileText, TrendingUp, Upload, Download, ChevronDown, FileSpreadsheet, History
} from "lucide-react";
import { toast } from "sonner";
import { SalesRegisterStatusBadge, SALES_REGISTER_STATUS_OPTIONS } from "@/components/sales-registers/sales-register-status-badge";
import { SalesRegisterActions } from "@/components/sales-registers/sales-register-actions";
import { formatINR } from "@/lib/quotation-utils";
import type { SalesRegister, SalesRegisterStatus } from "@/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ImportWizard } from "@/components/shared/import-wizard";
import { ImportExportHistoryDialog } from "@/components/shared/import-export-history-dialog";
import { exportToExcel, exportToCSV, exportToPDF, downloadTemplate } from "@/lib/client-export-helper";
import { usePermissions } from "@/hooks/use-permissions";

interface SalesRegistersResponse {
  salesRegisters: SalesRegister[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 20;

export default function SalesRegistersPage() {
  const router = useRouter();

  const [data, setData]       = useState<SalesRegistersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState<string>("all");
  const [sortBy, setSortBy]   = useState("entry_date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:    String(page),
        limit:   String(LIMIT),
        search,
        status,
        sortBy,
        sortDir,
      });
      const res = await fetch(`/api/sales-registers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load sales registers");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, sortBy, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
    setPage(1);
  };

  const { hasPermission } = usePermissions();
  const canImport = hasPermission("data_management", "import");
  const canExport = hasPermission("data_management", "export");
  const canTemplates = hasPermission("data_management", "templates");
  const canViewHistory = hasPermission("data_management", "logs_view");

  const exportHeaders = [
    "SR NO", "SALES NO", "DATE", "PROFORMA NO", "CUSTOMER",
    "ADDRESS", "CITY", "STATE", "PIN CODE", "COUNTRY",
    "GST NO", "CONTACT PERSON", "MOBILE",
    "PRODUCT", "QUANTITY", "HSN CODE", "UOM", "UNIT PRICE", "PRODUCT COUNT",
    "DISPATCH STATUS", "PAYMENT STATUS", "TOTAL", "STATUS", "CREATED DATE"
  ];
  const exportColWidths = [
    "4%", "10%", "8%", "10%", "12%",
    "15%", "10%", "10%", "8%", "8%",
    "10%", "12%", "10%",
    "20%", "8%", "10%", "8%", "10%", "8%",
    "10%", "10%", "8%", "10%", "8%"
  ];

  const getExportData = () => {
    return salesRegisters.map((s, idx) => [
      idx + 1,
      s.sales_register_no,
      s.entry_date || "",
      s.parent_proforma?.proforma_no || "—",
      s.company_name,
      s.address || "",
      s.city || "",
      s.state || "",
      s.pincode || "",
      s.country || "",
      s.gst_no || "—",
      s.contact_person || "",
      s.mobile || "",
      s.items?.map(i => i.product_name).join('\n') || "—",
      s.items?.map(i => i.quantity || 0).join('\n') || "—",
      s.items?.map(i => i.hsn_code || "—").join('\n') || "—",
      s.items?.map(i => i.uom || "pcs").join('\n') || "—",
      s.items?.map(i => i.rate || 0).join('\n') || "—",
      s.items?.length || 0,
      s.status === 'delivered' || s.status === 'completed' ? 'Dispatched' : 'Pending',
      s.status === 'completed' ? 'Paid' : 'Pending',
      s.grand_total || 0,
      s.status,
      s.created_at ? new Date(s.created_at).toLocaleDateString() : "",
    ]);
  };

  const handleExportCSV = async () => {
    await exportToCSV({
      module: "sales",
      headers: exportHeaders,
      data: getExportData(),
      filtersUsed: { search, status },
      filenamePrefix: "sales_register",
    });
  };

  const handleExportExcel = async () => {
    await exportToExcel({
      module: "sales",
      title: "SALES REGISTER",
      headers: exportHeaders,
      colWidths: exportColWidths,
      data: getExportData(),
      filtersUsed: { search, status },
      filenamePrefix: "sales_register",
    });
  };

  const handleExportPDF = async () => {
    await exportToPDF({
      module: "sales",
      title: "SALES REGISTER",
      headers: exportHeaders,
      colWidths: exportColWidths,
      data: getExportData(),
      filtersUsed: { search, status },
      filenamePrefix: "sales_register",
    });
  };

  const handleDelete = (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            salesRegisters: prev.salesRegisters.filter((q) => q.id !== id),
            total: prev.total - 1,
          }
        : prev
    );
  };

  const handleStatusChange = (id: string, newStatus: SalesRegisterStatus) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            salesRegisters: prev.salesRegisters.map((q) =>
              q.id === id ? { ...q, status: newStatus } : q
            ),
          }
        : prev
    );
  };

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;
  const salesRegisters = data?.salesRegisters ?? [];

  // ── KPI cards
  const totalCount    = data?.total ?? 0;
  const pendingCount    = salesRegisters.filter((q) => q.status === "pending").length;
  const completedCount = salesRegisters.filter((q) => q.status === "completed").length;
  const grandSum      = salesRegisters.reduce((s, q) => s + Number(q.grand_total), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Register</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage and track all your sales registers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Download Template Button */}
          {canTemplates && (
            <button
              onClick={() => downloadTemplate("sales")}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-355 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Download Import Excel Template"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Template</span>
            </button>
          )}

          {/* Import Button */}
          {canImport && (
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </button>
          )}

          {/* History Button */}
          {canViewHistory && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              title="View Import/Export History Logs"
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
          )}

          {/* Export Dropdown */}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 min-w-[120px]">
                <DropdownMenuItem onClick={handleExportExcel} className="text-slate-300 focus:bg-slate-800 focus:text-white flex items-center gap-1.5 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  <span>Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="text-slate-300 focus:bg-slate-800 focus:text-white flex items-center gap-1.5 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span>CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="text-slate-300 focus:bg-slate-800 focus:text-white flex items-center gap-1.5 cursor-pointer">
                  <FileText className="h-4 w-4 text-red-400" />
                  <span>PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* New Sales Register Button */}
          <button
            onClick={() => router.push("/sales-registers/new")}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Sales Register
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: totalCount, icon: FileText, color: "text-blue-400" },
          { label: "Pending",  value: pendingCount,    icon: Filter,    color: "text-slate-400" },
          { label: "Completed", value: completedCount, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Total Value", value: formatINR(grandSum), icon: FileText, color: "text-primary", isStr: true },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <div className={`mb-1 ${kpi.color}`}>
              <kpi.icon className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold text-white">
              {kpi.isStr ? kpi.value : kpi.value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters Row ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search sales_register, company, mobile..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex overflow-x-auto gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {SALES_REGISTER_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatus(opt.value); setPage(1); }}
              className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                status === opt.value
                  ? "bg-primary text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50 text-xs uppercase tracking-wider text-slate-400">
                {[
                  { key: "entry_date",   label: "Date" },
                  { key: "sales_register_no", label: "SalesRegister No" },
                  { key: "company_name", label: "Company" },
                  { key: null,           label: "Contact" },
                  { key: "grand_total",  label: "Grand Total" },
                  { key: "status",       label: "Status" },
                  { key: null,           label: "Created By" },
                  { key: null,           label: "Actions" },
                ].map((col, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-left ${col.key ? "cursor-pointer hover:text-white select-none" : ""}`}
                    onClick={() => col.key && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.key && (
                        <ArrowUpDown className={`h-3 w-3 ${sortBy === col.key ? "text-primary" : "opacity-40"}`} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading salesRegisters...
                  </td>
                </tr>
              ) : salesRegisters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <FileText className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400 font-medium">No salesRegisters found</p>
                    <p className="text-slate-500 text-sm mt-1">
                      Create your first sales_register to get started
                    </p>
                    <button
                      onClick={() => router.push("/sales-registers/new")}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" /> New SalesRegister
                    </button>
                  </td>
                </tr>
              ) : (
                salesRegisters.map((q) => (
                  <tr
                    key={q.id}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    onClick={() => router.push(`/sales-registers/${q.id}`)}
                  >
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {q.entry_date}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-primary hover:underline">
                        {q.sales_register_no}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <p className="font-medium text-white">{q.company_name}</p>
                        {q.subject && (
                          <p className="text-xs text-slate-500 truncate max-w-[180px]">{q.subject}</p>
                        )}
                        {q.lead && (
                          <div className="mt-1">
                            <Link
                              href={`/leads/${q.lead.id}`}
                              className="inline-flex items-center gap-1 rounded bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400 hover:bg-violet-500/20 hover:text-white transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="h-1 w-1 rounded-full bg-violet-400 animate-pulse" />
                              Enquiry ({q.lead.platform})
                            </Link>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <p className="text-sm">{q.contact_person || "—"}</p>
                      <p className="text-xs text-slate-500">{q.mobile}</p>
                      {q.email && <p className="text-xs text-slate-500 truncate max-w-[140px]">{q.email}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                      {formatINR(Number(q.grand_total))}
                    </td>
                    <td className="px-4 py-3">
                      <SalesRegisterStatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {(q.creator as { full_name?: string } | null)?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <SalesRegisterActions
                        sales_register={q}
                        view="row"
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * LIMIT + 1}–
              {Math.min(page * LIMIT, data?.total ?? 0)} of {data?.total ?? 0}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded px-2.5 py-1 text-xs transition-colors ${
                      p === page
                        ? "bg-primary text-white"
                        : "text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      <ImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        module="sales"
        onImportCompleted={fetchData}
      />
      <ImportExportHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        module="sales"
      />
    </div>
  );
}
