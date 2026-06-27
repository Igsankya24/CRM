"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SalesRegisterForm } from "@/components/sales-registers/sales-register-form";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

function NewSalesRegisterPageInner() {
  const sp = useSearchParams();

  const prefill = {
    company_name:   sp.get("company_name")   ?? undefined,
    contact_person: sp.get("contact_person") ?? undefined,
    mobile:         sp.get("mobile")         ?? undefined,
    alt_mobile:     sp.get("alt_mobile")     ?? undefined,
    email:          sp.get("email")          ?? undefined,
    address:        sp.get("address")        ?? undefined,
    state:          sp.get("state")          ?? undefined,
    gst_no:         sp.get("gst_no")         ?? undefined,
    source:         sp.get("source")         ?? undefined,
    lead_id:        sp.get("lead_id")        ?? undefined,
    subject:        sp.get("subject")        ?? undefined,
    product_name:   sp.get("product_name")   ?? undefined,
  };

  const hasLead = !!sp.get("lead_id");

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/sales-registers"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-white">New SalesRegister</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasLead
              ? `Pre-filled from lead · ${prefill.company_name || prefill.contact_person || "Lead"}`
              : "Fill in the details below — sales_register number will be auto-generated"}
          </p>
        </div>
      </div>

      {/* Form */}
      <SalesRegisterForm mode="create" prefill={prefill} />
    </div>
  );
}

export default function NewSalesRegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center bg-slate-950">
        <span className="text-sm text-slate-500">Loading form...</span>
      </div>
    }>
      <NewSalesRegisterPageInner />
    </Suspense>
  );
}
