# Pathivara Dental Clinic — Admin Management Web Application
## Project Plan (Phase 0 — Requirements & Planning)

Status: **DRAFT — awaiting owner approval before Phase 1 begins**
Prepared: 2026-09-14

---

## 0. Workspace Inspection Findings

- The working directory (`/Users/bikashmac/Documents/Pathivara Dental Management`) is **completely empty**. No existing project, no `package.json`, no `.git`.
- **Not a git repository** yet.
- **Node.js / npm: not installed** on this machine.
- **PostgreSQL / psql: not installed** on this machine.
- **Homebrew is installed** (`/opt/homebrew/bin/brew`), so Node and PostgreSQL can be installed cleanly when we reach Phase 1.
- macOS 15.6 (Darwin 24.6.0), zsh shell.

**Conclusion:** this is a greenfield project. Nothing existing to preserve or migrate. Phase 1 will require installing Node.js (LTS) and PostgreSQL locally — I will ask before running any install commands when we get there.

---

## 1. Project Objective

Build a production-ready, **internal/admin-only** management system for Pathivara Dental Clinic (Nepal) covering patients, appointments, clinical records, treatments, billing, reporting, and staff administration. Not a public-facing patient website in V1.

The system must work for local (in-clinic) use first, with an architecture that later supports secure remote access without exposing the database or unnecessary ports to the public internet.

---

## 2. Users & Roles (V1)

| Role | Summary access |
|---|---|
| Super Admin | Full access: users, roles, system settings, audit logs, everything below |
| Admin | Operational + financial access per assigned permissions |
| Reception | Patients, appointments, basic billing |
| Doctor | Appointments, clinical records, patient history |

Permissions will be modeled explicitly (not just role name checks), so individual permissions can later be granted/revoked per role without code changes to every check site. Every server-side action/API re-verifies authorization — the frontend never being the sole gate.

**Open question (see §13):** are there any roles beyond these four we should plan for now (e.g., Accountant, Lab Technician), or is 4 roles correct for V1?

---

## 3. Modules (V1 scope)

1. **Dashboard** — today's appointments/patients, pending/completed/cancelled counts, today's collection, outstanding balances, recent activity, quick actions.
2. **Patient Management** — full CRUD, search/filter, archive (not hard delete), patient timeline.
3. **Appointment Management** — scheduling, status lifecycle, doctor/date/time, double-booking prevention.
4. **Clinical Records (Visits)** — chief complaint, exam, diagnosis, treatment, notes, prescription, follow-up. Schema left extensible for a future tooth chart (not built now).
5. **Treatments/Services Catalog** — admin-configurable services with default price, code, status.
6. **Billing & Payments** — invoices, invoice items, partial payments, payment methods (configurable, cash/bank/card/digital as defaults), auditable financial records, DB transactions for money-moving operations.
7. **Receipts & Printing** — printable invoice/receipt/registration/appointment slips, A4-first, thermal-friendly layout considered.
8. **Reports** — daily/monthly collection, outstanding payments, patient/appointment/doctor-wise/service reports, date-range filters.
9. **User Management & RBAC** — user CRUD, role assignment, activation/deactivation.
10. **Audit Log** — who did what, when, to which entity.
11. **Settings** — clinic name/address/contact, configurable service catalog, payment methods, etc. (no hard-coded clinic info in templates).

---

## 4. Functional Requirements (highlights)

- Unique Patient ID, full CRUD with search/filter/pagination.
- Patient timeline: Patient → Appointments → Visits → Diagnosis → Treatments → Prescriptions → Payments → Follow-ups.
- No hard deletion of clinical/financial records — archive/soft-delete only.
- Appointment statuses: Scheduled, Confirmed, Checked In, In Consultation, Completed, Cancelled, No Show.
- Invoice → Payments with computed Paid/Remaining/Status (Unpaid, Partially Paid, Paid, Cancelled).
- Server-side search/pagination once data volume grows (no dumping full tables to the browser).

## 5. Non-Functional Requirements

- Security-first: hashed passwords, server-side authZ on every action, input validation (Zod), rate limiting on auth endpoints, no secrets in source.
- Data integrity: DB-level constraints, transactions for financial writes, proper decimal handling for money (no raw JS floats).
- Auditability: append-only audit log for sensitive actions.
- Performance: indexed queries, pagination, no premature optimization.
- Maintainability: typed TypeScript, validated inputs, business logic separated from UI, minimal necessary comments.
- Availability/DR: documented backup + restore process, tested restoration.

---

## 6. Nepal-Specific Considerations

- Currency: NPR (रु.), stored as integer paisa or `Decimal`/`Numeric` DB type — never floating point.
- Phone validation for Nepali mobile prefixes (`9[678]XXXXXXXX`, 10 digits).
- Dates stored as proper SQL date/timestamp types (Gregorian/AD) — never formatted strings. BS calendar is a **future UI-layer display concern only** (e.g. via a conversion library at render time), not a storage concern.
- Clinic identity (name, address, phone, logo, registration/PAN number if applicable) kept in a configurable `ClinicSetting` table, not hard-coded in templates — needed for receipts/reports.

---

## 7. Security Requirements

- Password hashing (bcrypt/argon2 class algorithm), secure session-based auth (e.g., iron-session/NextAuth credentials or equivalent — to be finalized in Phase 3).
- Server-side RBAC enforced on every mutating/reading server action and API route, not just UI hiding.
- Zod validation on all inputs at the server boundary.
- Rate limiting on login and other abuse-prone endpoints.
- Secrets only via environment variables; `.env.example` committed, `.env` never committed.
- No SQL errors, stack traces, or credentials surfaced to the UI in production.
- File uploads (future — clinical attachments): validated type/size/name, access-controlled storage, never public by default.
- Least-privilege data access per role; patient data never exposed via public APIs, client bundles, URLs, or logs.

---

## 8. Database Planning (high level — not final schema)

Proposed core entities (to be detailed and approved in Phase 2 before writing the Prisma schema):

`User, Role, Permission, Patient, Appointment, Visit(ClinicalRecord), Treatment/Service, Invoice, InvoiceItem, Payment, Prescription, AuditLog, ClinicSetting`

Principles: normalized schema, explicit FKs/unique constraints/indexes, `createdAt`/`updatedAt` on all tables, soft-delete/archive flag on Patient/Invoice/clinical entities rather than hard delete, money as `Decimal`/`Numeric`, dates as `DATE`/`TIMESTAMP`.

I will present the full proposed data model (entity-relationship description) for your review **before** generating the actual Prisma schema, per your standing rule in §16.

---

## 9. Deployment Planning

- **Dev:** local Next.js + local PostgreSQL (via Homebrew) on the developer machine.
- **Production (clinic):** Next.js app + PostgreSQL on a dedicated clinic server/PC, or a small VPS if the clinic prefers off-site hosting — to be decided in Phase 16.
- **Remote access:** via a private VPN overlay (e.g., Tailscale/WireGuard) rather than exposing the app or database publicly. PostgreSQL is never exposed to the public internet; no unnecessary open ports.
- Full deployment plan will be written in Phase 16, once modules are built and the clinic's actual server/networking situation is known.

---

## 10. Backup Planning

- Scheduled automated PostgreSQL backups (e.g., nightly `pg_dump` or WAL-based).
- Local backup copy + encrypted off-site copy.
- Documented retention policy and a periodically **tested** restore procedure (a backup that's never been restored isn't trusted).
- Full detail in `/docs/BACKUP.md` during Phase 15, but the schema/app will be built in Phase 2+ in a way that doesn't make backups an afterthought (e.g., avoiding local-only file storage for anything that must be recoverable).

---

## 11. Development Phases

| Phase | Scope |
|---|---|
| 0 | Requirements & planning *(this document)* |
| 1 | Project setup & architecture (Next.js, TS, Tailwind, tooling, git init) |
| 2 | Database foundation (schema design → Prisma) |
| 3 | Authentication & RBAC |
| 4 | Dashboard |
| 5 | Patient management |
| 6 | Appointment management |
| 7 | Visits & clinical records |
| 8 | Treatments/services |
| 9 | Billing & payments |
| 10 | Receipts & printing |
| 11 | Reports |
| 12 | Settings & administration |
| 13 | Audit logs |
| 14 | Testing & security review |
| 15 | Backup system |
| 16 | Clinic deployment |
| 17 | Secure remote access |

Each phase is built and verified before moving to the next; no skipping ahead to deployment.

---

## 12. Testing Strategy

- Unit tests for business logic, especially financial calculations (invoice totals, discounts, remaining balance) and date/phone validation.
- Integration tests for auth, RBAC enforcement, patient/appointment CRUD.
- E2E tests (e.g., Playwright) for critical workflows: login → create patient → book appointment → record visit → generate invoice → record payment.
- Tests written before a module is considered "done," per your rule in §24.

---

## 13. Open Questions for Your Approval

These are the points I did **not** want to silently assume, since they affect architecture:

1. **Roles:** Confirm the 4 listed roles (Super Admin, Admin, Reception, Doctor) are correct/sufficient for V1, or list any additional roles to plan for now.
2. **Single location vs. multi-branch:** I'm assuming Pathivara Dental Clinic is a **single physical location** for V1 (no branch/multi-clinic data model). Confirm, or let me know if multi-branch support should be designed in from the start (much harder to retrofit later).
3. **Production hosting target:** Do you already have a clinic server/PC in mind for eventual deployment, or should I plan for a small VPS as a fallback? (Not needed until Phase 16, but good to know early.)
4. **Local dev database:** OK to install PostgreSQL + Node.js locally via Homebrew when we reach Phase 1? (Alternative: Docker container for Postgres — let me know if you prefer that instead of a native Homebrew install.)

Everything else in this plan follows sensible, documented defaults per your master prompt and doesn't need to block Phase 1.

---

## 14. Future Expansion Possibilities (not in V1)

- Bikram Sambat calendar UI toggle.
- Dental tooth-chart clinical UI.
- SMS/appointment reminders (common in Nepal clinics).
- Multi-branch support.
- Patient-facing portal.
- Insurance/third-party payer support.

---

## Next Step

Once you confirm §13 (or tell me to proceed with my stated assumptions), I'll begin **Phase 1: Project Setup** — initializing git, scaffolding Next.js/TypeScript/Tailwind, and setting up the base project structure — and check in before moving to Phase 2 (database schema design).
