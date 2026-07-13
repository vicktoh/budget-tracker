import type {
  AopActivityLite,
  ApprovedBudgetLite,
  ExpenditureEntryLite,
  FundingEntryLite,
} from "@/lib/reporting/types";

export const MDA_HEALTH = "11111111-1111-1111-1111-111111111111";
export const MDA_PHCMB = "22222222-2222-2222-2222-222222222222";
export const PA_PRIMARY = "pa-primary";
export const PA_SECONDARY = "pa-secondary";
export const FS_FED = "fs-fed";
export const FS_INT = "fs-int";
export const EC_PERSONNEL = "ec-personnel";
export const EC_DRUGS = "ec-drugs";
export const LGA_KANO = "lga-kano";
export const FACILITY_A = "facility-a";
export const AOP_1 = "aop-1";

export function fundingFixtures(): FundingEntryLite[] {
  return [
    {
      id: "f1",
      public_id: "FL-2026-0001",
      reference_no: "REF-f1",
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      programme_area_id: PA_PRIMARY,
      programme_area_name: "Primary Health",
      funding_source_id: FS_FED,
      funding_source_name: "Federal Allocation",
      fiscal_year: 2026,
      quarter: 1,
      amount: 1_000_000,
      status: "approved",
      transaction_date: "2026-01-15",
    },
    {
      id: "f2",
      public_id: "FL-2026-0002",
      reference_no: "REF-f2",
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      programme_area_id: PA_PRIMARY,
      programme_area_name: "Primary Health",
      funding_source_id: FS_INT,
      funding_source_name: "International Donor",
      fiscal_year: 2026,
      quarter: 1,
      amount: 500_000,
      status: "pending",
      transaction_date: "2026-02-10",
    },
    {
      id: "f3",
      public_id: "FL-2026-0003",
      reference_no: "REF-f3",
      mda_id: MDA_PHCMB,
      mda_name: "PHCMB",
      programme_area_id: PA_PRIMARY,
      programme_area_name: "Primary Health",
      funding_source_id: FS_FED,
      funding_source_name: "Federal Allocation",
      fiscal_year: 2026,
      quarter: 2,
      amount: 750_000,
      status: "processed",
      transaction_date: "2026-04-01",
    },
    {
      id: "f4",
      public_id: "FL-2025-0004",
      reference_no: "REF-f4",
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      programme_area_id: PA_SECONDARY,
      programme_area_name: "Secondary Health",
      funding_source_id: FS_FED,
      funding_source_name: "Federal Allocation",
      fiscal_year: 2025,
      quarter: 4,
      amount: 250_000,
      status: "rejected",
      transaction_date: "2025-12-20",
    },
  ];
}

export function expenditureFixtures(): ExpenditureEntryLite[] {
  return [
    {
      id: "e1",
      public_id: "EL-2026-0001",
      voucher_ref_no: "VCH-e1",
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      programme_area_id: PA_PRIMARY,
      programme_area_name: "Primary Health",
      expenditure_category_id: EC_PERSONNEL,
      expenditure_category_name: "Personnel",
      aop_activity_id: AOP_1,
      is_phc: false,
      lga_id: null,
      lga_name: null,
      facility_id: null,
      facility_name: null,
      fiscal_year: 2026,
      quarter: 1,
      amount: 600_000,
      status: "approved",
      transaction_date: "2026-01-20",
      funding_allocations: [
        {
          funding_source_id: FS_FED,
          funding_source_name: "Federal Allocation",
          amount: 600_000,
        },
      ],
    },
    {
      id: "e2",
      public_id: "EL-2026-0002",
      voucher_ref_no: "VCH-e2",
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      programme_area_id: PA_PRIMARY,
      programme_area_name: "Primary Health",
      expenditure_category_id: EC_DRUGS,
      expenditure_category_name: "Drugs & Supplies",
      aop_activity_id: null,
      is_phc: true,
      lga_id: LGA_KANO,
      lga_name: "Kano Municipal",
      facility_id: FACILITY_A,
      facility_name: "PHC Sabon Gari",
      fiscal_year: 2026,
      quarter: 2,
      amount: 200_000,
      status: "approved",
      transaction_date: "2026-04-05",
      funding_allocations: [
        {
          funding_source_id: FS_INT,
          funding_source_name: "International Donor",
          amount: 200_000,
        },
      ],
    },
    {
      id: "e3",
      public_id: "EL-2026-0003",
      voucher_ref_no: "VCH-e3",
      mda_id: MDA_PHCMB,
      mda_name: "PHCMB",
      programme_area_id: PA_PRIMARY,
      programme_area_name: "Primary Health",
      expenditure_category_id: EC_DRUGS,
      expenditure_category_name: "Drugs & Supplies",
      aop_activity_id: null,
      is_phc: true,
      lga_id: LGA_KANO,
      lga_name: "Kano Municipal",
      facility_id: FACILITY_A,
      facility_name: "PHC Sabon Gari",
      fiscal_year: 2026,
      quarter: 2,
      amount: 350_000,
      status: "pending",
      transaction_date: "2026-05-12",
      funding_allocations: [
        {
          funding_source_id: FS_FED,
          funding_source_name: "Federal Allocation",
          amount: 350_000,
        },
      ],
    },
    {
      id: "e4",
      public_id: "EL-2025-0004",
      voucher_ref_no: "VCH-e4",
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      programme_area_id: PA_SECONDARY,
      programme_area_name: "Secondary Health",
      expenditure_category_id: EC_PERSONNEL,
      expenditure_category_name: "Personnel",
      aop_activity_id: null,
      is_phc: false,
      lga_id: null,
      lga_name: null,
      facility_id: null,
      facility_name: null,
      fiscal_year: 2025,
      quarter: 3,
      amount: 100_000,
      status: "rejected",
      transaction_date: "2025-09-01",
      funding_allocations: [
        {
          funding_source_id: FS_FED,
          funding_source_name: "Federal Allocation",
          amount: 100_000,
        },
      ],
    },
  ];
}

export function budgetFixtures(): ApprovedBudgetLite[] {
  return [
    {
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      fiscal_year: 2026,
      personnel_amount: 800_000,
      other_recurrent_amount: 200_000,
      total_recurrent_amount: 1_000_000,
      capital_amount: 500_000,
      total_budget_amount: 1_500_000,
    },
    {
      mda_id: MDA_PHCMB,
      mda_name: "PHCMB",
      fiscal_year: 2026,
      personnel_amount: 400_000,
      other_recurrent_amount: 200_000,
      total_recurrent_amount: 600_000,
      capital_amount: 400_000,
      total_budget_amount: 1_000_000,
    },
  ];
}

export function aopFixtures(): AopActivityLite[] {
  return [
    {
      id: AOP_1,
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      fiscal_year: 2026,
      activity_code: "P-001",
      description: "Immunisation outreach",
      budgeted_cost: 800_000,
      active: true,
    },
    {
      id: "aop-2",
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      fiscal_year: 2026,
      activity_code: "P-002",
      description: "Maternal care",
      budgeted_cost: 300_000,
      active: true,
    },
    {
      id: "aop-archived",
      mda_id: MDA_HEALTH,
      mda_name: "Ministry of Health",
      fiscal_year: 2024,
      activity_code: "P-100",
      description: "Archived",
      budgeted_cost: 100_000,
      active: false,
    },
  ];
}
