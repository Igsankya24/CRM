import React from "react";
import { View as PdfView, Text as PdfText, Image as PdfImage, StyleSheet as PdfStyleSheet } from "@react-pdf/renderer";

// Styles for the PDF headers
const pdfStyles = PdfStyleSheet.create({
  // Legacy Quotation Header Styles (MUST REMAIN UNCHANGED)
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
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: "#000000",
    marginTop: 8,
    marginBottom: 6,
  },
  headerRule: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#aaaaaa",
    marginTop: 8,
  },

  // Redesigned Proforma / Sales Register Header Styles (Boxed & Centered Layout)
  newHeader: {
    position: "absolute",
    top: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    paddingBottom: 6,
  },
  newHeaderSideSlot: {
    width: 90,
  },
  newHeaderCenter: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  newLogoImg: {
    height: 50,
    width: 80,
    objectFit: "contain",
  },
  companyNameText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    textAlign: "center",
    marginBottom: 2,
  },
  companySubText: {
    fontSize: 7.5,
    color: "#000000",
    textAlign: "center",
    lineHeight: 1.25,
  },
  newTitleText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    textTransform: "uppercase",
    textDecoration: "underline",
    marginTop: 0,
    marginBottom: 10,
  }
});

interface SharedHeaderProps {
  logoUrl: string | null;
  companyName: string;
  title: string;
  isPdf?: boolean;
  documentType?: "quotation" | "proforma" | "sales_register";
  logoAlignment?: "left" | "right";
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyGst?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
}

export function SharedDocumentHeader({
  logoUrl,
  companyName,
  title,
  isPdf = false,
  documentType = "quotation",
  logoAlignment = "right",
  companyAddress,
  companyPhone,
  companyGst,
  companyEmail,
  companyWebsite,
}: SharedHeaderProps) {
  const parts = companyName.split(/\s+/);
  const first = parts[0] || "Phoenix";
  const rest = parts.slice(1).join(" ") || "Products";

  // Fallback to absolute/relative default logo URL
  const finalLogoUrl = logoUrl || (typeof window !== "undefined" ? window.location.origin + "/logo.png" : "/logo.png");
  const isQuotation = documentType === "quotation";

  if (isPdf) {
    if (isQuotation) {
      // Legacy PDF layout for Quotations (DO NOT CHANGE)
      return (
        <>
          <PdfView style={pdfStyles.header} fixed>
            <PdfView style={pdfStyles.headerRow}>
              <PdfView style={pdfStyles.logoLeft}>
                <PdfText style={pdfStyles.phoenixTextBig}>{first}</PdfText>
                {rest ? <PdfText style={pdfStyles.phoenixTextSmall}>{rest}</PdfText> : null}
              </PdfView>
              <PdfView style={pdfStyles.logoRight}>
                {finalLogoUrl ? <PdfImage src={finalLogoUrl} style={pdfStyles.logoRightImg} /> : null}
              </PdfView>
            </PdfView>
            <PdfView style={pdfStyles.headerRule} />
          </PdfView>
          <PdfText style={pdfStyles.title}>{title}</PdfText>
        </>
      );
    }

    // Redesigned PDF layout for Proforma Invoices & Sales Registers
    const showLogo = !!finalLogoUrl;
    return (
      <>
        <PdfView style={pdfStyles.newHeader} fixed>
          {/* Left Slot: Logo if left aligned, else empty spacer */}
          <PdfView style={pdfStyles.newHeaderSideSlot}>
            {showLogo && logoAlignment === "left" ? (
              <PdfImage src={finalLogoUrl} style={pdfStyles.newLogoImg} />
            ) : null}
          </PdfView>

          {/* Center Slot: Dynamic Centered Company Details */}
          <PdfView style={pdfStyles.newHeaderCenter}>
            <PdfText style={pdfStyles.companyNameText}>{companyName.toUpperCase()}</PdfText>
            <PdfText style={pdfStyles.companySubText}>
              {[
                companyAddress,
                [
                  companyPhone ? `Mob: ${companyPhone}` : "",
                  companyGst ? `GST No: ${companyGst}` : "",
                  companyEmail ? `Email: ${companyEmail}` : "",
                  companyWebsite ? `Web: ${companyWebsite}` : ""
                ].filter(Boolean).join(", ")
              ].filter(Boolean).join("\n")}
            </PdfText>
          </PdfView>

          {/* Right Slot: Logo if right aligned, else empty spacer */}
          <PdfView style={[pdfStyles.newHeaderSideSlot, { alignItems: "flex-end" }]}>
            {showLogo && logoAlignment === "right" ? (
              <PdfImage src={finalLogoUrl} style={pdfStyles.newLogoImg} />
            ) : null}
          </PdfView>
        </PdfView>

        {/* Centered Document Title */}
        <PdfText style={pdfStyles.newTitleText}>{title}</PdfText>
      </>
    );
  }

  // HTML rendering
  if (isQuotation) {
    // Legacy HTML layout for Quotations (DO NOT CHANGE)
    return (
      <div style={{ display: "flex", flexDirection: "column", marginBottom: "16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <div style={{ width: "60%" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontSize: "34pt", fontWeight: "bold", fontStyle: "italic", color: "#0066cc", lineHeight: 1.0 }}>
                {first}
              </div>
              {rest && (
                <div style={{ fontSize: "34pt", fontWeight: "bold", fontStyle: "italic", color: "#0066cc", marginLeft: "150px", lineHeight: 1.0 }}>
                  {rest}
                </div>
              )}
            </div>
          </div>
          <div style={{ width: "40%", display: "flex", justifyContent: "flex-end" }}>
            {finalLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={finalLogoUrl} alt="Company Logo" style={{ height: "90px", width: "150px", objectFit: "contain" }} />
            ) : null}
          </div>
        </div>
        <div style={{ borderTop: "1.5px solid #aaaaaa", marginTop: "8px", marginBottom: "16px" }} />
        <div style={{ textAlign: "center", fontSize: "16pt", fontWeight: "bold", marginBottom: "6px", color: "#000000" }}>
          {title}
        </div>
      </div>
    );
  }

  // Redesigned HTML layout for Proforma Invoices & Sales Registers
  const showLogoHtml = !!finalLogoUrl;
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #000000", paddingBottom: "6px", marginBottom: "8px" }}>
        {/* Left Slot: Logo if left-aligned */}
        <div style={{ width: "90px", display: "flex", justifyContent: "flex-start" }}>
          {showLogoHtml && logoAlignment === "left" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={finalLogoUrl} alt="Logo" style={{ height: "50px", width: "80px", objectFit: "contain" }} />
          )}
        </div>

        {/* Center Slot: Centered Company Info */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: "16pt", fontWeight: "bold", color: "#000000", marginBottom: "2px" }}>
            {companyName.toUpperCase()}
          </div>
          <div style={{ fontSize: "8pt", color: "#000000", lineHeight: 1.3, whiteSpace: "pre-line" }}>
            {companyAddress}
            <br />
            {[
              companyPhone ? `Mob: ${companyPhone}` : "",
              companyGst ? `GST No: ${companyGst}` : "",
              companyEmail ? `Email: ${companyEmail}` : "",
              companyWebsite ? `Web: ${companyWebsite}` : ""
            ].filter(Boolean).join(", ")}
          </div>
        </div>

        {/* Right Slot: Logo if right-aligned */}
        <div style={{ width: "90px", display: "flex", justifyContent: "flex-end" }}>
          {showLogoHtml && logoAlignment === "right" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={finalLogoUrl} alt="Logo" style={{ height: "50px", width: "80px", objectFit: "contain" }} />
          )}
        </div>
      </div>

      {/* Centered Document Title */}
      <div style={{ textAlign: "center", fontSize: "12pt", fontWeight: "bold", textDecoration: "underline", textTransform: "uppercase", margin: "6px 0 10px 0" }}>
        {title}
      </div>
    </div>
  );
}
