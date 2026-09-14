import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getDayRangeNepal, toNepalDateInputValue } from "@/lib/date";
import { formatBSDateLong, formatNepalTime } from "@/lib/bs-date";
import { getClinicTimezone } from "@/lib/clinic-settings";
import type { Prisma, AppointmentStatus } from "@/generated/prisma/client";
import { StatusButtons } from "./status-buttons";
import { DateNavForm } from "./date-nav-form";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  IN_CONSULTATION: "In consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-amber-100 text-amber-700",
  IN_CONSULTATION: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-red-100 text-red-700",
};

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; doctorId?: string; status?: string }>;
}) {
  const user = await requirePermission("appointment.view");
  const params = await searchParams;
  const date = params.date ?? toNepalDateInputValue(new Date());
  const { start, end } = getDayRangeNepal(date);

  const where: Prisma.AppointmentWhereInput = {
    scheduledAt: { gte: start, lt: end },
    ...(params.doctorId ? { doctorId: params.doctorId } : {}),
    ...(params.status ? { status: params.status as AppointmentStatus } : {}),
  };

  const timezone = await getClinicTimezone();
  const [appointments, doctors] = await Promise.all([
    db.appointment.findMany({
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

  function buildHref(overrides: Record<string, string>) {
    const next = new URLSearchParams();
    next.set("date", date);
    if (params.doctorId) next.set("doctorId", params.doctorId);
    if (params.status) next.set("status", params.status);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `/appointments?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Appointments</h1>
        {hasPermission(user, "appointment.create") ? (
          <Link
            href={`/appointments/new?date=${date}`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New appointment
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href={buildHref({ date: addDays(date, -1) })} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            ←
          </Link>
          <DateNavForm date={date} doctorId={params.doctorId} status={params.status} />
          <Link href={buildHref({ date: addDays(date, 1) })} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            →
          </Link>
          <Link href={buildHref({ date: toNepalDateInputValue(new Date()) })} className="text-sm text-slate-500 underline">
            Today
          </Link>
        </div>

        <form action="/appointments" className="flex items-center gap-2">
          <input type="hidden" name="date" value={date} />
          <select name="doctorId" defaultValue={params.doctorId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            Filter
          </button>
        </form>
      </div>

      <p className="text-sm text-slate-500">{formatBSDateLong(start)}</p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Time</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Patient</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Doctor</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Reason</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
              {hasPermission(user, "appointment.update") ? (
                <th className="px-4 py-2 text-left font-medium text-slate-500">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No appointments for this day.
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">{formatNepalTime(a.scheduledAt, timezone)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/appointments/${a.id}`} className="font-medium text-slate-900 hover:underline">
                      {a.patient.fullName}
                    </Link>
                    <div className="text-xs text-slate-400">{a.patient.patientCode}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{a.doctor.name}</td>
                  <td className="px-4 py-2 text-slate-600">{a.reason ?? "—"}</td>
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
