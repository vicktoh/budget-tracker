import { getCachedData, putCachedData } from "@/lib/offline/idb";

export type CachedReadResult<T> = {
  data: T;
  /** True when the data was served from the offline cache, not the network. */
  fromCache: boolean;
  /** ISO timestamp of the cached snapshot, when served from cache. */
  cachedAt: string | null;
};

/**
 * Read-through cache for browse/read surfaces. Attempts the live fetch first;
 * on success the result is mirrored to IndexedDB for offline use. If the fetch
 * fails (typically offline) and a cached snapshot exists, the snapshot is
 * returned instead of throwing — letting users keep browsing the last data
 * they synced. When there is no cache, the original error propagates.
 */
export async function readThroughCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<CachedReadResult<T>> {
  try {
    const data = await fetcher();
    // Best-effort mirror; a cache write failure must not fail the read.
    await putCachedData(key, data).catch(() => undefined);
    return { data, fromCache: false, cachedAt: null };
  } catch (error) {
    const cached = await getCachedData<T>(key).catch(() => null);
    if (cached) {
      // Keep the underlying live-read failure visible during diagnostics. The
      // cached result keeps the screen usable, but must not hide backend or
      // schema errors behind an apparently offline state.
      console.warn(
        `Live read failed; using cached data for "${key}": ${describeCacheFallbackError(error)}`,
      );
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
    }
    throw error;
  }
}

function describeCacheFallbackError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown live-read error";
    }
  }
  return String(error);
}
