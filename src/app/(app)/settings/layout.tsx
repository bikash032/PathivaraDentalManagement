import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("settings.manage");

  const tabs = [
    { href: "/settings", label: "Clinic profile" },
    { href: "/settings/payment-methods", label: "Payment methods" },
    { href: "/settings/roles", label: "Roles & permissions" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Settings</h1>
        <div className="mt-3 flex gap-4 border-b border-line">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-ink-muted hover:border-field-line hover:text-ink"
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
