import { requirePermission } from "@/lib/auth/current-user";
import { PatientForm } from "../patient-form";
import { createPatientAction } from "../actions";

export default async function NewPatientPage() {
  await requirePermission("patient.create");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">New patient</h1>
        <p className="mt-1 text-sm text-slate-500">A patient ID will be assigned automatically.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <PatientForm action={createPatientAction} submitLabel="Register patient" />
      </div>
    </div>
  );
}
