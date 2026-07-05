---
name: verify
description: Build/launch/drive recipe for verifying the Amazing PWA end-to-end with a mocked edge function in headless Chrome.
---

# Verifying Amazing

No build step. The frontend is static; the only backend call is
`POST {SUPABASE_URL}/functions/v1/get-story`.

## Recipe

1. Write a mock server (python `SimpleHTTPRequestHandler`) that serves the
   repo root as static files **and** handles `POST /functions/v1/get-story`
   on `127.0.0.1:8787`, returning `{story, topic, age, model}` — plus error
   variants (`502 {error}`, and `200 {error}` for the refusal case, which the
   real function returns as HTTP 200).
2. Point `js/config.js` (gitignored) at it:
   `SUPABASE_URL: 'http://127.0.0.1:8787'`.
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
- Free-text ask; 1-char input must be ignored client-side.
- Error paths: non-OK response and `200 + {error}` both show `#storyError`.
- Service worker registers (1 registration).

## Gotchas

- Setting the slider needs `el.value = N` + dispatched `input` event.
- Chrome logs the intentional 502 as a page error — expected noise.
- The mock can log received headers to assert `x-app-key` and the anon-key
  Bearer header are sent.
- After editing `index.html`/`css/`/`js/`, remember `sh scripts/bump-cache.sh`.
