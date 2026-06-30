"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import Link from "next/link";
import { QuotationForm } from "@/components/quotations/quotation-form";
import type { Quotation } from "@/types";
import { isValidUUID } from "@/lib/utils";

export default function EditQuotationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isValidUUID(id)) {
      setLoading(false);
      setQuotation(null);
      return;
    }
    fetch(`/api/quotations/${id}`)
      .then((r) => r.json())
      .then((d) => setQuotation(d.quotation))
      .catch(() => {
        toast.error("Failed to load quotation");
        router.push("/quotations");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6 bg-slate-900 border border-slate-800 rounded-xl my-8 max-w-2xl mx-auto w-full select-none">
        <h2 className="text-xl font-semibold text-white mb-2">No Quotation Found</h2>
        <p className="text-sm text-slate-400 mb-6 max-w-md">
          The requested quotation could not be loaded. It may have been deleted, or the URL may be invalid.
        </p>
        <Link
          href="/quotations"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotation Register
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/quotations/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-white">
              Edit {quotation.quotation_no}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {quotation.company_name}
          </p>
        </div>
      </div>

      {/* Form in edit mode */}
      <QuotationForm mode="edit" initial={quotation} />
    </div>
  );
}
