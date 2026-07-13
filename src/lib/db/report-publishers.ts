import type { TypedSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";

export type PublisherVoice = "watchdog" | "commitments" | "neutral";

export type ReportPublisher = {
  id: string;
  slug: string;
  name: string;
  logoKind: string;
  palette: { cover: string; accent: string };
  voicePreset: PublisherVoice;
};

const FALLBACK_PALETTE = { cover: "#12303f", accent: "#7fc5dc" };

/** Used before publishers load, and as the default selection. */
export const DEFAULT_PUBLISHER: ReportPublisher = {
  id: "",
  slug: "ibp",
  name: "IBP Nigeria",
  logoKind: "monogram",
  palette: FALLBACK_PALETTE,
  voicePreset: "watchdog",
};

function coercePalette(value: unknown): { cover: string; accent: string } {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      cover: typeof record.cover === "string" ? record.cover : FALLBACK_PALETTE.cover,
      accent: typeof record.accent === "string" ? record.accent : FALLBACK_PALETTE.accent,
    };
  }
  return FALLBACK_PALETTE;
}

function coerceVoice(value: string): PublisherVoice {
  return value === "watchdog" || value === "commitments" ? value : "neutral";
}

type PublisherRow = Tables<"report_publishers">;

// supabase-js's generic `from()` resolves this hand-authored table to `never`,
// so we cast to a minimal query interface and keep the result strongly typed
// via `Tables<>` (same pragmatic approach as `asRpc` in db/review.ts).
type PublisherQuery = {
  select: (columns: string) => {
    eq: (column: string, value: unknown) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => Promise<{ data: PublisherRow[] | null; error: { message: string } | null }>;
    };
  };
};

/** Active report publishers, ordered so the IBP watchdog preset comes first. */
export async function loadReportPublishers(
  client: TypedSupabaseClient,
): Promise<ReportPublisher[]> {
  const table = client.from("report_publishers") as unknown as PublisherQuery;
  const result = await table
    .select("*")
    .eq("active", true)
    .order("slug", { ascending: true });
  if (result.error) throw new Error(result.error.message);

  return (result.data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoKind: row.logo_kind,
    palette: coercePalette(row.palette),
    voicePreset: coerceVoice(row.voice_preset),
  }));
}
