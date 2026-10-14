"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PatientPicker } from "@/components/patient-picker";
import { InvoiceItemsEditor } from "./invoice-items-editor";
import type { InvoiceFormState } from "./actions";

type Treatment = { id: string; name: string; code: string; defaultPrice: string };

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
      {pending ? "Saving…" : "Create invoice"}
    </button>
  );
}

export function InvoiceForm({
  action,
  treatments,
  initialPatientId,
  initialPatientLabel,
}: {
  action: (state: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;
  treatments: Treatment[];
  initialPatientId?: string;
  initialPatientLabel?: string;
}) {
  const [state, formAction] = useActionState<InvoiceFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {state.error}
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-ink-secondary">Patient</label>
        <PatientPicker name="patientId" initialPatientId={initialPatientId} initialLabel={initialPatientLabel} />
        {errors.patientId ? <p className="text-xs text-danger">{errors.patientId}</p> : null}
      </div>

      <div>
        <p className="mb-2 block text-sm font-medium text-ink-secondary">Items</p>
        <InvoiceItemsEditor treatments={treatments} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="discountAmount" className="block text-sm font-medium text-ink-secondary">
            Overall discount (NPR)
          </label>
          <input
            id="discountAmount"
            name="discountAmount"
            type="number"
            min={0}
            step="0.01"
            defaultValue="0"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="notes" className="block text-sm font-medium text-ink-secondary">
          Notes
        </label>
        <textarea id="notes" name="notes" rows={2} className={inputClass} />
      </div>

      <SubmitButton />
    </form>
  );
}
