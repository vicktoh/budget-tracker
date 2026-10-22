import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { authorizeNotificationJob } from "@/lib/server/notifications";
import { PUBLIC_DATASET_TAG } from "@/lib/public/dataset";

export const dynamic = "force-dynamic";

/** Refresh the public pages right after `scripts/bir/load.ts --write` (cron secret or an admin session). */
export async function POST(request: Request) {
  try {
    await authorizeNotificationJob(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
  revalidateTag(PUBLIC_DATASET_TAG);
  return NextResponse.json({ revalidated: true });
}
