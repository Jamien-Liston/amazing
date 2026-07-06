// Cloudflare Worker — Amazing story engine (mirrors the Pubwedda worker pattern).
// Routes (all require the x-app-key header to match the APP_PASSPHRASE secret):
//   POST /story      { topic, age }        -> generate via claude-sonnet-5, store in KV, return story
//   GET  /history                          -> stored stories, most recent first (metadata only)
//   GET  /story?id=…                       -> one stored story, full text
//   POST /favourite  { id, favourite }     -> toggle a story in the favourites list
//   POST /image      { id }                -> illustration for a stored story via
//                                             gemini-3.1-flash-image; generated once,
//                                             cached in KV, returned as a data URL
// Secrets required: ANTHROPIC_API_KEY, GEMINI_API_KEY, APP_PASSPHRASE
// KV binding required: STORIES (single shared namespace — household app, no accounts)

const MODEL = 'claude-sonnet-5';
const IMAGE_MODEL = 'gemini-3.1-flash-image';
// Gemini's Interactions API (image generation for 3.x models lives here, not
// generateContent). env.GEMINI_API_URL overrides for local testing only.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const HISTORY_LIMIT = 100;
const FAVOURITES_KEY = 'favourites';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-app-key',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Shared passphrase gate — no open relay.
    if (!env.APP_PASSPHRASE) return json({ error: 'Server missing APP_PASSPHRASE' }, 500);
    if (request.headers.get('x-app-key') !== env.APP_PASSPHRASE) {
      return json({ error: 'Not allowed' }, 401);
    }

    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/story') {
        return await handleGenerate(await request.json(), env);
      }
      if (request.method === 'GET' && url.pathname === '/story') {
        return await handleGetStory(url.searchParams.get('id'), env);
      }
      if (request.method === 'GET' && url.pathname === '/history') {
        return await handleHistory(env);
      }
      if (request.method === 'POST' && url.pathname === '/favourite') {
        return await handleFavourite(await request.json(), env);
      }
      if (request.method === 'POST' && url.pathname === '/image') {
        return await handleImage(await request.json(), env);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Unhandled error', err);
      return json({ error: 'Something went wrong — try again!' }, 500);
    }
  },
};

// ---- Generate a story ----

async function handleGenerate(body, env) {
  const topic = cleanTopic(body.topic);
  if (!topic) return json({ error: 'Please give me a topic to explain!' }, 400);

  const ageNum = Number(body.age);
  const age = Number.isFinite(ageNum) ? Math.min(12, Math.max(4, Math.round(ageNum))) : 8;

  if (!env.ANTHROPIC_API_KEY) return json({ error: 'Server missing Anthropic key' }, 500);

  const response = await callAnthropic(env.ANTHROPIC_API_KEY, topic, age);

  if (response.status === 429) {
    return json({ error: 'Amazing is very busy right now — try again in a minute!' }, 429);
  }
  const data = await response.json();
  if (!response.ok) {
    console.error('Anthropic API error', response.status, JSON.stringify(data).slice(0, 500));
    return json({ error: 'The story machine hiccuped — try again!' }, 502);
  }

  // Check stop_reason before reading content — a refusal has empty or
  // partial content.
  if (data.stop_reason === 'refusal') {
    return json({ error: "Hmm, that topic isn't one I can tell a story about. Try another!" }, 200);
  }

  const story = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (!story) return json({ error: 'The story came back empty — try again!' }, 502);

  // Store in KV. The timestamp-first id makes KV's lexicographic list order
  // chronological; metadata carries what the history list needs so listing
  // never has to fetch each story body.
  const ts = Date.now();
  const id = `${String(ts).padStart(14, '0')}-${crypto.randomUUID().slice(0, 8)}`;
  const record = { id, topic, age, text: story, ts };
  await env.STORIES.put(`story:${id}`, JSON.stringify(record), {
    metadata: { topic, age, ts },
  });

  return json({ id, story, topic, age, model: data.model });
}

// Raw fetch to the Messages API (dependency-free worker, same as Pubwedda).
// One retry on 429/529/5xx since there's no SDK doing it for us.
async function callAnthropic(apiKey, topic, age) {
  const payload = {
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'low' },
    system: buildSystemPrompt(age),
    messages: [{ role: 'user', content: `Explain this to me: ${topic}` }],
  };

  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    if (response.status !== 429 && response.status !== 529 && response.status < 500) break;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
  }
  return response;
}

function buildSystemPrompt(age) {
  const younger = age <= 7;
  return `You are "Amazing", a storyteller who explains fascinating real-world
concepts to children. Your reader is exactly ${age} years old.

Voice and rules:
- Wonder-driven and factual. Real science, never made up, never scaremongering.
- Simple analogies from a child's everyday world (toys, snacks, pets, playgrounds).
- No jargon. If a big word is unavoidable, introduce it gently and explain it.
- ${younger
    ? 'Very short sentences. Small, common words. Around 150-250 words total.'
    : 'Clear sentences a confident young reader can follow. Around 250-400 words total.'}
- Speak directly to the child ("you"). Warm, playful, curious.
- End with one delightful fact or a question that sparks more wonder.

Output format: plain text with light markdown only — you may **bold** a few key
terms. No headings, no lists, no links, and never any HTML.`;
}

// Cap and sanitise free-text topic input before it reaches the prompt:
// strip control characters, collapse whitespace, hard length limit.
function cleanTopic(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned.length >= 2 ? cleaned : null;
}

// ---- Story illustration ----

// Generate (or fetch the cached) illustration for a stored story. Image
// generations are the expensive call, so each story gets exactly one image,
// cached in KV under image:<id> — reopening from history never regenerates.
async function handleImage(body, env) {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id || !/^[0-9a-zA-Z-]+$/.test(id)) return json({ error: 'Bad story id' }, 400);

  const cached = await env.STORIES.get(`image:${id}`, 'json');
  if (cached && cached.data) {
    return json({ id, image: `data:${cached.mimeType};base64,${cached.data}`, cached: true });
  }

  const raw = await env.STORIES.get(`story:${id}`);
  if (!raw) return json({ error: 'Story not found' }, 404);
  const { topic, age } = JSON.parse(raw);

  if (!env.GEMINI_API_KEY) return json({ error: 'Server missing Gemini key' }, 500);

  const response = await callGemini(env, topic, age);
  if (response.status === 429) {
    return json({ error: 'The picture painter is very busy — try again soon!' }, 429);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    console.error('Gemini API error', response.status, JSON.stringify(data).slice(0, 500));
    return json({ error: 'No picture this time — the story is still amazing!' }, 502);
  }

  const image = findImageBlock(data);
  if (!image || !/^image\/[\w.+-]+$/.test(image.mimeType)) {
    console.error('Gemini response had no image', JSON.stringify(data).slice(0, 500));
    return json({ error: 'No picture this time — the story is still amazing!' }, 502);
  }

  await env.STORIES.put(`image:${id}`, JSON.stringify({ mimeType: image.mimeType, data: image.data }));
  return json({ id, image: `data:${image.mimeType};base64,${image.data}`, cached: false });
}

// Raw fetch to Gemini's Interactions API, same dependency-free pattern (and
// the same one manual retry on 429/529/5xx) as the Anthropic call.
async function callGemini(env, topic, age) {
  const payload = {
    model: IMAGE_MODEL,
    input: [{ type: 'text', text: buildImagePrompt(topic, age) }],
    response_format: {
      type: 'image',
      mime_type: 'image/jpeg',
      aspect_ratio: '3:2',
      image_size: '1K',
    },
  };

  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch(env.GEMINI_API_URL || GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    if (response.status !== 429 && response.status !== 529 && response.status < 500) break;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
  }
  return response;
}

// Same content-safety bar as the story text: friendly, simple, nothing scary.
// Topic is already sanitised by cleanTopic before it was stored.
function buildImagePrompt(topic, age) {
  return `A joyful children's picture-book illustration for a ${age}-year-old, about: ${topic}.
Bright warm colours, soft rounded shapes, friendly and curious mood, simple flat
storybook style. No text, letters, or words anywhere in the image. Nothing scary,
dark, violent, or photorealistic.`;
}

// Find the generated image block wherever it sits in the response. The
// Interactions API nests it in steps -> content blocks ({type:"image", data,
// mime_type}); scan defensively rather than hard-code the exact path.
function findImageBlock(node) {
  if (!node || typeof node !== 'object') return null;
  if (typeof node.data === 'string' && node.data.length > 50) {
    const mime = node.mime_type || node.mimeType;
    if (node.type === 'image' || typeof mime === 'string') {
      return { data: node.data, mimeType: typeof mime === 'string' ? mime : 'image/jpeg' };
    }
  }
  for (const value of Array.isArray(node) ? node : Object.values(node)) {
    const found = findImageBlock(value);
    if (found) return found;
  }
  return null;
}

// ---- History & favourites ----

async function getFavourites(env) {
  const raw = await env.STORIES.get(FAVOURITES_KEY);
  try {
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function handleHistory(env) {
  // Keys are timestamp-prefixed so list order is chronological; walk pages
  // and keep the newest HISTORY_LIMIT.
  const keys = [];
  let cursor;
  do {
    const page = await env.STORIES.list({ prefix: 'story:', cursor });
    keys.push(...page.keys);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  const favourites = await getFavourites(env);
  const favSet = new Set(favourites);

  const stories = keys
    .slice(-HISTORY_LIMIT)
    .reverse() // most recent first
    .map((k) => {
      const id = k.name.slice('story:'.length);
      const meta = k.metadata || {};
      return {
        id,
        topic: meta.topic ?? '(unknown topic)',
        age: meta.age ?? null,
        ts: meta.ts ?? null,
        favourite: favSet.has(id),
      };
    });

  return json({ stories });
}

async function handleGetStory(id, env) {
  if (!id || !/^[0-9a-zA-Z-]+$/.test(id)) return json({ error: 'Bad story id' }, 400);
  const raw = await env.STORIES.get(`story:${id}`);
  if (!raw) return json({ error: 'Story not found' }, 404);
  const record = JSON.parse(raw);
  const favourites = await getFavourites(env);
  return json({ ...record, story: record.text, favourite: favourites.includes(id) });
}

async function handleFavourite(body, env) {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id || !/^[0-9a-zA-Z-]+$/.test(id)) return json({ error: 'Bad story id' }, 400);

  // Only favourite stories that exist.
  const exists = await env.STORIES.get(`story:${id}`);
  if (!exists) return json({ error: 'Story not found' }, 404);

  // Read-modify-write; KV has no transactions, but a household app's
  // favourite taps won't realistically race.
  const favourites = await getFavourites(env);
  const wanted = Boolean(body.favourite);
  const next = wanted
    ? [...new Set([...favourites, id])]
    : favourites.filter((f) => f !== id);
  await env.STORIES.put(FAVOURITES_KEY, JSON.stringify(next));

  return json({ id, favourite: wanted });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
