import { requirePermission } from "@/lib/auth/current-user";
import { TreatmentForm } from "../treatment-form";
import { createTreatmentAction } from "../actions";

export default async function NewTreatmentPage() {
  await requirePermission("treatment.manage");

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">New treatment</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <TreatmentForm action={createTreatmentAction} submitLabel="Create treatment" />
      </div>
    </div>
  );
}
