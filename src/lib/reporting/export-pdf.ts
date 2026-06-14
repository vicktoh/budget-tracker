import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 8;

/**
 * Captures a DOM element (charts included — Recharts renders SVG, which
 * html2canvas-pro rasterizes) and saves it as a multi-page A4 PDF.
 *
 * Elements marked with `data-pdf-exclude` (e.g. the download button itself)
 * are skipped during capture.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const background =
    window.getComputedStyle(document.body).backgroundColor || "#ffffff";

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: background,
    ignoreElements: (node) =>
      node instanceof HTMLElement && node.hasAttribute("data-pdf-exclude"),
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const contentWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const contentHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;

  // Canvas pixels that fit on one PDF page at the chosen content width.
  const pageHeightPx = Math.floor(
    (contentHeightMm / contentWidthMm) * canvas.width,
  );

  const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  for (let page = 0; page < pageCount; page += 1) {
    const sliceHeightPx = Math.min(
      pageHeightPx,
      canvas.height - page * pageHeightPx,
    );
    if (sliceHeightPx <= 0) break;

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeightPx;
    const context = slice.getContext("2d");
    if (!context) throw new Error("Could not create export canvas context.");

    context.fillStyle = background;
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(
      canvas,
      0,
      page * pageHeightPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    );

    if (page > 0) pdf.addPage();
    const sliceHeightMm = (sliceHeightPx / canvas.width) * contentWidthMm;
    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      PAGE_MARGIN_MM,
      PAGE_MARGIN_MM,
      contentWidthMm,
      sliceHeightMm,
    );
  }

  pdf.save(filename);
}
