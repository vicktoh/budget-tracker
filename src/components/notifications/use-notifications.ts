"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/lib/db/notifications";

let nextNotificationChannelId = 0;

function createNotificationChannelName(recipientId: string) {
  nextNotificationChannelId += 1;
  return `notifications:${recipientId}:${nextNotificationChannelId}`;
}

export function useNotifications(recipientId: string, limit = 50) {
  const [notifications, setNotifications] = React.useState<NotificationRow[]>([]);
  const [loading, setLoading] = React.useState(Boolean(supabase));
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!supabase || !recipientId) {
      setNotifications([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      const rows = await listNotifications(supabase, recipientId, limit);
      setNotifications(rows);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [limit, recipientId]);

  React.useEffect(() => {
    void refresh();
    if (!supabase || !recipientId) return;

    const client = supabase;
    const channel = client
      // A client may reuse channels with the same topic. Each effect instance
      // needs its own topic so concurrent mounts and Strict Mode remounts do
      // not add handlers to a channel that has already been subscribed.
      .channel(createNotificationChannelName(recipientId))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${recipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      void client.removeChannel(channel);
    };
  }, [recipientId, refresh]);

  const markRead = React.useCallback(
    async (notificationId: string) => {
      if (!supabase) return;
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId && !notification.read_at
            ? { ...notification, read_at: new Date().toISOString() }
            : notification,
        ),
      );
      try {
        await markNotificationRead(supabase, recipientId, notificationId);
      } catch (cause) {
        await refresh();
        throw cause;
      }
    },
    [recipientId, refresh],
  );

  const markAllRead = React.useCallback(async () => {
    if (!supabase) return;
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.read_at ? notification : { ...notification, read_at: readAt },
      ),
    );
    try {
      await markAllNotificationsRead(supabase, recipientId);
    } catch (cause) {
      await refresh();
      throw cause;
    }
  }, [recipientId, refresh]);

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read_at).length,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}
