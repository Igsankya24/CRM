"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Eye, Pencil, Printer, FileDown, MessageCircle, Mail, Trash2,
  MoreHorizontal, Loader2, CheckCircle2, XCircle,
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
import { QuotationPDFButton } from "./quotation-pdf";
import type { Quotation, QuotationStatus } from "@/types";
import { WhatsAppValidationDialog } from "../crm/whatsapp-validation-dialog";
import { useBranding } from "@/hooks/use-branding";

interface QuotationActionsProps {
  quotation: Quotation;
  view?: "row" | "detail";   // row = compact icon row, detail = full button bar
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: QuotationStatus) => void;
}

export function QuotationActions({
  quotation,
  view = "row",
  onDelete,
  onStatusChange,
}: QuotationActionsProps) {
  const router = useRouter();
  const { branding } = useBranding();
  const logoUrl = branding?.logo_url ?? null;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingWA, setSendingWA] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success("Quotation deleted");
      setConfirmDelete(false);
      onDelete?.(quotation.id);
      router.push("/quotations");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    const phone = quotation.mobile?.trim();
    if (!phone) {
      setValidationOpen(true);
      return;
    }
    router.push(
      `/inbox?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(
        quotation.contact_person || quotation.company_name || ""
      )}&docType=quotation&docId=${quotation.id}&docNo=${encodeURIComponent(quotation.quotation_no)}`
    );
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: quotation.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Email send failed");
      toast.success("Email sent!");
      onStatusChange?.(quotation.id, "sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Email send failed");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleStatusChange = async (status: QuotationStatus) => {
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success(`Status updated to ${status}`);
      onStatusChange?.(quotation.id, status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const btnBase =
    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors";

  if (view === "row") {
    return (
      <>
        <div className="flex items-center gap-1">
          {/* Edit */}
          <button
            title="Edit"
            onClick={() => router.push(`/quotations/${quotation.id}/edit`)}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-primary/15 hover:text-primary transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {/* PDF */}
          <QuotationPDFButton
            quotation={quotation}
            logoUrl={logoUrl}
            label=""
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors"
          />

          {/* More */}
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
              {quotation.status !== "accepted" && (
                <DropdownMenuItem onClick={() => handleStatusChange("accepted")}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Mark Accepted
                </DropdownMenuItem>
              )}
              {quotation.status !== "rejected" && (
                <DropdownMenuItem onClick={() => handleStatusChange("rejected")}>
                  <XCircle className="h-4 w-4 text-red-400" /> Mark Rejected
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
              <DialogTitle>Delete Quotation</DialogTitle>
              <DialogDescription>
                This will permanently delete quotation{" "}
                <strong>{quotation.quotation_no}</strong> for{" "}
                <strong>{quotation.company_name}</strong>. This cannot be undone.
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
        <WhatsAppValidationDialog
          open={validationOpen}
          onOpenChange={setValidationOpen}
          onEditCustomer={() => router.push(`/quotations/${quotation.id}/edit`)}
        />
      </>
    );
  }

  // ── Detail view — full action bar ──────────────────────────
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => router.push(`/quotations/${quotation.id}/edit`)}
          className={`${btnBase} border border-slate-700 text-slate-200 hover:bg-slate-800`}
        >
          <Pencil className="h-4 w-4" /> Edit
        </button>

        <button
          onClick={() => window.print()}
          className={`${btnBase} border border-slate-700 text-slate-200 hover:bg-slate-800`}
        >
          <Printer className="h-4 w-4" /> Print
        </button>

        <QuotationPDFButton
          quotation={quotation}
          logoUrl={logoUrl}
          label="Download PDF"
          className={`${btnBase} bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30`}
        />

        <button
          onClick={handleSendWhatsApp}
          disabled={sendingWA}
          className={`${btnBase} bg-green-600/20 border border-green-500/30 text-green-300 hover:bg-green-600/30 disabled:opacity-50`}
        >
          {sendingWA ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          WhatsApp
        </button>

        <button
          onClick={handleSendEmail}
          disabled={sendingEmail}
          className={`${btnBase} bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50`}
        >
          {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Email
        </button>

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
            <DialogTitle>Delete Quotation</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{quotation.quotation_no}</strong>? This cannot be undone.
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
      <WhatsAppValidationDialog
        open={validationOpen}
        onOpenChange={setValidationOpen}
        onEditCustomer={() => router.push(`/quotations/${quotation.id}/edit`)}
      />
    </>
  );
}
