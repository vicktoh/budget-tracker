/**
 * Format-neutral table extraction. CSV and XLSX readers both produce a grid
 * of text cells; this module finds the header row, names columns uniquely and
 * turns each nonempty data row into a staged source row with provenance.
 */

export type SourceCell = {
  text: string;
  /** Cell value came from a formula's cached result. */
  formula?: boolean;
  /** Cell is a formula with no cached result, so its value is unknown. */
  missingCachedValue?: boolean;
};

export type SourceGridRow = {
  /** 1-based row number in the source sheet or file. */
  rowNumber: number;
  cells: SourceCell[];
  hidden?: boolean;
};

export type SourceRowMeta = {
  hidden?: boolean;
  formula_headers?: string[];
  missing_cache_headers?: string[];
};

export type StagedSourceRow = {
  sourceRowNumber: number;
  raw: Record<string, string>;
  meta: SourceRowMeta;
};

export type ExtractedTable = {
  headerRowNumber: number;
  headers: string[];
  rows: StagedSourceRow[];
  blankRowsSkipped: number;
  /** Template rows whose only content is formulas with no saved result. */
  formulaOnlyRowsSkipped: number;
  hiddenRows: number;
};

function columnLetter(index: number): string {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function hasText(row: SourceGridRow): boolean {
  return row.cells.some((cell) => cell.text.trim());
}

/** No text, but formulas with no saved result: an unused template row. */
function isFormulaOnly(row: SourceGridRow): boolean {
  return !hasText(row) && row.cells.some((cell) => cell.missingCachedValue);
}

const HEADER_SCAN_ROWS = 30;

function textCellCount(row: SourceGridRow): number {
  return row.cells.filter((cell) => {
    const text = cell.text.trim();
    return text && !/^-?[\d,.]+$/.test(text) && !/^\d{4}-\d{2}-\d{2}$/.test(text);
  }).length;
}

/**
 * The header is the earliest row, among the first rows of the sheet, whose
 * count of non-numeric labels is close to the widest such row. Title banners,
 * "Period: Q1" lines and logos above the table have fewer labels and are
 * skipped; they are not data and are not counted as skipped data rows.
 */
function findHeaderIndex(grid: SourceGridRow[]): number {
  const scan = grid.slice(0, HEADER_SCAN_ROWS);
  const best = Math.max(0, ...scan.map(textCellCount));
  if (best < 2) return -1;
  return scan.findIndex((row) => textCellCount(row) >= Math.max(2, Math.ceil(best * 0.8)));
}

export function buildTable(grid: SourceGridRow[]): ExtractedTable | null {
  const headerIndex = findHeaderIndex(grid);
  if (headerIndex === -1) return null;

  const headerRow = grid[headerIndex];
  const width = Math.max(...grid.slice(headerIndex).map((row) => row.cells.length));
  const seen = new Map<string, number>();
  const headers = Array.from({ length: width }, (_, index) => {
    const base = headerRow.cells[index]?.text.trim().replace(/\s+/g, " ") || `Column ${columnLetter(index)}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });

  let blankRowsSkipped = 0;
  let formulaOnlyRowsSkipped = 0;
  let hiddenRows = 0;
  const rows: StagedSourceRow[] = [];
  for (const row of grid.slice(headerIndex + 1)) {
    if (isFormulaOnly(row)) {
      formulaOnlyRowsSkipped++;
      continue;
    }
    if (!hasText(row)) {
      blankRowsSkipped++;
      continue;
    }
    const raw: Record<string, string> = {};
    const formulaHeaders: string[] = [];
    const missingCacheHeaders: string[] = [];
    headers.forEach((header, index) => {
      const cell = row.cells[index];
      raw[header] = cell?.text ?? "";
      if (cell?.formula) formulaHeaders.push(header);
      if (cell?.missingCachedValue) missingCacheHeaders.push(header);
    });
    const meta: SourceRowMeta = {};
    if (row.hidden) {
      meta.hidden = true;
      hiddenRows++;
    }
    if (formulaHeaders.length) meta.formula_headers = formulaHeaders;
    if (missingCacheHeaders.length) meta.missing_cache_headers = missingCacheHeaders;
    rows.push({ sourceRowNumber: row.rowNumber, raw, meta });
  }

  return {
    headerRowNumber: headerRow.rowNumber,
    headers,
    rows,
    blankRowsSkipped,
    formulaOnlyRowsSkipped,
    hiddenRows,
  };
}

export function gridFromCsv(rows: string[][]): SourceGridRow[] {
  return rows.map((cells, index) => ({
    rowNumber: index + 1,
    cells: cells.map((text) => ({ text })),
  }));
}
