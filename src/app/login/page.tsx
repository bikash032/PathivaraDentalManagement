import { LoginForm } from "./login-form";

export default function LoginPage() {
  const clinicName = process.env.CLINIC_NAME ?? "Pathivara Dental Clinic";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">{clinicName}</h1>
          <p className="mt-1 text-sm text-slate-500">Staff sign in</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
