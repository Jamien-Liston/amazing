---
name: verify
description: Build/launch/drive recipe for verifying the Amazing PWA end-to-end with a mocked Cloudflare Worker in headless Chrome.
---

# Verifying Amazing

No build step. The frontend is static; all backend calls hit the Worker:
`POST /story`, `GET /history`, `GET /story?id=…`, `POST /favourite`
(all with an `x-app-key` header).

## Recipe

1. Write a mock server (python `SimpleHTTPRequestHandler`) that serves the
   repo root as static files **and** mocks the Worker routes above on
   `127.0.0.1:8787`. `POST /story` returns `{id, story, topic, age, model}`
   and should remember stories in-process so `/history` and `/story?id=`
   reflect them; `POST /favourite` toggles an in-memory set. Include error
   variants (`502 {error}`, and `200 {error}` for the refusal case, which the
   real Worker returns as HTTP 200).
2. Point `js/config.js` at it: `WORKER_URL: 'http://127.0.0.1:8787'`.
   **config.js is committed** (it normally holds the real workers.dev URL) —
   restore it with `git checkout js/config.js` when done; never commit the
   mock URL.
3. Drive with `puppeteer-core` + system Chrome
   (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
   `headless: 'new'`, 390×844 viewport). `npm i puppeteer-core` in a temp dir.

## Flows worth driving

- Gate: wrong passphrase → inline error; `Bunny` → age view (first run).
- Age slider → home; `#ageChip` shows `age N`; persists across reload.
- Daily topic populated from `js/topics.js` (day-of-year, local date).
- "Tell me!" → story: multiple `<p>`, `**bold**` → `<strong>`, and a
  `<script>` payload in the mock story must render as literal text
  (renderStory escapes HTML before applying markdown — this is load-bearing).
- Favourite: `#favBtn` toggles ☆ ↔ ★, POSTs `/favourite`, survives reopening
  the story from history.
- History: `#historyChip` → list most recent first, topics via `textContent`
  (feed a `<img onerror>` topic through the mock to prove it), tapping a row
  reopens the stored story via `GET /story?id=` (no regeneration).
- Free-text ask; 1-char input must be ignored client-side.
- Error paths: non-OK response and `200 + {error}` both show `#storyError`.
- Service worker registers (1 registration).

## Gotchas

- Setting the slider needs `el.value = N` + dispatched `input` event.
- Chrome logs the intentional 502 as a page error — expected noise.
- The mock can log received headers to assert `x-app-key` is sent on every
  route.
- After editing `index.html`/`css/`/`js/`, remember `sh scripts/bump-cache.sh`.
