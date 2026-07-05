#!/bin/sh
# Generates js/config.js from environment variables at Netlify build time, so
# the Supabase URL + anon key stay out of the repo (config.js is gitignored).
# The anon key is public-safe — it ships to the browser.
set -eu

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set in the Netlify environment." >&2
  exit 1
fi

cat > js/config.js <<EOF
// Generated at build time by scripts/gen-config.sh — do not edit or commit.
window.CONFIG = {
  SUPABASE_URL: '${SUPABASE_URL}',
  SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}',
};
EOF

echo "Wrote js/config.js for ${SUPABASE_URL}"
