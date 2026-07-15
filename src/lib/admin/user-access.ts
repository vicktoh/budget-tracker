import type { AppRole } from "@/lib/auth-types";
import type { MembershipRoleSlug } from "@/lib/db/types";

export type UserAccessPayload = {
  funding_mda_ids: string[];
  expenditure_mda_ids: string[];
  mda_id: string | null;
  facility_ids: string[];
};

export type MembershipInput = {
  mda_id: string;
  membership_role: MembershipRoleSlug;
};

// Reviewers review every MDA via their role, so only mda_user carries per-MDA
// (submitter) grants.
const MDA_SCOPED_ROLES = new Set<AppRole>(["mda_user"]);

export function isMdaScopedRole(role: AppRole): boolean {
  return MDA_SCOPED_ROLES.has(role);
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((id): id is string => typeof id === "string")),
  );
}

function hasAnyMdaGrant(access: Pick<UserAccessPayload, "funding_mda_ids" | "expenditure_mda_ids">) {
  return (
    access.funding_mda_ids.length > 0 ||
    access.expenditure_mda_ids.length > 0
  );
}

export function validateUserAccess(
  role: AppRole,
  access: UserAccessPayload,
): string | null {
  if (role === "facility_user") {
    if (!access.mda_id) return "Facility users require a reporting MDA.";
    if (access.facility_ids.length === 0) {
      return "Facility users require at least one facility.";
    }
  }
  if (isMdaScopedRole(role) && !hasAnyMdaGrant(access)) {
    return "MDA-scoped users need funding-entry access, expenditure-entry access, or both.";
  }
  return null;
}

export function buildMembershipRows(
  userId: string,
  role: AppRole,
  access: Pick<UserAccessPayload, "funding_mda_ids" | "expenditure_mda_ids">,
): Array<MembershipInput & { user_id: string }> {
  if (!isMdaScopedRole(role)) return [];

  return [
    ...access.funding_mda_ids.map((mda_id) => ({
      user_id: userId,
      mda_id,
      membership_role: "funding_submitter" as const,
    })),
    ...access.expenditure_mda_ids.map((mda_id) => ({
      user_id: userId,
      mda_id,
      membership_role: "expenditure_submitter" as const,
    })),
  ];
}

export function grantsFromMemberships(
  memberships: Array<{ mda_id: string; membership_role: MembershipRoleSlug }>,
): Pick<UserAccessPayload, "funding_mda_ids" | "expenditure_mda_ids"> {
  const funding_mda_ids: string[] = [];
  const expenditure_mda_ids: string[] = [];

  for (const membership of memberships) {
    if (membership.membership_role === "funding_submitter") {
      funding_mda_ids.push(membership.mda_id);
    } else if (membership.membership_role === "expenditure_submitter") {
      expenditure_mda_ids.push(membership.mda_id);
    }
  }

  return {
    funding_mda_ids: Array.from(new Set(funding_mda_ids)),
    expenditure_mda_ids: Array.from(new Set(expenditure_mda_ids)),
  };
}
