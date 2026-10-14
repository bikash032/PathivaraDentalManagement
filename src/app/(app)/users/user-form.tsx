"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { UserFormState } from "./actions";

type Role = { id: string; name: string };

const inputClass =
  "w-full rounded-md border border-field-line px-3 py-2 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function NewUserForm({ action, roles }: { action: (state: UserFormState, formData: FormData) => Promise<UserFormState>; roles: Role[] }) {
  const [state, formAction] = useActionState<UserFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink">{state.error}</div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium text-ink-secondary">Name</label>
        <input id="name" name="name" required className={inputClass} />
        {errors.name ? <p className="text-xs text-danger">{errors.name}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-ink-secondary">Email</label>
        <input id="email" name="email" type="email" required className={inputClass} />
        {errors.email ? <p className="text-xs text-danger">{errors.email}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="phone" className="block text-sm font-medium text-ink-secondary">Phone (optional)</label>
        <input id="phone" name="phone" placeholder="98XXXXXXXX" className={inputClass} />
        {errors.phone ? <p className="text-xs text-danger">{errors.phone}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="roleId" className="block text-sm font-medium text-ink-secondary">Role</label>
        <select id="roleId" name="roleId" required defaultValue="" className={inputClass}>
          <option value="" disabled>Select a role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        {errors.roleId ? <p className="text-xs text-danger">{errors.roleId}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-ink-secondary">Temporary password</label>
        <input id="password" name="password" type="password" required minLength={8} className={inputClass} />
        {errors.password ? <p className="text-xs text-danger">{errors.password}</p> : null}
      </div>

      <SubmitButton label="Create user" />
    </form>
  );
}

export function EditUserForm({
  action,
  roles,
  initialValues,
}: {
  action: (state: UserFormState, formData: FormData) => Promise<UserFormState>;
  roles: Role[];
  initialValues: { name: string; phone: string; roleId: string; isActive: boolean };
}) {
  const [state, formAction] = useActionState<UserFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink">{state.error}</div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium text-ink-secondary">Name</label>
        <input id="name" name="name" defaultValue={initialValues.name} required className={inputClass} />
        {errors.name ? <p className="text-xs text-danger">{errors.name}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="phone" className="block text-sm font-medium text-ink-secondary">Phone (optional)</label>
        <input id="phone" name="phone" defaultValue={initialValues.phone} placeholder="98XXXXXXXX" className={inputClass} />
        {errors.phone ? <p className="text-xs text-danger">{errors.phone}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="roleId" className="block text-sm font-medium text-ink-secondary">Role</label>
        <select id="roleId" name="roleId" defaultValue={initialValues.roleId} required className={inputClass}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        {errors.roleId ? <p className="text-xs text-danger">{errors.roleId}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        <input id="isActive" name="isActive" type="checkbox" defaultChecked={initialValues.isActive} className="h-4 w-4 rounded border-field-line" />
        <label htmlFor="isActive" className="text-sm text-ink-secondary">Account active</label>
      </div>

      <SubmitButton label="Save changes" />
    </form>
  );
}

export function ResetPasswordForm({ action }: { action: (state: UserFormState, formData: FormData) => Promise<UserFormState> }) {
  const [state, formAction] = useActionState<UserFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-3 max-w-sm">
      {state.error ? (
        <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink">{state.error}</div>
      ) : null}
      {state.success ? (
        <div className="rounded-md border border-success-line bg-success-soft px-3 py-2 text-sm text-success-ink">{state.success}</div>
      ) : null}
      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-ink-secondary">New password</label>
        <input id="password" name="password" type="password" required minLength={8} className={inputClass} />
      </div>
      <SubmitButton label="Reset password" />
    </form>
  );
}
