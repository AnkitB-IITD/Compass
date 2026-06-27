/* ============================================================
   insights.js — Local stats (always available) + AI pattern
   analysis (with the user's Claude API key).
   ============================================================ */

import { el, toast, fmtDay } from '../ui.js';
import { familyOf } from '../emotions.js';
import { listEntries, listInsights, saveInsight, saveGoal, uid } from '../db.js';
import { getKey, getProvider, PROVIDERS, analyzeEntries } from '../ai.js';
import { todayKey } from '../ui.js';

const DAYS_30 = 30 * 86400000;

export async function insightsView({ navigate }) {
  const [entries, insights, key, provider] = await Promise.all([listEntries(), listInsights(), getKey(), getProvider()]);
  const providerLabel = PROVIDERS[provider].label;
  const view = el('div', {});
  view.append(el('h1', {}, 'Insights'));

  /* ---------- local stats (no AI needed) ---------- */
  view.append(statsCard(entries));

  /* ---------- AI analysis ---------- */
  view.append(el('h2', {}, 'Pattern analysis'));

  if (!key) {
    view.append(el('div', { class: 'card' },
      el('p', {}, 'With your own AI provider key (Gemini, Claude or OpenAI), Compass reads your recent entries and reflects back: recurring thought patterns, what seems to be weighing on you, what you aspire to — and concrete goals to act on it.'),
      el('p', { class: 'dim small' }, `Your key and journal stay on this device; entries are sent only to ${providerLabel} when you tap Analyze.`),
      el('button', { class: 'primary', onclick: () => navigate('settings') }, 'Add API key in Settings'),
    ));
    return view;
  }

  const recent = entries.filter((e) => e.createdAt > Date.now() - DAYS_30);
  const latest = insights[0];

  const analyzeBtn = el('button', { class: 'primary' }, latest ? 'Re-analyze last 30 days' : 'Analyze my last 30 days');
  const status = el('span', { class: 'dim small' });

  analyzeBtn.addEventListener('click', async () => {
    if (recent.length < 3) { toast('Add at least 3 entries first — the analysis needs material to work with.'); return; }
    analyzeBtn.disabled = true;
    status.replaceChildren(el('span', { class: 'spinner' }), ' Reading your entries…');
    try {
      const result = await analyzeEntries(recent.slice(0, 60));
      await saveInsight({
        id: uid(),
        periodStart: Date.now() - DAYS_30,
        periodEnd: Date.now(),
        entryCount: recent.length,
        ...result,
        createdAt: Date.now(),
      });
      navigate('insights');
    } catch (err) {
      status.textContent = '';
      toast(err.message === 'NO_KEY' ? 'Add your API key in Settings first.' : err.message, 5000);
      analyzeBtn.disabled = false;
    }
  });

  view.append(el('div', { class: 'row', style: 'margin-bottom:0.8rem' }, analyzeBtn, status));

  if (latest) view.append(insightResult(latest, navigate));
  else view.append(el('p', { class: 'dim small' }, `You have ${recent.length} entr${recent.length === 1 ? 'y' : 'ies'} from the last 30 days ready to analyze.`));

  return view;
}

/* ---------- local stats ---------- */

function statsCard(entries) {
  const now = Date.now();
  const last7 = entries.filter((e) => e.createdAt > now - 7 * 86400000);
  const prev7 = entries.filter((e) => e.createdAt <= now - 7 * 86400000 && e.createdAt > now - 14 * 86400000);

  const variety = (list) => new Set(list.flatMap((e) => (e.emotions || []).map((m) => m.name))).size;
  const v7 = variety(last7), vPrev = variety(prev7);

  // Streak: consecutive days (ending today or yesterday) with >= 1 entry
  const days = new Set(entries.map((e) => todayKey(e.createdAt)));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(todayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(todayKey(cursor.getTime()))) { streak++; cursor.setDate(cursor.getDate() - 1); }

  // Top feelings last 30d
  const counts = {};
  for (const e of entries.filter((x) => x.createdAt > now - DAYS_30)) {
    for (const m of e.emotions || []) counts[m.name] = (counts[m.name] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const card = el('div', { class: 'card' },
    el('div', { class: 'row' },
      el('div', { class: 'stat' }, el('b', {}, String(streak)), el('span', {}, 'day streak')),
      el('div', { class: 'stat' }, el('b', {}, String(entries.length)), el('span', {}, 'total entries')),
      el('div', { class: 'stat' },
        el('b', {}, String(v7)),
        el('span', {}, `feelings named this week${vPrev ? ` (${v7 >= vPrev ? '↑' : '↓'} vs ${vPrev})` : ''}`)),
    ),
  );

  if (top.length) {
    card.append(el('div', { style: 'margin-top:0.8rem' },
      el('span', { class: 'dim small' }, 'Most frequent lately: '),
      ...top.map(([name, n]) => {
        const fam = familyOf(name);
        return el('span', { class: 'tag' }, `${fam ? fam.emoji + ' ' : ''}${name} ×${n}`);
      }),
    ));
  }
  return card;
}

/* ---------- AI result rendering ---------- */

function insightResult(insight, navigate) {
  const wrap = el('div', {});
  wrap.append(el('p', { class: 'dim small' },
    `Analyzed ${insight.entryCount} entries · ${fmtDay(insight.createdAt)}`));

  if (insight.emotionalSummary) {
    wrap.append(el('div', { class: 'card' }, el('p', { style: 'margin:0' }, insight.emotionalSummary)));
  }

  if (insight.patterns?.length) {
    wrap.append(el('h2', {}, 'Patterns noticed'));
    for (const p of insight.patterns) {
      wrap.append(el('div', { class: 'card pattern-card' },
        el('div', { class: 'goal__title' }, p.title),
        el('p', { style: 'margin:0.3rem 0' }, p.description),
        el('p', { class: 'dim small', style: 'margin:0' }, p.evidence),
      ));
    }
  }

  if (insight.problems?.length || insight.aspirations?.length) {
    wrap.append(el('h2', {}, 'Beneath the surface'));
    const card = el('div', { class: 'card' });
    if (insight.problems?.length) {
      card.append(el('p', { class: 'small', style: 'margin-top:0' }, el('b', {}, 'Weighing on you: ')),
        el('ul', { class: 'small', style: 'margin:0 0 0.8rem' }, ...insight.problems.map((p) => el('li', {}, p))));
    }
    if (insight.aspirations?.length) {
      card.append(el('p', { class: 'small' }, el('b', {}, 'What you seem to want: ')),
        el('ul', { class: 'small', style: 'margin:0' }, ...insight.aspirations.map((a) => el('li', {}, a))));
    }
    wrap.append(card);
  }

  const pending = (insight.suggestedGoals || []).filter((g) => !g.accepted);
  if (pending.length) {
    wrap.append(el('h2', {}, 'Suggested goals'));
    for (const g of insight.suggestedGoals) {
      if (g.accepted) continue;
      const btn = el('button', { class: 'secondary', style: 'flex-shrink:0' }, 'Add');
      btn.addEventListener('click', async () => {
        await saveGoal({
          id: uid(),
          title: g.title,
          why: g.why,
          horizon: g.horizon,
          source: 'ai',
          sourceInsightId: insight.id,
          status: 'active',
          dueDate: g.horizon === 'day' ? todayKey() : null,
          createdAt: Date.now(),
        });
        g.accepted = true;
        await saveInsight(insight);
        toast(`Added to ${g.horizon} goals`);
        navigate('insights');
      });
      wrap.append(el('div', { class: 'card suggestion row between', style: 'flex-wrap:nowrap; gap:0.8rem' },
        el('div', {},
          el('div', { class: 'goal__title' }, g.title, ' ', el('span', { class: 'tag' }, g.horizon)),
          el('div', { class: 'goal__why' }, g.why),
        ),
        btn,
      ));
    }
  }

  return wrap;
}
