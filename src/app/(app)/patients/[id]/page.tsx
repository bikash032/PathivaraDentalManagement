import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate, formatBSDateTime } from "@/lib/date";
import { getClinicTimezone } from "@/lib/clinic-settings";
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

  const timezone = await getClinicTimezone();
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
          <h1 className="text-xl font-semibold text-ink">{patient.fullName}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {patient.patientCode} · {patient.phone}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/print/patients/${patient.id}`}
            target="_blank"
            className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
          >
            Print
          </Link>
          {hasPermission(user, "patient.update") ? (
            <Link
              href={`/patients/${patient.id}/edit`}
              className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
            >
              Edit
            </Link>
          ) : null}
          {hasPermission(user, "patient.archive") ? (
            patient.status === "ACTIVE" ? (
              <form action={archivePatientAction.bind(null, patient.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-danger-line bg-surface px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft"
                >
                  Archive
                </button>
              </form>
            ) : (
              <form action={reactivatePatientAction.bind(null, patient.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
                >
                  Reactivate
                </button>
              </form>
            )
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-5 sm:grid-cols-3">
        <InfoItem label="Gender" value={patient.gender} />
        <InfoItem
          label="Date of birth"
          value={patient.dateOfBirth ? formatBSDate(patient.dateOfBirth) : "—"}
        />
        <InfoItem label="Approx. age" value={patient.approxAge ? String(patient.approxAge) : "—"} />
        <InfoItem label="Alternate phone" value={patient.alternatePhone ?? "—"} />
        <InfoItem label="Address" value={patient.address ?? "—"} />
        <InfoItem label="Status" value={patient.status} />
        <InfoItem label="Emergency contact" value={patient.emergencyContactName ?? "—"} />
        <InfoItem label="Emergency phone" value={patient.emergencyContactPhone ?? "—"} />
        <InfoItem label="Registered" value={formatBSDate(patient.createdAt)} />
      </div>

      {patient.allergies ? (
        <div className="rounded-lg border border-warning-line bg-warning-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning-ink">Allergies</p>
          <p className="mt-1 text-sm text-warning-ink">{patient.allergies}</p>
        </div>
      ) : null}

      {patient.medicalNotes ? (
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Medical notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-secondary">{patient.medicalNotes}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {canViewAppointments ? (
          <section className="rounded-lg border border-line bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-secondary">Appointments</h2>
              {hasPermission(user, "appointment.create") ? (
                <Link href={`/appointments/new?patientId=${patient.id}`} className="text-xs underline text-primary hover:text-primary-hover">
                  Book
                </Link>
              ) : null}
            </div>
            {appointments.length === 0 ? (
              <p className="text-sm text-ink-muted">No appointments yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {appointments.map((a) => (
                  <li key={a.id} className="py-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink">{formatBSDateTime(a.scheduledAt, timezone)}</span>
                      <span className="text-xs text-ink-muted">{a.status}</span>
                    </div>
                    <div className="text-xs text-ink-muted">Dr. {a.doctor.name}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {canViewVisits ? (
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Visits</h2>
            {visits.length === 0 ? (
              <p className="text-sm text-ink-muted">No visit records yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {visits.map((v) => (
                  <li key={v.id} className="py-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink">{formatBSDate(v.visitDate)}</span>
                      <span className="text-xs text-ink-muted">Dr. {v.doctor.name}</span>
                    </div>
                    <div className="text-xs text-ink-muted">{v.chiefComplaint}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {canViewBilling ? (
          <section className="rounded-lg border border-line bg-surface p-5 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-ink-muted">No invoices yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-line-soft text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-muted">
                    <th className="py-1 pr-4">Invoice</th>
                    <th className="py-1 pr-4">Date</th>
                    <th className="py-1 pr-4">Total</th>
                    <th className="py-1 pr-4">Paid</th>
                    <th className="py-1 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2 pr-4">
                        <Link href={`/billing/${inv.id}`} className="font-medium text-ink hover:underline hover:text-primary">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-ink-muted">{formatBSDate(inv.createdAt)}</td>
                      <td className="py-2 pr-4">{formatNPR(inv.totalAmount)}</td>
                      <td className="py-2 pr-4">{formatNPR(inv.paidAmount)}</td>
                      <td className="py-2 pr-4 text-xs text-ink-muted">{inv.status}</td>
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
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-sm text-ink">{value}</p>
    </div>
  );
}
