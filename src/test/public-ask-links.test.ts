import { describe, expect, it } from "vitest";
import { replaceEmDashes, splitAnswer, stripExternalLinks, stripVisualPlaceholders } from "@/components/public/ask-view";

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

describe("stripVisualPlaceholders", () => {
  it("drops table and chart stand-ins on their own line only", () => {
    expect(stripVisualPlaceholders("Spent ₦79.2bn.\n\n[Table: Health MDAs, Jan–Jun 2026]\n\nWhat stands out…")).toBe(
      "Spent ₦79.2bn.\n\n\nWhat stands out…",
    );
    expect(stripVisualPlaceholders("(Chart: spending by year)\nDone")).toBe("Done");
    expect(stripVisualPlaceholders("The table shows [Table 4, p. 18] figures.")).toBe("The table shows [Table 4, p. 18] figures.");
  });

  it("keeps a citation that sits on its own line", () => {
    expect(stripVisualPlaceholders("(Table 4, p. 18)\n(chart below)\n")).toBe("(Table 4, p. 18)\n");
  });
});

describe("splitAnswer", () => {
  it("places tables and charts at their markers, in order, across text parts", () => {
    const counters = { table: 0, chart: 0 };
    expect(splitAnswer("Spending rose.\n\n[[table]]\n\n[[chart]]\n\nWhat stands out…", counters)).toEqual([
      { text: "Spending rose.\n\n" },
      { visual: "table", index: 0 },
      { visual: "chart", index: 0 },
      { text: "\n\nWhat stands out…" },
    ]);
    expect(splitAnswer("And by MDA:\n[[table]]", counters)).toEqual([{ text: "And by MDA:\n" }, { visual: "table", index: 1 }]);
    expect(counters).toEqual({ table: 2, chart: 1 });
  });

  it("hides a marker that is still streaming in", () => {
    expect(splitAnswer("Spending rose.\n\n[[tab", { table: 0, chart: 0 })).toEqual([{ text: "Spending rose.\n\n" }]);
  });

  it("drops '(rendered table)' stand-ins", () => {
    expect(stripVisualPlaceholders("Here it is. (rendered table)")).toBe("Here it is.");
  });
});

describe("replaceEmDashes", () => {
  const dash = "\u2014";
  it("turns em dashes in answers into commas", () => {
    expect(replaceEmDashes(`Sources: 2026 Q2 BIR ${dash} PHC Board projects.`)).toBe("Sources: 2026 Q2 BIR, PHC Board projects.");
    expect(replaceEmDashes(`It rose${dash}sharply${dash}in 2026.`)).toBe("It rose, sharply, in 2026.");
    expect(replaceEmDashes(`(${dash} see below)`)).toBe("(see below)");
  });

  it("shows n/a in an empty markdown table cell", () => {
    expect(replaceEmDashes(`| SMOH | ${dash} | ${dash} |`)).toBe("| SMOH | n/a | n/a |");
  });

  it("leaves en dashes in date ranges alone", () => {
    expect(replaceEmDashes("Jan–Jun 2026")).toBe("Jan–Jun 2026");
  });
});
