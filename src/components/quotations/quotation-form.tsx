"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Save, Send,
  Building2, User, Phone, Mail, MapPin, FileText, Package, Calculator,
  Landmark, Info, Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { calcTotals, TAX_OPTIONS, formatINR } from "@/lib/quotation-utils";
import type { Quotation, QuotationItem, QuotationTaxType, CompanyBankAccount } from "@/types";
import { cn, safeUUID } from "@/lib/utils";

// ── Default Terms ─────────────────────────────────────────────
const DEFAULT_TERMS = `1) PRICES : Ex-works, Belgaum.
2) DELIVERY : 90 days after receipt of your confirm order and 100% Advance.
3) PACKING : Including.
4) TAXES : Extra at Actual ( GST No : 29AACFP6260H1Z3).
5) PAYMENT :
   1) 100% advance.
   2) Advance @ 50% along with purchase order. Balance against Proforma Invoice before delivery of inspection at our works.
6) TRANSPORTATION : Extra at Actual.
7) UNLOADING : Customer scope.
8) INSTALLATION : Rs.2000/- Per day/Per Person- (Travelling and accommodation is customer account - In Advance).
9) MATERIAL : Plumbing, Electrical, Civil Work material & Labour charges is Customer Scope.
10) INSURANCE : At our site at your cost.
11) VALIDITY : Our offer is valid for 30 days from this Date there after on our confirmation.
12) TERMS : As per general conditions of sale.
13) INSPECTION :
    a) Equipment can be visually inspected at our works prior to dispatch.
    b) Live trial charges will be extra at actual.
14) ROAD PERMIT : Please send ROAD PERMIT if applicable.`;

// ── Types ─────────────────────────────────────────────────────
interface ItemDraft {
  _key: string;
  product_name: string;
  description: string;
  hsn_code: string;
  uom: string;
  rate: string;
  quantity: string;
  image_url: string;
}

interface CompanySettings {
  company_name: string;
  bank_account_name: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_name: string;
  bank_ifsc: string;
  terms_and_conditions: string;
  gst_number: string;
  address: string;
  phone: string;
  email: string;
  quotation_terms_text?: string | null;
}

interface QuotationFormProps {
  initial?: Quotation | null;
  prefill?: Partial<{
    company_name: string;
    contact_person: string;
    mobile: string;
    alt_mobile: string;
    email: string;
    address: string;
    state: string;
    pincode: string;
    gst_no: string;
    source: string;
    lead_id: string;
    subject: string;
    product_name: string;
  }>;
  mode: "create" | "edit";
}

function makeItem(overrides: Partial<ItemDraft> = {}): ItemDraft {
  return {
    _key: safeUUID(),
    product_name: "",
    description: "",
    hsn_code: "",
    uom: "Pcs",
    rate: "",
    quantity: "1",
    image_url: "",
    ...overrides,
  };
}

// ── Section wrapper ───────────────────────────────────────────
function Section({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-5 pb-5 pt-1 space-y-4">{children}</div>}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors";

// ── Main Component ────────────────────────────────────────────
export function QuotationForm({ initial, prefill, mode }: QuotationFormProps) {
  const router = useRouter();
  const { accountId } = useAuth();
  const supabase = createClient();

  // Company settings (for bank, default terms, logo)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  // Open/closed section accordions
  const [openSections, setOpenSections] = useState({
    company: true,
    products: true,
    totals: true,
    terms: false,
    bank: false,
    manager: false,
  });

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Form state ────────────────────────────────────────────
  const [form, setForm] = useState({
    entry_date:     initial?.entry_date     ?? new Date().toISOString().split("T")[0],
    company_name:   initial?.company_name   ?? prefill?.company_name   ?? "",
    kind_attention: initial?.kind_attention ?? "",
    contact_person: initial?.contact_person ?? prefill?.contact_person ?? "",
    email:          initial?.email          ?? prefill?.email          ?? "",
    mobile:         initial?.mobile         ?? prefill?.mobile         ?? "",
    alt_mobile:     initial?.alt_mobile     ?? prefill?.alt_mobile     ?? "",
    address:        initial?.address        ?? prefill?.address        ?? "",
    state:          initial?.state          ?? prefill?.state          ?? "",
    pincode:        initial?.pincode        ?? prefill?.pincode        ?? "",
    gst_no:         initial?.gst_no         ?? prefill?.gst_no         ?? "",
    source:         initial?.source         ?? prefill?.source         ?? "",
    subject:        initial?.subject        ?? prefill?.subject        ?? "",
    valid_until:    initial?.valid_until    ?? "",
    lead_id:        initial?.lead_id        ?? prefill?.lead_id        ?? "",
    status:         initial?.status         ?? "draft",
    tax_type:       (initial?.tax_type      ?? "none") as QuotationTaxType,
    custom_tax_rate: String(initial?.custom_tax_rate ?? ""),
    manager_name:        initial?.manager_name        ?? initial?.company_details?.manager_name        ?? "",
    manager_designation: initial?.manager_designation ?? initial?.company_details?.manager_designation ?? "",
    bank_account_name:   initial?.bank_account_name   ?? "",
    bank_account_type:   initial?.bank_account_type   ?? "",
    bank_account_number: initial?.bank_account_number ?? "",
    bank_name:           initial?.bank_name           ?? "",
    bank_ifsc:           initial?.bank_ifsc           ?? "",
  });

  const [items, setItems] = useState<ItemDraft[]>(
    initial?.items?.length
      ? initial.items.map((it) => ({
          _key: it.id,
          product_name: it.product_name,
          description:  it.description ?? "",
          hsn_code:     it.hsn_code    ?? "",
          uom:          it.uom,
          rate:         String(it.rate),
          quantity:     String(it.quantity),
          image_url:    it.image_url   ?? "",
        }))
      : prefill?.product_name
        ? [makeItem({ product_name: prefill.product_name })]
        : [makeItem()]
  );

  const [termsText, setTermsText] = useState(
    initial?.terms?.terms_text ?? DEFAULT_TERMS
  );
  const [saving, setSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  // ── Load company settings ────────────────────────────────
  useEffect(() => {
    if (!accountId) return;
    
    // Load general company settings (for terms and manager details)
    supabase
      .from("company_settings")
      .select(
        "company_name,bank_account_name,bank_account_type,bank_account_number,bank_name,bank_ifsc,terms_and_conditions,gst_number,address,phone,email,manager_name,manager_designation,quotation_terms_text"
      )
      .eq("account_id", accountId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCompanySettings(data as CompanySettings);
          setForm((f) => ({
            ...f,
            manager_name:        f.manager_name        || data.manager_name        || "Darshan Ladi",
            manager_designation: f.manager_designation || data.manager_designation || "Manager",
          }));
          
          // Fetch terms directly from company settings as requested
          if (data.quotation_terms_text) {
            setTermsText(data.quotation_terms_text);
          } else if (data.terms_and_conditions) {
            setTermsText(data.terms_and_conditions);
          }
        }
      });

    // Load multiple bank accounts
    supabase
      .from("company_bank_accounts")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true })
      .then(({ data: bankData }) => {
        if (bankData) {
          const list = bankData as CompanyBankAccount[];
          setBankAccounts(list);
          
          if (mode === "create") {
            const defaultBank = list.find((b) => b.is_default) || list[0];
            if (defaultBank) {
              setSelectedBankId(defaultBank.id);
              setForm((f) => ({
                ...f,
                bank_account_name:   defaultBank.account_name,
                bank_account_type:   defaultBank.account_type,
                bank_account_number: defaultBank.account_number,
                bank_name:           defaultBank.bank_name,
                bank_ifsc:           defaultBank.bank_ifsc,
              }));
            }
          } else if (initial?.bank_account_number) {
            const match = list.find((b) => b.account_number === initial.bank_account_number);
            if (match) {
              setSelectedBankId(match.id);
            }
          }
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // ── Totals (derived) ─────────────────────────────────────
  const parsedItems = items.map((it) => ({
    rate: parseFloat(it.rate) || 0,
    quantity: parseFloat(it.quantity) || 0,
  }));
  const { basicTotal, taxAmount, grandTotal, amountWords } = calcTotals(
    parsedItems,
    form.tax_type,
    parseFloat(form.custom_tax_rate) || null
  );

  // ── Item helpers ─────────────────────────────────────────
  const addItem = () => setItems((prev) => [...prev, makeItem()]);

  const removeItem = (key: string) =>
    setItems((prev) => prev.filter((it) => it._key !== key));

  const updateItem = (key: string, field: keyof ItemDraft, value: string) =>
    setItems((prev) =>
      prev.map((it) => (it._key === key ? { ...it, [field]: value } : it))
    );

  const handleBankSelect = (bankId: string) => {
    setSelectedBankId(bankId);
    const selected = bankAccounts.find(b => b.id === bankId);
    if (selected) {
      setForm(prev => ({
        ...prev,
        bank_account_name: selected.account_name,
        bank_account_type: selected.account_type,
        bank_account_number: selected.account_number,
        bank_name: selected.bank_name,
        bank_ifsc: selected.bank_ifsc,
      }));
    } else {
      setForm(prev => ({
        ...prev,
        bank_account_name: "",
        bank_account_type: "",
        bank_account_number: "",
        bank_name: "",
        bank_ifsc: "",
      }));
    }
  };

  // ── Save ─────────────────────────────────────────────────
  const handleSave = useCallback(
    async (statusOverride?: string) => {
      if (!form.company_name.trim()) {
        toast.error("Company name is required");
        return;
      }
      if (!form.mobile.trim()) {
        toast.error("Mobile number is required");
        return;
      }
      if (!form.address.trim()) {
        toast.error("Address is required");
        return;
      }
      const hasValidItem = items.some(
        (it) => it.product_name.trim() && (parseFloat(it.rate) || 0) >= 0
      );
      if (!hasValidItem) {
        toast.error("Add at least one product");
        return;
      }

      setSaving(true);
      try {
        const payload = {
          ...form,
          status: statusOverride ?? form.status,
          custom_tax_rate: parseFloat(form.custom_tax_rate) || null,
          valid_until: form.valid_until || null,
          lead_id: form.lead_id || null,
          basic_total:  basicTotal,
          tax_amount:   taxAmount,
          grand_total:  grandTotal,
          amount_words: amountWords,
          bank_account_name:   form.bank_account_name   || null,
          bank_account_type:   form.bank_account_type   || null,
          bank_account_number: form.bank_account_number || null,
          bank_name:           form.bank_name           || null,
          bank_ifsc:           form.bank_ifsc           || null,
          items: items
            .filter((it) => it.product_name.trim())
            .map((it, idx) => ({
              position:     idx,
              product_name: it.product_name,
              description:  it.description || null,
              hsn_code:     it.hsn_code    || null,
              uom:          it.uom,
              rate:         parseFloat(it.rate) || 0,
              quantity:     parseFloat(it.quantity) || 1,
              image_url:    it.image_url   || null,
            })),
          terms_text: termsText,
        };

        const url   = mode === "create" ? "/api/quotations" : `/api/quotations/${initial!.id}`;
        const method = mode === "create" ? "POST" : "PATCH";

        const res  = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error ?? "Failed to save");

        // Save company settings manager info as well!
        if (accountId && (form.manager_name.trim() || form.manager_designation.trim())) {
          const { error: settingsErr } = await supabase
            .from("company_settings")
            .update({
              manager_name:        form.manager_name.trim()        || null,
              manager_designation: form.manager_designation.trim() || null,
            })
            .eq("account_id", accountId);

          if (settingsErr) {
            console.warn("Failed to update company_settings (likely due to RLS permissions for non-admin):", settingsErr.message);
          }
        }

        toast.success(mode === "create" ? "Quotation created!" : "Quotation updated!");
        router.push(`/quotations/${data.quotation.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSaving(false);
      }
    },
    [form, items, termsText, basicTotal, taxAmount, grandTotal, amountWords, companySettings, mode, initial, router]
  );

  return (
    <div className="space-y-4 pb-24">
      {/* ── Section: Company Details ─────────────────────── */}
      <Section
        icon={<Building2 className="h-4 w-4" />}
        title="Company & Customer Details"
        open={openSections.company}
        onToggle={() => toggleSection("company")}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Entry Date" required>
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="Valid Until">
            <input
              type="date"
              value={form.valid_until}
              onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="Source">
            <select
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className={inputCls}
            >
              <option value="">Select source</option>
              {["IndiaMART", "TradeIndia", "ExportersIndia", "WhatsApp", "Email", "Referral", "Walk-in", "Other"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Company Name" required>
          <input
            type="text"
            value={form.company_name}
            onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            placeholder="Customer Company Pvt. Ltd."
            className={inputCls}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind Attention">
            <input
              type="text"
              value={form.kind_attention}
              onChange={(e) => setForm((f) => ({ ...f, kind_attention: e.target.value }))}
              placeholder="Mr. / Ms."
              className={inputCls}
            />
          </Field>
          <Field label="Contact Person">
            <input
              type="text"
              value={form.contact_person}
              onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
              placeholder="Full name"
              className={inputCls}
            />
          </Field>
          <Field label="Mobile" required>
            <input
              type="tel"
              value={form.mobile}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              placeholder="+91 98765 43210"
              className={inputCls}
            />
          </Field>
          <Field label="Alternative Mobile">
            <input
              type="tel"
              value={form.alt_mobile}
              onChange={(e) => setForm((f) => ({ ...f, alt_mobile: e.target.value }))}
              placeholder="+91 11111 22222"
              className={inputCls}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="customer@example.com"
              className={inputCls}
            />
          </Field>
          <Field label="GST No">
            <input
              type="text"
              value={form.gst_no}
              onChange={(e) => setForm((f) => ({ ...f, gst_no: e.target.value.toUpperCase() }))}
              placeholder="22AAAAA0000A1Z5"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Address" required>
          <textarea
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            rows={3}
            placeholder="Complete billing/shipping address"
            className={cn(inputCls, "resize-none")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="State">
            <input
              type="text"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              placeholder="Maharashtra"
              className={inputCls}
            />
          </Field>
          <Field label="PIN Code">
            <input
              type="text"
              value={form.pincode}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
              placeholder="400001"
              className={inputCls}
            />
          </Field>
          <Field label="Subject">
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Quotation for industrial valves"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* ── Section: Products ────────────────────────────── */}
      <Section
        icon={<Package className="h-4 w-4" />}
        title="Product Details"
        open={openSections.products}
        onToggle={() => toggleSection("products")}
      >
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-slate-800 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3 text-left w-8">#</th>
                <th className="px-3 py-3 text-left min-w-[160px]">Product Name *</th>
                <th className="px-3 py-3 text-left min-w-[160px]">Description</th>
                <th className="px-3 py-3 text-left w-28">HSN Code</th>
                <th className="px-3 py-3 text-left w-20">UOM</th>
                <th className="px-3 py-3 text-right w-28">Rate (₹)</th>
                <th className="px-3 py-3 text-right w-24">Qty</th>
                <th className="px-3 py-3 text-right w-32">Amount (₹)</th>
                <th className="px-3 py-3 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item, idx) => {
                const amt = (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 0);
                return (
                  <tr key={item._key} className="bg-slate-900 hover:bg-slate-850">
                    <td className="px-3 py-2 text-slate-500 text-xs">{idx + 1}</td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={(e) => updateItem(item._key, "product_name", e.target.value)}
                        placeholder="Product / Service name"
                        className={cn(inputCls, "text-xs")}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(item._key, "description", e.target.value)}
                        placeholder="Specifications / grade..."
                        className={cn(inputCls, "text-xs")}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.hsn_code}
                        onChange={(e) => updateItem(item._key, "hsn_code", e.target.value)}
                        placeholder="HSN"
                        className={cn(inputCls, "text-xs")}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={item.uom}
                        onChange={(e) => updateItem(item._key, "uom", e.target.value)}
                        className={cn(inputCls, "text-xs")}
                      >
                        {["Pcs", "Nos", "Set", "Kg", "MT", "Ltr", "Box", "Bag", "Roll", "Mtr", "Sqmt", "Sqft", "Other"].map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => updateItem(item._key, "rate", e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className={cn(inputCls, "text-xs text-right")}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item._key, "quantity", e.target.value)}
                        placeholder="1"
                        min="0"
                        step="0.001"
                        className={cn(inputCls, "text-xs text-right")}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-white text-xs">
                      {formatINR(amt)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item._key)}
                        disabled={items.length === 1}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-2 rounded-lg border border-dashed border-slate-600 px-4 py-2.5 text-sm text-slate-400 hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add New Product
        </button>
      </Section>

      {/* ── Section: Totals ───────────────────────────────── */}
      <Section
        icon={<Calculator className="h-4 w-4" />}
        title="Totals & Tax"
        open={openSections.totals}
        onToggle={() => toggleSection("totals")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Field label="Tax Type">
              <select
                value={form.tax_type}
                onChange={(e) => setForm((f) => ({ ...f, tax_type: e.target.value as QuotationTaxType }))}
                className={inputCls}
              >
                {TAX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
            {form.tax_type === "custom" && (
              <Field label="Custom Tax Rate (%)">
                <input
                  type="number"
                  value={form.custom_tax_rate}
                  onChange={(e) => setForm((f) => ({ ...f, custom_tax_rate: e.target.value }))}
                  placeholder="18"
                  min="0"
                  max="100"
                  step="0.01"
                  className={inputCls}
                />
              </Field>
            )}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Basic Total</span>
              <span className="font-semibold text-white">{formatINR(basicTotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Tax Amount</span>
                <span className="font-semibold text-amber-400">{formatINR(taxAmount)}</span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-3 flex justify-between">
              <span className="font-bold text-white text-base">Grand Total</span>
              <span className="font-bold text-primary text-xl">{formatINR(grandTotal)}</span>
            </div>
            <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-400 italic leading-relaxed">
              {amountWords}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Section: Bank Details ─────────────────────────── */}
      <Section
        icon={<Landmark className="h-4 w-4" />}
        title="Bank Details"
        open={openSections.bank}
        onToggle={() => toggleSection("bank")}
      >
        {bankAccounts.length > 0 ? (
          <div className="space-y-4">
            <Field label="Select Bank Account">
              <select
                value={selectedBankId}
                onChange={(e) => handleBankSelect(e.target.value)}
                className={inputCls}
              >
                <option value="">Select a bank account</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} — {b.account_number} ({b.account_name}) {b.is_default ? "(Default)" : ""}
                  </option>
                ))}
              </select>
            </Field>

            {form.bank_account_number ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 grid gap-3 sm:grid-cols-2 text-sm">
                {[
                  ["Account Name",   form.bank_account_name],
                  ["Account Type",   form.bank_account_type],
                  ["Account Number", form.bank_account_number],
                  ["Bank Name",      form.bank_name],
                  ["IFSC Code",      form.bank_ifsc],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-medium text-white">{val || "—"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">
                Please select a bank account from the dropdown above.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Fallback to companySettings details if they exist but bankAccounts list is empty */}
            {companySettings?.bank_account_number ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-400 italic">
                  Note: Using single bank details from Company Settings. Set up multiple bank accounts under Settings to use the selector.
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 grid gap-3 sm:grid-cols-2 text-sm">
                  {[
                    ["Account Name",   form.bank_account_name || companySettings.bank_account_name],
                    ["Account Type",   form.bank_account_type || companySettings.bank_account_type],
                    ["Account Number", form.bank_account_number || companySettings.bank_account_number],
                    ["Bank Name",      form.bank_name || companySettings.bank_name],
                    ["IFSC Code",      form.bank_ifsc || companySettings.bank_ifsc],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="font-medium text-white">{val || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-300">
                  Bank details are not configured.{" "}
                  <a href="/settings?tab=general" className="underline hover:text-white">
                    Add them in Company Settings
                  </a>
                  {" "}to include them in the PDF.
                </p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Section: Manager Details ──────────────────────── */}
      <Section
        icon={<User className="h-4 w-4" />}
        title="Manager Details"
        open={openSections.manager}
        onToggle={() => toggleSection("manager")}
      >
        <p className="text-xs text-slate-500">
          Edit manager details below. These values are saved to Company Settings and printed on the quotation signature block.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Manager Name">
            <input
              type="text"
              value={form.manager_name}
              onChange={(e) => setForm((f) => ({ ...f, manager_name: e.target.value }))}
              placeholder="Darshan Ladi"
              className={inputCls}
            />
          </Field>
          <Field label="Manager Designation">
            <input
              type="text"
              value={form.manager_designation}
              onChange={(e) => setForm((f) => ({ ...f, manager_designation: e.target.value }))}
              placeholder="Manager"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* ── Sticky Action Bar ─────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between gap-4">
        <div className="text-sm text-slate-400">
          Grand Total:{" "}
          <span className="text-xl font-bold text-primary">{formatINR(grandTotal)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave("draft")}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave("sent")}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Save & Mark Sent
          </button>
        </div>
      </div>
    </div>
  );
}

// EOF comment to trigger Next.js compilation
