import { requireUser } from "@/lib/auth/current-user";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">My account</h1>
        <p className="mt-1 text-sm text-ink-muted">Account details and password.</p>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-lg border border-line bg-surface p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Name</dt>
          <dd className="mt-1 text-sm text-ink">{user.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Email</dt>
          <dd className="mt-1 text-sm text-ink">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Role</dt>
          <dd className="mt-1 text-sm text-ink">{user.roleName}</dd>
        </div>
      </dl>

      <div className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Change password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
