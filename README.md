# Pathivara Dental Clinic — Management System

An internal, staff-only management system for Pathivara Dental Clinic (Nepal):
patients, appointments, clinical records, treatments, billing, receipts,
reports, staff administration and an audit trail.

Built with Next.js 16, TypeScript, Tailwind CSS, PostgreSQL and Prisma.

## Quick start

```bash
npm install
cp .env.example .env        # fill in real values
npx prisma migrate dev
npx prisma db seed
npm run dev                 # http://localhost:3000
```

Full setup instructions: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Modules

| Module | What it does |
|---|---|
| Dashboard | Today's appointments, patients, collection, outstanding balances, recent activity |
| Patients | Register, search, edit, archive; full history on one page |
| Appointments | Day view with doctor/status filters, booking with double-booking prevention, status lifecycle |
| Visits | Clinical records (complaint, examination, diagnosis, treatment, notes) with prescriptions |
| Treatments | Configurable service catalog with prices |
| Billing | Invoices with line items, partial payments, void/cancel, server-side money math |
| Receipts | A4 print views for invoices and patient registration |
| Reports | Collection, outstanding, registrations, appointments, treatments, doctor-wise — all date-ranged |
| Users | Staff accounts, role assignment, deactivation, password reset |
| Audit log | Append-only record of security- and record-sensitive actions |
| Settings | Clinic profile, payment methods, role/permission editor |

## Roles

Super Admin, Admin, Reception, Doctor — backed by editable database
permissions, not hard-coded checks. A Super Admin can adjust any role's
permissions in Settings without a code change.

## Testing

```bash
npm test                          # unit tests (money math, validation, timezone)
set -a; source .env; set +a
npm run test:e2e                  # end-to-end workflows
```

## Documentation

| Document | Contents |
|---|---|
| [PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | Objectives, scope, phases |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, layout, key design decisions |
| [DATABASE.md](docs/DATABASE.md) | Data model and schema rationale |
| [SECURITY.md](docs/SECURITY.md) | Security posture, review findings, limitations |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, commands, conventions |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Clinic server deployment and secure remote access |
| [BACKUP.md](docs/BACKUP.md) | Backup, restore and disaster recovery |

## Date System

The application uses:

- **Bikram Sambat (BS)** for all user-facing dates
- **Gregorian/AD `DateTime`** for database storage
- **Asia/Kathmandu** as the default clinic timezone (configurable in Settings)

### How BS ↔ AD conversion works

BS exists only at the presentation layer. PostgreSQL never stores a BS value:

```
UI (BS)  →  bsToADInput()  →  server action  →  Prisma  →  PostgreSQL (AD DateTime)
UI (BS)  ←  formatBSDate() ←  server component ← Prisma ←  PostgreSQL (AD DateTime)
```

Keeping AD in the database is what makes sorting, range queries, appointment
lookups, reports and any future integration work correctly — BS month lengths
vary (29–32 days) and cannot be compared arithmetically.

The BS date picker submits the equivalent **AD `YYYY-MM-DD`** in a hidden
field, so server actions receive exactly what they always did.

All conversion and formatting lives in [src/lib/bs-date.ts](src/lib/bs-date.ts) —
never convert dates inline in a component:

| Function | Output |
|---|---|
| `formatBSDateShort(date)` | `२०८३/०५/३०` |
| `formatBSDate(date)` | `३० भदौ २०८३` |
| `formatBSDateLong(date)` | `३० भदौ २०८३, मंगलबार` |
| `formatBSDateTime(date, tz)` | `३० भदौ २०८३, १०:३० AM` |
| `adToBS(date)` / `bsToAD(bs)` | conversion between calendars |
| `getCurrentBSDate()` | today in BS, computed dynamically |

Conversion uses the [`bikram-sambat`](https://www.npmjs.com/package/bikram-sambat)
package (Apache-2.0), which carries real per-year month-length tables rather
than assuming fixed months. Supported range: **BS 1970–2090** (AD 1913–2034);
dates outside it raise a `BSDateError` instead of converting incorrectly.

### Timezone

A BS calendar day is defined in Nepal Time, so BS dates are always resolved in
NPT (UTC+5:45) regardless of the server's own timezone. The **clinic timezone**
setting governs the clock time displayed alongside dates.

## Notes for this clinic

- Currency is NPR, stored as decimal and computed in integer paisa — never
  floating point.
- Phone numbers validate against Nepali mobile formats (96/97/98 + 8 digits).
- All "today" and date-range logic is computed in Nepal Time (UTC+5:45)
  regardless of the server's own timezone.
- Staff see Bikram Sambat dates throughout; storage stays Gregorian (see
  [Date System](#date-system)).
