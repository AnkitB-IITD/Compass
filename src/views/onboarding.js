/* ============================================================
   onboarding.js — Three steps: what this is → check-in prefs →
   optional API key. Everything is skippable except the basics.
   ============================================================ */

import { el, icon, toast } from '../ui.js';
import { setMeta } from '../db.js';
import { setPrefs, requestNotificationPermission } from '../checkin.js';
import { setKey, testKey } from '../ai.js';

export async function onboardingView({ navigate }) {
  let step = 0;
  const state = { perDay: 3, quietStart: '22:00', quietEnd: '08:00', key: '' };

  const view = el('div', { class: 'onb' });

  function dots() {
    return el('div', { class: 'dots' },
      ...[0, 1, 2].map((i) => el('span', { class: i === step ? 'on' : '' })));
  }

  function render() {
    view.replaceChildren();
    if (step === 0) {
      view.append(
        el('div', { class: 'logo' }, icon('compass', 56)),
        el('h1', {}, 'Compass'),
        el('p', { class: 'dim' }, 'Your feelings are navigation. Compass helps you name them precisely, spots the patterns underneath, and turns them into goals you can actually act on.'),
        el('div', { class: 'stack', style: 'margin-top:1.4rem' },
          point('🧭', 'Quick check-ins teach you a richer feelings vocabulary.'),
          point('🔍', 'AI reads your recent entries and reflects back patterns, problems and aspirations.'),
          point('✅', 'Suggested goals — daily to yearly — turn insight into action.'),
          point('🔒', 'Everything lives on your device. No account, no server.'),
        ),
        dots(),
        el('button', { class: 'primary', style: 'width:100%', onclick: () => { step = 1; render(); } }, 'Get started'),
      );
    } else if (step === 1) {
      const perDay = el('input', { type: 'number', min: '1', max: '8', value: String(state.perDay) });
      const qs = el('input', { type: 'time', value: state.quietStart });
      const qe = el('input', { type: 'time', value: state.quietEnd });
      view.append(
        el('h1', {}, 'Check-in rhythm'),
        el('p', { class: 'dim' }, 'Compass will gently prompt you a few times a day: "what are you feeling right now?" Those small answers build the journal.'),
        el('div', { class: 'stack' },
          el('label', { class: 'field' }, el('span', {}, 'Check-ins per day'), perDay),
          el('label', { class: 'field' }, el('span', {}, 'Quiet hours start'), qs),
          el('label', { class: 'field' }, el('span', {}, 'Quiet hours end'), qe),
        ),
        dots(),
        el('button', {
          class: 'primary', style: 'width:100%',
          onclick: async () => {
            state.perDay = Math.min(8, Math.max(1, Number(perDay.value) || 3));
            state.quietStart = qs.value || '22:00';
            state.quietEnd = qe.value || '08:00';
            await setPrefs({ perDay: state.perDay, quietStart: state.quietStart, quietEnd: state.quietEnd });
            requestNotificationPermission();
            step = 2; render();
          },
        }, 'Continue'),
      );
    } else {
      const keyInput = el('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off' });
      const status = el('p', { class: 'dim small' });
      view.append(
        el('h1', {}, 'AI insights (optional)'),
        el('p', { class: 'dim' }, 'Paste your own Claude API key to unlock pattern analysis and goal suggestions. Without it, the journal, check-ins and manual goals all still work.'),
        el('div', { class: 'stack' },
          el('label', { class: 'field' }, el('span', {}, 'Claude API key'), keyInput),
          status,
          el('p', { class: 'dim small' }, 'The key is stored only on this device and sent only to Anthropic. Get one at console.anthropic.com. You can add or change it later in Settings.'),
        ),
        dots(),
        el('div', { class: 'stack' },
          el('button', {
            class: 'primary', style: 'width:100%',
            onclick: async (e) => {
              const key = keyInput.value.trim();
              if (!key) { finish(navigate); return; }
              e.target.disabled = true;
              status.replaceChildren(el('span', { class: 'spinner' }), ' Checking the key…');
              try {
                await testKey(key);
                await setKey(key);
                toast('Key verified ✓');
                finish(navigate);
              } catch (err) {
                status.textContent = err.message;
                e.target.disabled = false;
              }
            },
          }, 'Finish'),
          el('button', { class: 'ghost', style: 'width:100%', onclick: () => finish(navigate) }, 'Skip for now'),
        ),
      );
    }
  }

  function point(emoji, text) {
    return el('div', { class: 'row', style: 'align-items:flex-start' },
      el('span', { style: 'font-size:1.3rem' }, emoji),
      el('span', { class: 'small' }, text));
  }

  render();
  return view;
}

async function finish(navigate) {
  await setMeta('onboarded', true);
  document.dispatchEvent(new CustomEvent('compass:onboarded'));
  navigate('home');
}
