#!/bin/sh
set -e

DATA="${PETALYA_DATA_DIR:-/data}"
export HOSTNAME="0.0.0.0"

mkdir -p "$DATA/uploads"

if [ "$(id -u)" = "0" ]; then
  # A Railway volume is mounted as root; give the app user access to it, then drop privileges.
  chown -R node:node "$DATA" 2>/dev/null || true
  if su-exec node test -w "$DATA"; then
    exec su-exec node "$@"
  fi
  echo "warning: $DATA is not writable by the node user; running as root instead" >&2
fi

exec "$@"
