# Architecture — Pathivara Dental Clinic Admin System

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server Components + Server Actions let authorization live next to the data access, with no separate API layer to keep in sync |
| Language | TypeScript (strict) | |
| UI | React 19 + Tailwind CSS 4 | Desktop-first admin UI; no component library, so there's nothing to fight when a screen needs to be dense |
| Database | PostgreSQL 16 | Real decimal type for money, real timestamps, transactions |
| ORM | Prisma 7 with `@prisma/adapter-pg` | Typed queries and a migration history that is reviewable in git |
| Validation | Zod | One schema validates on the server; forms never define their own rules |
| Auth | Custom DB-backed sessions | Simple to reason about and audit; no OAuth flows needed for staff-only login |
| Tests | Vitest (unit) + Playwright (E2E) | |

## Request flow

```
Browser
  │
  ├─ proxy.ts ............... coarse redirect if no session cookie (UX only)
  │
  ├─ (app)/layout.tsx ....... requireUser()  → DB-validated session
  │     │
  │     └─ page.tsx ......... requirePermission("x.y") → renders data
  │
  └─ Server Action .......... requirePermission("x.y") → Zod parse → Prisma
                                   │
                                   └─ writeAuditLog(...)
```

Every protected entry point re-checks authorization server-side. The middleware
(`proxy.ts`) only checks that a cookie *exists* — it is a convenience, never the
security boundary. See SECURITY.md.

## Directory layout

```
src/
  app/
    (app)/            authenticated app shell (sidebar + header)
      dashboard/ patients/ appointments/ visits/ treatments/
      billing/ reports/ users/ audit/ settings/ account/
    login/            public
    print/            auth-protected, outside the app shell (A4 receipts)
    api/              route handlers (JSON; 401/403 rather than redirects)
  components/         shared UI (stat card, patient picker, print button)
  lib/
    auth/             session creation/validation, current user, permissions
    validation/       Zod schemas, one module per domain
    db.ts             PrismaClient singleton
    money.ts          pure invoice math (unit tested)
    date.ts           Nepal-timezone date handling
    permissions.ts    permission catalog + role seed definitions
    audit.ts, nav.ts, currency.ts, patient-code.ts, invoice-number.ts
prisma/               schema, migrations, seed
tests/unit/           Vitest
tests/e2e/            Playwright
scripts/              backup.sh, restore.sh
docs/                 this documentation
```

Each feature module follows the same shape, so a new one is predictable:

```
<module>/
  page.tsx            list (server-side search/filter/pagination)
  new/page.tsx        create
  [id]/page.tsx       detail
  [id]/edit/page.tsx  edit
  actions.ts          "use server" — permission → validate → transact → audit
  <module>-form.tsx   "use client" — useActionState, renders server errors
```

## Key decisions

**Server Actions over REST.** Mutations are server functions called directly
from forms. Authorization, validation and the database write sit in one
reviewable function; there is no client-side API surface to secure separately.
The one route handler that exists (`/api/patients/search`) is there because the
patient picker needs to query as the user types.

**Money as integer paisa.** `src/lib/money.ts` converts to integer paisa before
arithmetic and back afterwards, so totals can't drift the way binary floats do.
The database column is `Decimal(12,2)`. Totals are always recomputed on the
server from the submitted line items — never trusted from the client.

**Cached invoice totals, transactionally maintained.** `Invoice.paidAmount` and
`status` are stored rather than derived on every read, so list pages don't need
a subquery per row. They are only ever written inside the same transaction as
the payment that changes them, so they cannot drift from the payment rows.

**Nepal time is explicit.** Dates are stored as UTC timestamps; every "today"
or day-range calculation converts through a fixed UTC+5:45 offset
(`src/lib/date.ts`) rather than relying on the server's locale. A server
running in UTC and one running in Asia/Kathmandu produce identical results.

**Snapshotting on invoice lines.** `InvoiceItem` copies the treatment's name and
price at billing time. Re-pricing or retiring a service never rewrites history.

**Nothing important is deleted.** Patients archive, invoices cancel, payments
void, catalog entries deactivate, audit rows are append-only.

**Dynamic RBAC.** Roles and permissions are database rows, editable by a Super
Admin in Settings without a deploy. `src/lib/permissions.ts` is the catalog
that seeds them, and adding a permission there auto-grants it to Super Admin so
it can never fall behind as features ship.

## Known trade-offs

Documented with their reasoning in SECURITY.md §"Known limitations": in-memory
rate limiting, permission changes applying at next login, application-level
(not constraint-level) double-booking prevention, and no 2FA yet.
