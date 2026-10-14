import { requirePermission } from "@/lib/auth/current-user";
import { PatientForm } from "../patient-form";
import { createPatientAction } from "../actions";

export default async function NewPatientPage() {
  await requirePermission("patient.create");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">New patient</h1>
        <p className="mt-1 text-sm text-ink-muted">A patient ID will be assigned automatically.</p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-6">
        <PatientForm action={createPatientAction} submitLabel="Register patient" />
      </div>
    </div>
  );
}
