// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AppProfile } from "@/lib/auth-types";
import { defaultMdaFor } from "@/lib/imports/server";
import { validateBatch, type StagedRowInput, type ValidationContext } from "@/lib/imports/validate";

const MDA_A = "00000000-0000-0000-0000-00000000000a";
const MDA_B = "00000000-0000-0000-0000-00000000000b";

function profile(role: AppProfile["role"], grants: Array<[string, "funding_submitter" | "expenditure_submitter"]> = []): AppProfile {
  return {
    id: "u1",
    full_name: "Test",
    role,
    memberships: grants.map(([mda_id, membership_role], i) => ({ id: `m${i}`, mda_id, membership_role })),
    facilityAssignments: [],
  };
}

describe("default MDA for imports", () => {
  it("defaults an MDA user to the single MDA they are registered under", () => {
    expect(defaultMdaFor(profile("mda_user", [[MDA_A, "funding_submitter"]]), "funding")).toBe(MDA_A);
  });

  it("uses the grant for the ledger being imported", () => {
    const user = profile("mda_user", [[MDA_A, "funding_submitter"], [MDA_B, "expenditure_submitter"]]);
    expect(defaultMdaFor(user, "funding")).toBe(MDA_A);
    expect(defaultMdaFor(user, "expenditure")).toBe(MDA_B);
  });

  it("asks users with several MDAs, and admins, to choose", () => {
    expect(defaultMdaFor(profile("mda_user", [[MDA_A, "funding_submitter"], [MDA_B, "funding_submitter"]]), "funding")).toBeNull();
    expect(defaultMdaFor(profile("admin"), "funding")).toBeNull();
  });
});

function ctx(mapping: ValidationContext["mapping"], defaultMda: string | null): ValidationContext {
  return {
    ledger: "funding",
    mapping,
    options: { date_convention: null, default_mda_id: defaultMda },
    reference: {
      mdas: [
        { id: MDA_A, name: "Ministry of Health", code: "052100100100", abbreviation: "MoH", active: true },
        { id: MDA_B, name: "Hospitals Board", code: "052100300100", abbreviation: "HMB", active: true },
      ],
      programmeAreas: [{ id: "p1", name: "Malaria", active: true }],
      fundingSources: [{ id: "s1", name: "BHCPF Allocation", active: true }],
      expenditureCategories: [], expenditureItems: [], paymentMethods: [], lgas: [], facilities: [], aopActivities: [],
    },
    permittedMdaIds: new Set([MDA_A]),
    publishedPeriods: new Set(),
    existingEntries: new Map(),
    today: "2026-10-14",
  };
}

function row(n: number, raw: Record<string, string>): StagedRowInput {
  return { id: `r${n}`, sourceRowNumber: n, raw, overrides: {}, meta: {}, userExcluded: false };
}

const base = { Date: "2026-10-01", Programme: "Malaria", Amount: "10", Source: "BHCPF Allocation" };
const mapping = { transaction_date: "Date", programme_area: "Programme", amount: "Amount", funding_source: "Source", reference_no: "Ref" };

describe("default MDA in validation", () => {
  it("applies the default to every row when no MDA column is mapped", () => {
    const [result] = validateBatch([row(2, { ...base, Ref: "R1" })], ctx(mapping, MDA_A));
    expect(result.disposition).toBe("eligible");
    expect(result.proposed?.mda_id).toBe(MDA_A);
  });

  it("fills blank MDA cells but never overrides an MDA named in the row", () => {
    const results = validateBatch(
      [
        row(2, { ...base, Ref: "R1", MDA: "" }),
        row(3, { ...base, Ref: "R2", MDA: "MoH" }),
        row(4, { ...base, Ref: "R3", MDA: "HMB" }),
      ],
      ctx({ ...mapping, mda: "MDA" }, MDA_A),
    );
    expect(results[0].proposed?.mda_id).toBe(MDA_A);
    expect(results[1].proposed?.mda_id).toBe(MDA_A);
    expect(results[2].disposition).toBe("blocked");
    expect(results[2].issues.map((i) => i.code)).toContain("mda_not_permitted");
  });

  it("blocks blank MDA cells when there is no default", () => {
    const [result] = validateBatch([row(2, { ...base, Ref: "R1", MDA: "" })], ctx({ ...mapping, mda: "MDA" }, null));
    expect(result.issues.map((i) => i.code)).toContain("field_missing");
  });
});
