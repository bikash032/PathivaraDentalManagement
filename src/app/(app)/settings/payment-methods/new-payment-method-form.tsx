"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { SettingsFormState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}

export function NewPaymentMethodForm({
  action,
}: {
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
}) {
  const [state, formAction] = useActionState<SettingsFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex items-start gap-2">
      <div className="flex-1">
        <input
          name="name"
          placeholder="e.g. eSewa"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      </div>
      <SubmitButton />
    </form>
  );
}
