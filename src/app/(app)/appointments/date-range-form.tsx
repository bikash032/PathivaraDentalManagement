"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BSDatePicker } from "@/components/bs-date-picker";
import { QUICK_RANGES, bsQuickRange, type QuickRangeKey } from "@/lib/date";
import { adInputToBS } from "@/lib/bs-date";

/**
 * Inclusive From → To filter for the appointment list.
 *
 * Both pickers speak Bikram Sambat and emit AD "YYYY-MM-DD", which is what the
 * page reads back out of the query string. Navigation goes through the router
 * so the list re-renders in place instead of reloading the page.
 */
export function DateRangeForm({
  from,
  to,
  today,
  doctorId,
  status,
}: {
  /** AD "YYYY-MM-DD" */
  from: string;
  /** AD "YYYY-MM-DD" */
  to: string;
  /** Today in Nepal Time, resolved on the server so the first client render matches. */
  today: string;
  doctorId?: string;
  status?: string;
}) {
  const router = useRouter();
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);
  // Bumped to remount the pickers whenever we set their value on the user's
  // behalf (Clear, quick range) — BSDatePicker seeds its display only once.
  const [pickerKey, setPickerKey] = useState(0);

  const todayBS = useMemo(() => adInputToBS(today), [today]);
  const invalid = fromValue > toValue;

  function urlFor(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams();
    next.set("from", nextFrom);
    next.set("to", nextTo);
    if (doctorId) next.set("doctorId", doctorId);
    if (status) next.set("status", status);
    return `/appointments?${next.toString()}`;
  }

  function applyRange(nextFrom: string, nextTo: string) {
    setFromValue(nextFrom);
    setToValue(nextTo);
    setPickerKey((k) => k + 1);
    router.push(urlFor(nextFrom, nextTo));
  }

  function clear() {
    setFromValue(today);
    setToValue(today);
    setPickerKey((k) => k + 1);
    // No from/to at all — the page falls back to its default single-day view.
    const next = new URLSearchParams();
    if (doctorId) next.set("doctorId", doctorId);
    if (status) next.set("status", status);
    const query = next.toString();
    router.push(query ? `/appointments?${query}` : "/appointments");
  }

  const activeQuickRange = QUICK_RANGES.find((range) => {
    const preset = bsQuickRange(range.key, todayBS);
    return preset.from === fromValue && preset.to === toValue;
  })?.key;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) router.push(urlFor(fromValue, toValue));
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44 space-y-1">
          <label htmlFor="from" className="block text-xs font-medium text-ink-muted">
            From (वि.सं.)
          </label>
          <BSDatePicker
            key={`from-${pickerKey}`}
            id="from"
            name="from"
            defaultValue={fromValue}
            onChangeValue={setFromValue}
          />
        </div>
        <div className="w-44 space-y-1">
          <label htmlFor="to" className="block text-xs font-medium text-ink-muted">
            To (वि.सं.)
          </label>
          <BSDatePicker
            key={`to-${pickerKey}`}
            id="to"
            name="to"
            defaultValue={toValue}
            onChangeValue={setToValue}
          />
        </div>
        <button
          type="submit"
          disabled={invalid}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply filter
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-field-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
        >
          Clear
        </button>
      </div>

      {invalid ? (
        <p role="alert" className="text-sm font-medium text-danger-ink">
          From date cannot be later than to date.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {QUICK_RANGES.map((range) => {
          const isActive = range.key === activeQuickRange;
          return (
            <button
              key={range.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                const preset = bsQuickRange(range.key as QuickRangeKey, todayBS);
                applyRange(preset.from, preset.to);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                isActive
                  ? "bg-primary text-white"
                  : "border border-field-line bg-surface text-ink-secondary hover:bg-page hover:border-secondary hover:text-secondary"
              }`}
            >
              {range.label}
            </button>
          );
        })}
      </div>
    </form>
  );
}
