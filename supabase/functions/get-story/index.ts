// get-story — the only server-side code. Verifies the shared app passphrase,
// sanitises the topic, and asks Claude Sonnet 5 for a kid-level explanation.
// The Anthropic key lives only in Supabase secrets and never reaches the
// browser. Safety classifiers can decline a request (stop_reason "refusal")
// — handled below with a friendly message.

import Anthropic from 'npm:@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-app-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// Cap and sanitise free-text topic input before it reaches the prompt:
// strip control characters, collapse whitespace, hard length limit.
function cleanTopic(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned.length >= 2 ? cleaned : null;
}

function buildSystemPrompt(age: number): string {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 1. Shared passphrase gate — no open relay. The client sends the same
  // passphrase it stores in localStorage; compare against the secret.
  const appKey = Deno.env.get('APP_PASSPHRASE');
  if (!appKey) return json({ error: 'Server missing APP_PASSPHRASE' }, 500);
  if (req.headers.get('x-app-key') !== appKey) {
    return json({ error: 'Not allowed' }, 401);
  }

  // 2. Validate input.
  let body: { topic?: unknown; age?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const topic = cleanTopic(body.topic);
  if (!topic) return json({ error: 'Please give me a topic to explain!' }, 400);

  const ageNum = Number(body.age);
  const age = Number.isFinite(ageNum) ? Math.min(12, Math.max(4, Math.round(ageNum))) : 8;

  // 3. Ask Claude Sonnet 5. Adaptive thinking is the default when the
  // thinking param is omitted. Low effort keeps latency down for a short
  // story; the SDK retries 429/529/5xx twice with backoff on its own.
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ error: 'Server missing Anthropic key' }, 500);

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' },
      system: buildSystemPrompt(age),
      messages: [{ role: 'user', content: `Explain this to me: ${topic}` }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'Amazing is very busy right now — try again in a minute!' }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      return json({ error: 'The story machine hiccuped — try again!' }, 502);
    }
    console.error('Unexpected error', err);
    return json({ error: 'Could not reach the story machine' }, 502);
  }

  // 4. Check stop_reason before reading content — a refusal has empty or
  // partial content.
  if (response.stop_reason === 'refusal') {
    return json({ error: "Hmm, that topic isn't one I can tell a story about. Try another!" }, 200);
  }

  const story = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (!story) return json({ error: 'The story came back empty — try again!' }, 502);

  return json({ story, topic, age, model: response.model });
});
