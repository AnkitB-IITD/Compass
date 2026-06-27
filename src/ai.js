/* ============================================================
   ai.js — Provider-agnostic LLM client (bring your own key).

   Compass talks to Claude (Anthropic), Gemini (Google), or
   OpenAI — whichever the user picks in Settings. All three are
   called directly from the browser with the user's own key
   (each vendor permits CORS for this pattern), and each returns
   guaranteed-valid JSON via its own structured-output mechanism.

   Keys and the chosen model are stored per-provider in IndexedDB
   on this device only, and sent only to that provider's endpoint.

   To add a provider: add an entry to PROVIDERS with buildRequest()
   + parse(). Nothing else in the app needs to change.
   ============================================================ */

import { getMeta, setMeta } from './db.js';

/* ---- Gemini wants an OpenAPI-subset schema: no additionalProperties,
        UPPERCASE type names. Convert our canonical JSON schema. ---- */
function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(schema)) {
      if (k === 'additionalProperties') continue;
      if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
      else out[k] = toGeminiSchema(v);
    }
    return out;
  }
  return schema;
}

const GEMINI_SAFETY = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_NONE' }));

export const PROVIDERS = {
  gemini: {
    label: 'Gemini (Google)',
    keyHint: 'AIza…',
    keyUrl: 'aistudio.google.com/apikey',
    defaultModel: 'gemini-2.5-flash',
    testModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (recommended)' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (smartest)' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (fastest)' },
    ],
    buildRequest({ key, model, system, userText, schema, maxTokens }) {
      const generationConfig = { maxOutputTokens: maxTokens };
      if (schema) {
        generationConfig.responseMimeType = 'application/json';
        generationConfig.responseSchema = toGeminiSchema(schema);
      }
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: {
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig,
          safetySettings: GEMINI_SAFETY,
        },
      };
    },
    parse: (data) => (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(''),
  },

  anthropic: {
    label: 'Claude (Anthropic)',
    keyHint: 'sk-ant-…',
    keyUrl: 'console.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    testModel: 'claude-haiku-4-5',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recommended)' },
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (smartest)' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (cheapest)' },
    ],
    buildRequest({ key, model, system, userText, schema, maxTokens }) {
      const body = {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userText }],
      };
      if (schema) body.output_config = { format: { type: 'json_schema', schema } };
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body,
      };
    },
    parse: (data) => data.content?.find((b) => b.type === 'text')?.text || '',
  },

  openai: {
    label: 'OpenAI',
    keyHint: 'sk-…',
    keyUrl: 'platform.openai.com/api-keys',
    defaultModel: 'gpt-4.1-mini',
    testModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini (recommended)' },
      { id: 'gpt-4.1', label: 'GPT-4.1 (smartest)' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (cheapest)' },
    ],
    buildRequest({ key, model, system, userText, schema, maxTokens }) {
      const body = {
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText },
        ],
      };
      if (schema) {
        body.response_format = {
          type: 'json_schema',
          json_schema: { name: 'compass_analysis', schema, strict: true },
        };
      }
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body,
      };
    },
    parse: (data) => data.choices?.[0]?.message?.content || '',
  },
};

const DEFAULT_PROVIDER = 'gemini';

/* ---- provider / key / model selection (per provider) ---- */

export async function getProvider() {
  const p = await getMeta('aiProvider');
  return PROVIDERS[p] ? p : DEFAULT_PROVIDER;
}
export function setProvider(id) { return setMeta('aiProvider', id); }

export async function getKey(provider) {
  provider = provider || (await getProvider());
  let key = await getMeta('apiKey_' + provider);
  if (!key && provider === 'anthropic') key = await getMeta('apiKey'); // migrate legacy
  return key;
}
export async function setKey(key, provider) {
  provider = provider || (await getProvider());
  return setMeta('apiKey_' + provider, key ? key.trim() : null);
}

export async function getModel(provider) {
  provider = provider || (await getProvider());
  return (await getMeta('aiModel_' + provider)) || PROVIDERS[provider].defaultModel;
}
export function setModel(id, provider) {
  return getProvider().then((p) => setMeta('aiModel_' + (provider || p), id));
}

export function listModels(provider) { return PROVIDERS[provider].models; }

/* ---- core call ---- */

async function callAI({ system, userText, schema, maxTokens = 8000 }) {
  const provider = await getProvider();
  const conf = PROVIDERS[provider];
  const key = await getKey(provider);
  if (!key) throw new Error('NO_KEY');
  const model = await getModel(provider);

  const { url, headers, body } = conf.buildRequest({ key, model, system, userText, schema, maxTokens });

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new Error('You appear to be offline. Insights need an internet connection.');
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* non-JSON error */ }
    if (res.status === 401 || res.status === 403) throw new Error('Your API key was rejected. Check it in Settings.');
    if (res.status === 429) throw new Error('Rate limited by the provider — wait a minute and try again.');
    if (res.status >= 500) throw new Error('The AI service is busy right now. Try again shortly.');
    if (res.status === 400 && /api[\s_]?key|invalid/i.test(detail)) throw new Error('Your API key was rejected. Check it in Settings.');
    throw new Error(detail || `Request failed (${res.status}).`);
  }

  const data = await res.json();
  const text = conf.parse(data);
  if (!text) throw new Error('The AI returned an empty response — try again, or a different model in Settings.');
  return schema ? JSON.parse(text) : text;
}

/* ---- key validation (cheap round-trip) ---- */

export async function testKey(key, provider) {
  provider = provider || (await getProvider());
  const conf = PROVIDERS[provider];
  const { url, headers, body } = conf.buildRequest({
    key,
    model: conf.testModel,
    system: 'You are a connectivity test.',
    userText: 'Reply with the single word OK.',
    schema: null,
    maxTokens: 8,
  });
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.ok) return true;
  let detail = '';
  try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
  if (res.status === 401 || res.status === 403 || (res.status === 400 && /api[\s_]?key|invalid/i.test(detail))) {
    throw new Error('That key was rejected — double-check it.');
  }
  throw new Error(detail || `Could not validate the key (${res.status}).`);
}

/* ---- analysis (schema is provider-agnostic) ---- */

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
- If there are too few entries to see real patterns, say so honestly in the summary and keep the lists short.
- Respond only with the JSON object the schema describes — no extra commentary.`;

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

  return callAI({
    system: ANALYSIS_SYSTEM,
    userText: `Here are my last ${entries.length} entries, newest first:\n\n${lines.join('\n')}`,
    schema: ANALYSIS_SCHEMA,
  });
}
