#!/bin/sh
set -eu
if [ "${1:-}" = "node" ] && [ "${2:-}" = "server.js" ]; then
  node scripts/migrate.mjs
fi
exec "$@"
