import { describe, expect, it } from "vitest";
import {
  assignedFacilityIds,
  canAccessRoute,
  canReviewMda,
  canSubmitExpenditureForMda,
  canSubmitForMda,
  canSubmitFundingForMda,
  canViewMda,
  expenditureSubmittableMdaIds,
  facilityUserMdaId,
  fundingSubmittableMdaIds,
  getDefaultPathForProfile,
  getRoleLabel,
  hasMultipleMdas,
  hasSingleMda,
  isAdmin,
  isFacilityUser,
  isMdaUser,
  isReviewer,
  reviewableMdaIds,
  submittableMdaIds,
  viewableMdaIds,
} from "@/lib/access";
import type {
  AppProfile,
  FacilityAssignment,
  MdaMembership,
} from "@/lib/auth-types";

const MDA_A = "11111111-1111-1111-1111-111111111111";
const MDA_B = "22222222-2222-2222-2222-222222222222";
const MDA_C = "33333333-3333-3333-3333-333333333333";
const FACILITY_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FACILITY_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const LGA_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";

type GrantRole = MdaMembership["membership_role"];

function membership(
  mdaId: string,
  role: GrantRole,
  id = `${mdaId}-${role}`,
): MdaMembership {
  return {
    id,
    mda_id: mdaId,
    membership_role: role,
    mdas: { id: mdaId, name: "Test MDA", abbreviation: "TMDA" },
  };
}

function assignment(
  facilityId: string,
  mdaId: string,
): FacilityAssignment {
  return {
    id: `${facilityId}-assignment`,
    facility_id: facilityId,
    mda_id: mdaId,
    facilities: {
      id: facilityId,
      name: "Test PHC",
      lga_id: LGA_A,
      facility_type: "phc",
    },
    mdas: { id: mdaId, name: "Test MDA", abbreviation: "TMDA" },
  };
}

function profile(
  role: AppProfile["role"],
  memberships: MdaMembership[] = [],
  facilityAssignments: FacilityAssignment[] = [],
): AppProfile {
  return {
    id: "user-1",
    full_name: "Test user",
    role,
    memberships,
    facilityAssignments,
  };
}

describe("role checks", () => {
  it("identifies role types", () => {
    expect(isAdmin(profile("admin"))).toBe(true);
    expect(isReviewer(profile("reviewer"))).toBe(true);
    expect(isMdaUser(profile("mda_user"))).toBe(true);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("canAccessRoute", () => {
  it("denies unauthenticated users", () => {
    expect(canAccessRoute(null, "/mda")).toBe(false);
  });

  it("admins reach every authenticated route", () => {
    const admin = profile("admin");
    expect(canAccessRoute(admin, "/admin")).toBe(true);
    expect(canAccessRoute(admin, "/imports")).toBe(true);
    expect(canAccessRoute(admin, "/admin/reports")).toBe(true);
    expect(canAccessRoute(admin, "/admin/reports/cso")).toBe(true);
    expect(canAccessRoute(admin, "/funding")).toBe(true);
  });

  it("reviewers reach review and report routes by role", () => {
    // Route access to the review queue and reports is role-based; the reviewer
    // role reviews every MDA. Admin-only surfaces stay closed.
    const reviewer = profile("reviewer");
    expect(canAccessRoute(reviewer, "/admin")).toBe(false);
    expect(canAccessRoute(reviewer, "/imports")).toBe(false);
    expect(canAccessRoute(reviewer, "/review")).toBe(true);
    expect(canAccessRoute(reviewer, "/admin/reports")).toBe(true);
    expect(canAccessRoute(reviewer, "/admin/reports/audit")).toBe(true);
    expect(canAccessRoute(reviewer, "/admin/reports/bir")).toBe(true);
    expect(canAccessRoute(reviewer, "/funding")).toBe(false);
  });

  it("mda users without grants cannot reach entry routes", () => {
    const submitter = profile("mda_user");
    expect(canAccessRoute(submitter, "/review")).toBe(false);
    expect(canAccessRoute(submitter, "/imports")).toBe(false);
    expect(canAccessRoute(submitter, "/funding")).toBe(false);
    expect(canAccessRoute(submitter, "/expenditure")).toBe(false);
  });

  it("mda users with submit grants can reach entry routes", () => {
    const submitter = profile("mda_user", [
      membership(MDA_A, "funding_submitter"),
      membership(MDA_A, "expenditure_submitter"),
    ]);
    expect(canAccessRoute(submitter, "/funding")).toBe(true);
    expect(canAccessRoute(submitter, "/expenditure")).toBe(true);
    expect(canAccessRoute(submitter, "/review")).toBe(false);
  });

  it("mda users reach submit routes from grants but not role-gated review routes", () => {
    // Submit access is grant-based; review-queue and report access is role-based,
    // so an mda_user (even with a reviewer membership) does not get those routes.
    const hybrid = profile("mda_user", [
      membership(MDA_A, "funding_submitter"),
      membership(MDA_B, "expenditure_submitter"),
      membership(MDA_C, "reviewer"),
    ]);
    expect(canAccessRoute(hybrid, "/funding")).toBe(true);
    expect(canAccessRoute(hybrid, "/expenditure")).toBe(true);
    expect(canAccessRoute(hybrid, "/review")).toBe(false);
    expect(canAccessRoute(hybrid, "/admin/reports")).toBe(false);
  });

  it("facility users reach only expenditure and settings", () => {
    const facility = profile("facility_user", [], [assignment(FACILITY_A, MDA_A)]);
    expect(canAccessRoute(facility, "/expenditure")).toBe(true);
    expect(canAccessRoute(facility, "/settings")).toBe(true);
    expect(canAccessRoute(facility, "/funding")).toBe(false);
    expect(canAccessRoute(facility, "/review")).toBe(false);
    expect(canAccessRoute(facility, "/admin")).toBe(false);
    expect(canAccessRoute(facility, "/admin/users")).toBe(false);
    expect(canAccessRoute(facility, "/mda")).toBe(false);
    expect(canAccessRoute(facility, "/imports")).toBe(false);
  });

  it("only admins reach user management", () => {
    expect(canAccessRoute(profile("admin"), "/admin/users")).toBe(true);
    expect(canAccessRoute(profile("reviewer"), "/admin/users")).toBe(false);
    expect(canAccessRoute(profile("mda_user"), "/admin/users")).toBe(false);
  });

  it("only admins reach reference data management and request queue", () => {
    expect(canAccessRoute(profile("admin"), "/admin/reference-data")).toBe(true);
    expect(canAccessRoute(profile("admin"), "/admin/reference-requests")).toBe(true);
    expect(canAccessRoute(profile("reviewer"), "/admin/reference-data")).toBe(false);
    expect(canAccessRoute(profile("mda_user"), "/admin/reference-requests")).toBe(false);
    expect(canAccessRoute(profile("facility_user"), "/admin/reference-data")).toBe(false);
  });

  it("only admins reach approved budgets and AOP activities", () => {
    expect(canAccessRoute(profile("admin"), "/admin/budgets")).toBe(true);
    expect(canAccessRoute(profile("admin"), "/admin/aop-activities")).toBe(true);
    expect(canAccessRoute(profile("reviewer"), "/admin/budgets")).toBe(false);
    expect(canAccessRoute(profile("mda_user"), "/admin/aop-activities")).toBe(false);
    expect(canAccessRoute(profile("facility_user"), "/admin/budgets")).toBe(false);
  });

  it("any authenticated role can submit a reference value request", () => {
    expect(canAccessRoute(profile("mda_user"), "/reference-requests")).toBe(true);
    expect(canAccessRoute(profile("reviewer"), "/reference-requests")).toBe(true);
    expect(canAccessRoute(profile("admin"), "/reference-requests")).toBe(true);
    expect(canAccessRoute(profile("facility_user"), "/reference-requests")).toBe(true);
    expect(canAccessRoute(null, "/reference-requests")).toBe(false);
  });
});

describe("getDefaultPathForProfile", () => {
  it.each([
    ["admin", "/admin"],
    ["facility_user", "/expenditure"],
  ] as const)("routes %s to %s", (role, expected) => {
    expect(getDefaultPathForProfile(profile(role))).toBe(expected);
  });

  it("routes reviewers to the review queue by role", () => {
    expect(getDefaultPathForProfile(profile("reviewer"))).toBe("/review");
  });

  it("routes submit-capable users to the MDA dashboard", () => {
    expect(
      getDefaultPathForProfile(
        profile("mda_user", [membership(MDA_A, "funding_submitter")]),
      ),
    ).toBe("/mda");
  });
});

describe("getRoleLabel", () => {
  it("labels every role including facility users", () => {
    expect(getRoleLabel("admin")).toBe("Admin");
    expect(getRoleLabel("reviewer")).toBe("Viewer");
    expect(getRoleLabel("mda_user")).toBe("MDA User");
    expect(getRoleLabel("facility_user")).toBe("Facility User");
  });
});

describe("facility-user capability helpers", () => {
  const singleFacility = profile("facility_user", [], [
    assignment(FACILITY_A, MDA_A),
  ]);
  const multiFacility = profile("facility_user", [], [
    assignment(FACILITY_A, MDA_A),
    assignment(FACILITY_B, MDA_A),
  ]);
  const unassigned = profile("facility_user");

  it("identifies facility users", () => {
    expect(isFacilityUser(singleFacility)).toBe(true);
    expect(isFacilityUser(profile("mda_user"))).toBe(false);
    expect(isMdaUser(singleFacility)).toBe(false);
  });

  it("resolves the single reporting MDA and assigned facilities", () => {
    expect(facilityUserMdaId(singleFacility)).toBe(MDA_A);
    expect(assignedFacilityIds(multiFacility).sort()).toEqual(
      [FACILITY_A, FACILITY_B].sort(),
    );
    expect(facilityUserMdaId(unassigned)).toBeNull();
    expect(assignedFacilityIds(unassigned)).toEqual([]);
  });

  it("treats the reporting MDA as expenditure-submittable and viewable", () => {
    expect(canSubmitExpenditureForMda(singleFacility, MDA_A)).toBe(true);
    expect(canSubmitFundingForMda(singleFacility, MDA_A)).toBe(false);
    expect(canSubmitForMda(singleFacility, MDA_A)).toBe(true);
    expect(canSubmitForMda(singleFacility, MDA_B)).toBe(false);
    expect(expenditureSubmittableMdaIds(singleFacility)).toEqual([MDA_A]);
    expect(fundingSubmittableMdaIds(singleFacility)).toEqual([]);
    expect(submittableMdaIds(singleFacility)).toEqual([MDA_A]);
    expect(viewableMdaIds(singleFacility)).toEqual([MDA_A]);
  });

  it("never grants review access to facility users", () => {
    expect(canReviewMda(singleFacility, MDA_A)).toBe(false);
    expect(reviewableMdaIds(singleFacility)).toEqual([]);
  });

  it("returns no MDA scope for unassigned facility users", () => {
    expect(submittableMdaIds(unassigned)).toEqual([]);
    expect(viewableMdaIds(unassigned)).toEqual([]);
  });

  it("ignores facility assignments for non-facility roles", () => {
    const mdaUserWithStrayAssignment = profile("mda_user", [], [
      assignment(FACILITY_A, MDA_A),
    ]);
    expect(assignedFacilityIds(mdaUserWithStrayAssignment)).toEqual([]);
    expect(facilityUserMdaId(mdaUserWithStrayAssignment)).toBeNull();
  });
});

describe("granular MDA-scoped capability helpers", () => {
  const admin = profile("admin");
  const fundingOnly = profile("mda_user", [
    membership(MDA_A, "funding_submitter"),
  ]);
  const expenditureOnly = profile("mda_user", [
    membership(MDA_A, "expenditure_submitter"),
  ]);
  const dualLedger = profile("mda_user", [
    membership(MDA_A, "funding_submitter"),
    membership(MDA_A, "expenditure_submitter"),
    membership(MDA_B, "funding_submitter"),
    membership(MDA_B, "expenditure_submitter"),
  ]);
  const reviewer = profile("reviewer");

  it("admins can submit, review, and view every MDA", () => {
    expect(canSubmitFundingForMda(admin, MDA_A)).toBe(true);
    expect(canSubmitExpenditureForMda(admin, MDA_C)).toBe(true);
    expect(canReviewMda(admin, MDA_C)).toBe(true);
    expect(canViewMda(admin, MDA_C)).toBe(true);
  });

  it("funding-only submitters cannot submit expenditure", () => {
    expect(canSubmitFundingForMda(fundingOnly, MDA_A)).toBe(true);
    expect(canSubmitExpenditureForMda(fundingOnly, MDA_A)).toBe(false);
    expect(canSubmitForMda(fundingOnly, MDA_A)).toBe(true);
    expect(canSubmitForMda(fundingOnly, MDA_B)).toBe(false);
    expect(fundingSubmittableMdaIds(fundingOnly)).toEqual([MDA_A]);
    expect(expenditureSubmittableMdaIds(fundingOnly)).toEqual([]);
  });

  it("expenditure-only submitters cannot submit funding", () => {
    expect(canSubmitExpenditureForMda(expenditureOnly, MDA_A)).toBe(true);
    expect(canSubmitFundingForMda(expenditureOnly, MDA_A)).toBe(false);
    expect(canSubmitForMda(expenditureOnly, MDA_A)).toBe(true);
    expect(expenditureSubmittableMdaIds(expenditureOnly)).toEqual([MDA_A]);
    expect(fundingSubmittableMdaIds(expenditureOnly)).toEqual([]);
  });

  it("reviewers can review and view every MDA but cannot submit", () => {
    // Review is role-based now, so a reviewer covers all MDAs with no memberships.
    expect(canReviewMda(reviewer, MDA_A)).toBe(true);
    expect(canReviewMda(reviewer, MDA_B)).toBe(true);
    expect(canReviewMda(reviewer, MDA_C)).toBe(true);
    expect(canViewMda(reviewer, MDA_C)).toBe(true);
    expect(canSubmitFundingForMda(reviewer, MDA_B)).toBe(false);
    expect(canSubmitExpenditureForMda(reviewer, MDA_B)).toBe(false);
    expect(canSubmitForMda(reviewer, MDA_B)).toBe(false);
    expect(submittableMdaIds(reviewer)).toEqual([]);
  });

  it("mda users submit on their grants and never review", () => {
    const submitter = profile("mda_user", [
      membership(MDA_A, "funding_submitter"),
      membership(MDA_B, "expenditure_submitter"),
    ]);
    expect(canSubmitFundingForMda(submitter, MDA_A)).toBe(true);
    expect(canSubmitFundingForMda(submitter, MDA_C)).toBe(false);
    expect(canSubmitExpenditureForMda(submitter, MDA_B)).toBe(true);
    expect(canReviewMda(submitter, MDA_A)).toBe(false);
    expect(canReviewMda(submitter, MDA_C)).toBe(false);
    expect(reviewableMdaIds(submitter)).toEqual([]);
    expect(fundingSubmittableMdaIds(submitter)).toEqual([MDA_A]);
    expect(expenditureSubmittableMdaIds(submitter)).toEqual([MDA_B]);
  });

  it("computes submittable / reviewable / viewable MDA ID sets", () => {
    expect(fundingSubmittableMdaIds(dualLedger).sort()).toEqual([MDA_A, MDA_B]);
    expect(expenditureSubmittableMdaIds(dualLedger).sort()).toEqual([
      MDA_A,
      MDA_B,
    ]);
    expect(submittableMdaIds(dualLedger).sort()).toEqual([MDA_A, MDA_B]);
    expect(reviewableMdaIds(dualLedger)).toEqual([]);
    expect(viewableMdaIds(dualLedger).sort()).toEqual([MDA_A, MDA_B]);
    expect(submittableMdaIds(admin)).toEqual([]);
    expect(reviewableMdaIds(admin)).toEqual([]);
  });

  it("flags single vs multi MDA membership", () => {
    expect(hasSingleMda(fundingOnly)).toBe(true);
    expect(hasMultipleMdas(fundingOnly)).toBe(false);
    expect(hasSingleMda(dualLedger)).toBe(false);
    expect(hasMultipleMdas(dualLedger)).toBe(true);
  });
});
