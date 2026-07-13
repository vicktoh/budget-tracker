import type { SupabaseClient } from "@supabase/supabase-js";
import type { InviteDelivery } from "@/lib/admin/users";
import {
  sendAccountActionEmail,
  type InviteEmailKind,
} from "@/lib/server/email";

export type { InviteDelivery };

/**
 * Generates a one-time set-password link for the user and emails it via
 * Resend. Uses a recovery token (the user already exists with a random
 * password), which lands on /auth/accept-invite where they choose their own.
 */
export async function sendAccountActionLink({
  serviceClient,
  email,
  fullName,
  origin,
  kind,
}: {
  serviceClient: SupabaseClient;
  email: string;
  fullName: string | null;
  origin: string;
  kind: InviteEmailKind;
}): Promise<InviteDelivery> {
  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const hashedToken = data?.properties?.hashed_token;
  if (error || !hashedToken) {
    return {
      email_sent: false,
      email_error: error?.message ?? "Failed to generate the invite link.",
    };
  }

  const actionLink = `${origin}/auth/accept-invite?token_hash=${encodeURIComponent(
    hashedToken,
  )}&kind=${kind}`;

  const result = await sendAccountActionEmail({
    to: email,
    fullName,
    actionLink,
    kind,
  });

  if (!result.sent) {
    return {
      email_sent: false,
      action_link: actionLink,
      email_error: result.error,
    };
  }

  return { email_sent: true };
}

export function requestOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
