import type { EconClass } from "@/lib/public/types";

// Shared by server and client components (kept out of "use client" modules).

export const CLASS_COLOR: Record<EconClass, string> = {
  total: "var(--pub-green)",
  personnel: "var(--pub-personnel)",
  overhead: "var(--pub-overhead)",
  capital: "var(--pub-capital)",
  other: "var(--pub-other)",
};

export const CLASS_LABEL: Record<EconClass, string> = {
  total: "All spending",
  personnel: "Personnel",
  overhead: "Overhead",
  capital: "Capital",
  other: "Other recurrent",
};

export const CLASS_HINT: Record<EconClass, string> = {
  total: "Everything the health sector budgets and spends",
  personnel: "Salaries and allowances",
  overhead: "Running costs: utilities, travel, supplies, maintenance",
  capital: "Buildings, equipment and projects",
  other: "Other recurrent costs such as grants and transfers",
};
