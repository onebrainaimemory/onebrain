#!/usr/bin/env bash
# =============================================================================
# deploy-hetzner.sh — OneBrain SSH-based deployment script
#
# Usage:
#   ./scripts/deploy-hetzner.sh <environment> [--host <host>] [--user <user>]
#
# Arguments:
#   environment   One of: control-plane | region-eu | region-global
#
# Options:
#   --host <host>  SSH hostname or IP (falls back to DEPLOY_HOST env var)
#   --user <user>  SSH username       (falls back to DEPLOY_USER env var, default: onebrain)
#   --key  <path>  Path to SSH key    (falls back to DEPLOY_KEY_PATH env var)
#   --blue-green   Use blue-green deployment (zero-downtime swap)
#   --dry-run      Print the remote commands without executing them
#
# Required environment variables (or --options above):
#   DEPLOY_HOST        VPS hostname/IP
#   DEPLOY_USER        SSH user on VPS        (default: onebrain)
#   DEPLOY_KEY_PATH    Path to private SSH key (default: ~/.ssh/id_ed25519)
#
# Examples:
#   DEPLOY_HOST=1.2.3.4 ./scripts/deploy-hetzner.sh control-plane
#   ./scripts/deploy-hetzner.sh region-eu --host 1.2.3.4 --user onebrain
# =============================================================================

set -euo pipefail

# ── colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'
log_info()    { echo -e "${CYAN}[deploy]${RESET} $*"; }
log_ok()      { echo -e "${GREEN}[deploy]${RESET} $*"; }
log_warn()    { echo -e "${YELLOW}[deploy]${RESET} $*"; }
log_error()   { echo -e "${RED}[deploy] ERROR:${RESET} $*" >&2; }

# ── argument parsing ───────────────────────────────────────────────────────────
ENVIRONMENT=""
DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-onebrain}"
DEPLOY_KEY_PATH="${DEPLOY_KEY_PATH:-${HOME}/.ssh/id_ed25519}"
DRY_RUN=false
BLUE_GREEN=false

usage() {
  grep '^#' "$0" | grep -v '#!/' | sed 's/^# \{0,3\}//' | head -30
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    control-plane|region-eu|region-global)
      ENVIRONMENT="$1"; shift ;;
    --host)  DEPLOY_HOST="$2";    shift 2 ;;
    --user)  DEPLOY_USER="$2";    shift 2 ;;
    --key)   DEPLOY_KEY_PATH="$2"; shift 2 ;;
    --blue-green) BLUE_GREEN=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) usage ;;
    *)
      log_error "Unknown argument: $1"
      usage ;;
  esac
done

# ── validation ─────────────────────────────────────────────────────────────────
if [[ -z "${ENVIRONMENT}" ]]; then
  log_error "Environment argument is required."
  usage
fi

if [[ -z "${DEPLOY_HOST}" ]]; then
  log_error "DEPLOY_HOST must be set (env var or --host)."
  exit 1
fi

if [[ ! -f "${DEPLOY_KEY_PATH}" ]] && [[ "${DRY_RUN}" = false ]]; then
  log_error "SSH key not found at: ${DEPLOY_KEY_PATH}"
  exit 1
fi

# ── constants ──────────────────────────────────────────────────────────────────
REPO_DIR="/home/${DEPLOY_USER}/onebrain"
COMPOSE_DIR="${REPO_DIR}/infra/${ENVIRONMENT}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

# Determine which services to build and which health endpoint to check.
case "${ENVIRONMENT}" in
  control-plane)
    BUILD_SERVICES="web"
    HEALTH_CHECK_CMD="docker compose exec -T web wget --spider -q http://localhost:3000"
    RUN_MIGRATIONS=false
    ;;
  region-eu|region-global)
    BUILD_SERVICES="api mcp"
    API_PORT="${API_PORT:-3001}"
    HEALTH_CHECK_CMD="docker compose exec -T api wget --spider -q http://localhost:${API_PORT}/health"
    RUN_MIGRATIONS=true
    ;;
  *)
    log_error "Unknown environment: ${ENVIRONMENT}"
    exit 1
    ;;
esac

# ── SSH helper ─────────────────────────────────────────────────────────────────
ssh_opts=(
  -i "${DEPLOY_KEY_PATH}"
  -o StrictHostKeyChecking=no
  -o ConnectTimeout=15
  -o ServerAliveInterval=30
  -o BatchMode=yes
)

run_remote() {
  local script="$1"
  if [[ "${DRY_RUN}" = true ]]; then
    log_warn "[dry-run] Would execute on ${DEPLOY_USER}@${DEPLOY_HOST}:"
    echo "─────────────────────────────────────────"
    echo "${script}"
    echo "─────────────────────────────────────────"
  else
    ssh "${ssh_opts[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "bash -s" <<< "${script}"
  fi
}

# ── rollback helper ────────────────────────────────────────────────────────────
# Rolls back to the git commit that was HEAD before we pulled, then restarts.
rollback() {
  local prev_sha="$1"
  log_warn "Rolling back to ${prev_sha}..."
  run_remote "
    set -euo pipefail
    cd '${REPO_DIR}'
    git reset --hard '${prev_sha}'
    cd '${COMPOSE_DIR}'
    docker compose up -d --remove-orphans
    echo 'Rollback complete.'
  " || log_error "Rollback also failed — manual intervention required."
}

# ── blue-green deploy ─────────────────────────────────────────────────────────
if [[ "${BLUE_GREEN}" = true ]]; then
  if [[ "${ENVIRONMENT}" = "control-plane" ]]; then
    log_error "Blue-green deployment is only supported for region-eu and region-global."
    exit 1
  fi

  PROJECT_PREFIX="onebrain-${ENVIRONMENT}"
  BLUE_PROJECT="${PROJECT_PREFIX}-blue"
  GREEN_PROJECT="${PROJECT_PREFIX}-green"

  log_info "Blue-green deploying OneBrain [${ENVIRONMENT}] to ${DEPLOY_USER}@${DEPLOY_HOST} (${TIMESTAMP})"

  MIGRATION_BLOCK_BG=""
  if [[ "${RUN_MIGRATIONS}" = true ]]; then
    MIGRATION_BLOCK_BG="
      echo '[blue-green] Running database migrations...'
      docker compose -p '${GREEN_PROJECT}' run --rm migrate
    "
  fi

  BLUE_GREEN_SCRIPT="
set -euo pipefail

echo '[blue-green] Pulling latest code...'
cd '${REPO_DIR}'
git fetch --all --prune
git reset --hard origin/main
NEW_SHA=\"\$(git rev-parse HEAD)\"
echo \"[blue-green] New HEAD: \${NEW_SHA}\"

cd '${COMPOSE_DIR}'

${MIGRATION_BLOCK_BG}

echo '[blue-green] Building and starting green stack...'
docker compose -p '${GREEN_PROJECT}' build --no-cache ${BUILD_SERVICES}
docker compose -p '${GREEN_PROJECT}' up -d --remove-orphans

echo '[blue-green] Waiting for green API to become healthy...'
RETRIES=18
COUNT=0
until docker compose -p '${GREEN_PROJECT}' exec -T api \
  wget --spider -q 'http://localhost:${API_PORT}/health' 2>/dev/null; do
  COUNT=\$((COUNT + 1))
  if [ \"\${COUNT}\" -ge \"\${RETRIES}\" ]; then
    echo '[blue-green] ERROR: Green stack health check failed.'
    docker compose -p '${GREEN_PROJECT}' logs --tail 80 2>&1
    echo '[blue-green] Rolling back: tearing down green stack...'
    docker compose -p '${GREEN_PROJECT}' down --remove-orphans 2>/dev/null || true
    exit 1
  fi
  echo \"[blue-green] Attempt \${COUNT}/\${RETRIES} — waiting 5s...\"
  sleep 5
done

echo '[blue-green] Green stack is healthy. Swapping live pointer...'

# Stop the old blue stack
docker compose -p '${BLUE_PROJECT}' down --remove-orphans 2>/dev/null || true

# Promote green to blue: stop green project, restart as blue
docker compose -p '${GREEN_PROJECT}' down --remove-orphans 2>/dev/null || true
docker compose -p '${BLUE_PROJECT}' up -d --remove-orphans

echo '[blue-green] Verifying blue (promoted) stack health...'
RETRIES=12
COUNT=0
until docker compose -p '${BLUE_PROJECT}' exec -T api \
  wget --spider -q 'http://localhost:${API_PORT}/health' 2>/dev/null; do
  COUNT=\$((COUNT + 1))
  if [ \"\${COUNT}\" -ge \"\${RETRIES}\" ]; then
    echo '[blue-green] ERROR: Promoted blue stack failed health check.'
    docker compose -p '${BLUE_PROJECT}' logs --tail 80 2>&1
    exit 1
  fi
  echo \"[blue-green] Attempt \${COUNT}/\${RETRIES} — waiting 5s...\"
  sleep 5
done

echo '[blue-green] Cleaning up unused Docker images...'
docker image prune -f --filter 'until=24h' >/dev/null 2>&1 || true

echo '[blue-green] Deployment complete.'
docker compose -p '${BLUE_PROJECT}' ps
"

  if [[ "${DRY_RUN}" = false ]]; then
    if ! run_remote "${BLUE_GREEN_SCRIPT}"; then
      log_error "Blue-green deploy failed."
      exit 1
    fi
  else
    run_remote "${BLUE_GREEN_SCRIPT}"
  fi

  log_ok "Blue-green deployment of [${ENVIRONMENT}] completed successfully at ${TIMESTAMP}."
  exit 0
fi

# ── main deploy (standard) ────────────────────────────────────────────────────
log_info "Deploying OneBrain [${ENVIRONMENT}] to ${DEPLOY_USER}@${DEPLOY_HOST} (${TIMESTAMP})"

# Capture the current HEAD on the remote so we can roll back if needed.
PREV_SHA=""
if [[ "${DRY_RUN}" = false ]]; then
  PREV_SHA="$(ssh "${ssh_opts[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "git -C '${REPO_DIR}' rev-parse HEAD 2>/dev/null || echo 'UNKNOWN'" 2>/dev/null || echo 'UNKNOWN')"
  log_info "Previous remote HEAD: ${PREV_SHA}"
fi

MIGRATION_BLOCK=""
if [[ "${RUN_MIGRATIONS}" = true ]]; then
  MIGRATION_BLOCK="
    echo '[deploy] Running database migrations...'
    docker compose run --rm migrate
  "
fi

REMOTE_SCRIPT="
set -euo pipefail

echo '[deploy] Pulling latest code...'
cd '${REPO_DIR}'
git fetch --all --prune
git reset --hard origin/main
NEW_SHA=\"\$(git rev-parse HEAD)\"
echo \"[deploy] New HEAD: \${NEW_SHA}\"

echo '[deploy] Updating Caddy image if needed...'
cd '${COMPOSE_DIR}'
docker compose pull --quiet caddy 2>/dev/null || true

${MIGRATION_BLOCK}

echo '[deploy] Building services: ${BUILD_SERVICES}...'
docker compose build --no-cache ${BUILD_SERVICES}

echo '[deploy] Starting all services...'
docker compose up -d --remove-orphans

echo '[deploy] Waiting for health check...'
RETRIES=18
COUNT=0
until ${HEALTH_CHECK_CMD} 2>/dev/null; do
  COUNT=\$((COUNT + 1))
  if [ \"\${COUNT}\" -ge \"\${RETRIES}\" ]; then
    echo '[deploy] ERROR: Health check failed after '\"\${RETRIES}\"' attempts.'
    docker compose logs --tail 80 2>&1
    exit 1
  fi
  echo \"[deploy] Attempt \${COUNT}/\${RETRIES} — waiting 5s...\"
  sleep 5
done

echo '[deploy] Cleaning up unused Docker images...'
docker image prune -f --filter 'until=24h' >/dev/null 2>&1 || true

echo '[deploy] All services healthy.'
docker compose ps
"

# Run the deploy; roll back on any failure.
if [[ "${DRY_RUN}" = false ]]; then
  if ! run_remote "${REMOTE_SCRIPT}"; then
    log_error "Deploy failed."
    if [[ "${PREV_SHA}" != "UNKNOWN" ]] && [[ -n "${PREV_SHA}" ]]; then
      rollback "${PREV_SHA}"
    fi
    exit 1
  fi
else
  run_remote "${REMOTE_SCRIPT}"
fi

log_ok "Deployment of [${ENVIRONMENT}] completed successfully at ${TIMESTAMP}."
