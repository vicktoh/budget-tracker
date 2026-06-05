import { describe, expect, it } from "vitest";
import {
  canAccessRoute,
  canReviewMda,
  canSubmitForMda,
  canViewMda,
  getDefaultPathForProfile,
  hasMultipleMdas,
  hasSingleMda,
  isAdmin,
  isMdaUser,
  isReviewer,
  reviewableMdaIds,
  submittableMdaIds,
  viewableMdaIds,
} from "@/lib/access";
import type { AppProfile, MdaMembership } from "@/lib/auth-types";

const MDA_A = "11111111-1111-1111-1111-111111111111";
const MDA_B = "22222222-2222-2222-2222-222222222222";
const MDA_C = "33333333-3333-3333-3333-333333333333";

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

function profile(
  role: AppProfile["role"],
  memberships: MdaMembership[] = [],
): AppProfile {
  return {
    id: "user-1",
    full_name: "Test user",
    role,
    memberships,
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
});

describe("getDefaultPathForProfile", () => {
  it.each([
    ["admin", "/admin"],
    ["reviewer", "/review"],
    ["mda_user", "/mda"],
  ] as const)("routes %s to %s", (role, expected) => {
    expect(getDefaultPathForProfile(profile(role))).toBe(expected);
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
