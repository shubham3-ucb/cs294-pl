// Edit mode, for both days. With the teacher key, any element marked with ed(...) (data-edit = the text's address,
// data-raw = its wording before formatting) can be changed in place: click it, type, then press Enter or click away
// to save (Esc cancels). The server keeps the edit in server/text_edits.json, and every page (students, console,
// projector) shows the new wording on its next refresh. Pages skip redrawing while someone is typing in a text.
const attr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The attributes that make an element editable: ed({p, r}) or ed(address, raw). Nothing when there is no source.
export function ed(src, raw) {
  const s = typeof src === 'string' ? { p: src, r: raw } : src;
  return s?.p && typeof s.r === 'string' ? ` data-edit="${attr(s.p)}" data-raw="${attr(s.r)}"` : '';
}

let key = '';
let on = false;

export const editingOn = () => on;
// True while a text is being edited: the page should not redraw it away.
export const busy = () => on && !!document.activeElement?.closest?.('[data-edit]');

// ?edit with the teacher key turns edit mode on for this tab (kept across reloads).
export function editFromUrl(teacherKey) {
  const url = new URL(location.href);
  if (url.searchParams.has('edit')) sessionStorage.setItem('edit-text', '1');
  if (url.searchParams.has('edit') || url.searchParams.has('key')) {
    url.searchParams.delete('edit');
    url.searchParams.delete('key');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  if (sessionStorage.getItem('edit-text') && teacherKey) startEditing(teacherKey);
}

export function stopEditing() {
  on = false;
  sessionStorage.removeItem('edit-text');
  document.body.classList.remove('editing');
  document.querySelectorAll('[data-edit][contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  document.getElementById('edit-bar')?.remove();
}

export function startEditing(teacherKey, { bar = true } = {}) {
  key = teacherKey;
  if (on) return;
  on = true;
  sessionStorage.setItem('edit-text', '1');
  document.body.classList.add('editing');
  if (bar && !document.getElementById('edit-bar')) {
    const el = document.createElement('div');
    el.id = 'edit-bar';
    el.className = 'edit-bar';
    el.innerHTML = '<span><b>Edit mode.</b> Click any outlined text to change it. Press Enter or click away to save; Esc cancels. Changes show on every screen.</span><span class="edit-msg" id="edit-msg"></span><button type="button" id="edit-done">Done editing</button>';
    document.body.prepend(el);
    el.querySelector('#edit-done').onclick = () => { stopEditing(); location.reload(); };
  }
  arm(document.body);
  new MutationObserver((changes) => { if (on) for (const c of changes) for (const n of c.addedNodes) if (n.nodeType === 1) arm(n); })
    .observe(document.body, { childList: true, subtree: true });
}

function arm(root) {
  const els = [...(root.matches?.('[data-edit]') ? [root] : []), ...root.querySelectorAll('[data-edit]')];
  for (const el of els) if (!el.isContentEditable) { el.setAttribute('contenteditable', 'plaintext-only'); el.spellcheck = true; }
}

const say = (text, bad = false) => {
  const m = document.getElementById('edit-msg');
  if (!m) return;
  m.textContent = text;
  m.classList.toggle('bad', bad);
};

async function save(el) {
  const text = el.innerText.replace(/ /g, ' ').trim();
  if (text === el.dataset.raw.trim()) { el.innerHTML = el.dataset.shown ?? el.innerHTML; return; }
  say('Saving…');
  try {
    const res = await fetch('/api/text', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': key }, body: JSON.stringify({ path: el.dataset.edit, text }) });
    const r = await res.json();
    if (!r.ok) throw new Error(r.error || 'Not saved.');
    el.dataset.raw = r.result.text;
    say(r.result.edited ? 'Saved.' : 'Back to the original wording.');
    dispatchEvent(new CustomEvent('text-edited', { detail: r.result })); // the page redraws with the new wording
  } catch (err) {
    el.innerHTML = el.dataset.shown ?? el.innerHTML;
    say(err.message || 'Not saved.', true);
  }
}

// In edit mode: show the raw wording while editing; keep clicks on a text inside a button from pressing it.
document.addEventListener('focusin', (e) => {
  const el = on && e.target.closest?.('[data-edit]');
  if (!el || el.dataset.editing) return;
  el.dataset.editing = '1';
  el.dataset.shown = el.innerHTML;
  // Plain text stays as it is, so the caret stays where it was clicked. Formatted text (**bold**, `code`) shows its
  // raw wording, which drops the caret: put it back at the end once the click is over, or typing goes nowhere.
  if (el.textContent === el.dataset.raw) return;
  el.textContent = el.dataset.raw;
  setTimeout(() => {
    if (document.activeElement !== el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  }, 0);
});
document.addEventListener('focusout', (e) => {
  const el = on && e.target.closest?.('[data-edit]');
  if (!el || !el.dataset.editing) return;
  delete el.dataset.editing;
  save(el);
});
document.addEventListener('keydown', (e) => {
  const el = on && e.target.closest?.('[data-edit]');
  if (!el) return;
  e.stopPropagation(); // no Next / Back / Space presses while typing
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
  if (e.key === 'Escape') { el.textContent = el.dataset.raw; el.blur(); }
}, true);
for (const type of ['mousedown', 'click']) {
  document.addEventListener(type, (e) => {
    // A button with editable text in it (an option, a label) is not pressed in edit mode, even on its padding.
    const btn = on && e.target.closest?.('button');
    if (btn && btn.querySelector('[data-edit]') && !e.target.closest('[data-edit]')) { e.preventDefault(); e.stopPropagation(); return; }
    const el = on && e.target.closest?.('[data-edit]');
    if (!el) return;
    e.stopPropagation();
    if (el.closest('button, a, label, summary')) {
      e.preventDefault();
      if (type === 'mousedown') el.focus();
    }
  }, true);
}
