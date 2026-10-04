// Monster Lab: the student page.
// One state object from /api/state, refetched whenever the server's {v, boot} changes.
import { PARTS, emoji, palette, renderMonsterCard } from '/monster.js';
import { renderGraph } from '/graph.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const short = (id) => String(id ?? '').slice(0, 7);
// Step copy uses **bold** and `code`.
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const fromName = (from) => (from === 'wall/main' ? 'the Wall' : from);

const PID_KEY = 'monsterLab.pid';
const NAME_KEY = 'monsterLab.name';
const MAIN_LOCKED = 'main is the approved monster. Make or switch to a sticky note first.';
const MERGE_OPEN = 'Finish or cancel the merge first.';

// The action row, in step order. Each unlocks at the step whose `unlocks` lists its id.
const ACTIONS = [
  { id: 'commit', words: 'Save card', cmd: 'git commit' },
  { id: 'branch', words: 'New sticky note', cmd: 'git switch -c' },
  { id: 'switch', words: 'Switch to', cmd: 'git switch', pick: true },
  { id: 'merge', words: 'Merge', cmd: 'git merge', pick: true, mainOnly: true },
  { id: 'push', words: 'Send to Wall', cmd: 'git push', mainOnly: true },
  { id: 'pull', words: 'Get & combine', cmd: 'git fetch\ngit merge', mainOnly: true },
  { id: 'reflog', words: 'Safety diary', cmd: 'git reflog' },
  { id: 'squash', words: 'Replace the Wall with one card', cmd: 'git push --force', danger: true, mainOnly: true },
];

const LEGEND = [
  ['commit', '<span>← points to the card before</span>'],
  ['commit', '<span><i class="sw note"></i>sticky note</span>'],
  ['commit', '<span><i class="sw you">YOU</i>where you are</span>'],
  ['wall', '<span><i class="sw wall"></i>the Wall, last time you checked</span>'],
  ['reflog', '<span><i class="sw diary"></i>only in the diary</span>'],
];

const SUMMARY = [
  [(c) => c.save, 'cards saved'], [(c) => (c.merge || 0) + (c.fastforward || 0), 'merges'],
  [(c) => c.conflict, 'conflicts solved'], [(c) => c.push, 'pushes'],
  [(c) => c.rejected, 'refused pushes'], [(c) => c.revert, 'reverts'],
];

const IDEAS = [
  ['save', 'Save a card', 'git commit'], ['branch', 'Make a sticky note', 'git branch'],
  ['switch', 'Switch notes', 'git switch'], ['fastforward', 'Slide a note forward', 'fast-forward'],
  ['merge', 'Combine two ideas', 'git merge'], ['conflict', 'Solve a conflict', 'merge conflict'],
  ['push', 'Send to the Wall', 'git push'], ['rejected', 'Get refused', 'rejected push'],
  ['pull', 'Get & combine', 'git pull'], ['revert', 'Undo with a fix card', 'git revert'],
  ['reset', 'Move a note back', 'git reset'], ['diary', 'Read the diary', 'git reflog'],
  ['force', 'Replace the Wall', 'git push --force'],
];

let pid = localStorage.getItem(PID_KEY) || '';
let state = null;
let V = null; // values derived from state, rebuilt on every render
let online = false;
let shownStep = null;
let joinLab = null;
const edits = new Map(); // part → value I just picked, shown until the server has it
const busy = new Set(); // actions waiting for the server
const picked = {}; // action → note chosen in its dropdown
const drawn = new Map(); // svg → what it last drew
let followUntil = 0; // right after my own action, show the newest cards even if I scrolled back
let cardOpen = null; // {id, repo}
let seenOp; // the last operation the student saw behind the door
let resolver = { key: '', choices: {}, another: null };
let breakTimer = null; // redraws the mission panel when the break ends

// ---------- Server ----------

async function call(path, body) {
  try {
    const res = await fetch(path, body && {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pid, ...body }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'Busy, press again.' };
  }
}

const get = (path, params = {}) => call(`${path}?${new URLSearchParams({ pid, ...params })}`);

// One fetch in flight, at most one queued.
let loading = null;
let queued = null;
function refresh() {
  if (!loading) return (loading = load().finally(() => { loading = null; }));
  return (queued ??= loading.then(() => { queued = null; return refresh(); }));
}

async function load() {
  const next = await get('/api/state');
  if (!next.session) return;
  state = next;
  render();
}

let events = null;
function listen() {
  events?.close();
  let seen = '';
  events = new EventSource(`/api/events?${new URLSearchParams({ pid })}`);
  events.onopen = () => { seen = ''; setOnline(true); };
  events.onerror = () => setOnline(false);
  events.onmessage = (e) => {
    const { v, boot } = JSON.parse(e.data);
    if (`${boot}:${v}` !== seen) { seen = `${boot}:${v}`; refresh(); }
  };
}

function setOnline(on) {
  online = on;
  if (V) renderTop();
}

// Run a student action, show the server's words, refetch.
async function act(path, body = {}, key = path) {
  if (busy.has(key)) return null;
  busy.add(key);
  followUntil = Date.now() + 3000;
  if (V) renderActions();
  const res = await call(`/api/${path}`, body);
  busy.delete(key);
  if (res.ok) {
    delete picked[key];
    const { message, nothing, already } = res.result || {};
    if (message) toast(message, nothing || already ? 'info' : 'good');
  } else {
    toast(res.error || 'Busy, press again.', 'bad');
  }
  await refresh();
  if (res.result?.conflict) openResolver();
  return res;
}

// ---------- Derived values ----------

function ancestors(byId, id) {
  const seen = new Set();
  const todo = id ? [id] : [];
  while (todo.length) {
    const c = byId.get(todo.pop());
    if (c && !seen.has(c.id)) { seen.add(c.id); todo.push(...c.parents); }
  }
  return seen;
}

function derive() {
  const { session, me, lab } = state;
  const s = session.steps[session.step];
  const byId = new Map((lab.graph?.commits || []).map((c) => [c.id, c]));
  const branches = lab.branches || {};
  const tip = branches[me.branch];
  const card = byId.get(tip)?.monster || {};
  const chaos = s.id === 'chaos';

  const draft = { ...(lab.drafts?.[me.branch] || {}) };
  for (const [part, value] of edits) {
    if (!chaos && value === card[part]) delete draft[part];
    else draft[part] = value;
  }
  const mine = ancestors(byId, tip);
  const others = Object.keys(branches).filter((n) => n !== me.branch)
    .sort((a, b) => mine.has(branches[a]) - mine.has(branches[b]) || a.localeCompare(b));

  return {
    n: session.step, s, chaos, wrap: s.id === 'wrap', byId, tip, mine, others,
    note: me.branch,
    locked: !chaos && me.branch === 'main' && (session.step === 2 || session.step === 3),
    monster: chaos ? { ...lab.chaos, ...draft } : { ...card, ...draft },
    unsaved: chaos ? [] : Object.keys(draft),
    merging: lab.merging?.[me.branch] || null,
    wallById: new Map((state.wall?.graph?.commits || []).map((c) => [c.id, c])),
    unlocked: (id) => session.steps.findIndex((x) => x.unlocks?.includes(id)) <= session.step,
    isNew: (id) => session.steps[session.step].unlocks?.includes(id),
  };
}

// ---------- Small DOM helpers ----------

function patch(el, html) {
  if (el.dataset.html === html) return;
  el.innerHTML = html;
  el.dataset.html = html;
  hydrate(el);
}

const slot = (monster, size = 'small') =>
  `<span class="mm" data-m="${esc(JSON.stringify(monster || {}))}" data-size="${size}"></span>`;

function hydrate(root) {
  for (const el of root.querySelectorAll('.mm')) renderMonsterCard(el, JSON.parse(el.dataset.m), { size: el.dataset.size });
}

// t in seconds (Git's author time).
function ago(t) {
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${plural(Math.round(s / 86400), 'day', 'days')} ago`;
}

function toast(text, tone = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = text;
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4450);
}

// ---------- Render ----------

function render() {
  const joined = Boolean(state.me && state.lab);
  $('join').hidden = joined;
  $('main').hidden = !joined;
  if (!joined) { V = null; renderJoin(); return; }

  if (state.session.step !== shownStep) {
    edits.clear();
    closePopover();
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
  }
  V = derive();
  renderTop();
  renderMission();
  renderBehind();
  renderWork();
  renderTable();
  if ($('resolver-dialog').open) V.merging ? renderResolver() : $('resolver-dialog').close();
  if ($('card-dialog').open) renderCard();
  shownStep = V.n;
}

function renderJoin() {
  patch($('join-labs'), state.session.labs.map((l) => `
    <button type="button" class="lab-pick" style="--lab:${esc(l.color)}" data-lab="${esc(l.id)}" aria-pressed="${l.id === joinLab}">
      <b>${esc(l.name)}</b><span>${l.members ? plural(l.members, 'person', 'people') : 'Nobody yet'}</span>
    </button>`).join(''));
}

function renderTop() {
  const { lab, me } = state;
  patch($('crumbs'), `
    <span class="lab-dot ${online ? '' : 'offline'}" style="--lab:${esc(lab.color)}" title="${online ? '' : 'Reconnecting…'}"></span>
    <b>${esc(lab.name)}</b> · ${esc(me.name)} · Step ${V.n} · ${esc(V.s.title)}`);
}

function renderMission() {
  const { s, n } = V;
  const goals = state.lab.goals || [];
  const next = goals.findIndex((g) => !g.done);
  const { breakUntil } = state.session;
  const resting = breakUntil > Date.now();
  clearTimeout(breakTimer);
  if (resting) breakTimer = setTimeout(() => V && renderMission(), breakUntil - Date.now() + 100);
  const pause = resting
    ? `<p class="break-line">Break · back at ${new Date(breakUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>` : '';
  const html = pause + (V.wrap
    ? `<p class="eyebrow">Step ${n}</p><h1>${esc(s.title)}</h1><p class="big-line">${esc(s.instruction)}</p>`
    : `<p class="eyebrow">Step ${n}</p>
      <h1>${esc(s.title)}</h1>
      ${s.fixedLine ? `<p class="fixed-line">${esc(s.fixedLine)}</p>` : ''}
      <p class="instruction">${rich(s.instruction)}</p>
      ${missionBox()}
      ${goals.length ? `<ul class="goals">${goals.map((g, i) =>
        `<li class="${g.done ? 'done' : i === next ? 'next' : ''}">${esc(g.text)}</li>`).join('')}</ul>` : ''}
      ${goals.length && next === -1 && s.bonus ? `<p class="bonus"><b>Bonus</b> · ${rich(s.bonus)}</p>` : ''}
      ${s.check ? `<p class="ask ${state.session.ask ? 'on' : ''}">We'll ask: <i>${esc(s.check)}</i></p>` : ''}`);
  const box = $('mission');
  patch(box, html);
  if (shownStep !== null && n !== shownStep) {
    box.classList.remove('fresh');
    void box.offsetWidth;
    box.classList.add('fresh');
  }
}

function missionBox() {
  const { me } = state;
  const pair = V.n === 2 && me.pair
    ? `<p class="pair">You're in Pair ${esc(me.pair)} (<button class="linkish" data-pair>change</button>)</p>` : '';
  if (!me.mission && !pair) return '';
  return `<div class="mission-box"><p class="label">Your mission</p>${me.mission ? `<p>${rich(me.mission)}</p>` : ''}${pair}</div>`;
}

// Behind the door: Problem → Idea → Git for this step, then what Git did last in this lab.
function renderBehind() {
  const behind = V.s.behind;
  $('behind').hidden = !behind;
  if (!behind) return;
  const op = state.lab.lastOp;
  if (seenOp === undefined || $('behind').open) seenOp = op?.t ?? null;
  $('behind').classList.toggle('fresh', Boolean(op) && op.t !== seenOp);
  const code = (cmds) => cmds.map((c) => `<code>${esc(c)}</code>`).join(' ');
  const lines = [['Problem', behind.problem], ['Idea', behind.idea], ['Git', behind.text]].filter(([, text]) => text);
  patch($('behind-body'), `
    <dl class="pig">${lines.map(([label, text]) => `<dt>${label}</dt><dd>${rich(text)}</dd>`).join('')}</dl>
    ${behind.cmds?.length ? `<p class="type">You'd type: ${code(behind.cmds)}</p>` : ''}
    ${op ? `<div class="last">
      <p class="who">Last · ${esc(op.who)}</p>
      <p>${esc(op.action)}${op.outcome ? ` → ${esc(op.outcome)}` : ''}</p>
      ${op.porcelain ? `<p>${code(op.porcelain.split('\n'))}</p>` : ''}
      ${op.explain ? `<p class="explain">${rich(op.explain)}</p>` : ''}
    </div>` : ''}`);
  const commands = op?.commands || [];
  $('plumbing').hidden = !commands.length;
  patch($('plumbing-list'), commands.map((c) => `
    <li class="${c.code ? 'bad' : ''}"><div class="cmd">${esc([].concat(c.cmd).join(' '))}</div>${
      c.out?.trim() ? `<div class="out">${esc(c.out.trim())}</div>` : ''}</li>`).join(''));
}

function renderWork() {
  const { chaos, wrap } = V;
  $('layout').classList.toggle('chaos', chaos);
  $('draft-title').textContent = chaos ? "Your lab's monster" : 'Your draft';
  $('on-note').hidden = chaos;
  patch($('on-note'), `You're on: <span class="note-chip">${esc(V.note)}</span>`);
  $('work').hidden = wrap;
  $('actions').hidden = wrap || chaos;
  $('table').hidden = chaos;
  $('wrap').hidden = !wrap;
  if (wrap) {
    $('banner').hidden = true;
    patch($('wrap'), wrapHTML());
    return;
  }
  renderBanner();
  renderDraft();
  renderActions();
}

function renderBanner() {
  const m = V.merging;
  $('banner').hidden = !m;
  if (!m) return;
  const parts = m.conflicts.map((p) => p.toUpperCase());
  const what = m.kind === 'revert' ? `Undoing card ${short(m.from)}.` : `Merging ${esc(fromName(m.from))} into ${esc(V.note)}.`;
  patch($('banner'), `<span><b>${what}</b> ${parts.join(' and ')} ${parts.length > 1 ? 'need' : 'needs'} a choice.</span>
    <button class="primary" data-open-resolver>Open</button>`);
}

function renderDraft() {
  for (const part of PARTS) {
    const btn = $('draft').querySelector(`[data-part="${part}"]`);
    const value = V.monster[part];
    const unsaved = V.unsaved.includes(part);
    const face = btn.querySelector('.part-emoji');
    const next = emoji(part, value);
    if (face.textContent !== next) {
      const changed = face.textContent !== '';
      face.textContent = next;
      if (changed) { face.classList.remove('pop'); void face.offsetWidth; face.classList.add('pop'); }
    }
    btn.querySelector('.part-value').textContent = value ?? '';
    btn.querySelector('.tag').hidden = !unsaved;
    btn.classList.toggle('unsaved', unsaved);
    btn.setAttribute('aria-label', `${part.toUpperCase()}: ${value}${unsaved ? ', not saved' : ''}. Change it`);
  }
  $('draft').classList.toggle('locked', V.locked);
  const count = V.unsaved.length;
  const status = $('draft-status');
  status.hidden = V.chaos;
  status.classList.toggle('unsaved', count > 0);
  status.textContent = V.locked ? MAIN_LOCKED : count ? `${plural(count, 'part', 'parts')} not saved yet` : 'All saved';
}

function renderActions() {
  const box = $('actions');
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return; // keep an open dropdown
  const shown = ACTIONS.filter((a) => V.unlocked(a.id)
    && (!a.pick || V.others.length)
    && (a.id !== 'squash' || state.session.bossLab === state.lab.id));
  // Off main, every main-only button reads "Switch to main first"; show that once.
  const offMain = (a) => a.mainOnly && V.note !== 'main';
  const fresh = shown.filter((a) => V.isNew(a.id));
  const old = shown.filter((a) => !V.isNew(a.id) && !(offMain(a) && fresh.some(offMain)));
  const row = (list, isNew) => [...new Set(list.map((a) => actionHTML(a, isNew)))].join('');
  patch(box, `
    ${fresh.length ? `<div class="actions-new">${row(fresh, true)}</div>` : ''}
    ${old.length ? `<div class="actions-old">${row(old, false)}</div>` : ''}`);
}

const pickFor = (id) => (V.others.includes(picked[id]) ? picked[id] : V.others[0]);

function actionHTML(a, isNew) {
  const offMain = a.mainOnly && V.note !== 'main';
  const id = offMain ? 'tomain' : a.id;
  const cls = `act ${isNew ? 'new' : 'old'}${a.danger && !offMain ? ' danger' : ''}${busy.has(a.id) || (offMain && busy.has('switch')) ? ' busy' : ''}`;
  const tag = isNew ? '<span class="new-tag">new</span>' : '';
  if (offMain) {
    return `<button class="${cls}" data-act="tomain"><span class="act-words">Switch to main first</span><code class="act-cmd">git switch main</code>${tag}</button>`;
  }
  if (!a.pick) {
    return `<button class="${cls}" data-act="${id}"><span class="act-words">${esc(a.words)}</span><code class="act-cmd">${esc(a.cmd)}</code>${tag}</button>`;
  }
  const choice = pickFor(a.id);
  const into = a.id === 'merge' ? ` into ${esc(V.note)}` : '';
  const options = V.others.map((n) => `<option${n === choice ? ' selected' : ''}>${esc(n)}</option>`).join('');
  return `<div class="${cls}">
      <button class="act-hit" data-act="${id}" aria-label="${esc(`${a.words} ${choice}`)}${into}"></button>
      <span class="act-words">${esc(a.words)} <select data-pick="${id}" aria-label="Which sticky note">${options}</select>${into}</span>
      <code class="act-cmd">${esc(a.cmd)}</code>${tag}
    </div>`;
}

function wrapHTML() {
  const c = state.lab.concepts;
  if (!c) return '';
  return `
    <h2>What your lab did</h2>
    <div class="stats">${SUMMARY.map(([count, label]) => `<div><b>${count(c) || 0}</b><span>${label}</span></div>`).join('')}</div>
    <div><h3>Git ideas you used</h3><ul class="concepts">${IDEAS.map(([k, words, term]) =>
      `<li class="${c[k] ? 'on' : ''}">${words} <code>${term}</code></li>`).join('')}</ul></div>`;
}

function renderTable() {
  if (V.chaos) return;
  draw($('graph'), $('graph-scroll'), state.lab.graph, { labels: true, you: V.note, onCardClick: (c) => openCard(c.id, 'lab') });
  patch($('legend'), LEGEND.filter(([id]) => V.unlocked(id)).map(([, html]) => html).join(''));
  const wall = state.wall?.graph;
  $('wall-block').hidden = !wall;
  if (wall) draw($('wall-graph'), $('wall-scroll'), wall, { compact: true, labels: true, onCardClick: (c) => openCard(c.id, 'wall') });
}

// Draw only when something changed. Keep the newest cards in view unless the student scrolled back;
// right after my own action (or on first draw), show where my sticky note is.
function draw(svg, scroller, graph, opts) {
  const key = JSON.stringify([graph, opts.you]);
  if (drawn.get(svg) === key) return;
  const mine = Date.now() < followUntil || !drawn.has(svg);
  const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 48;
  drawn.set(svg, key);
  renderGraph(svg, graph, opts);
  const pin = mine && [...svg.querySelectorAll('.g-note')].find((n) => n.dataset.key === opts.you);
  const x = pin ? Number(pin.dataset.x) : Infinity;
  if (x < scroller.scrollWidth - scroller.clientWidth) scroller.scrollLeft = x - scroller.clientWidth / 3;
  else if (mine || atEnd) scroller.scrollLeft = scroller.scrollWidth;
}

// ---------- Popover (palette, new note) ----------

let popAnchor = null;

function openPopover(anchor, html) {
  closePopover();
  const pop = $('popover');
  pop.innerHTML = html;
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const { offsetWidth: w, offsetHeight: h } = pop;
  let left = r.right + 14;
  let top = r.top;
  if (left + w > innerWidth - 12) {
    left = Math.min(Math.max(12, r.left), innerWidth - w - 12);
    top = r.bottom + 8;
  }
  top = Math.max(76, Math.min(top, innerHeight - h - 12));
  pop.style.left = `${left + scrollX}px`;
  pop.style.top = `${top + scrollY}px`;
  popAnchor = anchor;
  anchor.classList.add('open');
  return pop;
}

function closePopover() {
  $('popover').hidden = true;
  popAnchor?.classList.remove('open');
  popAnchor = null;
}

function openPalette(anchor, part) {
  const current = V.monster[part];
  const pop = openPopover(anchor, `
    <p class="eyebrow">${part.toUpperCase()}</p>
    <div class="choices">${palette(V.n)[part].map((slug) => `
      <button class="choice${slug === current ? ' current' : ''}" data-slug="${slug}" aria-label="${slug}">
        <span class="e">${emoji(part, slug)}</span><span>${slug}</span>
      </button>`).join('')}</div>`);
  pop.querySelector('.current, .choice')?.focus();
  pop.onclick = (e) => {
    const choice = e.target.closest('[data-slug]');
    if (!choice) return;
    closePopover();
    anchor.focus();
    pickPart(part, choice.dataset.slug);
  };
}

async function pickPart(part, value) {
  if (V.monster[part] === value) return;
  edits.set(part, value);
  render();
  const res = await call(V.chaos ? '/api/chaos' : '/api/draft', { part, value });
  if (!res.ok) toast(res.error, 'bad');
  await refresh();
  if (edits.get(part) === value) edits.delete(part);
  if (V) render();
}

function openNewNote(anchor) {
  const name = V.n === 2 ? state.me.pairNote || '' : '';
  const pop = openPopover(anchor, `
    <form class="new-note">
      <p class="eyebrow">New sticky note</p>
      <input name="name" value="${esc(name)}" maxlength="20" autocomplete="off" spellcheck="false" aria-label="Name of the sticky note">
      <code>git switch -c <span>${esc(name)}</span> main</code>
      <button class="primary">Make sticky note</button>
    </form>`);
  const input = pop.querySelector('input');
  input.focus();
  input.select();
  input.oninput = () => { pop.querySelector('code span').textContent = input.value.trim().toLowerCase(); };
  pop.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await act('branch', { name: input.value });
    if (res?.ok) closePopover();
  };
}

// ---------- Dialogs ----------

function show(id) {
  const d = $(id);
  if (!d.open) d.showModal();
  return d;
}

const dialogBody = (id) => $(id).querySelector('.dialog-body');

function confirmThen(question, yes, run) {
  const d = $('confirm-dialog');
  dialogBody('confirm-dialog').innerHTML = `
    <h2>${esc(question)}</h2>
    <div class="confirm-actions"><button class="quiet" data-close>Cancel</button><button class="primary danger" data-yes>${esc(yes)}</button></div>`;
  d.querySelector('[data-yes]').onclick = () => { d.close(); run(); };
  show('confirm-dialog');
}

// Card details.
function openCard(id, repo) {
  cardOpen = { id, repo };
  renderCard(true);
  show('card-dialog');
}

function renderCard(fresh = false) {
  const { id, repo } = cardOpen;
  const c = (repo === 'wall' ? V.wallById : V.byId).get(id);
  if (!c) { $('card-dialog').close(); return; }
  const parents = c.parents.map((p) => `<button class="id-chip" data-goto="${p}">${short(p)}</button>`).join('')
    || '<span class="muted">None. This is the Start card.</span>';
  const where = repo === 'wall' ? 'On the Wall' : c.reachable === false ? 'Only in the safety diary' : '';
  const html = `
    <div class="card-top">
      <div class="card-monster">${slot(c.monster, 'large')}</div>
      <div class="card-meta">
        <p class="card-id">${short(c.id)}<small>${c.id}</small></p>
        <p class="card-msg">${esc(c.message)}</p>
        <dl class="facts">
          <dt>Made by</dt><dd>${esc(c.author)}${c.time ? ` · ${ago(c.time)}` : ''}</dd>
          <dt>${c.parents.length > 1 ? 'Parents' : 'Parent'}</dt><dd>${parents}</dd>
          ${where ? `<dt>Where</dt><dd>${where}</dd>` : ''}
        </dl>
      </div>
    </div>
    <details class="stored"><summary>Show what Git stored</summary><div class="stored-body"></div></details>
    ${repo === 'lab' && V.unlocked('revert') && !V.wrap ? cardActions(c) : ''}`;
  const body = dialogBody('card-dialog');
  if (!fresh && body.dataset.html === html) return;
  const stored = body.querySelector('.stored');
  const keep = !fresh && stored?.open ? stored.querySelector('.stored-body').innerHTML : null;
  patch(body, html);
  if (keep) { body.querySelector('.stored').open = true; body.querySelector('.stored-body').innerHTML = keep; }
}

function cardActions(c) {
  const undoWhy = !c.parents.length ? "The Start card can't be undone."
    : !V.mine.has(c.id) ? `This card isn't in ${V.note}'s history.` : '';
  const moveWhy = c.id === V.tip ? `${V.note} is already here.` : '';
  const cls = V.isNew('revert') ? 'act new' : 'act';
  return `<div class="card-actions">
      <button class="${cls}" data-card-act="revert" ${undoWhy ? 'disabled' : ''}>
        <span class="act-words">Undo this card</span><code class="act-cmd">git revert ${short(c.id)}</code></button>
      <button class="${cls}" data-card-act="reset" ${moveWhy ? 'disabled' : ''}>
        <span class="act-words">Move my note back here</span><code class="act-cmd">git reset --hard ${short(c.id)}</code></button>
      ${[undoWhy, moveWhy].filter(Boolean).map((w) => `<p class="why">${esc(w)}</p>`).join('')}
    </div>`;
}

async function loadStored(details) {
  const box = details.querySelector('.stored-body');
  if (box.childElementCount) return;
  box.innerHTML = '<p class="muted">Opening the card…</p>';
  const res = await get('/api/inspect', { commit: cardOpen.id, repo: cardOpen.repo });
  if (!res.ok) { box.innerHTML = `<p class="muted">${esc(res.error)}</p>`; return; }
  box.innerHTML = (res.op?.commands || []).map((c) =>
    `<div class="cmd">${esc([].concat(c.cmd).join(' '))}</div><pre>${esc(c.out?.trim())}</pre>`).join('');
}

// Safety diary.
async function openDiary() {
  const body = dialogBody('diary-dialog');
  const note = V.note;
  body.innerHTML = `<h2>Safety diary <code class="muted">git reflog</code></h2><p class="muted">Opening the diary…</p>`;
  show('diary-dialog');
  const res = await get('/api/reflog');
  if (!res.ok) { $('diary-dialog').close(); toast(res.error, 'bad'); return; }
  const entries = res.result?.entries || [];
  patch(body, `
    <h2>Safety diary <code class="muted">git reflog</code></h2>
    <p class="muted">Every place ${esc(note)} has been. Newest first.</p>
    <ol class="diary">${entries.map((e) => `
      <li><button data-goto="${e.id}">
        <span class="when">${new Date(e.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        ${slot(V.byId.get(e.id)?.monster, 'tiny')}
        <span class="what"><code>${short(e.id)}</code><span>${esc(e.message)}</span></span>
      </button></li>`).join('')}</ol>`);
}

// Conflict resolver: one row per part; conflicted parts need a choice.
function openResolver() {
  const m = V?.merging;
  if (!m) return;
  const key = `${m.t}:${m.intoTip}:${m.theirs}`;
  if (resolver.key !== key) resolver = { key, choices: {}, another: null };
  renderResolver();
  show('resolver-dialog');
}

function renderResolver() {
  const m = V.merging;
  const revert = m.kind === 'revert';
  const ours = revert ? 'Now' : V.note;
  const theirs = revert ? `Before ${short(m.from)}` : fromName(m.from);
  const sides = revert ? [[ours, m.ours], [theirs, m.theirsMonster]] : [['At start', m.base], [ours, m.ours], [theirs, m.theirsMonster]];
  const { choices, another } = resolver;
  const ready = m.conflicts.every((p) => choices[p]);

  const option = (part, value, label) => `
    <button class="opt${choices[part] === value ? ' chosen' : ''}" data-choose="${part}" data-slug="${esc(value)}">
      <span class="e">${emoji(part, value)}</span>${esc(value)}${label ? ` <small>(${esc(label)})</small>` : ''}</button>`;
  const rows = PARTS.map((part) => {
    if (!m.conflicts.includes(part)) {
      const value = m.auto?.[part] ?? m.ours[part];
      return `<div class="rrow auto"><span class="pname">${part.toUpperCase()}</span><span class="val">${emoji(part, value)} ${esc(value)}</span></div>`;
    }
    const sideValues = [m.ours[part], m.theirsMonster[part]];
    const own = choices[part] && !sideValues.includes(choices[part]);
    return `<div class="rrow conflict"><span class="pname">${part.toUpperCase()}</span>
      <div class="opts">
        ${option(part, m.ours[part], ours)}${option(part, m.theirsMonster[part], theirs)}
        ${own ? option(part, choices[part], 'your pick') : ''}
        <button class="opt" data-another="${part}" aria-expanded="${another === part}">Pick another…</button>
      </div>
      ${another === part ? `<div class="choices">${palette(V.n)[part].map((slug) => `
        <button class="choice${choices[part] === slug ? ' current' : ''}" data-choose="${part}" data-slug="${slug}">
          <span class="e">${emoji(part, slug)}</span><span>${slug}</span></button>`).join('')}</div>` : ''}
    </div>`;
  }).join('');

  const marked = esc(m.conflictedText || '').split('\n')
    .map((line) => (/^(<{7}|={7}|>{7})/.test(line) ? `<span class="mark">${line}</span>` : line)).join('\n');
  const body = dialogBody('resolver-dialog');
  const behindOpen = body.querySelector('.resolver-behind')?.open;
  patch(body, `
    <h2>${revert ? `Undoing card ${short(m.from)}` : `Merging ${esc(theirs)} into ${esc(V.note)}`}</h2>
    <p>Both sides changed these parts since the start. Pick one for each.</p>
    <div class="resolver-sides">${sides.map(([label, monster]) => `<div class="side">${slot(monster, 'small')}<span>${esc(label)}</span></div>`).join('')}</div>
    <div class="resolver-rows">${rows}</div>
    <div class="resolver-foot">
      <button class="primary big" data-finish ${ready ? '' : 'disabled'}>Finish merge</button>
      <button class="quiet" data-abort>Cancel merge<code>git ${revert ? 'revert' : 'merge'} --abort</code></button>
    </div>
    <details class="resolver-behind"${behindOpen ? ' open' : ''}>
      <summary>Behind the door · the file Git wrote</summary>
      <p>Git marks each clash in monster.txt. You choose; Git saves the card.</p>
      <pre class="conflict-text">${marked}</pre>
    </details>`);
}

function finishMerge() {
  const m = V.merging;
  const monster = Object.fromEntries(PARTS.map((p) =>
    [p, m.conflicts.includes(p) ? resolver.choices[p] : m.auto?.[p] ?? m.ours[p]]));
  return act('resolve', { monster });
}

// ---------- Events ----------

function wire() {
  $('draft').innerHTML = PARTS.map((part) => `
    <button class="part" data-part="${part}">
      <span class="part-emoji" aria-hidden="true"></span>
      <span class="part-text"><span class="part-name">${part.toUpperCase()}</span><span class="part-value"></span></span>
      <span class="tag" hidden>not saved</span>
    </button>`).join('');

  $('join-labs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lab]');
    if (!btn) return;
    joinLab = btn.dataset.lab;
    $('join-error').textContent = '';
    renderJoin();
  });
  $('join-name').value = localStorage.getItem(NAME_KEY) || '';
  $('join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('join-name').value.trim();
    const error = !/[\p{L}\p{N}]/u.test(name) ? 'Type your name (a letter or digit).' : !joinLab ? 'Pick your lab.' : '';
    $('join-error').textContent = error;
    if (error) return;
    const res = await call('/api/join', { name, labId: joinLab });
    if (!res.ok) { $('join-error').textContent = res.error; return; }
    pid = res.pid;
    localStorage.setItem(PID_KEY, pid);
    localStorage.setItem(NAME_KEY, name);
    listen();
    refresh();
  });

  $('mission').addEventListener('click', (e) => {
    if (e.target.closest('[data-pair]')) act('pair');
  });

  $('draft').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-part]');
    if (!btn || !V) return;
    if (popAnchor === btn) { closePopover(); return; }
    if (V.locked) { toast(MAIN_LOCKED); return; }
    if (!V.chaos && V.merging) { toast(MERGE_OPEN); return; }
    openPalette(btn, btn.dataset.part);
  });

  $('behind').addEventListener('toggle', () => { if ($('behind').open && V) renderBehind(); });

  $('banner').addEventListener('click', (e) => { if (e.target.closest('[data-open-resolver]')) openResolver(); });

  $('actions').addEventListener('change', (e) => {
    const id = e.target.dataset.pick;
    if (id) picked[id] = e.target.value;
  });
  $('actions').addEventListener('focusout', () => { if (V) setTimeout(renderActions); });
  $('actions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const run = {
      commit: () => act('commit'),
      branch: () => (popAnchor === btn ? closePopover() : openNewNote(btn)),
      switch: () => act('switch', { branch: pickFor('switch') }),
      tomain: () => act('switch', { branch: 'main' }),
      merge: () => act('merge', { from: pickFor('merge') }),
      push: () => act('push'),
      pull: () => act('pull'),
      reflog: () => openDiary(),
      squash: () => confirmThen("This erases the Wall's history for everyone. Sure?", 'Replace the Wall', () => act('squash-force', {}, 'squash')),
    };
    run[btn.dataset.act]?.();
  });

  $('card-dialog').addEventListener('click', async (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) openCard(goto.dataset.goto, cardOpen.repo);
    const action = e.target.closest('[data-card-act]');
    if (action) {
      const res = await act(action.dataset.cardAct, { commit: cardOpen.id });
      if (res?.ok) $('card-dialog').close();
    }
  });
  $('card-dialog').addEventListener('toggle', (e) => { if (e.target.matches('.stored') && e.target.open) loadStored(e.target); }, true);

  $('diary-dialog').addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto && V.byId.has(goto.dataset.goto)) { $('diary-dialog').close(); openCard(goto.dataset.goto, 'lab'); }
  });

  $('resolver-dialog').addEventListener('click', async (e) => {
    const choose = e.target.closest('[data-choose]');
    const another = e.target.closest('[data-another]');
    if (choose) {
      resolver.choices[choose.dataset.choose] = choose.dataset.slug;
      if (resolver.another === choose.dataset.choose && e.target.closest('.choices')) resolver.another = null;
      renderResolver();
    } else if (another) {
      resolver.another = resolver.another === another.dataset.another ? null : another.dataset.another;
      renderResolver();
    } else if (e.target.closest('[data-finish]')) {
      if ((await finishMerge())?.ok) $('resolver-dialog').close();
    } else if (e.target.closest('[data-abort]')) {
      if ((await act('abort'))?.ok) $('resolver-dialog').close();
    }
  });

  // Close dialogs from the × button or a click on the backdrop.
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => {
      const r = d.getBoundingClientRect();
      const outside = e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
      if (outside || e.target.closest('[data-close]')) d.close();
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (popAnchor && !$('popover').contains(e.target) && !popAnchor.contains(e.target)) closePopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popAnchor) { const a = popAnchor; closePopover(); a.focus(); }
  });
  addEventListener('resize', closePopover);
}

wire();
listen();
refresh();
