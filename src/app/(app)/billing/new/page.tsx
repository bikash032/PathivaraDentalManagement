import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { InvoiceForm } from "../invoice-form";
import { createInvoiceAction } from "../actions";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  await requirePermission("invoice.create");
  const params = await searchParams;

  const [treatments, patient] = await Promise.all([
    db.treatment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    params.patientId ? db.patient.findUnique({ where: { id: params.patientId } }) : Promise.resolve(null),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">New invoice</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <InvoiceForm
          action={createInvoiceAction}
          treatments={treatments.map((t) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            defaultPrice: t.defaultPrice.toString(),
          }))}
          initialPatientId={patient?.id}
          initialPatientLabel={patient ? `${patient.fullName} (${patient.patientCode})` : undefined}
        />
      </div>
    </div>
  );
}
