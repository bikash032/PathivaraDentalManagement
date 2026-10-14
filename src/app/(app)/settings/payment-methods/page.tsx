import { db } from "@/lib/db";
import { createPaymentMethodAction, togglePaymentMethodAction } from "../actions";
import { NewPaymentMethodForm } from "./new-payment-method-form";

export default async function PaymentMethodsSettingsPage() {
  const methods = await db.paymentMethod.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Payment methods</h2>
        <ul className="divide-y divide-line-soft">
          {methods.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">{m.name}</span>
              <form action={togglePaymentMethodAction.bind(null, m.id, !m.isActive)}>
                <button
                  type="submit"
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.isActive ? "bg-success-soft text-success-ink" : "bg-line-soft text-ink-muted"
                  }`}
                >
                  {m.isActive ? "Active" : "Inactive"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Add payment method</h2>
        <NewPaymentMethodForm action={createPaymentMethodAction} />
      </div>
    </div>
  );
}
