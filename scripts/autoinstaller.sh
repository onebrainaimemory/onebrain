#!/usr/bin/env bash
# =============================================================================
# autoinstaller.sh — OneBrain initial VPS setup
#
# Run once on a fresh Hetzner VPS (Ubuntu 22.04 LTS) to:
#   1. Harden SSH (key-only, no root login)
#   2. Configure ufw firewall (ports 22, 80, 443 only)
#   3. Install Docker + Docker Compose plugin
#   4. Enable automatic security updates
#   5. Create the deploy user with sudo privileges
#   6. Clone the OneBrain repository
#   7. Create .env files from .env.example templates
#   8. Perform initial docker compose up for all environments
#   9. Write a lock file so the script cannot be run a second time
#
# Usage (run as root on the VPS):
#   curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/onebrain/main/scripts/autoinstaller.sh \
#     | bash -s -- --repo https://github.com/YOUR_ORG/onebrain.git \
#                  --domain onebrain.rocks \
#                  --deploy-user onebrain
#
# Options:
#   --repo          Git repository URL (required)
#   --branch        Branch to clone    (default: main)
#   --domain        Primary domain     (required for Caddy)
#   --deploy-user   OS user to create  (default: onebrain)
#   --ssh-pubkey    Path to authorised SSH public key to install for deploy user
#                   (defaults to /root/.ssh/authorized_keys if it exists)
#   --skip-docker   Skip Docker installation (if already installed)
#   --skip-clone    Skip git clone (if repo already present)
#   --environments  Comma-separated list of environments to start
#                   (default: control-plane,region-eu)
#
# Prerequisites:
#   - Ubuntu 22.04 LTS or newer
#   - Run as root (or via sudo)
#   - SSH public key already installed in /root/.ssh/authorized_keys
#
# IMPORTANT: After this script finishes, copy your .env values into:
#   ~/onebrain/infra/control-plane/.env
#   ~/onebrain/infra/region-eu/.env
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ── colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; RESET='\033[0m'

log_info()  { echo -e "${CYAN}[installer]${RESET} $*"; }
log_ok()    { echo -e "${GREEN}[installer]${RESET} $*"; }
log_warn()  { echo -e "${YELLOW}[installer]${RESET} $*"; }
log_error() { echo -e "${RED}[installer] ERROR:${RESET} $*" >&2; }
log_step()  { echo -e "\n${BOLD}══════════════════════════════════════════════${RESET}"; echo -e "${BOLD} $*${RESET}"; echo -e "${BOLD}══════════════════════════════════════════════${RESET}"; }

die() { log_error "$*"; exit 1; }

# ── idempotency lock ───────────────────────────────────────────────────────────
LOCK_FILE="/etc/onebrain/.installed"
if [[ -f "${LOCK_FILE}" ]]; then
  log_warn "Lock file ${LOCK_FILE} exists — installer has already run."
  log_warn "Delete ${LOCK_FILE} only if you intentionally want to re-run setup."
  exit 0
fi

# ── argument parsing ───────────────────────────────────────────────────────────
REPO_URL=""
BRANCH="main"
DOMAIN=""
DEPLOY_USER="onebrain"
SSH_PUBKEY_PATH=""
SKIP_DOCKER=false
SKIP_CLONE=false
ENVIRONMENTS="control-plane,region-eu"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)          REPO_URL="$2";       shift 2 ;;
    --branch)        BRANCH="$2";         shift 2 ;;
    --domain)        DOMAIN="$2";         shift 2 ;;
    --deploy-user)   DEPLOY_USER="$2";    shift 2 ;;
    --ssh-pubkey)    SSH_PUBKEY_PATH="$2"; shift 2 ;;
    --skip-docker)   SKIP_DOCKER=true;    shift ;;
    --skip-clone)    SKIP_CLONE=true;     shift ;;
    --environments)  ENVIRONMENTS="$2";   shift 2 ;;
    *)               die "Unknown argument: $1 (use --help for usage)" ;;
  esac
done

# ── validation ─────────────────────────────────────────────────────────────────
[[ -z "${REPO_URL}" ]]  && die "--repo is required."
[[ -z "${DOMAIN}" ]]    && die "--domain is required."
[[ "${EUID}" -ne 0 ]]   && die "This script must be run as root."

# Resolve SSH public key source
if [[ -z "${SSH_PUBKEY_PATH}" ]]; then
  SSH_PUBKEY_PATH="/root/.ssh/authorized_keys"
fi
[[ -f "${SSH_PUBKEY_PATH}" ]] || die "SSH public key file not found: ${SSH_PUBKEY_PATH}"

# ── constants ──────────────────────────────────────────────────────────────────
REPO_DIR="/home/${DEPLOY_USER}/onebrain"
LOG_FILE="/var/log/onebrain-install.log"
UBUNTU_CODENAME="$(lsb_release -cs 2>/dev/null || echo 'jammy')"

# Redirect all output to log file as well
exec > >(tee -a "${LOG_FILE}") 2>&1

log_step "OneBrain VPS Installer — $(date -u)"
log_info "Repo:          ${REPO_URL} (branch: ${BRANCH})"
log_info "Domain:        ${DOMAIN}"
log_info "Deploy user:   ${DEPLOY_USER}"
log_info "Environments:  ${ENVIRONMENTS}"

# ── Step 1: System update ──────────────────────────────────────────────────────
log_step "Step 1: System update"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl \
  ca-certificates \
  gnupg \
  git \
  ufw \
  unattended-upgrades \
  apt-transport-https \
  lsb-release \
  wget
log_ok "System packages up to date."

# ── Step 2: Automatic security updates ────────────────────────────────────────
log_step "Step 2: Automatic security updates"
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
log_ok "Automatic security updates configured."

# ── Step 3: Install Docker ─────────────────────────────────────────────────────
log_step "Step 3: Docker installation"
if [[ "${SKIP_DOCKER}" = true ]]; then
  log_warn "Skipping Docker installation (--skip-docker)."
else
  if command -v docker &>/dev/null; then
    log_warn "Docker already installed: $(docker --version)"
  else
    log_info "Adding Docker apt repository..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/ubuntu/gpg" \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list

    apt-get update -qq
    apt-get install -y -qq \
      docker-ce \
      docker-ce-cli \
      containerd.io \
      docker-buildx-plugin \
      docker-compose-plugin

    systemctl enable docker
    systemctl start docker
    log_ok "Docker installed: $(docker --version)"
    log_ok "Docker Compose: $(docker compose version)"
  fi
fi

# ── Step 4: Create deploy user ─────────────────────────────────────────────────
log_step "Step 4: Create deploy user (${DEPLOY_USER})"
if id "${DEPLOY_USER}" &>/dev/null; then
  log_warn "User ${DEPLOY_USER} already exists."
else
  useradd \
    --create-home \
    --shell /bin/bash \
    --groups sudo,docker \
    --comment "OneBrain deploy user" \
    "${DEPLOY_USER}"
  log_ok "User ${DEPLOY_USER} created."
fi

# Ensure docker group membership (idempotent)
usermod -aG docker "${DEPLOY_USER}" 2>/dev/null || true

# Install SSH public key for the deploy user
DEPLOY_USER_SSH_DIR="/home/${DEPLOY_USER}/.ssh"
mkdir -p "${DEPLOY_USER_SSH_DIR}"
cp "${SSH_PUBKEY_PATH}" "${DEPLOY_USER_SSH_DIR}/authorized_keys"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_USER_SSH_DIR}"
chmod 700 "${DEPLOY_USER_SSH_DIR}"
chmod 600 "${DEPLOY_USER_SSH_DIR}/authorized_keys"
log_ok "SSH authorized_keys installed for ${DEPLOY_USER}."

# ── Step 5: Harden SSH ─────────────────────────────────────────────────────────
log_step "Step 5: SSH hardening"
SSHD_CONFIG="/etc/ssh/sshd_config"
# Back up original config
cp "${SSHD_CONFIG}" "${SSHD_CONFIG}.bak.$(date +%s)"

# Apply hardened settings
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/'              "${SSHD_CONFIG}"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "${SSHD_CONFIG}"
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/'   "${SSHD_CONFIG}"
sed -i 's/^#\?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' "${SSHD_CONFIG}"
sed -i 's/^#\?UsePAM.*/UsePAM no/'                               "${SSHD_CONFIG}"
sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/'                  "${SSHD_CONFIG}"
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/'                      "${SSHD_CONFIG}"
sed -i 's/^#\?LoginGraceTime.*/LoginGraceTime 30/'                "${SSHD_CONFIG}"

# Verify config before restarting
sshd -t || die "SSH config validation failed — check ${SSHD_CONFIG}."
systemctl restart sshd
log_ok "SSH hardened: key-only authentication, root login disabled."

# ── Step 6: Configure ufw firewall ────────────────────────────────────────────
log_step "Step 6: Firewall (ufw)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP (Caddy redirect to HTTPS)'
ufw allow 443/tcp  comment 'HTTPS'
ufw allow 443/udp  comment 'HTTPS/QUIC'
ufw --force enable
ufw status verbose
log_ok "Firewall active: ports 22, 80, 443 open."

# ── Step 7: Clone repository ───────────────────────────────────────────────────
log_step "Step 7: Clone repository"
if [[ "${SKIP_CLONE}" = true ]]; then
  log_warn "Skipping git clone (--skip-clone)."
elif [[ -d "${REPO_DIR}/.git" ]]; then
  log_warn "Repository already present at ${REPO_DIR} — pulling latest."
  sudo -u "${DEPLOY_USER}" git -C "${REPO_DIR}" fetch --all --prune
  sudo -u "${DEPLOY_USER}" git -C "${REPO_DIR}" reset --hard "origin/${BRANCH}"
else
  sudo -u "${DEPLOY_USER}" git clone \
    --branch "${BRANCH}" \
    --depth 1 \
    "${REPO_URL}" \
    "${REPO_DIR}"
  log_ok "Repository cloned to ${REPO_DIR}."
fi

# ── Step 8: Create .env files from .env.example templates ─────────────────────
log_step "Step 8: Configure .env files"
create_env() {
  local env_dir="$1"
  local example="${REPO_DIR}/${env_dir}/.env.example"
  local target="${REPO_DIR}/${env_dir}/.env"

  if [[ -f "${target}" ]]; then
    log_warn ".env already exists at ${target} — skipping to preserve secrets."
    return
  fi

  if [[ -f "${example}" ]]; then
    sudo -u "${DEPLOY_USER}" cp "${example}" "${target}"
    # Inject domain into .env
    sed -i "s|DOMAIN=.*|DOMAIN=${DOMAIN}|" "${target}" 2>/dev/null || true
    log_ok "Created ${target} from .env.example."
    log_warn "ACTION REQUIRED: Edit ${target} and fill in all secret values."
  else
    log_warn ".env.example not found at ${example} — create ${target} manually."
  fi
}

IFS=',' read -ra ENVS <<< "${ENVIRONMENTS}"
for env in "${ENVS[@]}"; do
  create_env "infra/${env}"
done

# ── Step 9: Initial Docker Compose up ─────────────────────────────────────────
log_step "Step 9: Initial docker compose up"
for env in "${ENVS[@]}"; do
  COMPOSE_DIR="${REPO_DIR}/infra/${env}"
  ENV_FILE="${COMPOSE_DIR}/.env"

  if [[ ! -f "${ENV_FILE}" ]]; then
    log_warn "No .env found for ${env} — skipping docker compose up."
    log_warn "Fill in ${ENV_FILE} then run: cd ${COMPOSE_DIR} && docker compose up -d"
    continue
  fi

  log_info "Starting ${env}..."
  cd "${COMPOSE_DIR}"

  # Run migrations before starting app services (region only)
  if [[ "${env}" != "control-plane" ]]; then
    sudo -u "${DEPLOY_USER}" docker compose run --rm migrate 2>&1 \
      || log_warn "Migrations failed for ${env} — check DATABASE_URL in .env."
  fi

  sudo -u "${DEPLOY_USER}" docker compose up -d --build --remove-orphans
  log_ok "${env} started."
  sudo -u "${DEPLOY_USER}" docker compose ps
done

# ── Step 10: Lock installer ────────────────────────────────────────────────────
log_step "Step 10: Lock installer"
mkdir -p /etc/onebrain
cat > "${LOCK_FILE}" << EOF
installed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
repo=${REPO_URL}
branch=${BRANCH}
domain=${DOMAIN}
deploy_user=${DEPLOY_USER}
environments=${ENVIRONMENTS}
EOF
chmod 644 "${LOCK_FILE}"
log_ok "Lock file written to ${LOCK_FILE}."

# ── Done ───────────────────────────────────────────────────────────────────────
log_step "Installation complete"
log_ok "OneBrain has been installed on this server."
echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo "  1. Review and complete your .env files:"
for env in "${ENVS[@]}"; do
  echo "       ${REPO_DIR}/infra/${env}/.env"
done
echo "  2. Restart services after editing .env:"
for env in "${ENVS[@]}"; do
  echo "       cd ${REPO_DIR}/infra/${env} && docker compose up -d"
done
echo "  3. Verify all services:"
echo "       docker compose ps"
echo "  4. Check application health:"
echo "       curl -s https://${DOMAIN}/api/health"
echo ""
echo "  Install log: ${LOG_FILE}"
