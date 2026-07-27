import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260716050000_disable_expenditure_funding_warnings.sql",
  ),
  "utf8",
);

describe("disabled expenditure funding warnings migration", () => {
  it("clears existing warnings and replaces synchronization with cleanup only", () => {
    expect(sql).toContain("delete from public.entry_data_quality_warnings");
    expect(sql).toContain("warning_code = 'funding_source_over_allocated'");
    expect(sql).toContain(
      "create or replace function app_private.sync_expenditure_funding_warnings",
    );
    expect(sql).not.toContain("insert into public.entry_data_quality_warnings");
  });

  it("retains the evaluation RPC for a future re-enable", () => {
    expect(sql).not.toContain("drop function public.evaluate_expenditure_funding_warnings");
  });
});
