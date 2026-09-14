import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatDateNepal } from "@/lib/date";
import { PrintButton } from "@/components/print-button";

export default async function PrintPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("patient.view");
  const { id } = await params;

  const [patient, clinic] = await Promise.all([
    db.patient.findUnique({ where: { id } }),
    db.clinicProfile.findFirst(),
  ]);
  if (!patient) notFound();

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold">{clinic?.clinicName ?? "Pathivara Dental Clinic"}</h1>
          {clinic?.address ? <p className="text-sm text-slate-600">{clinic.address}</p> : null}
          <p className="text-sm text-slate-600">Patient registration record</p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 gap-4 border-y border-slate-200 py-4 text-sm">
        <Field label="Patient ID" value={patient.patientCode} />
        <Field label="Registered" value={formatDateNepal(patient.createdAt)} />
        <Field label="Full name" value={patient.fullName} />
        <Field label="Gender" value={patient.gender} />
        <Field label="Phone" value={patient.phone} />
        <Field label="Alternate phone" value={patient.alternatePhone} />
        <Field
          label="Date of birth"
          value={patient.dateOfBirth ? formatDateNepal(patient.dateOfBirth) : patient.approxAge ? `~${patient.approxAge} years` : null}
        />
        <Field label="Address" value={patient.address} />
        <Field label="Emergency contact" value={patient.emergencyContactName} />
        <Field label="Emergency phone" value={patient.emergencyContactPhone} />
      </div>

      {patient.allergies ? (
        <div className="mt-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Allergies</p>
          <p>{patient.allergies}</p>
        </div>
      ) : null}

      {patient.medicalNotes ? (
        <div className="mt-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Medical notes</p>
          <p className="whitespace-pre-wrap">{patient.medicalNotes}</p>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p>{value || "—"}</p>
    </div>
  );
}
