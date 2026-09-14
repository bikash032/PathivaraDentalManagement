# Security — Pathivara Dental Clinic Admin System

Last reviewed: 2026-09-14 (Phase 14 security review)

This system holds patient identity and clinical records plus clinic financial
records. This document records how it is protected, what was checked, and the
known limitations that still need attention before/at deployment.

---

## Authentication

- **Passwords** are hashed with bcrypt at cost factor 12. Plaintext passwords
  are never stored or logged.
- **Sessions are database-backed**, not self-contained tokens. On login a
  32-byte random token is generated; the browser gets the raw token in a
  cookie, the database stores only its SHA-256 hash. A stolen database dump
  therefore does not yield usable session tokens.
- **Session cookies** are `httpOnly` (not readable by JavaScript), `sameSite=lax`,
  `path=/`, and `secure` in production. Lifetime is 7 days, fixed from issue
  (no sliding renewal in V1).
- **Deactivation is immediate.** `User.isActive` is checked against the
  database on every request, not cached in the session, so disabling a
  departing staff member's account cuts off their existing sessions at once.
- **Admin password reset deletes all of that user's sessions**, so a reset
  cannot be outlived by an already-open session.
- **Login is rate limited** to 5 failed attempts per email+IP per 15 minutes.
- Failed logins return a single generic message ("Invalid email or password.")
  and do not reveal whether the email exists.

## Authorization

- Permissions are explicit, database-backed rows (`Permission`,
  `RolePermission`), editable per role by a Super Admin.
- **Every server action begins with `requirePermission(...)`** — verified by
  audit across all 22 actions in the codebase. The only actions without a
  permission gate are login (public by design), logout, and change-own-password
  (which independently verifies the user's current password).
- **The UI is never the security boundary.** Hiding a nav item or button is
  cosmetic; the same permission is re-checked server-side in the action and in
  the page that renders it.
- The `proxy.ts` (middleware) redirect is a UX convenience only — it checks
  cookie *presence*, not validity. Real enforcement is `requireUser()` /
  `requirePermission()` on the server. Bypassing the proxy gains nothing.
- API route handlers (`/api/patients/search`) return 401/403 JSON rather than
  redirecting, and check the same permissions.
- The Super Admin role cannot be edited in the Roles UI, preventing an
  accidental self-lockout, and this is enforced server-side as well as hidden
  in the UI.

## Input validation and injection

- All form input is parsed with Zod schemas server-side before it reaches the
  database. Client-side attributes (`required`, `min`) are convenience only.
- **All money totals are recalculated server-side** from submitted line items.
  A tampered client cannot dictate an invoice total or bypass the overpayment
  check.
- Database access goes through Prisma with parameterized queries. The only raw
  SQL in the codebase (`SELECT nextval('patient_code_seq')` /
  `invoice_number_seq`) is a tagged template containing no user input.
- No `dangerouslySetInnerHTML`, `eval`, or `new Function` anywhere in the
  application source — React escapes all rendered values by default.
- Server Actions are protected against CSRF by Next.js's built-in same-origin
  checks on action invocations.

## Data exposure

- Patient data is only served from authenticated, permission-checked server
  components and actions; nothing patient-related is public.
- Error messages shown to users are generic. Business-rule failures use a
  dedicated `BillingRuleError` type whose message is safe to display;
  any other exception is logged server-side and shown to the user as a generic
  failure, so Prisma/schema details never reach the UI.
- **Audit metadata is deliberately minimal** — identifiers, amounts and status
  values only. Clinical notes, diagnoses and prescriptions are never copied
  into audit rows.
- Secrets live only in `.env`, which is gitignored. `.env.example` documents
  the required variables with placeholder values. Verified: no `.env` file is
  tracked by git, and no credentials are hardcoded in source.
- `.gitignore` also blocks `*.sql`, `*.dump`, `/backups`, and `/uploads` so a
  database dump or patient document cannot be committed by accident (with an
  explicit exception for Prisma's own migration SQL, which is schema, not data).

## Known limitations / follow-ups

These are accepted for V1 but should be revisited:

1. **Rate limiting is in-process memory.** It resets on restart and is not
   shared across instances. Fine for one clinic server; needs a shared store
   (e.g. Redis) if the app is ever run as multiple instances.
2. **Permission changes take effect on next login** for affected users,
   because the permission set is resolved per request from the user's role but
   the session itself is not force-refreshed. Account *deactivation* is
   immediate; permission downgrades are not. For an urgent revocation,
   deactivate the account.
3. **Double-booking prevention is application-level** under READ COMMITTED
   isolation, not a database exclusion constraint. Two truly simultaneous
   bookings for the same doctor and slot could in principle both pass. At
   single-clinic booking volume this is acceptable; a Postgres
   `EXCLUDE USING gist` constraint is the permanent fix if it ever matters.
4. **No 2FA.** Worth considering for remote (off-site) access specifically.
5. **File/document upload is not implemented yet.** When it is, it must
   validate type/size/name and must not serve patient documents from a public
   path.
6. **Dependency advisories:** `npm audit` reports issues in Prisma CLI's own
   dev-time dependencies (`mysql2`, `deepmerge-ts`). These are devDependencies
   not shipped in the runtime bundle, and the MySQL driver path is unreachable
   in this PostgreSQL-only project. Re-check when Prisma updates.

## Pre-deployment checklist

- [ ] Generate a fresh `AUTH_SECRET` (`openssl rand -base64 32`) for production
      — do not reuse the development one.
- [ ] Set a strong, unique PostgreSQL password for the app role; the
      development password (`dev_local_only_change_me`) must not reach the
      clinic server.
- [ ] Change the seeded Super Admin password immediately after first login.
- [ ] Serve over HTTPS so the `secure` cookie flag is effective.
- [ ] Confirm PostgreSQL listens only on localhost / the private network — it
      must never be exposed to the public internet.
- [ ] Revoke `CREATEDB` from the app role in production (it is only needed for
      Prisma Migrate's shadow database during development).
- [ ] Verify backups run and a restore has actually been tested (see BACKUP.md).
