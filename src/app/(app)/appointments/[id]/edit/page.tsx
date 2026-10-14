import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { toNepalDateInputValue, toNepalTimeInputValue } from "@/lib/date";
import { AppointmentForm } from "../../appointment-form";
import { updateAppointmentAction } from "../../actions";

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("appointment.update");
  const { id } = await params;

  const [appointment, doctors] = await Promise.all([
    db.appointment.findUnique({ where: { id }, include: { patient: true } }),
    db.user.findMany({
      where: { isActive: true, role: { key: "DOCTOR" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!appointment) notFound();

  const boundAction = updateAppointmentAction.bind(null, appointment.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Reschedule appointment</h1>
        <p className="mt-1 text-sm text-ink-muted">{appointment.patient.fullName}</p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-6">
        <AppointmentForm
          action={boundAction}
          doctors={doctors}
          submitLabel="Save changes"
          initialValues={{
            patientId: appointment.patient.id,
            patientLabel: `${appointment.patient.fullName} (${appointment.patient.patientCode})`,
            doctorId: appointment.doctorId,
            date: toNepalDateInputValue(appointment.scheduledAt),
            time: toNepalTimeInputValue(appointment.scheduledAt),
            durationMinutes: appointment.durationMinutes,
            reason: appointment.reason ?? "",
            notes: appointment.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
