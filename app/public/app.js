// Outfit Lab: the student page.
// One state object from /api/state, refetched whenever the server's {v, boot} changes.
// The teacher's Next moves the scene. Join, task, reveal and break scenes show the lab's work;
// the paper, the exit question and the wrap show one full-width card.
import { PARTS, emoji, nameOf, palette, renderMonsterCard } from '/monster.js';
import { renderGraph, plainMessage, clockOf, velocity, pathBadges } from '/graph.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const short = (id) => String(id ?? '').slice(0, 7);
// Copy uses **bold** and `code`. "TOP → 🎽" never breaks.
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>')
  .replaceAll(' → ', '&nbsp;→&nbsp;');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const fromName = (from) => (from === 'wall/main' ? 'the Wall' : from);
const list = (words, type = 'conjunction') => new Intl.ListFormat('en', { type }).format(words);
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const KEY = {
  pid: 'outfitLab.pid', name: 'outfitLab.name', tour: 'outfitLab.tour', tips: 'outfitLab.tips',
  changed: 'outfitLab.changed', // this student has changed a part once: the "click a part" line goes
};
const MERGE_OPEN = 'Finish or cancel the merge first.'; // the server's words; the page adds where to press
const ANSWER_MAX = 280; // the server's limits
const TAKEAWAY_MAX = 100;
const CARD_SCENES = new Set(['paper', 'exit', 'wrap']); // one full-width card instead of the lab's work

// The action row, in step order. Each unlocks at the step whose `unlocks` lists its id.
// Step 4's two ways to get the Wall's cards (way) sit side by side, as one choice.
const ACTIONS = [
  { id: 'commit', words: 'Save card', cmd: 'git commit' },
  { id: 'branch', words: 'New branch', cmd: 'git switch -c' },
  { id: 'switch', words: 'Switch to', cmd: 'git switch', pick: true },
  { id: 'merge', words: 'Merge', cmd: 'git merge', pick: true, mainOnly: true },
  { id: 'deleteNote', words: 'Delete branch', cmd: 'git branch -d', pick: true },
  { id: 'push', words: 'Send to Wall', cmd: 'git push', mainOnly: true },
  { id: 'pull', words: 'Get & combine', cmd: 'git pull --no-rebase', mainOnly: true, way: 'merge' },
  { id: 'rebase', words: 'Replay on top', cmd: 'git pull --rebase', mainOnly: true, way: 'rebase' },
  { id: 'reflog', words: 'Safety diary', cmd: 'git reflog' },
  { id: 'squash', words: 'Replace the Wall with one card', cmd: 'squash + git push --force', danger: true, mainOnly: true },
];
const DIARY_LABEL = 'only in your safety diary (reflog)';

const LEGEND = [
  ['commit', '<span>← points to the card before</span>'],
  ['branch', '<span><i class="sw note"></i>branch</span>'],
  ['branch', '<span><i class="sw you">YOU</i>your pin (HEAD): the branch you\'re on</span>'],
  ['wall', '<span><i class="sw wall"></i>the Wall, last time you checked</span>'],
];

// The wrap: [concept, one, many]. Merges count merge cards only; fast-forwards made none.
const SUMMARY = [
  ['save', 'card saved', 'cards saved'], ['merge', 'merge', 'merges'], ['conflict', 'conflict solved', 'conflicts solved'],
  ['push', 'send to the Wall', 'sends to the Wall'], ['rejected', 'refused send', 'refused sends'], ['revert', 'undo', 'undos'],
];

// [concept, plain words, the command its button showed]
const IDEAS = [
  ['save', 'Save a card', 'git commit'], ['branch', 'Make a branch', 'git switch -c'],
  ['switch', 'Switch branches', 'git switch'], ['fastforward', 'Fast-forward a branch', 'git merge'],
  ['merge', 'Combine two ideas', 'git merge'], ['conflict', 'Solve a conflict', 'git merge + git commit'],
  ['push', 'Send to the Wall', 'git push'], ['rejected', 'Have a send refused', 'git push'],
  ['pull', 'Get & combine', 'git pull --no-rebase'], ['rebase', 'Replay on top', 'git pull --rebase'],
  ['revert', 'Undo with a fix card', 'git revert'],
  ['reset', 'Move a branch back', 'git reset'], ['diary', 'Read the diary', 'git reflog'],
  ['force', 'Replace the Wall', 'git push --force'],
];

let pid = localStorage.getItem(KEY.pid) || '';
let state = null;
let V = null; // values derived from state, rebuilt on every render
let online = false;
let shown = { step: null, scene: null, lab: null }; // what the page drew last
const edits = new Map(); // part → value I just picked, shown until the server has it
const busy = new Set(); // actions waiting for the server
const picked = {}; // action → note chosen in its dropdown
const drawn = new Map(); // svg → what it last drew
const expanded = new Set(); // graphs opened in full with "← N older cards", until the step changes
let followUntil = 0; // right after my own action, show the newest cards even if I scrolled back
let cardOpen = null; // {id, repo}
let seenOp; // the last operation the student saw behind the door
let resolver = { key: '', choices: {}, another: null };
let changed = localStorage.getItem(KEY.changed) === '1';
let hintLevel = 0; // Stuck? Hint: 0 = the button, 1 = the idea, 2 = the exact click
let hintIdea = null; // the idea last seen: a new situation shows its idea first
let hintWasReady = false;
let clockSkew = 0; // the server's clock minus this one: the hint is timed by the server
let predictRun = null; // what runs once the student who pressed has predicted
let lastHint = null;
let ticks = []; // each goal's done flag when last drawn, so a new tick gets a small pop
let pathLab = null; // the lab whose integration path the Wall shows, once the student picks one

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
  if (next.now) clockSkew = next.now - Date.now();
  state = next;
  render();
}

// Some proxies buffer the live stream: poll whenever it has been quiet for a few seconds.
let events = null;
let lastEvent = 0;
setInterval(() => { if (pid && Date.now() - lastEvent > 4000) refresh(); }, 2000);
function listen() {
  events?.close();
  let seen = '';
  events = new EventSource(`/api/events?${new URLSearchParams({ pid })}`);
  events.onopen = () => { seen = ''; setOnline(true); };
  events.onerror = () => setOnline(false);
  events.onmessage = (e) => {
    lastEvent = Date.now();
    const { v, boot } = JSON.parse(e.data);
    if (`${boot}:${v}` !== seen) { seen = `${boot}:${v}`; refresh(); }
  };
}

function setOnline(on) {
  online = on;
  if (V) renderTop();
}

// A refusal always says what to press next. An open merge has its Open button on the red bar.
const nextMove = (error) => (error === MERGE_OPEN && V?.merging ? `${MERGE_OPEN} Press Open on the red bar.` : error);

// Run a student action, show the server's words, refetch. A Merge (Step 3) or a Send (Steps 4–5) the server
// wants predicted first comes back with {predict}: the prediction dialog opens, and the action runs after it.
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
    else clearBadToast();
  } else if (!res.predict) {
    toast(nextMove(res.error) || 'Busy, press again.', res.tone || 'bad');
  }
  await refresh();
  const asked = res.predict && state.lab?.moments?.find((m) => m.id === res.predict);
  if (asked) askPredict(asked, (guess) => act(path, { ...body, guess }, key));
  if (res.result?.conflict) openResolver();
  return res;
}

// Merge and Send: predict first, in one tap, unless I already predicted in the panel.
function predicted(kind, target, path, body = {}, key = path) {
  const m = state.lab.moments?.find((x) => x.kind === kind && (kind !== 'merge' || x.target === target));
  if (m && !m.mine) return askPredict(m, (guess) => act(path, { ...body, guess }, key));
  return act(path, body, key);
}

function askPredict(m, run) {
  predictRun = run;
  patch(dialogBody('predict-dialog'), `
    <p class="eyebrow">Predict first</p>
    <h2>${esc(m.title)}</h2>
    <p class="predict-q">${esc(m.q)}</p>
    <div class="predict-options">${m.options.map((o) => `<button class="opt" data-guess="${esc(o.id)}">${esc(o.words)}</button>`).join('')}</div>
    <p class="small muted">${esc(m.tip)} Git runs once you choose.</p>`);
  show('predict-dialog');
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
    n: session.step, s, scene: session.scene, card: CARD_SCENES.has(session.scene.kind), chaos, byId, tip, mine, others,
    note: me.branch,
    // A note can be deleted once the branch you're on has its card (git branch -d); main stays.
    deletable: others.filter((n) => n !== 'main' && mine.has(branches[n])),
    locked: !chaos && me.branch === 'main' && Boolean(s.mainLocked),
    monster: chaos ? { ...lab.chaos, ...draft } : { ...card, ...draft },
    unsaved: chaos ? [] : Object.keys(draft),
    merging: lab.merging?.[me.branch] || null,
    wallById: new Map((state.wall?.graph?.commits || []).map((c) => [c.id, c])),
    unlocked: (id) => session.steps.findIndex((x) => x.unlocks?.includes(id)) <= session.step,
    isNew: (id) => s.unlocks?.includes(id),
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
  if (s < 45) return 'a moment ago';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${plural(Math.round(s / 86400), 'day', 'days')} ago`;
}

// One toast at a time; the newest wins. A bad one (refused, errors) stays until closed or the next success.
// While a dialog is open, the toast shows at the dialog's foot, so it never covers the dialog.
function toast(text, tone = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.append(text);
  if (tone === 'bad') {
    const close = document.createElement('button');
    Object.assign(close, { className: 'toast-close', textContent: '×', onclick: () => el.remove() });
    close.setAttribute('aria-label', 'Close');
    el.append(close);
  } else {
    setTimeout(() => el.classList.add('out'), 4000);
    setTimeout(() => el.remove(), 4250);
  }
  const box = $('toasts');
  (document.querySelector('dialog[open]') ?? document.body).append(box);
  box.replaceChildren(el);
}

const clearBadToast = () => $('toasts').querySelector('.toast.bad')?.remove();

function closeDialogs() {
  closePopover();
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
}

// ---------- Render ----------

function render() {
  const joined = Boolean(state.me && state.lab);
  $('join').hidden = joined;
  $('main').hidden = !joined;
  if (!joined) { V = null; tour = null; coach(); return; }

  const { step, scene } = state.session;
  if (step !== shown.step) {
    $('toasts').replaceChildren();
    edits.clear();
    expanded.clear();
    closeDialogs();
  }
  if (scene.id !== shown.scene) hintLevel = 0;
  const idea = state.me?.hint?.idea ?? null;
  if (idea !== hintIdea) { if (hintLevel === 2) hintLevel = 1; hintIdea = idea; }
  if (shown.lab && shown.lab !== state.me.labId) toast(`You're in ${state.lab.name} now. The app keeps the labs even.`);
  const wasCard = V?.card;
  V = derive();
  // A new step, or the switch to a full-width card, starts at the top, where its words are.
  if (shown.step !== null && (step !== shown.step || V.card !== wasCard)) scrollTo(0, 0);
  renderTop();
  $('layout').hidden = V.card;
  $('scene').hidden = !V.card;
  if (V.card) {
    if (scene.id !== shown.scene) closeDialogs();
    renderScene();
  } else {
    renderPanel();
    renderReveal();
    renderWork();
    renderTable();
    if ($('resolver-dialog').open) V.merging ? renderResolver() : $('resolver-dialog').close();
    if ($('card-dialog').open) renderCard();
  }
  renderQA();
  showHint();
  shown = { step, scene: scene.id, lab: state.me.labId };
  if (!tour && !V.card && !localStorage.getItem(KEY.tour)) startTour();
  coach();
}

function renderTop() {
  const { lab, me, session: { scene } } = state;
  patch($('crumbs'), `
    <span class="lab-dot ${online ? '' : 'offline'}" style="--lab:${esc(lab.color)}" title="${online ? '' : 'Reconnecting…'}"></span>
    <b>${esc(lab.name)}</b> · ${esc(me.name)} · ${esc(scene.kind === 'join' ? 'Getting ready' : scene.title)}`);
  $('tour-again').hidden = V.card;
}

// ---------- The panel: what to do now ----------

function renderPanel() {
  const { kind, id } = V.scene;
  const { goals, done } = state.lab;
  V.just = new Set(goals.flatMap((g, i) => (g.done && ticks[i] === false && shown.step === V.n ? [i] : [])));
  ticks = goals.map((g) => g.done);

  const box = $('mission');
  patch(box, kind === 'join' ? welcomeHTML() : kind === 'reveal' ? revealHTML() : breakHTML() + taskHTML());
  if (shown.scene !== null && id !== shown.scene) {
    box.classList.remove('fresh');
    void box.offsetWidth;
    box.classList.add('fresh');
  }
  // At a reveal, a lab that isn't done can still open its step.
  const again = kind === 'reveal' && goals.length > 0 && !done;
  $('again').hidden = !again;
  patch($('again').querySelector('summary'), again ? `Not done yet? Step ${V.n} · ${goals.filter((g) => g.done).length}/${goals.length}` : '');
  patch($('again-body'), again ? taskHTML() : '');
  renderBehind();
  fitMission();
}

function welcomeHTML() {
  const { lab, me } = state;
  return `<p class="eyebrow">Welcome</p>
    <h1>You're in ${esc(lab.name)}</h1>
    <p class="instruction">Your lab dresses one character together. The class starts in a moment.</p>
    <div class="mates"><p class="label">In ${esc(lab.name)}</p><ul>${lab.members.map((m) =>
      `<li class="${m.online ? 'on' : ''}">${esc(m.name)}${m.pid === me.pid ? ' <span class="muted">(you)</span>' : ''}</li>`).join('')}</ul></div>
    <p class="small muted">Labs can still change until Step 1.</p>`;
}

// At a reveal the panel holds its title; the question and takeaway follow (renderQA). The card is on the stage.
function revealHTML() {
  const [step, title] = V.scene.title.split(' · ');
  return `<p class="eyebrow">${esc(step)}</p><h1>${esc(title ?? step)}</h1>`;
}

// The reveal on the stage, as on the projector: each tool's technical card (the command, then what it is,
// what it does, how Git does it). Step 0 has no tool: one sentence and Behind the door.
const TECH = [['is', 'What it is'], ['does', 'What it does'], ['how', 'How Git does it']];
function renderReveal() {
  const r = V.scene.kind === 'reveal' ? V.scene.reveal : null;
  $('layout').classList.toggle('revealing', Boolean(r));
  $('reveal').hidden = !r;
  patch($('reveal'), r ? `
    ${r.cards.map((c) => `<article class="tech">
        <h2 class="tech-cmd"><code>${esc(c.command)}</code></h2>
        <dl class="tech-rows">${TECH.map(([key, label]) => `<dt class="${key}">${label}</dt><dd class="${key}">${rich(c[key])}</dd>`).join('')}</dl>
      </article>`).join('')}
    ${r.sentence ? `<p class="reveal-sentence">${rich(r.sentence)}</p>` : ''}
    ${r.behind ? `<p class="reveal-behind"><b>What Git did</b>${rich(r.behind)}</p>` : ''}
    ${r.note ? `<p class="tech-note">${rich(r.note)}</p>` : ''}
    ${(V.scene.facts ?? []).map((f) => `<p class="reveal-fact">${esc(f)}</p>`).join('')}` : '');
}

// The break keeps the step's work on screen: labs can still finish.
function breakHTML() {
  if (V.scene.kind !== 'break') return '';
  const { startedAt, minutes } = state.session.timer;
  return `<p class="break-line">Break · back at ${clock(startedAt + minutes * 60e3)}</p>`;
}

function taskHTML() {
  const { s, n } = V;
  const { goals, done } = state.lab;
  const next = goals.findIndex((g) => !g.done);
  const ask = state.session.ask && !V.scene.answerable ? `<p class="ask on">Discuss: <i>${esc(state.session.ask)}</i></p>` : '';
  return `<p class="eyebrow">Step ${n}</p>
    <h1>${esc(s.title)}</h1>
    ${s.fixedLine ? `<p class="fixed-line">${esc(s.fixedLine)}</p>` : ''}
    ${s.story ? `<div class="instruction story">
      <p><span class="story-label">What is happening</span><span>${rich(s.story.now)}</span></p>
      <p class="${state.me.mission ? 'mission-box' : ''}"><span class="story-label">Your job</span>${steps(state.me.mission || s.story.job)}${pairLine()}</p>
      <p><span class="story-label">In Git</span><span>${rich(s.story.git)}</span></p></div>` : `<p class="instruction">${rich(s.instruction)}</p>${missionBox()}`}
    ${s.fresh ? `<p class="fresh-line">${esc(s.fresh)}</p>` : ''}
    ${verdictHTML()}
    ${predictHTML()}
    ${goals.length ? `<ul class="goals">${goals.map((g, i) => `<li class="${
      [g.done ? 'done' : i === next ? 'next' : '', V.just.has(i) ? 'just' : ''].join(' ').trim()}">${esc(g.text)}</li>`).join('')}</ul>` : ''}
    ${done ? doneHTML() : hintHTML()}
    ${ask}`;
}

// A job written as "1. … 2. …" shows one line per click.
function steps(text) {
  const parts = text.split(/\s(?=\d+\.\s)/);
  if (parts.length < 2) return `<span>${rich(text)}</span>`;
  return `<span class="steps">${parts.map((x) => `<span>${rich(x)}</span>`).join('')}</span>`;
}

// Step 2 only: which pair you are in, with a way to swap.
function pairLine() {
  const { me, lab } = state;
  if (V.n !== 2 || !me.pair || me.both) return '';
  const partners = lab.members.filter((m) => m.pair === me.pair && m.pid !== me.pid && m.online).map((m) => m.name);
  return `<span class="pair">You're in Pair ${esc(me.pair)}${partners.length ? ` with ${esc(list(partners))}` : ', on your own'}
    (<button class="linkish" data-pair>change</button>)</span>`;
}

function missionBox() {
  const { me } = state;
  const pair = pairLine();
  if (!me.mission && !pair) return '';
  return `<div class="mission-box"><p class="label">Your mission</p>${me.mission ? `<p>${rich(me.mission)}</p>` : ''}${pair ? `<p>${pair}</p>` : ''}</div>`;
}

// My latest prediction against Git's answer: "You predicted: conflict on TOP. Git: conflict on TOP. ✓"
function verdictHTML() {
  const v = state.me.verdict;
  return v ? `<p class="verdict ${v.right ? 'right' : 'wrong'}">${esc(v.line)}</p>` : '';
}

// Anyone in the lab may predict the lab's next merge or send while it is pending (optional; the presser must).
function predictHTML() {
  const m = state.lab.moments?.[0];
  if (!m || state.lab.done || V.scene.kind === 'reveal') return '';
  return `<div class="predict-box"><p class="label">Predict</p>
    <p>${esc(m.before)} <b>${esc(m.q)}</b></p>
    <div class="predict-chips">${m.options.map((o) => `<button class="chip${o.id === m.mine ? ' on' : ''}" data-guess="${esc(o.id)}" data-moment="${esc(m.id)}"
      aria-pressed="${o.id === m.mine}">${esc(o.words)}</button>`).join('')}</div>
    ${m.mine ? `<p class="small muted">${esc(m.saved)}</p>` : ''}</div>`;
}

// "Stuck? Hint" waits a little (the server times it), then shows the idea first; a second press shows the exact
// click. While open it follows the lab live; a new situation goes back to its idea.
const hintReady = () => Boolean(state.me.hint) && Date.now() + clockSkew >= (state.me.hintAt ?? 0);
const sameHint = (h) => h.idea === h.click;
function shownClick() {
  const h = state.me.hint;
  return h && !V.card && hintReady() && (hintLevel === 2 || (hintLevel === 1 && sameHint(h))) ? h.click : null;
}
function hintHTML() {
  const h = state.me.hint;
  hintWasReady = hintReady();
  if (!h || !hintWasReady) return '';
  if (hintLevel === 0) return '<button class="hint-btn" data-hint="1">Need a hint?</button>';
  if (hintLevel === 1 && !sameHint(h)) {
    return `<div class="hint"><p class="label">Think about</p><p>${rich(h.idea)}</p>
      <p class="hint-links"><button class="linkish more" data-hint="2">Show the exact click</button><button class="linkish" data-hint="0">Hide hint</button></p></div>`;
  }
  return `<div class="hint"><p class="label">Next</p><p>${rich(h.click)}</p><p class="hint-links"><button class="linkish" data-hint="0">Hide hint</button></p></div>`;
}

function doneHTML() {
  const { doneLine, bonus } = V.s;
  return `<div class="done-box"><p class="done-line">${esc(doneLine)}</p>${bonus ? `<p class="bonus"><b>Bonus</b> · ${rich(bonus)}</p>` : ''}</div>`;
}

// The hint's buttons get a soft ring, and a note it names is picked in its dropdown.
const HINT_PICKS = [
  ['switch', /\*\*Switch to\*\* and pick \*\*(.+?)\*\*/],
  ['merge', /\*\*Merge (.+?) into main\*\*/],
  ['deleteNote', /\*\*Delete branch\*\* and pick \*\*(.+?)\*\*/],
];
function showHint() {
  for (const el of document.querySelectorAll('.hinted')) el.classList.remove('hinted');
  const hint = shownClick();
  if (hint && hint !== lastHint) {
    const found = HINT_PICKS.map(([id, re]) => [id, re.exec(hint)?.[1]]).filter(([, note]) => note);
    for (const [id, note] of found) picked[id] = note;
    if (found.length) renderActions();
  }
  lastHint = hint;
  if (!hint) return;
  for (const sel of hintTargets(hint)) {
    const el = document.querySelector(sel);
    (el?.closest('.act') ?? el)?.classList.add('hinted');
  }
}

function hintTargets(hint) {
  const out = [];
  for (const [, words] of hint.matchAll(/\*\*(.+?)\*\*/g)) {
    const a = ACTIONS.find((x) => words === x.words || words.startsWith(`${x.words} `));
    const part = PARTS.find((p) => hint.includes(`on ${p.toUpperCase()}`));
    if (a) out.push(`#actions [data-act="${a.id}"]`);
    else if (words === 'change') out.push(part ? `#draft [data-part="${part}"]` : '#draft');
    else if (words === 'Finish merge') out.push('#banner [data-open-resolver]');
    else if (words === 'Undo this card' || words === 'Move my branch back here') out.push('#graph-scroll');
  }
  if (/^Click the .*card/.test(hint)) out.push('#graph-scroll');
  return out;
}

// What Git did: the step's rule for how Git does it, always first. Then what Git did last in this lab
// this step (who pressed what, its command, one plain sentence); the plumbing waits behind "Show the low-level steps".
function renderBehind() {
  const behind = V.scene.kind !== 'join' && V.s.behind;
  $('behind').hidden = !behind;
  if (!behind) return;
  const op = state.lab.lastOp;
  if (seenOp === undefined || $('behind').open) seenOp = op?.t ?? null;
  $('behind').classList.toggle('fresh', Boolean(op) && op.t !== seenOp);
  const code = (cmds) => cmds.map((c) => `<code>${esc(c)}</code>`).join(' ');
  const cmds = op?.porcelain ? op.porcelain.split('\n') : [];
  patch($('behind-body'), `
    <p>${rich(behind.text)}</p>
    ${op ? `<div class="last-op">
        <p class="last"><span class="muted">Last:</span> <b>${esc(op.who)}</b> · ${esc(op.action)}${op.outcome ? ` → ${esc(op.outcome)}` : ''}</p>
        ${cmds.length ? `<p class="cmds">${code(cmds)}</p>` : ''}
        ${op.explain ? `<p>${rich(op.explain)}</p>` : ''}
      </div>` : `<p class="cmds">You'd type: ${code(behind.cmds)}</p>`}`);
  $('plumbing').hidden = !op?.commands?.length;
  // A command that printed nothing still says how it ended (e.g. merge-base --is-ancestor: exit 1 = no).
  patch($('plumbing-list'), (op?.commands || []).map((c) => {
    const out = c.out?.trim();
    return `<li class="${c.code && out ? 'bad' : ''}"><div class="cmd">${esc([].concat(c.cmd).join(' '))}</div>${
      out ? `<div class="out">${esc(out)}</div>` : c.code ? `<div class="out">exit ${c.code}</div>` : ''}</li>`;
  }).join(''));
}

// The panel sticks while it fits on screen; a taller one scrolls with the page.
function fitMission() {
  const panel = $('panel');
  panel.classList.toggle('tall', panel.scrollHeight > innerHeight - 120);
}

// ---------- Answers, takeaways, "My Git in 7 lines" ----------
// Typed text is sent on blur or Enter, never on every key. A field being typed in is never overwritten.

const dirty = new Set(); // fields typed in but not sent yet
const sending = new Map(); // field → text on its way

function renderQA() {
  const qa = $('qa');
  const home = V.card ? $('scene-body') : $('mission');
  if (qa.previousElementSibling !== home) home.after(qa);
  const html = qaHTML();
  // The teacher moved on mid-sentence: keep what was typed.
  if (qa.dataset.html !== html) for (const el of qa.querySelectorAll('[data-field]')) sendField(el);
  patch(qa, html);
  for (const el of qa.querySelectorAll('[data-field]')) {
    if (el !== document.activeElement && !dirty.has(el.dataset.field)) el.value = fieldValue(el.dataset.field);
    countField(el);
  }
}

function qaHTML() {
  const { scene } = V;
  const out = [];
  if (scene.answerable) {
    const exit = scene.kind === 'exit';
    out.push(fieldHTML(`a:${scene.id}`, {
      label: exit ? 'Your answer' : 'Question', q: exit ? null : scene.question,
      max: ANSWER_MAX, rows: exit ? 4 : 2, placeholder: exit ? 'Two sentences · Enter saves' : 'Your answer · Enter saves (optional)',
    }));
  }
  if (Number.isInteger(scene.takeawayStep)) {
    out.push(fieldHTML(`t:${scene.takeawayStep}`, { label: 'My takeaway', max: TAKEAWAY_MAX, placeholder: 'One line · Enter saves (optional)' }));
  }
  if (scene.kind === 'wrap') out.push(gitIn7HTML());
  return out.join('');
}

const fieldHTML = (key, { label, q = null, max, rows = 0, placeholder }) => `
  <label class="qa-block">
    <span class="qa-label">${esc(label)}</span>
    ${q ? `<span class="qa-q">${esc(q)}</span>` : ''}
    ${rows ? `<textarea data-field="${key}" maxlength="${max}" rows="${rows}" placeholder="${esc(placeholder)}"></textarea>`
    : `<input data-field="${key}" maxlength="${max}" placeholder="${esc(placeholder)}" autocomplete="off">`}
    <span class="qa-foot"><span class="qa-status" data-status="${key}"></span><span class="qa-count" data-count="${key}"></span></span>
  </label>`;

// Each line starts as the student's takeaway; an empty one shows the board's line as a placeholder.
const boardLine = (board) => String(board ?? '').replace(/^\d+\.\s*/, '');
function gitIn7HTML() {
  return `<section class="git7">
    <div class="git7-head"><h2>My Git in 7 lines</h2><button class="quiet" type="button" data-copy>Copy</button></div>
    <ol class="git7-lines">${state.me.gitIn7.map((l) => `
      <li><span class="git7-n">${l.step}</span>
        <input data-field="t:${l.step}" maxlength="${TAKEAWAY_MAX}" placeholder="${esc(boardLine(l.board))}"
          aria-label="Step ${l.step}: ${esc(l.title)}" autocomplete="off">
        <span class="qa-status" data-status="t:${l.step}"></span></li>`).join('')}</ol>
    <p class="small muted">Your takeaways, in step order. Edit any line. An empty line copies the board's line.</p>
  </section>`;
}

function fieldValue(key) {
  const [kind, id] = key.split(':');
  return kind === 'a' ? state.me.answers[id] ?? '' : state.me.gitIn7.find((l) => String(l.step) === id)?.text ?? '';
}

function countField(el) {
  const left = el.maxLength - el.value.length;
  const box = $('qa').querySelector(`[data-count="${el.dataset.field}"]`);
  if (box) box.textContent = left <= el.maxLength / 5 ? `${left} left` : '';
}

async function sendField(el) {
  const key = el.dataset.field;
  const text = el.value;
  if (!dirty.has(key) || sending.get(key) === text) return;
  sending.set(key, text);
  const [kind, id] = key.split(':');
  const res = await call(kind === 'a' ? '/api/answer' : '/api/takeaway', kind === 'a' ? { scene: id, text } : { step: Number(id), text });
  sending.delete(key);
  if (!res.ok) { toast(res.error || 'Busy, press again.', 'bad'); return; }
  if (el.value === text) dirty.delete(key);
  const status = $('qa').querySelector(`[data-status="${key}"]`);
  if (status) {
    status.textContent = res.result?.text ? 'Saved ✓' : 'Removed';
    setTimeout(() => { if (status.textContent !== '') status.textContent = ''; }, 2500);
  }
  await refresh();
}

async function copyGitIn7() {
  const lines = [...$('qa').querySelectorAll('.git7 [data-field]')]
    .map((el, i) => `${state.me.gitIn7[i].step}. ${el.value.trim() || el.placeholder}`);
  const text = ['My Git in 7 lines', ...lines].join('\n');
  let ok = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch { // no clipboard API outside https or localhost
    const area = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(area);
    area.select();
    ok = document.execCommand('copy');
    area.remove();
  }
  toast(ok ? 'Copied. Paste it into your notes.' : 'Copy did not work. Select the lines and copy them.', ok ? 'good' : 'bad');
}

// ---------- The paper, the exit question, the wrap ----------

function renderScene() {
  const { scene } = V;
  patch($('scene-body'), scene.kind === 'paper' ? paperHTML(scene.paper) : scene.kind === 'exit' ? exitHTML(scene) : wrapHTML(scene));
  patch($('scene-foot'), scene.kind === 'wrap' ? summaryHTML() : '');
}

function paperHTML(p) {
  const column = (title, cls, items) => `<section class="${cls}"><h3>${title}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`;
  return `<p class="eyebrow">The paper</p>
    <h1>${esc(p.title)}</h1>
    <p class="paper-source">${esc(p.source)}</p>
    <div class="gbu">${column('The Good', 'good', p.good)}${column('The Bad', 'bad', p.bad)}${column('The Ugly', 'ugly', p.ugly)}</div>
    <p class="paper-message">${esc(p.message)}</p>
    <p class="paper-tradeoff">${esc(p.tradeoff)}</p>
    <div class="lived"><h3>What you lived</h3><ul>${p.lived.map((l) => `<li>${esc(l.text)}</li>`).join('')}</ul></div>
    ${velocityHTML()}`;
}

// This class's integration paths, kept from Step 4. Whether the Wall's main still has them is read live.
function velocityHTML() {
  const paths = state.session.integration?.paths ?? [];
  if (!paths.length) return '';
  const tip = state.wall?.graph.refs['refs/heads/main'];
  const onWall = ancestors(V.wallById, tip);
  const gone = tip && paths.every((p) => !p.cards.some((id) => onWall.has(id)));
  return `<div class="velocity"><h3>Each lab's change in Step 4, and its path to main</h3>
    <ul>${paths.map((p) => `<li><b>${esc(p.name)}</b> · ${pathChange(p)} · ${velocity(p)}${
      p.note ? `<br><span class="muted">${esc(p.note)}</span>` : ''}</li>`).join('')}</ul>
    <p class="small muted">The time from making the card to its arrival on the Wall is what the paper calls code velocity.${gone ? " Since the squash, the Wall's main has none of these cards." : ''}</p>
  </div>`;
}

const exitHTML = (scene) => `<p class="eyebrow">Exit question</p>
  <h1 class="exit-q">${esc(scene.question)}</h1>
  <p class="scene-line">${esc(scene.line)}</p>`;

const wrapHTML = (scene) => `<p class="eyebrow">${esc(scene.title)}</p>
  <h1 class="wrap-line">${esc(scene.wrap.line)}</h1>`;

function summaryHTML() {
  const c = state.lab.concepts || {};
  return `
    <h2>What ${esc(state.lab.name)} did</h2>
    <div class="stats">${SUMMARY.map(([k, one, many]) => `<div><b>${c[k] || 0}</b><span>${c[k] === 1 ? one : many}</span></div>`).join('')}</div>
    <div><h3>Git ideas you used</h3><ul class="concepts">${IDEAS.map(([k, words, term]) =>
      `<li class="${c[k] ? 'on' : ''}">${words} <span>${term.split(' + ').map((t) => `<code>${t}</code>`).join(' + ')}</span></li>`).join('')}</ul></div>`;
}

// ---------- The stage: the outfit, the buttons, the cards ----------

function renderWork() {
  const { chaos } = V;
  $('layout').classList.toggle('chaos', chaos);
  $('draft-title').textContent = chaos ? "Your lab's outfit" : 'Shared draft';
  $('on-note').hidden = !V.unlocked('branch');
  patch($('on-note'), `You're on: <span class="note-chip">${esc(V.note)}</span>`);
  $('actions').hidden = chaos;
  $('table').hidden = chaos;
  renderBanner();
  renderDraft();
  renderActions();
}

function renderBanner() {
  const m = V.merging;
  $('banner').hidden = !m;
  if (!m) return;
  const parts = m.conflicts.map((p) => p.toUpperCase());
  patch($('banner'), `<span><b>${esc(openWords(m).title)}.</b> ${parts.join(' and ')} ${parts.length > 1 ? 'need' : 'needs'} a choice.</span>
    <button class="primary" data-open-resolver>Open</button>`);
}

// The outfit as one dressed figure. Everyone on a note shares its draft, so each unsaved part says who changed it.
function renderDraft() {
  const by = state.lab.draftBy?.[V.note] ?? {};
  const who = (p) => (p === state.me.pid ? 'you' : state.lab.members.find((m) => m.pid === p)?.name);
  for (const part of PARTS) {
    const btn = $('draft').querySelector(`[data-part="${part}"]`);
    const value = V.monster[part];
    const unsaved = V.unsaved.includes(part);
    const glyph = btn.querySelector('.part-emoji');
    const next = emoji(part, value);
    if (glyph.textContent !== next) {
      const swap = glyph.textContent !== '';
      glyph.textContent = next;
      if (swap) { glyph.classList.remove('pop'); void glyph.offsetWidth; glyph.classList.add('pop'); }
    }
    btn.querySelector('.part-value').textContent = value ? nameOf(value) : '';
    const by1 = unsaved && (edits.has(part) ? 'you' : who(by[part]));
    btn.querySelector('.part-by').textContent = by1 ? `changed by ${by1}` : '';
    btn.querySelector('.tag').hidden = !unsaved;
    btn.classList.toggle('unsaved', unsaved);
    btn.setAttribute('aria-label', `${part.toUpperCase()}: ${nameOf(value)}${unsaved ? `, not saved${by1 ? `, changed by ${by1}` : ''}` : ''}. Change it`);
  }
  $('draft').classList.toggle('locked', V.locked);
  const count = V.unsaved.length;
  const status = $('draft-status');
  status.hidden = V.chaos && changed;
  status.classList.toggle('unsaved', count > 0);
  status.textContent = V.locked ? V.s.mainLocked
    : count ? `${plural(count, 'part', 'parts')} not saved yet` : changed ? 'All saved' : 'Click a part to change it.';
}

function renderActions() {
  const box = $('actions');
  if (box.contains(document.activeElement) && ['SELECT', 'INPUT'].includes(document.activeElement.tagName)) return; // keep an open dropdown, a line being typed
  const shownActs = ACTIONS.filter((a) => V.unlocked(a.id)
    && (!a.pick || noteChoices(a.id).length)
    && (a.id !== 'squash' || state.session.bossLab === state.lab.id));
  // The purple row: what this step adds, and, once the student asked for the exact click, the button it names
  // ("your mission"; purple alone means new).
  const next = hintTargets(shownClick() ?? '').map((sel) => /data-act="(\w+)"/.exec(sel)?.[1]).find(Boolean);
  // Off main, every main-only button reads "Switch to main first"; show that once.
  const offMain = (a) => a.mainOnly && V.note !== 'main';
  const fresh = shownActs.filter((a) => V.isNew(a.id) || a.id === next);
  const old = shownActs.filter((a) => !fresh.includes(a) && !(offMain(a) && fresh.some(offMain)));
  const ways = fresh.filter((a) => a.way && V.isNew(a.id) && !offMain(a));
  const row = (acts, isNew) => [...new Set(acts.map((a) => actionHTML(a, isNew, a.id === next)))].join('');
  // Step 5's new tools live in the card details; say where.
  const where = V.isNew('revert') ? '<p class="actions-hint">Click a card to undo it, or to move your branch back to it.</p>' : '';
  patch(box, `
    ${fresh.length > ways.length ? `<div class="actions-new">${row(fresh.filter((a) => !ways.includes(a)), true)}</div>` : ''}
    ${ways.length ? waysHTML(ways) : ''}
    ${where}
    ${old.length ? `<div class="actions-old">${row(old, false)}</div>` : ''}`);
}

// Step 4: the two ways to get the Wall's cards, side by side, each with one plain line on what it will do.
// The lab chooses; its choice is marked, with an optional one line on why.
function waysHTML(ways) {
  const { ways: copy, whyQ, whyMax } = V.s.choices;
  const mine = state.lab.way;
  return `<div class="ways">
      <p class="ways-head">${mine ? `Your lab chose <b>${esc(copy[mine].name)}</b>.` : "Get the Wall's cards: choose a way."}</p>
      <div class="ways-row">${ways.map((a) => {
        const tag = a.way === mine ? "your lab's choice" : mine ? '' : 'new';
        return `<button class="act way${a.way === mine ? ' mine' : ''}${busy.has(a.id) ? ' busy' : ''}" data-act="${a.id}">
            ${tag ? `<span class="new-tag">${tag}</span>` : ''}
            <span class="act-words">${esc(a.words)}</span><code class="act-cmd">${esc(a.cmd)}</code>
            <span class="way-line"><b>${esc(copy[a.way].name)}:</b> ${esc(copy[a.way].line)}</span></button>`;
      }).join('')}</div>
      ${mine ? `<label class="why"><span>${esc(whyQ)}</span>
        <input data-why maxlength="${whyMax}" value="${esc(state.lab.why)}" placeholder="One line · Enter saves" autocomplete="off"></label>` : ''}
    </div>`;
}

async function sendWhy(el) {
  if (el.value.trim() === (state.lab.why ?? '')) return;
  const res = await call('/api/why', { text: el.value });
  if (!res.ok) toast(res.error || 'Busy, press again.', 'bad');
  else toast(res.result.message, 'good');
  await refresh();
}

// The notes a dropdown offers. Delete never offers main.
const noteChoices = (id) => (id === 'deleteNote' ? V.deletable : V.others);

// A dropdown's note: the one picked, else in Step 2 your pair's note for Switch (main once you're on it),
// else the first.
const pickFor = (id) => [picked[id], id === 'switch' && V.n === 2 && (V.note === state.me.pairNote ? 'main' : state.me.pairNote),
  noteChoices(id)[0]].find((n) => noteChoices(id).includes(n));

function actionHTML(a, isNew, mission = false) {
  const offMain = a.mainOnly && V.note !== 'main';
  const cls = `act ${isNew ? 'new' : 'old'}${a.danger && !offMain ? ' danger' : ''}${busy.has(a.id) || (offMain && busy.has('switch')) ? ' busy' : ''}`;
  const tag = !isNew ? '' : mission ? '<span class="new-tag mission">your mission</span>' : '<span class="new-tag">new</span>';
  if (offMain) {
    return `<button class="${cls}" data-act="tomain"><span class="act-words">Switch to main first</span><code class="act-cmd">git switch main</code>${tag}</button>`;
  }
  if (!a.pick) {
    return `<button class="${cls}" data-act="${a.id}"><span class="act-words">${esc(a.words)}</span><code class="act-cmd">${esc(a.cmd)}</code>${tag}</button>`;
  }
  const choice = pickFor(a.id);
  const into = a.id === 'merge' ? ` into ${esc(V.note)}` : '';
  const options = noteChoices(a.id).map((n) => `<option${n === choice ? ' selected' : ''}>${esc(n)}</option>`).join('');
  return `<div class="${cls}">
      <button class="act-hit" data-act="${a.id}" aria-label="${esc(`${a.words} ${choice}`)}${into}"></button>
      <span class="act-words">${esc(a.words)} <select data-pick="${a.id}" aria-label="Which branch">${options}</select>${into}</span>
      <code class="act-cmd">${esc(a.cmd)}</code>${tag}
    </div>`;
}

// Branches show from Step 2, where they are taught. At Step 4's reveal the Wall shows one change's
// integration path: my lab's, or the one the student picks.
function renderTable() {
  if (V.chaos) return;
  draw($('graph'), $('graph-scroll'), state.lab.graph, {
    labels: V.unlocked('branch'), you: V.note, diaryLabel: DIARY_LABEL, onCardClick: (c) => openCard(c.id, 'lab'),
  });
  patch($('legend'), LEGEND.filter(([id]) => V.unlocked(id)).map(([, html]) => html).join(''));
  const integration = state.session.integration;
  const wall = integration?.graph ?? state.wall?.graph;
  const paths = integration?.paths ?? [];
  const path = paths.find((p) => p.labId === (pathLab ?? state.lab.id)) ?? paths[0];
  $('wall-block').hidden = !wall;
  const badges = integration?.live ? pathBadges(wall, paths) : null;
  if (wall) draw($('wall-graph'), $('wall-scroll'), wall, { labels: true, path: path?.cards, badges, onCardClick: (c) => openCard(c.id, 'wall') });
  $('paths').hidden = !integration;
  patch($('paths'), integration ? pathsHTML(paths, path) : '');
}

const pathChange = (p) => `${p.part.toUpperCase()} → ${emoji(p.part, p.value)}`;
const labColor = (id) => state.session.labs.find((l) => l.id === id)?.color;

function pathsHTML(paths, shown) {
  if (!paths.length) return '<p class="muted">No lab\'s change has reached the Wall yet.</p>';
  const pick = paths.length > 1 ? ' Click one to mark it.' : '';
  return `<p class="paths-head"><b>Each change's path to main</b> <span class="muted">(integration path).${pick}</span></p>
    <ul class="paths-list">${paths.map((p) => `<li><button class="path${p === shown ? ' on' : ''}" data-path="${esc(p.labId)}">
        <span class="path-lab"><i style="--lab:${esc(labColor(p.labId))}"></i>${esc(p.name)} · ${pathChange(p)}</span>
        <span class="path-time">${velocity(p)}</span>
        ${p.note ? `<span class="path-note">${esc(p.note)}</span>` : ''}
      </button></li>`).join('')}</ul>`;
}

// Draw only when something changed. Full cards while they all fit, else small ones; cards that still
// don't fit fold into pills "← N older cards" (never one with a branch). Pressing a pill draws them
// all, to scroll, and shows your branch. Then keep the newest cards in view unless the student
// scrolled back; right after my own action (or on first draw), show where my branch is.
function draw(svg, scroller, graph, opts) {
  const pad = getComputedStyle(scroller);
  const width = scroller.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
  const all = expanded.has(svg);
  const key = JSON.stringify([graph, opts.you, opts.labels, opts.path, opts.badges, width, all]);
  if (drawn.get(svg) === key) return;
  const mine = Date.now() < followUntil || !drawn.has(svg);
  const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 48;
  drawn.set(svg, key);
  const onOlder = () => { expanded.add(svg); drawn.delete(svg); renderTable(); };
  renderGraph(svg, graph, { ...opts, compact: 'auto', width, all, onOlder });
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
  coach();
  return pop;
}

function closePopover() {
  if (!popAnchor) return;
  $('popover').hidden = true;
  popAnchor.classList.remove('open');
  popAnchor = null;
  coach();
}

function openPalette(anchor, part) {
  const current = V.monster[part];
  const pop = openPopover(anchor, `
    <p class="eyebrow">${part.toUpperCase()}</p>
    <div class="choices">${palette(V.n)[part].map((slug) => `
      <button class="choice${slug === current ? ' current' : ''}" data-slug="${slug}" aria-label="${esc(nameOf(slug))}">
        <span class="e">${emoji(part, slug)}</span><span>${esc(nameOf(slug))}</span>
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
  if (res.ok) {
    changed = true;
    localStorage.setItem(KEY.changed, '1');
    clearBadToast();
  } else toast(nextMove(res.error), 'bad');
  await refresh();
  if (edits.get(part) === value) edits.delete(part);
  if (V) render();
}

function openNewNote(anchor) {
  const name = V.n === 2 ? state.me.pairNote || '' : '';
  const pop = openPopover(anchor, `
    <form class="new-note">
      <p class="eyebrow">New branch</p>
      <input name="name" value="${esc(name)}" maxlength="20" autocomplete="off" spellcheck="false" aria-label="Name of the branch">
      <code>git switch -c <span>${esc(name)}</span> main</code>
      <button class="primary">Make branch</button>
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
  coach();
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

// Card details. Opening a card asks Git for it (`git cat-file -p`); "Show what Git stored" shows that answer.
function openCard(id, repo) {
  cardOpen = { id, repo, stored: get('/api/inspect', { commit: id, repo }) };
  renderCard(true);
  show('card-dialog');
}

function renderCard(fresh = false) {
  const { id, repo } = cardOpen;
  const c = (repo === 'wall' ? V.wallById : V.byId).get(id);
  if (!c) { $('card-dialog').close(); return; }
  const names = mergedNotes(c.message);
  const parents = c.parents.map((p, i) => `<span><button class="id-chip" data-goto="${p}">${short(p)}</button>${
    names[i] ? ` <span class="muted">${esc(names[i])}</span>` : ''}</span>`).join('')
    || '<span class="muted">None. This is the Start card.</span>';
  const where = repo === 'wall' ? 'On the Wall' : c.reachable === false ? 'Only in your safety diary (reflog)' : '';
  const html = `
    <div class="card-top">
      <div class="card-figure">${slot(c.monster, 'large')}</div>
      <div class="card-meta">
        <p class="card-id"><span class="label">Card ID</span>${short(c.id)}<small>${c.id}</small></p>
        <p class="card-msg">${esc(plainMessage(c.message))}</p>
        <dl class="facts">
          ${madeHTML(c)}
          <dt>${c.parents.length > 1 ? 'Parents' : 'Parent'}</dt><dd>${parents}</dd>
          ${repo === 'lab' ? replayHTML(c) : ''}
          ${where ? `<dt>Where</dt><dd>${where}</dd>` : ''}
        </dl>
      </div>
    </div>
    <details class="stored"><summary>Show what Git stored</summary><div class="stored-body"></div></details>
    ${repo === 'lab' && V.unlocked('revert') ? cardActions(c) : ''}`;
  const body = dialogBody('card-dialog');
  if (!fresh && body.dataset.html === html) return;
  const stored = body.querySelector('.stored');
  const keep = !fresh && stored?.open ? stored.querySelector('.stored-body').innerHTML : null;
  patch(body, html);
  if (keep) { body.querySelector('.stored').open = true; body.querySelector('.stored-body').innerHTML = keep; }
}

// Who made the card, and when. A replayed card keeps its author and author time; whoever replayed it
// committed it, later. Then both show.
function madeHTML(c) {
  if (c.committer === c.author && c.committerTime === c.time) {
    return `<dt>Made by</dt><dd>${esc(c.author)}${c.time ? ` · ${ago(c.time)}` : ''}</dd>`;
  }
  const by = c.committer === c.author ? '' : ` by ${esc(c.committer)}`;
  const second = clockOf(c.time) === clockOf(c.committerTime); // the same minute: say the seconds
  return `<dt>Author</dt><dd>${esc(c.author)} at ${clockOf(c.time, second)} · committed${by} at ${clockOf(c.committerTime, second)}</dd>`;
}

// A replayed card and its original share the author, the author time and the message.
function replayHTML(c) {
  const twins = [...V.byId.values()].filter((x) => x.id !== c.id && x.author === c.author && x.time === c.time && x.message === c.message);
  const first = twins.filter((x) => x.committerTime < c.committerTime).sort((a, b) => a.committerTime - b.committerTime)[0];
  const later = twins.filter((x) => x.committerTime > c.committerTime);
  const chip = (x) => `<span><button class="id-chip" data-goto="${x.id}">${short(x.id)}</button>${
    x.reachable === false ? ` <span class="muted">${DIARY_LABEL}</span>` : ''}</span>`;
  return (first ? `<dt>Replay of</dt><dd>${chip(first)}</dd>` : '')
    + (later.length ? `<dt>Replayed as</dt><dd>${later.map(chip).join('')}</dd>` : '');
}

// A merge card's parents, by the branches they came from: "Merge branch 'sporty'" → main, sporty.
function mergedNotes(message) {
  const m = /^Merge (?:remote-tracking )?branch '(.+?)'(?: into (\S+))?/.exec(message);
  return m ? [m[2] ?? 'main', fromName(m[1])] : [];
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
        <span class="act-words">Move my branch back here</span><code class="act-cmd">git reset --hard ${short(c.id)}</code></button>
      ${[undoWhy, moveWhy].filter(Boolean).map((w) => `<p class="why">${esc(w)}</p>`).join('')}
    </div>`;
}

async function loadStored(details) {
  const box = details.querySelector('.stored-body');
  if (box.childElementCount) return;
  box.innerHTML = '<p class="muted">Opening the card…</p>';
  const res = await cardOpen.stored;
  if (!res.ok) { box.innerHTML = `<p class="muted">${esc(res.error)}</p>`; return; }
  box.innerHTML = (res.op?.commands || []).map((c) =>
    `<div class="cmd">${esc([].concat(c.cmd).join(' '))}</div><pre>${glossed(c.out?.trim() ?? '')}</pre>`).join('');
}

// What each line of a stored card means, in a muted line under it. The message follows the first blank line.
function glossed(text) {
  const lines = text.split('\n');
  const blank = lines.indexOf('');
  const person = (key) => lines.find((l) => l.startsWith(`${key} `))?.slice(key.length + 1);
  const gloss = {
    tree: 'the snapshot of the files (outfit.txt), by its ID',
    parent: 'the card before',
    author: 'who made it, and when (seconds since 1970)',
    committer: person('author') === person('committer') ? 'who saved it (here, the same)'
      : 'who wrote this card, and when. A replay keeps the author, so this differs.',
  };
  return lines.map((line, i) => {
    const head = line.split(' ')[0];
    const words = blank > 0 && i === blank + 1 ? 'the message' : (blank < 0 || i < blank) && Object.hasOwn(gloss, head) && gloss[head];
    return `<div>${esc(line) || ' '}${words ? `<span class="gloss">↳ ${words}</span>` : ''}</div>`;
  }).join('');
}

// Safety diary lines in plain words; Git's own line stays underneath.
const DIARY = [
  [/^commit \(merge\)/, 'Merged'], [/^commit/, 'Saved a card'], [/^branch/, 'Made this branch'],
  [/^merge wall\/main: Fast-forward/, "Got the Wall's cards"], [/^merge wall\/main/, 'Got & combined'],
  [/^merge .*Fast-forward/, 'Fast-forwarded (merge)'], [/^merge/, 'Merged'],
  [/^(pull --rebase|rebase) \(finish\)/, 'Replayed on top'], [/^pull --rebase: Fast-forward/, "Got the Wall's cards"],
  [/^revert/, 'Undid a card'], [/^reset/, 'Moved back'], [/^clone/, 'Copied from the Wall'],
];
const diaryWords = (message) => DIARY.find(([re]) => re.test(message))?.[1] ?? message;

async function openDiary() {
  const body = dialogBody('diary-dialog');
  const note = V.note;
  const head = `<h2>Safety diary <code class="muted">git reflog ${esc(note)}</code></h2>`;
  body.innerHTML = `${head}<p class="muted">Opening the diary…</p>`;
  show('diary-dialog');
  const res = await get('/api/reflog');
  if (!res.ok) { $('diary-dialog').close(); toast(res.error, 'bad'); return; }
  const entries = res.result?.entries || [];
  patch(body, `
    ${head}
    <p class="muted">Every place ${esc(note)} has been. Newest first. Moving a branch deletes nothing. Click a line to open that card.</p>
    <ol class="diary">${entries.map((e) => `
      <li><button data-goto="${e.id}">
        <span class="when">${clock(e.time * 1000)}</span>
        ${slot(V.byId.get(e.id)?.monster, 'tiny')}
        <span class="what"><span>${esc(diaryWords(e.message))} · <code>${short(e.id)}</code></span><code class="git">${esc(e.message)}</code></span>
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

// An open merge in words, by kind: a merge, an undo (revert) or a replay (rebase). Git's first side
// (ours) is the branch's own, or in a replay the Wall's: the new base. Each Keep button says what it keeps:
// "Keep main's 👔 shirt & tie", "Keep before 5c36f17: 👑 crown". sides: [name, outfit, a muted second line].
function openWords(m) {
  const marks = 'Git marks each clash in outfit.txt.';
  if (m.kind === 'revert') {
    return {
      title: `Undoing card ${short(m.from)}`, why: 'Red parts changed since that card.',
      sides: [['Now', m.ours], [`Before ${short(m.from)}`, m.theirsMonster]], keep: ['Keep now:', `Keep before ${short(m.from)}:`],
      finish: 'Finish undo', cancel: 'Cancel undo', file: `${marks} You choose; Git saves the fix card.`,
    };
  }
  if (m.kind === 'rebase') {
    return {
      title: `Replaying your card ${short(m.theirs)} on top of the Wall`, why: 'Red parts changed on the Wall too.',
      sides: [['Before your card', m.base], ['The Wall', m.ours], [`Your card ${short(m.theirs)}`, m.theirsMonster]],
      keep: ["Keep the Wall's", "Keep your card's"],
      finish: 'Finish replay', cancel: 'Cancel replay', file: `${marks} The Wall's side comes first, your card second. You choose; Git writes the copy.`,
    };
  }
  const theirs = fromName(m.from);
  return {
    title: `Merging ${theirs} into ${V.note}`, why: 'Red parts changed on both sides since you split.',
    sides: [['Where you split', m.base, 'merge base'], [V.note, m.ours], [theirs, m.theirsMonster]], keep: [`Keep ${V.note}'s`, `Keep ${theirs}'s`],
    finish: 'Finish merge', cancel: 'Cancel merge', file: `${marks} You choose; Git saves the merge card.`,
  };
}

// What finishing runs in real Git, after you edit the file: git add, then the kind's own next step.
const FINISH_CMD = { merge: 'git commit', revert: 'git revert --continue', rebase: 'git rebase --continue' };

function renderResolver() {
  const m = V.merging;
  const w = openWords(m);
  const { choices, another } = resolver;
  const ready = m.conflicts.every((p) => choices[p]);
  const option = (part, value, words) => `
    <button class="opt${choices[part] === value ? ' chosen' : ''}" data-choose="${part}" data-slug="${esc(value)}">
      ${esc(words)} <span class="e">${emoji(part, value)}</span>${esc(nameOf(value))}</button>`;
  const rows = PARTS.map((part) => {
    if (!m.conflicts.includes(part)) {
      const value = m.auto?.[part] ?? m.ours[part];
      return `<div class="rrow auto"><span class="pname">${part.toUpperCase()}</span><span class="val">${emoji(part, value)} ${esc(nameOf(value))}</span></div>`;
    }
    const sideValues = [m.ours[part], m.theirsMonster[part]];
    const own = choices[part] && !sideValues.includes(choices[part]);
    return `<div class="rrow conflict"><span class="pname">${part.toUpperCase()}</span>
      <div class="opts">
        ${option(part, m.ours[part], w.keep[0])}${option(part, m.theirsMonster[part], w.keep[1])}
        ${own ? option(part, choices[part], 'Your pick:') : ''}
        <button class="opt" data-another="${part}" aria-expanded="${another === part}">Pick another…</button>
      </div>
      ${another === part ? `<div class="choices">${palette(V.n)[part].map((slug) => `
        <button class="choice${choices[part] === slug ? ' current' : ''}" data-choose="${part}" data-slug="${slug}">
          <span class="e">${emoji(part, slug)}</span><span>${esc(nameOf(slug))}</span></button>`).join('')}</div>` : ''}
    </div>`;
  }).join('');

  const marked = esc(m.conflictedText || '').split('\n')
    .map((line) => (/^(<{7}|={7}|>{7})/.test(line) ? `<span class="mark">${line}</span>` : line)).join('\n');
  const body = dialogBody('resolver-dialog');
  const behindOpen = body.querySelector('.resolver-behind')?.open;
  const v = state.me.verdict;
  const said = v && m.kind === 'merge' && v.kind === 'merge' && v.target === m.from ? `<p class="verdict ${v.right ? 'right' : 'wrong'}">${esc(v.line)}</p>` : '';
  patch(body, `
    <h2>${esc(w.title)}</h2>
    ${said}
    <p>${w.why} Pick one. Git kept the ✓ parts.</p>
    <div class="resolver-sides">${w.sides.map(([label, monster, sub]) => `<div class="side">${slot(monster, 'small')}<span class="side-name">${esc(label)}</span>${
      sub ? `<span class="side-sub">${esc(sub)}</span>` : ''}</div>`).join('')}</div>
    <div class="resolver-rows">${rows}</div>
    <div class="resolver-foot">
      <button class="primary big" data-finish ${ready ? '' : 'disabled'}>${w.finish}<code>git add outfit.txt\n${FINISH_CMD[m.kind]}</code></button>
      <button class="quiet" data-abort>${w.cancel}<code>git ${m.kind} --abort</code></button>
    </div>
    <details class="resolver-behind"${behindOpen ? ' open' : ''}>
      <summary>The file Git wrote</summary>
      <p>${w.file}</p>
      <pre class="conflict-text">${marked}</pre>
    </details>`);
}

function finishMerge() {
  const m = V.merging;
  const monster = Object.fromEntries(PARTS.map((p) =>
    [p, m.conflicts.includes(p) ? resolver.choices[p] : m.auto?.[p] ?? m.ours[p]]));
  return act('resolve', { monster });
}

// ---------- Tour and tips ----------
// First join: a soft spotlight and one bubble at a time, with Next and Skip; "?" replays it.
// Then one bubble on each new button a step adds, gone on the next click anywhere. Neither blocks the page.

const TOUR = [
  ['#draft', "This is your lab's outfit. Everyone in your lab shares it."],
  ['#draft .part', `Click change to pick a new ${list(PARTS, 'disjunction')}.`],
  ['#actions [data-act="commit"]', 'Save card keeps this exact outfit, with your name.'],
  ['#graph-scroll', 'Every saved card lives here. Each one points back to the one before.'],
];

// Where each new thing lives. Undo and Move back are in a card's details, so their tips wait for it.
const TIP_AT = {
  commit: '#actions [data-act="commit"]', inspect: '#graph-scroll', branch: '#actions [data-act="branch"]',
  switch: '#actions [data-act="switch"]', merge: '#actions [data-act="merge"]', wall: '#wall-block',
  push: '#actions [data-act="push"]', pull: '#actions [data-act="pull"]', reflog: '#actions [data-act="reflog"]',
  deleteNote: '#actions [data-act="deleteNote"]', rebase: '#actions [data-act="rebase"]',
  revert: '#card-dialog [data-card-act="revert"]', reset: '#card-dialog [data-card-act="reset"]',
  squash: '#actions [data-act="squash"]',
};

let tour = null; // {stops: [[selector, text]], i}
let coached = null; // the bubble on screen: {key, tour}
const tipsSeen = new Set(JSON.parse(localStorage.getItem(KEY.tips) || '[]'));
const onScreen = (sel) => [...document.querySelectorAll(sel)].find((el) => el.getClientRects().length > 0);

function startTour() {
  const stops = TOUR.filter(([sel]) => onScreen(sel));
  tour = stops.length ? { stops, i: 0 } : null;
  coach();
}

function endTour() {
  localStorage.setItem(KEY.tour, '1');
  // The tour already showed what these tips would say.
  for (const t of V?.s.tips ?? []) if (tour?.stops.some(([sel]) => sel === TIP_AT[t.action])) seeTip(`${V.n}:${t.action}`);
  tour = null;
  coach();
}

function seeTip(key) {
  tipsSeen.add(key);
  localStorage.setItem(KEY.tips, JSON.stringify([...tipsSeen]));
}

function nextTip() {
  const dialog = document.querySelector('dialog[open]');
  for (const t of V.s.tips) {
    const key = `${V.n}:${t.action}`;
    const el = !tipsSeen.has(key) && TIP_AT[t.action] && onScreen(TIP_AT[t.action]);
    if (el && (!dialog || dialog.contains(el))) return { key, el, text: t.text };
  }
  return null;
}

function coach() {
  const box = $('coach');
  let stop = null;
  if (V && !V.card && !popAnchor) {
    if (tour) {
      const [sel, text] = tour.stops[tour.i];
      const el = onScreen(sel);
      if (el) stop = { key: `tour:${tour.i}`, el, text, tour: true };
    } else stop = nextTip();
  }
  if (!stop) {
    box.hidden = true;
    coached = null;
    return;
  }
  const fresh = coached?.key !== stop.key;
  const zone = stop.el.closest('.act') ?? stop.el;
  coached = { key: stop.key, tour: Boolean(stop.tour) };
  if (fresh) {
    box.classList.toggle('tip', !stop.tour);
    box.querySelector('.bubble-text').textContent = stop.text;
    box.querySelector('.bubble-foot').innerHTML = stop.tour
      ? `<span class="bubble-count">${tour.i + 1} of ${tour.stops.length}</span>
         <button type="button" class="bubble-skip" data-coach="skip">Skip</button>
         <button type="button" class="bubble-next" data-coach="next">${tour.i + 1 < tour.stops.length ? 'Next' : 'Done'}</button>`
      : '<button type="button" class="bubble-next" data-coach="ok">Got it</button>';
  }
  place(box, zone);
  if (fresh) zone.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
}

// The spotlight hugs the target; the bubble sits under it (over it, near the bottom of the screen).
// Inside a dialog, both live in the dialog so they stay above its backdrop.
function place(box, el) {
  const host = el.closest('dialog[open]') ?? document.body;
  if (box.parentElement !== host) host.append(box);
  box.hidden = false;
  const r = el.getBoundingClientRect();
  const frame = host === document.body ? null : host.getBoundingClientRect();
  const ox = frame ? frame.left - host.scrollLeft : -scrollX;
  const oy = frame ? frame.top - host.scrollTop : -scrollY;
  const pad = 6;
  Object.assign(box.querySelector('.spot').style, {
    left: `${r.left - pad - ox}px`, top: `${r.top - pad - oy}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px`,
  });
  const bubble = box.querySelector('.bubble');
  const { offsetWidth: w, offsetHeight: h } = bubble;
  const gap = pad + 12;
  const room = frame ?? { top: 64, bottom: innerHeight, left: 0, right: innerWidth }; // under the top bar
  const below = r.bottom + gap + h < room.bottom - 12 || r.top - gap - h < room.top + 12;
  const left = Math.min(Math.max(room.left + 12, r.left), room.right - w - 12);
  bubble.classList.toggle('above', !below);
  bubble.style.left = `${left - ox}px`;
  bubble.style.top = `${(below ? r.bottom + gap : r.top - gap - h) - oy}px`;
  bubble.style.setProperty('--caret', `${Math.min(Math.max(r.left + Math.min(r.width / 2, 48) - left, 18), w - 18)}px`);
}

let placing = 0;
const replace = () => { placing ||= requestAnimationFrame(() => { placing = 0; if (coached) coach(); }); };

// ---------- Events ----------

function wire() {
  $('draft').innerHTML = PARTS.map((part) => `
    <button class="part" data-part="${part}">
      <span class="part-emoji" aria-hidden="true"></span>
      <span class="part-text"><span class="part-name">${part.toUpperCase()}</span><span class="part-value"></span><span class="part-by"></span></span>
      <span class="part-end"><span class="tag" hidden>not saved</span><span class="cue" aria-hidden="true">change ›</span></span>
    </button>`).join('');

  $('join-name').value = localStorage.getItem(KEY.name) || '';
  $('join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('join-name').value.trim();
    const error = /[\p{L}\p{N}]/u.test(name) ? '' : 'Type your name (a letter or digit).';
    $('join-error').textContent = error;
    if (error) return;
    const res = await call('/api/join', { name });
    if (!res.ok) { $('join-error').textContent = res.error; return; }
    pid = res.pid;
    changed = false;
    localStorage.removeItem(KEY.changed);
    localStorage.setItem(KEY.pid, pid);
    localStorage.setItem(KEY.name, name);
    shown = { step: null, scene: null, lab: null };
    listen();
    refresh();
  });

  $('tour-again').addEventListener('click', startTour);

  $('panel').addEventListener('click', async (e) => {
    if (e.target.closest('[data-pair]')) act('pair');
    const level = e.target.closest('[data-hint]')?.dataset.hint;
    if (level !== undefined) { hintLevel = Number(level); render(); }
    const guess = e.target.closest('[data-guess]');
    if (guess) {
      const res = await call('/api/predict', { moment: guess.dataset.moment, guess: guess.dataset.guess });
      if (!res.ok) toast(res.error || 'Busy, press again.', res.tone || 'bad');
      await refresh();
    }
  });

  $('qa').addEventListener('input', (e) => {
    const el = e.target.closest('[data-field]');
    if (el) { dirty.add(el.dataset.field); countField(el); }
  });
  $('qa').addEventListener('focusout', (e) => { if (e.target.dataset.field) sendField(e.target); });
  $('qa').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.dataset.field) { e.preventDefault(); sendField(e.target); }
  });
  $('qa').addEventListener('click', (e) => { if (e.target.closest('[data-copy]')) copyGitIn7(); });

  $('draft').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-part]');
    if (!btn || !V) return;
    if (popAnchor === btn) { closePopover(); return; }
    if (V.locked) { toast(V.s.mainLocked); return; }
    if (!V.chaos && V.merging) { toast(nextMove(MERGE_OPEN)); return; }
    openPalette(btn, btn.dataset.part);
  });

  $('behind').addEventListener('toggle', () => { if ($('behind').open && V) renderBehind(); });
  $('panel').addEventListener('toggle', fitMission, true); // opening What Git did makes the panel taller

  $('banner').addEventListener('click', (e) => { if (e.target.closest('[data-open-resolver]')) openResolver(); });
  $('paths').addEventListener('click', (e) => {
    const path = e.target.closest('[data-path]');
    if (path) { pathLab = path.dataset.path; renderTable(); }
  });

  $('actions').addEventListener('change', (e) => {
    const id = e.target.dataset.pick;
    if (id) picked[id] = e.target.value;
  });
  $('actions').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-why]')) { e.preventDefault(); e.target.blur(); }
  });
  $('actions').addEventListener('focusout', (e) => {
    if (e.target.matches?.('[data-why]')) sendWhy(e.target);
    if (V) setTimeout(renderActions);
  });
  $('actions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const run = {
      commit: () => act('commit'),
      branch: () => (popAnchor === btn ? closePopover() : openNewNote(btn)),
      switch: () => act('switch', { branch: pickFor('switch') }),
      tomain: () => act('switch', { branch: 'main' }),
      merge: () => predicted('merge', pickFor('merge'), 'merge', { from: pickFor('merge') }),
      deleteNote: () => act('delete-note', { note: pickFor('deleteNote') }, 'deleteNote'),
      push: () => predicted('push', null, 'push'),
      pull: () => act('pull'),
      rebase: () => act('rebase'),
      reflog: () => openDiary(),
      squash: () => confirmThen("This replaces the Wall's history for everyone. Do you want to go on?", 'Replace the Wall', () => act('squash-force', {}, 'squash')),
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
    d.addEventListener('close', () => {
      document.body.append($('toasts'), $('coach'));
      coach();
    });
  }

  // The prediction dialog: one tap, then the action runs.
  $('predict-dialog').addEventListener('click', (e) => {
    const choice = e.target.closest('[data-guess]');
    if (!choice) return;
    $('predict-dialog').close();
    const run = predictRun;
    predictRun = null;
    run?.(choice.dataset.guess);
  });
  $('predict-dialog').addEventListener('close', () => { predictRun = null; });

  // The tour moves on with Next and Skip. A tip goes away on the next click anywhere, the click still counts.
  $('coach').addEventListener('click', (e) => {
    const what = e.target.closest('[data-coach]')?.dataset.coach;
    if (what === 'next' && tour.i + 1 < tour.stops.length) { tour.i += 1; coach(); }
    else if (what === 'next' || what === 'skip') endTour();
  });
  document.addEventListener('click', () => {
    if (coached && !coached.tour) { seeTip(coached.key); setTimeout(coach); }
  }, true);

  document.addEventListener('pointerdown', (e) => {
    if (popAnchor && !$('popover').contains(e.target) && !popAnchor.contains(e.target)) closePopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (popAnchor) { const a = popAnchor; closePopover(); a.focus(); }
    else if (coached?.tour) endTour();
    else if (coached) { seeTip(coached.key); coach(); }
  });
  addEventListener('scroll', replace, { passive: true });
  // The graphs draw as many cards as fit. Wait until the size settles (a full-page screenshot resizes to 1×1 and back).
  let settle = null;
  addEventListener('resize', () => {
    closePopover();
    replace();
    clearTimeout(settle);
    settle = setTimeout(() => { if (V && !V.card) { fitMission(); renderTable(); coach(); } }, 150);
  });
}

wire();
listen();
refresh();
// "Stuck? Hint" appears when the server's time for it comes, without waiting for the next update.
setInterval(() => {
  if (!V || V.card || !state?.me?.hint) return;
  const ready = hintReady();
  if (ready !== hintWasReady) { hintWasReady = ready; renderPanel(); }
}, 1000);
