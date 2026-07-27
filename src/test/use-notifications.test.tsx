import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNotifications } from "@/components/notifications/use-notifications";

const realtime = vi.hoisted(() => {
  const channels = new Map<
    string,
    {
      subscribed: boolean;
      on: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
    }
  >();

  const channel = vi.fn((topic: string) => {
    const existing = channels.get(topic);
    if (existing) return existing;

    const value = {
      subscribed: false,
      on: vi.fn(function (this: { subscribed: boolean }) {
        if (this.subscribed) {
          throw new Error(`cannot add postgres_changes callbacks for ${topic} after subscribe()`);
        }
        return this;
      }),
      subscribe: vi.fn(function (this: { subscribed: boolean }) {
        this.subscribed = true;
        return this;
      }),
    };
    channels.set(topic, value);
    return value;
  });

  return {
    channel,
    channels,
    removeChannel: vi.fn().mockResolvedValue("ok"),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: realtime.channel,
    removeChannel: realtime.removeChannel,
  },
}));

vi.mock("@/lib/db/notifications", () => ({
  listNotifications: vi.fn().mockResolvedValue([]),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

afterEach(() => {
  cleanup();
  realtime.channel.mockClear();
  realtime.removeChannel.mockClear();
  realtime.channels.clear();
});

describe("useNotifications", () => {
  it("creates independent realtime channels for concurrent consumers", async () => {
    const first = renderHook(() => useNotifications("recipient-1"));
    const second = renderHook(() => useNotifications("recipient-1"));

    await waitFor(() => expect(realtime.channel).toHaveBeenCalledTimes(2));

    const topics = realtime.channel.mock.calls.map(([topic]) => topic);
    expect(new Set(topics)).toHaveLength(2);
    expect(topics.every((topic) => topic.startsWith("notifications:recipient-1:"))).toBe(true);

    first.unmount();
    second.unmount();
    expect(realtime.removeChannel).toHaveBeenCalledTimes(2);
  });

  it("does not subscribe until a recipient is available", () => {
    renderHook(() => useNotifications(""));

    expect(realtime.channel).not.toHaveBeenCalled();
  });
});
