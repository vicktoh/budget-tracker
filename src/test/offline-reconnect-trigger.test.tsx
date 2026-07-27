import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useReconnectTrigger } from "@/lib/offline/use-reconnect-trigger";

describe("useReconnectTrigger", () => {
  it("increments whenever the browser reconnects", () => {
    const { result } = renderHook(() => useReconnectTrigger());

    expect(result.current).toBe(0);

    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current).toBe(1);

    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current).toBe(2);
  });
});
