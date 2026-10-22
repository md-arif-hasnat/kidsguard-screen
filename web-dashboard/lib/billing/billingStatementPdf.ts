import type { AdminMonthlyBillingReport } from "./BillingRepository";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const ROWS_PER_PAGE = 27;

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

function pageCommands(
  report: AdminMonthlyBillingReport,
  rows: AdminMonthlyBillingReport["countryBreakdown"],
  pageNumber: number,
  pageCount: number
): string {
  const commands: string[] = ["0.12 0.16 0.23 rg"];
  addText(commands, "KidsGuard", 44, 794, 20, true);
  addText(
    commands,
    "MONTHLY SUBSCRIPTION REVENUE & TAX STATEMENT",
    44,
    771,
    11,
    true
  );
  addText(commands, `Billing month: ${report.month}`, 44, 748, 10);
  addText(
    commands,
    `Generated: ${new Date(report.generatedAt).toISOString()}`,
    310,
    748,
    8
  );
  addText(
    commands,
    `Completed subscription transactions: ${report.transactionCount}`,
    44,
    729,
    9
  );

  commands.push("0.93 0.94 0.96 rg 40 688 515 25 re f");
  commands.push("0.12 0.16 0.23 rg");
  addText(commands, "Country", 48, 697, 8, true);
  addText(commands, "Currency", 128, 697, 8, true);
  addText(commands, "Payments", 195, 697, 8, true);
  addText(commands, "Net", 270, 697, 8, true);
  addText(commands, "Tax", 370, 697, 8, true);
  addText(commands, "Collected", 465, 697, 8, true);

  let y = 671;
  for (const row of rows) {
    addText(commands, row.countryCode, 48, y, 8);
    addText(commands, row.currencyCode, 128, y, 8);
    addText(commands, String(row.transactionCount), 205, y, 8);
    addText(commands, money(row.net, row.currencyCode), 270, y, 8);
    addText(commands, money(row.tax, row.currencyCode), 370, y, 8);
    addText(commands, money(row.gross, row.currencyCode), 465, y, 8);
    commands.push(`0.88 0.90 0.93 RG 44 ${y - 8} m 551 ${y - 8} l S`);
    y -= 21;
  }

  if (pageNumber === pageCount) {
    y = Math.max(92, y - 12);
    addText(commands, "Payout reconciliation", 44, y, 10, true);
    y -= 18;
    for (const payout of report.payoutTotals) {
      addText(
        commands,
        `${payout.currencyCode}: collected ${money(payout.gross, payout.currencyCode)} | ` +
          `tax ${money(payout.tax, payout.currencyCode)} | ` +
          `fees ${money(payout.fees, payout.currencyCode)} | ` +
          `earnings ${money(payout.earnings, payout.currencyCode)}`,
        44,
        y,
        8
      );
      y -= 14;
    }
    addText(
      commands,
      "Source: Paddle completed subscription transactions. Amounts are kept in their original currencies.",
      44,
      Math.max(57, y - 8),
      7
    );
    addText(
      commands,
      "This is an internal revenue and tax statement, not a customer tax invoice.",
      44,
      Math.max(45, y - 20),
      7,
      true
    );
  }

  addText(commands, `Page ${pageNumber} of ${pageCount}`, 480, 25, 7);
  return commands.join("\n");
}

export function buildMonthlyBillingStatementPdf(
  report: AdminMonthlyBillingReport
): Uint8Array {
  const chunks: AdminMonthlyBillingReport["countryBreakdown"][] = [];
  const rows = report.countryBreakdown.length > 0
    ? report.countryBreakdown
    : [{
        countryCode: "NO ACTIVITY",
        currencyCode: "-",
        transactionCount: 0,
        net: 0,
        tax: 0,
        gross: 0,
        taxRates: [],
      }];
  for (let index = 0; index < rows.length; index += ROWS_PER_PAGE) {
    chunks.push(rows.slice(index, index + ROWS_PER_PAGE));
  }

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const pageIds: number[] = [];
  chunks.forEach((chunk, index) => {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    const stream = pageCommands(report, chunk, index + 1, chunks.length);
    pageIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

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

export function downloadMonthlyBillingStatement(
  report: AdminMonthlyBillingReport
): void {
  const bytes = buildMonthlyBillingStatementPdf(report);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kidsguard-subscription-statement-${report.month}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
