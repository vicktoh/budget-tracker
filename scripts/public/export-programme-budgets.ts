/**
 * Export the year's approved health budget lines (all MDAs except the PHC
 * Board, whose projects come from the BIR itself) for the public "Health
 * programmes" page. Read-only against the database in .env.local.
 *
 *   npx tsx scripts/public/export-programme-budgets.ts 2026
 *
 * Writes src/lib/public/programme-budgets-<year>.json. The approved budget is
 * published once a year, so re-run it when a new year's budget is loaded.
 * Only capital lines are exported: they name the programme; personnel and
 * overhead lines carry generic economic descriptions only.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.join(__dirname, "..", "..", ".env.local"));

const PHC_BOARD = "052100500100";
const SOURCE_LABEL = (year: number) => `Kano State Health Sector ${year} Approved Budget`;

async function main() {
  const year = Number(process.argv[2]);
  if (!year) throw new Error("Usage: export-programme-budgets.ts <fiscal year>");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("approved_budget_lines")
      .select("budget_class, economic_code, economic_description, project_description, approved_amount, mdas(code, name)")
      .eq("fiscal_year", year)
      .eq("active", true)
      .eq("source_label", SOURCE_LABEL(year))
      // Named programmes are capital projects; overhead lines carry only generic
      // economic descriptions ("Drugs/laboratory/medical supplies") that cannot be placed.
      .eq("budget_class", "capital")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const lines = rows
    .map((r) => {
      const mda = r.mdas as { code: string; name: string } | null;
      return {
        mdaCode: mda?.code ?? "",
        description: String((r.project_description as string | null) ?? (r.economic_description as string | null) ?? "").trim(),
        budgetClass: r.budget_class as string,
        economicCode: r.economic_code as string | null,
        amount: Number(r.approved_amount),
      };
    })
    .filter((l) => l.mdaCode && l.mdaCode !== PHC_BOARD && l.amount > 0);

  const out = path.join(__dirname, "..", "..", "src", "lib", "public", `programme-budgets-${year}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify({ fiscalYear: year, source: `${SOURCE_LABEL(year)} (budget lines)`, lines }, null, 1) + "\n",
  );
  console.log(`${lines.length} lines → ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
