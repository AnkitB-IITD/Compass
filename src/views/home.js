/* ============================================================
   home.js — Today: check-in prompt when due, today's goals,
   quick actions.
   ============================================================ */

import { el, todayKey } from '../ui.js';
import { listEntries, listGoals, saveGoal } from '../db.js';
import { isDue, completeCheckin } from '../checkin.js';
import { toast } from '../ui.js';

export async function homeView({ navigate }) {
  const [entries, goals, due] = await Promise.all([listEntries(), listGoals(), isDue()]);
  const view = el('div', {});

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Up late?' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  view.append(el('h1', {}, greeting));

  /* Check-in prompt */
  if (due) {
    view.append(el('div', { class: 'card', style: 'border-left:4px solid var(--gold)' },
      el('div', { class: 'goal__title' }, 'Time for a quick check-in 🧭'),
      el('p', { class: 'dim small', style: 'margin:0.3rem 0 0.8rem' }, 'Thirty seconds: what are you feeling right now, and how strongly?'),
      el('div', { class: 'row' },
        el('button', { class: 'primary', onclick: () => navigate('checkin') }, 'Check in now'),
        el('button', {
          class: 'ghost',
          onclick: async () => { await completeCheckin(); navigate('home'); },
        }, 'Skip'),
      ),
    ));
  } else {
    view.append(el('div', { class: 'row', style: 'margin-bottom:1rem' },
      el('button', { class: 'secondary', onclick: () => navigate('checkin') }, 'Quick check-in'),
      el('button', { class: 'ghost', onclick: () => navigate('journal', { edit: 'new' }) }, 'Write an entry'),
    ));
  }

  /* Today's goals */
  const today = todayKey();
  const dayGoals = goals.filter((g) => g.horizon === 'day' && g.status === 'active' && g.dueDate === today);
  const doneToday = goals.filter((g) => g.horizon === 'day' && g.status === 'done' && g.completedAt && todayKey(g.completedAt) === today);

  view.append(el('h2', {}, "Today's goals"));
  if (dayGoals.length || doneToday.length) {
    const card = el('div', { class: 'card' });
    for (const g of [...dayGoals, ...doneToday]) {
      const checkbox = el('input', {
        type: 'checkbox',
        checked: g.status === 'done',
        'aria-label': `Complete: ${g.title}`,
        onchange: async () => {
          g.status = g.status === 'done' ? 'active' : 'done';
          g.completedAt = g.status === 'done' ? Date.now() : null;
          await saveGoal(g);
          if (g.status === 'done') toast('Done. 🧭');
          navigate('home');
        },
      });
      card.append(el('div', { class: `goal${g.status === 'done' ? ' goal--done' : ''}` },
        checkbox,
        el('div', { style: 'flex:1' },
          el('div', { class: 'goal__title' }, g.title),
          g.why ? el('div', { class: 'goal__why' }, g.why) : null,
        ),
      ));
    }
    card.append(el('button', { class: 'ghost small', style: 'margin-top:0.6rem', onclick: () => navigate('goals', { h: 'day' }) }, 'All goals →'));
    view.append(card);
  } else {
    view.append(el('div', { class: 'card' },
      el('p', { class: 'dim', style: 'margin:0 0 0.7rem' }, 'No goals for today yet.'),
      el('div', { class: 'row' },
        el('button', { class: 'secondary', onclick: () => navigate('goals', { h: 'day' }) }, 'Add a goal'),
        el('button', { class: 'ghost', onclick: () => navigate('insights') }, 'Get suggestions'),
      ),
    ));
  }

  /* Tiny recap */
  const todayEntries = entries.filter((e) => todayKey(e.createdAt) === today);
  view.append(el('p', { class: 'dim small', style: 'margin-top:1.2rem' },
    todayEntries.length
      ? `You've checked in ${todayEntries.length} time${todayEntries.length > 1 ? 's' : ''} today.`
      : 'No entries yet today — even one line counts.'));

  return view;
}
