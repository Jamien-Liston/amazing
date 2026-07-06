# Amazing ✦

A kid's PWA that explains fascinating real-world concepts — how humans are made
of star-stuff, why milk is a sneaky colloid squad — at a reading level matched
to the child's age, generated live by Claude Sonnet 5.

## How it works

1. Kid opens the app and sees today's topic (rotates daily at local midnight),
   or types their own.
2. Age is set once (slider, 4–12) and remembered.
3. The app calls a Cloudflare Worker → Claude Sonnet 5 → story text comes
   back and renders on screen.
4. Every story is saved to Cloudflare KV: browse them in **history** (most
   recent first) and star **favourites**. No accounts — one shared household
   store.

## Setup

### 1. Cloudflare (backend)

```sh
wrangler kv namespace create STORIES
# paste the returned id into wrangler.jsonc
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put APP_PASSPHRASE     # Bunny
wrangler deploy
```

### 2. Local front-end

```sh
cp js/config.example.js js/config.js
# fill in WORKER_URL (https://amazing-api.YOUR-SUBDOMAIN.workers.dev)
python3 -m http.server 8000   # then open http://localhost:8000
```

### 3. Netlify (hosting)

- New site from this repo; build settings come from `netlify.toml`.
- Set the `WORKER_URL` env var in Site settings (the build generates
  `js/config.js` from it).

## Maintenance

- **Any change to `index.html`, `css/`, or `js/*.js`:** run
  `sh scripts/bump-cache.sh` before deploying, or installed PWAs keep serving
  the old files.
- **Icons:** regenerate with `python3 scripts/gen-icons.py` (needs Pillow).
- **Daily topics:** edit the array in `js/topics.js`.
- **Worker changes:** `wrangler deploy`.

## Backlog

- Image generation per story (separate build phase once the text loop is proven)
- Read-aloud (TTS)
