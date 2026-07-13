/**
 * NCOA-style economic classification for the official BIR document.
 *
 * The ledger doesn't carry an economic-class dimension, so actual spending is
 * classified from its expenditure category. Approved budgets already carry the
 * clean personnel / other-recurrent / capital split. The mapping below is a
 * documented approximation — programme categories (drugs, training, outreach…)
 * fall to `other`, capital-shaped categories to `capital`.
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
