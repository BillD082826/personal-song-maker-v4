#!/bin/bash
set -euo pipefail
PG_DUMP="/Library/PostgreSQL/18/bin/pg_dump"
PG_RESTORE="/Library/PostgreSQL/18/bin/pg_restore"
BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/LyriBop Backups"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
DB_BACKUP="$BACKUP_DIR/LyriBop-database-$TIMESTAMP.dump"
SOURCE_BACKUP="$BACKUP_DIR/LyriBop-source-$TIMESTAMP.tar.gz"
mkdir -p "$BACKUP_DIR"
CREDENTIALS_FILE="$PROJECT_DIR/backup/backup.env"
if [ ! -f "$CREDENTIALS_FILE" ]; then echo "ERROR: Backup credentials file not found."; exit 1; fi
source "$CREDENTIALS_FILE"
"$PG_DUMP" "$LYRIBOP_DB_URL" --format=custom --no-owner --no-privileges --file="$DB_BACKUP"
"$PG_RESTORE" --list "$DB_BACKUP" >/dev/null
tar -czf "$SOURCE_BACKUP" -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"
tar -tzf "$SOURCE_BACKUP" >/dev/null
echo "LyriBop disaster backup completed successfully."
echo "Database: $DB_BACKUP"
echo "Source: $SOURCE_BACKUP"
