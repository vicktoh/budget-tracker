import { z } from "zod";

const jobRequestSchema = z.object({
  /** ISO date/time to run "as of"; defaults to now. */
  runDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  /** Plan and render without queueing or sending anything. */
  dryRun: z.boolean().optional(),
  /** Return the first rendered email's HTML (dry runs only). */
  includeHtml: z.boolean().optional(),
});

export type JobRequest = { runDate: Date; dryRun: boolean; includeHtml: boolean };

export async function parseJobRequest(request: Request): Promise<JobRequest> {
  const raw = await request.text();
  const parsed = jobRequestSchema.parse(raw.trim() ? JSON.parse(raw) : {});
  const runDate = parsed.runDate
    ? new Date(parsed.runDate.length === 10 ? `${parsed.runDate}T09:00:00+01:00` : parsed.runDate)
    : new Date();
  return { runDate, dryRun: parsed.dryRun ?? false, includeHtml: parsed.includeHtml ?? false };
}
