/* ============================================================
   voice.js — Web Speech API dictation.

   People talk about feelings more easily than they type them, so
   dictation is first-class: a mic button overlaid on a textarea
   streams a live transcript into it. Feature-detected — the button
   simply doesn't render where SpeechRecognition is unsupported
   (mobile keyboards still offer voice typing in any textarea).

   Privacy: the browser vendor's speech service does the
   transcription (e.g. Google on Chrome); the app never stores
   audio, only the final text the user chooses to save.
   ============================================================ */

import { el, icon, toast } from './ui.js';
import { getMeta } from './db.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export const voiceSupported = !!SR;

/* Wraps a textarea in a .micwrap with a dictation button.
   Returns the wrapper (or a plain wrapper when unsupported). */
export function withDictation(textarea) {
  const wrap = el('div', { class: 'micwrap' }, textarea);
  if (!SR) return wrap;

  const btn = el('button', {
    type: 'button',
    class: 'micbtn',
    'aria-label': 'Dictate with your voice',
    title: 'Dictate with your voice',
  }, icon('mic', 18));
  wrap.append(btn);

  let rec = null;
  let active = false;
  let baseText = '';   // text present before this dictation session

  async function start() {
    rec = new SR();
    rec.lang = (await getMeta('voiceLang')) || navigator.language || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    baseText = textarea.value ? textarea.value.replace(/\s+$/, '') + ' ' : '';
    let finals = '';

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finals += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      textarea.value = baseText + finals + interim;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    };

    rec.onend = () => {
      // Auto-restart: Chrome stops on short silences; keep listening
      // until the user explicitly taps stop.
      if (active) {
        baseText = textarea.value ? textarea.value.replace(/\s+$/, '') + ' ' : '';
        finals = '';
        try { rec.start(); } catch { stop(); }
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        toast('Microphone access was blocked. Allow it in your browser settings.');
        stop();
      } else if (ev.error === 'network') {
        toast('Voice typing needs an internet connection.');
        stop();
      }
      // 'no-speech' and 'aborted' are routine; onend handles restart.
    };

    try {
      rec.start();
      active = true;
      btn.dataset.on = 'true';
      btn.replaceChildren(icon('micOff', 18));
    } catch {
      toast('Could not start voice typing.');
    }
  }

  function stop() {
    active = false;
    btn.dataset.on = 'false';
    btn.replaceChildren(icon('mic', 18));
    try { rec && rec.stop(); } catch { /* already stopped */ }
    textarea.focus();
  }

  btn.addEventListener('click', () => (active ? stop() : start()));

  // Stop dictation if the view gets torn down.
  const observer = new MutationObserver(() => {
    if (!document.body.contains(wrap) && active) { stop(); observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return wrap;
}
