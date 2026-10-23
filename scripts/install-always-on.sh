#!/usr/bin/env bash
# Installs systemd --user units so the web server (and, if configured, a Cloudflare named
# tunnel) start at boot and restart on crash. See docs/ALWAYS_ON.md.
#
# Run from a shell where `node`/`pnpm` resolve to the runtime the server should use
# (e.g. after `conda activate ecgweb`), or set NODE_BIN / PNPM_BIN / CLOUDFLARED_BIN.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
PNPM_BIN="${PNPM_BIN:-$(command -v pnpm || true)}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$(command -v cloudflared || true)}"
UNIT_DIR="$HOME/.config/systemd/user"

if [ -z "$NODE_BIN" ] || [ -z "$PNPM_BIN" ]; then
  echo "node/pnpm not found. Activate the env first (conda activate ecgweb) or set NODE_BIN/PNPM_BIN." >&2
  exit 1
fi

if [ ! -f "$APP_DIR/.next/BUILD_ID" ]; then
  echo "No production build yet. Run 'pnpm build' in $APP_DIR first." >&2
  exit 1
fi

if [ ! -f "$APP_DIR/.env.local" ] || grep -q "change-me" "$APP_DIR/.env.local"; then
  echo "WARNING: .env.local missing or JWT_SECRET still the example value — set a real secret." >&2
fi

mkdir -p "$UNIT_DIR"

sed -e "s|@APP_DIR@|$APP_DIR|g" \
    -e "s|@NODE_DIR@|$(dirname "$NODE_BIN")|g" \
    -e "s|@PNPM_BIN@|$PNPM_BIN|g" \
    "$APP_DIR/deploy/ecg-web.service" > "$UNIT_DIR/ecg-web.service"
units=(ecg-web.service)

if [ -f "$HOME/.cloudflared/config.yml" ] && [ -n "$CLOUDFLARED_BIN" ]; then
  sed -e "s|@CLOUDFLARED_BIN@|$CLOUDFLARED_BIN|g" \
      "$APP_DIR/deploy/ecg-tunnel.service" > "$UNIT_DIR/ecg-tunnel.service"
  units+=(ecg-tunnel.service)
else
  echo "Skipping ecg-tunnel.service (no ~/.cloudflared/config.yml or cloudflared not found)."
fi

systemctl --user daemon-reload
systemctl --user enable "${units[@]}"

echo
echo "Installed + enabled: ${units[*]}"
echo "Next:"
echo "  1. Stop any server you started by hand on port 3000 (Ctrl+C in that terminal)."
echo "  2. systemctl --user start ${units[*]}"
echo "  3. loginctl enable-linger \$USER   # start at boot without logging in"
echo "  Logs: journalctl --user -u ecg-web -f"
