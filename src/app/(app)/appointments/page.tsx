import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getDayRangeNepal, toNepalDateInputValue, addADDays, adDaysBetween } from "@/lib/date";
import { formatBSDate, formatBSDateLong, formatBSDateShort, formatNepalTime } from "@/lib/bs-date";
import { getClinicTimezone } from "@/lib/clinic-settings";
import type { Prisma, AppointmentStatus } from "@/generated/prisma/client";
import { StatusButtons } from "./status-buttons";
import { DateRangeForm } from "./date-range-form";
import { STATUS_COLORS, STATUS_LABELS } from "./status";

type AppointmentRow = Prisma.AppointmentGetPayload<{
  include: {
    patient: { select: { id: true; fullName: true; patientCode: true; phone: true } };
    doctor: { select: { id: true; name: true } };
  };
}>;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    date?: string;
    doctorId?: string;
    status?: string;
  }>;
}) {
  const user = await requirePermission("appointment.view");
  const params = await searchParams;
  const today = toNepalDateInputValue(new Date());

  // `date` is the legacy single-day parameter; existing links still resolve to
  // a one-day range. Supplying only `from` also means "just that day".
  const fallback = params.date ?? today;
  const from = params.from ?? fallback;
  const to = params.to ?? params.from ?? fallback;

  const rangeInvalid = from > to;
  const isSingleDay = from === to;

  // Inclusive range in Nepal Time: 00:00 on `from` up to — but not including —
  // 00:00 on the day after `to`, so appointments at any time on the To date
  // (23:59 included) still match.
  const start = getDayRangeNepal(from).start;
  const end = getDayRangeNepal(to).end;
  const toDayStart = getDayRangeNepal(to).start;

  const where: Prisma.AppointmentWhereInput = {
    scheduledAt: { gte: start, lt: end },
    ...(params.doctorId ? { doctorId: params.doctorId } : {}),
    ...(params.status ? { status: params.status as AppointmentStatus } : {}),
  };

  const timezone = await getClinicTimezone();
  const [appointments, doctors] = await Promise.all([
    // An invalid range is never queried — the form asks the user to fix it first.
    rangeInvalid
      ? Promise.resolve<AppointmentRow[]>([])
      : db.appointment.findMany({
          where,
          orderBy: { scheduledAt: "asc" },
          include: {
            patient: { select: { id: true, fullName: true, patientCode: true, phone: true } },
            doctor: { select: { id: true, name: true } },
          },
        }),
    db.user.findMany({
      where: { isActive: true, role: { key: "DOCTOR" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Stepping moves the whole window by its own length, so a single-day view
  // still steps one day at a time.
  const span = adDaysBetween(from, to) + 1;

  function buildHref(overrides: Record<string, string>) {
    const next = new URLSearchParams();
    next.set("from", from);
    next.set("to", to);
    if (params.doctorId) next.set("doctorId", params.doctorId);
    if (params.status) next.set("status", params.status);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `/appointments?${next.toString()}`;
  }

  const columnCount =
    (isSingleDay ? 5 : 6) + (hasPermission(user, "appointment.update") ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Appointments</h1>
        {hasPermission(user, "appointment.create") ? (
          <Link
            href={`/appointments/new?date=${from}`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            New appointment
          </Link>
        ) : null}
      </div>

      <div className="space-y-3">
        <DateRangeForm
          from={from}
          to={to}
          today={today}
          doctorId={params.doctorId}
          status={params.status}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={buildHref({ from: addADDays(from, -span), to: addADDays(to, -span) })}
              aria-label="Previous period"
              className="rounded-md border border-field-line bg-surface px-3 py-2 text-sm hover:bg-page hover:border-secondary hover:text-secondary"
            >
              ←
            </Link>
            <Link
              href={buildHref({ from: addADDays(from, span), to: addADDays(to, span) })}
              aria-label="Next period"
              className="rounded-md border border-field-line bg-surface px-3 py-2 text-sm hover:bg-page hover:border-secondary hover:text-secondary"
            >
              →
            </Link>
          </div>

          <form action="/appointments" className="flex items-center gap-2">
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            <select name="doctorId" defaultValue={params.doctorId ?? ""} className="rounded-md border border-field-line px-3 py-2 text-sm">
              <option value="">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-field-line px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md border border-field-line bg-surface px-3 py-2 text-sm hover:bg-page hover:border-secondary hover:text-secondary">
              Filter
            </button>
          </form>
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        {isSingleDay
          ? formatBSDateLong(start)
          : `${formatBSDate(start)} — ${formatBSDate(toDayStart)}`}
      </p>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-page">
            <tr>
              {isSingleDay ? null : (
                <th className="px-4 py-2 text-left font-medium text-ink-muted">Date</th>
              )}
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Time</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Patient</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Doctor</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Reason</th>
              <th className="px-4 py-2 text-left font-medium text-ink-muted">Status</th>
              {hasPermission(user, "appointment.update") ? (
                <th className="px-4 py-2 text-left font-medium text-ink-muted">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-ink-muted">
                  {rangeInvalid
                    ? "From date cannot be later than to date."
                    : "No appointments found for the selected date range."}
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <tr key={a.id} className="hover:bg-page">
                  {isSingleDay ? null : (
                    <td className="whitespace-nowrap px-4 py-2 text-ink-secondary">
                      {formatBSDateShort(a.scheduledAt)}
                    </td>
                  )}
                  <td className="px-4 py-2 text-ink">{formatNepalTime(a.scheduledAt, timezone)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/appointments/${a.id}`} className="font-medium text-ink hover:underline hover:text-primary">
                      {a.patient.fullName}
                    </Link>
                    <div className="text-xs text-ink-muted">{a.patient.patientCode}</div>
                  </td>
                  <td className="px-4 py-2 text-ink-secondary">{a.doctor.name}</td>
                  <td className="px-4 py-2 text-ink-secondary">{a.reason ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  {hasPermission(user, "appointment.update") ? (
                    <td className="px-4 py-2">
                      <StatusButtons appointmentId={a.id} status={a.status} />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
