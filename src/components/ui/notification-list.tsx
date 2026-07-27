"use client";

import { NotificationItems } from "@/components/notifications/notification-items";
import { useNotifications } from "@/components/notifications/use-notifications";
import { useAuth } from "@/components/auth/auth-provider";

export function NotificationList() {
  const { profile } = useAuth();
  const state = useNotifications(profile?.id ?? "");

  if (!profile) return null;

  return (
    <NotificationItems
      error={state.error}
      loading={state.loading}
      notifications={state.notifications}
      onMarkRead={state.markRead}
    />
  );
}
