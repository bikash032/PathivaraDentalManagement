# Backup & Disaster Recovery — Pathivara Dental Clinic

**A backup you have never restored is not a backup.** The procedure below was
run and verified on 2026-09-14 (see "Verification log" at the bottom).

---

## What is backed up

The entire PostgreSQL database: patients, appointments, visits, prescriptions,
invoices, payments, users/roles/permissions, audit log, clinic settings, **and
the ID sequences** (`patient_code_seq`, `invoice_number_seq`) — so after a
recovery, new patient IDs and invoice numbers continue where they left off
instead of colliding with existing records.

Not covered (nothing to cover yet): uploaded patient documents. When file
upload is implemented, the upload directory must be added to this plan.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/backup.sh` | Dump → compress → encrypt → prune old copies |
| `scripts/restore.sh` | Decrypt → restore into a target database |

Both read `DATABASE_URL` from `.env`, and strip Prisma-specific query params
(`?schema=public`) that the Postgres tools don't accept.

### Taking a backup

```bash
BACKUP_PASSPHRASE='<strong passphrase>' ./scripts/backup.sh
```

Environment variables:

- `BACKUP_PASSPHRASE` — **set this in production.** Without it the script still
  runs but writes an *unencrypted* dump and prints a warning. Patient data must
  never leave the clinic unencrypted.
- `BACKUP_DIR` — default `./backups`
- `BACKUP_RETENTION_DAYS` — default `30`; older local backups are pruned

The dump is PostgreSQL custom format (`-Fc`): compressed, and selectively
restorable with `pg_restore`. Files are written `chmod 600`. The script fails
loudly (non-zero exit) if the resulting file is suspiciously small, so a silent
partial failure doesn't masquerade as a good backup.

### Restoring

**Restoring overwrites the target database.** To *verify* a backup, always
restore into a scratch database, never the live one:

```bash
createdb pathivara_restore_test
BACKUP_PASSPHRASE='<passphrase>' ./scripts/restore.sh \
  backups/pathivara-YYYYMMDD-HHMMSS.dump.enc \
  postgresql://pathivara_app:<password>@localhost:5432/pathivara_restore_test

# compare against the live database
psql "<live-url>"    -c 'SELECT count(*) FROM "Patient";'
psql "<restore-url>" -c 'SELECT count(*) FROM "Patient";'

dropdb pathivara_restore_test   # clean up when satisfied
```

For a **real disaster recovery**, restore into the live database instead, then
run `npx prisma migrate deploy` to confirm the schema is at the current
migration, and log in to spot-check recent records.

## Schedule

### Clinic server (Linux) — cron

```cron
# nightly at 11:30 PM Nepal time; log output so failures are visible
30 23 * * * cd /opt/pathivara && BACKUP_PASSPHRASE='<passphrase>' ./scripts/backup.sh >> /var/log/pathivara-backup.log 2>&1
```

### macOS — launchd

Create `~/Library/LaunchAgents/com.pathivara.backup.plist` with a
`StartCalendarInterval` of 23:30 running the same command, then
`launchctl load ~/Library/LaunchAgents/com.pathivara.backup.plist`.

Put `BACKUP_PASSPHRASE` in a root-only file sourced by the job — **not** in the
crontab itself, which is world-readable on some systems.

## Retention and off-site copies

The target shape (per the project plan):

```
Clinic server → PostgreSQL → nightly encrypted dump
                                  ├── local copy   (fast restore, 30 days)
                                  └── off-site copy (disaster recovery)
```

- **Local:** `./backups`, 30 days, pruned automatically.
- **Off-site:** copy the `.enc` files nightly to storage outside the clinic
  building — an external drive rotated home, or object storage. Because the
  file is already AES-256 encrypted before it leaves the machine, the
  destination does not need to be trusted with patient data.
- Keep **monthly** copies for at least a year for financial-record continuity.
- Store `BACKUP_PASSPHRASE` somewhere separate from the backups themselves. If
  the passphrase is lost, the backups are unrecoverable — that is the point,
  but it cuts both ways.

## Testing cadence

- **Monthly:** restore the latest backup into a scratch database and compare
  row counts (the command block above). Takes under five minutes.
- **After any schema migration:** take a fresh backup before deploying, and
  confirm a restore works after.
- Watch for a backup log that stops appearing — silence is the most common way
  backups fail.

## Verification log

| Date | Result |
|---|---|
| 2026-09-14 | Encrypted backup (76K) created, restored into scratch DB. Verified: patients 49/49, invoices 20/20, payments 20/20, users 20/20, permissions 24/24; invoice totals/paid/status preserved exactly; `patient_code_seq` restored at correct value. Scratch DB dropped. |
