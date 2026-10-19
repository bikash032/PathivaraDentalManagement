import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatBSDate } from "@/lib/date";
import { formatBSDateLong, formatNepalTime } from "@/lib/bs-date";
import { getClinicProfile, getClinicTimezone } from "@/lib/clinic-settings";
import {
  ClinicPrintFooter,
  ClinicPrintHeader,
  PrintDocument,
  PrintToolbar,
  isThermal,
  parsePaper,
} from "@/components/print-document";

const GENDER_LABELS: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

export default async function PrintPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paper?: string | string[] }>;
}) {
  await requirePermission("patient.view");
  const { id } = await params;
  const paper = parsePaper((await searchParams).paper);

  const [patient, clinic, timezone] = await Promise.all([
    db.patient.findUnique({ where: { id } }),
    getClinicProfile(),
    getClinicTimezone(),
  ]);
  if (!patient) notFound();

  const thermal = isThermal(paper);
  const dateOfBirth = patient.dateOfBirth
    ? formatBSDate(patient.dateOfBirth)
    : patient.approxAge
      ? `~${patient.approxAge} years`
      : null;

  return (
    <>
      <PrintToolbar paper={paper} basePath={`/print/patients/${patient.id}`} />
      <PrintDocument paper={paper} emphasis>
        <ClinicPrintHeader clinic={clinic} title="Patient Registration Record" />

        <section
          className={`keep-together mb-4 flex rounded-md border-2 border-primary bg-primary-soft px-3 py-2 ${
            thermal ? "flex-col gap-1" : "items-center justify-between gap-4"
          }`}
        >
          <div>
            <p className="text-[length:var(--doc-label)] font-semibold uppercase tracking-wide text-ink-secondary">
              Patient ID
            </p>
            <p className="font-mono text-[length:var(--doc-name)] font-bold leading-tight text-ink">
              {patient.patientCode}
            </p>
          </div>
          <div className={thermal ? "" : "text-right"}>
            <p className="text-[length:var(--doc-label)] font-semibold uppercase tracking-wide text-ink-secondary">
              Registration date &amp; time
            </p>
            {/* e.g. १ कात्तिक २०८३, शनिबार — १०:३० AM */}
            <p className="font-medium text-ink">{formatBSDateLong(patient.createdAt)}</p>
            <p className="font-medium text-ink">{formatNepalTime(patient.createdAt, timezone)}</p>
          </div>
        </section>

        <dl className={`grid border-t border-line ${thermal ? "grid-cols-1" : "grid-cols-2 gap-x-6"}`}>
          <Field label="Full name" value={patient.fullName} wide />
          <Field label="Gender" value={GENDER_LABELS[patient.gender] ?? patient.gender} />
          <Field label="Date of birth / Age" value={dateOfBirth} />
          <Field label="Phone number" value={patient.phone} />
          <Field label="Alternate phone" value={patient.alternatePhone} />
          <Field label="Address" value={patient.address} wide />
          <Field label="Emergency contact" value={patient.emergencyContactName} />
          <Field label="Emergency phone" value={patient.emergencyContactPhone} />
          <Field label="Allergies" value={patient.allergies} wide multiline />
          <Field label="Medical notes" value={patient.medicalNotes} wide multiline />
        </dl>

        {/* Blank ruled space for the complaint / history of illness, written by hand. */}
        <section className="keep-together mt-4">
          <p className="text-[length:var(--doc-label)] font-semibold uppercase tracking-wide text-ink-secondary">
            Complaint / History of Illness
          </p>
          {Array.from({ length: thermal ? 4 : 6 }, (_, i) => (
            <div key={i} className="h-[8mm] border-b border-ink-muted" />
          ))}
        </section>

        <ClinicPrintFooter />
      </PrintDocument>
    </>
  );
}

function Field({
  label,
  value,
  wide = false,
  multiline = false,
}: {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={`keep-together min-w-0 border-b border-line py-1.5 ${wide ? "col-span-full" : ""}`}>
      <dt className="text-[length:var(--doc-label)] font-semibold uppercase tracking-wide text-ink-secondary">
        {label}
      </dt>
      <dd className={`text-ink ${multiline ? "whitespace-pre-wrap" : ""}`}>{value?.trim() || "—"}</dd>
    </div>
  );
}
