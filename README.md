# Compass — EQ Journal & Goals

Your feelings are navigation. **Compass** is a private journal that helps you
*name* your feelings precisely, *see* the patterns underneath them, and *act*
on what you find — through goals on daily, weekly, monthly and yearly horizons.

Built as a **zero-build, offline-first PWA**: plain ES modules, IndexedDB, a
service worker, and GitHub Pages. No account, no server, no tracking — your
journal never leaves your device (except to Anthropic, by your choice, when
you run an AI analysis with your own key).

## The loop

1. **Check-ins** — a few gentle prompts a day: *"what are you feeling right
   now?"* A feelings-wheel picker (8 families → ~50 nuanced feelings) builds
   emotional vocabulary over time; an intensity slider and an optional
   one-line note take ~30 seconds.
2. **Journal** — longer entries when you want them, with **voice dictation**
   (Web Speech API; the mic button appears in Chrome/Edge — people talk about
   feelings more easily than they type them).
3. **Insights** — local stats always (streak, feeling variety, top feelings);
   with your own **Claude API key**, an AI pass over your last 30 days
   surfaces recurring thought patterns, what seems to be weighing on you, and
   your aspirations — each grounded in evidence from your entries.
4. **Goals** — the analysis proposes concrete actions tied to each pattern
   ("you mentioned feeling drained after meetings 6 times → daily: 10-minute
   post-meeting walk"). Accept the ones that fit; they land on your
   Day / Week / Month / Year boards. Manual goals work too, no key needed.

## Run locally

```bash
cd compass
npm run dev     # http://localhost:4280
```

No build step and no dependencies — it's plain ES modules. After the first
load the service worker makes the shell fully offline.

## AI setup

Pick a provider and paste your own key (onboarding or Settings → AI insights).
Compass works with any of:

| Provider | Get a key | Default model |
|---|---|---|
| **Gemini** (Google) | aistudio.google.com/apikey | `gemini-2.5-flash` |
| **Claude** (Anthropic) | console.anthropic.com | `claude-sonnet-4-6` |
| **OpenAI** | platform.openai.com/api-keys | `gpt-4.1-mini` |

Keys are stored per-provider in IndexedDB on your device only, and each is
sent only to that provider's endpoint, only when you tap **Analyze**. Switch
providers anytime in Settings — each remembers its own key and model. The AI
layer is a thin adapter ([src/ai.js](src/ai.js)); adding another provider is a
single entry with `buildRequest()` + `parse()`.

## Privacy

- All data (entries, goals, insights, settings, API key) lives in IndexedDB
  on your device. Export anytime as JSON; delete everything in one tap.
- AI analysis sends your recent entries to your chosen provider (Gemini,
  Claude or OpenAI) **only when you tap Analyze**, using your own key.
- Voice dictation uses your browser's speech service (e.g. Google on Chrome)
  and needs internet; the app never stores audio — only the text you save.

Compass is a self-reflection tool, not therapy or medical advice.

## Tech notes

- **IndexedDB over localStorage** — async, durable, not first evicted under
  storage pressure; `navigator.storage.persist()` is requested.
- **Hash router** (`#/journal?edit=…`) so back button and deep links work on
  GitHub Pages with zero server config.
- **Relative paths everywhere** so the app works from a repo subpath
  (`username.github.io/compass/`).
- **Structured AI output** via the Messages API `output_config.format`
  (JSON schema) — responses are guaranteed valid JSON.
- `rem` units, `dvh`, safe-area insets, `prefers-reduced-motion`, light/dark.
- Responsive: bottom tab bar on phones, sidebar at ≥900px.
