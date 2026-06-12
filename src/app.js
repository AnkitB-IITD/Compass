/* ============================================================
   app.js — Boot: theme, shell (header + nav), router, service
   worker, check-in scheduler hooks.
   ============================================================ */

import { createRouter } from './router.js';
import { el, icon } from './ui.js';
import { getMeta, requestPersistence } from './db.js';
import { isDue, maybeNotify, scheduleNext } from './checkin.js';

import { homeView } from './views/home.js';
import { journalView } from './views/journal.js';
import { checkinView } from './views/checkin-view.js';
import { goalsView } from './views/goals.js';
import { insightsView } from './views/insights.js';
import { onboardingView } from './views/onboarding.js';
import { settingsView } from './views/settings.js';

const NAV_ITEMS = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'journal', label: 'Journal', icon: 'journal' },
  { name: 'goals', label: 'Goals', icon: 'goals' },
  { name: 'insights', label: 'Insights', icon: 'insights' },
];

async function boot() {
  // Theme before first paint of the shell
  document.documentElement.dataset.theme = await getMeta('theme', 'auto');
  requestPersistence();

  const app = document.getElementById('app');
  const onboarded = await getMeta('onboarded', false);

  // Shell
  const header = el('header', { class: 'header' },
    el('span', { class: 'header__logo' }, icon('compass', 26)),
    el('span', { class: 'header__title' }, 'Compass'),
    el('button', {
      class: 'iconbtn',
      'aria-label': 'Settings',
      onclick: () => router.navigate('settings'),
    }, icon('settings', 22)),
  );

  const main = el('main', { id: 'view' });
  const nav = el('nav', { class: 'nav', 'aria-label': 'Main navigation' });

  const router = createRouter({
    mount: main,
    onChange: (name) => {
      for (const btn of nav.querySelectorAll('.nav__btn')) {
        btn.setAttribute('aria-current', String(btn.dataset.view === name));
      }
      const chrome = name !== 'onboarding';
      header.style.display = chrome ? '' : 'none';
      nav.style.display = chrome ? '' : 'none';
    },
  });

  for (const item of NAV_ITEMS) {
    nav.append(el('button', {
      class: 'nav__btn',
      'data-view': item.name,
      'aria-current': 'false',
      onclick: () => router.navigate(item.name),
    }, icon(item.icon), el('span', {}, item.label)));
  }

  router
    .register('home', homeView)
    .register('journal', journalView)
    .register('checkin', checkinView)
    .register('goals', goalsView)
    .register('insights', insightsView)
    .register('onboarding', onboardingView)
    .register('settings', settingsView);

  app.replaceChildren(header, main, nav);
  app.removeAttribute('aria-busy');

  if (!onboarded && router.parse().name !== 'onboarding') {
    router.navigate('onboarding');
  } else {
    router.render();
  }

  // Check-in scheduling: make sure a next-checkin exists, and nudge
  // when the app regains focus while one is due.
  if (!(await getMeta('nextCheckinAt'))) await scheduleNext();
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && (await isDue())) {
      const { name } = router.parse();
      if (name === 'home') router.render(); // refresh the due banner
    } else {
      maybeNotify();
    }
  });

  // Offline-first shell
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
