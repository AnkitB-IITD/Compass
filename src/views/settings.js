/* ============================================================
   settings.js — API key + model, check-in prefs, voice language,
   theme, export, delete-all.
   ============================================================ */

import { el, toast, confirmDialog } from '../ui.js';
import { getMeta, setMeta, exportAll, wipeAll } from '../db.js';
import { getPrefs, setPrefs, requestNotificationPermission } from '../checkin.js';
import { PROVIDERS, getProvider, setProvider, getKey, setKey, testKey, getModel, setModel, listModels } from '../ai.js';
import { voiceSupported } from '../voice.js';

export async function settingsView({ navigate }) {
  const provider = await getProvider();
  const conf = PROVIDERS[provider];
  const [key, model, prefs, theme, voiceLang] = await Promise.all([
    getKey(provider), getModel(provider), getPrefs(), getMeta('theme', 'auto'), getMeta('voiceLang', ''),
  ]);

  const view = el('div', {});
  view.append(el('h1', {}, 'Settings'));

  /* ---- AI ---- */
  view.append(el('h2', {}, 'AI insights'));

  const providerSelect = el('select', {},
    ...Object.entries(PROVIDERS).map(([id, p]) => {
      const opt = el('option', { value: id }, p.label);
      if (id === provider) opt.selected = true;
      return opt;
    }));
  providerSelect.addEventListener('change', async () => {
    await setProvider(providerSelect.value);
    toast(`Switched to ${PROVIDERS[providerSelect.value].label}`);
    navigate('settings'); // re-render so key + model fields match the provider
  });

  const keyInput = el('input', {
    type: 'password',
    placeholder: key ? '•••••••• (key saved)' : conf.keyHint,
    autocomplete: 'off',
  });
  const keyStatus = el('span', { class: 'dim small' });

  // Model: editable so a stale suggestion list never blocks a newer model.
  const listId = `models-${provider}`;
  const modelList = el('datalist', { id: listId },
    ...listModels(provider).map((m) => el('option', { value: m.id }, m.label)));
  const modelInput = el('input', {
    type: 'text',
    list: listId,
    value: model,
    placeholder: conf.defaultModel,
    'aria-label': 'Model',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });
  modelInput.addEventListener('change', async () => {
    const v = modelInput.value.trim();
    if (v) { await setModel(v, provider); toast('Model updated'); }
  });

  view.append(el('div', { class: 'card stack' },
    el('label', { class: 'field', style: 'margin-bottom:0' }, el('span', {}, 'Provider'), providerSelect),
    el('label', { class: 'field', style: 'margin-bottom:0' }, el('span', {}, `${conf.label} API key`), keyInput),
    el('div', { class: 'row' },
      el('button', {
        class: 'primary',
        onclick: async (e) => {
          const val = keyInput.value.trim();
          if (!val) { toast('Paste a key first'); return; }
          e.target.disabled = true;
          keyStatus.replaceChildren(el('span', { class: 'spinner' }), ' Checking…');
          try {
            await testKey(val, provider);
            await setKey(val, provider);
            keyStatus.textContent = 'Key verified and saved ✓';
            keyInput.value = '';
            keyInput.placeholder = '•••••••• (key saved)';
          } catch (err) {
            keyStatus.textContent = err.message;
          }
          e.target.disabled = false;
        },
      }, 'Save key'),
      key ? el('button', {
        class: 'ghost',
        onclick: async () => { await setKey(null, provider); toast('Key removed'); navigate('settings'); },
      }, 'Remove key') : null,
      keyStatus,
    ),
    el('label', { class: 'field', style: 'margin-bottom:0' }, el('span', {}, 'Model'), modelInput, modelList),
    el('p', { class: 'dim small', style: 'margin:0' },
      `Pick a suggestion or type any model ID your key supports. Get a key at ${conf.keyUrl}. Keys are stored per-provider on this device only, and sent only to ${conf.label} when you run an analysis.`),
  ));

  /* ---- Check-ins ---- */
  view.append(el('h2', {}, 'Check-ins'));
  const perDay = el('input', { type: 'number', min: '1', max: '8', value: String(prefs.perDay) });
  const qs = el('input', { type: 'time', value: prefs.quietStart });
  const qe = el('input', { type: 'time', value: prefs.quietEnd });
  view.append(el('div', { class: 'card stack' },
    el('label', { class: 'field', style: 'margin-bottom:0' }, el('span', {}, 'Prompts per day'), perDay),
    el('div', { class: 'row' },
      el('label', { class: 'field', style: 'flex:1; margin-bottom:0' }, el('span', {}, 'Quiet from'), qs),
      el('label', { class: 'field', style: 'flex:1; margin-bottom:0' }, el('span', {}, 'until'), qe),
    ),
    el('div', { class: 'row' },
      el('button', {
        class: 'secondary',
        onclick: async () => {
          await setPrefs({
            perDay: Math.min(8, Math.max(1, Number(perDay.value) || 3)),
            quietStart: qs.value || '22:00',
            quietEnd: qe.value || '08:00',
          });
          toast('Check-in rhythm updated');
        },
      }, 'Save'),
      el('button', {
        class: 'ghost',
        onclick: async () => {
          const r = await requestNotificationPermission();
          toast(r === 'granted' ? 'Notifications on' : r === 'unsupported' ? 'Not supported in this browser' : 'Notifications not allowed');
        },
      }, 'Enable notifications'),
    ),
  ));

  /* ---- Appearance & voice ---- */
  view.append(el('h2', {}, 'Appearance & voice'));
  const themeSelect = el('select', {},
    ...[['auto', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, label]) => {
      const opt = el('option', { value: v }, label);
      if (v === theme) opt.selected = true;
      return opt;
    }));
  themeSelect.addEventListener('change', async () => {
    await setMeta('theme', themeSelect.value);
    document.documentElement.dataset.theme = themeSelect.value;
  });

  const langInput = el('input', {
    type: 'text',
    placeholder: navigator.language || 'en-US',
    value: voiceLang || '',
  });
  langInput.addEventListener('change', async () => {
    await setMeta('voiceLang', langInput.value.trim() || null);
    toast('Voice language updated');
  });

  view.append(el('div', { class: 'card stack' },
    el('label', { class: 'field', style: 'margin-bottom:0' }, el('span', {}, 'Theme'), themeSelect),
    el('label', { class: 'field', style: 'margin-bottom:0' },
      el('span', {}, `Voice typing language ${voiceSupported ? '' : '(not supported in this browser)'}`), langInput),
    el('p', { class: 'dim small', style: 'margin:0' }, 'e.g. en-IN for Indian English, hi-IN for Hindi. Dictation is processed by your browser’s speech service and needs internet; no audio is ever stored.'),
  ));

  /* ---- Data ---- */
  view.append(el('h2', {}, 'Your data'));
  view.append(el('div', { class: 'card row' },
    el('button', {
      class: 'ghost',
      onclick: async () => {
        const data = await exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: `compass-export-${new Date().toISOString().slice(0, 10)}.json` });
        a.click();
        URL.revokeObjectURL(a.href);
      },
    }, 'Export JSON'),
    el('button', {
      class: 'danger',
      onclick: async () => {
        const ok = await confirmDialog({
          title: 'Delete everything?',
          body: 'All entries, goals, insights and settings will be permanently erased from this device. Export first if you want a copy.',
          okLabel: 'Erase all data',
          danger: true,
        });
        if (ok) {
          await wipeAll();
          toast('All data erased');
          location.hash = '#/onboarding';
          location.reload();
        }
      },
    }, 'Delete all data'),
  ));

  view.append(el('p', { class: 'dim small', style: 'margin-top:1.5rem' },
    'Compass is a self-reflection tool, not therapy or medical advice. If you’re struggling, please reach out to someone — in India: iCALL 9152987821, Vandrevala Foundation 1860-2662-345.'));

  return view;
}
