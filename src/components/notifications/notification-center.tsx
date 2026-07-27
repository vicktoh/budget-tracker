"use client";

import * as React from "react";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { NotificationItems } from "@/components/notifications/notification-items";
import { useNotifications } from "@/components/notifications/use-notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";

export function NotificationCenter({ recipientId }: { recipientId: string }) {
  const [open, setOpen] = React.useState(false);
  const state = useNotifications(recipientId);

  async function markAllRead() {
    try {
      await state.markAllRead();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not mark notifications as read.");
    }
  }

  return (
    <>
      <Tooltip label="Notifications" side="bottom">
        <Button
          aria-label={state.unreadCount ? `Notifications, ${state.unreadCount} unread` : "Notifications"}
          className="relative"
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => setOpen(true)}
        >
          <BellIcon aria-hidden="true" />
          {state.unreadCount ? (
            <Badge className="absolute -right-1 -top-1 min-w-5 justify-center px-1" aria-hidden="true">
              {state.unreadCount > 99 ? "99+" : state.unreadCount}
            </Badge>
          ) : null}
        </Button>
      </Tooltip>
      <Sheet
        description="Comments and updates on entries you can access."
        footer={state.unreadCount ? (
          <Button className="w-full" type="button" variant="outline" onClick={() => void markAllRead()}>
            <CheckCheckIcon aria-hidden="true" data-icon="inline-start" />
            Mark all as read
          </Button>
        ) : undefined}
        open={open}
        title="Notifications"
        onOpenChange={setOpen}
      >
        <NotificationItems
          error={state.error}
          loading={state.loading}
          notifications={state.notifications}
          onMarkRead={state.markRead}
          onNavigate={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}
