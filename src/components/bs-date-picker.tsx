"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BS_MONTHS,
  BS_WEEKDAYS_SHORT,
  BS_MIN_YEAR,
  BS_MAX_YEAR,
  adInputToBS,
  bsToADInput,
  bsDaysInMonth,
  bsMonthStartWeekday,
  getCurrentBSDate,
  addBSMonths,
  clampBSDay,
  formatBSParts,
  formatBSMonthYear,
  toNepaliNumerals,
  isValidBSDate,
  isBSYearInRange,
  type BSDate,
} from "@/lib/bs-date";

/**
 * Bikram Sambat date picker.
 *
 * The user picks a BS date; the component submits the equivalent AD
 * "YYYY-MM-DD" in a hidden input under `name`, so every existing server
 * action keeps receiving exactly the value it already expects.
 */
export function BSDatePicker({
  name,
  defaultValue,
  required,
  id,
  onChangeValue,
}: {
  name: string;
  /** AD "YYYY-MM-DD" */
  defaultValue?: string;
  required?: boolean;
  id?: string;
  onChangeValue?: (adValue: string) => void;
}) {
  const initialBS = useMemo(() => {
    if (defaultValue) {
      try {
        return adInputToBS(defaultValue);
      } catch {
        return null;
      }
    }
    return null;
  }, [defaultValue]);

  const [selected, setSelected] = useState<BSDate | null>(initialBS);
  const [view, setView] = useState(() => initialBS ?? getCurrentBSDate());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => getCurrentBSDate(), []);
  const adValue = selected ? bsToADInput(selected) : "";

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  function choose(day: number) {
    const next = { year: view.year, month: view.month, day };
    if (!isValidBSDate(next)) return;
    setSelected(next);
    setOpen(false);
    onChangeValue?.(bsToADInput(next));
  }

  function shiftMonth(delta: number) {
    const next = addBSMonths(view.year, view.month, delta);
    if (!isBSYearInRange(next.year)) return;
    // clamp: the target month may be shorter than the current one (29–32 days)
    setView({ ...next, day: clampBSDay(next.year, next.month, view.day) });
  }

  function shiftYear(delta: number) {
    const nextYear = view.year + delta;
    if (!isBSYearInRange(nextYear)) return;
    setView({ year: nextYear, month: view.month, day: clampBSDay(nextYear, view.month, view.day) });
  }

  function goToToday() {
    setView(today);
    setSelected(today);
    setOpen(false);
    onChangeValue?.(bsToADInput(today));
  }

  const daysInView = bsDaysInMonth(view.year, view.month);
  const leadingBlanks = bsMonthStartWeekday(view.year, view.month);

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={adValue} required={required} />

      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      >
        {selected ? (
          <span className="text-slate-900">{formatBSParts(selected)}</span>
        ) : (
          <span className="text-slate-400">मिति छान्नुहोस् (select date)</span>
        )}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Bikram Sambat date picker"
          className="absolute z-20 mt-1 w-[19rem] max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <div className="flex gap-1">
              <NavButton label="‹‹" title="अघिल्लो वर्ष" onClick={() => shiftYear(-1)} />
              <NavButton label="‹" title="अघिल्लो महिना" onClick={() => shiftMonth(-1)} />
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {formatBSMonthYear(view.year, view.month)}
            </div>
            <div className="flex gap-1">
              <NavButton label="›" title="अर्को महिना" onClick={() => shiftMonth(1)} />
              <NavButton label="››" title="अर्को वर्ष" onClick={() => shiftYear(1)} />
            </div>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {BS_WEEKDAYS_SHORT.map((w) => (
              <div key={w} className="py-1 text-center text-[11px] font-medium text-slate-500">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInView }, (_, i) => i + 1).map((day) => {
              const isSelected =
                selected?.year === view.year && selected?.month === view.month && selected?.day === day;
              const isToday = today.year === view.year && today.month === view.month && today.day === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => choose(day)}
                  aria-label={`${day} ${BS_MONTHS[view.month - 1]} ${view.year}`}
                  aria-current={isToday ? "date" : undefined}
                  className={`rounded py-1.5 text-center text-sm transition ${
                    isSelected
                      ? "bg-slate-900 font-semibold text-white"
                      : isToday
                        ? "bg-slate-100 font-semibold text-slate-900 ring-1 ring-slate-300"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {toNepaliNumerals(day)}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={goToToday}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              आज ({formatBSParts(today)})
            </button>
            <span className="text-[10px] text-slate-400">
              वि.सं. {toNepaliNumerals(BS_MIN_YEAR)}–{toNepaliNumerals(BS_MAX_YEAR)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}
