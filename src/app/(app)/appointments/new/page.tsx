import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { toNepalDateInputValue } from "@/lib/date";
import { AppointmentForm } from "../appointment-form";
import { createAppointmentAction } from "../actions";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; date?: string }>;
}) {
  await requirePermission("appointment.create");
  const params = await searchParams;

  const [doctors, patient] = await Promise.all([
    db.user.findMany({
      where: { isActive: true, role: { key: "DOCTOR" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    params.patientId ? db.patient.findUnique({ where: { id: params.patientId } }) : Promise.resolve(null),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">New appointment</h1>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
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
    </div>
  );
}
