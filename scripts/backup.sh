#!/usr/bin/env bash
#
# Creates a compressed, encrypted PostgreSQL backup of the clinic database.
#
# Usage:  ./scripts/backup.sh
# Env:    reads DATABASE_URL from .env (or the environment)
#         BACKUP_DIR         where to write backups (default: ./backups)
#         BACKUP_PASSPHRASE  if set, the dump is encrypted with it
#         BACKUP_RETENTION_DAYS  delete local backups older than this (default: 30)
#
# Exit codes: 0 ok, non-zero on any failure (so cron/launchd reports it).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env without exporting it to child processes unnecessarily
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL is not set — cannot back up}"

# Prisma's URL carries params pg_dump doesn't understand (e.g. ?schema=public),
# so strip the query string before handing the URL to Postgres tools.
PG_URL="${DATABASE_URL%%\?*}"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BASENAME="pathivara-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[backup] starting at $(date)"

# -Fc = custom format: compressed, and restorable selectively with pg_restore
TMP_FILE="$(mktemp "${TMPDIR:-/tmp}/pathivara-backup.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT

pg_dump --dbname="$PG_URL" --format=custom --no-owner --no-privileges --file="$TMP_FILE"

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  OUT="$BACKUP_DIR/${BASENAME}.enc"
  # AES-256 with a key derived from the passphrase (PBKDF2)
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -in "$TMP_FILE" -out "$OUT" -pass env:BACKUP_PASSPHRASE
  echo "[backup] wrote encrypted backup: $OUT"
else
  OUT="$BACKUP_DIR/$BASENAME"
  cp "$TMP_FILE" "$OUT"
  echo "[backup] WARNING: BACKUP_PASSPHRASE not set — backup is NOT encrypted."
  echo "[backup] wrote backup: $OUT"
fi

chmod 600 "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup] size: $SIZE"

# A zero-byte or suspiciously tiny dump means something went wrong.
MIN_BYTES=1024
ACTUAL_BYTES="$(wc -c < "$OUT" | tr -d ' ')"
if [ "$ACTUAL_BYTES" -lt "$MIN_BYTES" ]; then
  echo "[backup] ERROR: backup is only ${ACTUAL_BYTES} bytes — treating as failed." >&2
  exit 1
fi

# Prune old local backups
find "$BACKUP_DIR" -name 'pathivara-*.dump*' -type f -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete \
  | sed 's/^/[backup] pruned: /' || true

echo "[backup] completed successfully at $(date)"
