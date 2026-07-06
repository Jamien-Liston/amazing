// Copy this file to js/config.js and fill in your Worker's URL.
// js/config.js is gitignored; on Netlify it is generated at build time by
// scripts/gen-config.sh from env vars. The Anthropic key is NOT here — it
// lives only in Cloudflare Worker secrets (wrangler secret put).

window.CONFIG = {
  WORKER_URL: 'https://amazing-api.YOUR-SUBDOMAIN.workers.dev',
};
