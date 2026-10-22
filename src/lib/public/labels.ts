import type { EconClass } from "@/lib/public/types";

// Shared by server and client components (kept out of "use client" modules).

export const CLASS_COLOR: Record<EconClass, string> = {
  total: "var(--pub-brand)",
  personnel: "var(--pub-personnel)",
  overhead: "var(--pub-overhead)",
  capital: "var(--pub-capital)",
  other: "var(--pub-other)",
};

export const CLASS_LABEL: Record<EconClass, string> = {
  total: "All spending",
  personnel: "Salaries",
  overhead: "Running costs",
  capital: "Capital projects",
  other: "Other",
};

export const CLASS_HINT: Record<EconClass, string> = {
  total: "Everything the health sector budgets and spends",
  personnel: "Staff pay and allowances (\"personnel\" in the reports)",
  overhead: "Utilities, travel, supplies, maintenance (\"overhead\")",
  capital: "Buildings, equipment and other projects (\"capital\")",
  other: "Grants, transfers and other recurrent costs",
};
