"use client";

import * as React from "react";
import { DownloadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "khff-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayModeStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  // iOS Safari exposes a non-standard `standalone` flag instead.
  const iosStandalone =
    (window.navigator as { standalone?: boolean }).standalone === true;
  return displayModeStandalone || iosStandalone;
}

/**
 * Surfaces the browser's "Add to home screen" flow as an explicit, dismissible
 * prompt so field users on tablets/phones can install the app for reliable
 * offline launch.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (isStandalone()) return;
    if (
      typeof localStorage !== "undefined" &&
      localStorage.getItem(DISMISS_KEY) === "1"
    ) {
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
  }, []);

  const install = React.useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferred(null);
  }, [deferred]);

  if (!visible || !deferred) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
      <DownloadIcon
        aria-hidden="true"
        className="size-5 shrink-0 text-primary"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">Install this app</span>
        <span className="text-xs text-muted-foreground">
          Add the dashboard to your device for faster access and reliable
          offline entry.
        </span>
      </div>
      <Button size="sm" onClick={install}>
        Install
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
