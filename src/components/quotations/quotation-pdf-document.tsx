/**
 * QuotationPDFDocument — Phoenix Products format
 * 3-page A4 PDF matching the uploaded reference screenshots exactly.
 * Kept in a separate file so it can be dynamically imported only when needed.
 * This file should NOT be imported at the top level of any component.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Path,
} from "@react-pdf/renderer";
import type { Quotation } from "@/types";
import { SharedDocumentHeader } from "../pdf/shared-document-header";
import { TAX_OPTIONS } from "@/lib/quotation-utils";

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
  const rounded = Math.round(val);
  if (Math.abs(val - rounded) < 0.01) {
    return rounded.toLocaleString("en-IN");
  }
  return val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function taxLabel(taxType: string): string {
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

// ── SVG Icon ──────────────────────────────────────────────────

const LocationPin = () => (
  <Svg viewBox="0 0 24 24" style={{ width: 9, height: 9, marginRight: 3 }}>
    <Path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
      fill="#0066cc"
    />
  </Svg>
);

// ── Styles ────────────────────────────────────────────────────

const BORDER_COLOR = "#999";
const HEADER_BG = "#d4d4d4";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#000000",
    paddingTop: 125,
    paddingBottom: 95,
    paddingHorizontal: 36,
    backgroundColor: "#ffffff",
  },

  // Header (fixed, every page)
  header: {
    position: "absolute",
    top: 24,
    left: 36,
    right: 36,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  logoLeft: {
    flexDirection: "column",
    alignItems: "flex-start",
    width: "60%",
  },
  logoRight: {
    width: "40%",
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  logoImg: {
    height: 65,
    objectFit: "contain",
    objectPositionX: "left",
    objectPositionY: "top",
  },
  logoRightImg: {
    height: 90,
    width: 150,
    objectFit: "contain",
  },
  phoenixTextBig: {
    fontSize: 34,
    fontFamily: "Helvetica-BoldOblique",
    color: "#0066cc",
    lineHeight: 1.0,
  },
  phoenixTextSmall: {
    fontSize: 34,
    fontFamily: "Helvetica-BoldOblique",
    color: "#0066cc",
    marginLeft: 150,
    lineHeight: 1.0,
  },
  headerRule: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#aaaaaa",
    marginTop: 8,
  },

  // Footer (fixed, every page)
  footer: {
    position: "absolute",
    bottom: 10,
    left: 36,
    right: 36,
  },
  footerRule: {
    borderTopWidth: 0.5,
    borderTopColor: "#999",
    marginBottom: 4,
  },
  footerLine: {
    fontSize: 9,
    color: "#000",
    textAlign: "center",
    lineHeight: 1.4,
  },
  footerLineRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 1,
  },

  // Page 1 — Title
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: "#000000",
    marginBottom: 6,
    marginTop: 2,
  },

  // Customer block
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  toBlock: { width: "65%" },
  metaBlock: { width: "33%", alignItems: "flex-end" },
  toLabel: { fontSize: 9, marginBottom: 2 },
  companyNameBold: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  addressLine: { fontSize: 9, lineHeight: 1.3, marginBottom: 1 },
  kindAttn: { fontSize: 9, marginTop: 3 },
  subjectLine: { fontSize: 9, marginTop: 8, marginBottom: 8 },
  salutation: { fontSize: 9, lineHeight: 1.5, marginBottom: 8 },

  // Product Table
  table: { marginTop: 4, marginBottom: 4 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: BORDER_COLOR,
    minHeight: 24,
    alignItems: "stretch",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: BORDER_COLOR,
  },
  thCell: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#000",
    paddingHorizontal: 3,
    paddingVertical: 4,
  },
  tdCell: {
    fontSize: 8.5,
    color: "#000",
    paddingHorizontal: 3,
    paddingVertical: 4,
  },
  // Column widths (total = 100%)
  colSr:   { width: "5%",  borderRightWidth: 0.5, borderColor: BORDER_COLOR, alignItems: "center", justifyContent: "center" },
  colDesc: { width: "38%", borderRightWidth: 0.5, borderColor: BORDER_COLOR },
  colImg:  { width: "11%", borderRightWidth: 0.5, borderColor: BORDER_COLOR, alignItems: "center", justifyContent: "center" },
  colHsn:  { width: "13%", borderRightWidth: 0.5, borderColor: BORDER_COLOR, alignItems: "center", justifyContent: "center" },
  colRate: { width: "13%", borderRightWidth: 0.5, borderColor: BORDER_COLOR, alignItems: "flex-end", justifyContent: "center" },
  colQty:  { width: "7%",  borderRightWidth: 0.5, borderColor: BORDER_COLOR, alignItems: "center", justifyContent: "center" },
  colAmt:  { width: "13%", alignItems: "flex-end", justifyContent: "center" },

  // Totals
  totalsRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: BORDER_COLOR,
    minHeight: 20,
    alignItems: "center",
  },
  totalLabelCell: {
    width: "53%",
    borderRightWidth: 0.5,
    borderColor: BORDER_COLOR,
    paddingHorizontal: 4,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  totalValueCell: {
    width: "16%",
    paddingHorizontal: 4,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  grandTotalWordsCell: {
    width: "53%",
    borderRightWidth: 0.5,
    borderColor: BORDER_COLOR,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  grandTotalLabelCell: {
    width: "16%",
    borderRightWidth: 0.5,
    borderColor: BORDER_COLOR,
    paddingHorizontal: 4,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  grandTotalValueCell: {
    width: "16%",
    paddingHorizontal: 4,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  // spacer at left
  totalsLeftSpacer: { width: "31%" },

  // Terms page
  termsTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    color: "#000",
  },
  termRow: {
    flexDirection: "row",
    marginBottom: 7,
    alignItems: "flex-start",
  },
  termLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#000",
    marginRight: 2,
    minWidth: 0,
    flexShrink: 0,
  },
  termValue: {
    fontSize: 8.5,
    color: "#000",
    lineHeight: 1.5,
    flex: 1,
  },
  termSubRow: {
    flexDirection: "row",
    marginBottom: 3,
    alignItems: "flex-start",
    paddingLeft: 16,
  },

  // Bank details table
  bankTable: {
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: "#bbb",
  },
  bankRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#bbb",
    alignItems: "center",
    minHeight: 18,
  },
  bankRowLast: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 18,
  },
  bankLabelCell: {
    width: "25%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRightWidth: 0.5,
    borderColor: "#bbb",
  },
  bankValueCell: {
    width: "75%",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bankLabelText: {
    fontSize: 8.5,
    color: "#000",
  },
  bankValueText: {
    fontSize: 8.5,
    color: "#000",
  },

  // Closing
  closingPara: { fontSize: 8.5, lineHeight: 1.5, marginTop: 10, marginBottom: 8 },
  thankingYou: { fontSize: 9, marginBottom: 2 },
  forCompany: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 16 },
  designation: { fontSize: 9 },
  managerName: { fontSize: 9 },
});

// Shared header component is used

// ── Footer component ──────────────────────────────────────────

interface FooterProps {
  companyDetails: Quotation["company_details"];
}

const FooterComponent = ({ companyDetails }: FooterProps) => {
  const addressParts = [
    companyDetails?.address,
    [companyDetails?.city, companyDetails?.state, companyDetails?.pincode].filter(Boolean).join(" - "),
    companyDetails?.country,
  ].filter(Boolean);
  const addressStr = addressParts.length
    ? addressParts.join(", ")
    : "D - 87, Industrial Estate, Near KPTCL sub station, Udyanbhag, Belgavi - Karnataka - 590008, India";

  const phone1 = companyDetails?.phone || "+91 9448480724";
  const phone2 = companyDetails?.alternate_phone || "+91 9449819832";
  const phoneStr = phone2 ? `${phone1}  |  ${phone2}` : phone1;
  const emailStr = companyDetails?.email || "phoenix_bgm@hotmail.com";
  const webStr = companyDetails?.website || "www.phoenixproducts.info";

  return (
    <View style={S.footer} fixed>
      <View style={S.footerRule} />
      <View style={S.footerLineRow}>
        <LocationPin />
        <Text style={S.footerLine}>{addressStr}</Text>
      </View>
      <Text style={S.footerLine}>Phone : {phoneStr}</Text>
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
        <Text style={S.footerLine}>E mail : </Text>
        <Text style={S.footerLine}>{emailStr}</Text>
        <Text style={S.footerLine}> | </Text>
        <Text style={[S.footerLine, { fontFamily: "Helvetica-Bold" }]}>{webStr}</Text>
      </View>
    </View>
  );
};

// ── Main Document ─────────────────────────────────────────────

interface Props {
  quotation: Quotation;
  logoUrl: string | null;
}

export function QuotationPDFDocument({ quotation, logoUrl }: Props) {
  const items = quotation.items ?? [];
  const cd = quotation.company_details;

  // Use uploaded logo first, then branding logo
  const finalLogoUrl = quotation.company_logo_url || logoUrl || null;

  // Terms text — prefer quotation-specific (snapshotted), then company default T&C
  const termsText = quotation.terms?.terms_text || cd?.quotation_terms_text || cd?.terms_and_conditions || "";

  // Build structured terms list from text (split by numbered items)
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

  // Closing info
  const managerName   = quotation.manager_name  || cd?.manager_name        || "Darshan Ladi";
  const designation   = quotation.manager_designation || cd?.manager_designation || "Manager";
  const contactNos    = cd?.contact_numbers     || "";
  const emailDetails  = cd?.email_details       || "";
  const jurisdiction  = cd?.jurisdiction        || "Belagavi Jurisdiction (Karnataka, India).";
  const signatureUrl  = cd?.signature_url       || null;

  const gstNo = cd?.gst_number || "29AACFP6260H1Z3";

  // ── Render term line ────────────────────────────────────────
  const renderTermLine = (line: string, idx: number) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Check if it's an indented sub-item (starts with spaces or a/b/c))
    const isSubItem = line.startsWith("  ") || /^\s+[a-z]\)/.test(line);

    // Find pattern: "N) LABEL : value"  or  "N) LABEL :"  followed by value
    const numberedMatch = trimmed.match(/^(\d+\)\s*[A-Z &]+\s*:?)\s*(.*)/);
    const subItemMatch  = trimmed.match(/^([a-z]\))\s*(.*)/);

    const marginTop = (!isSubItem && idx > 0) ? 15 : 0;

    if (numberedMatch && !isSubItem) {
      const [, label, value] = numberedMatch;
      return (
        <View key={idx} style={{ marginBottom: 6, marginTop }}>
          <Text style={{ fontSize: 8.5, lineHeight: 1.5, color: "#000" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{label.trim()}</Text>
            {value.trim() ? " " + value.trim() : ""}
          </Text>
        </View>
      );
    }

    if (subItemMatch) {
      const [, bullet, value] = subItemMatch;
      return (
        <View key={idx} style={{ marginBottom: 4, marginLeft: isSubItem ? 32 : 16 }}>
          <Text style={{ fontSize: 8.5, lineHeight: 1.5, color: "#000" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{bullet}</Text>
            {" " + value.trim()}
          </Text>
        </View>
      );
    }

    // Plain continuation line
    return (
      <View key={idx} style={{ marginLeft: isSubItem ? 32 : 0, marginBottom: 4, marginTop }}>
        <Text style={{ fontSize: 8.5, lineHeight: 1.5, color: "#000" }}>
          {trimmed}
        </Text>
      </View>
    );
  };

  const hasBankDetails = bankAccountName || bankAccountNumber || bankName;

  return (
    <Document
      title={`Quotation ${quotation.quotation_no}`}
      author={cd?.company_name || "Phoenix Products"}
      subject={quotation.subject ?? "Quotation"}
    >
      {/* ═══════════════════════════════════════════════════════
          PAGE 1 — Quotation Body
          ═══════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <SharedDocumentHeader
          logoUrl={finalLogoUrl}
          companyName={cd?.company_name || "Phoenix Products"}
          title="Quotation"
          isPdf
        />

        {/* Date + Quote No (right-aligned) */}
        <View style={{ alignItems: "flex-end", marginBottom: 8 }}>
          <Text style={{ fontSize: 9 }}>Date : {formatDate(quotation.entry_date)}</Text>
          <Text style={{ fontSize: 9, marginTop: 2 }}>Quote No : {quotation.quotation_no}</Text>
        </View>

        {/* Customer block */}
        <View style={{ marginBottom: 2 }}>
          <Text style={S.toLabel}>To,</Text>
          <Text style={S.companyNameBold}>{quotation.company_name}</Text>
          {quotation.address ? <Text style={S.addressLine}>{quotation.address}</Text> : null}
          {(quotation.state || quotation.pincode) ? (
            <Text style={S.addressLine}>
              {[quotation.state, quotation.pincode].filter(Boolean).join(",")}
            </Text>
          ) : null}
          <Text style={S.kindAttn}>
            Kind Attention :{" "}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              {quotation.kind_attention || quotation.contact_person || ""}
              {quotation.mobile ? `  [ ${quotation.mobile} ]` : ""}
            </Text>
          </Text>
        </View>

        {/* Subject */}
        {quotation.subject ? (
          <Text style={S.subjectLine}>
            Subject : {(() => {
              let s = quotation.subject ?? "";
              if (s.toLowerCase().startsWith("quotation for")) s = s.substring("quotation for".length).trim();
              return `Quotation for ${s}`;
            })()}
          </Text>
        ) : null}

        {/* Salutation */}
        <View style={S.salutation}>
          <Text>Dear Sir,</Text>
          <Text>Thank you for your enquiry.</Text>
          <Text style={{ fontFamily: "Helvetica-Oblique" }}>We are pleased to quote for the same as under.</Text>
        </View>

        {/* ── Product Table ─────────────────────────────────── */}
        <View style={S.table}>
          {/* Header row */}
          <View style={S.tableHeader}>
            <View style={[S.thCell, S.colSr]}><Text>SI NO</Text></View>
            <View style={[S.thCell, S.colDesc]}><Text>Description</Text></View>
            <View style={[S.thCell, S.colImg]}><Text style={{ textAlign: "center" }}>Product{"\n"}Image</Text></View>
            <View style={[S.thCell, S.colHsn]}><Text style={{ textAlign: "center" }}>HSN / UOM</Text></View>
            <View style={[S.thCell, S.colRate]}><Text style={{ textAlign: "right" }}>Rate</Text></View>
            <View style={[S.thCell, S.colQty]}><Text style={{ textAlign: "center" }}>Qty</Text></View>
            <View style={[S.thCell, S.colAmt]}><Text style={{ textAlign: "right" }}>Amount</Text></View>
          </View>

          {/* Product rows */}
          {items.map((item, idx) => (
            <View key={item.id || idx} style={S.tableRow} wrap={false}>
              {/* SI NO */}
              <View style={[S.tdCell, S.colSr]}>
                <Text style={{ textAlign: "center" }}>{idx + 1}</Text>
              </View>
              {/* Description */}
              <View style={[S.tdCell, S.colDesc]}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5 }}>{item.product_name}</Text>
                {item.description ? (
                  <Text style={{ fontSize: 7.5, color: "#333", marginTop: 2 }}>{item.description}</Text>
                ) : null}
              </View>
              {/* Product Image */}
              <View style={[S.tdCell, S.colImg]}>
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    style={{ width: 28, height: 28, objectFit: "contain" }}
                  />
                ) : (
                  <View style={{
                    width: 22, height: 22,
                    borderWidth: 0.5, borderColor: "#bbb",
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: "#f5f5f5",
                  }}>
                    <Text style={{ fontSize: 8, color: "#c00", fontFamily: "Helvetica-Bold" }}>✕</Text>
                  </View>
                )}
              </View>
              {/* HSN / UOM */}
              <View style={[S.tdCell, S.colHsn]}>
                <Text style={{ textAlign: "center" }}>
                  {[item.hsn_code, item.uom].filter(Boolean).join(" / ")}
                </Text>
              </View>
              {/* Rate */}
              <View style={[S.tdCell, S.colRate]}>
                <Text style={{ textAlign: "right" }}>{formatNumberINR(Number(item.rate))}</Text>
              </View>
              {/* Qty */}
              <View style={[S.tdCell, S.colQty]}>
                <Text style={{ textAlign: "center" }}>{Number(item.quantity)}</Text>
              </View>
              {/* Amount */}
              <View style={[S.tdCell, S.colAmt]}>
                <Text style={{ textAlign: "right" }}>{formatNumberINR(Number(item.amount))}</Text>
              </View>
            </View>
          ))}

          {/* ── Totals section ─────────────────── */}

          {/* Basic Total */}
          <View style={[S.totalsRow, { borderTopWidth: 0.5 }]}>
            <View style={S.totalsLeftSpacer} />
            <View style={[S.totalLabelCell]}>
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>Basic Total</Text>
            </View>
            <View style={{ width: "16%", borderLeftWidth: 0.5, borderColor: BORDER_COLOR, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 4, paddingVertical: 3 }}>
              <Text style={{ fontSize: 8.5 }}>{formatNumberINR(Number(quotation.basic_total))}</Text>
            </View>
          </View>

          {/* Tax Rate */}
          {quotation.tax_type !== "none" && (
            <View style={S.totalsRow}>
              <View style={S.totalsLeftSpacer} />
              <View style={[S.totalLabelCell, { flexDirection: "row", justifyContent: "space-between" }]}>
                <Text style={{ fontSize: 8.5 }}>Tax Rate</Text>
                <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>{taxLabel(quotation.tax_type)}</Text>
              </View>
              <View style={{ width: "16%", borderLeftWidth: 0.5, borderColor: BORDER_COLOR, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 4, paddingVertical: 3 }}>
                <Text style={{ fontSize: 8.5 }}>{formatNumberINR(Number(quotation.tax_amount))}</Text>
              </View>
            </View>
          )}

          {/* Grand Total + Total in Words */}
          <View style={[S.totalsRow, { minHeight: 32, alignItems: "stretch" }]}>
            {/* Total in Words (left big cell) */}
            <View style={S.grandTotalWordsCell}>
              <Text style={{ fontSize: 7, color: "#555", marginBottom: 1 }}>Total in Words</Text>
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>
                {quotation.amount_words || ""}
              </Text>
            </View>
            {/* Grand Total label */}
            <View style={[S.grandTotalLabelCell, { borderTopWidth: 0, paddingVertical: 4 }]}>
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Grand Total</Text>
            </View>
            {/* Grand Total value */}
            <View style={[S.grandTotalValueCell, { paddingVertical: 4 }]}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" }}>
                {"\u20B9"} {formatNumberINR(Number(quotation.grand_total))}
              </Text>
            </View>
          </View>
        </View>

        {/* GST + Notice */}
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 9, marginBottom: 4 }}>
            Our GST No: <Text style={{ fontFamily: "Helvetica-Bold" }}>{gstNo}</Text>
          </Text>
          <Text style={{ fontSize: 9 }}>Above quoted rates are subject to following terms:</Text>
        </View>

        <FooterComponent companyDetails={cd} />
      </Page>

      {/* ═══════════════════════════════════════════════════════
          PAGE 2 — Terms & Conditions
          ═══════════════════════════════════════════════════════ */}
      {termsLines.length > 0 && (
        <Page size="A4" style={S.page}>
          <SharedDocumentHeader
            logoUrl={finalLogoUrl}
            companyName={cd?.company_name || "Phoenix Products"}
            title="Terms & Conditions"
            isPdf
          />
          <View>
            {termsLines.map((line, i) => renderTermLine(line, i))}
          </View>

          {/* Bank Details — if they fit, render here; otherwise they continue on next page */}
          {hasBankDetails && (() => {
            const bankRows = [
              { label: "Account Name", value: bankAccountName },
              { label: "Account Type", value: bankAccountType },
              { label: "Account Number", value: bankAccountNumber },
              { label: "Bank Name", value: bankName },
              { label: "IFSC / NEFT Code", value: bankIfsc },
            ].filter(r => r.value);
            return (
              <View style={{ marginTop: 10 }} wrap={false}>
                <View style={S.termRow}>
                  <Text style={S.termLabel}>18) Our Bank Details :</Text>
                </View>
                <View style={S.bankTable}>
                  {bankRows.map((row, idx) => {
                    const isLast = idx === bankRows.length - 1;
                    return (
                      <View key={row.label} style={isLast ? S.bankRowLast : S.bankRow}>
                        <View style={S.bankLabelCell}>
                          <Text style={S.bankLabelText}>{row.label}</Text>
                        </View>
                        <View style={S.bankValueCell}>
                          <Text style={S.bankValueText}>: {row.value}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}

          {/* Email, Jurisdiction, Contact */}
          {emailDetails && (
            <View style={[S.termRow, { marginTop: 8 }]}>
              <Text style={S.termLabel}>19) EMAIL DETAILS :</Text>
              <Text style={S.termValue}> {emailDetails}</Text>
            </View>
          )}
          {jurisdiction && (
            <View style={S.termRow}>
              <Text style={S.termLabel}>20) JURISDICTION :</Text>
              <Text style={S.termValue}> {jurisdiction}</Text>
            </View>
          )}
          {contactNos && (
            <View style={S.termRow}>
              <Text style={S.termLabel}>21) CONTACT NUMBERS :</Text>
              <Text style={S.termValue}> {contactNos}</Text>
            </View>
          )}

          {/* Closing & Signature Block */}
          <View wrap={false} style={{ marginTop: 15 }}>
            <Text style={S.closingPara}>
              We hope that the above offer is in line with your requirement. Awaiting your valued response at the earliest. Assuring you of our best services at all times.
            </Text>
            <Text style={S.thankingYou}>Thanking You</Text>
            <Text style={[S.forCompany, { fontFamily: "Helvetica-Bold" }]}>For {cd?.company_name || "Phoenix Products"},</Text>

            {/* Signature */}
            {signatureUrl && (
              <Image
                src={signatureUrl}
                style={{ height: 40, width: 100, objectFit: "contain", marginBottom: 2 }}
              />
            )}
            {!signatureUrl && <View style={{ height: 30 }} />}

            <Text style={[S.designation, { fontFamily: "Helvetica-Bold" }]}>{designation}</Text>
            <Text style={S.managerName}>{managerName}</Text>
          </View>

          <FooterComponent companyDetails={cd} />
        </Page>
      )}

      {/* If no terms text, still show the closing/bank page */}
      {termsLines.length === 0 && (hasBankDetails || contactNos || emailDetails) && (
        <Page size="A4" style={S.page}>
          <SharedDocumentHeader
            logoUrl={finalLogoUrl}
            companyName={cd?.company_name || "Phoenix Products"}
            title=""
            isPdf
          />

          {hasBankDetails && (() => {
            const bankRows = [
              { label: "Account Name", value: bankAccountName },
              { label: "Account Type", value: bankAccountType },
              { label: "Account Number", value: bankAccountNumber },
              { label: "Bank Name", value: bankName },
              { label: "IFSC / NEFT Code", value: bankIfsc },
            ].filter(r => r.value);
            return (
              <View style={{ marginBottom: 10 }}>
                <View style={S.termRow}>
                  <Text style={S.termLabel}>Our Bank Details :</Text>
                </View>
                <View style={S.bankTable}>
                  {bankRows.map((row, idx) => {
                    const isLast = idx === bankRows.length - 1;
                    return (
                      <View key={row.label} style={isLast ? S.bankRowLast : S.bankRow}>
                        <View style={S.bankLabelCell}>
                          <Text style={S.bankLabelText}>{row.label}</Text>
                        </View>
                        <View style={S.bankValueCell}>
                          <Text style={S.bankValueText}>: {row.value}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}

          {emailDetails && (
            <View style={S.termRow}>
              <Text style={S.termLabel}>EMAIL DETAILS :</Text>
              <Text style={S.termValue}> {emailDetails}</Text>
            </View>
          )}
          {jurisdiction && (
            <View style={S.termRow}>
              <Text style={S.termLabel}>JURISDICTION :</Text>
              <Text style={S.termValue}> {jurisdiction}</Text>
            </View>
          )}
          {contactNos && (
            <View style={S.termRow}>
              <Text style={S.termLabel}>CONTACT NUMBERS :</Text>
              <Text style={S.termValue}> {contactNos}</Text>
            </View>
          )}

          {/* Closing & Signature Block */}
          <View wrap={false} style={{ marginTop: 15 }}>
            <Text style={S.closingPara}>
              We hope that the above offer is in line with your requirement. Awaiting your valued response at the earliest. Assuring you of our best services at all times.
            </Text>
            <Text style={S.thankingYou}>Thanking You</Text>
            <Text style={[S.forCompany, { fontFamily: "Helvetica-Bold" }]}>For {cd?.company_name || "Phoenix Products"},</Text>

            {signatureUrl ? (
              <Image src={signatureUrl} style={{ height: 40, width: 100, objectFit: "contain", marginBottom: 2 }} />
            ) : (
              <View style={{ height: 30 }} />
            )}

            <Text style={[S.designation, { fontFamily: "Helvetica-Bold" }]}>{designation}</Text>
            <Text style={S.managerName}>{managerName}</Text>
          </View>

          <FooterComponent companyDetails={cd} />
        </Page>
      )}
    </Document>
  );
}
