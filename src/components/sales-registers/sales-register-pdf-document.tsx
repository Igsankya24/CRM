/**
 * SalesRegisterPDFDocument — Redesigned Phoenix Products format
 * Dynamic A4 PDF matching the reference design layout with boxed tables and signature/seal details.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { SalesRegister } from "@/types";
import { SharedDocumentHeader } from "../pdf/shared-document-header";
import { TAX_OPTIONS, getTaxRate } from "@/lib/quotation-utils";

// ── Helpers ───────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr) || /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr.replace(/-/g, "/");
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function formatNumberINR(val: number): string {
  return val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function taxLabel(taxType: string): string {
  const match = TAX_OPTIONS.find((o) => o.value === taxType);
  if (!match) return taxType;
  if (taxType === "igst_18") return "IGST @ 18%";
  if (taxType === "igst_12") return "IGST @ 12%";
  if (taxType === "igst_5")  return "IGST @ 5%";
  if (taxType === "gst_18")  return "GST @ 18%";
  if (taxType === "gst_12")  return "GST @ 12%";
  if (taxType === "gst_5")   return "GST @ 5%";
  if (taxType === "cgst_sgst_18") return "CGST 9% + SGST 9%";
  if (taxType === "cgst_sgst_12") return "CGST 6% + SGST 6%";
  if (taxType === "cgst_sgst_5")  return "CGST 2.5% + SGST 2.5%";
  return match.label;
}

// ── Styles ────────────────────────────────────────────────────

const BORDER_COLOR = "#000000";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#000000",
    paddingTop: 105,
    paddingBottom: 60,
    paddingHorizontal: 36,
    backgroundColor: "#ffffff",
  },

  // Boxed details grid
  detailsGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 8,
  },
  detailsLeft: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
  },
  detailsRight: {
    width: 240,
  },
  detailsRightRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    height: 20,
    alignItems: "center",
  },
  detailsRightRowLast: {
    flexDirection: "row",
    height: 20,
    alignItems: "center",
  },
  detailsRightLabel: {
    width: 80,
    paddingLeft: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
  },
  detailsRightValue: {
    flex: 1,
    paddingLeft: 6,
    fontSize: 7.5,
  },
  detailsRightHalfCol: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
  },

  // Table
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    alignItems: "center",
    height: 20,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    alignItems: "center",
    minHeight: 20,
  },
  tableRowLast: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 20,
  },
  th: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    padding: 2,
    textAlign: "center",
  },
  td: {
    fontSize: 7.5,
    padding: 2.5,
  },

  // Column widths
  colSr: { width: "4%", borderRightWidth: 1, borderRightColor: BORDER_COLOR, textAlign: "center" },
  colName: { width: "18%", borderRightWidth: 1, borderRightColor: BORDER_COLOR },
  colDesc: { width: "16%", borderRightWidth: 1, borderRightColor: BORDER_COLOR },
  colImage: { width: "8%", borderRightWidth: 1, borderRightColor: BORDER_COLOR, alignItems: "center", justifyContent: "center" },
  colHsn: { width: "8%", borderRightWidth: 1, borderRightColor: BORDER_COLOR, textAlign: "center" },
  colUom: { width: "6%", borderRightWidth: 1, borderRightColor: BORDER_COLOR, textAlign: "center" },
  colQty: { width: "5%", borderRightWidth: 1, borderRightColor: BORDER_COLOR, textAlign: "center" },
  colRate: { width: "8%", borderRightWidth: 1, borderRightColor: BORDER_COLOR, textAlign: "right" },
  colDiscount: { width: "5%", borderRightWidth: 1, borderRightColor: BORDER_COLOR, textAlign: "right" },
  colTax: { width: "5%", borderRightWidth: 1, borderRightColor: BORDER_COLOR, textAlign: "center" },
  colTaxAmt: { width: "8%", borderRightWidth: 1, borderRightColor: BORDER_COLOR, textAlign: "right" },
  colTotal: { width: "9%", textAlign: "right" },

  // Boxed sections (Terms, Bank, Signature)
  boxSection: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 6,
    marginBottom: 8,
  },
  boxTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
    marginBottom: 4,
  },

  // Signatures
  sigOuterBox: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    minHeight: 80,
    marginBottom: 8,
  },
  sigLeft: {
    flexDirection: "column",
    width: "60%",
  },
  sigRight: {
    flexDirection: "column",
    width: "40%",
    alignItems: "center",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    paddingTop: 4,
    alignItems: "center",
  },
  footerText: {
    fontSize: 7.5,
    textAlign: "center",
    color: "#000000",
  }
});

const FooterComponent = ({ cd }: { cd: any }) => {
  const footerText = cd?.footer_text || "Phoenix Products. All rights reserved. GSTIN: 29APLPK9053K1Z7. Address: D-88, Industrial Estate, Udyambag Belgaum-590008.";
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>
        {footerText}
      </Text>
      <Text style={[S.footerText, { marginTop: 2, fontFamily: "Helvetica-Bold" }]} render={({ pageNumber, totalPages }) => `Page {pageNumber} of {totalPages}`} />
    </View>
  );
};

// ── Main Document ─────────────────────────────────────────────

interface Props {
  salesRegister: SalesRegister;
  logoUrl: string | null;
  title?: string;
}

export function SalesRegisterPDFDocument({ salesRegister, logoUrl, title = "Sales Invoice" }: Props) {
  const items = salesRegister.items ?? [];
  const cd = salesRegister.company_details;

  // Use uploaded logo first, then branding logo
  const finalLogoUrl = salesRegister.company_logo_url || logoUrl || null;
  const logoAlignment = cd?.logo_alignment === "left" ? "left" : "right";

  // Terms text — prefer register-specific, then company default T&C
  const termsText = salesRegister.terms?.terms_text || cd?.sales_register_terms_text || "";
  const termsLines = termsText
    .split("\n")
    .map((l: string) => l.trimEnd())
    .filter((l: string) => l.trim().length > 0);

  // Bank details — prefer register fields, then company details
  const bankAccountName   = salesRegister.bank_account_name   || cd?.bank_account_name   || "";
  const bankAccountType   = salesRegister.bank_account_type   || cd?.bank_account_type   || "";
  const bankAccountNumber = salesRegister.bank_account_number || cd?.bank_account_number || "";
  const bankName          = salesRegister.bank_name           || cd?.bank_name           || "";
  const bankIfsc          = salesRegister.bank_ifsc           || cd?.bank_ifsc           || "";

  // Closing info
  const managerName   = salesRegister.manager_name  || cd?.manager_name        || "Darshan Ladi";
  const designation   = salesRegister.manager_designation || cd?.manager_designation || "Manager";
  const signatureUrl  = cd?.signature_url       || null;

  const hasBankDetails = bankAccountName || bankAccountNumber || bankName;

  return (
    <Document
      title={`${title} ${salesRegister.sales_register_no}`}
      author={cd?.company_name || "Phoenix Products"}
      subject={salesRegister.subject ?? title}
    >
      <Page size="A4" style={S.page} wrap={true}>
        <SharedDocumentHeader
          logoUrl={finalLogoUrl}
          companyName={cd?.company_name || "Phoenix Products"}
          title={title}
          isPdf
          documentType="sales_register"
          logoAlignment={logoAlignment}
          companyAddress={cd?.address}
          companyPhone={cd?.phone}
          companyGst={cd?.gst_number}
          companyEmail={cd?.email}
          companyWebsite={cd?.website}
        />

        {/* Boxed Customer & Document Details Section */}
        <View style={S.detailsGrid} wrap={false}>
          {/* Left Column: Billing Address */}
          <View style={S.detailsLeft}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5, marginBottom: 4 }}>Billing Address -</Text>
            <Text style={{ fontSize: 8, marginBottom: 2 }}>To,</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 2 }}>{salesRegister.company_name}</Text>
            {salesRegister.address ? <Text style={{ fontSize: 8, marginBottom: 2, lineHeight: 1.2 }}>{salesRegister.address}</Text> : null}
            {(salesRegister.state || salesRegister.pincode) ? (
              <Text style={{ fontSize: 8, marginBottom: 2 }}>
                {[salesRegister.state, salesRegister.pincode].filter(Boolean).join(", ")}
              </Text>
            ) : null}
            {salesRegister.mobile ? <Text style={{ fontSize: 8, marginBottom: 2 }}>Mob: {salesRegister.mobile}</Text> : null}
            {salesRegister.email ? <Text style={{ fontSize: 8 }}>Email: {salesRegister.email}</Text> : null}
          </View>

          {/* Right Column: Meta details */}
          <View style={S.detailsRight}>
            {/* Row 1: Sales Inv No + Date */}
            <View style={S.detailsRightRow}>
              <View style={S.detailsRightHalfCol}>
                <Text style={S.detailsRightLabel}>Sales Inv No</Text>
                <Text style={S.detailsRightValue}>{salesRegister.sales_register_no}</Text>
              </View>
              <View style={[S.detailsRightHalfCol, { borderLeftWidth: 1, borderLeftColor: BORDER_COLOR }]}>
                <Text style={S.detailsRightLabel}>Date</Text>
                <Text style={S.detailsRightValue}>{formatDate(salesRegister.entry_date)}</Text>
              </View>
            </View>

            {/* Row 2: Reference Number + Source */}
            <View style={S.detailsRightRow}>
              <View style={S.detailsRightHalfCol}>
                <Text style={S.detailsRightLabel}>Ref No</Text>
                <Text style={S.detailsRightValue}>{salesRegister.reference_number || "-"}</Text>
              </View>
              <View style={[S.detailsRightHalfCol, { borderLeftWidth: 1, borderLeftColor: BORDER_COLOR }]}>
                <Text style={S.detailsRightLabel}>Source</Text>
                <Text style={S.detailsRightValue}>{salesRegister.source || "-"}</Text>
              </View>
            </View>

            {/* Row 3: Our GST No */}
            <View style={S.detailsRightRow}>
              <Text style={S.detailsRightLabel}>Our GST No</Text>
              <Text style={S.detailsRightValue}>{cd?.gst_number || "29APLPK9053K1Z7"}</Text>
            </View>

            {/* Row 4: Party GST No */}
            <View style={S.detailsRightRowLast}>
              <Text style={S.detailsRightLabel}>Party GST No</Text>
              <Text style={S.detailsRightValue}>{salesRegister.gst_no || "-"}</Text>
            </View>
          </View>
        </View>

        {/* ── Product Table ─────────────────────────────────── */}
        <View style={S.table}>
          {/* Header Row */}
          <View style={S.tableHeader} fixed>
            <Text style={[S.th, S.colSr]}>S.No</Text>
            <Text style={[S.th, S.colName]}>Product Name</Text>
            <Text style={[S.th, S.colDesc]}>Description</Text>
            <Text style={[S.th, S.colImage]}>Image</Text>
            <Text style={[S.th, S.colHsn]}>HSN</Text>
            <Text style={[S.th, S.colUom]}>UOM</Text>
            <Text style={[S.th, S.colQty]}>Qty</Text>
            <Text style={[S.th, S.colRate]}>Rate</Text>
            <Text style={[S.th, S.colDiscount]}>Disc</Text>
            <Text style={[S.th, S.colTax]}>Tax %</Text>
            <Text style={[S.th, S.colTaxAmt]}>Tax Amt</Text>
            <Text style={[S.th, S.colTotal, { borderRightWidth: 0 }]}>Total</Text>
          </View>

          {/* Product Rows */}
          {items.map((item, idx) => {
            const taxRate = getTaxRate(salesRegister.tax_type, salesRegister.custom_tax_rate);
            const taxAmt = Math.round(item.amount * taxRate) / 100;
            const lineTotal = item.amount + taxAmt;
            const isLast = idx === items.length - 1;
            const rowStyle = isLast ? S.tableRowLast : S.tableRow;
            return (
              <View key={item.id || idx} style={rowStyle} wrap={false}>
                <Text style={[S.td, S.colSr]}>{idx + 1}</Text>
                <Text style={[S.td, S.colName, { fontFamily: "Helvetica-Bold" }]}>{item.product_name}</Text>
                <Text style={[S.td, S.colDesc, { color: "#333333", fontSize: 7 }]}>{item.description || "-"}</Text>
                <View style={[S.td, S.colImage]}>
                  {item.image_url ? (
                    <Image src={item.image_url} style={{ width: 18, height: 18, objectFit: "contain" }} />
                  ) : (
                    <Text style={{ fontSize: 6, color: "#666" }}>✕</Text>
                  )}
                </View>
                <Text style={[S.td, S.colHsn]}>{item.hsn_code || "-"}</Text>
                <Text style={[S.td, S.colUom]}>{item.uom}</Text>
                <Text style={[S.td, S.colQty]}>{Number(item.quantity)}</Text>
                <Text style={[S.td, S.colRate]}>{formatNumberINR(Number(item.rate))}</Text>
                <Text style={[S.td, S.colDiscount]}>0.00</Text>
                <Text style={[S.td, S.colTax]}>{taxRate}%</Text>
                <Text style={[S.td, S.colTaxAmt]}>{formatNumberINR(taxAmt)}</Text>
                <Text style={[S.td, S.colTotal, { borderRightWidth: 0 }]}>{formatNumberINR(lineTotal)}</Text>
              </View>
            );
          })}
        </View>

        {/* Totals Section */}
        <View style={{ width: "100%", alignItems: "flex-end", marginBottom: 8 }} wrap={false}>
          <View style={{ width: 240, borderWidth: 1, borderColor: BORDER_COLOR }}>
            {/* Sub Total */}
            <View style={[S.detailsRightRow, { height: 18, borderBottomWidth: 1 }]}>
              <Text style={[S.detailsRightLabel, { width: 120 }]}>Sub Total</Text>
              <Text style={[S.detailsRightValue, { textAlign: "right", paddingRight: 6 }]}>{formatNumberINR(Number(salesRegister.basic_total))}</Text>
            </View>

            {/* Discount */}
            <View style={[S.detailsRightRow, { height: 18, borderBottomWidth: 1 }]}>
              <Text style={[S.detailsRightLabel, { width: 120 }]}>Discount</Text>
              <Text style={[S.detailsRightValue, { textAlign: "right", paddingRight: 6 }]}>0.00</Text>
            </View>

            {/* Tax */}
            {salesRegister.tax_type !== "none" && (
              <View style={[S.detailsRightRow, { height: 18, borderBottomWidth: 1 }]}>
                <Text style={[S.detailsRightLabel, { width: 120 }]}>{taxLabel(salesRegister.tax_type)}</Text>
                <Text style={[S.detailsRightValue, { textAlign: "right", paddingRight: 6 }]}>{formatNumberINR(Number(salesRegister.tax_amount))}</Text>
              </View>
            )}

            {/* Transportation */}
            {Number(salesRegister.transportation_charges || 0) > 0 && (
              <View style={[S.detailsRightRow, { height: 18, borderBottomWidth: 1 }]}>
                <Text style={[S.detailsRightLabel, { width: 120 }]}>Transportation</Text>
                <Text style={[S.detailsRightValue, { textAlign: "right", paddingRight: 6 }]}>{formatNumberINR(Number(salesRegister.transportation_charges))}</Text>
              </View>
            )}

            {/* Packing Charges */}
            {Number(salesRegister.packing_charges || 0) > 0 && (
              <View style={[S.detailsRightRow, { height: 18, borderBottomWidth: 1 }]}>
                <Text style={[S.detailsRightLabel, { width: 120 }]}>Packing Charges</Text>
                <Text style={[S.detailsRightValue, { textAlign: "right", paddingRight: 6 }]}>{formatNumberINR(Number(salesRegister.packing_charges))}</Text>
              </View>
            )}

            {/* Other Charges */}
            {Number(salesRegister.other_charges || 0) > 0 && (
              <View style={[S.detailsRightRow, { height: 18, borderBottomWidth: 1 }]}>
                <Text style={[S.detailsRightLabel, { width: 120 }]}>Other Charges</Text>
                <Text style={[S.detailsRightValue, { textAlign: "right", paddingRight: 6 }]}>{formatNumberINR(Number(salesRegister.other_charges))}</Text>
              </View>
            )}

            {/* Grand Total */}
            <View style={[S.detailsRightRowLast, { height: 20, backgroundColor: "#e5e7eb" }]}>
              <Text style={[S.detailsRightLabel, { width: 120, fontSize: 8.5 }]}>Grand Total</Text>
              <Text style={[S.detailsRightValue, { textAlign: "right", paddingRight: 6, fontSize: 8.5, fontFamily: "Helvetica-Bold" }]}>
                ₹ {formatNumberINR(Number(salesRegister.grand_total))}
              </Text>
            </View>
          </View>
        </View>

        {/* Amount in words */}
        <View style={[S.boxSection, { marginBottom: 8 }]} wrap={false}>
          <Text style={{ fontSize: 7, color: "#555555", marginBottom: 2 }}>Amount in Words:</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{salesRegister.amount_words || ""}</Text>
        </View>

        {/* Terms & Conditions */}
        {termsLines.length > 0 ? (
          <View style={S.boxSection} wrap={false}>
            <Text style={S.boxTitle}>Terms & Conditions :</Text>
            {termsLines.map((line, i) => (
              <Text key={i} style={{ fontSize: 7, lineHeight: 1.25, marginBottom: 2 }}>{line}</Text>
            ))}
          </View>
        ) : null}

        {/* Bank Details */}
        {hasBankDetails ? (
          <View style={S.boxSection} wrap={false}>
            <Text style={S.boxTitle}>Our Bank Details :</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", fontSize: 7.5 }}>
              <View style={{ width: "50%", marginBottom: 3 }}><Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Account Name :</Text> {bankAccountName}</Text></View>
              <View style={{ width: "50%", marginBottom: 3 }}><Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Account Type :</Text> {bankAccountType}</Text></View>
              <View style={{ width: "50%", marginBottom: 3 }}><Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Account Number :</Text> {bankAccountNumber}</Text></View>
              <View style={{ width: "50%", marginBottom: 3 }}><Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Bank Name :</Text> {bankName}</Text></View>
              <View style={{ width: "50%" }}><Text><Text style={{ fontFamily: "Helvetica-Bold" }}>IFSC Code :</Text> {bankIfsc}</Text></View>
            </View>
          </View>
        ) : null}

        {/* Customer Notes */}
        {salesRegister.notes ? (
          <View style={S.boxSection} wrap={false}>
            <Text style={S.boxTitle}>Notes :</Text>
            <Text style={{ fontSize: 7.5, lineHeight: 1.25 }}>{salesRegister.notes}</Text>
          </View>
        ) : null}

        {/* Signatures & Seal Section */}
        <View style={S.sigOuterBox} wrap={false}>
          <View style={S.sigLeft}>
            <Text style={{ fontStyle: "italic", fontSize: 8, marginBottom: 6 }}>
              Assuring you our best services & looking forward to your valued order.
            </Text>
            <Text style={{ fontSize: 7.5, marginBottom: 12 }}>Thanking you,</Text>
            <Text style={{ fontSize: 7.5, marginBottom: 2 }}>Regards,</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{managerName}</Text>
            <Text style={{ fontSize: 7.5, color: "#555555" }}>{designation}</Text>
            <Text style={{ fontSize: 7.5, color: "#555555" }}>{cd?.company_name || "Phoenix Products"}</Text>
          </View>

          <View style={S.sigRight}>
            {/* Digital Signature / Seal */}
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", height: 40, marginBottom: 4 }}>
              {signatureUrl ? (
                <Image src={signatureUrl} style={{ width: 80, height: 35, objectFit: "contain" }} />
              ) : null}
              {cd?.seal_url ? (
                <Image src={cd.seal_url} style={{ width: 45, height: 35, objectFit: "contain" }} />
              ) : null}
            </View>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", borderTopWidth: 0.5, borderTopColor: "#555555", width: "100%", textAlign: "center", paddingTop: 2 }}>
              Authorized Signatory
            </Text>
          </View>
        </View>

        <FooterComponent cd={cd} />
      </Page>
    </Document>
  );
}
