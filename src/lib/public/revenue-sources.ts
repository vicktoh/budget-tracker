/**
 * Where health MDAs' own revenue is expected to come from, grouped from the
 * approved revenue budget lines (NCOA revenue codes + receipt descriptions).
 * Collections are reported only as a total per MDA, so the split applies to
 * the budget.
 */

export type RevenueSourceKey = "federal" | "lga" | "donor" | "fees" | "other";

export const REVENUE_SOURCES: Record<RevenueSourceKey, { name: string; hint: string; color: string }> = {
  federal: { name: "Federal government", hint: "FGN grants, including the Basic Health Care Provision Fund (BHCPF)", color: "#00879b" },
  lga: { name: "Local governments", hint: "The 44 LGAs' contributions, such as the 1% health grant", color: "#ff7a2e" },
  donor: { name: "Donors and partners", hint: "UNICEF, foundations and other development partners", color: "#14b0c8" },
  fees: { name: "Fees and charges", hint: "Patient admissions, drug sales, tender fees, licences and fines", color: "#e14242" },
  other: { name: "Other income", hint: "Investment and other income", color: "#9a958a" },
};

export const REVENUE_ORDER: RevenueSourceKey[] = ["federal", "lga", "donor", "fees", "other"];

export function classifyRevenue(economicCode: string, description: string): RevenueSourceKey {
  const code = economicCode ?? "";
  if (/^1302010[34]/.test(code) || /local government|\blgas?\b|1%/i.test(description)) return "lga";
  if (/^13020102/.test(code) || /\bfgn\b|federal|bhcpf|basic health ?care/i.test(description)) return "federal";
  if (/^1301/.test(code) || /^130202/.test(code) || /^13020106/.test(code) || /unicef|donor|donation|foundation|bmcf|dangote|gates|lafiya|aid/i.test(description))
    return "donor";
  if (/^1202/.test(code) && !/^120211/.test(code)) return "fees";
  return "other";
}
