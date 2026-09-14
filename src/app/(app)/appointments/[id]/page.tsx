import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatDateTimeNepal } from "@/lib/date";
import { StatusButtons } from "../status-buttons";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  IN_CONSULTATION: "In consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("appointment.view");
  const { id } = await params;

  const appointment = await db.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { select: { id: true, name: true } },
      visit: true,
    },
  });
  if (!appointment) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{formatDateTimeNepal(appointment.scheduledAt)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link href={`/patients/${appointment.patient.id}`} className="underline">
              {appointment.patient.fullName}
            </Link>{" "}
            · Dr. {appointment.doctor.name}
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission(user, "appointment.update") && appointment.status !== "COMPLETED" ? (
            <Link
              href={`/appointments/${appointment.id}/edit`}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reschedule
            </Link>
          ) : null}
          {hasPermission(user, "visit.create") && !appointment.visit && appointment.status !== "CANCELLED" ? (
            <Link
              href={`/visits/new?appointmentId=${appointment.id}`}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Start visit
            </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1 text-sm text-slate-900">{STATUS_LABELS[appointment.status]}</p>
        </div>
        {appointment.reason ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Reason</p>
            <p className="mt-1 text-sm text-slate-900">{appointment.reason}</p>
          </div>
        ) : null}
        {appointment.notes ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{appointment.notes}</p>
          </div>
        ) : null}
        {appointment.visit ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Visit</p>
            <Link href={`/visits/${appointment.visit.id}`} className="mt-1 block text-sm text-slate-900 underline">
              View visit record
            </Link>
          </div>
        ) : null}
        {hasPermission(user, "appointment.update") ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Update status</p>
            <StatusButtons appointmentId={appointment.id} status={appointment.status} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
