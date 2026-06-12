/* ============================================================
   router.js — Minimal hash router.
   Views are async factories returning an HTMLElement, registered
   by name. URLs look like #/journal?id=abc so entries/views are
   linkable and the back button works.
   ============================================================ */

export function createRouter({ mount, onChange }) {
  const views = new Map();

  function register(name, factory) { views.set(name, factory); return api; }

  function parse() {
    const hash = location.hash.replace(/^#\/?/, '') || 'home';
    const [name, qs] = hash.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    return { name, params };
  }

  async function render() {
    const { name, params } = parse();
    const factory = views.get(name) || views.get('home');
    let node;
    try {
      node = await factory({ name, params, navigate });
    } catch (err) {
      console.error('View render failed:', name, err);
      node = document.createElement('div');
      node.className = 'empty';
      node.textContent = 'Something went wrong loading this screen.';
    }
    mount.replaceChildren(node);
    mount.scrollTop = 0;
    if (onChange) onChange(name, params);
  }

  function navigate(name, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const target = '#/' + name + (qs ? '?' + qs : '');
    if (location.hash === target) { render(); } else { location.hash = target; }
  }

  window.addEventListener('hashchange', render);

  const api = { register, navigate, render, parse };
  return api;
}
