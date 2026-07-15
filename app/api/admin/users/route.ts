import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMembershipRows,
  parseStringArray,
  validateUserAccess,
} from "@/lib/admin/user-access";
import type { AdminUserRecord } from "@/lib/admin/users";
import {
  requireAdminActor,
  replaceUserScope,
} from "@/lib/server/admin-users";
import {
  requestOrigin,
  sendAccountActionLink,
  type InviteDelivery,
} from "@/lib/server/invites";

type CreateUserBody = {
  full_name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  facility_ids?: unknown;
  mda_id?: unknown;
  funding_mda_ids?: unknown;
  expenditure_mda_ids?: unknown;
};

const ALLOWED_ROLES = ["admin", "reviewer", "mda_user", "facility_user"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function listAuthEmails(serviceClient: SupabaseClient) {
  const emails = new Map<string, string>();
  let page = 1;

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) emails.set(user.id, user.email);
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  return emails;
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapProfileRow(
  row: {
    id: string;
    full_name: string | null;
    role: AllowedRole;
    user_mda_memberships: Array<{
      mda_id: string;
      membership_role: string;
      mdas: { name: string; abbreviation: string | null } | Array<{
        name: string;
        abbreviation: string | null;
      }> | null;
    }> | null;
    user_facility_assignments: Array<{
      facility_id: string;
      mda_id: string;
      facilities: { name: string } | Array<{ name: string }> | null;
      mdas: { name: string; abbreviation: string | null } | Array<{
        name: string;
        abbreviation: string | null;
      }> | null;
    }> | null;
  },
  email: string,
): AdminUserRecord {
  return {
    id: row.id,
    email,
    full_name: row.full_name,
    role: row.role,
    memberships: (row.user_mda_memberships ?? []).map((membership) => {
      const mda = relationOne(membership.mdas);
      return {
        mda_id: membership.mda_id,
        membership_role: membership.membership_role as AdminUserRecord["memberships"][number]["membership_role"],
        mda_name: mda?.name ?? membership.mda_id,
        mda_abbreviation: mda?.abbreviation ?? null,
      };
    }),
    facility_assignments: (row.user_facility_assignments ?? []).map(
      (assignment) => {
        const facility = relationOne(assignment.facilities);
        const mda = relationOne(assignment.mdas);
        return {
          facility_id: assignment.facility_id,
          facility_name: facility?.name ?? assignment.facility_id,
          mda_id: assignment.mda_id,
          mda_name: mda?.name ?? assignment.mda_id,
          mda_abbreviation: mda?.abbreviation ?? null,
        };
      },
    ),
  };
}

export async function GET(request: Request) {
  const auth = await requireAdminActor(request);
  if ("error" in auth) return auth.error;

  try {
    const [{ data: profiles, error: profilesError }, emails] = await Promise.all([
      auth.serviceClient
        .from("profiles")
        .select(
          `
          id,
          full_name,
          role,
          user_mda_memberships (
            mda_id,
            membership_role,
            mdas ( name, abbreviation )
          ),
          user_facility_assignments (
            facility_id,
            mda_id,
            facilities ( name ),
            mdas ( name, abbreviation )
          )
        `,
        )
        .order("full_name", { ascending: true }),
      listAuthEmails(auth.serviceClient),
    ]);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    const users = (profiles ?? []).map((profile) =>
      mapProfileRow(profile, emails.get(profile.id) ?? "unknown@user.local"),
    );

    return NextResponse.json({ users } satisfies { users: AdminUserRecord[] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list users." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminActor(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, actorId } = auth;

  let body: CreateUserBody;
  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  // Optional: an explicit password means manual provisioning (the admin
  // shares it directly) and no invite email is sent. When omitted, a random
  // password is generated and the user sets their own through the invite link.
  const hasExplicitPassword =
    typeof body.password === "string" && body.password.length > 0;
  const password = hasExplicitPassword
    ? (body.password as string)
    : `${crypto.randomUUID()}${crypto.randomUUID().toUpperCase()}`;
  const role = body.role as AllowedRole;
  const access = {
    mda_id: typeof body.mda_id === "string" ? body.mda_id : null,
    facility_ids: parseStringArray(body.facility_ids),
    funding_mda_ids: parseStringArray(body.funding_mda_ids),
    expenditure_mda_ids: parseStringArray(body.expenditure_mda_ids),
  };

  if (!fullName) return badRequest("Full name is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest("A valid email is required.");
  }
  if (password.length < 8) {
    return badRequest("Temporary password must be at least 8 characters.");
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return badRequest("Role must be admin, reviewer, mda_user, or facility_user.");
  }

  const accessError = validateUserAccess(role, access);
  if (accessError) return badRequest(accessError);

  const { data: created, error: createError } =
    await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
  if (createError || !created?.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Failed to create auth user." },
      { status: 400 },
    );
  }

  const newUserId = created.user.id;
  const rollback = async () => {
    await serviceClient.auth.admin.deleteUser(newUserId).catch(() => undefined);
  };

  const { error: profileError } = await serviceClient.from("profiles").insert({
    id: newUserId,
    full_name: fullName,
    role,
  });
  if (profileError) {
    await rollback();
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const scopeError = await replaceUserScope(serviceClient, newUserId, role, {
    mda_id: access.mda_id,
    facility_ids: access.facility_ids,
    membershipRows: buildMembershipRows(newUserId, role, access),
  });
  if (scopeError) {
    await rollback();
    return NextResponse.json({ error: scopeError.message }, { status: 400 });
  }

  await serviceClient
    .from("entry_audit_events")
    .insert({
      entity_type: "profile",
      entity_id: newUserId,
      entity_key: email,
      event_type: "user_created",
      new_values: {
        role,
        full_name: fullName,
        facility_ids: access.facility_ids,
        mda_id: access.mda_id,
        funding_mda_ids: access.funding_mda_ids,
        expenditure_mda_ids: access.expenditure_mda_ids,
      },
      actor_id: actorId,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  let invite: InviteDelivery | null = null;
  if (!hasExplicitPassword) {
    try {
      invite = await sendAccountActionLink({
        serviceClient,
        email,
        fullName,
        origin: requestOrigin(request),
        kind: "invite",
      });
    } catch (error) {
      invite = {
        email_sent: false,
        email_error:
          error instanceof Error
            ? error.message
            : "Failed to send the invite email.",
      };
    }
  }

  return NextResponse.json({
    status: "created",
    user_id: newUserId,
    email,
    role,
    invite,
  });
}
