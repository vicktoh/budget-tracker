import Link from "next/link";
import { BellIcon, ChevronRightIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader description="Manage your account preferences." title="Settings" />
      <Card>
        <CardContent className="p-0">
          <Link
            className="focus-ring flex items-center gap-3 rounded-lg p-4 hover:bg-muted/50"
            href="/settings/notifications"
          >
            <BellIcon aria-hidden="true" className="size-5 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">Email notifications</span>
              <span className="text-sm text-muted-foreground">
                Remarks on entries, monthly reminders and the monthly executive summary.
              </span>
            </span>
            <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
