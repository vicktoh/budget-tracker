import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";

type Client = TypedSupabaseClient;

export type NotificationRow = Tables<"notifications">;

export async function listNotifications(
  client: Client,
  recipientId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(
  client: Client,
  recipientId: string,
  notificationId: string,
): Promise<void> {
  const table = client.from("notifications") as unknown as {
    update: (values: { read_at: string }) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await table
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", recipientId);

  if (error) throw error;
}

export async function markAllNotificationsRead(
  client: Client,
  recipientId: string,
): Promise<void> {
  const table = client.from("notifications") as unknown as {
    update: (values: { read_at: string }) => {
      eq: (column: string, value: string) => {
        is: (column: string, value: null) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await table
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", recipientId)
    .is("read_at", null);

  if (error) throw error;
}

export function notificationEntryHref(notification: NotificationRow): string | null {
  if (!notification.entity_id) return null;
  if (notification.entity_type === "funding_entry") {
    return `/entries/funding/${notification.entity_id}`;
  }
  if (notification.entity_type === "expenditure_entry") {
    return `/entries/expenditure/${notification.entity_id}`;
  }
  return null;
}
