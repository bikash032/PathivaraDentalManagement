"use client";

import { useState } from "react";

type Treatment = { id: string; name: string; code: string; defaultPrice: string };

type Row = {
  id: number;
  treatmentId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  discount: string;
};

let nextRowId = 0;

const inputClass =
  "w-full rounded-md border border-field-line px-2 py-1.5 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus";

function emptyRow(): Row {
  return { id: nextRowId++, treatmentId: "", description: "", quantity: 1, unitPrice: "", discount: "0" };
}

export function InvoiceItemsEditor({ treatments }: { treatments: Treatment[] }) {
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function handleTreatmentChange(id: number, treatmentId: string) {
    const treatment = treatments.find((t) => t.id === treatmentId);
    if (treatment) {
      updateRow(id, { treatmentId, description: treatment.name, unitPrice: treatment.defaultPrice });
    } else {
      updateRow(id, { treatmentId: "" });
    }
  }

  const lineTotals = rows.map((r) => {
    const qty = Number(r.quantity) || 0;
    const price = Number(r.unitPrice) || 0;
    const discount = Number(r.discount) || 0;
    return Math.max(0, qty * price - discount);
  });
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.id} className="grid grid-cols-1 gap-2 rounded-md border border-line p-3 sm:grid-cols-12 sm:items-start">
          <select
            value={row.treatmentId}
            onChange={(e) => handleTreatmentChange(row.id, e.target.value)}
            className={`${inputClass} sm:col-span-3`}
          >
            <option value="">Custom item</option>
            {treatments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input type="hidden" name="treatmentId[]" value={row.treatmentId} />

          <input
            name="description[]"
            placeholder="Description"
            value={row.description}
            onChange={(e) => updateRow(row.id, { description: e.target.value })}
            required
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="quantity[]"
            type="number"
            min={1}
            value={row.quantity}
            onChange={(e) => updateRow(row.id, { quantity: Number(e.target.value) })}
            className={`${inputClass} sm:col-span-1`}
          />
          <input
            name="unitPrice[]"
            type="number"
            min={0}
            step="0.01"
            placeholder="Price"
            value={row.unitPrice}
            onChange={(e) => updateRow(row.id, { unitPrice: e.target.value })}
            required
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            name="discount[]"
            type="number"
            min={0}
            step="0.01"
            placeholder="Discount"
            value={row.discount}
            onChange={(e) => updateRow(row.id, { discount: e.target.value })}
            className={`${inputClass} sm:col-span-2`}
          />
          <div className="flex items-center justify-between sm:col-span-1">
            <span className="text-sm text-ink-muted">{lineTotals[index].toFixed(2)}</span>
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((_, i) => i !== index))}
              className="rounded-md border border-field-line px-2 py-1 text-xs text-ink-muted hover:bg-page"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setRows((r) => [...r, emptyRow()])}
        className="rounded-md border border-field-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
      >
        + Add item
      </button>

      <div className="text-right text-sm text-ink-secondary">
        Subtotal: <span className="font-medium">रु. {subtotal.toFixed(2)}</span>
      </div>
    </div>
  );
}
