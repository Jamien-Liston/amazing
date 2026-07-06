#!/bin/sh
# Generates js/config.js from environment variables at Netlify build time, so
# the Worker URL stays out of the repo (config.js is gitignored). The URL is
# public-safe — the Worker's passphrase check is the gate.
set -eu

if [ -z "${WORKER_URL:-}" ]; then
  echo "ERROR: WORKER_URL must be set in the Netlify environment." >&2
  exit 1
fi

cat > js/config.js <<EOF
// Generated at build time by scripts/gen-config.sh — do not edit or commit.
window.CONFIG = {
  WORKER_URL: '${WORKER_URL}',
};
EOF

echo "Wrote js/config.js for ${WORKER_URL}"
