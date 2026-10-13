// @vitest-environment node
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildTable } from "@/lib/imports/table";
import { inspectZipArchive, inventorySheets, loadWorkbook, readSheetGrid } from "@/lib/imports/xlsx";

async function workbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Expenditure Log");
  workbook.addWorksheet("LOOKUP").state = "hidden";
  sheet.addRow(["Kano expenditure log"]);
  sheet.addRow(["Date", "MDA code", "Amount", "Voucher"]);
  sheet.addRow([new Date(Date.UTC(2026, 4, 4)), "052100100100", 1500.5, "PV-1"]);
  sheet.addRow(["2026-05-05", "052100100100", { formula: "C3*2", result: 3001 }, "PV-2"]);
  sheet.addRow(["2026-05-06", "052100100100", { formula: "C3*3" }, "PV-3"]);
  const hidden = sheet.addRow(["2026-05-07", "052100100100", 10, "PV-4"]);
  hidden.hidden = true;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("xlsx extraction", () => {
  it("reads cached values, flags formulas, hidden rows and keeps codes as text", async () => {
    const buffer = await workbookBuffer();
    expect(inspectZipArchive(buffer)).toEqual({ ok: true });
    const workbook = await loadWorkbook(buffer);
    expect(inventorySheets(workbook).map((s) => [s.name, s.state])).toEqual([
      ["Expenditure Log", "visible"],
      ["LOOKUP", "hidden"],
    ]);
    const table = buildTable(readSheetGrid(workbook, "Expenditure Log")!)!;
    expect(table.headerRowNumber).toBe(2);
    expect(table.headers).toEqual(["Date", "MDA code", "Amount", "Voucher"]);
    const [first, second, third, fourth] = table.rows;
    expect(first.raw).toMatchObject({ Date: "2026-05-04", "MDA code": "052100100100", Amount: "1500.5" });
    expect(second.raw.Amount).toBe("3001");
    expect(second.meta.formula_headers).toEqual(["Amount"]);
    expect(third.meta.missing_cache_headers).toEqual(["Amount"]);
    expect(fourth.meta.hidden).toBe(true);
    expect(table.hiddenRows).toBe(1);
  });

  it("skips merged title banners and unused formula template rows", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Funding Log");
    sheet.addRow(["KANO STATE MINISTRY OF HEALTH — FUNDING LOG (2026)"]);
    sheet.mergeCells("A1:E1");
    sheet.addRow(["ID", "Date", "MDA", "Amount (₦)", "Reference No."]);
    sheet.addRow([{ formula: "ROW()-2", result: 1 }, "2026-07-01", "MoH", 100, "R-1"]);
    sheet.addRow([{ formula: 'IF(B4="","",ROW()-2)' }, null, null, null, null]);
    const loaded = await loadWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
    const table = buildTable(readSheetGrid(loaded, "Funding Log")!)!;
    expect(table.headerRowNumber).toBe(2);
    expect(table.headers).toEqual(["ID", "Date", "MDA", "Amount (₦)", "Reference No."]);
    expect(table.rows).toHaveLength(1);
    expect(table.formulaOnlyRowsSkipped).toBe(1);
  });

  it("rejects non-zip and truncated archives before decompressing", async () => {
    expect(inspectZipArchive(Buffer.from("Date,Amount\n"))).toMatchObject({ ok: false });
    const buffer = await workbookBuffer();
    expect(inspectZipArchive(buffer.subarray(0, buffer.length - 30))).toMatchObject({ ok: false });
  });
});
