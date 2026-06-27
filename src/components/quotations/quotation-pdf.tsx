"use client";

/**
 * QuotationPDFButton
 * Renders a button that, when clicked, generates and downloads a PDF of the quotation.
 * Uses @react-pdf/renderer entirely in the browser — no server round-trip needed.
 */

import { useState, useCallback } from "react";
import { FileDown, Loader2 } from "lucide-react";
import type { Quotation } from "@/types";

interface Props {
  quotation: Quotation;
  logoUrl?: string | null;
  className?: string;
  label?: string;
}

async function getBase64Image(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Failed to fetch image for base64 conversion: ${url}, status: ${res.status}`);
      return url;
    }
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn(`Error converting image to base64: ${url}`, err);
    return url;
  }
}

export function QuotationPDFButton({
  quotation,
  logoUrl,
  className = "",
  label = "Download PDF",
}: Props) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      let fullQuotation = quotation;
      const fetchRes = await fetch(`/api/quotations/${quotation.id}`);
      if (fetchRes.ok) {
        const resJson = await fetchRes.json();
        if (resJson?.quotation) {
          fullQuotation = resJson.quotation;
        }
      }

      // Convert logo and signature to Base64 to bypass CORS issues in @react-pdf/renderer
      let finalLogoBase64: string | null = null;
      const targetLogoUrl = fullQuotation.company_logo_url || logoUrl || (typeof window !== "undefined" ? window.location.origin + "/logo.png" : "/logo.png");
      if (targetLogoUrl) {
        finalLogoBase64 = await getBase64Image(targetLogoUrl);
      }

      if (fullQuotation.company_details?.signature_url) {
        const signatureBase64 = await getBase64Image(fullQuotation.company_details.signature_url);
        fullQuotation = {
          ...fullQuotation,
          company_details: {
            ...fullQuotation.company_details,
            signature_url: signatureBase64,
          },
        };
      }

      // Dynamic import so the large PDF lib is only loaded when needed
      const { pdf } = await import("@react-pdf/renderer");
      const { QuotationPDFDocument } = await import("./quotation-pdf-document");
      const { createElement } = await import("react");

      const blob = await pdf(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createElement(QuotationPDFDocument, { quotation: fullQuotation, logoUrl: finalLogoBase64 }) as any
      ).toBlob();

      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href     = url;
      link.download = `${fullQuotation.quotation_no}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [quotation, logoUrl]);

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={generating}
      className={className}
    >
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      {generating ? "Generating..." : label}
    </button>
  );
}
