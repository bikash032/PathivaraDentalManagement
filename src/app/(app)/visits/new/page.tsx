import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { VisitForm } from "../visit-form";
import { createVisitAction } from "../actions";

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ appointmentId?: string; patientId?: string }>;
}) {
  const user = await requirePermission("visit.create");
  const params = await searchParams;

  const [doctors, appointment, patient] = await Promise.all([
    db.user.findMany({
      where: { isActive: true, role: { key: "DOCTOR" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    params.appointmentId
      ? db.appointment.findUnique({ where: { id: params.appointmentId }, include: { patient: true } })
      : Promise.resolve(null),
    !params.appointmentId && params.patientId
      ? db.patient.findUnique({ where: { id: params.patientId } })
      : Promise.resolve(null),
  ]);

  const resolvedPatient = appointment?.patient ?? patient;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">New visit</h1>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <VisitForm
          action={createVisitAction}
          doctors={doctors}
          submitLabel="Save visit"
          lockPatient={Boolean(resolvedPatient)}
          initialValues={{
            patientId: resolvedPatient?.id,
            patientLabel: resolvedPatient ? `${resolvedPatient.fullName} (${resolvedPatient.patientCode})` : undefined,
            appointmentId: appointment?.id,
            doctorId: appointment?.doctorId ?? (user.roleKey === "DOCTOR" ? user.id : undefined),
          }}
        />
      </div>
    </div>
  );
}
