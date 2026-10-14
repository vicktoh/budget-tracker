/**
 * Server-side PDF attached to the monthly executive summary: the Budget
 * Implementation Report by MDA and economic class. Built with jsPDF +
 * autotable as vector text (the on-screen report exports rasterise the DOM,
 * which isn't available on the server).
 *
 * jsPDF's built-in fonts are WinAnsi-encoded and have no ₦ glyph, so amounts
 * use the "N" prefix customary in Nigerian finance documents.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExecutiveSummaryModel } from "@/lib/notifications/executive-summary";
import { formatDay, formatPct, MONTH_NAMES } from "@/lib/notifications/format";

function naira(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `N${(value / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `N${(value / 1e6).toFixed(1)}m`;
  return `N${Math.round(value).toLocaleString("en-NG")}`;
}

const GREEN: [number, number, number] = [22, 101, 52];

export function renderExecutiveSummaryPdf(model: ExecutiveSummaryModel): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const quarters = model.quartersWithActuals.length
    ? model.quartersWithActuals.length === 1
      ? `Q${model.quartersWithActuals[0]}`
      : `Q1-Q${Math.max(...model.quartersWithActuals)}`
    : "no quarters";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Kano State Health Sector - Budget Implementation Report", margin, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  const through = model.dataThrough ? ` (through ${formatDay(model.dataThrough)})` : "";
  doc.text(
    `FY${model.fiscalYear} - actuals ${quarters}${through} - prepared for the ${MONTH_NAMES[model.issue.month - 1]} ${model.issue.year} executive summary - amounts in Naira (N)`,
    margin,
    62,
  );
  doc.setTextColor(0);

  const t = model.totals;
  doc.setFontSize(10);
  doc.text(
    `Approved ${naira(t.budget)}   |   Released ${naira(t.released)} (${formatPct(t.releaseRate)})   |   ` +
      `Spent ${naira(t.spent)} (${formatPct(t.utilisation)})   |   Balance ${naira(t.balance)}   |   ` +
      `MDAs up to date with monthly tracking: ${model.upToDateCount} of ${model.mdaCount}`,
    margin,
    84,
  );

  const headStyles = { fillColor: GREEN, textColor: 255, fontStyle: "bold" as const };
  const baseStyles = { fontSize: 8, cellPadding: 4 };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("1. Economic classification", margin, 110);
  autoTable(doc, {
    startY: 118,
    margin: { left: margin, right: margin },
    head: [["Class", "Approved", `Spent ${quarters}`, "Utilisation", "Share of budget"]],
    body: [
      ...model.components.map((c) => [
        c.label,
        naira(c.budget),
        naira(c.spent),
        formatPct(c.utilisation),
        formatPct(t.budget > 0 ? c.budget / t.budget : null),
      ]),
      ["Total", naira(t.budget), naira(t.spent), formatPct(t.utilisation), "100.0%"],
    ],
    headStyles,
    styles: baseStyles,
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) data.cell.styles.halign = "right";
      if (data.section === "body" && data.row.index === model.components.length) data.cell.styles.fontStyle = "bold";
    },
  });

  const afterClass = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("2. Performance by MDA", margin, afterClass + 26);
  autoTable(doc, {
    startY: afterClass + 34,
    margin: { left: margin, right: margin },
    head: [["MDA", "Approved", "Released", "Spent", "Utilisation", "Release rate", "Balance", "Monthly tracking", "MDA users"]],
    body: model.mdas.map((m) => [
      m.name,
      naira(m.budget),
      naira(m.released),
      naira(m.spent),
      formatPct(m.utilisation),
      formatPct(m.releaseRate),
      naira(m.budget - m.spent),
      m.tracking.label.replace("–", "-"),
      m.userCount ? String(m.userCount) : "None",
    ]),
    headStyles,
    styles: baseStyles,
    columnStyles: {
      0: { cellWidth: 200 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      8: { halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index >= 1 && data.column.index <= 6) data.cell.styles.halign = "right";
      if (data.section === "head" && data.column.index === 8) data.cell.styles.halign = "center";
    },
  });

  let sectionY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  if (sectionY > doc.internal.pageSize.getHeight() - 140) {
    doc.addPage();
    sectionY = 46;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("3. MDA spending by economic class (spent / approved, utilisation)", margin, sectionY);
  const classLabels = model.components.map((c) => c.label);
  autoTable(doc, {
    startY: sectionY + 8,
    margin: { left: margin, right: margin },
    head: [["MDA", ...classLabels]],
    body: model.mdas.map((m) => [
      m.name,
      ...classLabels.map((label) => {
        const c = m.classes.find((cls) => cls.label === label);
        if (!c || c.budget === 0) return c && c.spent > 0 ? `${naira(c.spent)} (no budget)` : "-";
        return `${naira(c.spent)} / ${naira(c.budget)}  (${formatPct(c.utilisation)})`;
      }),
    ]),
    headStyles,
    styles: baseStyles,
    columnStyles: { 0: { cellWidth: 200 } },
  });

  const afterClasses = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Data notes", margin, afterClasses + 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80);
  const notes = doc.splitTextToSize(model.dataNotes.map((note) => `- ${note}`).join("\n"), pageWidth - margin * 2);
  doc.text(notes, margin, afterClasses + 42);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(
      `Kano Health Finance Tracker - FY${model.fiscalYear} Budget Implementation Report - page ${page} of ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 20,
    );
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
