/* ============================================================
   journal.js — Long-form entries + the combined timeline.
   #/journal           → timeline of all entries (journal + check-ins)
   #/journal?edit=new  → new entry editor
   #/journal?edit=<id> → edit an existing entry
   ============================================================ */

import { el, toast, confirmDialog, fmtTime, fmtDay } from '../ui.js';
import { withDictation } from '../voice.js';
import { FAMILIES, familyOf } from '../emotions.js';
import { listEntries, getEntry, saveEntry, deleteEntry, uid } from '../db.js';

export async function journalView({ navigate, params }) {
  if (params.edit) return editor({ navigate, id: params.edit === 'new' ? null : params.edit });
  return timeline({ navigate });
}

/* ---------- timeline ---------- */

async function timeline({ navigate }) {
  const entries = await listEntries();
  const view = el('div', {});

  view.append(el('div', { class: 'row between' },
    el('h1', {}, 'Journal'),
    el('button', { class: 'primary', onclick: () => navigate('journal', { edit: 'new' }) }, '+ New entry'),
  ));

  if (!entries.length) {
    view.append(el('div', { class: 'empty' },
      el('p', {}, 'Nothing here yet.'),
      el('p', { class: 'small' }, 'Do a quick check-in or write your first entry — the insights get smarter with every one.'),
    ));
    return view;
  }

  let lastDay = '';
  for (const entry of entries) {
    const day = fmtDay(entry.createdAt);
    if (day !== lastDay) {
      view.append(el('div', { class: 'daysep' }, day));
      lastDay = day;
    }
    view.append(entryCard(entry, navigate));
  }
  return view;
}

function entryCard(entry, navigate) {
  const feelings = (entry.emotions || []).map((m) => {
    const fam = familyOf(m.name);
    return el('span', { class: 'tag' }, `${fam ? fam.emoji + ' ' : ''}${m.name} ${m.intensity}/10`);
  });
  return el('div', {
    class: 'card entry',
    role: 'button',
    tabindex: '0',
    onclick: () => navigate('journal', { edit: entry.id }),
    onkeydown: (e) => { if (e.key === 'Enter') navigate('journal', { edit: entry.id }); },
  },
    el('div', { class: 'entry__date' },
      `${fmtTime(entry.createdAt)} · ${entry.type === 'checkin' ? 'Check-in' : 'Journal entry'}`),
    feelings.length ? el('div', { style: 'margin-bottom:0.35rem' }, ...feelings) : null,
    entry.text ? el('div', { class: 'entry__text' }, truncate(entry.text, 280)) : null,
  );
}

function truncate(text, n) {
  return text.length > n ? text.slice(0, n).trimEnd() + '…' : text;
}

/* ---------- editor ---------- */

async function editor({ navigate, id }) {
  const existing = id ? await getEntry(id) : null;
  const selected = new Set((existing?.emotions || []).map((m) => m.name));
  const intensityByName = Object.fromEntries((existing?.emotions || []).map((m) => [m.name, m.intensity]));

  const view = el('div', {});
  view.append(el('h1', {}, existing ? 'Edit entry' : 'New journal entry'));

  const text = el('textarea', {
    placeholder: "What's on your mind? Speak or type — thoughts, situations, what they made you feel…",
    style: 'min-height:11rem',
  });
  if (existing) text.value = existing.text || '';
  view.append(withDictation(text));

  // Optional feeling tags (flat list of family labels + expanded nuance for the brave)
  view.append(el('h2', {}, 'Tag feelings ', el('span', { class: 'dim small', style: 'font-weight:400' }, '(optional)')));
  const chipWrap = el('div', { class: 'chips' });
  function renderChips() {
    chipWrap.replaceChildren();
    for (const fam of FAMILIES) {
      for (const feeling of fam.feelings) {
        // Show selected nuances + one representative per family to keep it compact
        if (!selected.has(feeling) && feeling !== fam.feelings[0]) continue;
        chipWrap.append(chip(feeling, fam));
      }
    }
  }
  function chip(feeling, fam) {
    return el('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': String(selected.has(feeling)),
      onclick: () => {
        if (selected.has(feeling)) selected.delete(feeling);
        else { selected.add(feeling); intensityByName[feeling] = intensityByName[feeling] || 5; }
        renderChips();
      },
    }, `${fam.emoji} ${feeling}`);
  }
  renderChips();
  view.append(chipWrap);
  view.append(el('p', { class: 'dim small' }, 'For the full feelings wheel, use a check-in.'));

  const actions = el('div', { class: 'row', style: 'margin-top:1.2rem' },
    el('button', {
      class: 'primary',
      onclick: async () => {
        if (!text.value.trim() && !selected.size) { toast('Write something first'); return; }
        await saveEntry({
          id: existing?.id || uid(),
          type: existing?.type || 'journal',
          emotions: [...selected].map((name) => ({ name, intensity: intensityByName[name] || 5 })),
          text: text.value.trim(),
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: existing ? Date.now() : undefined,
        });
        toast('Saved');
        navigate('journal');
      },
    }, 'Save'),
    el('button', { class: 'ghost', onclick: () => navigate('journal') }, 'Cancel'),
  );

  if (existing) {
    actions.append(el('button', {
      class: 'danger',
      style: 'margin-left:auto',
      onclick: async () => {
        const ok = await confirmDialog({
          title: 'Delete this entry?',
          body: 'This permanently removes it from your device.',
          okLabel: 'Delete',
          danger: true,
        });
        if (ok) { await deleteEntry(existing.id); toast('Deleted'); navigate('journal'); }
      },
    }, 'Delete'));
  }

  view.append(actions);
  return view;
}
