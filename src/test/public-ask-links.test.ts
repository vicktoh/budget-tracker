import { describe, expect, it } from "vitest";
import { stripExternalLinks } from "@/components/public/ask-view";

describe("stripExternalLinks", () => {
  it("keeps the citation text and drops the URL", () => {
    expect(
      stripExternalLinks(
        "Spent 36.9% [2026 Q2 BIR, Table 4, p. 18](https://znvcxidepemlmqdhavpl.supabase.co/storage/v1/object/public/bir-reports/2026-Q2.pdf#page=18).",
      ),
    ).toBe("Spent 36.9% 2026 Q2 BIR, Table 4, p. 18.");
  });

  it("removes bare web addresses and leaves site links alone", () => {
    expect(stripExternalLinks("See (https://example.org/x.pdf) or [Explore](/explore).")).toBe("See  or [Explore](/explore).");
  });
});
