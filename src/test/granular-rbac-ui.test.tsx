import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntryReviewDetail } from "@/components/review/entry-review-detail";
import { FundingEntryForm } from "@/components/funding/funding-entry-form";
import { AdminUsersRoute } from "@/routes/admin-users";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/users",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/supabase", () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock("@/lib/db/reference-data", () => ({
  listMdas: vi.fn().mockResolvedValue([
    { id: "mda-a", name: "MDA Alpha", abbreviation: "ALP" },
    { id: "mda-b", name: "MDA Beta", abbreviation: "BET" },
  ]),
  listLgas: vi.fn().mockResolvedValue([]),
  listFacilities: vi.fn().mockResolvedValue([]),
}));

afterEach(() => {
  cleanup();
});

const reviewEntry = {
  id: "entry-1",
  publicId: "FND-001",
  status: "pending" as const,
  transactionDate: "2026-06-01",
  fiscalYear: 2026,
  quarter: 2,
  mdaLabel: "ALP",
  amount: 1000,
  enteredBy: "submitter-1",
};

const reviewSections = [{ label: "MDA", value: "MDA Alpha" }];

describe("EntryReviewDetail reviewed-entry edit affordance", () => {
  it("hides edit action for reviewers", () => {
    render(
      <EntryReviewDetail
        entryType="funding_entry"
        entry={reviewEntry}
        sections={reviewSections}
        remarks={null}
        canReview
        canEditReviewed={false}
        reviewedEditHref="/funding/entry-1/edit"
        currentUserId="reviewer-1"
        comments={[]}
        attachments={[]}
        auditEvents={[]}
        loading={false}
        loadError={null}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.queryByRole("link", { name: /edit with reason/i })).toBeNull();
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
  });

  it("shows edit action for admins on reviewed entries", () => {
    render(
      <EntryReviewDetail
        entryType="funding_entry"
        entry={{ ...reviewEntry, status: "approved" }}
        sections={reviewSections}
        remarks={null}
        canReview
        canEditReviewed
        reviewedEditHref="/funding/entry-1/edit"
        currentUserId="admin-1"
        comments={[]}
        attachments={[]}
        auditEvents={[]}
        loading={false}
        loadError={null}
        onRefresh={() => undefined}
      />,
    );

    expect(
      screen.getByRole("link", { name: /edit with reason/i }),
    ).toHaveAttribute("href", "/funding/entry-1/edit");
  });
});

describe("FundingEntryForm MDA filtering", () => {
  it("only lists MDAs passed in by the parent page", () => {
    render(
      <FundingEntryForm
        mdas={[{ id: "mda-a", name: "MDA Alpha", abbreviation: "ALP" }]}
        programmeAreas={[{ id: "prog-1", name: "Programme" }]}
        fundingSources={[{ id: "src-1", name: "Source" }]}
        onSubmit={() => undefined}
      />,
    );

    fireEvent.click(document.getElementById("mda")!);
    expect(screen.getByText("ALP — MDA Alpha")).toBeInTheDocument();
    expect(screen.queryByText("BET — MDA Beta")).toBeNull();
  });
});

async function selectRole(label: RegExp) {
  fireEvent.click(screen.getByRole("tab", { name: /create user/i }));
  await screen.findByRole("heading", { name: /create a user/i });
  fireEvent.click(document.getElementById("role")!);
  fireEvent.click(screen.getByRole("option", { name: label }));
}

describe("AdminUsersRoute granular MDA grants", () => {
  it("shows separate funding and expenditure grant pickers for MDA users", async () => {
    render(<AdminUsersRoute />);

    await selectRole(/mda user/i);

    expect(await screen.findByText("Funding-entry access")).toBeInTheDocument();
    expect(screen.getByText("Expenditure-entry access")).toBeInTheDocument();
    expect(screen.getAllByText("ALP — MDA Alpha").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("BET — MDA Beta").length).toBeGreaterThanOrEqual(1);
  });

  it("shows no MDA pickers for viewers, just an all-MDA note", async () => {
    render(<AdminUsersRoute />);

    await selectRole(/viewer/i);

    expect(
      await screen.findByText(/review funding and expenditure entries for every MDA/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Funding-entry access")).toBeNull();
    expect(screen.queryByText("Expenditure-entry access")).toBeNull();
    expect(screen.queryByText("Review access")).toBeNull();
  });
});
