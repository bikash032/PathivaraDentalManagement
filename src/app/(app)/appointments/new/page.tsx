import { requirePermission, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { toNepalDateInputValue } from "@/lib/date";
import { getClinicTimezone } from "@/lib/clinic-settings";
import { AppointmentForm } from "../appointment-form";
import { createAppointmentAction } from "../actions";
import { UpcomingAppointments } from "../upcoming-appointments";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; date?: string }>;
}) {
  const user = await requirePermission("appointment.create");
  const params = await searchParams;

  const [doctors, patient, timezone] = await Promise.all([
    db.user.findMany({
      where: { isActive: true, role: { key: "DOCTOR" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    params.patientId ? db.patient.findUnique({ where: { id: params.patientId } }) : Promise.resolve(null),
    getClinicTimezone(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">New appointment</h1>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full rounded-lg border border-line bg-surface p-6 lg:max-w-2xl">
          <AppointmentForm
            action={createAppointmentAction}
            doctors={doctors}
            submitLabel="Book appointment"
            initialValues={{
              patientId: patient?.id,
              patientLabel: patient ? `${patient.fullName} (${patient.patientCode})` : undefined,
              date: params.date ?? toNepalDateInputValue(new Date()),
            }}
          />
        </div>
        {hasPermission(user, "appointment.view") ? (
          <div className="w-full min-w-0 lg:sticky lg:top-6 lg:flex-1">
            <UpcomingAppointments doctors={doctors} timezone={timezone} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
