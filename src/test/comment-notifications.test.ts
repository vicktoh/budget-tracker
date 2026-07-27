import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { notificationEntryHref } from "@/lib/db/notifications";
import type { Tables } from "@/lib/db/types";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260716042950_entry_comment_notifications.sql",
  ),
  "utf8",
);

function notification(
  entityType: string | null,
  entityId: string | null = "entry-1",
): Tables<"notifications"> {
  return {
    id: "notification-1",
    recipient_id: "recipient-1",
    notification_type: "entry_comment_added",
    title: "New comment",
    body: "A user: Please review this entry",
    entity_type: entityType,
    entity_id: entityId,
    read_at: null,
    created_at: "2026-07-16T04:30:00.000Z",
  };
}

describe("entry comment notification migration", () => {
  it("fans comments out to statewide and entry-scoped participants without notifying the author", () => {
    expect(sql).toContain("recipient.role in ('admin', 'reviewer')");
    expect(sql).toContain("membership.mda_id = target_mda_id");
    expect(sql).toContain("assignment.facility_id = target_facility_id");
    expect(sql).toContain("recipient.id = target_entered_by");
    expect(sql).toContain("recipient.id <> new.author_id");
  });

  it("creates a durable trigger and enables the notification Realtime stream", () => {
    expect(sql).toContain("after insert on public.entry_comments");
    expect(sql).toContain("'entry_comment_added'");
    expect(sql).toContain("alter publication supabase_realtime add table public.notifications");
  });

  it("snapshots author identity without exposing the profile directory", () => {
    expect(sql).toContain("create trigger snapshot_entry_comment_author");
    expect(sql).toContain("into new.author_name, new.author_role");
    expect(sql).not.toContain("profiles_select_authenticated_directory");
  });

  it("limits read-state updates to recipients", () => {
    expect(sql).toContain("using (recipient_id = (select auth.uid()))");
    expect(sql).toContain("with check (recipient_id = (select auth.uid()))");
  });
});

describe("notification entry links", () => {
  it("links funding and expenditure notifications to their unified detail pages", () => {
    expect(notificationEntryHref(notification("funding_entry"))).toBe(
      "/entries/funding/entry-1",
    );
    expect(notificationEntryHref(notification("expenditure_entry"))).toBe(
      "/entries/expenditure/entry-1",
    );
  });

  it("does not create a link for unknown or missing entities", () => {
    expect(notificationEntryHref(notification("report"))).toBeNull();
    expect(notificationEntryHref(notification("funding_entry", null))).toBeNull();
  });
});
