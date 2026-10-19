import Link from "next/link";
import { requireUser, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getTodayRangeNepal, formatBSDateTime } from "@/lib/date";
import { getClinicTimezone } from "@/lib/clinic-settings";
import { formatNPR } from "@/lib/currency";
import { StatCard } from "@/components/stat-card";

export default async function DashboardPage() {
  const user = await requireUser();
  const { start, end } = getTodayRangeNepal();
  const timezone = await getClinicTimezone();

  const canViewAppointments = hasPermission(user, "appointment.view");
  // Clinic-wide money totals are financial reporting, not front-desk billing:
  // Reception can bill (billing.view) but does not see collection/outstanding.
  const canViewBilling = hasPermission(user, "billing.view") && hasPermission(user, "report.view");
  const canViewPatients = hasPermission(user, "patient.view");
  const canViewAudit = hasPermission(user, "audit.view");

  const [
    todayAppointmentsCount,
    pendingAppointmentsCount,
    completedAppointmentsCount,
    cancelledOrNoShowCount,
    todaysCollection,
    outstanding,
    recentPatients,
    recentActivity,
    todayDistinctPatients,
  ] = await Promise.all([
    canViewAppointments
      ? db.appointment.count({ where: { scheduledAt: { gte: start, lt: end } } })
      : Promise.resolve(0),
    canViewAppointments
      ? db.appointment.count({
          where: {
            scheduledAt: { gte: start, lt: end },
            status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_CONSULTATION"] },
          },
        })
      : Promise.resolve(0),
    canViewAppointments
      ? db.appointment.count({
          where: { scheduledAt: { gte: start, lt: end }, status: "COMPLETED" },
        })
      : Promise.resolve(0),
    canViewAppointments
      ? db.appointment.count({
          where: { scheduledAt: { gte: start, lt: end }, status: { in: ["CANCELLED", "NO_SHOW"] } },
        })
      : Promise.resolve(0),
    canViewBilling
      ? db.payment.aggregate({
          where: { paymentDate: { gte: start, lt: end }, voidedAt: null },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    canViewBilling
      ? db.invoice.aggregate({
          where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] }, cancelledAt: null },
          _sum: { totalAmount: true, paidAmount: true },
        })
      : Promise.resolve({ _sum: { totalAmount: null, paidAmount: null } }),
    canViewPatients
      ? db.patient.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
      : Promise.resolve([]),
    canViewAudit
      ? db.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { user: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canViewAppointments
      ? db.appointment.findMany({
          where: { scheduledAt: { gte: start, lt: end } },
          distinct: ["patientId"],
          select: { patientId: true },
        })
      : Promise.resolve([]),
  ]);

  const outstandingAmount =
    Number(outstanding._sum.totalAmount ?? 0) - Number(outstanding._sum.paidAmount ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">{formatBSDateTime(new Date(), timezone)}</p>
      </div>

      {canViewAppointments ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Today</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Appointments" value={String(todayAppointmentsCount)} />
            <StatCard label="Patients seen/booked" value={String(todayDistinctPatients.length)} />
            <StatCard label="Pending" value={String(pendingAppointmentsCount)} />
            <StatCard label="Completed" value={String(completedAppointmentsCount)} />
            <StatCard label="Cancelled / No-show" value={String(cancelledOrNoShowCount)} />
          </div>
        </section>
      ) : null}

      {canViewBilling ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Billing</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Today's collection" value={formatNPR(todaysCollection._sum.amount)} />
            <StatCard label="Outstanding balance" value={formatNPR(outstandingAmount)} />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          {hasPermission(user, "patient.create") ? (
            <Link
              href="/patients/new"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              New patient
            </Link>
          ) : null}
          {hasPermission(user, "appointment.create") ? (
            <Link
              href="/appointments/new"
              className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
            >
              New appointment
            </Link>
          ) : null}
          {hasPermission(user, "invoice.create") ? (
            <Link
              href="/billing/new"
              className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
            >
              New invoice
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {canViewPatients ? (
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Recent patients</h2>
            {recentPatients.length === 0 ? (
              <p className="text-sm text-ink-muted">No patients registered yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {recentPatients.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/patients/${p.id}`} className="font-medium text-ink hover:underline hover:text-primary">
                      {p.fullName}
                    </Link>
                    <span className="text-ink-muted">{p.patientCode}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {canViewAudit ? (
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Recent activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-ink-muted">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="py-2 text-sm">
                    <span className="text-ink">{entry.user?.name ?? "System"}</span>{" "}
                    <span className="text-ink-muted">{entry.action}</span>
                    <div className="text-xs text-ink-muted">{formatBSDateTime(entry.createdAt, timezone)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
