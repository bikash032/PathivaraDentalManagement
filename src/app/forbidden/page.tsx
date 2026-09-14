import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Access denied</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Your account does not have permission to view this page. Contact an administrator if you believe this is a
        mistake.
      </p>
      <Link href="/dashboard" className="text-sm font-medium text-slate-900 underline">
        Back to dashboard
      </Link>
    </main>
  );
}
