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

## Notes for this clinic

- Currency is NPR, stored as decimal and computed in integer paisa — never
  floating point.
- Phone numbers validate against Nepali mobile formats (96/97/98 + 8 digits).
- All "today" and date-range logic is computed in Nepal Time (UTC+5:45)
  regardless of the server's own timezone.
- Dates are stored as proper timestamps; Bikram Sambat display can be layered
  on later without touching storage.
