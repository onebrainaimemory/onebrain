#!/bin/bash
# Publish @onebrain/mcp to npm
# Usage: ./scripts/publish-mcp.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$SCRIPT_DIR/../apps/mcp"

echo "=== @onebrain/mcp npm publish ==="
echo ""

# Check npm login
if ! npm whoami &>/dev/null; then
  echo "Not logged in to npm. Running npm login..."
  echo ""
  npm login
fi

WHOAMI=$(npm whoami)
echo "Logged in as: $WHOAMI"
echo ""

# Check if @onebrain org exists, create if not
echo "Checking @onebrain npm org..."
if npm org ls onebrain &>/dev/null 2>&1; then
  echo "Org @onebrain exists."
else
  echo "Creating @onebrain org on npm..."
  npm org create onebrain "$WHOAMI" 2>/dev/null || true
fi
echo ""

# Build
echo "Building MCP package..."
cd "$MCP_DIR"
pnpm run clean
pnpm run build
echo ""

# Show what will be published
echo "Package contents:"
npm pack --dry-run 2>&1
echo ""

# Confirm
read -p "Publish @onebrain/mcp@$(node -p "require('./package.json').version") to npm? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Publish
npm publish --access public
echo ""
echo "Published! Users can now run:"
echo "  npx -y @onebrain/mcp"
