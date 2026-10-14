import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/server/invites";
import { authorizeNotificationJob, drainOutbox } from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

/**
 * Sends queued emails from the outbox. Called by the database right after a
 * comment email is queued, by pg_cron every 10 minutes, and after the monthly
 * jobs enqueue their emails.
 */
export async function POST(request: Request) {
  try {
    await authorizeNotificationJob(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await drainOutbox({ appUrl: requestOrigin(request) });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Email dispatch failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dispatch failed" }, { status: 500 });
  }
}
