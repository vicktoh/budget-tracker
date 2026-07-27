"use client";

import { BellIcon, MessageSquareTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationEntryHref, type NotificationRow } from "@/lib/db/notifications";
import { cn } from "@/lib/utils";

type NotificationItemsProps = {
  notifications: NotificationRow[];
  loading: boolean;
  error: string | null;
  onMarkRead: (id: string) => Promise<void>;
  onNavigate?: () => void;
};

export function NotificationItems({
  notifications,
  loading,
  error,
  onMarkRead,
  onNavigate,
}: NotificationItemsProps) {
  const router = useRouter();

  async function openNotification(notification: NotificationRow) {
    try {
      if (!notification.read_at) await onMarkRead(notification.id);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not mark notification as read.");
    }

    const href = notificationEntryHref(notification);
    if (href) {
      onNavigate?.();
      router.push(href);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading notifications">
        {[0, 1, 2].map((item) => <Skeleton className="h-24" key={item} />)}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Notifications unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!notifications.length) {
    return (
      <Empty
        description="Comments on funding and expenditure entries will appear here."
        icon={BellIcon}
        title="No notifications"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {notifications.map((notification) => {
        const href = notificationEntryHref(notification);
        return (
          <Button
            className={cn(
              "h-auto min-w-0 justify-start whitespace-normal border p-3 text-left",
              !notification.read_at && "border-primary/30 bg-accent",
            )}
            disabled={!href}
            key={notification.id}
            type="button"
            variant="ghost"
            onClick={() => void openNotification(notification)}
          >
            <MessageSquareTextIcon aria-hidden="true" data-icon="inline-start" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium">{notification.title}</span>
                {!notification.read_at ? <Badge>New</Badge> : null}
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {notification.body}
              </span>
              <time className="text-xs text-muted-foreground" dateTime={notification.created_at}>
                {new Date(notification.created_at).toLocaleString()}
              </time>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
