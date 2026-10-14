"use client";

import { useEffect, useRef, useState } from "react";

type PatientResult = {
  id: string;
  fullName: string;
  phone: string;
  patientCode: string;
};

export function PatientPicker({
  name,
  initialPatientId,
  initialLabel,
}: {
  name: string;
  initialPatientId?: string;
  initialLabel?: string;
}) {
  const [query, setQuery] = useState(initialLabel ?? "");
  // Results are tagged with the query they came from, so stale results from a
  // previous keystroke are simply not rendered — no need to clear state.
  const [results, setResults] = useState<{ query: string; items: PatientResult[] }>({
    query: "",
    items: [],
  });
  const [selectedId, setSelectedId] = useState(initialPatientId ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchable = query.trim().length >= 2 && query !== initialLabel;
  const visibleResults = results.query === query.trim() ? results.items : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchable) return;

    const trimmed = query.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/patients/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((items: PatientResult[]) => {
          setResults({ query: trimmed, items });
          setOpen(true);
        })
        .catch(() => {});
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, searchable]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId("");
        }}
        onFocus={() => visibleResults.length > 0 && setOpen(true)}
        placeholder="Search by name, phone, or patient ID"
        required
        className="w-full rounded-md border border-field-line px-3 py-2 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
      />
      <input type="hidden" name={name} value={selectedId} required />
      {open && visibleResults.length > 0 ? (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-line bg-surface shadow-lg">
          {visibleResults.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  setQuery(`${p.fullName} (${p.patientCode})`);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-page"
              >
                <span className="font-medium text-ink">{p.fullName}</span>{" "}
                <span className="text-ink-muted">{p.patientCode} · {p.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
