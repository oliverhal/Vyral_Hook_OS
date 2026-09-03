import { jsPDF } from "jspdf";
import { NOTO_SANS_REGULAR_BASE64, NOTO_SANS_BOLD_BASE64 } from "./fonts/notoSansSubset";

// Draws the invoice directly as vector text/shapes (no html2canvas, no browser
// print dialog) so the output is a single, real PDF: selectable/copyable text,
// our own colors, and none of the browser's print-chrome (date/title header,
// "background graphics" toggle, page-break artifacts).

export interface InvoicePdfLineItem {
  description: string;
  amount: string;
}

export interface InvoicePdfCreatorLine {
  name: string;
  platform: string;
  amount: string;
}

export interface InvoicePdfData {
  fromCompany: string;
  fromAddress: string;
  fromVatId: string;
  fromIban: string;
  fromBic: string;
  fromIntBic: string;
  invoiceNumber: string;
  invoiceDateLabel: string;
  dueDateLabel: string;
  toCompany: string;
  toAddress: string;
  toVatId: string;
  toContact: string;
  lineItems: InvoicePdfLineItem[];
  showCreators: boolean;
  creatorLines: InvoicePdfCreatorLine[];
  vatMode: "none" | "vat20" | "reverse_charge";
  notes: string;
  subtotalLabel: string;
  vatAmountLabel: string;
  totalLabel: string;
  amountLabel: (raw: string) => string; // formats a line-item's raw amount string, "" for blank
}

const COLORS = {
  slate900: [15, 23, 42] as const,
  slate700: [51, 65, 85] as const,
  slate500: [100, 116, 139] as const,
  slate400: [148, 163, 184] as const,
  slate300: [203, 213, 225] as const,
  slate200: [226, 232, 240] as const,
  slate100: [241, 245, 249] as const,
  blue600: [37, 99, 235] as const,
  white: [255, 255, 255] as const,
};

export function generateInvoicePdf(d: InvoicePdfData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  // jsPDF's built-in fonts only cover WinAnsi — fine for Western European
  // accents (é, ü, ñ, å) but silently mangles Czech/Polish/Slovak carons
  // (č, ř, ě, ů). Register a Unicode subset for anything that's client data.
  doc.addFileToVFS("NotoSans-Regular.ttf", NOTO_SANS_REGULAR_BASE64);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", NOTO_SANS_BOLD_BASE64);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;
  const rightEdge = pageWidth - margin;
  let y = margin;

  const setColor = (target: "text" | "fill" | "draw", c: readonly [number, number, number]) => {
    if (target === "text") doc.setTextColor(c[0], c[1], c[2]);
    else if (target === "fill") doc.setFillColor(c[0], c[1], c[2]);
    else doc.setDrawColor(c[0], c[1], c[2]);
  };

  // ── Header: logo + INVOICE title/meta ─────────────────────────────────────
  doc.setFont("times", "italic");
  doc.setFontSize(22);
  setColor("text", COLORS.slate900);
  doc.text("Vyral", margin, y + 18);
  const vyralWidth = doc.getTextWidth("Vyral");
  doc.setFont("helvetica", "bold");
  doc.text("labs", margin + vyralWidth + 6, y + 18);
  const labsWidth = doc.getTextWidth("labs");
  setColor("fill", COLORS.blue600);
  doc.rect(margin + vyralWidth + labsWidth + 11, y + 12, 7, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setColor("text", COLORS.slate900);
  doc.text("INVOICE", rightEdge, y + 16, { align: "right" });

  let metaY = y + 34;
  doc.setFontSize(9);
  if (d.invoiceNumber) {
    doc.setFont("NotoSans", "normal");
    setColor("text", COLORS.slate500);
    doc.text("No.", rightEdge - doc.getTextWidth(d.invoiceNumber) - 4, metaY, { align: "right" });
    doc.setFont("NotoSans", "bold");
    setColor("text", COLORS.slate900);
    doc.text(d.invoiceNumber, rightEdge, metaY, { align: "right" });
    metaY += 13;
  }
  const metaRow = (label: string, value: string) => {
    doc.setFont("NotoSans", "normal");
    setColor("text", COLORS.slate500);
    const valueWidth = doc.getTextWidth(value);
    doc.text(`${label}:`, rightEdge - valueWidth - 4, metaY, { align: "right" });
    doc.setFont("NotoSans", "bold");
    setColor("text", COLORS.slate700);
    doc.text(value, rightEdge, metaY, { align: "right" });
    metaY += 13;
  };
  metaRow("Date", d.invoiceDateLabel);
  metaRow("Due", d.dueDateLabel);

  y = Math.max(y + 60, metaY + 14);

  // ── From / To ──────────────────────────────────────────────────────────────
  const colWidth = contentWidth / 2 - 20;
  const drawParty = (x: number, label: string, company: string, address: string, vatId: string, contact?: string) => {
    let cy = y;
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(8.5);
    setColor("text", COLORS.slate400);
    doc.text(label.toUpperCase(), x, cy);
    cy += 16;
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(10.5);
    setColor("text", COLORS.slate900);
    doc.text(company || "—", x, cy);
    cy += 14;
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(9.5);
    setColor("text", COLORS.slate500);
    for (const line of address.split("\n").filter(Boolean)) {
      const wrapped = doc.splitTextToSize(line, colWidth);
      for (const w of wrapped) { doc.text(w, x, cy); cy += 12; }
    }
    if (vatId) { doc.text(`VAT: ${vatId}`, x, cy); cy += 12; }
    if (contact) { doc.text(`Att: ${contact}`, x, cy); cy += 12; }
    return cy;
  };

  const fromBottom = drawParty(margin, "From", d.fromCompany, d.fromAddress, d.fromVatId);
  const toBottom = drawParty(margin + colWidth + 40, "Bill To", d.toCompany, d.toAddress, d.toVatId, d.toContact);
  y = Math.max(fromBottom, toBottom) + 18;

  // ── Divider ────────────────────────────────────────────────────────────────
  setColor("draw", COLORS.slate900);
  doc.setLineWidth(1);
  doc.line(margin, y, rightEdge, y);
  y += 18;

  // ── Line items table ──────────────────────────────────────────────────────
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(8.5);
  setColor("text", COLORS.slate500);
  doc.text("DESCRIPTION", margin, y);
  doc.text("AMOUNT", rightEdge, y, { align: "right" });
  y += 6;
  setColor("draw", COLORS.slate200);
  doc.setLineWidth(0.75);
  doc.line(margin, y, rightEdge, y);
  y += 18;

  doc.setFontSize(9.5);
  for (const item of d.lineItems) {
    if (!item.description && !item.amount) continue;
    doc.setFont("NotoSans", "normal");
    setColor("text", COLORS.slate700);
    const wrapped = doc.splitTextToSize(item.description || "—", contentWidth - 130);
    for (const w of wrapped) { doc.text(w, margin, y); y += 13; }
    doc.setFont("NotoSans", "bold");
    setColor("text", COLORS.slate900);
    doc.text(d.amountLabel(item.amount) || "0.00", rightEdge, y - 13, { align: "right" });
    y += 4;
    setColor("draw", COLORS.slate100);
    doc.setLineWidth(0.5);
    doc.line(margin, y, rightEdge, y);
    y += 16;
  }

  // ── Creator breakdown ──────────────────────────────────────────────────────
  const visibleCreators = d.creatorLines.filter((c) => c.name);
  if (d.showCreators && visibleCreators.length > 0) {
    y += 6;
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(8.5);
    setColor("text", COLORS.slate400);
    doc.text("CREATOR BREAKDOWN", margin, y);
    y += 14;
    doc.setFontSize(9);
    for (const c of visibleCreators) {
      doc.setFont("NotoSans", "normal");
      setColor("text", COLORS.slate700);
      doc.text(c.name, margin, y);
      setColor("text", COLORS.slate400);
      doc.text(c.platform || "—", margin + 180, y);
      setColor("text", COLORS.slate700);
      doc.text(c.amount ? d.amountLabel(c.amount) : "—", rightEdge, y, { align: "right" });
      y += 8;
      setColor("draw", COLORS.slate100);
      doc.setLineWidth(0.5);
      doc.line(margin, y, rightEdge, y);
      y += 14;
    }
  }

  // ── VAT / Total ────────────────────────────────────────────────────────────
  y += 12;
  const totalsBoxWidth = 200;
  const totalsX = rightEdge - totalsBoxWidth;
  if (d.vatMode === "vat20") {
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(9.5);
    setColor("text", COLORS.slate500);
    doc.text("Subtotal", totalsX, y);
    setColor("text", COLORS.slate700);
    doc.setFont("NotoSans", "bold");
    doc.text(d.subtotalLabel, rightEdge, y, { align: "right" });
    y += 15;
    doc.setFont("NotoSans", "normal");
    setColor("text", COLORS.slate500);
    doc.text("VAT (20%)", totalsX, y);
    setColor("text", COLORS.slate700);
    doc.setFont("NotoSans", "bold");
    doc.text(d.vatAmountLabel, rightEdge, y, { align: "right" });
    y += 12;
    setColor("draw", COLORS.slate200);
    doc.line(totalsX, y, rightEdge, y);
    y += 14;
  } else if (d.vatMode === "reverse_charge") {
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(9.5);
    setColor("text", COLORS.slate500);
    doc.text("VAT", totalsX, y);
    doc.text("Reverse Charge", rightEdge, y, { align: "right" });
    y += 20;
  }

  const boxHeight = 52;
  setColor("fill", COLORS.slate900);
  doc.roundedRect(totalsX, y, totalsBoxWidth, boxHeight, 10, 10, "F");
  setColor("text", COLORS.slate300);
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(8);
  doc.text("TOTAL DUE", totalsX + 20, y + 20);
  setColor("text", COLORS.white);
  doc.setFontSize(19);
  doc.text(d.totalLabel, totalsX + totalsBoxWidth - 20, y + 40, { align: "right" });
  y += boxHeight + 26;

  // ── Payment details ────────────────────────────────────────────────────────
  setColor("draw", COLORS.slate200);
  doc.setLineWidth(0.75);
  doc.line(margin, y, rightEdge, y);
  y += 20;
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(8.5);
  setColor("text", COLORS.slate400);
  doc.text("PAYMENT DETAILS", margin, y);
  y += 18;

  const paymentRow = (label: string, value: string, mono: boolean) => {
    if (!value) return;
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(9.5);
    setColor("text", COLORS.slate400);
    doc.text(label, margin, y);
    doc.setFont(mono ? "courier" : "NotoSans", "bold");
    setColor("text", COLORS.slate900);
    doc.text(value, margin + 130, y);
    y += 15;
  };
  paymentRow("Account Name", d.fromCompany, false);
  paymentRow("IBAN", d.fromIban, true);
  paymentRow("BIC / SWIFT", d.fromBic, true);
  paymentRow("Intermediary BIC", d.fromIntBic, true);

  if (d.vatMode === "reverse_charge") {
    y += 8;
    setColor("draw", COLORS.slate100);
    doc.line(margin, y, rightEdge, y);
    y += 16;
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(8.5);
    setColor("text", COLORS.slate500);
    const wrapped = doc.splitTextToSize(
      "This supply is outside the scope of UK VAT. The services are subject to the Reverse Charge Mechanism.",
      contentWidth
    );
    for (const w of wrapped) { doc.text(w, margin, y); y += 12; }
  }

  if (d.notes) {
    y += 10;
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(8.5);
    setColor("text", COLORS.slate400);
    for (const line of d.notes.split("\n").filter(Boolean)) {
      const wrapped = doc.splitTextToSize(line, contentWidth);
      for (const w of wrapped) { doc.text(w, margin, y); y += 12; }
    }
  }

  const filename = `Invoice${d.invoiceNumber ? `-${d.invoiceNumber}` : ""}.pdf`;
  doc.save(filename);
}
