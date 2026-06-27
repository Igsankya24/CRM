"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocInfo {
  id: string;
  no: string;
  status: string;
  active?: boolean;
}

interface DocumentRelationshipWidgetProps {
  quotation: DocInfo | null;
  proforma: DocInfo | null;
  salesRegister: DocInfo | null;
}

export function DocumentRelationshipWidget({
  quotation,
  proforma,
  salesRegister,
}: DocumentRelationshipWidgetProps) {
  const renderNode = (
    label: string,
    doc: DocInfo | null,
    hrefPrefix: string
  ) => {
    if (!doc) {
      return (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/20 px-3 py-2 text-slate-600">
          <FileText className="h-4 w-4 opacity-30" />
          <div className="text-left">
            <div className="text-[9px] uppercase tracking-wider font-semibold opacity-40">{label}</div>
            <div className="text-xs">Not Created</div>
          </div>
        </div>
      );
    }

    return (
      <Link
        href={`${hrefPrefix}/${doc.id}`}
        className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-2 transition-all",
          doc.active
            ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(59,130,246,0.1)]"
            : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800/40 hover:text-white"
        )}
      >
        <FileText className={cn("h-4 w-4", doc.active ? "text-primary" : "text-slate-400")} />
        <div className="text-left">
          <div className="text-[9px] uppercase tracking-wider font-semibold opacity-70">
            {label}
          </div>
          <div className="text-xs font-bold font-mono">{doc.no}</div>
        </div>
      </Link>
    );
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Document Relationships
      </h3>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {renderNode("Quotation", quotation, "/quotations")}
        <ArrowRight className="h-4 w-4 text-slate-700 flex-shrink-0" />
        {renderNode("Proforma", proforma, "/proformas")}
        <ArrowRight className="h-4 w-4 text-slate-700 flex-shrink-0" />
        {renderNode("Sales Register", salesRegister, "/sales-registers")}
      </div>
    </div>
  );
}
