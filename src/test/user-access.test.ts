import { describe, expect, it } from "vitest";
import {
  buildMembershipRows,
  grantsFromMemberships,
  isMdaScopedRole,
  validateUserAccess,
} from "@/lib/admin/user-access";

describe("isMdaScopedRole", () => {
  it("treats only mda_user as MDA-scoped", () => {
    expect(isMdaScopedRole("mda_user")).toBe(true);
    // Reviewers review every MDA via their role, so they carry no per-MDA grants.
    expect(isMdaScopedRole("reviewer")).toBe(false);
    expect(isMdaScopedRole("admin")).toBe(false);
  });
});

describe("validateUserAccess", () => {
  it("requires at least one grant for MDA-scoped users", () => {
    expect(
      validateUserAccess("mda_user", {
        funding_mda_ids: [],
        expenditure_mda_ids: [],
        mda_id: null,
        facility_ids: [],
      }),
    ).toMatch(/funding-entry access/i);
  });

  it("does not require grants for reviewers", () => {
    expect(
      validateUserAccess("reviewer", {
        funding_mda_ids: [],
        expenditure_mda_ids: [],
        mda_id: null,
        facility_ids: [],
      }),
    ).toBeNull();
  });
});

describe("buildMembershipRows", () => {
  it("creates separate funding and expenditure membership rows", () => {
    const rows = buildMembershipRows("user-1", "mda_user", {
      funding_mda_ids: ["mda-a"],
      expenditure_mda_ids: ["mda-a", "mda-b"],
    });
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.membership_role === "funding_submitter")).toHaveLength(1);
    expect(rows.filter((row) => row.membership_role === "expenditure_submitter")).toHaveLength(2);
  });

  it("creates no rows for reviewers", () => {
    expect(
      buildMembershipRows("user-1", "reviewer", {
        funding_mda_ids: [],
        expenditure_mda_ids: [],
      }),
    ).toHaveLength(0);
  });
});

describe("grantsFromMemberships", () => {
  it("reconstructs grant lists from membership rows", () => {
    expect(
      grantsFromMemberships([
        { mda_id: "mda-a", membership_role: "funding_submitter" },
        { mda_id: "mda-b", membership_role: "expenditure_submitter" },
      ]),
    ).toEqual({
      funding_mda_ids: ["mda-a"],
      expenditure_mda_ids: ["mda-b"],
    });
  });
});
