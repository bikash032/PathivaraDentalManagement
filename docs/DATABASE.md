# Database Design — Pathivara Dental Clinic Admin System

Status: **DRAFT — proposed data model, awaiting approval before `prisma/schema.prisma` is written**

This document describes the entities, relationships, and key design decisions for the
PostgreSQL schema (managed via Prisma). It intentionally covers the full V1 domain now
(per the project rule: design the database carefully before implementing), even though
each module's UI/logic will still be built phase-by-phase.

---

## Conventions used throughout

- **Primary keys:** `cuid()` strings for all internal IDs (short, sortable-ish, no config needed).
- **Human-facing codes** (e.g. Patient ID, Invoice Number) are separate unique fields, not the PK — so internal IDs can stay opaque while staff-facing numbers stay meaningful.
- **Money:** `Decimal @db.Decimal(12, 2)` everywhere — NPR with paisa precision, never `Float`.
- **Dates/times:** `DateTime` (Postgres `timestamptz`), never strings. BS calendar is a display-layer concern only, handled at render time.
- **Soft delete / archive:** no hard deletes on clinical or financial records. Patients get a `status`, invoices/payments get a `voided`/`cancelled` marker, catalog items get `isActive`. Rows stay for history and audit.
- **Timestamps:** every table has `createdAt` / `updatedAt`.
- **Snapshotting:** billing rows (`InvoiceItem`) copy the treatment name/price at the time of billing, so editing the service catalog later never rewrites historical invoices.

---

## Entities

### User (staff accounts)
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| name | String | |
| email | String, unique | login identifier |
| phone | String, nullable | Nepali format |
| passwordHash | String | never plaintext |
| roleId | FK → Role | dynamic, see below |
| isActive | Boolean, default true | deactivate instead of delete; checked on **every** request, not just at login (see decision #1) |
| createdAt / updatedAt | DateTime | |

### Role
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| name | String, unique | display name, e.g. "Doctor" |
| key | String, unique | stable machine key, e.g. `SUPER_ADMIN` — used by seed/system logic |
| description | Text, nullable | |
| isSystem | Boolean, default false | true for the 4 seeded roles; system roles can't be deleted (prevents lockout) |
| createdAt / updatedAt | DateTime | |

### Permission
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| key | String, unique | e.g. `patient.create`, `billing.manage`, `user.manage`, `settings.manage`, `audit.view` |
| description | Text, nullable | |
| category | String, nullable | grouping for a future permissions-editor UI, e.g. "Patients", "Billing" |
| createdAt | DateTime | |

### RolePermission (join table)
id, roleId (FK), permissionId (FK), unique `(roleId, permissionId)`.

Grants a permission to a role. The Super Admin role is seeded with every permission, and any **new** permission key introduced by a future feature is auto-granted to Super Admin during that migration's seed step — so Super Admin can never silently lose access as the app grows.

### Patient
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| patientCode | String, unique | e.g. `PDC-000123`, shown to staff |
| fullName | String | |
| phone | String | Nepali format validated |
| alternatePhone | String, nullable | |
| address | String, nullable | |
| dateOfBirth | Date, nullable | exact DOB when known |
| approxAge | Int, nullable | used when only age (not DOB) is known — common in-clinic |
| gender | Enum: `MALE, FEMALE, OTHER` | |
| emergencyContactName | String, nullable | |
| emergencyContactPhone | String, nullable | |
| medicalNotes | Text, nullable | important medical history |
| allergies | Text, nullable | |
| status | Enum: `ACTIVE, ARCHIVED` | archive instead of delete |
| notes | Text, nullable | |
| createdById | FK → User | |
| createdAt / updatedAt | DateTime | registrationDate = createdAt |

Indexes: unique `patientCode`; index on `phone`, `fullName` for search.

### Appointment
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| patientId | FK → Patient | |
| doctorId | FK → User (role=DOCTOR) | |
| scheduledAt | DateTime | single timestamp (date+time combined) |
| durationMinutes | Int, default 30 | used for overlap checking |
| reason | String, nullable | |
| notes | Text, nullable | |
| status | Enum: `SCHEDULED, CONFIRMED, CHECKED_IN, IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW` | |
| createdById | FK → User | |
| createdAt / updatedAt | DateTime | |

Index on `(doctorId, scheduledAt)` — used both for calendar views and to check overlap before confirming a new booking (app-level check inside a transaction; see decision #2).

### Visit (clinical record)
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| patientId | FK → Patient | |
| appointmentId | FK → Appointment, nullable | nullable — walk-ins may not have a prior appointment |
| doctorId | FK → User | |
| visitDate | DateTime | |
| chiefComplaint | Text | |
| examination | Text, nullable | |
| diagnosis | Text, nullable | |
| treatmentNotes | Text, nullable | |
| clinicalNotes | Text, nullable | |
| followUpInstructions | Text, nullable | |
| nextAppointmentDate | Date, nullable | informational; an actual follow-up is a new Appointment row |
| createdById | FK → User | |
| createdAt / updatedAt | DateTime | |

### Prescription / PrescriptionItem
- `Prescription`: id, visitId (FK), patientId (FK), notes, createdAt.
- `PrescriptionItem`: id, prescriptionId (FK), medicineName, dosage, frequency, durationDays, instructions.

Split into a header + line items so a visit's prescription can list multiple medicines cleanly.

### Treatment (service catalog)
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| name | String | |
| code | String, unique | e.g. `FILL-01` |
| description | Text, nullable | |
| defaultPrice | Decimal(12,2) | admin-configurable |
| isActive | Boolean, default true | deactivate instead of delete |
| createdAt / updatedAt | DateTime | |

### Invoice
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| invoiceNumber | String, unique | e.g. `INV-2026-000123` |
| patientId | FK → Patient | |
| visitId | FK → Visit, nullable | invoice may stand alone (e.g. registration fee) |
| status | Enum: `UNPAID, PARTIALLY_PAID, PAID, CANCELLED` | |
| subtotal | Decimal(12,2) | sum of line totals |
| discountAmount | Decimal(12,2), default 0 | invoice-level discount |
| totalAmount | Decimal(12,2) | subtotal − discount |
| paidAmount | Decimal(12,2), default 0 | cached, kept in sync inside the same DB transaction as any Payment change (see decision #3) |
| notes | Text, nullable | |
| cancelledAt | DateTime, nullable | |
| cancelReason | String, nullable | |
| createdById | FK → User | |
| createdAt / updatedAt | DateTime | |

### InvoiceItem
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| invoiceId | FK → Invoice | |
| treatmentId | FK → Treatment, nullable | nullable so catalog cleanup never breaks history |
| description | String | **snapshot** of treatment name at billing time |
| quantity | Int, default 1 | |
| unitPrice | Decimal(12,2) | **snapshot** of price at billing time |
| discount | Decimal(12,2), default 0 | line-level discount |
| lineTotal | Decimal(12,2) | quantity × unitPrice − discount |

### PaymentMethod (configurable lookup, same pattern as Treatment)
id, name (unique — seeded with Cash, Bank Transfer, Card, Digital Wallet, Other), isActive.

Keeps a specific provider (eSewa, Khalti, IME Pay, etc.) out of hard-coded logic — staff/admin can rename or add entries later.

### Payment
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| invoiceId | FK → Invoice | |
| amount | Decimal(12,2) | |
| paymentMethodId | FK → PaymentMethod | |
| paymentDate | DateTime, default now | |
| reference | String, nullable | transaction/cheque ref |
| notes | Text, nullable | |
| receivedById | FK → User | |
| voidedAt | DateTime, nullable | mistakes are voided, never deleted |
| voidReason | String, nullable | |
| createdAt / updatedAt | DateTime | |

### AuditLog
| Field | Type | Notes |
|---|---|---|
| id | String (PK) | |
| userId | FK → User, nullable | nullable for pre-auth events (e.g. failed login) |
| action | String | e.g. `patient.create`, `invoice.payment_recorded` |
| entityType | String | e.g. `Patient` |
| entityId | String, nullable | |
| metadata | JSON, nullable | small structured context only — never raw clinical notes (§15) |
| ipAddress | String, nullable | |
| createdAt | DateTime | |

Index on `(entityType, entityId)` and on `createdAt`.

### ClinicProfile (singleton) + AppSetting (key/value)
- `ClinicProfile`: one row — clinicName, address, phone, email, panNumber (nullable), logoUrl (nullable), receiptFooterNote (nullable), updatedAt. Drives receipts/reports so nothing is hard-coded.
- `AppSetting`: generic `key` (unique) / `value` string table for small config (e.g. default appointment duration, invoice number prefix) that doesn't deserve its own column and would otherwise cause migration churn every time a minor toggle is needed.

---

## Design decisions

**1. Roles are dynamic database tables (`Role`/`Permission`/`RolePermission`) — confirmed.**
`User.roleId` points at a `Role` row rather than a fixed enum. The 4 initial roles (Super Admin, Admin, Reception, Doctor) are seeded as `isSystem = true` rows so they can't be deleted, but a future Settings screen can add custom roles or adjust a role's permission set without a code deploy.

Two consequences worth being explicit about:
- **Permission checks need a permission set available on every request.** To avoid a DB round-trip per check, the user's resolved permission set is loaded into the session at login. If a Super Admin edits a role's permissions, that change takes effect for affected users on their next login/session refresh — not instantly. This is an accepted tradeoff for a small clinic app (documented in `SECURITY.md` once written).
- **`User.isActive` is always checked live, per request** (not cached in the session), so deactivating a departing staff member's account takes effect immediately even mid-session — this matters more than permission-edit latency does.

**2. Double-booking prevention is application-level, not a DB constraint.**
Because appointments have variable duration, true overlap prevention needs a range check, not a simple unique constraint. I'll enforce it in the booking server action inside a transaction (reject/warn if the same doctor already has an overlapping slot). Acceptable for V1 volume; can move to a Postgres exclusion constraint (`EXCLUDE USING gist`) later if needed.

**3. Invoice `paidAmount`/`status` are cached, not computed on every read.**
Storing them (instead of always summing `Payment` rows live) makes patient/invoice list pages fast without per-row subqueries. They're only ever written inside the same DB transaction as the `Payment` insert/void that changes them, so they can't drift. Dashboard/report totals can still cross-check against `Payment` sums if we ever want a consistency audit.

**4. No `Session` table yet.**
Session/auth mechanics belong to Phase 3 (Authentication), not this business-data schema. I'll add whatever the chosen auth approach needs then, rather than guessing now.

---

## What's deliberately deferred (not in V1 schema)
- Tooth chart structure (clinical records leave room for it later without a schema rework).
- Multi-branch/clinic support (single `ClinicProfile` row assumes one location, per Phase 0 assumption).
- File attachments on visits (noted as a future addition once the upload feature is actually built in Phase 7).
- Insurance/third-party payer entities.

---

## Next step
Writing `prisma/schema.prisma` from this model, running the initial migration against the local `pathivara_dental_dev` database, and seeding: the 4 system roles with their permission grants, a default Super Admin user, and default treatment/payment-method lookups.
