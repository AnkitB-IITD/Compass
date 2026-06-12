/* ============================================================
   checkin-view.js — The ≤30-second check-in flow.
   Feeling wheel (family → nuanced feelings) → intensity →
   optional voice/text note → save.
   ============================================================ */

import { el, toast } from '../ui.js';
import { withDictation } from '../voice.js';
import { FAMILIES } from '../emotions.js';
import { saveEntry, uid } from '../db.js';
import { completeCheckin } from '../checkin.js';

export async function checkinView({ navigate }) {
  const selected = new Set();      // nuanced feeling names
  let openFamily = null;
  let intensity = 5;

  const view = el('div', {});
  view.append(el('h1', {}, 'What are you feeling right now?'));
  view.append(el('p', { class: 'dim small' }, 'Pick up to 3 feelings. Tap a mood to see more precise words for it — naming feelings precisely is how EQ grows.'));

  const wheel = el('div', {});
  view.append(wheel);

  function renderWheel() {
    wheel.replaceChildren();
    const famRow = el('div', { class: 'chips', style: 'margin-bottom:0.8rem' });
    for (const fam of FAMILIES) {
      famRow.append(el('button', {
        type: 'button',
        class: 'chip chip--family',
        'aria-pressed': String(openFamily === fam.key),
        onclick: () => { openFamily = openFamily === fam.key ? null : fam.key; renderWheel(); },
      }, `${fam.emoji} ${fam.label}`));
    }
    wheel.append(famRow);

    if (openFamily) {
      const fam = FAMILIES.find((f) => f.key === openFamily);
      const subRow = el('div', { class: 'chips', style: 'margin-bottom:0.8rem' });
      for (const feeling of fam.feelings) {
        subRow.append(el('button', {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(selected.has(feeling)),
          onclick: () => {
            if (selected.has(feeling)) selected.delete(feeling);
            else if (selected.size < 3) selected.add(feeling);
            else toast('Up to 3 feelings per check-in');
            renderWheel();
          },
        }, feeling));
      }
      wheel.append(subRow);
    }

    if (selected.size) {
      wheel.append(el('p', { class: 'small' },
        'Selected: ', ...[...selected].map((f) => el('span', { class: 'tag' }, f))));
    }
  }
  renderWheel();

  // Intensity
  view.append(el('h2', {}, 'How strong is it?'));
  const out = el('output', {}, String(intensity));
  const slider = el('input', {
    type: 'range', min: '1', max: '10', value: String(intensity),
    'aria-label': 'Intensity from 1 to 10',
    oninput: (e) => { intensity = Number(e.target.value); out.textContent = e.target.value; },
  });
  view.append(el('div', { class: 'intensity' }, slider, out));

  // Note
  view.append(el('h2', {}, "What's behind it? ", el('span', { class: 'dim small', style: 'font-weight:400' }, '(optional)')));
  const note = el('textarea', {
    placeholder: 'Say or type a line about what triggered this…',
    style: 'min-height:5.5rem',
  });
  view.append(withDictation(note));

  // Actions
  view.append(el('div', { class: 'row', style: 'margin-top:1rem' },
    el('button', {
      class: 'primary',
      onclick: async () => {
        if (!selected.size && !note.value.trim()) {
          toast('Pick a feeling or write a note first');
          return;
        }
        await saveEntry({
          id: uid(),
          type: 'checkin',
          emotions: [...selected].map((name) => ({ name, intensity })),
          text: note.value.trim(),
          createdAt: Date.now(),
        });
        await completeCheckin();
        toast('Check-in saved 🌱');
        navigate('home');
      },
    }, 'Save check-in'),
    el('button', { class: 'ghost', onclick: () => navigate('home') }, 'Not now'),
  ));

  return view;
}
