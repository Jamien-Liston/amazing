# Amazing — Claude Code Brief

## What it is
A kid's PWA that explains fascinating real-world concepts—how humans are made of star-stuff, why milk is a sneaky colloid squad—at a reading level matched to the child's age, generated live by Claude Sonnet 5.

## Core loop
1. Kid opens the app and sees today's topic (rotates daily), or types their own.
2. Age is set once and remembered.
3. App calls a Cloudflare Worker → Claude Sonnet 5 → story text comes back.
4. Story renders on screen and is saved to KV for history/favourites. No images in v1.

## Stack
- **Worker:** Cloudflare Worker (mirrors the Pubwedda worker pattern), proxies the Anthropic API using model `claude-sonnet-5`. Key lives in Worker secrets (`wrangler secret put`), never shipped to the client. Includes retry on 429/529.
- **Storage:** Cloudflare KV, single shared namespace (household app, no accounts). Each story stored keyed by id (topic, age, text, timestamp), plus a favourited-ids list.
- **Frontend:** PWA, HTML/CSS/JS, service worker for offline shell. Bump `CACHE` in `service-worker.js` on any change to `index.html`, `css/`, or `js/*.js`.
- **Hosting:** GitHub Pages, served straight from `main` (no build step). `config.js` holds the public Worker URL and is committed—nothing secret ships to the client.
- **Repo:** GitHub, private, under `Jamien-Liston`.
- **Auth:** shared passphrase (`Bunny`) in localStorage, matching the Pubwedda/WeightTracker pattern; the Worker verifies it (`x-app-key`) against a secret on every route.

## Age handling
Single number or slider (4–12), stored in localStorage. Passed into the Sonnet system prompt: explain {topic} to a child aged {age}, simple analogies, no jargon, shorter sentences for younger ages.

## Topic selection (hybrid, per your answer)
- **Daily pick:** hardcoded array of curated topics, indexed by day-of-year using local date construction (not `toISOString()`—same UTC gotcha as MaxFlix). Same pick all day, changes at local midnight.
- **Free text:** input box, sent straight into the prompt as {topic}.

## Prompt design
- Variables: {topic}, {age}
- Voice: wonder-driven, factual, simple analogies, no scaremongering
- Output: plain text or light markdown (bold key terms)—never raw HTML from the model. Render as markdown/text only, don't `innerHTML` the response.

## Scope
- Topic in (daily or typed) → age → story out
- History of past stories (most recent first) and a favourite toggle on each story, backed by KV
- No accounts
- No images

## Backlog
- Image generation per story (Gemini/Imagen or OpenAI—separate build phase once the text loop is proven)
- Read-aloud (TTS)
- Note: Sonnet 5's safety classifiers can decline a request (stop_reason "refusal")—the Worker returns a friendly "try another topic" message, not a bug

## Security notes
- Anthropic key stays server-side in Cloudflare Worker secrets
- Cap and sanitise free-text topic input (length limit, strip control characters) before it reaches the prompt
- Model output rendered as text/markdown only—no `innerHTML`, to close off any injection via a crafted response (applies to stored text coming back from KV too)
