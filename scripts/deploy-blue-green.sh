#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# Blue-Green Deployment for OneBrain
#
# Strategy:
#   1. Deploy new version to "green" project
#   2. Health-check green
#   3. Switch Caddy upstream to green
#   4. Stop blue
#   5. Rename green -> blue
#
# Usage:
#   ./scripts/deploy-blue-green.sh [region-eu|region-global]
#
# Prerequisites:
#   - Docker Compose v2
#   - Caddy running in the control-plane stack
#   - Environment variables loaded from .env
# ─────────────────────────────────────────────────────────

REGION="${1:-region-eu}"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_DIR="${REPO_DIR}/infra/${REGION}"
HEALTH_PORT="${API_PORT:-3001}"
MAX_RETRIES=15
RETRY_INTERVAL=5

if [ ! -f "${COMPOSE_DIR}/docker-compose.yml" ]; then
  echo "[ERROR] Compose file not found: ${COMPOSE_DIR}/docker-compose.yml"
  exit 1
fi

echo "[blue-green] Starting blue-green deploy for ${REGION}..."

# ── Step 1: Deploy new version as "green" ───────────────
echo "[blue-green] Building and starting green stack..."
cd "${COMPOSE_DIR}"
docker compose -p "onebrain-${REGION}-green" build --no-cache api mcp
docker compose -p "onebrain-${REGION}-green" up -d --remove-orphans

# ── Step 2: Health check green ──────────────────────────
echo "[blue-green] Waiting for green API to become healthy..."
GREEN_API_CONTAINER="onebrain-${REGION}-green-api-1"
COUNT=0

until docker exec "${GREEN_API_CONTAINER}" \
  wget --spider -q "http://localhost:${HEALTH_PORT}/health" 2>/dev/null; do
  COUNT=$((COUNT + 1))
  if [ "${COUNT}" -ge "${MAX_RETRIES}" ]; then
    echo "[blue-green] ERROR: Green API failed health check after ${MAX_RETRIES} attempts."
    echo "[blue-green] Rolling back: stopping green stack..."
    docker compose -p "onebrain-${REGION}-green" down
    exit 1
  fi
  echo "[blue-green] Health check attempt ${COUNT}/${MAX_RETRIES} — waiting ${RETRY_INTERVAL}s..."
  sleep "${RETRY_INTERVAL}"
done

echo "[blue-green] Green API is healthy."

# ── Step 3: Switch Caddy upstream to green ──────────────
echo "[blue-green] Switching Caddy upstream to green..."
CADDY_CONTAINER="$(docker ps --filter name=caddy --format '{{.Names}}' | head -1)"

if [ -n "${CADDY_CONTAINER}" ]; then
  GREEN_IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${GREEN_API_CONTAINER}")"

  if [ -n "${GREEN_IP}" ]; then
    # Reload Caddy config to point to green
    docker exec "${CADDY_CONTAINER}" caddy reload \
      --config /etc/caddy/Caddyfile 2>/dev/null || true
    echo "[blue-green] Caddy notified of upstream change."
  fi
else
  echo "[blue-green] WARNING: Caddy container not found. Skipping upstream switch."
fi

# ── Step 4: Stop blue stack ─────────────────────────────
echo "[blue-green] Stopping blue (old) stack..."
docker compose -p "onebrain-${REGION}-blue" down 2>/dev/null || true

# ── Step 5: Rename green -> blue ────────────────────────
echo "[blue-green] Promoting green to blue..."
docker compose -p "onebrain-${REGION}-green" down
docker compose -p "onebrain-${REGION}-blue" up -d --remove-orphans

echo "[blue-green] Deployment complete. ${REGION} is now running the new version."
docker compose -p "onebrain-${REGION}-blue" ps
