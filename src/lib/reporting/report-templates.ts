/**
 * Registry of the audience-specific report templates surfaced on the reports
 * hub (`/admin/reports`). This is the single source of truth for template
 * identity and routing; the live signal chips shown on each hub card are added
 * in Phase 1 once the signals engine exists.
 */
import type { AppRoute } from "@/lib/access";

export type ReportTemplateId = "cso" | "bir" | "audit" | "mbp";

export type ReportTemplate = {
  id: ReportTemplateId;
  route: Extract<
    AppRoute,
    | "/admin/reports/cso"
    | "/admin/reports/bir"
    | "/admin/reports/audit"
    | "/admin/reports/mbp"
  >;
  title: string;
  /** Short audience label rendered as the card eyebrow. */
  audience: string;
  description: string;
  /** Section names shown as content chips on the hub card. */
  contents: string[];
  /** CSO only: per-period editable narrative. */
  hasNarrative: boolean;
  /** Audit only: per-register CSV downloads. */
  hasCsv: boolean;
};

export const REPORT_TEMPLATES: Record<ReportTemplateId, ReportTemplate> = {
  cso: {
    id: "cso",
    route: "/admin/reports/cso",
    title: "Accountability Brief",
    audience: "For civil society",
    description:
      "Findings with signals, plain-language interpretation, recommendations, and watch indicators.",
    contents: ["10 findings", "Programme table", "YoY vs 2025", "Q2 watchlist"],
    hasNarrative: true,
    hasCsv: false,
  },
  bir: {
    id: "bir",
    route: "/admin/reports/bir",
    title: "Budget Implementation Report",
    audience: "Official · Government",
    description:
      "The formal document: summary table, graphs, per-MDA classification tables, and PHC deep-dive.",
    contents: ["Summary table", "Per-MDA tables", "Economic class", "PHC section"],
    hasNarrative: false,
    hasCsv: false,
  },
  audit: {
    id: "audit",
    route: "/admin/reports/audit",
    title: "Audit Report & Registers",
    audience: "For the Auditor General",
    description:
      "Voucher-level registers, exception listing, and funding reconciliation as searchable tables.",
    contents: ["Expenditure register", "Funding register", "Exceptions", "Reconciliation"],
    hasNarrative: false,
    hasCsv: true,
  },
  mbp: {
    id: "mbp",
    route: "/admin/reports/mbp",
    title: "Execution & Absorption Review",
    audience: "For Budget & Planning",
    description:
      "Pro-rata execution by MDA, AOP variance, absorption analysis, composition, and release calendar.",
    contents: ["Pro-rata bullets", "AOP variance", "Absorption", "Release calendar"],
    hasNarrative: false,
    hasCsv: false,
  },
};

export const REPORT_TEMPLATE_ORDER: ReportTemplateId[] = ["cso", "bir", "audit", "mbp"];
