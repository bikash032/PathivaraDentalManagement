"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { SUPPORTED_TIMEZONES } from "@/lib/validation/settings";
import type { SettingsFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save timezone"}
    </button>
  );
}

export function TimezoneForm({
  action,
  currentTimezone,
}: {
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
  currentTimezone: string;
}) {
  const [state, formAction] = useActionState<SettingsFormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      ) : null}
      {state.success ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="timezone" className="block text-sm font-medium text-slate-700">
          Clinic timezone
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={currentTimezone}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {SUPPORTED_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Controls the clock time shown with appointments and records. Bikram Sambat calendar dates are always
          resolved in Nepal Time, since a BS day is defined in NPT.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
