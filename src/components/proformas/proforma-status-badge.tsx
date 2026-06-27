"use client";

import { cn } from "@/lib/utils";
import type { ProformaStatus } from "@/types";

const CONFIG: Record<ProformaStatus, { label: string; classes: string }> = {
  draft:           { label: "Draft",           classes: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  issued:          { label: "Issued",          classes: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  waiting_payment: { label: "Waiting Payment", classes: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  partially_paid:  { label: "Partially Paid",  classes: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  paid:            { label: "Paid",            classes: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  cancelled:       { label: "Cancelled",       classes: "bg-red-500/15 text-red-300 border-red-500/30" },
};

export function ProformaStatusBadge({
  status,
  className,
}: {
  status: ProformaStatus;
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

export const PROFORMA_STATUS_OPTIONS: { value: ProformaStatus | "all"; label: string }[] = [
  { value: "all",             label: "All" },
  { value: "draft",           label: "Draft" },
  { value: "issued",          label: "Issued" },
  { value: "waiting_payment", label: "Waiting Payment" },
  { value: "partially_paid",  label: "Partially Paid" },
  { value: "paid",            label: "Paid" },
  { value: "cancelled",       label: "Cancelled" },
];
