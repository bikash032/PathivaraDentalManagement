import { requirePermission } from "@/lib/auth/current-user";
import { TreatmentForm } from "../treatment-form";
import { createTreatmentAction } from "../actions";

export default async function NewTreatmentPage() {
  await requirePermission("treatment.manage");

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-ink">New treatment</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <TreatmentForm action={createTreatmentAction} submitLabel="Create treatment" />
      </div>
    </div>
  );
}
