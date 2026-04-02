#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# Health Check Script for OneBrain
#
# Checks the /health endpoint and optionally sends an
# email alert if the service is down.
#
# Usage:
#   ./scripts/health-check.sh [url] [alert-email]
#
# Crontab example (every 5 minutes):
#   */5 * * * * /opt/onebrain/scripts/health-check.sh \
#     https://api.onebrain.rocks/health admin@onebrain.rocks
# ─────────────────────────────────────────────────────────

HEALTH_URL="${1:-http://localhost:3001/health}"
ALERT_EMAIL="${2:-}"
TIMEOUT=10
MAX_RETRIES=3
RETRY_DELAY=5

check_health() {
  local response
  local http_code

  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time "${TIMEOUT}" \
    "${HEALTH_URL}" 2>/dev/null || echo "000")

  if [ "${http_code}" = "200" ]; then
    response=$(curl -s --max-time "${TIMEOUT}" "${HEALTH_URL}" 2>/dev/null)
    echo "${response}"
    return 0
  fi

  return 1
}

# Retry loop
SUCCESS=false
for i in $(seq 1 "${MAX_RETRIES}"); do
  if check_health; then
    SUCCESS=true
    break
  fi
  echo "[health-check] Attempt ${i}/${MAX_RETRIES} failed. Retrying in ${RETRY_DELAY}s..."
  sleep "${RETRY_DELAY}"
done

if [ "${SUCCESS}" = true ]; then
  echo "[health-check] OK — ${HEALTH_URL} is healthy."
  exit 0
fi

# Alert on failure
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
MESSAGE="[ALERT] OneBrain health check FAILED at ${TIMESTAMP}. URL: ${HEALTH_URL}"

echo "${MESSAGE}"

if [ -n "${ALERT_EMAIL}" ]; then
  if command -v mail >/dev/null 2>&1; then
    echo "${MESSAGE}" | mail -s "OneBrain Health Check FAILED" "${ALERT_EMAIL}"
    echo "[health-check] Alert email sent to ${ALERT_EMAIL}."
  else
    echo "[health-check] WARNING: 'mail' command not available. Cannot send alert."
  fi
fi

exit 1
