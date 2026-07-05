# Amazing ✦

A kid's PWA that explains fascinating real-world concepts — how humans are made
of star-stuff, why milk is a sneaky colloid squad — at a reading level matched
to the child's age, generated live by Claude Sonnet 5.

## How it works

1. Kid opens the app and sees today's topic (rotates daily at local midnight),
   or types their own.
2. Age is set once (slider, 4–12) and remembered.
3. The app calls a Supabase Edge Function → Claude Sonnet 5 → story text comes
   back and renders on screen.

No accounts, no history, no images (v1).

## Setup

### 1. Supabase (backend)

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set APP_PASSPHRASE=Bunny
supabase functions deploy get-story
```

### 2. Local front-end

```sh
cp js/config.example.js js/config.js
# fill in SUPABASE_URL and SUPABASE_ANON_KEY
python3 -m http.server 8000   # then open http://localhost:8000
```

### 3. Netlify (hosting)

- New site from this repo; build settings come from `netlify.toml`.
- Set env vars in Site settings: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  (the build generates `js/config.js` from them).

## Maintenance

- **Any change to `index.html`, `css/`, or `js/*.js`:** run
  `sh scripts/bump-cache.sh` before deploying, or installed PWAs keep serving
  the old files.
- **Icons:** regenerate with `python3 scripts/gen-icons.py` (needs Pillow).
- **Daily topics:** edit the array in `js/topics.js`.

## Backlog

- Image generation per story (separate build phase once the text loop is proven)
- History of past topics / favourites
- Read-aloud (TTS)
