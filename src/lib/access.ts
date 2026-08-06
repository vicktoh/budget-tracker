import type {
  AppProfile,
  AppRole,
  FacilityAssignment,
  MdaMembership,
} from "@/lib/auth-types";

export type AppRoute =
  | "/mda"
  | "/funding"
  | "/expenditure"
  | "/entries"
  | "/admin"
  | "/admin/reports"
  | "/admin/reports/cso"
  | "/admin/reports/bir"
  | "/admin/reports/audit"
  | "/admin/reports/mbp"
  | "/admin/users"
  | "/admin/reference-data"
  | "/admin/reference-requests"
  | "/admin/budgets"
  | "/admin/aop-activities"
  | "/reference-requests"
  | "/imports"
  | "/assistant"
  | "/settings";

const routeRoles: Record<AppRoute, AppRole[]> = {
  "/mda": ["mda_user", "reviewer", "admin"],
  "/funding": ["mda_user", "admin"],
  "/expenditure": ["mda_user", "admin", "facility_user"],
  "/entries": ["mda_user", "reviewer", "admin", "facility_user"],
  "/admin": ["admin"],
  "/admin/reports": ["admin", "reviewer"],
  "/admin/reports/cso": ["admin", "reviewer"],
  "/admin/reports/bir": ["admin", "reviewer"],
  "/admin/reports/audit": ["admin", "reviewer"],
  "/admin/reports/mbp": ["admin", "reviewer"],
  "/admin/users": ["admin"],
  "/admin/reference-data": ["admin"],
  "/admin/reference-requests": ["admin"],
  "/admin/budgets": ["admin"],
  "/admin/aop-activities": ["admin"],
  "/reference-requests": ["mda_user", "reviewer", "admin", "facility_user"],
  "/imports": ["admin"],
  "/assistant": ["mda_user", "reviewer", "admin", "facility_user"],
  "/settings": ["mda_user", "reviewer", "admin", "facility_user"],
};

export type ProfileForCapability = Pick<
  AppProfile,
  "role" | "memberships" | "facilityAssignments"
> | null;

export function isAdmin(profile: ProfileForCapability): boolean {
  return profile?.role === "admin";
}

export function isReviewer(profile: ProfileForCapability): boolean {
  return profile?.role === "reviewer";
}

export function isMdaUser(profile: ProfileForCapability): boolean {
  return profile?.role === "mda_user";
}

export function isFacilityUser(profile: ProfileForCapability): boolean {
  return profile?.role === "facility_user";
}

function membershipsForMda(
  profile: ProfileForCapability,
  mdaId: string,
): MdaMembership[] {
  if (!profile) return [];
  return profile.memberships.filter((membership) => membership.mda_id === mdaId);
}

/** Facility assignments for a facility user (empty for every other role). */
export function assignedFacilities(
  profile: ProfileForCapability,
): FacilityAssignment[] {
  if (!profile || profile.role !== "facility_user") return [];
  return profile.facilityAssignments;
}

/** The single MDA a facility user reports under, or null. */
export function facilityUserMdaId(
  profile: ProfileForCapability,
): string | null {
  const assignments = assignedFacilities(profile);
  return assignments[0]?.mda_id ?? null;
}

/** Facility IDs a facility user may submit/view expenditure for. */
export function assignedFacilityIds(profile: ProfileForCapability): string[] {
  return assignedFacilities(profile).map((a) => a.facility_id);
}

/** The set of MDA IDs a user can submit funding entries for. */
export function fundingSubmittableMdaIds(
  profile: ProfileForCapability,
): string[] {
  if (!profile) return [];
  if (isAdmin(profile)) return [];
  const ids = new Set<string>();
  for (const membership of profile.memberships) {
    if (membership.membership_role === "funding_submitter") {
      ids.add(membership.mda_id);
    }
  }
  return Array.from(ids);
}

/** The set of MDA IDs a user can submit expenditure entries for. */
export function expenditureSubmittableMdaIds(
  profile: ProfileForCapability,
): string[] {
  if (!profile) return [];
  if (isAdmin(profile)) return [];
  if (isFacilityUser(profile)) {
    const mdaId = facilityUserMdaId(profile);
    return mdaId ? [mdaId] : [];
  }
  const ids = new Set<string>();
  for (const membership of profile.memberships) {
    if (membership.membership_role === "expenditure_submitter") {
      ids.add(membership.mda_id);
    }
  }
  return Array.from(ids);
}

/** The set of MDA IDs a user can submit any ledger entry for. */
export function submittableMdaIds(profile: ProfileForCapability): string[] {
  return Array.from(
    new Set([
      ...fundingSubmittableMdaIds(profile),
      ...expenditureSubmittableMdaIds(profile),
    ]),
  );
}

/** Every MDA ID a user has any kind of membership in. */
export function viewableMdaIds(profile: ProfileForCapability): string[] {
  if (!profile) return [];
  if (isAdmin(profile)) return [];
  if (isFacilityUser(profile)) {
    const mdaId = facilityUserMdaId(profile);
    return mdaId ? [mdaId] : [];
  }
  const ids = new Set<string>();
  for (const membership of profile.memberships) {
    ids.add(membership.mda_id);
  }
  return Array.from(ids);
}

/** True when the profile has any MDA-scoped grant (submit and/or review). */
export function hasMdaScopedGrants(profile: ProfileForCapability): boolean {
  if (!profile || isAdmin(profile) || isFacilityUser(profile)) return false;
  return (
    fundingSubmittableMdaIds(profile).length > 0 ||
    expenditureSubmittableMdaIds(profile).length > 0
  );
}

export function getDefaultPathForProfile(profile: ProfileForCapability) {
  if (!profile) return "/sign-in";
  if (isAdmin(profile)) return "/admin";
  if (isFacilityUser(profile)) return "/expenditure";

  const canSubmit = submittableMdaIds(profile).length > 0;

  if (canSubmit) return "/mda";
  if (isReviewer(profile)) return "/mda";

  return "/mda";
}

export function canAccessRoute(
  profile: ProfileForCapability | null,
  route: AppRoute,
) {
  if (!profile) return false;
  if (isAdmin(profile)) return true;

  switch (route) {
    case "/funding":
      return fundingSubmittableMdaIds(profile).length > 0;
    case "/expenditure":
      return (
        isFacilityUser(profile) ||
        expenditureSubmittableMdaIds(profile).length > 0
      );
    case "/entries":
      return true;
    case "/mda":
      // Viewers have statewide oversight by role and intentionally carry no
      // per-MDA memberships. MDA users still need at least one scoped grant.
      return (
        isReviewer(profile) ||
        (!isFacilityUser(profile) && viewableMdaIds(profile).length > 0)
      );
    case "/admin/reports":
    case "/admin/reports/cso":
    case "/admin/reports/bir":
    case "/admin/reports/audit":
    case "/admin/reports/mbp":
      // Admins short-circuit above; reviewers (who review every MDA) may generate reports.
      return isReviewer(profile);
    case "/reference-requests":
    case "/assistant":
    case "/settings":
      return true;
    default:
      return routeRoles[route].includes(profile.role);
  }
}

export function getRoleLabel(role: AppRole) {
  const labels: Record<AppRole, string> = {
    admin: "Admin",
    reviewer: "Viewer",
    mda_user: "MDA User",
    facility_user: "Facility User",
  };

  return labels[role];
}

/** True for admins or users with a funding-submit grant on the MDA. */
export function canSubmitFundingForMda(
  profile: ProfileForCapability,
  mdaId: string,
): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  return membershipsForMda(profile, mdaId).some(
    (membership) => membership.membership_role === "funding_submitter",
  );
}

/** True for admins, facility users on their reporting MDA, or expenditure grants. */
export function canSubmitExpenditureForMda(
  profile: ProfileForCapability,
  mdaId: string,
): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  if (isFacilityUser(profile)) return facilityUserMdaId(profile) === mdaId;
  return membershipsForMda(profile, mdaId).some(
    (membership) => membership.membership_role === "expenditure_submitter",
  );
}

/** True when a user has any add-entry capability on the MDA. */
export function canSubmitForMda(
  profile: ProfileForCapability,
  mdaId: string,
): boolean {
  return (
    canSubmitFundingForMda(profile, mdaId) ||
    canSubmitExpenditureForMda(profile, mdaId)
  );
}

/** True for admins or reviewers (reviewers can review every MDA). */
export function canReviewMda(
  profile: ProfileForCapability,
  _mdaId: string,
): boolean {
  if (!profile) return false;
  return isAdmin(profile) || isReviewer(profile);
}

/** True for admins or for users with *any* membership on the MDA. */
export function canViewMda(
  profile: ProfileForCapability,
  mdaId: string,
): boolean {
  if (!profile) return false;
  if (isAdmin(profile) || isReviewer(profile)) return true;
  return membershipsForMda(profile, mdaId).length > 0;
}

/** True when an MDA user is bound to exactly one MDA — useful for default selection. */
export function hasSingleMda(profile: ProfileForCapability): boolean {
  return viewableMdaIds(profile).length === 1;
}

export function hasMultipleMdas(profile: ProfileForCapability): boolean {
  return viewableMdaIds(profile).length > 1;
}
