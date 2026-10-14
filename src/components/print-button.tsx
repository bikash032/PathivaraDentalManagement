"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
    >
      Print
    </button>
  );
}
