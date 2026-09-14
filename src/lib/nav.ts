import type { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  permission?: PermissionKey;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/patients", label: "Patients", permission: "patient.view" },
  { href: "/appointments", label: "Appointments", permission: "appointment.view" },
  { href: "/visits", label: "Visits", permission: "visit.view" },
  { href: "/treatments", label: "Treatments", permission: "treatment.manage" },
  { href: "/billing", label: "Billing", permission: "billing.view" },
  { href: "/reports", label: "Reports", permission: "report.view" },
  { href: "/users", label: "Users", permission: "user.manage" },
  { href: "/settings", label: "Settings", permission: "settings.manage" },
];
