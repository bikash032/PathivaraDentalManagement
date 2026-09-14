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
          <h1 className="text-xl font-semibold text-slate-900">{formatBSDate(visit.visitDate)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link href={`/patients/${visit.patient.id}`} className="underline">
              {visit.patient.fullName}
            </Link>{" "}
            · Dr. {visit.doctor.name}
          </p>
        </div>
        {hasPermission(user, "visit.update") ? (
          <Link
            href={`/visits/${visit.id}/edit`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
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
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Prescription</h2>
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 pr-4">Medicine</th>
                <th className="py-1 pr-4">Dosage</th>
                <th className="py-1 pr-4">Frequency</th>
                <th className="py-1 pr-4">Duration</th>
                <th className="py-1 pr-4">Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visit.prescriptions.flatMap((p) =>
                p.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-4 font-medium text-slate-900">{item.medicineName}</td>
                    <td className="py-2 pr-4 text-slate-600">{item.dosage ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{item.frequency ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{item.durationDays ? `${item.durationDays} days` : "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{item.instructions ?? "—"}</td>
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
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{value}</p>
    </div>
  );
}
