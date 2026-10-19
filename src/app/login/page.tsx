import { getClinicProfile } from "@/lib/clinic-settings";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const clinic = await getClinicProfile();

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold leading-snug text-primary">{clinic.clinicName}</h1>
          <p className="mt-1 text-sm text-ink-secondary">{clinic.address}</p>
          <p className="mt-3 text-sm text-ink-muted">Staff sign in</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
