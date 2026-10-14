import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";

type Client = TypedSupabaseClient;

export type NotificationPreferences = Pick<
  Tables<"notification_preferences">,
  "entry_comment_emails" | "monthly_reminder_emails" | "executive_summary_emails"
>;

/** No stored row means every email the user's role receives is on. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  entry_comment_emails: true,
  monthly_reminder_emails: true,
  executive_summary_emails: true,
};

export async function getNotificationPreferences(client: Client, userId: string): Promise<NotificationPreferences> {
  const { data, error } = await client
    .from("notification_preferences")
    .select("entry_comment_emails, monthly_reminder_emails, executive_summary_emails")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as NotificationPreferences | null) ?? DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function saveNotificationPreferences(
  client: Client,
  userId: string,
  preferences: NotificationPreferences,
): Promise<void> {
  const table = client.from("notification_preferences") as unknown as {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await table.upsert({ user_id: userId, ...preferences }, { onConflict: "user_id" });
  if (error) throw error;
}
