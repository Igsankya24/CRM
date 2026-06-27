"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Eye, Pencil, Printer, FileDown, MessageCircle, Mail, Trash2,
  MoreHorizontal, Loader2, CheckCircle2, XCircle, Truck, CheckCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SalesRegisterPDFButton } from "./sales-register-pdf";
import type { SalesRegister, SalesRegisterStatus } from "@/types";
import { WhatsAppValidationDialog } from "../crm/whatsapp-validation-dialog";
import { useBranding } from "@/hooks/use-branding";

interface SalesRegisterActionsProps {
  sales_register: SalesRegister;
  view?: "row" | "detail";
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: SalesRegisterStatus) => void;
}

export function SalesRegisterActions({
  sales_register,
  view = "row",
  onDelete,
  onStatusChange,
}: SalesRegisterActionsProps) {
  const router = useRouter();
  const { branding } = useBranding();
  const logoUrl = branding?.logo_url ?? null;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingWA, setSendingWA] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);

  // Dispatch details state
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [courier, setCourier] = useState(sales_register.dispatch_courier || "");
  const [trackingNo, setTrackingNo] = useState(sales_register.dispatch_tracking_no || "");
  const [dispatchDate, setDispatchDate] = useState(sales_register.dispatch_date || "");
  const [savingDispatch, setSavingDispatch] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sales-registers/${sales_register.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success("Sales Register deleted");
      setConfirmDelete(false);
      onDelete?.(sales_register.id);
      router.push("/sales-registers");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    const phone = sales_register.mobile?.trim();
    if (!phone) {
      setValidationOpen(true);
      return;
    }
    router.push(
      `/inbox?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(
        sales_register.contact_person || sales_register.company_name || ""
      )}&docType=sales&docId=${sales_register.id}&docNo=${encodeURIComponent(sales_register.sales_register_no)}`
    );
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/sales-registers/${sales_register.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sales_register.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Email send failed");
      toast.success("Email sent!");
      onStatusChange?.(sales_register.id, "processing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Email send failed");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleStatusChange = async (status: SalesRegisterStatus) => {
    try {
      const res = await fetch(`/api/sales-registers/${sales_register.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success(`Status updated to ${status}`);
      onStatusChange?.(sales_register.id, status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleDispatchSave = async () => {
    setSavingDispatch(true);
    try {
      const res = await fetch(`/api/sales-registers/${sales_register.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispatch_courier: courier,
          dispatch_tracking_no: trackingNo,
          dispatch_date: dispatchDate || null,
          status: "delivered",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success("Dispatch details updated & status set to Delivered");
      onStatusChange?.(sales_register.id, "delivered");
      setDispatchOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update dispatch");
    } finally {
      setSavingDispatch(false);
    }
  };

  const btnBase =
    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors";

  if (view === "row") {
    return (
      <>
        <div className="flex items-center gap-1">
          <button
            title="Edit"
            onClick={() => router.push(`/sales-registers/${sales_register.id}/edit`)}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-primary/15 hover:text-primary transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <SalesRegisterPDFButton
            sales_register={sales_register}
            logoUrl={logoUrl}
            label=""
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors"
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              title="More actions"
              className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSendWhatsApp} disabled={sendingWA}>
                {sendingWA ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Send WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSendEmail} disabled={sendingEmail}>
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDispatchOpen(true)}>
                <Truck className="h-4 w-4 text-amber-400" /> Dispatch Details
              </DropdownMenuItem>
              {sales_register.status !== "completed" && (
                <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
                  <CheckCircle className="h-4 w-4 text-emerald-400" /> Complete Order
                </DropdownMenuItem>
              )}
              {sales_register.status !== "cancelled" && (
                <DropdownMenuItem onClick={() => handleStatusChange("cancelled")}>
                  <XCircle className="h-4 w-4 text-red-400" /> Cancel Order
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Delete confirmation */}
        <Dialog open={confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Sales Register</DialogTitle>
              <DialogDescription>
                Permanently delete <strong>{sales_register.sales_register_no}</strong>? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className={`${btnBase} border border-slate-700 text-slate-300 hover:bg-slate-800`}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`${btnBase} bg-red-600 text-white hover:bg-red-500`}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dispatch & Tracking Dialog */}
        <Dialog open={dispatchOpen} onOpenChange={(v) => !v && setDispatchOpen(false)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Dispatch & Tracking Details</DialogTitle>
              <DialogDescription>
                Enter shipment details for this order. Saving will automatically set status to Delivered.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 text-slate-300">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Courier / Transport Name</label>
                <input
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  placeholder="e.g. Professional Couriers, VRL"
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Tracking Number / LR Number</label>
                <input
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  placeholder="e.g. TRK123456789"
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Dispatch Date</label>
                <input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <DialogFooter>
              <button
                onClick={() => setDispatchOpen(false)}
                disabled={savingDispatch}
                className={`${btnBase} border border-slate-700 text-slate-300 hover:bg-slate-800`}
              >
                Cancel
              </button>
              <button
                onClick={handleDispatchSave}
                disabled={savingDispatch}
                className={`${btnBase} bg-amber-600 text-white hover:bg-amber-500`}
              >
                {savingDispatch ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Dispatch"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <WhatsAppValidationDialog
          open={validationOpen}
          onOpenChange={setValidationOpen}
          onEditCustomer={() => router.push(`/sales-registers/${sales_register.id}/edit`)}
        />
      </>
    );
  }

  // ── Detail view — full action bar ──────────────────────────
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Edit */}
        <button
          onClick={() => router.push(`/sales-registers/${sales_register.id}/edit`)}
          className={`${btnBase} border border-slate-700 text-slate-200 hover:bg-slate-800`}
        >
          <Pencil className="h-4 w-4" /> Edit
        </button>

        {/* Print */}
        <button
          onClick={() => window.print()}
          className={`${btnBase} border border-slate-700 text-slate-200 hover:bg-slate-800`}
        >
          <Printer className="h-4 w-4" /> Print
        </button>

        {/* Download PDF */}
        <SalesRegisterPDFButton
          sales_register={sales_register}
          logoUrl={logoUrl}
          title="Sales Invoice"
          label="Download PDF"
          className={`${btnBase} bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30`}
        />

        {/* WhatsApp */}
        <button
          onClick={handleSendWhatsApp}
          disabled={sendingWA}
          className={`${btnBase} bg-green-600/20 border border-green-500/30 text-green-300 hover:bg-green-600/30 disabled:opacity-50`}
        >
          {sendingWA ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          WhatsApp
        </button>

        {/* Email */}
        <button
          onClick={handleSendEmail}
          disabled={sendingEmail}
          className={`${btnBase} bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50`}
        >
          {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Email
        </button>

        {/* Create Delivery Challan */}
        <SalesRegisterPDFButton
          sales_register={sales_register}
          logoUrl={logoUrl}
          title="Delivery Challan"
          label="Create Delivery Challan"
          className={`${btnBase} bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30`}
        />

        {/* Create Tax Invoice */}
        <SalesRegisterPDFButton
          sales_register={sales_register}
          logoUrl={logoUrl}
          title="Tax Invoice"
          label="Create Tax Invoice"
          className={`${btnBase} bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30`}
        />

        {/* Record Payment */}
        {sales_register.status !== "completed" && (
          <button
            onClick={() => handleStatusChange("completed")}
            className={`${btnBase} bg-teal-600/20 border border-teal-500/30 text-teal-300 hover:bg-teal-600/30`}
          >
            <CheckCircle className="h-4 w-4" /> Record Payment
          </button>
        )}

        {/* Dispatch */}
        <button
          onClick={() => setDispatchOpen(true)}
          className={`${btnBase} bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30`}
        >
          <Truck className="h-4 w-4" /> Dispatch
        </button>

        {/* Delete */}
        <button
          onClick={() => setConfirmDelete(true)}
          className={`${btnBase} bg-red-600/15 border border-red-500/30 text-red-300 hover:bg-red-600/25`}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sales Register</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{sales_register.sales_register_no}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className={`${btnBase} border border-slate-700 text-slate-300 hover:bg-slate-800`}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`${btnBase} bg-red-600 text-white hover:bg-red-500`}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch & Tracking Dialog */}
      <Dialog open={dispatchOpen} onOpenChange={(v) => !v && setDispatchOpen(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Dispatch &amp; Tracking Details</DialogTitle>
            <DialogDescription>
              Enter shipment details for this order. Saving will automatically set status to Delivered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-slate-300">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Courier / Transport Name</label>
              <input
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                placeholder="e.g. Professional Couriers, VRL"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Tracking Number / LR Number</label>
              <input
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                placeholder="e.g. TRK123456789"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Dispatch Date</label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setDispatchOpen(false)}
              disabled={savingDispatch}
              className={`${btnBase} border border-slate-700 text-slate-300 hover:bg-slate-800`}
            >
              Cancel
            </button>
            <button
              onClick={handleDispatchSave}
              disabled={savingDispatch}
              className={`${btnBase} bg-amber-600 text-white hover:bg-amber-500`}
            >
              {savingDispatch ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Dispatch"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <WhatsAppValidationDialog
        open={validationOpen}
        onOpenChange={setValidationOpen}
        onEditCustomer={() => router.push(`/sales-registers/${sales_register.id}/edit`)}
      />
    </>
  );
}
