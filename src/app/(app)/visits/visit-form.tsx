"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PatientPicker } from "@/components/patient-picker";
import { PrescriptionItemsEditor } from "./prescription-items-editor";
import type { VisitFormState } from "./actions";
import type { PrescriptionItemInput } from "@/lib/validation/visit";

type Doctor = { id: string; name: string };

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function VisitForm({
  action,
  doctors,
  submitLabel,
  lockPatient,
  initialValues,
  initialPrescriptionItems,
}: {
  action: (state: VisitFormState, formData: FormData) => Promise<VisitFormState>;
  doctors: Doctor[];
  submitLabel: string;
  lockPatient?: boolean;
  initialValues?: {
    patientId?: string;
    patientLabel?: string;
    appointmentId?: string;
    doctorId?: string;
    chiefComplaint?: string;
    examination?: string;
    diagnosis?: string;
    treatmentNotes?: string;
    clinicalNotes?: string;
    followUpInstructions?: string;
    nextAppointmentDate?: string;
  };
  initialPrescriptionItems?: PrescriptionItemInput[];
}) {
  const [state, formAction] = useActionState<VisitFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {initialValues?.appointmentId ? (
        <input type="hidden" name="appointmentId" value={initialValues.appointmentId} />
      ) : null}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Patient</label>
        {lockPatient ? (
          <>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {initialValues?.patientLabel}
            </div>
            <input type="hidden" name="patientId" value={initialValues?.patientId} />
          </>
        ) : (
          <PatientPicker
            name="patientId"
            initialPatientId={initialValues?.patientId}
            initialLabel={initialValues?.patientLabel}
          />
        )}
        {errors.patientId ? <p className="text-xs text-red-600">{errors.patientId}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="doctorId" className="block text-sm font-medium text-slate-700">
            Doctor
          </label>
          <select
            id="doctorId"
            name="doctorId"
            defaultValue={initialValues?.doctorId ?? ""}
            required
            className={inputClass}
          >
            <option value="" disabled>
              Select a doctor
            </option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {errors.doctorId ? <p className="text-xs text-red-600">{errors.doctorId}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="nextAppointmentDate" className="block text-sm font-medium text-slate-700">
            Suggested next appointment (optional)
          </label>
          <input
            id="nextAppointmentDate"
            name="nextAppointmentDate"
            type="date"
            defaultValue={initialValues?.nextAppointmentDate}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="chiefComplaint" className="block text-sm font-medium text-slate-700">
          Chief complaint
        </label>
        <input
          id="chiefComplaint"
          name="chiefComplaint"
          defaultValue={initialValues?.chiefComplaint}
          required
          className={inputClass}
        />
        {errors.chiefComplaint ? <p className="text-xs text-red-600">{errors.chiefComplaint}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="examination" className="block text-sm font-medium text-slate-700">
            Examination
          </label>
          <textarea
            id="examination"
            name="examination"
            defaultValue={initialValues?.examination}
            rows={3}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="diagnosis" className="block text-sm font-medium text-slate-700">
            Diagnosis
          </label>
          <textarea
            id="diagnosis"
            name="diagnosis"
            defaultValue={initialValues?.diagnosis}
            rows={3}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="treatmentNotes" className="block text-sm font-medium text-slate-700">
            Treatment given
          </label>
          <textarea
            id="treatmentNotes"
            name="treatmentNotes"
            defaultValue={initialValues?.treatmentNotes}
            rows={3}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="clinicalNotes" className="block text-sm font-medium text-slate-700">
            Clinical notes
          </label>
          <textarea
            id="clinicalNotes"
            name="clinicalNotes"
            defaultValue={initialValues?.clinicalNotes}
            rows={3}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="followUpInstructions" className="block text-sm font-medium text-slate-700">
          Follow-up instructions
        </label>
        <textarea
          id="followUpInstructions"
          name="followUpInstructions"
          defaultValue={initialValues?.followUpInstructions}
          rows={2}
          className={inputClass}
        />
      </div>

      <div>
        <p className="mb-2 block text-sm font-medium text-slate-700">Prescription</p>
        <PrescriptionItemsEditor initialItems={initialPrescriptionItems} />
      </div>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
