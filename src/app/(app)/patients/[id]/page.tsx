import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatDateNepal, formatDateTimeNepal } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { archivePatientAction, reactivatePatientAction } from "../actions";

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("patient.view");
  const { id } = await params;

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  const canViewAppointments = hasPermission(user, "appointment.view");
  const canViewVisits = hasPermission(user, "visit.view");
  const canViewBilling = hasPermission(user, "billing.view");

  const [appointments, visits, invoices] = await Promise.all([
    canViewAppointments
      ? db.appointment.findMany({
          where: { patientId: id },
          orderBy: { scheduledAt: "desc" },
          take: 10,
          include: { doctor: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canViewVisits
      ? db.visit.findMany({
          where: { patientId: id },
          orderBy: { visitDate: "desc" },
          take: 10,
          include: { doctor: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canViewBilling
      ? db.invoice.findMany({
          where: { patientId: id },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{patient.fullName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {patient.patientCode} · {patient.phone}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/print/patients/${patient.id}`}
            target="_blank"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Print
          </Link>
          {hasPermission(user, "patient.update") ? (
            <Link
              href={`/patients/${patient.id}/edit`}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Link>
          ) : null}
          {hasPermission(user, "patient.archive") ? (
            patient.status === "ACTIVE" ? (
              <form action={archivePatientAction.bind(null, patient.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Archive
                </button>
              </form>
            ) : (
              <form action={reactivatePatientAction.bind(null, patient.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reactivate
                </button>
              </form>
            )
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-3">
        <InfoItem label="Gender" value={patient.gender} />
        <InfoItem
          label="Date of birth"
          value={patient.dateOfBirth ? formatDateNepal(patient.dateOfBirth) : "—"}
        />
        <InfoItem label="Approx. age" value={patient.approxAge ? String(patient.approxAge) : "—"} />
        <InfoItem label="Alternate phone" value={patient.alternatePhone ?? "—"} />
        <InfoItem label="Address" value={patient.address ?? "—"} />
        <InfoItem label="Status" value={patient.status} />
        <InfoItem label="Emergency contact" value={patient.emergencyContactName ?? "—"} />
        <InfoItem label="Emergency phone" value={patient.emergencyContactPhone ?? "—"} />
        <InfoItem label="Registered" value={formatDateNepal(patient.createdAt)} />
      </div>

      {patient.allergies ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Allergies</p>
          <p className="mt-1 text-sm text-amber-900">{patient.allergies}</p>
        </div>
      ) : null}

      {patient.medicalNotes ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medical notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{patient.medicalNotes}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {canViewAppointments ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Appointments</h2>
              {hasPermission(user, "appointment.create") ? (
                <Link href={`/appointments/new?patientId=${patient.id}`} className="text-xs text-slate-500 underline">
                  Book
                </Link>
              ) : null}
            </div>
            {appointments.length === 0 ? (
              <p className="text-sm text-slate-400">No appointments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {appointments.map((a) => (
                  <li key={a.id} className="py-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-900">{formatDateTimeNepal(a.scheduledAt)}</span>
                      <span className="text-xs text-slate-500">{a.status}</span>
                    </div>
                    <div className="text-xs text-slate-400">Dr. {a.doctor.name}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {canViewVisits ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Visits</h2>
            {visits.length === 0 ? (
              <p className="text-sm text-slate-400">No visit records yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visits.map((v) => (
                  <li key={v.id} className="py-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-900">{formatDateNepal(v.visitDate)}</span>
                      <span className="text-xs text-slate-500">Dr. {v.doctor.name}</span>
                    </div>
                    <div className="text-xs text-slate-400">{v.chiefComplaint}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {canViewBilling ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-400">No invoices yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1 pr-4">Invoice</th>
                    <th className="py-1 pr-4">Date</th>
                    <th className="py-1 pr-4">Total</th>
                    <th className="py-1 pr-4">Paid</th>
                    <th className="py-1 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2 pr-4">
                        <Link href={`/billing/${inv.id}`} className="font-medium text-slate-900 hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-slate-500">{formatDateNepal(inv.createdAt)}</td>
                      <td className="py-2 pr-4">{formatNPR(inv.totalAmount)}</td>
                      <td className="py-2 pr-4">{formatNPR(inv.paidAmount)}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500">{inv.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}
