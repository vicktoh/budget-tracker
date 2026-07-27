/**
 * NCOA-style economic classification for the official BIR document.
 *
 * Preferred source is the approved budget line an entry is bound to: it carries
 * the real NCOA `budget_class` (personnel / overhead / capital), so no guessing
 * is involved. Entries with no bound line fall back to `classifyCategory`,
 * which infers the class from the expenditure category name.
 *
 * That fallback is a documented approximation — programme-shaped categories
 * (outreach, monitoring, transport…) collapse to `other` even when the spend is
 * capital. It under-reported Q1 2026 PHCMB capital by ₦1.89bn until those
 * entries were bound to their budget lines, so prefer `classifyEntry` over
 * `classifyCategory` anywhere an entry is in hand.
 */
export type EconomicClass = "personnel" | "overhead" | "capital" | "other";

export const ECONOMIC_CLASS_LABEL: Record<EconomicClass, string> = {
  personnel: "Personnel",
  overhead: "Overhead",
  capital: "Capital",
  other: "Other recurrent",
};

/** Order used for table rows. */
export const ECONOMIC_CLASS_ORDER: EconomicClass[] = [
  "personnel",
  "overhead",
  "capital",
  "other",
];

export function classifyCategory(categoryName: string): EconomicClass {
  const name = categoryName.toLowerCase();
  if (name.includes("personnel")) return "personnel";
  if (name.includes("overhead")) return "overhead";
  if (
    name.includes("capital") ||
    name.includes("infrastructure") ||
    name.includes("equipment") ||
    name.includes("furniture")
  ) {
    return "capital";
  }
  return "other";
}

/** The `budget_class` values an approved budget line can carry. */
const BUDGET_CLASSES = new Set<EconomicClass>(["personnel", "overhead", "capital"]);

/**
 * Classifies one expenditure row, preferring the bound budget line's NCOA
 * class and falling back to the category-name heuristic when the row isn't
 * bound to a line.
 */
export function classifyEntry(entry: {
  budget_class: string | null;
  expenditure_category_name: string;
}): EconomicClass {
  const fromLine = entry.budget_class as EconomicClass | null;
  if (fromLine && BUDGET_CLASSES.has(fromLine)) return fromLine;
  return classifyCategory(entry.expenditure_category_name);
}
