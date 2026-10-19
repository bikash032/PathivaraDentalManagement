"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BSDatePicker } from "@/components/bs-date-picker";
import { PatientPicker } from "@/components/patient-picker";
import type { BillingFormState } from "./actions";

type Action = (state: BillingFormState, formData: FormData) => Promise<BillingFormState>;
type Option = { id: string; name: string };

const inputClass =
  "w-full rounded-md border border-field-line px-3 py-2 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus";
const labelClass = "block text-sm font-medium text-ink-secondary";

function Submit({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Messages({ state }: { state: BillingFormState }) {
  if (state.error) {
    return (
      <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink">
        {state.error}
      </div>
    );
  }
  if (state.success) {
    return (
      <div className="rounded-md border border-success-line bg-success-soft px-3 py-2 text-sm text-success-ink">
        {state.success}
      </div>
    );
  }
  return null;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-danger">{message}</p> : null;
}

function MethodSelect({ id, methods, error }: { id: string; methods: Option[]; error?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        Method
      </label>
      <select id={id} name="paymentMethodId" required defaultValue="" className={inputClass}>
        <option value="" disabled>
          Select a method
        </option>
        {methods.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

/** Cash received before billing. */
export function AdvanceForm({
  action,
  paymentMethods,
  todayValue,
  initialPatientId,
  initialPatientLabel,
}: {
  action: Action;
  paymentMethods: Option[];
  todayValue: string;
  initialPatientId?: string;
  initialPatientLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <Messages state={state} />
      <div className="space-y-1">
        <span className={labelClass}>Patient</span>
        <PatientPicker name="patientId" initialPatientId={initialPatientId} initialLabel={initialPatientLabel} />
        <FieldError message={errors.patientId} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="advance-amount" className={labelClass}>
            Advance amount (NPR)
          </label>
          <input id="advance-amount" name="amount" type="number" min={0.01} step="0.01" required className={inputClass} />
          <FieldError message={errors.amount} />
        </div>
        <div className="space-y-1">
          <label htmlFor="advance-date" className={labelClass}>
            Date (वि.सं.)
          </label>
          <BSDatePicker id="advance-date" name="paymentDate" defaultValue={todayValue} required />
        </div>
      </div>
      <MethodSelect id="advance-method" methods={paymentMethods} error={errors.paymentMethodId} />
      <div className="space-y-1">
        <label htmlFor="advance-reference" className={labelClass}>
          Reference (optional)
        </label>
        <input id="advance-reference" name="reference" className={inputClass} />
      </div>
      <div className="space-y-1">
        <label htmlFor="advance-notes" className={labelClass}>
          Notes (optional)
        </label>
        <textarea id="advance-notes" name="notes" rows={2} className={inputClass} />
      </div>
      <Submit label="Record advance" pending="Recording…" />
    </form>
  );
}

/** Applies existing credit to an invoice: no new cash. */
export function ApplyCreditForm({ action, defaultAmount }: { action: Action; defaultAmount: string }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <Messages state={state} />
      <div className="space-y-1">
        <label htmlFor="credit-amount" className={labelClass}>
          Amount to apply (NPR)
        </label>
        <input
          id="credit-amount"
          name="amount"
          type="number"
          min={0.01}
          step="0.01"
          defaultValue={defaultAmount}
          required
          className={inputClass}
        />
        <FieldError message={state.fieldErrors?.amount} />
      </div>
      <Submit label="Apply credit" pending="Applying…" />
    </form>
  );
}

/** Returns unapplied money from one receipt. */
export function RefundForm({
  action,
  receipts,
  paymentMethods,
  todayValue,
}: {
  action: Action;
  receipts: { id: string; label: string }[];
  paymentMethods: Option[];
  todayValue: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <Messages state={state} />
      <div className="space-y-1">
        <label htmlFor="refund-receipt" className={labelClass}>
          Refund from receipt
        </label>
        <select id="refund-receipt" name="paymentId" required defaultValue={receipts[0]?.id ?? ""} className={inputClass}>
          {receipts.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <FieldError message={errors.paymentId} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="refund-amount" className={labelClass}>
            Refund amount (NPR)
          </label>
          <input id="refund-amount" name="amount" type="number" min={0.01} step="0.01" required className={inputClass} />
          <FieldError message={errors.amount} />
        </div>
        <div className="space-y-1">
          <label htmlFor="refund-date" className={labelClass}>
            Date (वि.सं.)
          </label>
          <BSDatePicker id="refund-date" name="paymentDate" defaultValue={todayValue} required />
        </div>
      </div>
      <MethodSelect id="refund-method" methods={paymentMethods} error={errors.paymentMethodId} />
      <div className="space-y-1">
        <label htmlFor="refund-reason" className={labelClass}>
          Reason
        </label>
        <input id="refund-reason" name="reason" required className={inputClass} />
        <FieldError message={errors.reason} />
      </div>
      <Submit label="Record refund" pending="Recording…" />
    </form>
  );
}

const STATUS_OPTIONS = [
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Treating doctor, appointment and clinical status of one invoice item. */
export function ItemTreatmentForm({
  action,
  itemId,
  doctors,
  appointments,
  initial,
  todayValue,
}: {
  action: Action;
  itemId: string;
  doctors: Option[];
  appointments: { id: string; label: string }[];
  initial: { doctorId: string; appointmentId: string; treatmentStatus: string; completedDate: string; tooth: string };
  todayValue: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Messages state={state} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`doctor-${itemId}`} className="block text-xs font-medium text-ink-secondary">
          Treating doctor
        </label>
        <select id={`doctor-${itemId}`} name="doctorId" defaultValue={initial.doctorId} className={inputClass}>
          <option value="">Not set</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`appointment-${itemId}`} className="block text-xs font-medium text-ink-secondary">
          Appointment
        </label>
        <select id={`appointment-${itemId}`} name="appointmentId" defaultValue={initial.appointmentId} className={inputClass}>
          <option value="">Not linked</option>
          {appointments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`status-${itemId}`} className="block text-xs font-medium text-ink-secondary">
          Treatment status
        </label>
        <select id={`status-${itemId}`} name="treatmentStatus" defaultValue={initial.treatmentStatus} className={inputClass}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`completed-${itemId}`} className="block text-xs font-medium text-ink-secondary">
          Completed on (वि.सं., if completed)
        </label>
        <BSDatePicker
          id={`completed-${itemId}`}
          name="completedDate"
          defaultValue={initial.completedDate || todayValue}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`tooth-${itemId}`} className="block text-xs font-medium text-ink-secondary">
          Tooth
        </label>
        <input
          id={`tooth-${itemId}`}
          name="tooth"
          defaultValue={initial.tooth}
          maxLength={40}
          placeholder="e.g. 36 or 11, 21"
          className={inputClass}
        />
        <FieldError message={state.fieldErrors?.tooth} />
      </div>
      <div className="sm:col-span-2">
        <Submit label="Save treatment" pending="Saving…" />
      </div>
    </form>
  );
}
