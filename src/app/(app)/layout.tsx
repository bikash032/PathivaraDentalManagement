import { requireUser } from "@/lib/auth/current-user";
import { getClinicProfile } from "@/lib/clinic-settings";
import { AppShell } from "./app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, clinic] = await Promise.all([requireUser(), getClinicProfile()]);
  return (
    <AppShell user={user} clinicName={clinic.clinicName}>
      {children}
    </AppShell>
  );
}
