import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/current-user";
import { NAV_ITEMS } from "@/lib/nav";
import { logoutAction } from "./actions";

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white sm:block">
          <div className="border-b border-slate-200 px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">
              {process.env.CLINIC_NAME ?? "Pathivara Dental Clinic"}
            </p>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <div className="text-sm text-slate-500">
              Signed in as <span className="font-medium text-slate-900">{user.name}</span> ({user.roleName})
            </div>
            <div className="flex items-center gap-4">
              <Link href="/account" className="text-sm text-slate-500 hover:text-slate-900">
                Account
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
                  Sign out
                </button>
              </form>
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
