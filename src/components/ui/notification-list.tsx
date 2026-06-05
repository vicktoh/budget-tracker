import { BellIcon } from "lucide-react";
import { Empty } from "@/components/ui/empty";

export function NotificationList() {
  return (
    <Empty
      description="Workflow notifications for submitted, approved, rejected, and processed entries will appear here."
      icon={BellIcon}
      title="No notifications"
    />
  );
}
