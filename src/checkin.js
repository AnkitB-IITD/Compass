/* ============================================================
   checkin.js — Random check-in scheduling.

   The user picks how many gentle "what are you feeling?" prompts
   they want per day and their quiet hours. We store the next
   check-in timestamp; whenever the app opens (or becomes visible)
   and that time has passed, the home view shows the prompt.
   If the PWA is installed and Notification permission is granted,
   a best-effort local notification fires too.
   ============================================================ */

import { getMeta, setMeta } from './db.js';

const DEFAULT_PREFS = { perDay: 3, quietStart: '22:00', quietEnd: '08:00' };

export async function getPrefs() {
  return { ...DEFAULT_PREFS, ...(await getMeta('checkinPrefs', {})) };
}

export async function setPrefs(prefs) {
  await setMeta('checkinPrefs', prefs);
  await scheduleNext(); // re-randomize with the new window
}

function parseHM(str) {
  const [h, m] = str.split(':').map(Number);
  return { h, m };
}

function inQuietHours(date, prefs) {
  const mins = date.getHours() * 60 + date.getMinutes();
  const qs = parseHM(prefs.quietStart), qe = parseHM(prefs.quietEnd);
  const start = qs.h * 60 + qs.m, end = qe.h * 60 + qe.m;
  // Quiet window may wrap midnight (e.g. 22:00 -> 08:00).
  return start <= end ? (mins >= start && mins < end) : (mins >= start || mins < end);
}

/* Pick a random time between `from` and the end of the awake window,
   roughly spacing prompts at awakeHours / perDay. */
export async function scheduleNext(from = Date.now()) {
  const prefs = await getPrefs();
  const awakeMinutes = 24 * 60 - quietLengthMinutes(prefs);
  const gap = Math.max(60, Math.floor(awakeMinutes / Math.max(1, prefs.perDay)));
  // Random gap between 0.5x and 1.5x of the average spacing.
  const jitter = gap * (0.5 + Math.random());
  let next = new Date(from + jitter * 60000);
  // Push past quiet hours if it lands inside them.
  let guard = 0;
  while (inQuietHours(next, prefs) && guard++ < 48) {
    next = new Date(next.getTime() + 30 * 60000);
  }
  await setMeta('nextCheckinAt', next.getTime());
  return next.getTime();
}

function quietLengthMinutes(prefs) {
  const qs = parseHM(prefs.quietStart), qe = parseHM(prefs.quietEnd);
  const start = qs.h * 60 + qs.m, end = qe.h * 60 + qe.m;
  return start <= end ? end - start : (24 * 60 - start) + end;
}

export async function isDue() {
  const next = await getMeta('nextCheckinAt');
  if (!next) { await scheduleNext(); return false; }
  const prefs = await getPrefs();
  return Date.now() >= next && !inQuietHours(new Date(), prefs);
}

/* Called after a completed check-in (or when the user dismisses one). */
export async function completeCheckin() {
  await scheduleNext();
}

/* Best-effort local notification when due and the tab is hidden. */
export async function maybeNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!(await isDue()) || document.visibilityState === 'visible') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = {
      body: 'A quick pause — what are you feeling right now?',
      icon: 'icon.svg',
      tag: 'compass-checkin',
    };
    if (reg && reg.showNotification) reg.showNotification('Compass check-in', opts);
    else new Notification('Compass check-in', opts);
  } catch { /* notifications are best-effort */ }
}

export function requestNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve('unsupported');
  if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
  return Notification.requestPermission();
}
