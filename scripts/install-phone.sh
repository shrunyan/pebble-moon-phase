#!/usr/bin/env bash
#
# Install the app to a paired phone over Wi-Fi.
#
#   npm run install:phone -- 192.168.0.155
#   PEBBLE_PHONE=192.168.0.155 npm run install:phone
#
# The IP is shown in the Pebble phone app under Settings > Developer
# Connection (the toggle must be on).

set -euo pipefail
cd "$(dirname "$0")/.."

IP="${1:-${PEBBLE_PHONE:-}}"
case "$IP" in
  PEBBLE_PHONE=*) IP="${IP#PEBBLE_PHONE=}" ;;   # tolerate `-- PEBBLE_PHONE=<ip>`
esac

if [ -z "$IP" ]; then
  cat >&2 <<'EOF'
usage: npm run install:phone -- <phone-ip>
   or: PEBBLE_PHONE=<phone-ip> npm run install:phone

Find the IP in the Pebble phone app: Settings > Developer Connection
(the Developer Connection toggle must be on).
EOF
  exit 1
fi

exec pebble install --phone "$IP"
