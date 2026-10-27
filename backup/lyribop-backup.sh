#!/bin/bash
set -euo pipefail
PG_DUMP="/Library/PostgreSQL/18/bin/pg_dump"
PG_RESTORE="/Library/PostgreSQL/18/bin/pg_restore"

PSQL="/Library/PostgreSQL/18/bin/psql"
BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/LyriBop Backups"
PROJECT_DIR="$HOME/Projects/personal-song-maker-v4"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
DB_BACKUP="$BACKUP_DIR/LyriBop-database-$TIMESTAMP.dump"
SOURCE_BACKUP="$BACKUP_DIR/LyriBop-source-$TIMESTAMP.tar.gz"
mkdir -p "$BACKUP_DIR"
CREDENTIALS_FILE="$HOME/.config/lyribop/backup.env"
if [ ! -f "$CREDENTIALS_FILE" ]; then echo "ERROR: Backup credentials file not found."; exit 1; fi
source "$CREDENTIALS_FILE"
"$PG_DUMP" "$LYRIBOP_DB_URL" --format=custom --no-owner --no-privileges --file="$DB_BACKUP"
"$PG_RESTORE" --list "$DB_BACKUP" >/dev/null
tar -czf "$SOURCE_BACKUP" -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"
tar -tzf "$SOURCE_BACKUP" >/dev/null
# Only report once both artifacts are validated and retention has finished.
BACKUP_STATUS="success"
EXIT_STATUS=0
if ! /usr/bin/python3 "$HOME/bin/lyribop-retention.py" "$BACKUP_DIR" --new-set "$TIMESTAMP" --apply; then
  BACKUP_STATUS="success_retention_warning"
  EXIT_STATUS=2
  echo "WARNING: Database and source backups are valid, but retention cleanup failed. Check retained backup sets." >&2
fi

if "$PSQL" "$LYRIBOP_DB_URL" -v ON_ERROR_STOP=1 \
  -v backup_status="$BACKUP_STATUS" -v database_backup="$DB_BACKUP" -v source_backup="$SOURCE_BACKUP" \
  >/dev/null 2>&1 <<'SQL'
INSERT INTO backup_history (backup_status, database_backup, source_backup)
VALUES (:'backup_status', :'database_backup', :'source_backup');
SQL
then
  echo "Backup status reported to LyriBop: $BACKUP_STATUS."
else
  EXIT_STATUS=3
  echo "WARNING: Database and source backups are valid, but their final status could not be reported to LyriBop. Admin may show an older record." >&2
fi

if [ "$EXIT_STATUS" -eq 0 ]; then
  echo "LyriBop disaster backup and retention cleanup completed successfully."
else
  echo "LyriBop backup artifacts validated; follow-up required (exit $EXIT_STATUS)." >&2
fi
echo "Database: $DB_BACKUP"
echo "Source: $SOURCE_BACKUP"
exit "$EXIT_STATUS"
