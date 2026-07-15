import { describe, expect, it } from "vitest";
import {
  REFERENCE_KIND_ORDER,
  REFERENCE_REGISTRY,
  slugify,
} from "@/lib/reference/types";
import {
  mapReferenceWriteError,
  validateReferenceDraft,
} from "@/lib/reference/validation";

describe("slugify", () => {
  it("lowercases, collapses non-alnum runs, and trims hyphens", () => {
    expect(slugify("Mobile Money Voucher")).toBe("mobile-money-voucher");
    expect(slugify("  Cash & Carry  ")).toBe("cash-carry");
    expect(slugify("Other / Misc")).toBe("other-misc");
    expect(slugify("")).toBe("");
  });
});

describe("REFERENCE_REGISTRY", () => {
  it("covers every kind in the kind order", () => {
    for (const kind of REFERENCE_KIND_ORDER) {
      expect(REFERENCE_REGISTRY[kind]).toBeDefined();
      expect(REFERENCE_REGISTRY[kind].kind).toBe(kind);
    }
  });
});

describe("validateReferenceDraft", () => {
  it("requires a name on every kind", () => {
    for (const kind of REFERENCE_KIND_ORDER) {
      const result = validateReferenceDraft(kind, { name: "  " });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.name).toBeTruthy();
    }
  });

  it("trims and slugifies simple kinds", () => {
    const result = validateReferenceDraft("programme_area", {
      name: "  Reproductive Health  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.name).toBe("Reproductive Health");
      expect(result.values.slug).toBe("reproductive-health");
    }
  });

  it("requires a code for mdas", () => {
    const result = validateReferenceDraft("mda", { name: "New MDA" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.code).toBeTruthy();
  });

  it("accepts a fully-populated mda draft", () => {
    const result = validateReferenceDraft("mda", {
      name: "Kano Ministry of X",
      code: "MOX",
      abbreviation: "MOX",
      mda_type_id: "type-id",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.code).toBe("MOX");
      expect(result.values.abbreviation).toBe("MOX");
      expect(result.values.mda_type_id).toBe("type-id");
    }
  });

  it("requires an expenditure_category_id for items", () => {
    const result = validateReferenceDraft("expenditure_item", {
      name: "Stationery",
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.expenditure_category_id).toBeTruthy();
  });

  it("requires lga_id and facility_type for facilities", () => {
    const missingBoth = validateReferenceDraft("facility", {
      name: "Sample PHC",
      facility_type: "",
    });
    expect(missingBoth.ok).toBe(false);
    if (!missingBoth.ok) {
      expect(missingBoth.errors.lga_id).toBeTruthy();
      expect(missingBoth.errors.facility_type).toBeTruthy();
    }

    const good = validateReferenceDraft("facility", {
      name: "Sample PHC",
      lga_id: "lga-id",
      facility_type: "primary_health_centre",
    });
    expect(good.ok).toBe(true);
  });
});

describe("mapReferenceWriteError", () => {
  it("returns null when no error is present", () => {
    expect(mapReferenceWriteError("programme_area", null)).toBeNull();
  });

  it("maps 23505 collisions onto the name field by default", () => {
    const mapped = mapReferenceWriteError("programme_area", {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    expect(mapped?.field).toBe("name");
  });

  it("maps mda code collisions to the code field", () => {
    const mapped = mapReferenceWriteError("mda", {
      code: "23505",
      message: "duplicate key value: mdas_code_key",
    });
    expect(mapped?.field).toBe("code");
  });

  it("falls through to a generic message for other errors", () => {
    const mapped = mapReferenceWriteError("mda", {
      code: "42501",
      message: "permission denied",
    });
    expect(mapped?.field).toBeUndefined();
    expect(mapped?.message).toBe("permission denied");
  });
});
