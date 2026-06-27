import type { QuotationTaxType } from "@/types";

// ── Amount in Words ──────────────────────────────────────────
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function wordsBelow1000(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  return (
    ONES[Math.floor(n / 100)] +
    " Hundred" +
    (n % 100 ? " " + wordsBelow1000(n % 100) : "")
  );
}

export function numberToWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const crore  = Math.floor(rupees / 10000000);
  const lakh   = Math.floor((rupees % 10000000) / 100000);
  const thous  = Math.floor((rupees % 100000) / 1000);
  const rest   = rupees % 1000;

  let words = "";
  if (crore)  words += wordsBelow1000(crore)  + " Crore ";
  if (lakh)   words += wordsBelow1000(lakh)   + " Lakh ";
  if (thous)  words += wordsBelow1000(thous)  + " Thousand ";
  if (rest)   words += wordsBelow1000(rest);

  words = words.trim();
  const rupeePart = words ? words + " Rupees" : "";
  const paisePart = paise  ? wordsBelow1000(paise) + " Paise" : "";

  return [rupeePart, paisePart].filter(Boolean).join(" and ") + " Only";
}

// ── Tax type metadata ────────────────────────────────────────
export interface TaxMeta {
  label: string;
  rate: number;           // percentage e.g. 18
  breakdown?: string;     // e.g. "CGST 9% + SGST 9%"
}

export const TAX_OPTIONS: { value: QuotationTaxType; label: string }[] = [
  { value: "none",          label: "No Tax" },
  { value: "gst_5",         label: "GST 5%" },
  { value: "gst_12",        label: "GST 12%" },
  { value: "gst_18",        label: "GST 18%" },
  { value: "igst_5",        label: "IGST 5%" },
  { value: "igst_12",       label: "IGST 12%" },
  { value: "igst_18",       label: "IGST 18%" },
  { value: "cgst_sgst_5",   label: "CGST 2.5% + SGST 2.5%" },
  { value: "cgst_sgst_12",  label: "CGST 6% + SGST 6%" },
  { value: "cgst_sgst_18",  label: "CGST 9% + SGST 9%" },
  { value: "custom",        label: "Custom Tax %" },
];

const TAX_RATES: Record<QuotationTaxType, number> = {
  none: 0,
  gst_5: 5, gst_12: 12, gst_18: 18,
  igst_5: 5, igst_12: 12, igst_18: 18,
  cgst_sgst_5: 5, cgst_sgst_12: 12, cgst_sgst_18: 18,
  custom: 0,
};

export function getTaxRate(taxType: QuotationTaxType, customRate?: number | null): number {
  if (taxType === "custom") return customRate ?? 0;
  return TAX_RATES[taxType] ?? 0;
}

export function calcTotals(
  items: { rate: number; quantity: number }[],
  taxType: QuotationTaxType,
  customRate?: number | null
) {
  const basicTotal = items.reduce((sum, it) => sum + it.rate * it.quantity, 0);
  const rate       = getTaxRate(taxType, customRate);
  const taxAmount  = Math.round(basicTotal * rate) / 100;
  const grandTotal = basicTotal + taxAmount;
  return {
    basicTotal:  Math.round(basicTotal  * 100) / 100,
    taxAmount:   Math.round(taxAmount   * 100) / 100,
    grandTotal:  Math.round(grandTotal  * 100) / 100,
    amountWords: numberToWords(Math.round(grandTotal * 100) / 100),
  };
}

// ── Format currency ──────────────────────────────────────────
export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
