import type { LucideIcon } from "lucide-react";
import {
  BarChart3Icon,
  CalendarRangeIcon,
  DatabaseIcon,
  FileInputIcon,
  InboxIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MessageSquarePlusIcon,
  PieChartIcon,
  ReceiptTextIcon,
  SettingsIcon,
  TargetIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";
import type { AppProfile } from "@/lib/auth-types";
import { type AppRoute } from "@/lib/access";

export type NavigationSection = "operations" | "entries" | "review" | "admin" | "personal";

export type NavigationItem = {
  label: string;
  path: AppRoute;
  icon: LucideIcon;
  /** Legacy role hint; visibility is resolved via `canAccessRoute`. */
  roles: AppProfile["role"][];
  section: NavigationSection;
};

export const navigationItems: NavigationItem[] = [
  {
    label: "MDA Dashboard",
    path: "/mda",
    icon: LayoutDashboardIcon,
    roles: ["mda_user", "reviewer", "admin"],
    section: "operations",
  },
  {
    label: "Funding Entries",
    path: "/funding",
    icon: LandmarkIcon,
    roles: ["mda_user", "admin"],
    section: "entries",
  },
  {
    label: "Expenditure Entries",
    path: "/expenditure",
    icon: ReceiptTextIcon,
    roles: ["mda_user", "admin", "facility_user"],
    section: "entries",
  },
  {
    label: "Review Queue",
    path: "/review",
    icon: ListChecksIcon,
    roles: ["reviewer", "admin"],
    section: "review",
  },
  {
    label: "Admin Insights",
    path: "/admin",
    icon: BarChart3Icon,
    roles: ["admin"],
    section: "admin",
  },
  {
    label: "Reports",
    path: "/admin/reports",
    icon: PieChartIcon,
    roles: ["admin", "reviewer"],
    section: "admin",
  },
  {
    label: "Users",
    path: "/admin/users",
    icon: UsersIcon,
    roles: ["admin"],
    section: "admin",
  },
  {
    label: "Reference data",
    path: "/admin/reference-data",
    icon: DatabaseIcon,
    roles: ["admin"],
    section: "admin",
  },
  {
    label: "Approved budgets",
    path: "/admin/budgets",
    icon: CalendarRangeIcon,
    roles: ["admin"],
    section: "admin",
  },
  {
    label: "AOP activities",
    path: "/admin/aop-activities",
    icon: TargetIcon,
    roles: ["admin"],
    section: "admin",
  },
  {
    label: "Reference requests",
    path: "/admin/reference-requests",
    icon: InboxIcon,
    roles: ["admin"],
    section: "admin",
  },
  {
    label: "Request a value",
    path: "/reference-requests",
    icon: MessageSquarePlusIcon,
    roles: ["mda_user", "reviewer", "facility_user"],
    section: "entries",
  },
  {
    label: "Imports",
    path: "/imports",
    icon: UploadIcon,
    roles: ["admin"],
    section: "admin",
  },
  {
    label: "Settings",
    path: "/settings",
    icon: SettingsIcon,
    roles: ["mda_user", "reviewer", "admin", "facility_user"],
    section: "personal",
  },
];

export const sectionLabels: Record<NavigationSection, string> = {
  operations: "Overview",
  entries: "Workflow",
  review: "Review",
  admin: "Administration",
  personal: "Personal",
};

export const sectionOrder: NavigationSection[] = [
  "operations",
  "entries",
  "review",
  "admin",
  "personal",
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
