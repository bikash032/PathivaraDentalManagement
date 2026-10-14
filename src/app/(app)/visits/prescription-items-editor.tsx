"use client";

import { useState } from "react";
import type { PrescriptionItemInput } from "@/lib/validation/visit";

const inputClass =
  "w-full rounded-md border border-field-line px-2 py-1.5 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus";

let nextRowId = 0;

export function PrescriptionItemsEditor({ initialItems = [] }: { initialItems?: PrescriptionItemInput[] }) {
  const [rows, setRows] = useState(() =>
    (initialItems.length > 0 ? initialItems : [{}]).map((item) => ({ id: nextRowId++, ...item }))
  );

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.id} className="grid grid-cols-1 gap-2 rounded-md border border-line p-3 sm:grid-cols-5">
          <input
            name="medicineName[]"
            placeholder="Medicine"
            defaultValue={row.medicineName}
            className={`${inputClass} sm:col-span-2`}
          />
          <input name="dosage[]" placeholder="Dosage" defaultValue={row.dosage} className={inputClass} />
          <input name="frequency[]" placeholder="Frequency" defaultValue={row.frequency} className={inputClass} />
          <div className="flex gap-2">
            <input
              name="durationDays[]"
              type="number"
              min={1}
              placeholder="Days"
              defaultValue={row.durationDays}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((_, i) => i !== index))}
              className="shrink-0 rounded-md border border-field-line px-2 text-xs text-ink-muted hover:bg-page"
            >
              Remove
            </button>
          </div>
          <input
            name="instructions[]"
            placeholder="Instructions (e.g. after meals)"
            defaultValue={row.instructions}
            className={`${inputClass} sm:col-span-5`}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, { id: nextRowId++ }])}
        className="rounded-md border border-field-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
      >
        + Add medicine
      </button>
    </div>
  );
}
