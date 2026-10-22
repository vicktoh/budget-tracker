import { describe, expect, it } from "vitest";
import { classifyRevenue } from "@/lib/public/revenue-sources";

describe("classifyRevenue", () => {
  it.each([
    ["13020104", "Local Government 1% Grant to support Health Trust Fund Service Delivery", "lga"],
    ["13020103", "Local Government Grant (1% ) Support to Contributory Health Scheme", "lga"],
    ["13020102", "Basic Healthcare Programm BHCPF Programm", "federal"],
    ["13020102", "FGN Grant for the Intergrated last mile delivery by Gate fundation", "federal"],
    ["13020202", "UNICEF Support Grant - IMPACT PROJECT", "donor"],
    ["13020106", "Capital Grant from BMCF AND DANGOTE (HEALTH MoU BASKET)", "donor"],
    ["13010102", "Donation by individual to Accident and Emergency", "donor"],
    ["12020704", "EARNINGS FROM MEDICAL SERVICES", "fees"],
    ["12021103", "OTHER INVESTMENT INCOME", "other"],
  ])("%s %s → %s", (code, description, key) => {
    expect(classifyRevenue(code, description)).toBe(key);
  });
});
