/**
 * Vector-text PDF for the audit report. Unlike the canvas pipeline used by the
 * other reports, this renders selectable, searchable tables via jspdf-autotable
 * — the right shape for voucher registers that can run to many pages. Loaded on
 * demand so the PDF libraries stay out of the main bundle.
 */
export type AuditPdfSection = {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  /** Column indexes to right-align (amounts). */
  rightAlign?: number[];
};

export type AuditPdfSummaryItem = {
  label: string;
  value: string;
  helper: string;
};

export async function exportAuditPdf(
  sections: AuditPdfSection[],
  filename: string,
  meta: { title: string; period: string; summary?: AuditPdfSummaryItem[] },
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text(meta.title, 40, 44);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(meta.period, 40, 60);
  doc.setTextColor(0);

  let startY = 80;
  if (meta.summary && meta.summary.length > 0) {
    const gap = 10;
    const cardWidth = (pageWidth - 80 - gap * 3) / 4;
    const cardHeight = 62;

    for (const [index, item] of meta.summary.slice(0, 4).entries()) {
      const x = 40 + index * (cardWidth + gap);
      doc.setDrawColor(211, 216, 222);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, 76, cardWidth, cardHeight, 4, 4, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 108, 119);
      doc.text(item.label.toUpperCase(), x + 9, 90);

      doc.setFontSize(12);
      doc.setTextColor(20, 32, 47);
      doc.text(item.value, x + 9, 108);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 108, 119);
      const helperLines = doc.splitTextToSize(item.helper, cardWidth - 18).slice(0, 2);
      doc.text(helperLines, x + 9, 121);
    }

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    startY = 158;
  }
  for (const section of sections) {
    const columnStyles: Record<number, { halign: "right" }> = {};
    for (const index of section.rightAlign ?? []) {
      columnStyles[index] = { halign: "right" };
    }

    doc.setFontSize(11);
    doc.text(section.title, 40, startY);

    autoTable(doc, {
      head: [section.columns],
      body: section.rows,
      startY: startY + 8,
      margin: { left: 40, right: 40 },
      tableWidth: pageWidth - 80,
      styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [31, 41, 51], textColor: 255, fontSize: 7 },
      columnStyles,
    });

    const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    startY = (lastTable?.finalY ?? startY) + 28;
    if (startY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      startY = 60;
    }
  }

  doc.save(filename);
}
