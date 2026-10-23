import { describe, expect, it } from "vitest";
import { createPublicAssistantTools, stepGuard } from "@/lib/public/assistant";
import { buildHealthProgrammes, matchProgrammes } from "@/lib/public/health-programmes";
import { buildExplorerData } from "@/lib/public/model";
import { programmeFunders, programmeTotal } from "@/lib/public/phc-programmes";
import type { PublicDataset, PublicFigure } from "@/lib/public/types";

const project = (name: string, budget: number, spent: number): PublicFigure => ({
  report_id: "r26q2",
  lens: "phc_project",
  econ_class: "capital",
  code: null,
  row_key: name,
  name,
  mda_code: "052100500100",
  original_budget: budget,
  revised_budget: null,
  quarter_actual: null,
  ytd_actual: spent,
  table_number: null,
  page: 53,
  note: null,
});

// The PHC Board's 2026 Q2 projects (BIR p. 53) that the page groups as maternal,
// newborn & child health, plus one it counts under immunisation.
const ds: PublicDataset = {
  reports: [
    {
      id: "r26q2",
      slug: "2026-Q2",
      fiscal_year: 2026,
      quarter: 2,
      full_year_only: false,
      title: "Kano State 2026 Q2 Budget Performance Report",
      source_url: "",
      source_note: null,
      storage_path: null,
      sha256: null,
      file_bytes: null,
      page_count: null,
      data_status: "published",
      data_note: null,
      published_at: null,
    },
  ],
  figures: [
    project("Establishment Of Newborn Resuccitation Center In All The 44 LGAs In The State", 445_900_000, 223_000_000),
    project("Integrated Maternal, New Born And Child Health (IMNCH) /Coordination Of School", 40_000_000, 0),
    project("Supporting The Semchic Programme - Primary Health Care H/Q", 30_000_000, 0),
    project("Conduction/Provision Of Routine Immunization Programme Across The State", 2_912_466_762, 1_543_773_032),
  ],
  entities: [
    { lens: "mda", code: "052100100100", name: "Ministry of Health", short_name: "SMOH", sort_order: 1 },
    { lens: "mda", code: "052100300100", name: "Hospitals Management Board (HQ and zones)", short_name: "HMB", sort_order: 2 },
    { lens: "mda", code: "052100300200", name: "Muhammadu Abdullahi Wase Specialist Hospital", short_name: "MAWSH", sort_order: 3 },
  ],
};

const mnchFunders = [
  { name: "SMOH", amount: 2_200_000_000 },
  { name: "HMB", amount: 1_500_000_000 },
  { name: "PHC Board", amount: 515_900_000 },
  { name: "MAWSH", amount: 256_100_000 },
];

describe("health programmes (the /phc cards)", () => {
  const [report] = buildHealthProgrammes(ds);
  const mnch = report.programmes.find((p) => p.key === "mnch")!;

  it("adds the PHC Board's projects to other MDAs' approved budget lines", () => {
    expect(mnch.b).toBe(515_900_000);
    expect(mnch.y).toBe(223_000_000);
    expect(programmeFunders(mnch).map(({ name, amount }) => ({ name, amount: Math.round(amount / 1e5) * 1e5 }))).toEqual(mnchFunders);
    expect(programmeTotal(mnch)).toBeCloseTo(4_472_000_000, -6);
  });

  it("leaves KHETFUND remittances out", () => {
    expect(programmeFunders(mnch).some((f) => f.code === "052100900100")).toBe(false);
    expect(report.passThrough).toBeGreaterThanOrEqual(360_000_000);
  });

  it("matches visitors' words to the page's programmes", () => {
    expect(matchProgrammes("Maternal, newborn & child health Mothers, newborns, children and school health")).toEqual(["mnch"]);
    expect(matchProgrammes("MNCH")).toEqual(["mnch"]);
    expect(matchProgrammes("vaccines")).toEqual(["immunisation"]);
    expect(matchProgrammes("TB")).toEqual(["disease_control"]);
    expect(matchProgrammes("immunisation, malaria and nutrition")).toEqual(["immunisation", "nutrition", "malaria"]);
    expect(matchProgrammes("newborn resuscitation")).toEqual(["mnch"]);
    expect(matchProgrammes("road construction")).toEqual([]);
  });
});

describe("Ask AI reads the same programme figures", () => {
  const tools = createPublicAssistantTools(ds, buildExplorerData(ds, () => null));
  const call = <T,>(t: { execute?: (input: T, options: never) => unknown }, input: T) => t.execute!(input, {} as never) as Promise<any>;

  it("returns the card's totals, funders and lines", async () => {
    const out = await call(tools.getHealthProgrammes, { programme: "Mothers, newborns, children and school health" });
    expect(out.period).toBe("January–June 2026");
    expect(out.programmes).toHaveLength(1);
    const [p] = out.programmes;
    expect(p.name).toBe("Maternal, newborn & child health");
    expect(p.totalBudget).toBe(programmeTotal(buildHealthProgrammes(ds)[0].programmes.find((x) => x.key === "mnch")!));
    expect(p.budgetByMda.map((f: { shortName: string }) => f.shortName)).toEqual(["SMOH", "HMB", "PHC Board", "MAWSH"]);
    expect(p.phcBoard).toEqual({ budget: 515_900_000, spentYearToDate: 223_000_000, shareOfBudgetSpent: 43.2 });
    expect(p.lines.map((l: { item: string }) => l.item)).toContain("Free Maternal And Child Health");
    expect(p.lines.some((l: { item: string }) => /routine immuni/i.test(l.item))).toBe(false);
  });

  it("points name searches at the programmes tool", async () => {
    const out = await call(tools.findEntity, { query: "Maternal" });
    expect(out.matches[0]).toMatchObject({ lens: "healthProgramme", name: "Maternal, newborn & child health", useTool: "getHealthProgrammes" });
  });

  it("says so when no programme matches", async () => {
    const out = await call(tools.getHealthProgrammes, { programme: "roads" });
    expect(out.available).toBe(false);
  });
});

describe("stepGuard", () => {
  it("lets the second-to-last step only draw, and makes the last step write", () => {
    expect(stepGuard(0)).toEqual({});
    expect(stepGuard(6)).toEqual({ activeTools: ["renderTable", "renderChart"] });
    expect(stepGuard(7)).toEqual({ toolChoice: "none" });
  });
});

describe("getHealthProgrammes periods", () => {
  const tools = createPublicAssistantTools(ds, buildExplorerData(ds, () => null));

  it("reads a placeholder year as the latest report", async () => {
    const out = (await tools.getHealthProgrammes.execute!({ programme: "maternal", year: 0, quarter: 1 }, {} as never)) as { period: string };
    expect(out.period).toBe("January–June 2026");
  });
});
