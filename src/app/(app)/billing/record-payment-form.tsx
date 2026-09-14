"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BSDatePicker } from "@/components/bs-date-picker";
import type { PaymentFormState } from "./actions";

type PaymentMethod = { id: string; name: string };

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
      {pending ? "Recording…" : "Record payment"}
    </button>
  );
}

export function RecordPaymentForm({
  action,
  paymentMethods,
  todayValue,
}: {
  action: (state: PaymentFormState, formData: FormData) => Promise<PaymentFormState>;
  paymentMethods: PaymentMethod[];
  todayValue: string;
}) {
  const [state, formAction] = useActionState<PaymentFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
            Amount (NPR)
          </label>
          <input id="amount" name="amount" type="number" min={0.01} step="0.01" required className={inputClass} />
          {errors.amount ? <p className="text-xs text-red-600">{errors.amount}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="paymentDate" className="block text-sm font-medium text-slate-700">
            Date (वि.सं.)
          </label>
          <BSDatePicker id="paymentDate" name="paymentDate" defaultValue={todayValue} required />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="paymentMethodId" className="block text-sm font-medium text-slate-700">
          Method
        </label>
        <select id="paymentMethodId" name="paymentMethodId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select a method
          </option>
          {paymentMethods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {errors.paymentMethodId ? <p className="text-xs text-red-600">{errors.paymentMethodId}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="reference" className="block text-sm font-medium text-slate-700">
          Reference (optional)
        </label>
        <input id="reference" name="reference" className={inputClass} />
      </div>

      <SubmitButton />
    </form>
  );
}
