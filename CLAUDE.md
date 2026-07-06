# Amazing — Conventions

A kid's PWA that explains fascinating real-world concepts at a reading level
matched to the child's age, generated live by Claude Sonnet 5. See
`amazing-claude-code-brief.md` for the full product brief.

## Stack

- **Front-end:** vanilla HTML/CSS/JS, no build step, no framework. The only
  backend calls are plain `fetch`es to the Worker.
- **Backend:** one Cloudflare Worker (`worker.js`, mirrors the Pubwedda worker
  pattern) as the Anthropic proxy, plus a Cloudflare KV namespace (`STORIES`)
  for story history and favourites. No database server, no auth accounts.
- **Hosting:** static front-end on GitHub Pages, served straight from the
  `main` branch root (no build step); Worker on workers.dev via
  `wrangler deploy`.

## Architecture

- Single `index.html` shell. Views (`gate`, `ageView`, `home`, `historyView`,
  `storyView`) are sections toggled by a `hidden` class — no router.
- `js/` plain scripts in dependency order: `config` → `topics` → `app`.
- Age (4–12) and unlock state live in localStorage. Daily topic = hardcoded
  array indexed by day-of-year using **local** date construction (never
  `toISOString()` — UTC flips the topic mid-morning AEST).

## Worker API (all routes require `x-app-key`)

| Route | Does |
|---|---|
| `POST /story {topic, age}` | sanitise topic, age-tuned prompt → `claude-sonnet-5`, store result in KV, return `{id, story, …}` |
| `GET /history` | stored stories, most recent first (KV key metadata only — no body reads) |
| `GET /story?id=…` | one stored story, full text + favourite flag |
| `POST /favourite {id, favourite}` | add/remove id in the shared favourites list |

- KV layout: `story:<zero-padded-ts>-<rand>` → `{id, topic, age, text, ts}`
  with `{topic, age, ts}` as key metadata; `favourites` → JSON array of ids.
  Timestamp-first keys make KV's lexicographic list order chronological.
- Sonnet 5 rules baked in: no `thinking` param (omitting it runs adaptive
  thinking by default), no sampling params (`temperature` etc. 400), no
  assistant prefill, and check `stop_reason === "refusal"` before reading
  content.
- Raw `fetch` to the Messages API (dependency-free worker, same as Pubwedda);
  one manual retry on 429/529/5xx since there's no SDK doing it for us.

## Secrets — non-negotiable

- **The Anthropic key lives only in Worker secrets**
  (`wrangler secret put ANTHROPIC_API_KEY`), read via `env`. Never in the
  front-end, never committed.
- `APP_PASSPHRASE` is also a Worker secret; every route rejects requests
  whose `x-app-key` header doesn't match (no open relay).
- `js/config.js` (Worker URL) is **committed** — the URL is public by nature
  and there is no build step. Only Worker secrets are sensitive. Never put a
  key in `config.js`.
- `.dev.vars` (local `wrangler dev` secrets) stays gitignored.

## Safety rules

- Free-text topics are capped and sanitised **server-side** (length limit,
  control characters stripped) before reaching the prompt.
- Model output is rendered as text/light-markdown only: HTML-escape everything
  first, then apply `**bold**` and paragraphs. Never `innerHTML` the raw
  response — including stored story text and topics coming back from KV
  (history rows are built with `textContent`).

## Conventions

- Mobile-first CSS; the primary target is a phone home-screen install.
- The service worker caches the app shell cache-first. **Bump `CACHE` in
  `service-worker.js`** (`sh scripts/bump-cache.sh`) on any change to
  `index.html`, `css/`, or `js/*.js`, or installed clients keep old files.
- Deploy the Worker with `wrangler deploy` (KV namespace id lives in
  `wrangler.jsonc`).
