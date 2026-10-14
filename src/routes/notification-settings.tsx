"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { AppRole } from "@/lib/auth-types";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/db/notification-preferences";
import { supabase } from "@/lib/supabase";

type PreferenceKey = keyof NotificationPreferences;

type Option = { key: PreferenceKey; title: string; description: string };

function optionsFor(role: AppRole): Option[] {
  const remarks: Option = {
    key: "entry_comment_emails",
    title: "Remarks on entries",
    description:
      role === "mda_user" || role === "facility_user"
        ? "When a Viewer or Admin comments on an entry from your MDA."
        : role === "reviewer"
          ? "When an MDA user replies on an entry you commented on, or comments on an entry no Viewer has replied to yet."
          : "When an MDA user replies on an entry you commented on.",
  };
  if (role === "mda_user") {
    return [
      remarks,
      {
        key: "monthly_reminder_emails",
        title: "Monthly reminder",
        description: "On the 5th of each month, when your MDA has months in the current quarter with no entries.",
      },
    ];
  }
  if (role === "admin" || role === "reviewer") {
    return [
      remarks,
      {
        key: "executive_summary_emails",
        title: "Monthly executive summary",
        description:
          "On the 7th of each month: budget performance, MDAs falling behind and the Budget Implementation Report, with the full report attached as a PDF.",
      },
    ];
  }
  return [remarks];
}

export function NotificationSettingsRoute() {
  const { profile, loading } = useAuth();
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<PreferenceKey | null>(null);

  React.useEffect(() => {
    if (!supabase || !profile) return;
    getNotificationPreferences(supabase, profile.id)
      .then(setPreferences)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not load your notification settings.");
        setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      });
  }, [profile]);

  const toggle = async (key: PreferenceKey, value: boolean) => {
    if (!supabase || !profile || !preferences) return;
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSaving(key);
    try {
      await saveNotificationPreferences(supabase, profile.id, next);
      toast.success(value ? "Email turned on." : "Email turned off.");
    } catch (cause) {
      setPreferences(previous);
      toast.error(cause instanceof Error ? cause.message : "Could not save your notification settings.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Email notifications"
        description="Choose which emails you receive. In-app notifications are not affected."
      />
      {error ? (
        <Alert variant="warning">
          <AlertTitle>Settings could not be loaded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Emails</CardTitle>
          <CardDescription>
            Emails go to the address you sign in with. Everything is on unless you turn it off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !profile || !preferences ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {optionsFor(profile.role).map((option) => (
                <li key={option.key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium" id={`pref-${option.key}`}>{option.title}</span>
                    <span className="text-sm text-muted-foreground">{option.description}</span>
                  </div>
                  <Switch
                    aria-labelledby={`pref-${option.key}`}
                    checked={preferences[option.key]}
                    disabled={saving === option.key}
                    onCheckedChange={(value) => void toggle(option.key, value)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
