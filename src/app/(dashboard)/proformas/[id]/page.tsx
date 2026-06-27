"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ProformaStatusBadge } from "@/components/proformas/proforma-status-badge";
import { ProformaActions } from "@/components/proformas/proforma-actions";
import { SharedDocumentHeader } from "@/components/pdf/shared-document-header";
import { TAX_OPTIONS, getTaxRate } from "@/lib/quotation-utils";
import type { Proforma, ProformaStatus } from "@/types";
import { DocumentRelationshipWidget } from "@/components/crm/document-relationship-widget";
import { usePermissions } from "@/hooks/use-permissions";

// ── Helpers ──────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
  } catch { return d; }
}

function formatINR(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function taxLabelFn(taxType: string): string {
  const match = TAX_OPTIONS.find((o) => o.value === taxType);
  if (!match) return taxType;
  if (taxType === "igst_18") return "IGST@18%";
  if (taxType === "igst_12") return "IGST@12%";
  if (taxType === "igst_5")  return "IGST@5%";
  if (taxType === "gst_18")  return "GST@18%";
  if (taxType === "gst_12")  return "GST@12%";
  if (taxType === "gst_5")   return "GST@5%";
  if (taxType === "cgst_sgst_18") return "CGST 9% + SGST 9%";
  if (taxType === "cgst_sgst_12") return "CGST 6% + SGST 6%";
  if (taxType === "cgst_sgst_5")  return "CGST 2.5% + SGST 2.5%";
  return match.label;
}

// ── A4 Paper Component ───────────────────────────────────────

interface PaperProps { children: React.ReactNode; className?: string; }
function A4Paper({ children, className = "" }: PaperProps) {
  return (
    <div
      className={`bg-white text-black shadow-2xl mx-auto print:shadow-none ${className}`}
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "12mm 14mm 35mm",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "9pt",
        lineHeight: "1.4",
        position: "relative",
        marginBottom: "12px",
        backgroundColor: "#ffffff",
        color: "#000000",
      }}
    >
      {children}
    </div>
  );
}

// Shared header component is used

// ── Footer ───────────────────────────────────────────────────

function ProformaFooter({ cd }: { cd: Proforma["company_details"] }) {
  const footerText = cd?.footer_text || "Phoenix Products. All rights reserved. GSTIN: 29APLPK9053K1Z7. Address: D-88, Industrial Estate, Udyambag Belgaum-590008.";
  return (
    <div style={{
      position: "absolute",
      bottom: "14mm",
      left: "14mm",
      right: "14mm",
      borderTop: "0.5px solid #000000",
      paddingTop: "6px",
      textAlign: "center",
      fontSize: "7.5pt",
      color: "#000000",
    }}>
      <div>{footerText}</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function ViewProformaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [proforma, setProforma] = useState<Proforma | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proformas/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setProforma(data.proforma);
    } catch {
      toast.error("Failed to load proforma");
      router.push("/proformas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const [converting, setConverting] = useState(false);
  const { hasPermission } = usePermissions();
  const canConvert = hasPermission("proforma", "convert");

  const handleConvert = async () => {
    if (converting) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/proformas/${id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to convert");
      if (data.alreadyExists) {
        toast.info(data.message || "This Proforma has already been converted to Sales Register.");
      } else {
        toast.success("Converted to Sales Register!");
      }
      router.push(`/sales-registers/${data.salesRegister.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  const handleStatusChange = (_: string, status: ProformaStatus) => {
    setProforma((q) => (q ? { ...q, status } : q));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!proforma) return null;

  const items = proforma.items ?? [];
  const cd = proforma.company_details;
  const logoUrl = proforma.company_logo_url || null;
  const gstNo = cd?.gst_number || "29AACFP6260H1Z3";

  // Terms — prefer proforma-specific (snapshotted), then company default T&C
  const termsText = proforma.terms?.terms_text || cd?.proforma_terms_text || "";
  const termsLines = termsText
    .split("\n")
    .map((l: string) => l.trimEnd())
    .filter((l: string) => l.trim().length > 0);

  // Bank details — prefer proforma fields (snapshotted), then company details
  const bankAccountName   = proforma.bank_account_name   || cd?.bank_account_name   || "";
  const bankAccountType   = proforma.bank_account_type   || cd?.bank_account_type   || "";
  const bankAccountNumber = proforma.bank_account_number || cd?.bank_account_number || "";
  const bankName          = proforma.bank_name           || cd?.bank_name           || "";
  const bankIfsc          = proforma.bank_ifsc           || cd?.bank_ifsc           || "";
  const hasBankDetails    = bankAccountName || bankAccountNumber || bankName;

  const managerName  = proforma.manager_name  || cd?.manager_name        || "Darshan Ladi";
  const designation  = proforma.manager_designation || cd?.manager_designation || "Manager";
  const contactNos   = cd?.contact_numbers     || "";
  const emailDetails = cd?.email_details       || "";
  const jurisdiction = cd?.jurisdiction        || "Belagavi Jurisdiction (Karnataka, India).";
  const signatureUrl = cd?.signature_url       || null;

  // ── Render term line ─────────────────────────────────────────
  const renderTermLine = (line: string, idx: number) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const isSubItem = line.startsWith("  ") || /^\s+[a-z]\)/.test(line);
    const numberedMatch = trimmed.match(/^(\d+\)\s*[A-Z &]+\s*:?)\s*(.*)/);
    const subItemMatch  = trimmed.match(/^([a-z]\))\s*(.*)/);

    const baseStyle: React.CSSProperties = {
      fontSize: "8.5pt",
      lineHeight: "1.5",
      marginBottom: "6px",
      marginTop: (!isSubItem && idx > 0) ? "15px" : "0px",
      color: "#000",
      display: "flex",
      alignItems: "flex-start",
      gap: "3px",
    };

    if (numberedMatch && !isSubItem) {
      const [, label, value] = numberedMatch;
      return (
        <div key={idx} style={baseStyle}>
          <span style={{ fontWeight: "bold", flexShrink: 0 }}>{label.trim()}</span>
          {value.trim() && <span> {value.trim()}</span>}
        </div>
      );
    }

    if (subItemMatch) {
      const [, bullet, value] = subItemMatch;
      return (
        <div key={idx} style={{ ...baseStyle, paddingLeft: "30px" }}>
          <span style={{ fontWeight: "bold", minWidth: "14px", flexShrink: 0 }}>{bullet}</span>
          <span>{value.trim()}</span>
        </div>
      );
    }

    return (
      <div key={idx} style={{ ...baseStyle, paddingLeft: isSubItem ? "30px" : "0" }}>
        <span>{trimmed}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── CRM Chrome Header ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 pt-2">
        <div className="flex items-center gap-3">
          <Link
            href="/proformas"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{proforma.proforma_no}</h1>
              <ProformaStatusBadge status={proforma.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {proforma.company_name} · {proforma.entry_date}
            </p>
          </div>
        </div>
        <ProformaActions
          proforma={proforma}
          view="detail"
          onDelete={() => router.push("/proformas")}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* ── Document Relationship Widget & Conversion ── */}
      <div className="px-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex-1">
          <DocumentRelationshipWidget
            quotation={
              proforma.parent_quotation
                ? {
                    id: proforma.parent_quotation.id,
                    no: proforma.parent_quotation.quotation_no,
                    status: proforma.parent_quotation.status,
                  }
                : null
            }
            proforma={{
              id: proforma.id,
              no: proforma.proforma_no,
              status: proforma.status,
              active: true,
            }}
            salesRegister={
              proforma.sales_register
                ? {
                    id: proforma.sales_register.id,
                    no: proforma.sales_register.sales_register_no,
                    status: proforma.sales_register.status,
                  }
                : null
            }
          />
        </div>
      </div>

      {/* ── A4 WYSIWYG Preview ───────────────────────────────────────── */}
      <div style={{ backgroundColor: "#e5e7eb", padding: "24px 0" }}>
        <A4Paper>
          {/* Header */}
          <SharedDocumentHeader
            logoUrl={logoUrl}
            companyName={cd?.company_name || "Phoenix Products"}
            title="Proforma Invoice"
            documentType="proforma"
            logoAlignment={cd?.logo_alignment === "left" ? "left" : "right"}
            companyAddress={cd?.address}
            companyPhone={cd?.phone}
            companyGst={cd?.gst_number}
            companyEmail={cd?.email}
            companyWebsite={cd?.website}
          />

          {/* Boxed Customer & Document Details Section */}
          <div className="flex border border-black mb-2 text-[8.5pt]">
            {/* Left Column: Billing Address */}
            <div className="flex-1 p-2 border-r border-black">
              <div className="font-bold mb-1">Billing Address -</div>
              <div className="mb-0.5">To,</div>
              <div className="font-bold text-[9pt] mb-0.5">{proforma.company_name}</div>
              {proforma.address && <div className="mb-0.5 whitespace-pre-wrap leading-tight">{proforma.address}</div>}
              {(proforma.state || proforma.pincode) && (
                <div className="mb-0.5">
                  {[proforma.state, proforma.pincode].filter(Boolean).join(", ")}
                </div>
              )}
              {proforma.mobile && <div className="mb-0.5">Mob: {proforma.mobile}</div>}
              {proforma.email && <div>Email: {proforma.email}</div>}
            </div>

            {/* Right Column: Meta details */}
            <div className="w-[240px] flex flex-col text-[7.5pt]">
              {/* Row 1: Pro Inv No + Date */}
              <div className="flex border-b border-black h-7 items-center">
                <div className="w-1/2 flex items-center border-r border-black h-full px-2">
                  <span className="font-bold w-[70px] shrink-0">Pro Inv No</span>
                  <span className="flex-1 pl-1 truncate">{proforma.proforma_no}</span>
                </div>
                <div className="w-1/2 flex items-center h-full px-2">
                  <span className="font-bold w-[35px] shrink-0">Date</span>
                  <span className="flex-1 pl-1 truncate">{formatDate(proforma.entry_date)}</span>
                </div>
              </div>

              {/* Row 2: Reference Number + Source */}
              <div className="flex border-b border-black h-7 items-center">
                <div className="w-1/2 flex items-center border-r border-black h-full px-2">
                  <span className="font-bold w-[70px] shrink-0">Ref No</span>
                  <span className="flex-1 pl-1 truncate">{proforma.reference_number || "-"}</span>
                </div>
                <div className="w-1/2 flex items-center h-full px-2">
                  <span className="font-bold w-[45px] shrink-0">Source</span>
                  <span className="flex-1 pl-1 truncate">{proforma.source || "-"}</span>
                </div>
              </div>

              {/* Row 3: Our GST No */}
              <div className="flex border-b border-black h-7 items-center px-2">
                <span className="font-bold w-[80px] shrink-0">Our GST No</span>
                <span className="flex-1 pl-1 truncate">{cd?.gst_number || "29APLPK9053K1Z7"}</span>
              </div>

              {/* Row 4: Party GST No */}
              <div className="flex h-7 items-center px-2">
                <span className="font-bold w-[80px] shrink-0">Party GST No</span>
                <span className="flex-1 pl-1 truncate">{proforma.gst_no || "-"}</span>
              </div>
            </div>
          </div>

          {/* Product Table */}
          <table className="w-full border-collapse border border-black mb-2 text-[8pt]">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-bold">
                <th className="border-r border-black p-1 text-center w-[4%]">S.No</th>
                <th className="border-r border-black p-1 text-left w-[18%]">Product Name</th>
                <th className="border-r border-black p-1 text-left w-[16%]">Description</th>
                <th className="border-r border-black p-1 text-center w-[8%]">Image</th>
                <th className="border-r border-black p-1 text-center w-[8%]">HSN</th>
                <th className="border-r border-black p-1 text-center w-[6%]">UOM</th>
                <th className="border-r border-black p-1 text-center w-[5%]">Qty</th>
                <th className="border-r border-black p-1 text-right w-[8%]">Rate</th>
                <th className="border-r border-black p-1 text-right w-[5%]">Disc</th>
                <th className="border-r border-black p-1 text-center w-[5%]">Tax %</th>
                <th className="border-r border-black p-1 text-right w-[8%]">Tax Amt</th>
                <th className="p-1 text-right w-[9%]">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const taxRate = getTaxRate(proforma.tax_type, proforma.custom_tax_rate);
                const taxAmt = Math.round(item.amount * taxRate) / 100;
                const lineTotal = item.amount + taxAmt;
                return (
                  <tr key={item.id || idx} className="border-b border-black last:border-b-0 text-[8pt]">
                    <td className="border-r border-black p-1 text-center">{idx + 1}</td>
                    <td className="border-r border-black p-1 font-bold">{item.product_name}</td>
                    <td className="border-r border-black p-1 text-[7pt] text-gray-700 whitespace-pre-wrap">{item.description || "-"}</td>
                    <td className="border-r border-black p-1 text-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} className="w-4 h-4 object-contain mx-auto" />
                      ) : (
                        <span className="text-[6.5pt] text-gray-400">✕</span>
                      )}
                    </td>
                    <td className="border-r border-black p-1 text-center">{item.hsn_code || "-"}</td>
                    <td className="border-r border-black p-1 text-center">{item.uom}</td>
                    <td className="border-r border-black p-1 text-center">{Number(item.quantity)}</td>
                    <td className="border-r border-black p-1 text-right">
                      {Number(item.rate).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border-r border-black p-1 text-right">0.00</td>
                    <td className="border-r border-black p-1 text-center">{taxRate}%</td>
                    <td className="border-r border-black p-1 text-right">
                      {taxAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-1 text-right">
                      {lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals Section */}
          <div className="w-full flex justify-end mb-2">
            <div className="w-[240px] border border-black text-[7.5pt]">
              {/* Sub Total */}
              <div className="flex border-b border-black h-6 items-center px-2">
                <span className="font-bold flex-1">Sub Total</span>
                <span className="w-[120px] text-right">{Number(proforma.basic_total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              {/* Discount */}
              <div className="flex border-b border-black h-6 items-center px-2">
                <span className="font-bold flex-1">Discount</span>
                <span className="w-[120px] text-right">0.00</span>
              </div>

              {/* Tax */}
              {proforma.tax_type !== "none" && (
                <div className="flex border-b border-black h-6 items-center px-2">
                  <span className="font-bold flex-1">{taxLabelFn(proforma.tax_type)}</span>
                  <span className="w-[120px] text-right">{Number(proforma.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Transportation */}
              {Number(proforma.transportation_charges || 0) > 0 && (
                <div className="flex border-b border-black h-6 items-center px-2">
                  <span className="font-bold flex-1">Transportation</span>
                  <span className="w-[120px] text-right">{Number(proforma.transportation_charges).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Packing Charges */}
              {Number(proforma.packing_charges || 0) > 0 && (
                <div className="flex border-b border-black h-6 items-center px-2">
                  <span className="font-bold flex-1">Packing Charges</span>
                  <span className="w-[120px] text-right">{Number(proforma.packing_charges).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Other Charges */}
              {Number(proforma.other_charges || 0) > 0 && (
                <div className="flex border-b border-black h-6 items-center px-2">
                  <span className="font-bold flex-1">Other Charges</span>
                  <span className="w-[120px] text-right">{Number(proforma.other_charges).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex bg-gray-100 h-7 items-center px-2 font-bold text-[8.5pt]">
                <span className="flex-1">Grand Total</span>
                <span className="w-[120px] text-right">{formatINR(Number(proforma.grand_total))}</span>
              </div>
            </div>
          </div>

          {/* Amount in words */}
          <div className="border border-black p-2 mb-2 text-[8pt]">
            <div className="text-[7pt] text-gray-500 mb-0.5">Amount in Words:</div>
            <div className="font-bold">{proforma.amount_words || ""}</div>
          </div>

          {/* Terms & Conditions */}
          {termsLines.length > 0 && (
            <div className="border border-black p-2 mb-2 text-[7.5pt]">
              <div className="font-bold text-[8pt] underline mb-1">Terms & Conditions :</div>
              {termsLines.map((line: string, i: number) => (
                <div key={i} className="text-[7pt] leading-tight mb-1">{line}</div>
              ))}
            </div>
          )}

          {/* Bank Details */}
          {hasBankDetails && (
            <div className="border border-black p-2 mb-2 text-[7.5pt]">
              <div className="font-bold text-[8pt] underline mb-1">Our Bank Details :</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[7pt]">
                {bankAccountName && (
                  <div><span className="font-bold">Account Name :</span> {bankAccountName}</div>
                )}
                {bankAccountType && (
                  <div><span className="font-bold">Account Type :</span> {bankAccountType}</div>
                )}
                {bankAccountNumber && (
                  <div><span className="font-bold">Account Number :</span> {bankAccountNumber}</div>
                )}
                {bankName && (
                  <div><span className="font-bold">Bank Name :</span> {bankName}</div>
                )}
                {bankIfsc && (
                  <div className="col-span-2"><span className="font-bold">IFSC Code :</span> {bankIfsc}</div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {proforma.notes && (
            <div className="border border-black p-2 mb-2 text-[7.5pt]">
              <div className="font-bold text-[8pt] underline mb-1">Notes :</div>
              <div className="text-[7pt] leading-tight whitespace-pre-wrap">{proforma.notes}</div>
            </div>
          )}

          {/* Signatures & Seal Section */}
          <div className="border border-black p-2 flex justify-between items-end min-h-[80px] mb-2 text-[8pt]">
            <div className="w-[60%] flex flex-col text-[7pt]">
              <div className="italic text-[7.5pt] mb-1">
                Assuring you our best services & looking forward to your valued order.
              </div>
              <div className="mb-2">Thanking you,</div>
              <div className="mb-0.5">Regards,</div>
              <div className="font-bold text-[7.5pt]">{managerName}</div>
              <div className="text-gray-500">{designation}</div>
              <div className="text-gray-500">{cd?.company_name || "Phoenix Products"}</div>
            </div>

            <div className="w-[40%] flex flex-col items-center">
              <div className="flex gap-2 items-center justify-center h-10 mb-1">
                {signatureUrl && (
                  <img src={signatureUrl} alt="Signature" className="w-20 h-9 object-contain" />
                )}
                {cd?.seal_url && (
                  <img src={cd.seal_url} alt="Seal" className="w-11 h-9 object-contain" />
                )}
              </div>
              <div className="text-[6.5pt] font-bold border-t border-gray-400 w-full text-center pt-0.5">
                Authorized Signatory
              </div>
            </div>
          </div>

          {/* Footer */}
          <ProformaFooter cd={cd} />
        </A4Paper>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

const BORDER = "0.5px solid #999";

function thStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: BORDER,
    borderRight: "none",
    padding: "4px 3px",
    fontWeight: "bold",
    fontSize: "8.5pt",
    whiteSpace: "pre-line",
    ...extra,
  };
}

function tdStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    borderBottom: BORDER,
    borderLeft: BORDER,
    padding: "4px 3px",
    verticalAlign: "middle",
    fontSize: "8.5pt",
    ...extra,
  };
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", fontSize: "8.5pt", marginBottom: "3px" }}>
      <span style={{ fontWeight: "bold", width: "95px", flexShrink: 0 }}>{label}</span>
      <span style={{ width: "10px" }}>:</span>
      <span>{value}</span>
    </div>
  );
}
