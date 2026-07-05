# Amazing — Claude Code Brief

## What it is
A kid's PWA that explains fascinating real-world concepts—how humans are made of star-stuff, why milk is a sneaky colloid squad—at a reading level matched to the child's age, generated live by Claude Sonnet 5.

## Core loop
1. Kid opens the app and sees today's topic (rotates daily), or types their own.
2. Age is set once and remembered.
3. App calls a Supabase Edge Function → Claude Sonnet 5 → story text comes back.
4. Story renders on screen. No images in v1.

## Stack (mirrors MaxFlix)
- **Edge Function:** Supabase (Deno), proxies the Anthropic API using model `claude-sonnet-5`. Key lives in Supabase secrets, never shipped to the client.
- **Frontend:** PWA, HTML/CSS/JS, service worker for offline shell. Bump `CACHE` in `service-worker.js` on any change to `index.html`, `css/`, or `js/*.js`.
- **Hosting:** Netlify, matching MaxFlix. `config.js` won't auto-deploy there—use a build script injecting from env vars, same as MaxFlix.
- **Repo:** GitHub, private, under `Jamien-Liston`.
- **Auth:** shared passphrase (`Bunny`) in localStorage, matching the Pubwedda/WeightTracker pattern.

## Age handling
Single number or slider (4–12), stored in localStorage. Passed into the Sonnet system prompt: explain {topic} to a child aged {age}, simple analogies, no jargon, shorter sentences for younger ages.

## Topic selection (hybrid, per your answer)
- **Daily pick:** hardcoded array of curated topics, indexed by day-of-year using local date construction (not `toISOString()`—same UTC gotcha as MaxFlix). Same pick all day, changes at local midnight.
- **Free text:** input box, sent straight into the prompt as {topic}.

## Prompt design
- Variables: {topic}, {age}
- Voice: wonder-driven, factual, simple analogies, no scaremongering
- Output: plain text or light markdown (bold key terms)—never raw HTML from the model. Render as markdown/text only, don't `innerHTML` the response.

## Explicit v1 scope
- Topic in (daily or typed) → age → story out
- No accounts, no history, no favourites
- No images

## Backlog
- Image generation per story (Gemini/Imagen or OpenAI—separate build phase once the text loop is proven)
- History of past topics / favourites
- Read-aloud (TTS)
- Retry logic for Sonnet API errors (429/529), mirroring the MaxFlix Edge Function pattern
- Note: Sonnet 5's safety classifiers can decline a request (stop_reason "refusal")—the function returns a friendly "try another topic" message, not a bug

## Security notes
- Anthropic key stays server-side in Supabase Edge Function secrets
- Cap and sanitise free-text topic input (length limit, strip control characters) before it reaches the prompt
- Model output rendered as text/markdown only—no `innerHTML`, to close off any injection via a crafted response
