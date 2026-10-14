import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { PatientForm } from "../../patient-form";
import { updatePatientAction } from "../../actions";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("patient.update");
  const { id } = await params;

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  const boundAction = updatePatientAction.bind(null, patient.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Edit patient</h1>
        <p className="mt-1 text-sm text-ink-muted">{patient.patientCode}</p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-6">
        <PatientForm
          action={boundAction}
          submitLabel="Save changes"
          patientId={patient.id}
          initialValues={{
            fullName: patient.fullName,
            phone: patient.phone,
            alternatePhone: patient.alternatePhone ?? "",
            address: patient.address ?? "",
            dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : "",
            approxAge: patient.approxAge ? String(patient.approxAge) : "",
            gender: patient.gender,
            emergencyContactName: patient.emergencyContactName ?? "",
            emergencyContactPhone: patient.emergencyContactPhone ?? "",
            medicalNotes: patient.medicalNotes ?? "",
            allergies: patient.allergies ?? "",
            notes: patient.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
