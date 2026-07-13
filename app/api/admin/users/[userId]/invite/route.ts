import { NextResponse } from "next/server";
import { requireAdminActor } from "@/lib/server/admin-users";
import { requestOrigin, sendAccountActionLink } from "@/lib/server/invites";

type InviteBody = {
  kind?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdminActor(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, actorId } = auth;
  const { userId } = await context.params;

  let body: InviteBody = {};
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    // Body is optional; default to an invite email.
  }
  const kind = body.kind === "reset" ? "reset" : "invite";

  const [{ data: profile, error: profileError }, { data: authUser, error: authUserError }] =
    await Promise.all([
      serviceClient
        .from("profiles")
        .select("id, full_name")
        .eq("id", userId)
        .maybeSingle(),
      serviceClient.auth.admin.getUserById(userId),
    ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile || authUserError || !authUser?.user?.email) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const email = authUser.user.email;
  const invite = await sendAccountActionLink({
    serviceClient,
    email,
    fullName: profile.full_name,
    origin: requestOrigin(request),
    kind,
  });

  await serviceClient
    .from("entry_audit_events")
    .insert({
      entity_type: "profile",
      entity_id: userId,
      entity_key: email,
      event_type: kind === "invite" ? "user_invite_sent" : "user_reset_link_sent",
      new_values: { email_sent: invite.email_sent },
      actor_id: actorId,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return NextResponse.json({
    status: "sent",
    email,
    invite,
  });
}
