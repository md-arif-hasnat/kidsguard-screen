import type { ParentBillingInvoice } from "./BillingRepository";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

function pdfText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function money(amount: number, currencyCode: string): string {
  return `${currencyCode} ${(amount / 100).toFixed(2)}`;
}

function addText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  size = 10,
  bold = false
) {
  commands.push(
    `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`
  );
}

export function buildParentInvoicePdf(
  invoice: ParentBillingInvoice
): Uint8Array {
  const commands: string[] = ["0.12 0.16 0.23 rg"];
  const reference = invoice.invoiceNumber || invoice.transactionId;
  const billedAt = invoice.billedAt
    ? new Date(invoice.billedAt).toISOString().slice(0, 10)
    : "Unavailable";

  addText(commands, "KidsGuard", 44, 794, 22, true);
  addText(commands, "SUBSCRIPTION PAYMENT RECEIPT", 44, 764, 12, true);
  addText(commands, `Invoice reference: ${reference}`, 44, 728, 10);
  addText(commands, `Paddle transaction: ${invoice.transactionId}`, 44, 710, 9);
  addText(commands, `Billing date: ${billedAt}`, 44, 692, 9);
  addText(commands, `Customer country: ${invoice.countryCode || "Not reported"}`, 44, 674, 9);

  commands.push("0.93 0.94 0.96 rg 40 612 515 28 re f");
  commands.push("0.12 0.16 0.23 rg");
  addText(commands, "Payment summary", 48, 621, 9, true);

  const rows: Array<[string, number]> = [
    ["Subtotal", invoice.subtotal],
    ["Discount", -invoice.discount],
    ["Tax / VAT", invoice.tax],
    ["Total paid", invoice.total],
  ];
  let y = 580;
  for (const [label, amount] of rows) {
    addText(commands, label, 48, y, 10, label === "Total paid");
    addText(
      commands,
      money(amount, invoice.currencyCode),
      430,
      y,
      10,
      label === "Total paid"
    );
    commands.push(`0.88 0.90 0.93 RG 44 ${y - 10} m 551 ${y - 10} l S`);
    y -= 34;
  }

  addText(
    commands,
    "Payment processor: Paddle. Amounts are shown in the original transaction currency.",
    44,
    118,
    8
  );
  addText(
    commands,
    "This KidsGuard receipt is generated from the completed Paddle transaction record.",
    44,
    102,
    8
  );

  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [5 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n%KidsGuard\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function downloadParentInvoicePdf(invoice: ParentBillingInvoice): void {
  const bytes = buildParentInvoicePdf(invoice);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], {type: "application/pdf"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kidsguard-invoice-${invoice.invoiceNumber || invoice.transactionId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
