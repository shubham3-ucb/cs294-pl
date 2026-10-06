// The projector (/screen) is the class's slide deck: one slide per scene, live from the server.
// The teacher console imports renderSlide() for its "On the projector now" preview, so both always match.
// A slide reads only what may be shown: state.projector, the labs' outfits and goals, the Wall, the timer,
// and Step 4's integration paths (session.integration).
import { renderGraph, velocity } from '/graph.js';
import { emoji, renderMonsterCard } from '/monster.js';

// The teacher key comes from ?key= once. It then lives in this tab's sessionStorage (a reload still works) and
// leaves the address bar, so it is not on screen or in a shared screenshot.
const KEY_STORE = 'outfitLab.adminKey';
export const key = (() => {
  const params = new URLSearchParams(location.search);
  const given = params.get('key');
  try {
    if (given) {
      sessionStorage.setItem(KEY_STORE, given);
      params.delete('key');
      history.replaceState(history.state, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    }
    return given || sessionStorage.getItem(KEY_STORE) || '';
  } catch {
    return given || '';
  }
})();

// No key at all (a bookmark without it, a new tab): say how to get in.
export function needKey() {
  if (key) return false;
  document.body.innerHTML = '<p class="no-key">Open the Teacher link from the server: it ends in <code>?key=…</code></p>';
  return true;
}

export async function api(path, body) {
  try {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-admin-key': key, ...(body && { 'content-type': 'application/json' }) },
      body: body && JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'No answer from the server. Press again.' };
  }
}

// Refetch the admin state whenever the server's {v, boot} changes.
// One fetch in flight, at most one queued; a reconnect always refetches.
// The stream is the fast path. Some proxies (a quick tunnel) buffer it, so the page also loads at once
// and polls every 2 s while the stream has been quiet for 4 s. Connected = the last fetch got an answer.
export function live(onState, onConnection) {
  let seen = '', busy = false, queued = false, heard = 0;
  async function refresh() {
    if (busy) { queued = true; return; }
    busy = true;
    const next = await api('/api/admin/state');
    onConnection(Boolean(next.ok));
    if (next.ok) onState(next);
    busy = false;
    if (queued) { queued = false; refresh(); }
  }
  const events = new EventSource(`/api/admin/events?key=${encodeURIComponent(key)}`);
  events.onopen = () => { seen = ''; };
  events.onmessage = (e) => {
    heard = Date.now();
    const { v, boot } = JSON.parse(e.data);
    if (`${boot}:${v}` !== seen) { seen = `${boot}:${v}`; refresh(); }
  };
  refresh();
  setInterval(() => { if (Date.now() - heard > 4000) refresh(); }, 2000);
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Copy uses **bold** and `code`.
export const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');

export const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const timeOfDay = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const qrSrc = (url) => `/api/qr.svg?text=${encodeURIComponent(url)}`;
export const shortUrl = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

// Next and Back from either window. `from` is the scene this window shows, so a clicker's double tap
// moves one scene, never two. Returns the server's answer.
let moving = false;
export async function move(dir, from, labId) {
  if (moving) return { ok: true, result: { unchanged: true } };
  moving = true;
  const res = await api(`/api/admin/${dir}`, { from, labId });
  setTimeout(() => { moving = false; }, 400);
  return res;
}

// → / Space / PageDown = Next, ← / PageUp = Back (what clickers send). Typing and open dialogs are left alone.
const KEYS = { ArrowRight: 'next', ' ': 'next', PageDown: 'next', ArrowLeft: 'back', PageUp: 'back' };
export function presenterKeys(go) {
  addEventListener('keydown', (e) => {
    const dir = KEYS[e.key];
    if (!dir || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    if (e.target.closest?.('input, textarea, select') || document.querySelector('dialog[open]')) return;
    e.preventDefault(); // Space must not also press the focused button
    go(dir);
  });
}

// The window the console opens for the projector, and the channel between them (same browser).
export const PROJECTOR_WINDOW = 'outfit-lab-projector';
export const channel = 'BroadcastChannel' in window ? new BroadcastChannel('outfit-lab') : null;

// The outfit as a stack sized in em, so CSS can size it to the slide.
function figure(el, outfit) {
  renderMonsterCard(el, outfit, { size: 'large' });
  const base = parseFloat(el.children[0].style.fontSize); // the hat is drawn at the base size
  for (const span of el.children) span.style.fontSize = `${parseFloat(span.style.fontSize) / base}em`;
}

// ---------- Slides ----------

const pill = (text) => `<span class="pill">${esc(text)}</span>`;

// The pill and title: "STEP 2 Try two ideas at once", or "THE PAPER" / "EXIT QUESTION" alone.
function head(scene, state, { timer = false, title = '' } = {}) {
  const named = { paper: 'The paper', exit: 'Exit question' }[scene.kind];
  const h1 = title || (named ? '' : esc(state.session.steps[scene.step].title));
  return `<header class="sl-head">${pill(named ?? `Step ${scene.step}`)}${h1 ? `<h1>${h1}</h1>` : ''}
    ${timer ? '<span class="sl-clock" data-clock></span>' : ''}</header>`;
}

const goalsHtml = (goals) => `<ul class="sl-goals">${goals.map((g) =>
  `<li class="${g.done ? 'done' : ''}">${esc(g.text).replaceAll(' + ', '&nbsp;+&nbsp;')}</li>`).join('')}</ul>`;

// With many labs beside the Wall, each goal shows as a tick only, in the same order on every tile.
const ticksHtml = (goals) => `<p class="sl-ticks">${goals.map((g) => `<span class="${g.done ? 'done' : ''}" title="${esc(g.text)}">${g.done ? '✓' : '○'}</span>`).join(' ')}</p>`;

function tile(lab, step, ticks) {
  const body = lab.practice ? '<p class="sl-note">Plays by itself</p>'
    : step === 0 ? `<p class="sl-note">${esc(lab.members.map((m) => m.name).join(', ') || 'Nobody yet')}</p>`
      : ticks ? ticksHtml(lab.goals) : goalsHtml(lab.goals);
  return `<article class="sl-lab${lab.practice ? ' practice' : ''}" style="--lab:${esc(lab.color)}">
    <h2><span class="dot"></span>${esc(lab.name)}</h2><div class="fig" data-fig="${esc(lab.id)}"></div>
    <div class="sl-info">${body}</div></article>`;
}

// "Who first added 🥾?": the Wall's row is the headline, then one line per lab.
function auditHtml(label, audit) {
  const [wall, ...labs] = audit.rows;
  return `<div class="sl-audit"><p class="sl-label">${esc(label)} · who first added ${emoji(audit.part, audit.value)}?</p>
    <p class="sl-audit-wall">${esc(wall.text)}</p>
    <p class="sl-audit-labs">${labs.map((r) => esc(r.text)).join('<br>')}</p></div>`;
}

// One technical card: the command, then what it is, what it does, and how Git does it.
// A narrow label breaks only at the plain space: "What it / does", "How Git / does it".
const ROWS = [['is', 'What&nbsp;it&nbsp;is'], ['does', 'What&nbsp;it does'], ['how', 'How&nbsp;Git does&nbsp;it']];
const techCard = (card) => `<section class="sl-card">
  <p class="sl-cmd" style="--chars:${[...card.command].length}">${esc(card.command)}</p>
  <dl class="sl-rows">${ROWS.map(([k, label]) => `<div class="sl-row ${k}"><dt>${label}</dt><dd>${md(card[k])}</dd></div>`).join('')}</dl>
</section>`;

// ---------- Integration paths: Step 4's reveal and the paper ----------
// Each lab's Step 4 change: when its card was made (the author time) and when the lab's send put it on the
// Wall. The class's own times, from Git, on this clock.

const labColor = (state, id) => state.labs.find((l) => l.id === id)?.color ?? 'var(--muted)';

// One line per lab, in the order the changes reached the Wall; the marked path's line is bold. Step 4's
// reveal adds the note under a replayed change. The type shrinks as lines are added, so six labs still fit.
function pathsHtml(paths, state, { marked = null, notes = false } = {}) {
  const lines = paths.length + (notes ? paths.filter((p) => p.note).length : 0);
  return `<ul class="sl-paths" style="--lines:${lines}">${paths.map((p) => `<li class="${p === marked ? 'on' : ''}"
    style="--lab:${esc(labColor(state, p.labId))}"><span class="dot"></span><span><b>${esc(p.name)}</b> ${emoji(p.part, p.value)} · ${esc(velocity(p))}
    ${notes && p.note ? `<span class="sl-path-note">${esc(p.note)}</span>` : ''}</span></li>`).join('')}</ul>`;
}

// The one path the Wall marks: the last lab to combine (its path runs through its own merge card), else a lab
// that replayed (its path starts at a copy), else the first change to reach the Wall.
function markedPath(paths, state) {
  const way = (p) => state.labs.find((l) => l.id === p.labId)?.way;
  return paths.findLast((p) => way(p) === 'merge') ?? paths.find((p) => way(p) === 'rebase') ?? paths[0] ?? null;
}

// Steps 3–5's reveals: the class's prediction accuracy, then what each lab chose (Steps 4–5).
const factsHtml = (facts) => (facts.length ? `<div class="sl-facts">${facts.map((line) => `<p>${esc(line)}</p>`).join('')}</div>` : '');

// Step 4's reveal: the Wall with one lab's path marked, and every lab's times beside it, then the facts.
function pathsStage(integration, state, facts) {
  const { paths } = integration;
  const marked = markedPath(paths, state);
  return `<div class="sl-stage paths">
    <div class="sl-wall"><p class="sl-label">The Wall${marked ? ` · ${esc(marked.name)}'s path to main (bold)` : ''}</p>
      <svg class="graph" data-wall data-path="${esc(marked?.cards.join(' ') ?? '')}" preserveAspectRatio="xMinYMin meet"></svg></div>
    <div class="sl-side">
      ${paths.length ? pathsHtml(paths, state, { marked, notes: true }) : '<p class="sl-note">No lab\'s change is on the Wall yet.</p>'}
      ${factsHtml(facts)}
    </div>
  </div>`;
}

const SLIDES = {
  join(scene, state) {
    const url = state.session.joinUrl;
    const roster = state.labs.map((lab) => `<li style="--lab:${esc(lab.color)}"><span class="chip">${esc(lab.name)}</span>
      <span>${lab.practice ? 'Plays by itself' : esc(lab.members.map((m) => m.name).join(', ')) || '<span class="muted">Nobody yet</span>'}</span></li>`);
    return `<div class="sl-join"><div class="sl-join-text">
        <p class="sl-kicker">Outfit Lab</p>
        <h1 class="sl-url">${esc(shortUrl(url))}</h1>
        <p class="sl-line">${esc(scene.line)}</p>
        <ul class="sl-roster">${roster.join('')}</ul>
      </div><img class="sl-qr" src="${esc(qrSrc(url))}" alt="QR code for the join link"></div>`;
  },

  // The step's one line, the timer, and the room's progress: lab tiles, the Wall from Step 4, the audit in Step 6.
  task(scene, state) {
    const wall = state.wall?.graph;
    const { before, after } = (scene.step === 6 && state.session.audits) || {};
    const audits = [before && auditHtml('Before the clean-up', before), after && auditHtml('After the clean-up', after)].filter(Boolean);
    // Up to 3 labs: one row of tiles, big, or small beside the Wall. 4 to 6 labs: two rows of small tiles,
    // or beside the Wall one row of tiles whose goals show as ticks.
    const n = state.labs.length;
    const ticks = n > 3 && Boolean(wall);
    const layout = n <= 3 ? (wall ? ' compact' : '') : wall ? ' ticks' : ' compact two-rows';
    const cols = n <= 3 || wall ? n : Math.ceil(n / 2);
    return `${head(scene, state, { timer: true })}
      <p class="sl-line">${md(scene.line)}</p>
      ${wall ? `<div class="sl-stage${audits.length ? ' split' : ''}">
        <div class="sl-wall"><p class="sl-label">The Wall</p><svg class="graph" data-wall preserveAspectRatio="xMinYMin meet"></svg></div>
        ${audits.length ? `<div class="sl-audits">${audits.join('')}</div>` : ''}</div>` : ''}
      <div class="sl-labs${layout}" style="--cols:${cols}">${state.labs.map((lab) => tile(lab, scene.step, ticks)).join('')}</div>`;
  },

  // The technical card (Step 4 has two), as big as the slide allows. Step 0 has no card yet: what went wrong
  // and Behind the door. Step 1 adds the trust line, Step 4 the Wall with each lab's path, Step 6 the audit.
  reveal(scene, state) {
    const r = scene.reveal;
    const pair = r.cards.length > 1;
    const ask = scene.question ? `<p class="sl-ask${pair ? ' small' : ''}">${esc(scene.question)}</p>` : '';
    if (!r.cards.length) {
      return `${head(scene, state)}${ask}<p class="sl-sentence">${esc(r.sentence)}</p>
        <div class="sl-behind"><p class="sl-label">Behind the door</p><p>${md(r.behind)}</p></div>`;
    }
    const after = scene.step === 6 && state.session.audits?.after;
    const bin = scene.step === 6 && state.session.bin;
    const evidence = [
      after && `Who first added ${emoji(after.part, after.value)}? ${after.rows.map((row) => row.text).join(' · ')}`,
      bin && `The Wall's bin: ${bin.before} old card${bin.before === 1 ? '' : 's'}, now ${bin.after}.`,
    ].filter(Boolean);
    const integration = state.session.integration;
    // Steps 3–5: the class's prediction accuracy; Steps 4–5: what each lab chose, and what a way nobody chose does.
    const facts = scene.facts ?? [];
    return `${head(scene, state)}${ask}
      <div class="sl-cards${pair ? ' pair' : ''}">${r.cards.map(techCard).join('')}</div>
      ${r.note ? `<p class="sl-trust">${md(r.note)}</p>` : ''}
      ${evidence.map((line) => `<p class="sl-evidence">${esc(line)}</p>`).join('')}
      ${integration ? pathsStage(integration, state, facts) : factsHtml(facts)}`;
  },

  break(scene, state) {
    const { startedAt, minutes } = state.session.timer;
    return `<div class="sl-break"><p class="sl-kicker">Break</p><p class="sl-countdown" data-clock></p>
      <p class="sl-line">Back at ${esc(timeOfDay(startedAt + minutes * 60e3))}</p></div>`;
  },

  // Good / Bad / Ugly, this class's code velocity next to what they lived, then the one message with its trade-off.
  // The paths are as they were at the end of Step 4; the line under them checks the Wall now.
  paper(scene, state) {
    const p = scene.paper;
    const col = (cls, label, items) => `<div class="sl-col ${cls}"><p class="sl-col-label">${label}</p>
      ${items.map((t) => `<p>${esc(t)}</p>`).join('')}</div>`;
    const paths = state.session.integration?.paths ?? [];
    const onWall = new Set(state.wall?.graph.commits.filter((c) => c.reachable !== false).map((c) => c.id));
    const gone = paths.length > 0 && paths.every((x) => x.cards.every((id) => !onWall.has(id)));
    return `<p class="sl-source">Tuesday's paper · ${esc(p.source)}</p>
      <h1 class="sl-title">${esc(p.title)}</h1>
      <div class="sl-cols">${col('good', 'Good', p.good)}${col('bad', 'Bad', p.bad)}${col('ugly', 'Ugly', p.ugly)}</div>
      <div class="sl-class">
        ${paths.length ? `<div><p class="sl-label">Code velocity in this class</p>${pathsHtml(paths, state)}
          ${gone ? '<p class="sl-gone">After the squash, the Wall has none of these cards.</p>' : ''}</div>` : ''}
        <div><p class="sl-label">What you lived</p><ul class="sl-lived">${p.lived.map((l) => `<li>${esc(l.text)}</li>`).join('')}</ul></div>
      </div>
      <div class="sl-msg"><p class="sl-message">${esc(p.message)}</p><p class="sl-tradeoff">${esc(p.tradeoff)}</p></div>`;
  },

  exit(scene, state) {
    return `${head(scene, state)}
      <p class="sl-question">${esc(scene.question)}</p><p class="sl-line">${esc(scene.line)}</p>`;
  },

  // The three-line summary; with takeaways, a random sample of them under it, names hidden.
  wrap(scene, state) {
    const takeaways = [...state.projector.takeaways ?? []].sort((a, b) => a.step - b.step);
    const lines = scene.wrap.line.split(/(?<=\.) /).map(esc).join('<br>');
    return `<div class="sl-wrap${takeaways.length ? ' with-wall' : ''}"><p class="sl-wrap-line">${lines}</p>
      ${takeaways.length ? `<div class="sl-takeaways">${takeaways.map((t) =>
        `<p><span>Step ${t.step}</span>${esc(t.text)}</p>`).join('')}</div>` : ''}</div>`;
  },
};

// The teacher's "Show on projector": the question alone, as big as it fits.
const questionSlide = (scene, state, question) => `${head(scene, state)}<p class="sl-question">${esc(question)}</p>`;

// "Show answers": the question, then every answer as a card. Names only if the teacher turned them on.
const answersSlide = (scene, state, question, answers) => `${head(scene, state, { title: answers.length === 1 ? '1 answer' : `${answers.length} answers` })}
  <p class="sl-ask">${esc(question)}</p>
  <div class="sl-answers" data-n="${answers.length > 12 ? 'many' : answers.length > 6 ? 'some' : 'few'}">
    ${answers.map((a) => `<p>${a.name ? `<b>${esc(a.name)}</b>` : ''}${esc(a.text)}</p>`).join('')}</div>`;

function slideFor(state) {
  const { scene, question, answers } = state.projector;
  if (answers) return { kind: 'answers', html: answersSlide(scene, state, question, answers) };
  if (question) return { kind: 'question', html: questionSlide(scene, state, question) };
  return { kind: scene.kind, html: SLIDES[scene.kind](scene, state) };
}

// Draw the slide into root (a .slide element). It redraws only when what it shows changed;
// tickSlide() keeps the clock running in between. The Wall shows live on task slides, and with each lab's
// path on Step 4's reveal.
export function renderSlide(root, state) {
  const { kind, html } = slideFor(state);
  const integration = kind === 'reveal' ? state.session.integration : null;
  const wall = kind === 'task' ? state.wall?.graph : integration?.graph;
  const outfits = kind === 'task' ? state.labs.map((l) => l.monster) : null;
  const sig = JSON.stringify([html, wall, outfits]);
  if (root.dataset.sig !== sig) {
    root.dataset.sig = sig;
    root.innerHTML = `<div class="sl kind-${kind}">${html}</div>`;
    for (const el of root.querySelectorAll('[data-fig]')) figure(el, state.labs.find((l) => l.id === el.dataset.fig).monster);
    const svg = root.querySelector('[data-wall]');
    if (svg && integration) {
      const path = svg.dataset.path ? svg.dataset.path.split(' ') : [];
      renderGraph(svg, wall, { labels: true, compact: true, maxCols: 7, pillFont: 14, path });
    } else if (svg) renderGraph(svg, wall, { labels: true, maxCols: 5, pillFont: 16 });
  }
  tickSlide(root, state);
}

export function tickSlide(root, state) {
  const el = root.querySelector('[data-clock]');
  if (!el) return;
  const { startedAt, minutes } = state.session.timer;
  const left = minutes * 60e3 - (Date.now() - startedAt);
  el.textContent = clock(left);
  el.classList.toggle('over', left <= 0);
}

// ---------- The projector page ----------

if (document.body.id === 'screen') startProjector();

function startProjector() {
  if (needKey()) return;
  const slide = document.getElementById('slide');
  const qr = document.getElementById('qr');
  let state = null;

  live((next) => {
    state = next;
    renderSlide(slide, state);
    if (!qr.hidden) showQr(true);
  }, (on) => document.body.classList.toggle('offline', !on));
  setInterval(() => state && tickSlide(slide, state), 1000);

  presenterKeys((dir) => state && move(dir, state.projector.scene.n));
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });

  // The console's "Join QR": the big QR here too, while it is open there.
  function showQr(on) {
    qr.hidden = !on || !state;
    if (qr.hidden) return;
    const url = state.session.joinUrl;
    const img = qr.querySelector('img');
    if (img.getAttribute('src') !== qrSrc(url)) img.src = qrSrc(url);
    qr.querySelector('.sl-url').textContent = shortUrl(url);
  }
  channel?.addEventListener('message', (e) => showQr(Boolean(e.data?.qr)));

  // A short hint for whoever sets up the projector; it leaves on its own.
  const hint = document.getElementById('keys-hint');
  setTimeout(() => hint.classList.add('gone'), 6000);
  document.addEventListener('fullscreenchange', () => hint.classList.add('gone'));
}
