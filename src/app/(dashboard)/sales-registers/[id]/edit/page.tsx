"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import Link from "next/link";
import { SalesRegisterForm } from "@/components/sales-registers/sales-register-form";
import type { SalesRegister } from "@/types";

export default function EditSalesRegisterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [sales_register, setSalesRegister] = useState<SalesRegister | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sales-registers/${id}`)
      .then((r) => r.json())
      .then((d) => setSalesRegister(d.sales_register))
      .catch(() => {
        toast.error("Failed to load sales_register");
        router.push("/sales-registers");
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

  if (!sales_register) return null;

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/sales-registers/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-white">
              Edit {sales_register.sales_register_no}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {sales_register.company_name}
          </p>
        </div>
      </div>

      {/* Form in edit mode */}
      <SalesRegisterForm mode="edit" initial={sales_register} />
    </div>
  );
}
