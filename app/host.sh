#!/usr/bin/env bash
# Run Monster Lab on this computer and share it with the class through a temporary
# Cloudflare link (a "quick tunnel": no account needed). Ctrl-C stops both.
#
#   ./host.sh          optional: PORT=3000 DATA_DIR=./data ADMIN_KEY=...
#
# The session lives in DATA_DIR, so running it again picks up where you were.
# The link changes each run; the teacher key does not.
set -euo pipefail
cd "$(dirname "$0")"

export PORT="${PORT:-3000}" DATA_DIR="${DATA_DIR:-./data}"
export HOST=127.0.0.1 # only the tunnel reaches the app, not the local network
CLOUDFLARED=bin/cloudflared
LOGS=$(mktemp -d "${TMPDIR:-/tmp}/monster-lab.XXXXXX")
APP='' TUNNEL=''

fail() { echo "$*" >&2; exit 1; }

stop() {
  for pid in $TUNNEL $APP; do kill "$pid" 2>/dev/null || true; done # the app saves the session first
  wait
}
trap stop EXIT
trap 'echo; echo "Stopping..."; exit 130' INT TERM

# ---------- Tools ----------

command -v node >/dev/null || fail "Needs Node 22 or newer: https://nodejs.org"
[ "$(node -p 'parseInt(process.versions.node)')" -ge 22 ] || fail "Needs Node 22 or newer (this is $(node -v))."
command -v git >/dev/null || fail "Needs Git 2.45 or newer: https://git-scm.com"
IFS=. read -r major minor _ <<<"$(git --version | awk '{print $3}')"
((major > 2 || (major == 2 && minor >= 45))) || fail "Needs Git 2.45 or newer (this is $major.$minor). On a Mac: brew install git"
[ -d node_modules ] || npm ci --omit=dev

if [ ! -x "$CLOUDFLARED" ]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) asset=cloudflared-linux-amd64 ;;
    Linux-aarch64 | Linux-arm64) asset=cloudflared-linux-arm64 ;;
    Darwin-x86_64) asset=cloudflared-darwin-amd64.tgz ;;
    Darwin-arm64) asset=cloudflared-darwin-arm64.tgz ;;
    *) fail "No cloudflared download for $(uname -sm). Put a cloudflared binary at $CLOUDFLARED." ;;
  esac
  echo "Downloading cloudflared (only once)..."
  url=https://github.com/cloudflare/cloudflared/releases/latest/download/$asset
  case $asset in
    *.tgz) curl -fsSL "$url" | tar -xzf - -C "$LOGS" ;;
    *) curl -fsSL -o "$LOGS/cloudflared" "$url" ;;
  esac
  chmod +x "$LOGS/cloudflared"
  mkdir -p bin && mv "$LOGS/cloudflared" "$CLOUDFLARED"
fi

# ---------- The app ----------

curl -s -o /dev/null "http://127.0.0.1:$PORT/" && fail "Port $PORT is busy. Try: PORT=3001 ./host.sh"
echo "Starting Monster Lab..."
node server/index.js >"$LOGS/app.log" 2>&1 &
APP=$!
until curl -s -o /dev/null "http://127.0.0.1:$PORT/"; do
  kill -0 "$APP" 2>/dev/null || { cat "$LOGS/app.log" >&2; fail "Monster Lab did not start."; }
  sleep 0.3
done
KEY=${ADMIN_KEY:-$(cat "$DATA_DIR/admin.key")}

# ---------- The public link ----------

echo "Opening the public link..."
"$CLOUDFLARED" tunnel --no-autoupdate --grace-period 1s --url "http://127.0.0.1:$PORT" >"$LOGS/tunnel.log" 2>&1 &
TUNNEL=$!
URL=''
until [ -n "$URL" ]; do
  kill -0 "$TUNNEL" 2>/dev/null || { tail -n 20 "$LOGS/tunnel.log" >&2; fail "Could not open a link. Check the internet, then try again."; }
  sleep 0.5
  URL=$(grep -oE 'https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com' "$LOGS/tunnel.log" | head -n 1 || true)
done

cat <<EOF

  Monster Lab is live. Keep this window open; Ctrl-C stops it.

  Students   $URL/
  Teacher    $URL/admin?key=$KEY
  Projector  $URL/screen?key=$KEY

  A new link can take a few seconds to start working.
  Logs: $LOGS

EOF

while kill -0 "$APP" 2>/dev/null && kill -0 "$TUNNEL" 2>/dev/null; do sleep 1; done
if kill -0 "$APP" 2>/dev/null; then
  fail "The link closed. Run ./host.sh again: the session is kept, the link changes. Log: $LOGS/tunnel.log"
fi
fail "Monster Lab stopped. Log: $LOGS/app.log"
