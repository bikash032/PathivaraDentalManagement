"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { SettingsFormState } from "./actions";

const inputClass =
  "w-full rounded-md border border-field-line px-3 py-2 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function ClinicProfileForm({
  action,
  initialValues,
}: {
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
  initialValues: {
    clinicName: string;
    address: string;
    phone: string;
    email: string;
    panNumber: string;
    receiptFooterNote: string;
  };
}) {
  const [state, formAction] = useActionState<SettingsFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {state.error ? (
        <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink">{state.error}</div>
      ) : null}
      {state.success ? (
        <div className="rounded-md border border-success-line bg-success-soft px-3 py-2 text-sm text-success-ink">
          {state.success}
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="clinicName" className="block text-sm font-medium text-ink-secondary">
          Clinic name
        </label>
        <input id="clinicName" name="clinicName" defaultValue={initialValues.clinicName} required className={inputClass} />
        {errors.clinicName ? <p className="text-xs text-danger">{errors.clinicName}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="address" className="block text-sm font-medium text-ink-secondary">
          Address
        </label>
        <input id="address" name="address" defaultValue={initialValues.address} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="phone" className="block text-sm font-medium text-ink-secondary">
            Phone
          </label>
          <input id="phone" name="phone" defaultValue={initialValues.phone} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-ink-secondary">
            Email
          </label>
          <input id="email" name="email" type="email" defaultValue={initialValues.email} className={inputClass} />
          {errors.email ? <p className="text-xs text-danger">{errors.email}</p> : null}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="panNumber" className="block text-sm font-medium text-ink-secondary">
          PAN number (optional)
        </label>
        <input id="panNumber" name="panNumber" defaultValue={initialValues.panNumber} className={inputClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="receiptFooterNote" className="block text-sm font-medium text-ink-secondary">
          Receipt footer note (optional)
        </label>
        <textarea
          id="receiptFooterNote"
          name="receiptFooterNote"
          defaultValue={initialValues.receiptFooterNote}
          rows={2}
          className={inputClass}
        />
      </div>

      <SubmitButton />
    </form>
  );
}
