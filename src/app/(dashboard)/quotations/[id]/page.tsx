"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { QuotationStatusBadge } from "@/components/quotations/quotation-status-badge";
import { QuotationActions } from "@/components/quotations/quotation-actions";
import { SharedDocumentHeader } from "@/components/pdf/shared-document-header";
import { TAX_OPTIONS } from "@/lib/quotation-utils";
import type { Quotation, QuotationStatus } from "@/types";
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

function QuotationFooter({ cd }: { cd: Quotation["company_details"] }) {
  const addressParts = [
    cd?.address,
    [cd?.city, cd?.state, cd?.pincode].filter(Boolean).join(" - "),
    cd?.country,
  ].filter(Boolean);
  const addressStr = addressParts.length
    ? addressParts.join(", ")
    : "D - 87, Industrial Estate, Near KPTCL sub station, Udyanbhag, Belgavi - Karnataka - 590008, India";
  const phone1 = cd?.phone || "+91 9448480724";
  const phone2 = cd?.alternate_phone || "+91 9449819832";
  const phoneStr = phone2 ? `${phone1}  |  ${phone2}` : phone1;
  const emailStr = cd?.email || "phoenix_bgm@hotmail.com";
  const webStr = cd?.website || "www.phoenixproducts.info";

  return (
    <div style={{
      position: "absolute",
      bottom: "14mm",
      left: "14mm",
      right: "14mm",
      borderTop: "0.5px solid #999",
      paddingTop: "6px",
      textAlign: "center",
      fontSize: "9pt",
      color: "#000",
    }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "4px", marginBottom: "3px" }}>
        <svg viewBox="0 0 24 24" style={{ width: "12px", height: "12px", fill: "#0066cc", display: "inline-block", marginRight: "3px" }}>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
        <span>{addressStr}</span>
      </div>
      <div style={{ marginBottom: "3px" }}>Phone : {phoneStr}</div>
      <div>
        E mail :{" "}
        <span>{emailStr}</span>
        {" | "}
        <strong style={{ fontWeight: "bold" }}>{webStr}</strong>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function ViewQuotationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setQuotation(data.quotation);
    } catch {
      toast.error("Failed to load quotation");
      router.push("/quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const [converting, setConverting] = useState(false);
  const { hasPermission } = usePermissions();
  const canConvert = hasPermission("quotation", "convert");

  const handleConvert = async () => {
    if (converting) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to convert");
      toast.success("Converted to Proforma Invoice!");
      router.push(`/proformas/${data.proforma.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  const handleStatusChange = (_: string, status: QuotationStatus) => {
    setQuotation((q) => (q ? { ...q, status } : q));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!quotation) return null;

  const items = quotation.items ?? [];
  const cd = quotation.company_details;
  const logoUrl = quotation.company_logo_url || null;
  const gstNo = cd?.gst_number || "29AACFP6260H1Z3";

  // Terms — prefer quotation-specific (snapshotted), then company default T&C
  const termsText = quotation.terms?.terms_text || cd?.quotation_terms_text || cd?.terms_and_conditions || "";
  const termsLines = termsText
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  // Bank details — prefer quotation fields (snapshotted), then company details
  const bankAccountName   = quotation.bank_account_name   || cd?.bank_account_name   || "";
  const bankAccountType   = quotation.bank_account_type   || cd?.bank_account_type   || "";
  const bankAccountNumber = quotation.bank_account_number || cd?.bank_account_number || "";
  const bankName          = quotation.bank_name           || cd?.bank_name           || "";
  const bankIfsc          = quotation.bank_ifsc           || cd?.bank_ifsc           || "";
  const hasBankDetails    = bankAccountName || bankAccountNumber || bankName;

  const managerName  = quotation.manager_name  || cd?.manager_name        || "Darshan Ladi";
  const designation  = quotation.manager_designation || cd?.manager_designation || "Manager";
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
            href="/quotations"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{quotation.quotation_no}</h1>
              <QuotationStatusBadge status={quotation.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {quotation.company_name} · {quotation.entry_date}
            </p>
          </div>
        </div>
        <QuotationActions
          quotation={quotation}
          view="detail"
          onDelete={() => router.push("/quotations")}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* ── Document Relationship Widget & Conversion ── */}
      <div className="px-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex-1">
          <DocumentRelationshipWidget
            quotation={{
              id: quotation.id,
              no: quotation.quotation_no,
              status: quotation.status,
              active: true,
            }}
            proforma={
              quotation.proforma
                ? {
                    id: quotation.proforma.id,
                    no: quotation.proforma.proforma_no,
                    status: quotation.proforma.status,
                  }
                : null
            }
            salesRegister={
              quotation.proforma?.sales_register
                ? {
                    id: quotation.proforma.sales_register.id,
                    no: quotation.proforma.sales_register.sales_register_no,
                    status: quotation.proforma.sales_register.status,
                  }
                : null
            }
          />
        </div>
        {canConvert && !quotation.proforma && (
          <div className="flex items-center">
            <button
              onClick={handleConvert}
              disabled={converting}
              className="w-full md:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-950/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {converting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                "Create Proforma Invoice"
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── A4 WYSIWYG Preview ───────────────────────────────────────── */}
      <div style={{ backgroundColor: "#e5e7eb", padding: "24px 0" }}>

        {/* ══════════════════ PAGE 1 ══════════════════ */}
        <A4Paper>
          {/* Header */}
          <SharedDocumentHeader
            logoUrl={logoUrl}
            companyName={cd?.company_name || "Phoenix Products"}
            title="Quotation"
          />

          {/* Date + Quote No */}
          <div style={{ textAlign: "right", marginBottom: "10px" }}>
            <div>Date : {formatDate(quotation.entry_date)}</div>
            <div>Quote No : {quotation.quotation_no}</div>
          </div>

          {/* Customer */}
          <div style={{ marginBottom: "8px" }}>
            <div>To,</div>
            <div style={{ fontWeight: "bold", fontSize: "9.5pt" }}>{quotation.company_name}</div>
            {quotation.address && <div>{quotation.address}</div>}
            {(quotation.state || quotation.pincode) && (
              <div>{[quotation.state, quotation.pincode].filter(Boolean).join(",")}</div>
            )}
            <div>
              Kind Attention :{" "}
              <strong>
                {quotation.kind_attention || quotation.contact_person || ""}
                {quotation.mobile ? `  [ ${quotation.mobile} ]` : ""}
              </strong>
            </div>
          </div>

          {/* Subject */}
          {quotation.subject && (
            <div style={{ marginBottom: "8px" }}>
              Subject : {(() => {
                let s = quotation.subject ?? "";
                if (s.toLowerCase().startsWith("quotation for")) s = s.substring("quotation for".length).trim();
                return `Quotation for ${s}`;
              })()}
            </div>
          )}

          {/* Salutation */}
          <div style={{ marginBottom: "10px", lineHeight: "1.6" }}>
            <div>Dear Sir,</div>
            <div>Thank you for your enquiry.</div>
            <div style={{ fontStyle: "italic" }}>We are pleased to quote for the same as under.</div>
          </div>

          {/* Product Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", marginBottom: "4px" }}>
            <thead>
              <tr style={{ backgroundColor: "#d4d4d4" }}>
                <th style={thStyle({ width: "5%",  textAlign: "center" })}>SI NO</th>
                <th style={thStyle({ width: "38%", textAlign: "left" })}>Description</th>
                <th style={thStyle({ width: "11%", textAlign: "center" })}>Product{"\n"}Image</th>
                <th style={thStyle({ width: "13%", textAlign: "center" })}>HSN / UOM</th>
                <th style={thStyle({ width: "13%", textAlign: "right" })}>Rate</th>
                <th style={thStyle({ width: "7%",  textAlign: "center" })}>Qty</th>
                <th style={thStyle({ width: "13%", textAlign: "right", borderRight: "0.5px solid #999" })}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td style={tdStyle({ textAlign: "center" })}>{idx + 1}</td>
                  <td style={tdStyle({})}>
                    <strong>{item.product_name}</strong>
                    {item.description && (
                      <div style={{ fontSize: "7.5pt", color: "#333", marginTop: "2px" }}>{item.description}</div>
                    )}
                  </td>
                  <td style={tdStyle({ textAlign: "center" })}>
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.product_name}
                        width={32} height={32}
                        style={{ objectFit: "contain", margin: "0 auto" }}
                        unoptimized
                      />
                    ) : (
                      <div style={{
                        width: "22px", height: "22px",
                        border: "0.5px solid #bbb",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        backgroundColor: "#f5f5f5", margin: "0 auto",
                        fontSize: "8pt", color: "#c00", fontWeight: "bold",
                      }}>✕</div>
                    )}
                  </td>
                  <td style={tdStyle({ textAlign: "center" })}>
                    {[item.hsn_code, item.uom].filter(Boolean).join(" / ")}
                  </td>
                  <td style={tdStyle({ textAlign: "right" })}>
                    {Number(item.rate).toLocaleString("en-IN")}
                  </td>
                  <td style={tdStyle({ textAlign: "center" })}>{Number(item.quantity)}</td>
                  <td style={{ ...tdStyle({ textAlign: "right" }), borderRight: "0.5px solid #999" }}>
                    {Number(item.amount).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", borderLeft: "0.5px solid #999", borderRight: "0.5px solid #999" }}>
            <tbody>
              {/* Basic Total */}
              <tr style={{ borderBottom: "0.5px solid #999" }}>
                <td style={{ width: "31%", padding: "3px 4px" }}></td>
                <td style={{ width: "53%", padding: "3px 4px", textAlign: "right", fontWeight: "bold", borderLeft: "0.5px solid #999", borderRight: "0.5px solid #999" }}>Basic Total</td>
                <td style={{ width: "16%", padding: "3px 6px", textAlign: "right" }}>
                  {Number(quotation.basic_total).toLocaleString("en-IN")}
                </td>
              </tr>
              {/* Tax */}
              {quotation.tax_type !== "none" && (
                <tr style={{ borderBottom: "0.5px solid #999" }}>
                  <td style={{ padding: "3px 4px" }}></td>
                  <td style={{ padding: "3px 4px", borderLeft: "0.5px solid #999", borderRight: "0.5px solid #999" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Tax Rate</span>
                      <strong>{taxLabelFn(quotation.tax_type)}</strong>
                    </div>
                  </td>
                  <td style={{ padding: "3px 6px", textAlign: "right" }}>
                    {Number(quotation.tax_amount).toLocaleString("en-IN")}
                  </td>
                </tr>
              )}
              {/* Grand Total */}
              <tr style={{ borderBottom: "0.5px solid #999", minHeight: "32px" }}>
                <td colSpan={1} style={{ padding: "4px", verticalAlign: "top" }}>
                  <div style={{ fontSize: "7pt", color: "#555", marginBottom: "1px" }}>Total in Words</div>
                  <div style={{ fontWeight: "bold" }}>{quotation.amount_words || ""}</div>
                </td>
                <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: "bold", verticalAlign: "middle", borderLeft: "0.5px solid #999", borderRight: "0.5px solid #999" }}>
                  Grand Total
                </td>
                <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: "bold", fontSize: "9.5pt", verticalAlign: "middle" }}>
                  {formatINR(Number(quotation.grand_total))}
                </td>
              </tr>
            </tbody>
          </table>

          {/* GST + Notice */}
          <div style={{ marginTop: "10px", fontSize: "9pt" }}>
            <div style={{ marginBottom: "4px" }}>
              Our GST No: <strong>{gstNo}</strong>
            </div>
            <div>Above quoted rates are subject to following terms:</div>
          </div>

          <QuotationFooter cd={cd} />
        </A4Paper>

        {/* ══════════════════ PAGE 2 — Terms ══════════════════ */}
        {termsLines.length > 0 && (
          <A4Paper>
            <SharedDocumentHeader
              logoUrl={logoUrl}
              companyName={cd?.company_name || "Phoenix Products"}
              title="Terms & Conditions"
            />
            <div>
              {termsLines.map((line, i) => renderTermLine(line, i))}
            </div>

            {/* Bank Details on this page */}
            {hasBankDetails && (
              <div style={{ marginTop: "12px" }}>
                <div style={{ fontSize: "8.5pt", fontWeight: "bold", marginBottom: "6px" }}>18) Our Bank Details :</div>
                <table style={{ width: "100%", borderCollapse: "collapse", border: "0.5px solid #bbb", fontSize: "8.5pt" }}>
                  <tbody>
                    {bankAccountName && (
                      <tr style={{ borderBottom: "0.5px solid #bbb" }}>
                        <td style={{ width: "25%", padding: "4px 8px", borderRight: "0.5px solid #bbb", fontWeight: "normal" }}>Account Name</td>
                        <td style={{ width: "75%", padding: "4px 8px" }}>: {bankAccountName}</td>
                      </tr>
                    )}
                    {bankAccountType && (
                      <tr style={{ borderBottom: "0.5px solid #bbb" }}>
                        <td style={{ width: "25%", padding: "4px 8px", borderRight: "0.5px solid #bbb", fontWeight: "normal" }}>Account Type</td>
                        <td style={{ width: "75%", padding: "4px 8px" }}>: {bankAccountType}</td>
                      </tr>
                    )}
                    {bankAccountNumber && (
                      <tr style={{ borderBottom: "0.5px solid #bbb" }}>
                        <td style={{ width: "25%", padding: "4px 8px", borderRight: "0.5px solid #bbb", fontWeight: "normal" }}>Account Number</td>
                        <td style={{ width: "75%", padding: "4px 8px" }}>: {bankAccountNumber}</td>
                      </tr>
                    )}
                    {bankName && (
                      <tr style={{ borderBottom: "0.5px solid #bbb" }}>
                        <td style={{ width: "25%", padding: "4px 8px", borderRight: "0.5px solid #bbb", fontWeight: "normal" }}>Bank Name</td>
                        <td style={{ width: "75%", padding: "4px 8px" }}>: {bankName}</td>
                      </tr>
                    )}
                    {bankIfsc && (
                      <tr>
                        <td style={{ width: "25%", padding: "4px 8px", borderRight: "0.5px solid #bbb", fontWeight: "normal" }}>IFSC / NEFT Code</td>
                        <td style={{ width: "75%", padding: "4px 8px" }}>: {bankIfsc}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {emailDetails && (
              <div style={{ display: "flex", gap: "3px", fontSize: "8.5pt", marginTop: "8px", marginBottom: "6px" }}>
                <strong>19) EMAIL DETAILS :</strong>
                <span>{emailDetails}</span>
              </div>
            )}
            {jurisdiction && (
              <div style={{ display: "flex", gap: "3px", fontSize: "8.5pt", marginBottom: "6px" }}>
                <strong>20) JURISDICTION :</strong>
                <span>{jurisdiction}</span>
              </div>
            )}
            {contactNos && (
              <div style={{ display: "flex", gap: "3px", fontSize: "8.5pt", marginBottom: "6px" }}>
                <strong>21) CONTACT NUMBERS :</strong>
                <span>{contactNos}</span>
              </div>
            )}

            {/* Closing & Signature Block */}
            <div style={{
              marginTop: "30px",
              pageBreakInside: "avoid",
            }}>
              <div style={{ fontSize: "8.5pt", lineHeight: "1.6", marginBottom: "10px" }}>
                We hope that the above offer is in line with your requirement. Awaiting your valued response at the earliest. Assuring you of our best services at all times.
              </div>
              <div style={{ fontSize: "9pt", marginBottom: "2px" }}>Thanking You</div>
              <div style={{ fontSize: "10pt", fontWeight: "bold", marginBottom: "20px" }}>
                For {cd?.company_name || "Phoenix Products"},
              </div>

              {signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signatureUrl} alt="Signature" style={{ height: "40px", width: "100px", objectFit: "contain", marginBottom: "4px" }} />
              ) : (
                <div style={{ height: "36px" }} />
              )}
              <div style={{ fontSize: "9pt", fontWeight: "bold" }}>{designation}</div>
              <div style={{ fontSize: "9pt" }}>{managerName}</div>
            </div>

            <QuotationFooter cd={cd} />
          </A4Paper>
        )}
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
