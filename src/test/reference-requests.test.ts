import { describe, expect, it } from "vitest";
import {
  validateReferenceRequestDecision,
  validateReferenceRequestDraft,
} from "@/lib/reference/requests";

describe("validateReferenceRequestDraft", () => {
  it("requires reference_type and requested_label", () => {
    const result = validateReferenceRequestDraft({
      reference_type: "",
      requested_label: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.reference_type).toBeTruthy();
      expect(result.errors.requested_label).toBeTruthy();
    }
  });

  it("requires related_category_id for expenditure_item", () => {
    const result = validateReferenceRequestDraft({
      reference_type: "expenditure_item",
      requested_label: "USB drives",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.related_category_id).toBeTruthy();
    }
  });

  it("requires related_lga_id for facility", () => {
    const result = validateReferenceRequestDraft({
      reference_type: "facility",
      requested_label: "New PHC",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.related_lga_id).toBeTruthy();
  });

  it("returns trimmed values when valid", () => {
    const result = validateReferenceRequestDraft({
      reference_type: "funding_source",
      requested_label: "  Donor X  ",
      description: "  detailed reason  ",
      related_mda_id: "mda-id",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.requested_label).toBe("Donor X");
      expect(result.values.description).toBe("detailed reason");
      expect(result.values.related_mda_id).toBe("mda-id");
      expect(result.values.related_lga_id).toBeNull();
      expect(result.values.related_category_id).toBeNull();
    }
  });
});

describe("validateReferenceRequestDecision", () => {
  it("approve requires a resolved_reference_id", () => {
    const result = validateReferenceRequestDecision({
      action: "approve",
      resolved_reference_id: null,
    });
    expect(result.ok).toBe(false);
  });

  it("approve passes when a reference is picked", () => {
    const result = validateReferenceRequestDecision({
      action: "approve",
      resolved_reference_id: "abc",
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.decision.action === "approve") {
      expect(result.decision.resolved_reference_id).toBe("abc");
    }
  });

  it("reject requires a non-empty comment", () => {
    const blank = validateReferenceRequestDecision({
      action: "reject",
      review_comment: "   ",
    });
    expect(blank.ok).toBe(false);

    const ok = validateReferenceRequestDecision({
      action: "reject",
      review_comment: "Use existing 'Treasury voucher' value instead.",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok && ok.decision.action === "reject") {
      expect(ok.decision.review_comment).toBe(
        "Use existing 'Treasury voucher' value instead.",
      );
    }
  });
});
