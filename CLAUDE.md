# Amazing — Conventions

A kid's PWA that explains fascinating real-world concepts at a reading level
matched to the child's age, generated live by Claude Sonnet 5. See
`amazing-claude-code-brief.md` for the full product brief.

## Stack

- **Front-end:** vanilla HTML/CSS/JS, no build step, no framework. No supabase-js —
  the only backend call is a plain `fetch` to the Edge Function.
- **Backend:** Supabase — one Edge Function (`get-story`) as the Anthropic proxy.
  No database, no auth accounts.
- **Hosting:** static front-end on Netlify over HTTPS.

## Architecture

- Single `index.html` shell. Views (`gate`, `ageView`, `home`, `storyView`) are
  sections toggled by a `hidden` class — no router.
- `js/` plain scripts in dependency order: `config` → `topics` → `app`.
- Age (4–12) and unlock state live in localStorage. Daily topic = hardcoded
  array indexed by day-of-year using **local** date construction (never
  `toISOString()` — UTC flips the topic mid-morning AEST).

## Model call (Edge Function)

- Model is `claude-sonnet-5` via the official `npm:@anthropic-ai/sdk` import.
- Sonnet 5 rules baked in: no `thinking` param (omitting it runs adaptive
  thinking by default), no sampling params (`temperature` etc. 400), no
  assistant prefill, and check `stop_reason === "refusal"` before reading
  content.
- The SDK auto-retries 429/529/5xx twice with backoff; no custom retry loop.

## Secrets — non-negotiable

- **The Anthropic key lives only in Supabase secrets**
  (`supabase secrets set ANTHROPIC_API_KEY=...`), read via `Deno.env.get`.
  Never in the front-end, never committed.
- `APP_PASSPHRASE` is also a Supabase secret; the function rejects requests
  whose `x-app-key` header doesn't match (no open relay).
- `js/config.js` (Supabase URL + anon key) is **gitignored**; commit
  `js/config.example.js` instead. Netlify generates it via
  `scripts/gen-config.sh` from env vars.

## Safety rules

- Free-text topics are capped and sanitised **server-side** (length limit,
  control characters stripped) before reaching the prompt.
- Model output is rendered as text/light-markdown only: HTML-escape everything
  first, then apply `**bold**` and paragraphs. Never `innerHTML` the raw
  response.

## Conventions

- Mobile-first CSS; the primary target is a phone home-screen install.
- The service worker caches the app shell cache-first. **Bump `CACHE` in
  `service-worker.js`** (`sh scripts/bump-cache.sh`) on any change to
  `index.html`, `css/`, or `js/*.js`, or installed clients keep old files.
- Deploy the function with `supabase functions deploy get-story`.
