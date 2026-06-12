/* ============================================================
   ai.js — Claude API client (user's own key, direct from browser).

   The key is stored only in IndexedDB on this device and sent only
   to api.anthropic.com (the `anthropic-dangerous-direct-browser-access`
   header opts into CORS for exactly this bring-your-own-key pattern).

   Structured results come back via output_config.format (json_schema),
   so responses are guaranteed-valid JSON — no fragile text parsing.
   ============================================================ */

import { getMeta, setMeta } from './db.js';

export const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recommended)' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (smartest, pricier)' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (cheapest)' },
];
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function getKey() { return getMeta('apiKey'); }
export function setKey(key) { return setMeta('apiKey', key ? key.trim() : null); }
export async function getModel() { return (await getMeta('aiModel')) || DEFAULT_MODEL; }
export function setModel(id) { return setMeta('aiModel', id); }

async function callClaude({ system, userText, schema, maxTokens = 6000 }) {
  const key = await getKey();
  if (!key) throw new Error('NO_KEY');

  const body = {
    model: await getModel(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userText }],
  };
  if (schema) {
    body.output_config = { format: { type: 'json_schema', schema } };
  }

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('You appear to be offline. Insights need an internet connection.');
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* non-JSON error */ }
    if (res.status === 401) throw new Error('Your API key was rejected. Check it in Settings.');
    if (res.status === 429) throw new Error('Rate limited by the API — wait a minute and try again.');
    if (res.status === 529 || res.status >= 500) throw new Error('The AI service is busy right now. Try again shortly.');
    throw new Error(detail || `Request failed (${res.status}).`);
  }

  const data = await res.json();
  const text = data.content?.find((b) => b.type === 'text')?.text || '';
  return schema ? JSON.parse(text) : text;
}

/* ---- analysis ---- */

const GOAL_HORIZONS = ['day', 'week', 'month', 'year'];

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['emotionalSummary', 'patterns', 'problems', 'aspirations', 'suggestedGoals'],
  properties: {
    emotionalSummary: {
      type: 'string',
      description: 'A warm, non-clinical 2-4 sentence reflection addressed directly to the journaler ("you").',
    },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'evidence'],
        properties: {
          title: { type: 'string', description: 'Short name for the pattern, e.g. "Meetings drain you"' },
          description: { type: 'string', description: '1-3 sentences on the recurring thought/feeling pattern and likely trigger.' },
          evidence: { type: 'string', description: 'Concrete grounding, e.g. "You mentioned feeling drained after meetings in 6 of 14 entries".' },
        },
      },
    },
    problems: {
      type: 'array',
      items: { type: 'string' },
      description: 'Underlying problems the person seems to be facing, stated gently.',
    },
    aspirations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Hopes and aspirations that show through the entries.',
    },
    suggestedGoals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'why', 'horizon'],
        properties: {
          title: { type: 'string', description: 'A small, concrete, actionable goal.' },
          why: { type: 'string', description: 'One sentence linking the goal to the pattern it addresses.' },
          horizon: { type: 'string', enum: GOAL_HORIZONS },
        },
      },
    },
  },
};

const ANALYSIS_SYSTEM = `You are the insight engine of "Compass", a private emotional-intelligence journal. You receive a person's recent journal entries and emotion check-ins, and you reflect back what you notice.

Guidelines:
- Be warm, specific, and non-clinical. Never diagnose. Address the person as "you".
- Ground every pattern in what was actually written; cite rough counts or paraphrased moments as evidence.
- Distinguish passing moods from recurring patterns. Only report patterns with at least two supporting entries.
- Problems and aspirations should be inferred carefully and phrased gently.
- Suggested goals must be small and concrete (behavioral, schedulable), each tied to a pattern. Spread them across horizons: daily habits, weekly practices, monthly projects, and at most one yearly aspiration. Suggest 4-8 goals total.
- If there are too few entries to see real patterns, say so honestly in the summary and keep the lists short.`;

export async function analyzeEntries(entries) {
  const lines = entries.map((e) => {
    const when = new Date(e.createdAt).toLocaleString([], {
      weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    });
    const feelings = (e.emotions || []).map((m) => `${m.name} (${m.intensity}/10)`).join(', ');
    const parts = [`[${when}] ${e.type === 'checkin' ? 'Check-in' : 'Journal'}`];
    if (feelings) parts.push(`feelings: ${feelings}`);
    if (e.text) parts.push(`text: ${e.text}`);
    return parts.join(' | ');
  });

  return callClaude({
    system: ANALYSIS_SYSTEM,
    userText: `Here are my last ${entries.length} entries, newest first:\n\n${lines.join('\n')}`,
    schema: ANALYSIS_SCHEMA,
  });
}

/* ---- key validation ---- */

export async function testKey(key) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with the word OK.' }],
    }),
  });
  if (res.ok) return true;
  if (res.status === 401) throw new Error('That key was rejected — double-check it.');
  const detail = (await res.json().catch(() => null))?.error?.message;
  throw new Error(detail || `Could not validate the key (${res.status}).`);
}
