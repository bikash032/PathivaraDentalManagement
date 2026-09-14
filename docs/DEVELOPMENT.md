# Development Guide

## Prerequisites

- Node.js (this project is developed against Node 26)
- PostgreSQL 16
- Git

On macOS both come from Homebrew:

```bash
brew install node postgresql@16
brew services start postgresql@16
```

`psql` is keg-only, so add it to your PATH when you need it directly:

```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
```

## First-time setup

```bash
npm install

# database + app role
createdb -O pathivara_app pathivara_dental_dev   # if the role doesn't exist yet:
psql postgres -c "CREATE ROLE pathivara_app WITH LOGIN PASSWORD 'dev_local_only_change_me' CREATEDB;"

cp .env.example .env     # then fill in real values
npx prisma migrate dev   # create schema
npx prisma db seed       # roles, permissions, Super Admin, default catalog

npm run dev              # http://localhost:3000
```

`CREATEDB` on the dev role is needed only so Prisma Migrate can create its
shadow database. Production does not need it (see DEPLOYMENT.md).

## Environment variables

See `.env.example`. `.env` is gitignored and must never be committed.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Session secret — generate with `openssl rand -base64 32` |
| `APP_URL` | Base URL of the app |
| `CLINIC_NAME` | Fallback clinic name (the editable one lives in Settings) |
| `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` | Used once by the seed to create the first login |

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build — also type-checks |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E (needs the dev server + a seeded DB) |
| `npm run db:seed` | Re-run the seed (idempotent — upserts) |
| `npx prisma migrate dev --name <name>` | Create + apply a migration |
| `npx prisma studio` | Browse the database |

E2E tests read the Super Admin credentials from the environment, so source
`.env` first:

```bash
set -a; source .env; set +a
npm run test:e2e
```

## Adding a feature module

Follow the existing shape (see ARCHITECTURE.md). In order:

1. **Schema** — edit `prisma/schema.prisma`, run `npx prisma migrate dev`.
2. **Permissions** — add keys to `src/lib/permissions.ts`, grant them to the
   right roles, re-run `npm run db:seed`. New keys are auto-granted to Super
   Admin.
3. **Validation** — a Zod schema in `src/lib/validation/<module>.ts`.
4. **Actions** — `actions.ts` with `"use server"`. Every action starts with
   `requirePermission(...)`, then parses with Zod, then writes (in a
   transaction if more than one row changes), then `writeAuditLog(...)`.
5. **Pages** — list / new / `[id]` / `[id]/edit`, each calling
   `requirePermission` and passing data into a client form component.
6. **Nav** — add to `src/lib/nav.ts` with the permission that should reveal it.
7. **Tests** — unit tests for any calculation; an E2E test for the workflow.

## Conventions that matter

- **Never trust the client for money.** Recompute totals server-side from the
  submitted items (`src/lib/money.ts`).
- **Never do date math with the server's local timezone.** Use
  `src/lib/date.ts`, which is explicit about Nepal's UTC+5:45.
- **Never hard-delete clinical or financial records.** Archive, cancel, or void.
- **Never rely on hidden UI for access control.** Hiding a button is cosmetic;
  the server action must check the permission too.
- Keep audit metadata to identifiers and amounts — no clinical content.

## Writing E2E tests

The dev database is shared and not reset between runs, so:

- Make test data unique per run (`const stamp = Date.now()`), including names,
  not just codes.
- Scope assertions to the row/card under test
  (`page.getByRole("row", { name: new RegExp(patientName) })`), never a
  page-wide text match that earlier runs could also satisfy.
- After submitting a form that redirects, wait for something that only exists
  on the destination page. Asserting `/billing/.+` is a trap — it also matches
  `/billing/new`, so the assertion passes while the redirect is still in flight
  and the next navigation gets cancelled.

## Troubleshooting

**"Prisma schema validation: datasource property `url` is no longer supported"**
Prisma 7 moved the connection URL to `prisma.config.ts`. It's already set up;
don't add `url` back into `schema.prisma`.

**"Could not create the shadow database"** — the dev role needs `CREATEDB`:
`psql postgres -c "ALTER ROLE pathivara_app CREATEDB;"`

**Prisma client import errors** — the client is generated into
`src/generated/prisma` (gitignored). Run `npx prisma generate`. Import from
`@/generated/prisma/client`, not the folder.

**A script can't see `DATABASE_URL`** — Next.js loads `.env` automatically but
plain scripts don't. Use `tsx --env-file=.env` or `set -a; source .env; set +a`.
