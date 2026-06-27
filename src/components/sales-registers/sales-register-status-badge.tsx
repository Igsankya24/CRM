"use client";

import { cn } from "@/lib/utils";
import type { SalesRegisterStatus } from "@/types";

const CONFIG: Record<SalesRegisterStatus, { label: string; classes: string }> = {
  pending:    { label: "Pending",    classes: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  processing: { label: "Processing", classes: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  completed:  { label: "Completed",  classes: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  cancelled:  { label: "Cancelled",  classes: "bg-red-500/15 text-red-300 border-red-500/30" },
  delivered:  { label: "Delivered",  classes: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
};

export function SalesRegisterStatusBadge({
  status,
  className,
}: {
  status: SalesRegisterStatus;
  className?: string;
}) {
  const cfg = CONFIG[status] ?? CONFIG.pending;
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

export const SALES_REGISTER_STATUS_OPTIONS: { value: SalesRegisterStatus | "all"; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "pending",    label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed",  label: "Completed" },
  { value: "cancelled",  label: "Cancelled" },
  { value: "delivered",  label: "Delivered" },
];
