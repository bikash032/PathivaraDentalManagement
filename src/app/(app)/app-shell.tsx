import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/current-user";
import { NAV_ITEMS } from "@/lib/nav";
import { logoutAction } from "./actions";
import { NavLinks } from "./nav-links";

export function AppShell({
  user,
  clinicName,
  children,
}: {
  user: CurrentUser;
  clinicName: string;
  children: React.ReactNode;
}) {
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission));

  return (
    <div className="min-h-screen bg-page">
      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-line bg-surface sm:block">
          <div className="border-b border-line px-4 py-4">
            <p className="wrap-break-word text-base font-semibold leading-snug text-primary">{clinicName}</p>
          </div>
          <NavLinks items={visibleNavItems} />
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
            <div className="text-sm text-ink-muted">
              Signed in as <span className="font-medium text-ink">{user.name}</span> ({user.roleName})
            </div>
            <div className="flex items-center gap-4">
              <Link href="/account" className="text-sm text-ink-muted hover:text-primary">
                Account
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="text-sm text-ink-muted hover:text-primary">
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
