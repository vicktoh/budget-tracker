import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  const map = new Map<string, { key: string; cachedAt: string; data: unknown }>();
  return {
    map,
    putCachedData: vi.fn(async (key: string, data: unknown) => {
      const record = { key, data, cachedAt: "2026-06-21T10:00:00.000Z" };
      map.set(key, record);
      return record;
    }),
    getCachedData: vi.fn(async (key: string) => map.get(key) ?? null),
  };
});

vi.mock("@/lib/offline/idb", () => ({
  putCachedData: store.putCachedData,
  getCachedData: store.getCachedData,
}));

import { readThroughCache } from "@/lib/offline/data-cache";

beforeEach(() => {
  store.map.clear();
  vi.clearAllMocks();
});

describe("readThroughCache", () => {
  it("returns live data and mirrors it to the cache on success", async () => {
    const result = await readThroughCache("k", async () => ({ rows: [1, 2] }));

    expect(result.fromCache).toBe(false);
    expect(result.cachedAt).toBeNull();
    expect(result.data).toEqual({ rows: [1, 2] });
    expect(store.putCachedData).toHaveBeenCalledWith("k", { rows: [1, 2] });
  });

  it("falls back to the cached snapshot when the fetch fails", async () => {
    await readThroughCache("k", async () => ({ rows: ["fresh"] }));
    store.putCachedData.mockClear();

    const result = await readThroughCache("k", async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(result.fromCache).toBe(true);
    expect(result.cachedAt).toBe("2026-06-21T10:00:00.000Z");
    expect(result.data).toEqual({ rows: ["fresh"] });
    // A failed fetch must not overwrite the cache.
    expect(store.putCachedData).not.toHaveBeenCalled();
  });

  it("rethrows when the fetch fails and there is no cache", async () => {
    const error = new TypeError("Failed to fetch");
    await expect(
      readThroughCache("missing", async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("does not fail the read when the cache write throws", async () => {
    store.putCachedData.mockRejectedValueOnce(new Error("quota exceeded"));
    const result = await readThroughCache("k", async () => 42);
    expect(result.data).toBe(42);
    expect(result.fromCache).toBe(false);
  });
});
