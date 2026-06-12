/* ============================================================
   goals.js — Day / Week / Month / Year goal boards.
   Day goals are dated; yesterday's unfinished ones surface as
   "carried over" with one-tap move-to-today. Goals accepted from
   AI insights carry a `why` linking back to the pattern.
   ============================================================ */

import { el, toast, confirmDialog, todayKey } from '../ui.js';
import { listGoals, saveGoal, deleteGoal, uid } from '../db.js';

const HORIZONS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export async function goalsView({ navigate, params }) {
  const horizon = HORIZONS.some((h) => h.key === params.h) ? params.h : 'day';
  const goals = await listGoals();
  const view = el('div', {});

  view.append(el('h1', {}, 'Goals'));

  // Tabs
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  for (const h of HORIZONS) {
    tabs.append(el('button', {
      role: 'tab',
      'aria-selected': String(h.key === horizon),
      onclick: () => navigate('goals', { h: h.key }),
    }, h.label));
  }
  view.append(tabs);

  const inHorizon = goals.filter((g) => g.horizon === horizon);
  const today = todayKey();

  let active, carried = [];
  if (horizon === 'day') {
    active = inHorizon.filter((g) => g.status === 'active' && g.dueDate === today);
    carried = inHorizon.filter((g) => g.status === 'active' && g.dueDate && g.dueDate < today);
  } else {
    active = inHorizon.filter((g) => g.status === 'active');
  }
  const done = inHorizon.filter((g) => g.status === 'done')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 15);

  // Add form
  const input = el('input', { type: 'text', placeholder: `Add a ${horizon} goal…`, 'aria-label': 'New goal' });
  const addGoal = async () => {
    const title = input.value.trim();
    if (!title) return;
    await saveGoal({
      id: uid(), title, why: '', horizon,
      source: 'manual', status: 'active',
      dueDate: horizon === 'day' ? today : null,
      createdAt: Date.now(),
    });
    navigate('goals', { h: horizon });
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addGoal(); });
  view.append(el('div', { class: 'card row' },
    input,
    el('button', { class: 'primary', onclick: addGoal }, 'Add'),
  ));

  // Active list
  if (active.length) {
    const card = el('div', { class: 'card' });
    for (const g of active) card.append(goalRow(g, navigate, horizon));
    view.append(card);
  } else {
    view.append(el('div', { class: 'empty' },
      el('p', {}, `No active ${horizon} goals.`),
      el('p', { class: 'small' }, 'Add one above — or let Insights suggest goals from your journal patterns.'),
      el('button', { class: 'secondary', onclick: () => navigate('insights') }, 'Open Insights'),
    ));
  }

  // Carried over (day only)
  if (carried.length) {
    view.append(el('h2', {}, 'Carried over'));
    const card = el('div', { class: 'card' });
    for (const g of carried) {
      const row = goalRow(g, navigate, horizon);
      row.append(el('button', {
        class: 'ghost small',
        style: 'margin-left:auto; flex-shrink:0',
        onclick: async () => {
          g.dueDate = today;
          await saveGoal(g);
          toast('Moved to today');
          navigate('goals', { h: horizon });
        },
      }, 'Move to today'));
      card.append(row);
    }
    view.append(card);
  }

  // Done
  if (done.length) {
    view.append(el('h2', {}, 'Completed'));
    const card = el('div', { class: 'card' });
    for (const g of done) card.append(goalRow(g, navigate, horizon));
    view.append(card);
  }

  return view;
}

function goalRow(goal, navigate, horizon) {
  const checkbox = el('input', {
    type: 'checkbox',
    checked: goal.status === 'done',
    'aria-label': `Complete: ${goal.title}`,
    onchange: async () => {
      goal.status = goal.status === 'done' ? 'active' : 'done';
      goal.completedAt = goal.status === 'done' ? Date.now() : null;
      if (goal.status === 'active' && goal.horizon === 'day') goal.dueDate = todayKey();
      await saveGoal(goal);
      if (goal.status === 'done') toast('Nice. One step closer 🧭');
      navigate('goals', { h: horizon });
    },
  });

  const body = el('div', { style: 'flex:1; min-width:0' },
    el('div', { class: 'goal__title' }, goal.title),
    goal.why ? el('div', { class: 'goal__why' }, goal.why) : null,
    goal.source === 'ai' ? el('span', { class: 'tag', style: 'margin-top:0.2rem' }, 'from your journal') : null,
  );

  const delBtn = el('button', {
    class: 'iconbtn',
    'aria-label': 'Delete goal',
    title: 'Delete goal',
    onclick: async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog({ title: 'Delete this goal?', body: goal.title, okLabel: 'Delete', danger: true });
      if (ok) { await deleteGoal(goal.id); navigate('goals', { h: horizon }); }
    },
  }, '✕');

  return el('div', { class: `goal${goal.status === 'done' ? ' goal--done' : ''}` }, checkbox, body, delBtn);
}
