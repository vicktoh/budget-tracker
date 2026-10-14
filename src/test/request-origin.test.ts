import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOrigin } from "@/lib/server/invites";

describe("requestOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the configured app URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.test/");
    const request = new Request("http://0.0.0.0:8080/api/admin/users", {
      headers: { "x-forwarded-host": "other.example.test" },
    });

    expect(requestOrigin(request)).toBe("https://app.example.test");
  });

  it("uses the forwarded host instead of the container bind address", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const request = new Request("http://0.0.0.0:8080/api/admin/users", {
      headers: {
        "x-forwarded-host": "budget.example.test, internal.proxy",
        "x-forwarded-proto": "https",
      },
    });

    expect(requestOrigin(request)).toBe("https://budget.example.test");
  });

  it("falls back to the request URL when no proxy headers are present", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const request = new Request("http://localhost:3000/api/admin/users");

    expect(requestOrigin(request)).toBe("http://localhost:3000");
  });
});
