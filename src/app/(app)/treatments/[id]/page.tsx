import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { TreatmentForm } from "../treatment-form";
import { updateTreatmentAction } from "../actions";

export default async function EditTreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("treatment.manage");
  const { id } = await params;

  const treatment = await db.treatment.findUnique({ where: { id } });
  if (!treatment) notFound();

  const boundAction = updateTreatmentAction.bind(null, treatment.id);

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-ink">Edit treatment</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <TreatmentForm
          action={boundAction}
          submitLabel="Save changes"
          initialValues={{
            name: treatment.name,
            code: treatment.code,
            description: treatment.description ?? "",
            defaultPrice: treatment.defaultPrice.toString(),
            isActive: treatment.isActive,
          }}
        />
      </div>
    </div>
  );
}
