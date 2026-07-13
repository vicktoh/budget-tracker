import { Resend } from "resend";

// Resend's shared test domain — works without verifying a custom domain, but
// only delivers to the email address that owns the Resend API key. Once a
// real domain is verified, override with EMAIL_FROM.
const DEFAULT_FROM =
  "Kano Health Finance Tracker <onboarding@resend.dev>";

export type EmailResult =
  | { sent: true }
  | { sent: false; error: string };

export type InviteEmailKind = "invite" | "reset";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderActionEmail({
  heading,
  intro,
  buttonLabel,
  actionLink,
}: {
  heading: string;
  intro: string;
  buttonLabel: string;
  actionLink: string;
}) {
  const link = escapeHtml(actionLink);
  return `
  <div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">${escapeHtml(heading)}</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px; color: #444;">${escapeHtml(intro)}</p>
    <p style="margin: 0 0 24px;">
      <a href="${link}" style="display: inline-block; background: #166534; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 20px; border-radius: 6px;">${escapeHtml(buttonLabel)}</a>
    </p>
    <p style="font-size: 12px; line-height: 1.6; color: #777; margin: 0 0 8px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size: 12px; line-height: 1.6; word-break: break-all; margin: 0 0 24px;"><a href="${link}" style="color: #166534;">${link}</a></p>
    <p style="font-size: 12px; line-height: 1.6; color: #777; margin: 0;">This link expires after a short period. If it has expired, ask your administrator to send a new one. If you weren't expecting this email, you can safely ignore it.</p>
  </div>`;
}

export async function sendAccountActionEmail({
  to,
  fullName,
  actionLink,
  kind,
}: {
  to: string;
  fullName: string | null;
  actionLink: string;
  kind: InviteEmailKind;
}): Promise<EmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return {
      sent: false,
      error: "RESEND_API_KEY is not configured, so no email was sent.",
    };
  }

  const greetingName = fullName?.trim() || to;
  const content =
    kind === "invite"
      ? {
          subject: "You've been invited to the Kano Health Finance Tracker",
          heading: "You're invited",
          intro: `Hello ${greetingName}, an administrator created an account for you on the Kano Health Financing Flow Dashboard. Accept the invitation to choose your password and sign in.`,
          buttonLabel: "Accept invitation",
        }
      : {
          subject: "Reset your Kano Health Finance Tracker password",
          heading: "Reset your password",
          intro: `Hello ${greetingName}, an administrator requested a password reset for your account. Use the link below to choose a new password.`,
          buttonLabel: "Set a new password",
        };

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
    to,
    subject: content.subject,
    html: renderActionEmail({ ...content, actionLink }),
  });

  if (error) {
    return { sent: false, error: error.message };
  }

  return { sent: true };
}
