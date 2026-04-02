#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# PostgreSQL Backup Script for OneBrain
#
# Creates compressed pg_dump backups with automatic rotation:
#   - Daily:   keep last 30
#   - Weekly:  keep last 12 (Sundays)
#   - Monthly: keep last 6  (1st of month)
#
# Optional: upload to S3-compatible storage.
#
# Usage:
#   ./scripts/backup-postgres.sh
#
# Environment variables:
#   DATABASE_URL    - PostgreSQL connection string (required)
#   BACKUP_DIR      - Backup destination (default: /var/backups/onebrain)
#   AWS_S3_BUCKET   - S3 bucket for remote backups (optional)
#   AWS_S3_ENDPOINT - Custom S3 endpoint, e.g. Hetzner (optional)
#
# Crontab examples:
#   # Daily at 02:00 UTC
#   0 2 * * * /opt/onebrain/scripts/backup-postgres.sh
#
#   # Weekly on Sunday at 03:00 UTC
#   0 3 * * 0 /opt/onebrain/scripts/backup-postgres.sh
# ─────────────────────────────────────────────────────────

DATABASE_URL="${DATABASE_URL:?DATABASE_URL environment variable is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/onebrain}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
DAY_OF_WEEK=$(date -u +"%u")  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date -u +"%d")

DAILY_DIR="${BACKUP_DIR}/daily"
WEEKLY_DIR="${BACKUP_DIR}/weekly"
MONTHLY_DIR="${BACKUP_DIR}/monthly"

# Create backup directories
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}" "${MONTHLY_DIR}"

FILENAME="onebrain_${TIMESTAMP}.sql.gz"
DAILY_PATH="${DAILY_DIR}/${FILENAME}"

echo "[backup] Starting PostgreSQL backup..."
echo "[backup] Timestamp: ${TIMESTAMP}"

# ── Step 1: Create daily backup ────────────────────────
pg_dump "${DATABASE_URL}" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip > "${DAILY_PATH}"

FILESIZE=$(du -h "${DAILY_PATH}" | cut -f1)
echo "[backup] Daily backup created: ${DAILY_PATH} (${FILESIZE})"

# ── Step 2: Copy to weekly (Sundays) ──────────────────
if [ "${DAY_OF_WEEK}" = "7" ]; then
  cp "${DAILY_PATH}" "${WEEKLY_DIR}/${FILENAME}"
  echo "[backup] Weekly backup saved."
fi

# ── Step 3: Copy to monthly (1st of month) ────────────
if [ "${DAY_OF_MONTH}" = "01" ]; then
  cp "${DAILY_PATH}" "${MONTHLY_DIR}/${FILENAME}"
  echo "[backup] Monthly backup saved."
fi

# ── Step 4: Rotate old backups ─────────────────────────
rotate_backups() {
  local dir="$1"
  local keep="$2"
  local count

  count=$(ls -1 "${dir}"/*.sql.gz 2>/dev/null | wc -l)
  if [ "${count}" -gt "${keep}" ]; then
    local to_delete=$((count - keep))
    ls -1t "${dir}"/*.sql.gz | tail -n "${to_delete}" | while read -r file; do
      rm -f "${file}"
      echo "[backup] Rotated: ${file}"
    done
  fi
}

rotate_backups "${DAILY_DIR}" 30
rotate_backups "${WEEKLY_DIR}" 12
rotate_backups "${MONTHLY_DIR}" 6

echo "[backup] Rotation complete."

# ── Step 5: Optional S3 upload ─────────────────────────
if [ -n "${AWS_S3_BUCKET:-}" ]; then
  S3_PATH="s3://${AWS_S3_BUCKET}/backups/${FILENAME}"
  S3_ARGS=""

  if [ -n "${AWS_S3_ENDPOINT:-}" ]; then
    S3_ARGS="--endpoint-url ${AWS_S3_ENDPOINT}"
  fi

  if command -v aws >/dev/null 2>&1; then
    # shellcheck disable=SC2086
    aws s3 cp "${DAILY_PATH}" "${S3_PATH}" ${S3_ARGS}
    echo "[backup] Uploaded to S3: ${S3_PATH}"
  else
    echo "[backup] WARNING: AWS CLI not installed. Skipping S3 upload."
  fi
fi

echo "[backup] Backup complete."
