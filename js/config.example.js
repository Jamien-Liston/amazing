// Copy this file to js/config.js and fill in your project's values.
// js/config.js is gitignored; on Netlify it is generated at build time by
// scripts/gen-config.sh from env vars. These values are public-safe (the anon
// key is designed to ship to the browser). The Anthropic key is NOT here —
// it lives only in Supabase Edge Function secrets.

window.CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT-ref.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',
};
