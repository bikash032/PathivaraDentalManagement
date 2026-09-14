import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { toNepalDateInputValue } from "@/lib/date";
import { VisitForm } from "../../visit-form";
import { updateVisitAction } from "../../actions";

export default async function EditVisitPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("visit.update");
  const { id } = await params;

  const [visit, doctors] = await Promise.all([
    db.visit.findUnique({
      where: { id },
      include: { patient: true, prescriptions: { include: { items: true } } },
    }),
    db.user.findMany({
      where: { isActive: true, role: { key: "DOCTOR" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!visit) notFound();

  const boundAction = updateVisitAction.bind(null, visit.id);
  const prescriptionItems = visit.prescriptions.flatMap((p) =>
    p.items.map((item) => ({
      medicineName: item.medicineName,
      dosage: item.dosage ?? undefined,
      frequency: item.frequency ?? undefined,
      durationDays: item.durationDays ?? undefined,
      instructions: item.instructions ?? undefined,
    }))
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Edit visit</h1>
        <p className="mt-1 text-sm text-slate-500">{visit.patient.fullName}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <VisitForm
          action={boundAction}
          doctors={doctors}
          submitLabel="Save changes"
          lockPatient
          initialValues={{
            patientId: visit.patient.id,
            patientLabel: `${visit.patient.fullName} (${visit.patient.patientCode})`,
            doctorId: visit.doctorId,
            chiefComplaint: visit.chiefComplaint,
            examination: visit.examination ?? "",
            diagnosis: visit.diagnosis ?? "",
            treatmentNotes: visit.treatmentNotes ?? "",
            clinicalNotes: visit.clinicalNotes ?? "",
            followUpInstructions: visit.followUpInstructions ?? "",
            nextAppointmentDate: visit.nextAppointmentDate ? toNepalDateInputValue(visit.nextAppointmentDate) : "",
          }}
          initialPrescriptionItems={prescriptionItems}
        />
      </div>
    </div>
  );
}
