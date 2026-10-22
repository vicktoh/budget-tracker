/**
 * Export the year's approved revenue budget lines for the health MDAs (fees,
 * grants, local-government and federal transfers, donor receipts) for the
 * public Revenue page. Read-only against the database in .env.local.
 *
 *   npx tsx scripts/public/export-revenue-budgets.ts 2026
 *
 * Writes src/lib/public/revenue-budgets-<year>.json. Only approved (budgeted)
 * lines are exported; provisional, unbudgeted receipts from MDA returns are
 * not official and never appear on the public site.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.join(__dirname, "..", "..", ".env.local"));

async function main() {
  const year = Number(process.argv[2]);
  if (!year) throw new Error("Usage: export-revenue-budgets.ts <fiscal year>");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db
    .from("budget_line_revenues")
    .select("stream, economic_code, economic_description, receipt_description, approved_amount, source_label, mdas(code)")
    .eq("fiscal_year", year)
    .eq("active", true)
    .gt("approved_amount", 0)
    .order("id");
  if (error) throw error;
  const lines = (data ?? [])
    .filter((r) => !/provisional/i.test(String(r.source_label ?? "")))
    .map((r) => ({
      mdaCode: (r.mdas as unknown as { code: string } | null)?.code ?? "",
      economicCode: r.economic_code as string,
      description: String(r.receipt_description ?? r.economic_description ?? "").trim(),
      stream: r.stream as string,
      amount: Number(r.approved_amount),
    }))
    .filter((l) => l.mdaCode);
  const out = path.join(__dirname, "..", "..", "src", "lib", "public", `revenue-budgets-${year}.json`);
  fs.writeFileSync(out, JSON.stringify({ fiscalYear: year, source: `Kano State Health Sector ${year} approved revenue budget (budget lines)`, lines }, null, 1) + "\n");
  console.log(`${lines.length} lines, ₦${(lines.reduce((a, l) => a + l.amount, 0) / 1e9).toFixed(2)}bn → ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
