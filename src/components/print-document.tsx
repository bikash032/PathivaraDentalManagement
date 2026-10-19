import Link from "next/link";
import { CLINIC_SLOGAN } from "@/lib/clinic-branding";
import type { ClinicProfileView } from "@/lib/clinic-settings";
import { PrintButton } from "@/components/print-button";

/*
 * Building blocks shared by every printable document (src/app/print/*):
 * paper size, screen-only toolbar, clinic header and slogan footer. Sizes come
 * from the `.print-doc` variables in globals.css.
 */

export type PaperSize = "a4" | "80mm" | "58mm";

const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "80mm", label: "Receipt 80 mm" },
  { value: "58mm", label: "Receipt 58 mm" },
];

export function parsePaper(value: string | string[] | undefined): PaperSize {
  return value === "80mm" || value === "58mm" ? value : "a4";
}

export function isThermal(paper: PaperSize): boolean {
  return paper !== "a4";
}

/**
 * `emphasis` prints all regular text black bold italic (see globals.css);
 * thermal receipts always get it because thin text prints faintly there.
 */
export function PrintDocument({
  paper,
  emphasis = false,
  children,
}: {
  paper: PaperSize;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Thermal rolls: let the printer's own paper size apply instead of A4. */}
      {isThermal(paper) ? <style>{"@media print { @page { size: auto; margin: 2mm; } }"}</style> : null}
      <article
        className="print-doc"
        data-paper={paper}
        data-emphasis={emphasis || isThermal(paper) ? "" : undefined}
      >
        {children}
      </article>
    </>
  );
}

/** Screen-only controls above the document: paper size and Print. */
export function PrintToolbar({ paper, basePath }: { paper: PaperSize; basePath: string }) {
  return (
    <div className="no-print mx-auto flex max-w-[190mm] flex-wrap items-center justify-between gap-3 px-4 pt-4">
      <nav aria-label="Paper size" className="flex flex-wrap gap-1 text-sm">
        {PAPER_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "a4" ? basePath : `${basePath}?paper=${option.value}`}
            aria-current={option.value === paper ? "page" : undefined}
            className={
              option.value === paper
                ? "rounded-md border border-primary bg-primary-soft px-3 py-1.5 font-medium text-primary"
                : "rounded-md border border-field-line bg-surface px-3 py-1.5 text-ink-secondary hover:border-secondary hover:text-secondary"
            }
          >
            {option.label}
          </Link>
        ))}
      </nav>
      <PrintButton />
    </div>
  );
}

export function ClinicPrintHeader({
  clinic,
  title,
  showContact = false,
}: {
  clinic: ClinicProfileView;
  title: string;
  showContact?: boolean;
}) {
  const contact = showContact
    ? [clinic.phone, clinic.email, clinic.panNumber ? `PAN: ${clinic.panNumber}` : null].filter(Boolean).join(" · ")
    : "";

  return (
    <header className="keep-together mb-4 text-center">
      <p className="text-[length:var(--doc-name)] font-bold leading-tight text-primary">{clinic.clinicName}</p>
      <p className="mt-1 text-[length:var(--doc-address)] text-ink">{clinic.address}</p>
      {contact ? <p className="mt-0.5 text-[length:var(--doc-address)] text-ink-secondary">{contact}</p> : null}
      <div className="mt-3 border-t-2 border-primary" />
      <h1 className="mt-2 text-[length:var(--doc-title)] font-bold uppercase tracking-wide text-ink">{title}</h1>
    </header>
  );
}

/** Three-line slogan, printed once at the end of patient-facing documents. */
export function ClinicPrintFooter({ note }: { note?: string | null }) {
  return (
    <footer className="keep-together mt-6">
      {note ? (
        <p className="mb-3 whitespace-pre-wrap text-center text-[length:var(--doc-label)] text-ink-secondary">{note}</p>
      ) : null}
      <div className="border-t border-primary pt-2 text-center text-[length:var(--doc-slogan)] leading-snug">
        {CLINIC_SLOGAN.map((line, index) => (
          <p key={line.text} className={index === 0 ? "font-semibold text-primary" : "text-ink"}>
            <span className="emoji" aria-hidden="true">
              {line.lead}
            </span>{" "}
            {line.text}
            {line.trail ? (
              <>
                {" "}
                <span className="emoji" aria-hidden="true">
                  {line.trail}
                </span>
              </>
            ) : null}
          </p>
        ))}
      </div>
    </footer>
  );
}
