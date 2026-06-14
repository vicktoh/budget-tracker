import { describe, expect, it } from "vitest";
import {
  assignedFacilityIds,
  canAccessRoute,
  canReviewMda,
  canSubmitForMda,
  canViewMda,
  facilityUserMdaId,
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

function membership(
  mdaId: string,
  role: "submitter" | "reviewer",
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
    expect(canAccessRoute(admin, "/exports")).toBe(true);
    expect(canAccessRoute(admin, "/funding")).toBe(true);
  });

  it("reviewers cannot reach admin-only routes", () => {
    const reviewer = profile("reviewer");
    expect(canAccessRoute(reviewer, "/admin")).toBe(false);
    expect(canAccessRoute(reviewer, "/imports")).toBe(false);
    expect(canAccessRoute(reviewer, "/review")).toBe(true);
    expect(canAccessRoute(reviewer, "/exports")).toBe(true);
  });

  it("mda users cannot review or import", () => {
    const submitter = profile("mda_user");
    expect(canAccessRoute(submitter, "/review")).toBe(false);
    expect(canAccessRoute(submitter, "/imports")).toBe(false);
    expect(canAccessRoute(submitter, "/funding")).toBe(true);
    expect(canAccessRoute(submitter, "/expenditure")).toBe(true);
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
    ["reviewer", "/review"],
    ["mda_user", "/mda"],
    ["facility_user", "/expenditure"],
  ] as const)("routes %s to %s", (role, expected) => {
    expect(getDefaultPathForProfile(profile(role))).toBe(expected);
  });
});

describe("getRoleLabel", () => {
  it("labels every role including facility users", () => {
    expect(getRoleLabel("admin")).toBe("Admin");
    expect(getRoleLabel("reviewer")).toBe("Reviewer");
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

  it("treats the reporting MDA as submittable and viewable", () => {
    expect(canSubmitForMda(singleFacility, MDA_A)).toBe(true);
    expect(canSubmitForMda(singleFacility, MDA_B)).toBe(false);
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

describe("MDA-scoped capability helpers", () => {
  const admin = profile("admin");
  const singleSubmitter = profile("mda_user", [membership(MDA_A, "submitter")]);
  const multiSubmitter = profile("mda_user", [
    membership(MDA_A, "submitter"),
    membership(MDA_B, "submitter"),
  ]);
  const reviewer = profile("reviewer", [membership(MDA_B, "reviewer")]);

  it("admins can submit, review, and view every MDA", () => {
    expect(canSubmitForMda(admin, MDA_A)).toBe(true);
    expect(canReviewMda(admin, MDA_C)).toBe(true);
    expect(canViewMda(admin, MDA_C)).toBe(true);
  });

  it("submitters can only submit for assigned MDAs", () => {
    expect(canSubmitForMda(singleSubmitter, MDA_A)).toBe(true);
    expect(canSubmitForMda(singleSubmitter, MDA_B)).toBe(false);
    expect(canReviewMda(singleSubmitter, MDA_A)).toBe(false);
    expect(canViewMda(singleSubmitter, MDA_A)).toBe(true);
  });

  it("reviewers cannot submit for an MDA they only review", () => {
    expect(canSubmitForMda(reviewer, MDA_B)).toBe(false);
    expect(canReviewMda(reviewer, MDA_B)).toBe(true);
    expect(canReviewMda(reviewer, MDA_A)).toBe(false);
  });

  it("computes submittable / reviewable / viewable MDA ID sets", () => {
    expect(submittableMdaIds(multiSubmitter).sort()).toEqual([MDA_A, MDA_B]);
    expect(reviewableMdaIds(multiSubmitter)).toEqual([]);
    expect(viewableMdaIds(multiSubmitter).sort()).toEqual([MDA_A, MDA_B]);
    expect(submittableMdaIds(admin)).toEqual([]);
    expect(reviewableMdaIds(admin)).toEqual([]);
  });

  it("flags single vs multi MDA membership", () => {
    expect(hasSingleMda(singleSubmitter)).toBe(true);
    expect(hasMultipleMdas(singleSubmitter)).toBe(false);
    expect(hasSingleMda(multiSubmitter)).toBe(false);
    expect(hasMultipleMdas(multiSubmitter)).toBe(true);
  });
});
