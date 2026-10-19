import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { toNepalDateInputValue } from "@/lib/date";
import { AdvanceForm } from "../../ledger-forms";
import { recordAdvanceAction } from "../../actions";

export default async function NewAdvancePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  await requirePermission("payment.record");
  const params = await searchParams;

  const [paymentMethods, patient] = await Promise.all([
    db.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    params.patientId ? db.patient.findUnique({ where: { id: params.patientId } }) : Promise.resolve(null),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Record advance</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Cash received before treatment is billed. It counts as today&apos;s collection and is held as the
          patient&apos;s credit until applied to invoices.
        </p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-6">
        <AdvanceForm
          action={recordAdvanceAction}
          paymentMethods={paymentMethods}
          todayValue={toNepalDateInputValue(new Date())}
          initialPatientId={patient?.id}
          initialPatientLabel={patient ? `${patient.fullName} (${patient.patientCode})` : undefined}
        />
      </div>
    </div>
  );
}
