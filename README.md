# Amazing ✦

A kid's PWA that explains fascinating real-world concepts — how humans are made
of star-stuff, why milk is a sneaky colloid squad — at a reading level matched
to the child's age, generated live by Claude Sonnet 5.

## How it works

1. Kid opens the app and sees today's topic (rotates daily at local midnight),
   or types their own.
2. Age is set once (slider, 4–12) and remembered.
3. The app calls a Cloudflare Worker → Claude Sonnet 5 → story text comes
   back and renders on screen. A picture-book illustration (Gemini 3.1 Flash
   Image) paints in above the story a moment later — generated once per
   story, then cached.
4. Every story is saved to Cloudflare KV: browse them in **history** (most
   recent first) and star **favourites**. No accounts — one shared household
   store.

## Setup

### 1. Cloudflare (backend)

```sh
wrangler kv namespace create STORIES
# paste the returned id into wrangler.jsonc
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put GEMINI_API_KEY     # story illustrations
wrangler secret put APP_PASSPHRASE     # Bunny
wrangler deploy
```

The Worker URL lives in `js/config.js` (committed — it's public by nature;
the passphrase check and Worker secrets are the actual gates).

### 2. GitHub Pages (hosting)

No build step — Pages serves the repo as-is:

1. Push the repo to GitHub (`Jamien-Liston/amazing`, private).
2. Repo → Settings → Pages → Source: **Deploy from a branch**,
   branch `main`, folder `/ (root)`.
3. The app lands at `https://jamien-liston.github.io/amazing/` — all asset
   paths are relative, so the subpath just works.

Every push to `main` redeploys automatically.

### 3. Local front-end

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

That's it — `js/config.js` already points at the deployed Worker. To work
against a mock instead, temporarily edit `WORKER_URL` (see
`.claude/skills/verify/SKILL.md`) and restore it before committing.

## Maintenance

- **Any change to `index.html`, `css/`, or `js/*.js`:** run
  `sh scripts/bump-cache.sh` before pushing, or installed PWAs keep serving
  the old files.
- **Icons:** regenerate with `python3 scripts/gen-icons.py` (needs Pillow).
- **Daily topics:** edit the array in `js/topics.js`.
- **Worker changes:** `wrangler deploy`.

## Backlog

- Read-aloud (TTS)
