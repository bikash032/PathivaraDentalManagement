"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PatientResult = {
  id: string;
  fullName: string;
  phone: string;
  patientCode: string;
};

const DEBOUNCE_MS = 275;

/**
 * Billing-only patient lookup by the *start* of the name.
 *
 * Selecting a result filters the invoice list to that patient via the
 * `patientId` query parameter; the status filter is carried along so the two
 * filters compose instead of replacing each other.
 */
export function PatientNameSearch({ status }: { status?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // Results carry the query they were fetched for, so a slow response from an
  // earlier keystroke can never overwrite a newer one.
  const [results, setResults] = useState<{ query: string; items: PatientResult[] }>({
    query: "",
    items: [],
  });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const isCurrent = results.query === trimmed;
  const visibleResults = isCurrent ? results.items : [];
  // No separate loading flag: a request is outstanding exactly while the held
  // results belong to an older query than the one in the box.
  const searching = hasQuery && !isCurrent;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!hasQuery) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/patients/search?q=${encodeURIComponent(trimmed)}&mode=name-prefix`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((items: PatientResult[]) => setResults({ query: trimmed, items }))
        .catch((err: unknown) => {
          // An abort means a newer keystroke already has a request in flight.
          // Anything else is a real failure: record it as "no results" for this
          // query so the dropdown stops saying "Searching…".
          if ((err as Error)?.name !== "AbortError") setResults({ query: trimmed, items: [] });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmed, hasQuery]);

  function select(patient: PatientResult) {
    setOpen(false);
    setQuery(`${patient.fullName} (${patient.patientCode})`);

    const next = new URLSearchParams();
    next.set("patientId", patient.id);
    if (status) next.set("status", status);
    router.push(`/billing?${next.toString()}`);
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-80">
      <label htmlFor="patientName" className="block text-xs font-medium text-ink-muted">
        Search patient by name
      </label>
      <input
        id="patientName"
        type="text"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(e.target.value.trim().length > 0);
        }}
        onFocus={() => setOpen(hasQuery)}
        placeholder="Start typing a name, e.g. Ram"
        className="mt-1 w-full rounded-md border border-field-line bg-field px-3 py-2 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
      />

      {open && hasQuery ? (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg">
          {visibleResults.length > 0 ? (
            visibleResults.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => select(p)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-page"
                >
                  <span className="font-medium text-ink">{p.fullName}</span>{" "}
                  <span className="text-ink-muted">
                    {p.patientCode} · {p.phone}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-ink-muted">
              {searching ? "Searching…" : "No patients found"}
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
