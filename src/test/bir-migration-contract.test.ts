import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260715132044_remove_ledger_statuses_add_bir_publication_locks.sql",
  ),
  "utf8",
);

describe("quarterly BIR migration contract", () => {
  it("archives and removes rejected entries before dropping ledger statuses", () => {
    const archive = sql.indexOf("insert into public.archived_ledger_entries");
    const removeRejected = sql.indexOf("delete from public.funding_entries where status = 'rejected'");
    const dropStatus = sql.indexOf("drop column status");
    expect(archive).toBeGreaterThan(-1);
    expect(removeRejected).toBeGreaterThan(archive);
    expect(dropStatus).toBeGreaterThan(removeRejected);
  });

  it("locks both old and new transaction periods and allocation writes", () => {
    expect(sql).toContain("entry_fiscal_year(old.transaction_date)");
    expect(sql).toContain("entry_fiscal_year(new.transaction_date)");
    expect(sql).toContain("create trigger enforce_funding_bir_publication_lock");
    expect(sql).toContain("create trigger enforce_expenditure_bir_publication_lock");
    expect(sql).toContain("create trigger enforce_expenditure_allocation_bir_publication_lock");
  });

  it("keeps publication metadata append-only and exposes no table writes", () => {
    expect(sql).toContain("create trigger prevent_bir_publication_mutation");
    expect(sql).toContain("grant select on public.budget_implementation_report_publications to authenticated");
    expect(sql).not.toContain("grant insert on public.budget_implementation_report_publications");
    expect(sql).not.toContain("grant update on public.budget_implementation_report_publications");
    expect(sql).not.toContain("grant delete on public.budget_implementation_report_publications");
  });

  it("removes review commands and exposes Admin publication/amendment commands", () => {
    expect(sql).toContain("drop function if exists public.review_entry");
    expect(sql).toContain("drop function if exists public.resubmit_entry");
    expect(sql).toContain("publish_budget_implementation_report");
    expect(sql).toContain("amend_published_funding_entry");
    expect(sql).toContain("amend_published_expenditure_entry");
  });
});
