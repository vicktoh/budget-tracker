import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/imports/csv";
import { headerImpliesScaledUnit, parseNairaAmount, parseTransactionDate } from "@/lib/imports/normalize";
import { buildIssueReportCsv, safeSpreadsheetCell } from "@/lib/imports/summary";
import { buildTable, gridFromCsv } from "@/lib/imports/table";
import { validateBatch, type ValidationContext } from "@/lib/imports/validate";

describe("import normalisers", () => {
  it("parses exact naira amounts and rejects unsafe ones", () => {
    expect(parseNairaAmount("₦1,500,000.5")).toMatchObject({ ok: true, value: "1500000.50" });
    expect(parseNairaAmount("(2,000)")).toMatchObject({ ok: false, code: "amount_negative" });
    expect(parseNairaAmount("0")).toMatchObject({ ok: false, code: "amount_zero" });
    expect(parseNairaAmount("10.005")).toMatchObject({ ok: false, code: "amount_precision" });
    expect(parseNairaAmount("$100")).toMatchObject({ ok: false, code: "amount_currency" });
  });

  it("checks real calendar dates and requires a convention for numeric dates", () => {
    expect(parseTransactionDate("2026-02-31", null)).toMatchObject({ ok: false, code: "date_invalid" });
    expect(parseTransactionDate("04/05/2026", null)).toMatchObject({ ok: false, code: "date_convention_required" });
    expect(parseTransactionDate("04/05/2026", "dmy")).toMatchObject({ ok: true, value: "2026-05-04" });
    expect(parseTransactionDate("04/05/2026", "mdy")).toMatchObject({ ok: true, value: "2026-04-05" });
    expect(parseTransactionDate("4 May 2026", null)).toMatchObject({ ok: true, value: "2026-05-04" });
  });

  it("reads CSV with BOM, semicolons, quoted newlines and leading zeros", () => {
    const rows = parseCsv('﻿code;note\n"052100";"line one\nline two"\n');
    expect(rows).toEqual([["code", "note"], ["052100", "line one\nline two"]]);
  });

  it("treats scaled amount headers as ambiguous units", () => {
    expect(headerImpliesScaledUnit("Amount (₦'000)")).toBe(true);
    expect(headerImpliesScaledUnit("Amount in millions")).toBe(true);
    expect(headerImpliesScaledUnit("Amount (₦)")).toBe(false);
  });

  it("neutralises formula injection in exports", () => {
    expect(safeSpreadsheetCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeSpreadsheetCell("PV-1")).toBe("PV-1");
    const csv = buildIssueReportCsv(["Amount"], [
      { sourceRowNumber: 2, disposition: "eligible", issues: [], raw: { Amount: "=1+1" }, overrides: { Amount: "7.00" } },
    ]);
    const [, line] = csv.split("\r\n");
    expect(line).toBe(`2,eligible,,,,,"Amount: ""=1+1"" → ""7.00""",'=1+1`);
  });
});

const MDA = "00000000-0000-0000-0000-00000000000a";
const OTHER_MDA = "00000000-0000-0000-0000-00000000000b";

function ctx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    ledger: "funding",
    mapping: { transaction_date: "Date", mda: "MDA", programme_area: "Programme", amount: "Amount", funding_source: "Source", reference_no: "Ref" },
    options: { date_convention: null, default_mda_id: null },
    reference: {
      mdas: [
        { id: MDA, name: "Ministry of Health", code: "052100100100", abbreviation: "MoH", active: true },
        { id: OTHER_MDA, name: "Hospitals Board", code: "052100300100", abbreviation: "HMB", active: true },
      ],
      programmeAreas: [{ id: "p1", name: "Malaria", slug: "malaria", active: true }],
      fundingSources: [{ id: "s1", name: "State Budget Release", slug: "state-budget-release", active: true }],
      expenditureCategories: [], expenditureItems: [], paymentMethods: [], lgas: [], facilities: [], aopActivities: [],
    },
    permittedMdaIds: new Set([MDA]),
    publishedPeriods: new Set(["2026-Q1"]),
    existingEntries: new Map(),
    today: "2026-10-13",
    ...overrides,
  };
}

function rowsFromCsv(text: string) {
  const table = buildTable(gridFromCsv(parseCsv(text)))!;
  return table.rows.map((row) => ({ id: `r${row.sourceRowNumber}`, sourceRowNumber: row.sourceRowNumber, raw: row.raw, overrides: {}, meta: row.meta, userExcluded: false }));
}

describe("import row validation", () => {
  const csv = [
    "Date,MDA,Programme,Amount,Source,Ref",
    "2026-07-02,MoH,Malaria,\"1,000.00\",State Budget Release,R-1",
    "2026-07-02,MoH,Malaria,1000,State Budget Release,R-1",
    "2026-07-03,HMB,Malaria,500,State Budget Release,R-2",
    "2026-02-10,MoH,Malaria,500,State Budget Release,R-3",
    "2026-07-04,MoH,Malaria,500,Donor,R-4",
    "Total,,,2500,,",
  ].join("\n");

  it("assigns dispositions without guessing", () => {
    const results = validateBatch(rowsFromCsv(csv), ctx());
    const byRow = Object.fromEntries(results.map((r) => [r.sourceRowNumber, r]));
    expect(byRow[2].disposition).toBe("eligible");
    expect(byRow[3].disposition).toBe("duplicate");
    expect(byRow[4].issues.map((i) => i.code)).toContain("mda_not_permitted");
    expect(byRow[5].issues.map((i) => i.code)).toContain("quarter_published");
    expect(byRow[6].issues.map((i) => i.code)).toContain("reference_unknown");
    expect(byRow[7].disposition).toBe("excluded");
  });

  it("skips unchanged existing entries and blocks conflicting ones", () => {
    const existing = new Map([["2026|" + MDA + "|R-1", { public_id: "FND-2026-0001", amount: "999.00", transaction_date: "2026-07-02" }]]);
    const results = validateBatch(rowsFromCsv(csv), ctx({ existingEntries: existing }));
    expect(results.find((r) => r.sourceRowNumber === 2)!.issues.map((i) => i.code)).toContain("reference_conflict_existing");
  });
});
