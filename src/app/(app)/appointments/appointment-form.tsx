"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PatientPicker } from "@/components/patient-picker";
import { APPOINTMENT_DURATIONS } from "@/lib/validation/appointment";
import type { AppointmentFormState } from "./actions";

type Doctor = { id: string; name: string };

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

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

export function AppointmentForm({
  action,
  doctors,
  submitLabel,
  initialValues,
}: {
  action: (state: AppointmentFormState, formData: FormData) => Promise<AppointmentFormState>;
  doctors: Doctor[];
  submitLabel: string;
  initialValues?: {
    patientId?: string;
    patientLabel?: string;
    doctorId?: string;
    date?: string;
    time?: string;
    durationMinutes?: number;
    reason?: string;
    notes?: string;
  };
}) {
  const [state, formAction] = useActionState<AppointmentFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Patient</label>
        <PatientPicker
          name="patientId"
          initialPatientId={initialValues?.patientId}
          initialLabel={initialValues?.patientLabel}
        />
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
          <label htmlFor="durationMinutes" className="block text-sm font-medium text-slate-700">
            Duration
          </label>
          <select
            id="durationMinutes"
            name="durationMinutes"
            defaultValue={String(initialValues?.durationMinutes ?? 30)}
            className={inputClass}
          >
            {APPOINTMENT_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="date" className="block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={initialValues?.date}
            required
            className={inputClass}
          />
          {errors.date ? <p className="text-xs text-red-600">{errors.date}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="time" className="block text-sm font-medium text-slate-700">
            Time
          </label>
          <input
            id="time"
            name="time"
            type="time"
            defaultValue={initialValues?.time}
            required
            className={inputClass}
          />
          {errors.time ? <p className="text-xs text-red-600">{errors.time}</p> : null}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
          Reason / complaint
        </label>
        <input id="reason" name="reason" defaultValue={initialValues?.reason} className={inputClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea id="notes" name="notes" defaultValue={initialValues?.notes} rows={3} className={inputClass} />
      </div>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
