"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { PatientFormState } from "./actions";

type PatientFormValues = {
  fullName: string;
  phone: string;
  alternatePhone: string;
  address: string;
  dateOfBirth: string;
  approxAge: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes: string;
  allergies: string;
  notes: string;
};

const EMPTY_VALUES: PatientFormValues = {
  fullName: "",
  phone: "",
  alternatePhone: "",
  address: "",
  dateOfBirth: "",
  approxAge: "",
  gender: "MALE",
  emergencyContactName: "",
  emergencyContactPhone: "",
  medicalNotes: "",
  allergies: "",
  notes: "",
};

function Field({
  label,
  name,
  children,
  error,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

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

export function PatientForm({
  action,
  initialValues,
  submitLabel,
}: {
  action: (state: PatientFormState, formData: FormData) => Promise<PatientFormState>;
  initialValues?: Partial<PatientFormValues>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<PatientFormState, FormData>(action, {});
  const values = { ...EMPTY_VALUES, ...initialValues };
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" name="fullName" error={errors.fullName}>
          <input
            id="fullName"
            name="fullName"
            defaultValue={values.fullName}
            required
            className={inputClass}
          />
        </Field>

        <Field label="Gender" name="gender" error={errors.gender}>
          <select id="gender" name="gender" defaultValue={values.gender} className={inputClass}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>

        <Field label="Phone" name="phone" error={errors.phone}>
          <input
            id="phone"
            name="phone"
            defaultValue={values.phone}
            placeholder="98XXXXXXXX"
            required
            className={inputClass}
          />
        </Field>

        <Field label="Alternate phone (optional)" name="alternatePhone" error={errors.alternatePhone}>
          <input
            id="alternatePhone"
            name="alternatePhone"
            defaultValue={values.alternatePhone}
            placeholder="98XXXXXXXX"
            className={inputClass}
          />
        </Field>

        <Field label="Date of birth (if known)" name="dateOfBirth" error={errors.dateOfBirth}>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={values.dateOfBirth}
            className={inputClass}
          />
        </Field>

        <Field label="Approx. age (if DOB unknown)" name="approxAge" error={errors.approxAge}>
          <input
            id="approxAge"
            name="approxAge"
            type="number"
            min={0}
            max={150}
            defaultValue={values.approxAge}
            className={inputClass}
          />
        </Field>

        <Field label="Emergency contact name" name="emergencyContactName" error={errors.emergencyContactName}>
          <input
            id="emergencyContactName"
            name="emergencyContactName"
            defaultValue={values.emergencyContactName}
            className={inputClass}
          />
        </Field>

        <Field label="Emergency contact phone" name="emergencyContactPhone" error={errors.emergencyContactPhone}>
          <input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            defaultValue={values.emergencyContactPhone}
            placeholder="98XXXXXXXX"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Address" name="address" error={errors.address}>
        <input id="address" name="address" defaultValue={values.address} className={inputClass} />
      </Field>

      <Field label="Allergies" name="allergies" error={errors.allergies}>
        <textarea id="allergies" name="allergies" defaultValue={values.allergies} rows={2} className={inputClass} />
      </Field>

      <Field label="Important medical notes" name="medicalNotes" error={errors.medicalNotes}>
        <textarea
          id="medicalNotes"
          name="medicalNotes"
          defaultValue={values.medicalNotes}
          rows={3}
          className={inputClass}
        />
      </Field>

      <Field label="Other notes" name="notes" error={errors.notes}>
        <textarea id="notes" name="notes" defaultValue={values.notes} rows={2} className={inputClass} />
      </Field>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
