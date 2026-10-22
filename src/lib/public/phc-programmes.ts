/**
 * Health programmes for the primary health care page.
 *
 * The BIR codes 2026 PHC spending to a single programme objective ("Effective
 * governance of the health system"), so the public page groups the Board's
 * capital projects into health programmes by matching project names. The
 * amounts are the report's own; only the grouping is ours, and the page says
 * so. Rules are ordered: the first match wins.
 */

export type PhcProgrammeKey =
  | "immunisation"
  | "family_planning"
  | "mnch"
  | "nutrition"
  | "malaria"
  | "disease_control"
  | "essential_services"
  | "community"
  | "drugs_supplies"
  | "facilities"
  | "health_systems"
  | "other";

export const PHC_PROGRAMMES: Record<PhcProgrammeKey, { name: string; blurb: string }> = {
  immunisation: { name: "Immunisation", blurb: "Routine immunisation, vaccine cold chain and delivery" },
  family_planning: { name: "Family planning", blurb: "Child birth spacing services" },
  mnch: { name: "Maternal, newborn & child health", blurb: "Mothers, newborns, children and school health" },
  nutrition: { name: "Nutrition", blurb: "Malnutrition treatment, nutrition corners, infant feeding" },
  malaria: { name: "Malaria", blurb: "Seasonal malaria chemoprevention" },
  disease_control: { name: "Disease control & emergencies", blurb: "TB, communicable diseases, surveillance, labs" },
  essential_services: { name: "Essential PHC services", blurb: "Minimum service package, quality of care, NCDs, mental, eye and oral health" },
  community: { name: "Community health", blurb: "Community health workers, mobilisation and engagement" },
  drugs_supplies: { name: "Drugs & supplies", blurb: "Drug revolving fund, logistics and commodities" },
  facilities: { name: "Facilities & equipment", blurb: "Building and renovating PHCs and offices, vehicles, power" },
  health_systems: { name: "Health system management", blurb: "Coordination, planning, data, finance and oversight" },
  other: { name: "Other PHC activities", blurb: "Projects that fit none of the groups above" },
};

const RULES: [PhcProgrammeKey, RegExp][] = [
  ["disease_control", /epidemiolog|outbreak/i],
  ["immunisation", /immuni[sz]|vaccine|cold store|cold chain|polio/i],
  ["family_planning", /birth spacing|family planning/i],
  ["nutrition", /nutrition|malnutrition|\bsam\b|infant and young child|iycf|breastfeeding|\bebf\b/i],
  ["mnch", /maternal|new ?born|child health|imnch|semchic|school health|resus/i],
  ["disease_control", /(?<!non )communicable|tuber ?cul|\btb\b|leprosy|\bhiv\b|\baids\b|hepatitis|sickle|surveillance|public health emergency|public health laborator|laboratory services|f[ue]r?m[a-z]*gation/i],
  ["malaria", /malaria|\bsmc\b/i],
  ["essential_services", /minimal service|minimum service|\bmsp\b|quality of care|referral|mobile health|field unit|non communicable|mental health|eye care|oral health/i],
  ["community", /community|acsm|placo|influencers|promoters/i],
  ["drugs_supplies", /\bdrf\b|drug|consumable|logistic|lmcu|nhci/i],
  ["facilities", /construct|renovat|building|incinerator|solari[sz]|upgrade|vehicle|generator|office/i],
  ["health_systems", /coordinat|management information|data|hmis|financ|administrat|oversight|supervision|evidence|operational plan|contributory|human resource|printing/i],
];

export function classifyPhcProject(name: string): PhcProgrammeKey {
  for (const [key, rx] of RULES) if (rx.test(name)) return key;
  return "other";
}

/**
 * Programmes that other MDAs fund too, so the public page totals their budget
 * across all MDAs. The other groups (facilities, management, essential PHC
 * services, drugs) describe the PHC Board's own operations and stay Board-only.
 */
export const CROSS_MDA_PROGRAMMES: PhcProgrammeKey[] = [
  "immunisation",
  "family_planning",
  "mnch",
  "nutrition",
  "malaria",
  "disease_control",
];

/**
 * KHETFUND passes a fixed share of its revenue on to programmes run by other
 * bodies ("remittances"); counting those under the programmes would count the
 * same naira twice.
 */
export function isPassThrough(description: string): boolean {
  return /remit|re-?mit|remiitance|disbursement of/i.test(description);
}
