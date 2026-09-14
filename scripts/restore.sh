#!/usr/bin/env bash
#
# Restores a backup created by scripts/backup.sh into a target database.
#
# Usage:  ./scripts/restore.sh <backup-file> <target-database-url>
#
# Example (restore-test into a scratch database — the safe way to verify a backup):
#   createdb pathivara_restore_test
#   ./scripts/restore.sh backups/pathivara-20260914-120000.dump.enc \
#       postgresql://pathivara_app:pass@localhost:5432/pathivara_restore_test
#
# NOTE: restoring into a database DROPS AND REPLACES its contents. Never point
# this at the live clinic database unless you are deliberately recovering it.

set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_URL="${2:-}"

if [ -z "$BACKUP_FILE" ] || [ -z "$TARGET_URL" ]; then
  echo "Usage: $0 <backup-file> <target-database-url>" >&2
  exit 64
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: backup file not found: $BACKUP_FILE" >&2
  exit 66
fi

# Strip Prisma-specific query params (e.g. ?schema=public) that pg_restore rejects
PG_URL="${TARGET_URL%%\?*}"

echo "[restore] target: $PG_URL"
echo "[restore] source: $BACKUP_FILE"

TMP_FILE="$(mktemp "${TMPDIR:-/tmp}/pathivara-restore.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT

case "$BACKUP_FILE" in
  *.enc)
    : "${BACKUP_PASSPHRASE:?backup is encrypted — set BACKUP_PASSPHRASE to restore it}"
    echo "[restore] decrypting…"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
      -in "$BACKUP_FILE" -out "$TMP_FILE" -pass env:BACKUP_PASSPHRASE
    ;;
  *)
    cp "$BACKUP_FILE" "$TMP_FILE"
    ;;
esac

echo "[restore] restoring…"
# --clean --if-exists drops existing objects first so the restore is a true
# replacement rather than a merge into whatever is already there.
pg_restore --dbname="$PG_URL" --clean --if-exists --no-owner --no-privileges "$TMP_FILE"

echo "[restore] completed at $(date)"
echo "[restore] verify with: psql \"$PG_URL\" -c 'SELECT count(*) FROM \"Patient\";'"
