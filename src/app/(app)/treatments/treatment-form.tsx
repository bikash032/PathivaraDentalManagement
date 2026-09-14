"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { TreatmentFormState } from "./actions";

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

export function TreatmentForm({
  action,
  submitLabel,
  initialValues,
}: {
  action: (state: TreatmentFormState, formData: FormData) => Promise<TreatmentFormState>;
  submitLabel: string;
  initialValues?: {
    name?: string;
    code?: string;
    description?: string;
    defaultPrice?: string;
    isActive?: boolean;
  };
}) {
  const [state, formAction] = useActionState<TreatmentFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Name
        </label>
        <input id="name" name="name" defaultValue={initialValues?.name} required className={inputClass} />
        {errors.name ? <p className="text-xs text-red-600">{errors.name}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="code" className="block text-sm font-medium text-slate-700">
          Code
        </label>
        <input id="code" name="code" defaultValue={initialValues?.code} required className={inputClass} />
        {errors.code ? <p className="text-xs text-red-600">{errors.code}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea id="description" name="description" defaultValue={initialValues?.description} rows={2} className={inputClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="defaultPrice" className="block text-sm font-medium text-slate-700">
          Default price (NPR)
        </label>
        <input
          id="defaultPrice"
          name="defaultPrice"
          type="number"
          min={0}
          step="0.01"
          defaultValue={initialValues?.defaultPrice}
          required
          className={inputClass}
        />
        {errors.defaultPrice ? <p className="text-xs text-red-600">{errors.defaultPrice}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isActive"
          name="isActive"
          type="checkbox"
          defaultChecked={initialValues?.isActive ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        <label htmlFor="isActive" className="text-sm text-slate-700">
          Active (available for billing)
        </label>
      </div>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
