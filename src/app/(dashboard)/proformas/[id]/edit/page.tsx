"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ProformaForm } from "@/components/proformas/proforma-form";
import type { Proforma } from "@/types";

export default function EditProformaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [proforma, setProforma] = useState<Proforma | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/proformas/${id}`)
      .then((r) => r.json())
      .then((d) => setProforma(d.proforma))
      .catch(() => {
        toast.error("Failed to load proforma");
        router.push("/proformas");
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

  if (!proforma) return null;

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/proformas/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-white">
              Edit {proforma.proforma_no}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {proforma.company_name}
          </p>
        </div>
      </div>

      {/* Form in edit mode */}
      <ProformaForm mode="edit" initial={proforma} />
    </div>
  );
}
