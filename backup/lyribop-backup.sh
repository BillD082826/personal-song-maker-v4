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
if "$PSQL" "$LYRIBOP_DB_URL" -v ON_ERROR_STOP=1 \
  -c "INSERT INTO backup_history (backup_status, database_backup, source_backup) VALUES ('success', '$DB_BACKUP', '$SOURCE_BACKUP');" \
  >/dev/null 2>&1; then
  echo "Backup status reported to LyriBop."
else
  echo "WARNING: Backup completed, but status could not be reported to LyriBop." >&2
fi

RETENTION_COUNT=12

if {
  ls -1t "$BACKUP_DIR"/LyriBop-database-*.dump 2>/dev/null | tail -n +$((RETENTION_COUNT + 1)) |
    while IFS= read -r file; do
      rm -f -- "$file"
    done

  ls -1t "$BACKUP_DIR"/LyriBop-source-*.tar.gz 2>/dev/null | tail -n +$((RETENTION_COUNT + 1)) |
    while IFS= read -r file; do
      rm -f -- "$file"
    done
}; then
  echo "Automatic retention cleanup completed. Keeping newest $RETENTION_COUNT backup sets."
else
  echo "WARNING: Backup completed, but automatic retention cleanup encountered an error." >&2
fi

echo "LyriBop disaster backup completed successfully."
echo "Database: $DB_BACKUP"
echo "Source: $SOURCE_BACKUP"
