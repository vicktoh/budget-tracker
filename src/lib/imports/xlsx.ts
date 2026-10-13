import ExcelJS from "exceljs";
import type { SourceCell, SourceGridRow } from "@/lib/imports/table";

/**
 * Server-side XLSX reader (Node runtime only; imported by API routes). Reads cached values only: formulas are never
 * evaluated, macros are not supported (.xlsm is rejected upstream) and
 * external links are not followed. A formula with no cached result is
 * reported as unknown rather than read as blank or zero.
 */

export type SheetInventory = {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  rowCount: number;
};

export const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 5000;

/**
 * Inspect the ZIP central directory before decompressing anything, so a small
 * upload cannot expand into gigabytes of XML. A valid directory does not prove
 * the workbook's relationships or cells are valid; ExcelJS still has to load it.
 */
export function inspectZipArchive(buffer: Buffer): { ok: true } | { ok: false; message: string } {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
    return { ok: false, message: "This file is not an Excel workbook (.xlsx). Save it as .xlsx or CSV and upload again." };
  }
  const searchStart = Math.max(0, buffer.length - 65557);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    return { ok: false, message: "The workbook archive is damaged (no central directory). Re-save it in Excel and upload again." };
  }
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount > MAX_ZIP_ENTRIES) {
    return { ok: false, message: `The workbook contains ${entryCount} internal parts, above the ${MAX_ZIP_ENTRIES} limit.` };
  }
  let offset = directoryOffset;
  let total = 0;
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      return { ok: false, message: "The workbook archive is damaged (bad directory entry). Re-save it in Excel and upload again." };
    }
    const flags = buffer.readUInt16LE(offset + 8);
    if (flags & 0x1) {
      return { ok: false, message: "The workbook is encrypted or password-protected. Remove the password and upload again." };
    }
    total += buffer.readUInt32LE(offset + 24);
    if (total > MAX_UNCOMPRESSED_BYTES) {
      return { ok: false, message: "The workbook expands to more than 100 MB of data, above the import limit." };
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { ok: true };
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return isoDate(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as Array<{ text?: string }>).map((part) => part.text ?? "").join("");
    }
    if (typeof v.text === "string") return v.text;
    if (typeof v.error === "string") return v.error;
  }
  return String(value);
}

function readCell(value: ExcelJS.CellValue): SourceCell {
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const v = value as unknown as Record<string, unknown>;
    if ("formula" in v || "sharedFormula" in v) {
      if (v.result === undefined || v.result === null) {
        return { text: "", formula: true, missingCachedValue: true };
      }
      return { text: scalarText(v.result).trim(), formula: true };
    }
  }
  return { text: scalarText(value).trim() };
}

export async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS's type expects its own Buffer alias; Node's Buffer is compatible.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

export function inventorySheets(workbook: ExcelJS.Workbook): SheetInventory[] {
  return workbook.worksheets.map((sheet) => ({
    name: sheet.name,
    state: (sheet.state as SheetInventory["state"]) ?? "visible",
    rowCount: sheet.actualRowCount,
  }));
}

export function readSheetGrid(workbook: ExcelJS.Workbook, sheetName: string): SourceGridRow[] | null {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return null;
  const grid: SourceGridRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: SourceCell[] = [];
    const width = row.cellCount;
    for (let col = 1; col <= width; col++) {
      const cell = row.getCell(col);
      // A merged range repeats its master value in every covered cell; read it
      // once so a merged title banner doesn't look like a row of headers.
      if (cell.isMerged && cell.master && cell.master.address !== cell.address) {
        cells.push({ text: "" });
      } else {
        cells.push(readCell(cell.value));
      }
    }
    grid.push({ rowNumber, cells, hidden: row.hidden || undefined });
  });
  return grid;
}
