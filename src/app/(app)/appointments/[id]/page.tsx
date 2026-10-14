import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDateTime } from "@/lib/date";
import { getClinicTimezone } from "@/lib/clinic-settings";
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

  const timezone = await getClinicTimezone();
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
          <h1 className="text-xl font-semibold text-ink">{formatBSDateTime(appointment.scheduledAt, timezone)}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <Link href={`/patients/${appointment.patient.id}`} className="underline text-primary hover:text-primary-hover">
              {appointment.patient.fullName}
            </Link>{" "}
            · Dr. {appointment.doctor.name}
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission(user, "appointment.update") && appointment.status !== "COMPLETED" ? (
            <Link
              href={`/appointments/${appointment.id}/edit`}
              className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
            >
              Reschedule
            </Link>
          ) : null}
          {hasPermission(user, "visit.create") && !appointment.visit && appointment.status !== "CANCELLED" ? (
            <Link
              href={`/visits/new?appointmentId=${appointment.id}`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Start visit
            </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-5 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Status</p>
          <p className="mt-1 text-sm text-ink">{STATUS_LABELS[appointment.status]}</p>
        </div>
        {appointment.reason ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Reason</p>
            <p className="mt-1 text-sm text-ink">{appointment.reason}</p>
          </div>
        ) : null}
        {appointment.notes ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{appointment.notes}</p>
          </div>
        ) : null}
        {appointment.visit ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Visit</p>
            <Link href={`/visits/${appointment.visit.id}`} className="mt-1 block text-sm underline text-primary hover:text-primary-hover">
              View visit record
            </Link>
          </div>
        ) : null}
        {hasPermission(user, "appointment.update") ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Update status</p>
            <StatusButtons appointmentId={appointment.id} status={appointment.status} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
