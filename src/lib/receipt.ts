import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatPhone, maskPhone } from "@/lib/phone";
import type { PlatformSettings } from "@/lib/settings-schema";
import type { QuoteLine } from "@/lib/pricing/quote";
import { formatDateTime, formatNumber } from "@/lib/utils";

export type ReceiptData = {
  invoiceNumber: string;
  orderReference: string;
  paidAt: Date;
  customer: { name: string; email: string; phone: string | null };
  campaignName: string | null;
  lines: QuoteLine[];
  total: number;
  payment: { operator: string; phone: string | null; providerLabel: string; providerRef: string | null; simulated: boolean };
  refunds: { amount: number; processedAt: Date | null; reference: string | null }[];
};

const INK = rgb(0.055, 0.165, 0.125);
const MUTED = rgb(0.37, 0.42, 0.39);
const LINE = rgb(0.89, 0.87, 0.82);

// Les polices standard PDF n'acceptent que l'encodage WinAnsi.
const WIN_ANSI_EXTRA = "—–’‘“”…€œŒ•";
function safe(text: string) {
  return Array.from(text.replace(/[\u202f\u00a0]/g, " ")).map((c) => (c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.includes(c) ? c : "?")).join("");
}
const money = (n: number) => `${formatNumber(n, " ")} F CFA`;

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const out: string[] = [];
  let line = "";
  for (const word of safe(text).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) { out.push(line); line = word; } else line = candidate;
  }
  if (line) out.push(line);
  return out;
}

export async function renderReceiptPdf(data: ReceiptData, settings: PlatformSettings): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Reçu ${data.invoiceNumber}`);
  pdf.setAuthor(settings.companyName);
  const page: PDFPage = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const left = 56, right = 539;
  let y = 780;
  const text = (t: string, x: number, size = 10, font = regular, color = INK) => page.drawText(safe(t), { x, y, size, font, color });
  const textRight = (t: string, size = 10, font = regular, color = INK) => page.drawText(safe(t), { x: right - font.widthOfTextAtSize(safe(t), size), y, size, font, color });
  const rule = () => page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.7, color: LINE });

  text(settings.companyName, left, 20, bold);
  textRight("REÇU DE PAIEMENT", 11, bold);
  y -= 16;
  text(settings.companyAddress, left, 9, regular, MUTED);
  textRight(data.invoiceNumber, 10, regular, MUTED);
  if (settings.companyTaxId) { y -= 12; text(`IFU : ${settings.companyTaxId}`, left, 9, regular, MUTED); }
  y -= 28; rule(); y -= 24;

  text("Client", left, 8, bold, MUTED);
  page.drawText("Commande", { x: 320, y, size: 8, font: bold, color: MUTED });
  y -= 15;
  text(data.customer.name, left, 11, bold);
  page.drawText(safe(data.orderReference), { x: 320, y, size: 11, font: bold, color: INK });
  y -= 14;
  text(data.customer.email, left, 9, regular, MUTED);
  page.drawText(safe(`Payée le ${formatDateTime(data.paidAt)}`), { x: 320, y, size: 9, font: regular, color: MUTED });
  if (data.customer.phone) { y -= 12; text(formatPhone(data.customer.phone), left, 9, regular, MUTED); }
  if (data.campaignName) { y -= 20; text(`Campagne : ${data.campaignName}`, left, 10); }
  y -= 30;

  text("Désignation", left, 8, bold, MUTED); textRight("Montant", 8, bold, MUTED);
  y -= 8; rule(); y -= 18;
  for (const line of data.lines) {
    const rows = wrap(line.label, regular, 10, 340);
    rows.forEach((row, i) => { text(row, left, 10); if (i === 0) textRight(`${line.amount < 0 ? "- " : ""}${money(Math.abs(line.amount))}`, 10); y -= 14; });
    if (line.hint) { text(line.hint, left, 8, regular, MUTED); y -= 12; }
    y -= 6;
  }
  rule(); y -= 22;
  text("Total réglé", left, 12, bold); textRight(money(data.total), 14, bold);
  y -= 34;

  text("Règlement", left, 8, bold, MUTED); y -= 15;
  text(data.payment.phone ? `${data.payment.operator} — ${maskPhone(data.payment.phone)}` : data.payment.operator, left, 10); y -= 14;
  text(`Prestataire : ${data.payment.providerLabel}${data.payment.providerRef ? ` — transaction ${data.payment.providerRef.slice(0, 40)}` : ""}`, left, 9, regular, MUTED);
  y -= 14;
  if (data.payment.simulated) { text("PAIEMENT SIMULÉ — document de démonstration sans valeur comptable.", left, 9, bold, rgb(0.7, 0.2, 0.1)); y -= 14; }
  for (const r of data.refunds) {
    text(`Remboursement de ${money(r.amount)}${r.processedAt ? ` le ${formatDateTime(r.processedAt)}` : ""}${r.reference ? ` (réf. ${r.reference})` : ""}`, left, 9, regular, MUTED);
    y -= 13;
  }

  y = 96; rule(); y -= 16;
  for (const row of wrap("Le budget publicitaire est intégralement reversé aux plateformes (Meta, TikTok) pour la diffusion de vos annonces. Les frais de prestation rémunèrent la création, la gestion et le suivi de votre campagne. Les résultats d'une campagne dépendent de nombreux facteurs et ne sont pas garantis.", regular, 8, right - left)) {
    text(row, left, 8, regular, MUTED); y -= 11;
  }
  if (settings.supportEmail || settings.supportWhatsapp) text(`Assistance : ${[settings.supportEmail, settings.supportWhatsapp].filter(Boolean).join(" — ")}`, left, 8, regular, MUTED);
  return pdf.save();
}
