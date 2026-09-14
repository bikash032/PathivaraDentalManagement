"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { SettingsFormState } from "./actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      ) : null}
      {state.success ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="clinicName" className="block text-sm font-medium text-slate-700">
          Clinic name
        </label>
        <input id="clinicName" name="clinicName" defaultValue={initialValues.clinicName} required className={inputClass} />
        {errors.clinicName ? <p className="text-xs text-red-600">{errors.clinicName}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="address" className="block text-sm font-medium text-slate-700">
          Address
        </label>
        <input id="address" name="address" defaultValue={initialValues.address} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
            Phone
          </label>
          <input id="phone" name="phone" defaultValue={initialValues.phone} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input id="email" name="email" type="email" defaultValue={initialValues.email} className={inputClass} />
          {errors.email ? <p className="text-xs text-red-600">{errors.email}</p> : null}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="panNumber" className="block text-sm font-medium text-slate-700">
          PAN number (optional)
        </label>
        <input id="panNumber" name="panNumber" defaultValue={initialValues.panNumber} className={inputClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="receiptFooterNote" className="block text-sm font-medium text-slate-700">
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
