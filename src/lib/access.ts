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
  | "/review"
  | "/admin"
  | "/admin/reports"
  | "/admin/users"
  | "/admin/reference-data"
  | "/admin/reference-requests"
  | "/admin/budgets"
  | "/admin/aop-activities"
  | "/reference-requests"
  | "/imports"
  | "/exports"
  | "/settings";

const routeRoles: Record<AppRoute, AppRole[]> = {
  "/mda": ["mda_user", "reviewer", "admin"],
  "/funding": ["mda_user", "admin"],
  "/expenditure": ["mda_user", "admin", "facility_user"],
  "/review": ["reviewer", "admin"],
  "/admin": ["admin"],
  "/admin/reports": ["admin"],
  "/admin/users": ["admin"],
  "/admin/reference-data": ["admin"],
  "/admin/reference-requests": ["admin"],
  "/admin/budgets": ["admin"],
  "/admin/aop-activities": ["admin"],
  "/reference-requests": ["mda_user", "reviewer", "admin", "facility_user"],
  "/imports": ["admin"],
  "/exports": ["reviewer", "admin"],
  "/settings": ["mda_user", "reviewer", "admin", "facility_user"],
};

export function getDefaultPathForProfile(profile: Pick<AppProfile, "role">) {
  if (profile.role === "admin") return "/admin";
  if (profile.role === "reviewer") return "/review";
  if (profile.role === "facility_user") return "/expenditure";
  return "/mda";
}

export function canAccessRoute(
  profile: Pick<AppProfile, "role"> | null,
  route: AppRoute,
) {
  if (!profile) return false;
  return routeRoles[route].includes(profile.role);
}

export function getRoleLabel(role: AppRole) {
  const labels: Record<AppRole, string> = {
    admin: "Admin",
    reviewer: "Reviewer",
    mda_user: "MDA User",
    facility_user: "Facility User",
  };

  return labels[role];
}

/* -------------------------------------------------------------------------- */
/* Capability helpers                                                          */
/*                                                                            */
/* These mirror the Postgres helpers (`app_private.current_user_is_admin`,    */
/* `current_user_can_submit_for_mda`, etc.) so the UI can preflight calls and */
/* surface forbidden actions without waiting for RLS to reject them.          */
/* -------------------------------------------------------------------------- */

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

/** True for admins or for users with a `submitter` membership on the MDA. */
export function canSubmitForMda(
  profile: ProfileForCapability,
  mdaId: string,
): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  if (isFacilityUser(profile)) return facilityUserMdaId(profile) === mdaId;
  return membershipsForMda(profile, mdaId).some(
    (membership) => membership.membership_role === "submitter",
  );
}

/** True for admins or for users with a `reviewer` membership on the MDA. */
export function canReviewMda(
  profile: ProfileForCapability,
  mdaId: string,
): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  return membershipsForMda(profile, mdaId).some(
    (membership) => membership.membership_role === "reviewer",
  );
}

/** True for admins or for users with *any* membership on the MDA. */
export function canViewMda(
  profile: ProfileForCapability,
  mdaId: string,
): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  return membershipsForMda(profile, mdaId).length > 0;
}

/** The set of MDA IDs a user can submit funding/expenditure entries for. */
export function submittableMdaIds(profile: ProfileForCapability): string[] {
  if (!profile) return [];
  if (isAdmin(profile)) return [];
  if (isFacilityUser(profile)) {
    const mdaId = facilityUserMdaId(profile);
    return mdaId ? [mdaId] : [];
  }
  const ids = new Set<string>();
  for (const membership of profile.memberships) {
    if (membership.membership_role === "submitter") {
      ids.add(membership.mda_id);
    }
  }
  return Array.from(ids);
}

/** The set of MDA IDs a user can review on (excluding admins, who are global). */
export function reviewableMdaIds(profile: ProfileForCapability): string[] {
  if (!profile) return [];
  if (isAdmin(profile)) return [];
  const ids = new Set<string>();
  for (const membership of profile.memberships) {
    if (membership.membership_role === "reviewer") {
      ids.add(membership.mda_id);
    }
  }
  return Array.from(ids);
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

/** True when an MDA user is bound to exactly one MDA — useful for default selection. */
export function hasSingleMda(profile: ProfileForCapability): boolean {
  return viewableMdaIds(profile).length === 1;
}

export function hasMultipleMdas(profile: ProfileForCapability): boolean {
  return viewableMdaIds(profile).length > 1;
}
