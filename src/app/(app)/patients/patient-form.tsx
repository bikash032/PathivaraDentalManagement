"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { BSDatePicker } from "@/components/bs-date-picker";
import {
  nepaliPhoneRegex,
  normalizeNepaliPhone,
  phoneTakenMessage,
} from "@/lib/validation/patient";
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
      <label htmlFor={name} className="block text-sm font-medium text-ink-secondary">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-field-line px-3 py-2 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus";

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function PatientForm({
  action,
  initialValues,
  submitLabel,
  patientId,
}: {
  action: (state: PatientFormState, formData: FormData) => Promise<PatientFormState>;
  initialValues?: Partial<PatientFormValues>;
  submitLabel: string;
  /** Set when editing, so the patient's own number is not read as a duplicate. */
  patientId?: string;
}) {
  const [state, formAction] = useActionState<PatientFormState, FormData>(action, {});
  const values = { ...EMPTY_VALUES, ...initialValues };
  const errors = state.fieldErrors ?? {};

  const [phone, setPhone] = useState(values.phone);
  // The answer is stored against the number it was asked about, so it simply
  // stops applying as soon as the field changes — no clearing required.
  const [checked, setChecked] = useState<{ phone: string; takenBy: string | null }>({
    phone: "",
    takenBy: null,
  });

  const normalizedPhone = normalizeNepaliPhone(phone.trim());
  const phoneComplete = nepaliPhoneRegex.test(normalizedPhone);
  const takenBy = checked.phone === normalizedPhone ? checked.takenBy : null;

  useEffect(() => {
    if (!phoneComplete) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const query = new URLSearchParams({ phone: normalizedPhone });
      if (patientId) query.set("excludeId", patientId);

      fetch(`/api/patients/phone-available?${query.toString()}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { taken: false }))
        .then((data: { taken: boolean; fullName?: string }) =>
          setChecked({
            phone: normalizedPhone,
            takenBy: data.taken ? (data.fullName ?? "another patient") : null,
          })
        )
        .catch(() => {
          // superseded by a newer keystroke, or offline — the server action
          // still rejects duplicates on submit
        });
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedPhone, phoneComplete, patientId]);

  // A duplicate found live, or one reported by the server action on submit.
  const phoneError = errors.phone ?? (takenBy ? phoneTakenMessage(takenBy) : undefined);

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink">
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

        <Field label="Phone" name="phone" error={phoneError}>
          <input
            id="phone"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            required
            aria-invalid={phoneError ? true : undefined}
            className={`${inputClass} ${phoneError ? "border-danger focus:border-danger focus:ring-danger" : ""}`}
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

        <Field label="Date of birth (वि.सं., if known)" name="dateOfBirth" error={errors.dateOfBirth}>
          <BSDatePicker id="dateOfBirth" name="dateOfBirth" defaultValue={values.dateOfBirth} />
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

      <SubmitButton label={submitLabel} disabled={takenBy !== null} />
    </form>
  );
}
