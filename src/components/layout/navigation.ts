import type { LucideIcon } from "lucide-react";
import {
  BarChart3Icon,
  DownloadIcon,
  FileInputIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ReceiptTextIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/auth-types";
import type { AppRoute } from "@/lib/access";

export type NavigationItem = {
  label: string;
  path: AppRoute;
  icon: LucideIcon;
  roles: AppRole[];
};

export const navigationItems: NavigationItem[] = [
  {
    label: "MDA Dashboard",
    path: "/mda",
    icon: LayoutDashboardIcon,
    roles: ["mda_user", "reviewer", "admin"],
  },
  {
    label: "Funding Entries",
    path: "/funding",
    icon: LandmarkIcon,
    roles: ["mda_user", "admin"],
  },
  {
    label: "Expenditure Entries",
    path: "/expenditure",
    icon: ReceiptTextIcon,
    roles: ["mda_user", "admin"],
  },
  {
    label: "Review Queue",
    path: "/review",
    icon: ListChecksIcon,
    roles: ["reviewer", "admin"],
  },
  {
    label: "Admin Insights",
    path: "/admin",
    icon: BarChart3Icon,
    roles: ["admin"],
  },
  {
    label: "Imports",
    path: "/imports",
    icon: UploadIcon,
    roles: ["admin"],
  },
  {
    label: "Exports",
    path: "/exports",
    icon: DownloadIcon,
    roles: ["reviewer", "admin"],
  },
  {
    label: "Settings",
    path: "/settings",
    icon: SettingsIcon,
    roles: ["mda_user", "reviewer", "admin"],
  },
];

export const coreWorkflowItems = [
  {
    title: "Funding Entry",
    description: "Record MDA funding inflows with reference numbers and programme areas.",
    icon: LandmarkIcon,
  },
  {
    title: "Expenditure Entry",
    description: "Record spending, PHC facility details, payment method, and vouchers.",
    icon: ReceiptTextIcon,
  },
  {
    title: "Admin Import",
    description: "Validate reference, budget, AOP, and historical ledger imports before writes.",
    icon: FileInputIcon,
  },
];
