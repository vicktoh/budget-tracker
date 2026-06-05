import { BellIcon, ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getRoleLabel } from "@/lib/access";
import { supabase } from "@/lib/supabase";
import type { AppProfile } from "@/lib/auth-types";

export function TopHeader({ profile }: { profile: AppProfile }) {
  const mdaContext =
    profile.role === "admin"
      ? "Statewide"
      : profile.memberships[0]?.mdas?.abbreviation ||
        profile.memberships[0]?.mdas?.name ||
        "MDA context";

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex">
          <span className="truncate font-medium text-foreground">FY 2026</span>
          <Separator className="h-4" orientation="vertical" />
          <span className="truncate">{mdaContext}</span>
          <Separator className="h-4" orientation="vertical" />
          <Badge variant="outline">{getRoleLabel(profile.role)}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button aria-label="Notifications" size="icon" type="button" variant="ghost">
          <BellIcon aria-hidden="true" />
        </Button>
        <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1">
          <Avatar name={profile.full_name} />
          <div className="hidden min-w-0 flex-col md:flex">
            <span className="truncate text-sm font-medium">
              {profile.full_name || "Finance user"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {getRoleLabel(profile.role)}
            </span>
          </div>
          <ChevronsUpDownIcon aria-hidden="true" className="text-muted-foreground" />
        </div>
        <Button
          aria-label="Sign out"
          size="icon"
          type="button"
          variant="ghost"
          onClick={handleSignOut}
        >
          <LogOutIcon aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
