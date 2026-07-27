import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Combobox } from "@/components/ui/combobox";

afterEach(() => {
  cleanup();
});

describe("Combobox search terms", () => {
  it("finds an option by a hidden search term", () => {
    render(
      <Combobox
        options={[
          {
            value: "line-1",
            label: "Construction of PHC facility",
            searchTerms: ["22020501"],
          },
          {
            value: "line-2",
            label: "Purchase of medical supplies",
            searchTerms: ["22020602"],
          },
        ]}
        placeholder="Select approved budget line"
        onValueChange={() => undefined}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /select approved budget line/i }),
    );
    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "22020501" },
    });

    expect(
      screen.getByRole("option", { name: /construction of phc facility/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /purchase of medical supplies/i }),
    ).toBeNull();
  });
});
