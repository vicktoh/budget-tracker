/**
 * Kano health sector objectives — the programme segment of the NCOA programme
 * code, i.e. its first four digits.
 *
 * This is the *policy* lens: what the state set out to achieve, as published in
 * the health sector strategic plan and reproduced on the BPR workbook dashboard
 * ("Expenditure YTD by Health Sector Objectives, Programme Segment Level").
 * It is a different question from `programme_areas`, which is an operational
 * reference list of departments and service lines.
 *
 * A programme code such as `04050110010004` reads as segment `0405` —
 * "adequate and modern health infrastructure".
 */

export type HealthSectorObjective = {
  /** Four-digit programme segment, e.g. "0405". */
  code: string;
  /** Short form, for chart axes. */
  label: string;
  /** Full objective as published in the sector plan. */
  description: string;
};

/** Every objective, in code order — including ones with no spend, so the report shows the gaps. */
export const HEALTH_SECTOR_OBJECTIVES: HealthSectorObjective[] = [
  {
    code: "0401",
    label: "Governance",
    description: "Effective governance of the health system",
  },
  {
    code: "0402",
    label: "Community engagement",
    description: "Community engagement and participation in health",
  },
  {
    code: "0403",
    label: "Essential services (EPHS)",
    description:
      "Enhancement of the delivery of Essential Package of Health Services (EPHS) to all citizens",
  },
  {
    code: "0404",
    label: "Human resources (HRH)",
    description:
      "Provision of the right number and right skill mix of competent, motivated, and productive Human Resources for Health (HRH)",
  },
  {
    code: "0405",
    label: "Health infrastructure",
    description:
      "Provision of adequate and modern health infrastructure for health services delivery",
  },
  {
    code: "0406",
    label: "Medicines & commodities",
    description:
      "Provision of quality, affordable, available, and safe medicines, vaccines, and other health commodities",
  },
  {
    code: "0407",
    label: "Evidence & data",
    description: "Evidence generation and utilisation",
  },
  {
    code: "0408",
    label: "Emergency preparedness",
    description:
      "Institution and maintenance of a responsive public health emergency preparedness system",
  },
  {
    code: "0409",
    label: "Universal health coverage",
    description:
      "Provision of universal health coverage and financial risk protection for citizens",
  },
  {
    code: "0410",
    label: "Not elsewhere classified",
    description: "Health Sector Expenditures Not Elsewhere Classified",
  },
];

const BY_CODE = new Map(HEALTH_SECTOR_OBJECTIVES.map((row) => [row.code, row]));

/**
 * Sentinel bucket for spend that carries no programme segment — in practice
 * entries with no bound budget line (BPR aggregates that span many lines, and
 * personnel recorded by month rather than by economic code). Surfacing it
 * keeps the chart's total honest instead of quietly under-reporting.
 */
export const UNCLASSIFIED_OBJECTIVE: HealthSectorObjective = {
  code: "unclassified",
  label: "Unclassified",
  description:
    "Expenditure not bound to a budget line, so it carries no programme segment",
};

/** Extracts the programme segment from a full NCOA programme code. */
export function programmeSegment(programmeCode: string | null): string | null {
  if (!programmeCode) return null;
  const segment = programmeCode.trim().slice(0, 4);
  return /^\d{4}$/.test(segment) ? segment : null;
}

/**
 * Resolves a programme code to its objective. Codes outside the published
 * health list (another sector's code, say) resolve to `null` so callers can
 * decide whether to drop or bucket them.
 */
export function resolveObjective(
  programmeCode: string | null,
): HealthSectorObjective | null {
  const segment = programmeSegment(programmeCode);
  if (!segment) return null;
  return BY_CODE.get(segment) ?? null;
}
