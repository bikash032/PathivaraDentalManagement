import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate } from "@/lib/date";

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("visit.view");
  const { id } = await params;

  const visit = await db.visit.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { select: { name: true } },
      prescriptions: { include: { items: true } },
    },
  });
  if (!visit) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">{formatBSDate(visit.visitDate)}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <Link href={`/patients/${visit.patient.id}`} className="underline text-primary hover:text-primary-hover">
              {visit.patient.fullName}
            </Link>{" "}
            · Dr. {visit.doctor.name}
          </p>
        </div>
        {hasPermission(user, "visit.update") ? (
          <Link
            href={`/visits/${visit.id}/edit`}
            className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
          >
            Edit
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-5 sm:grid-cols-2">
        <Field label="Chief complaint" value={visit.chiefComplaint} />
        <Field label="Examination" value={visit.examination} />
        <Field label="Diagnosis" value={visit.diagnosis} />
        <Field label="Treatment given" value={visit.treatmentNotes} />
        <Field label="Clinical notes" value={visit.clinicalNotes} />
        <Field label="Follow-up instructions" value={visit.followUpInstructions} />
        <Field
          label="Suggested next appointment"
          value={visit.nextAppointmentDate ? formatBSDate(visit.nextAppointmentDate) : null}
        />
      </div>

      {visit.prescriptions.flatMap((p) => p.items).length > 0 ? (
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Prescription</h2>
          <table className="min-w-full divide-y divide-line-soft text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th className="py-1 pr-4">Medicine</th>
                <th className="py-1 pr-4">Dosage</th>
                <th className="py-1 pr-4">Frequency</th>
                <th className="py-1 pr-4">Duration</th>
                <th className="py-1 pr-4">Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {visit.prescriptions.flatMap((p) =>
                p.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-4 font-medium text-ink">{item.medicineName}</td>
                    <td className="py-2 pr-4 text-ink-secondary">{item.dosage ?? "—"}</td>
                    <td className="py-2 pr-4 text-ink-secondary">{item.frequency ?? "—"}</td>
                    <td className="py-2 pr-4 text-ink-secondary">{item.durationDays ? `${item.durationDays} days` : "—"}</td>
                    <td className="py-2 pr-4 text-ink-secondary">{item.instructions ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{value}</p>
    </div>
  );
}
