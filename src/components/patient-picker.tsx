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
  const [results, setResults] = useState<PatientResult[]>([]);
  const [selectedId, setSelectedId] = useState(initialPatientId ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    if (query.trim().length < 2 || query === initialLabel) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/patients/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: PatientResult[]) => {
          setResults(data);
          setOpen(true);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId("");
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search by name, phone, or patient ID"
        required
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
      <input type="hidden" name={name} value={selectedId} required />
      {open && results.length > 0 ? (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  setQuery(`${p.fullName} (${p.patientCode})`);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{p.fullName}</span>{" "}
                <span className="text-slate-400">{p.patientCode} · {p.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
