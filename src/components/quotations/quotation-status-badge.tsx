"use client";

import { cn } from "@/lib/utils";
import type { QuotationStatus } from "@/types";

const CONFIG: Record<QuotationStatus, { label: string; classes: string }> = {
  draft:    { label: "Draft",    classes: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  sent:     { label: "Sent",     classes: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  accepted: { label: "Accepted", classes: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  rejected: { label: "Rejected", classes: "bg-red-500/15 text-red-300 border-red-500/30" },
  expired:  { label: "Expired",  classes: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  cancelled: { label: "Cancelled", classes: "bg-red-500/15 text-red-300 border-red-500/30" },
};

export function QuotationStatusBadge({
  status,
  className,
}: {
  status: QuotationStatus;
  className?: string;
}) {
  const cfg = CONFIG[status] ?? CONFIG.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        cfg.classes,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}

export const QUOTATION_STATUS_OPTIONS: { value: QuotationStatus | "all"; label: string }[] = [
  { value: "all",      label: "All" },
  { value: "draft",    label: "Draft" },
  { value: "sent",     label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired",  label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];
