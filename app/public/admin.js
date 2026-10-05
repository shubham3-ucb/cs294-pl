// Teacher page (/admin). Also exports the live-state helpers the projector (screen.js) shares.
import { renderGraph } from '/graph.js';
import { emoji, renderMonsterCard } from '/monster.js';

const key = new URLSearchParams(location.search).get('key') || '';

async function api(path, body) {
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
export function live(onState, onConnection) {
  let seen = '', busy = false, queued = false;
  async function refresh() {
    if (busy) { queued = true; return; }
    busy = true;
    const next = await api('/api/admin/state');
    if (next.ok) onState(next);
    busy = false;
    if (queued) { queued = false; refresh(); }
  }
  const events = new EventSource(`/api/admin/events?key=${encodeURIComponent(key)}`);
  events.onopen = () => { seen = ''; onConnection(true); };
  events.onerror = () => onConnection(false);
  events.onmessage = (e) => {
    const { v, boot } = JSON.parse(e.data);
    if (`${boot}:${v}` !== seen) { seen = `${boot}:${v}`; refresh(); }
  };
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Step copy uses **bold** and `code`.
export const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');

// Teacher notes read like the lesson script: labels in bold, each but the first on its own line.
const notesHtml = (s) => md(s)
  .replace(/ (Board|If behind|Pause|Say|Ask):/g, '<br>$1:')
  .replace(/\b(Say|Do|Ask|Pause|Watch for|Board|If behind)( \([^)]*\))?:/g, '<b>$&</b>');

export const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// The break runs until session.breakUntil (a time), shown as "back at 2:36".
export const onBreak = (session, now = Date.now()) => session.breakUntil > now;
export const backAt = (session) => new Date(session.breakUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const qrSrc = (url) => `/api/qr.svg?text=${encodeURIComponent(url)}`;

export const isWrap = (session) => session.step === session.steps.length - 1;

// "🐱 + 🤖" never breaks across lines.
export const goalsHtml = (goals) => `<ul class="goals">${goals.map((g) =>
  `<li class="${g.done ? 'done' : ''}">${esc(g.text).replaceAll(' + ', '&nbsp;+&nbsp;')}</li>`).join('')}</ul>`;

// SPEC §4 concept chips: [concept id, label, step that introduces it].
const CHIPS = [
  ['save', 'Save', 1], ['branch', 'Branch', 2], ['fastforward', 'Fast-forward', 3], ['merge', 'Merge', 3],
  ['conflict', 'Conflict solved', 3], ['push', 'Push', 5], ['rejected', 'Refused push', 5], ['pull', 'Pull', 5],
  ['revert', 'Revert', 6], ['reset', 'Reset', 6], ['diary', 'Diary', 6], ['force', 'Force push', 7],
];

// Chips for the ideas introduced in steps from..to; lit once the lab has used that idea.
export const chipsHtml = (counts = {}, to, from = 1) =>
  `<div class="chips">${CHIPS.filter(([, , step]) => step >= from && step <= to).map(([id, label]) =>
    `<span class="chip ${counts[id] ? 'on' : ''}">${label}${counts[id] > 1 ? ` <b>${counts[id]}</b>` : ''}</span>`).join('')}</div>`;

// Refused, conflict and error lines are red in the feed.
export const isRedLine = (entry) => /refused|conflict|error/i.test(entry.outcome ?? '');

const HANDS_ON = [1, 2, 3, 5, 6]; // steps where every lab should be clicking

// The one status line per lab: {text, alert}, or null when there is nothing to say.
// alert = red on the teacher page and a "needs help" dot on the projector.
export function labStatus(lab, { session }, now) {
  const { step } = session;
  if (step === 0 || isWrap(session)) return null;
  const online = lab.members.filter((m) => m.online);
  const lines = [];

  const opened = Object.values(lab.merging ?? {}).map((m) => m.t).filter(Number.isFinite);
  if (opened.length) {
    const ms = now - Math.min(...opened);
    lines.push({ text: `In a conflict for ${clock(ms)}`, alert: ms > 120e3 });
  } else if (Object.keys(lab.merging ?? {}).length) {
    lines.push({ text: 'In a conflict', alert: false });
  }

  // The server counts refused sends in a row this step; a send or a Get & combine that works resets it.
  const refused = lab.refusedInARow ?? 0;
  if (refused >= 2) lines.push({ text: `Refused ${refused === 2 ? 'twice' : `${refused} times`} in a row`, alert: true });

  // Everyone starts the step where the last one left them, so give them a minute to switch.
  // A lab that is done may look around on other notes.
  const done = lab.goals.length > 0 && lab.goals.every((g) => g.done);
  const offMain = [3, 5, 6].includes(step) && !done ? online.filter((m) => m.branch !== 'main') : [];
  if (offMain.length) {
    lines.push({ text: `Not on main: ${offMain.map((m) => m.name).join(', ')}`, alert: now - session.timer.startedAt > 60e3 });
  }

  const acting = HANDS_ON.includes(step) || (step === 7 && session.stepLab?.[7] === lab.id);
  const quiet = now - Math.max(lab.lastClickAt ?? 0, lab.lastOp?.t ?? 0, session.timer.startedAt);
  if (acting && online.length && !done && quiet > 120e3) lines.push({ text: `No clicks for ${clock(quiet)}`, alert: true });

  return lines.find((l) => l.alert) ?? lines[0] ?? null;
}

// The audits to show. Once the boss has replaced the Wall (the server records when) and every
// audit has its time (t), the newest from before and the newest from after the clean-up.
// Otherwise only what is sure: their order.
export function auditCards(session) {
  const audits = session.audits ?? [];
  const at = session.replacedAt;
  if (at && audits.every((a) => Number.isFinite(a.t))) {
    const before = audits.filter((a) => a.t < at).at(-1);
    const after = audits.filter((a) => a.t >= at).at(-1);
    return [before && { label: 'Before the clean-up', audit: before }, after && { label: 'After the clean-up', audit: after, after: true }]
      .filter(Boolean);
  }
  const shown = audits.slice(-2);
  return shown.map((audit, i) => ({ label: shown.length < 2 ? 'Audit' : i ? 'Latest audit' : 'Earlier audit', audit }));
}

// The Wall's answer is the headline (the server lists it first); then one line per lab.
export function auditHtml({ label, audit }, cls) {
  const [wall, ...labs] = audit.lines;
  return `<div class="${cls}">
    <p class="label">${esc(label)} · who first added ${esc(audit.part?.toUpperCase())} ${emoji(audit.part, audit.value)}?</p>
    <p class="audit-wall">${esc(wall)}</p>
    <p class="audit-labs">${labs.map(esc).join('<br>')}</p></div>`;
}

// Step 7's paper moment, once the audit after the clean-up exists.
export const PAPER_LINE = 'The Tuesday paper: flat history is data loss.';
const auditPaperHtml = (cards, cls) => (cards.some((c) => c.after) ? `<p class="${cls}">${PAPER_LINE}</p>` : '');

// Replace an element's content only when it changed, and never under a focused menu.
// `sig` also covers data drawn after the HTML (monsters, graphs).
export function patch(el, html, sig = html) {
  if (el.dataset.sig === sig) return false;
  if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return false;
  el.innerHTML = html;
  el.dataset.sig = sig;
  return true;
}

// Draw a graph only when its data or options changed. Returns true if it drew.
export function drawGraph(svg, graph, opts) {
  const sig = JSON.stringify([graph, opts]);
  if (svg.dataset.sig === sig) return false;
  svg.dataset.sig = sig;
  renderGraph(svg, graph, opts);
  return true;
}

// ---------- Teacher page ----------

if (document.body.id === 'admin') startAdmin();

function startAdmin() {
  const $ = (id) => document.getElementById(id);
  const RESCUE_STEPS = [2, 3, 5, 6, 7];
  const TOOL_FROM = { sabotage: 5, audit: 6, gc: 7 }; // the step each Wall tool belongs to
  let state = null;
  let feedLab = null; // lab id the feed is filtered to

  $('projector').href = `/screen?key=${encodeURIComponent(key)}`;
  for (let n = 2; n <= 6; n++) $('lab-count').add(new Option(String(n), n));

  // Run an admin action; the pressed button waits until the server answers,
  // then render() sets every button's own enabled state again.
  async function act(path, body, { sure, button } = {}) {
    if (sure && !confirm(sure)) return;
    if (button) button.disabled = true;
    const res = await api(path, body);
    if (button) button.disabled = false;
    if (state) render(state);
    const out = $('tool-result');
    out.classList.toggle('error', !res.ok);
    out.textContent = res.ok ? (res.result?.message || '') : (res.error || 'Something went wrong.');
  }

  const step = () => state.session.step;
  const labById = (id) => state.labs.find((l) => l.id === id);
  // Step 4's re-clone runs once; the server remembers whose main it sent.
  const wallIsSet = () => state.session.stepLab?.[4] != null;

  $('prev').onclick = (e) => act('/api/admin/step', { step: step() - 1 }, { button: e.currentTarget });
  $('next').onclick = (e) => {
    const to = step() + 1;
    const labId = $('step-lab').hidden ? undefined : $('step-lab-select').value;
    const sure = to === 4 && !wallIsSet()
      ? `Put ${labById(labId)?.name ?? 'the chosen lab'}'s main on the Wall, then re-clone every lab from it?\n\n`
        + 'Other sticky notes, unsaved parts and open merges are dropped. Prev does not undo this.'
      : null;
    act('/api/admin/step', { step: to, labId }, { sure, button: e.currentTarget });
  };
  $('step-lab-select').onchange = (e) => { e.target.dataset.picked = step() + 1; };
  $('timer-restart').onclick = () => act('/api/admin/timer', {});
  $('ask').onclick = () => act('/api/admin/ask', { on: !state.session.ask });
  $('break').onclick = () => act('/api/admin/break', { on: !onBreak(state.session) });
  $('lab-count').onchange = (e) => act('/api/admin/labs', { count: Number(e.target.value) });
  $('sabotage').onclick = (e) => act('/api/admin/sabotage', {}, { button: e.currentTarget });
  $('audit').onclick = (e) => act('/api/admin/audit', { part: 'legs', value: 'tentacles' }, { button: e.currentTarget });
  $('gc').onclick = (e) => act('/api/admin/gc', {}, { button: e.currentTarget });
  $('reset').onclick = (e) => act('/api/admin/reset', {}, {
    sure: 'Reset the whole session? Every card, lab and name is wiped. Everyone joins again.',
    button: e.currentTarget,
  });
  $('feed-all').onclick = () => filterFeed(null);

  function filterFeed(id) {
    feedLab = id;
    renderFeed();
    renderLabs();
  }

  $('labs').addEventListener('click', (e) => {
    const head = e.target.closest('[data-lab]');
    if (head) filterFeed(feedLab === head.dataset.lab ? null : head.dataset.lab);
    const rescue = e.target.closest('[data-rescue]');
    if (rescue) {
      const lab = labById(rescue.dataset.rescue);
      act('/api/admin/rescue', { labId: lab.id }, {
        sure: `Rescue ${lab.name}? The teacher finishes this step for them. Open merges and unsaved parts on those notes are dropped.`,
        button: rescue,
      });
    }
  });
  $('labs').addEventListener('change', (e) => {
    const { move } = e.target.dataset;
    if (!move || !e.target.value) return;
    e.target.blur();
    act('/api/admin/move', { pid: move, labId: e.target.value });
  });

  function render(next) {
    state = next;
    const { session, labs } = state;
    const s = session.steps[session.step];
    const upcoming = session.steps[session.step + 1];

    // A row hides when its text is empty.
    const row = (id, html) => { $(id).innerHTML = html; $(id).closest('.row').hidden = !html; };

    // This step, in lesson order. A step without an "ask first" question shows its problem here:
    // students meet it during the step, before the pause.
    $('step-title').textContent = `Step ${session.step} · ${s.title}`;
    row('facilitator', notesHtml(s.facilitator ?? ''));
    row('problem', s.askFirst ? '' : md(s.behind?.problem ?? ''));
    row('check', md(s.check ?? ''));
    row('hope', md(s.hope ?? ''));
    row('idea', md(s.behind?.idea ?? ''));
    row('how', md(s.behind?.text ?? '') + (s.paper ? `<span class="paper">${esc(s.paper)}</span>` : ''));
    $('ask').textContent = session.ask ? 'Stop asking' : 'Ask on the projector';
    $('ask').classList.toggle('on', session.ask);

    // The next step: its problem and idea question come before pressing Next.
    $('coming-title').textContent = upcoming ? `Next · Step ${session.step + 1} · ${upcoming.title}` : 'This is the last step.';
    const early = Boolean(upcoming?.askFirst);
    row('next-problem', early ? md(upcoming.behind?.problem ?? '') : '');
    row('next-ask', early ? md(upcoming.askFirst) : '');
    row('next-idea', early ? md(upcoming.behind?.idea ?? '') : '');
    $('prev').disabled = session.step === 0;
    $('next').disabled = !upcoming;
    $('next').textContent = upcoming ? `Start Step ${session.step + 1}` : 'Last step';
    $('next-note').textContent = session.step + 1 === 4 && wallIsSet()
      ? 'The Wall is already set up. Nothing is re-cloned.'
      : upcoming?.next || '';
    renderStepLab();

    if ($('qr').getAttribute('src') !== qrSrc(session.joinUrl)) $('qr').src = qrSrc(session.joinUrl);
    $('join').classList.toggle('small', session.step > 0);
    $('join-url').textContent = session.joinUrl;
    const people = labs.flatMap((l) => l.members);
    $('people').textContent = `${people.length} people · ${people.filter((m) => m.online).length} online`;
    if (document.activeElement !== $('lab-count')) $('lab-count').value = labs.length;
    $('lab-count').disabled = session.step > 0;

    for (const [id, from] of Object.entries(TOOL_FROM)) {
      $(id).disabled = session.step < from;
      $(id).title = session.step < from ? `Used from Step ${from}` : '';
    }

    renderAudits();
    renderLabs();
    renderWall();
    renderFeed();
    tick();
  }

  // Steps 4 and 7 need a lab: whose main goes to the Wall, and who is the boss.
  function renderStepLab() {
    const nextStep = step() + 1;
    const wanted = (nextStep === 4 && !wallIsSet()) || nextStep === 7;
    $('step-lab').hidden = !wanted;
    if (!wanted) return;
    $('step-lab-label').textContent = nextStep === 4 ? 'Send to the Wall:' : 'Boss lab:';
    const select = $('step-lab-select');
    patch(select, state.labs.map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join(''));
    // Follow the default until the teacher picks a lab for this step.
    if (select.dataset.picked !== String(nextStep) && document.activeElement !== select) {
      select.value = state.session.stepLab?.[nextStep] ?? defaultStepLab(nextStep).id;
    }
  }

  // Step 4 default: the first lab with every Step 3 goal ticked. Boss default: Lab 1.
  function defaultStepLab(nextStep) {
    const done = (l) => l.goals.length && l.goals.every((g) => g.done);
    return (nextStep === 4 && state.labs.find(done)) || state.labs[0];
  }

  function renderAudits() {
    const cards = step() >= 6 ? auditCards(state.session) : [];
    $('audits').hidden = !cards.length;
    patch($('audits'), cards.map((c) => auditHtml(c, 'audit-card')).join('') + auditPaperHtml(cards, 'audit-paper'));
  }

  // Each lab column keeps its graph and monster nodes, so sticky notes glide when they move.
  function renderLabs() {
    const box = $('labs');
    const ids = state.labs.map((l) => l.id).join();
    if (box.dataset.ids !== ids) {
      box.innerHTML = state.labs.map((l) => `<article class="lab" style="--lab:${esc(l.color)}">
        <div class="lab-top"></div><p class="status"></p><ul class="members"></ul>
        <div class="now"><div class="monster"></div><div class="mini"><svg class="graph"></svg></div></div>
        <div class="lab-more"></div></article>`).join('');
      box.dataset.ids = ids;
    }
    state.labs.forEach((lab, i) => {
      const el = box.children[i];
      const n = step();
      el.classList.toggle('filtered', feedLab === lab.id);
      patch(el.querySelector('.lab-top'), `
        <h3 class="lab-head" data-lab="${esc(lab.id)}" title="Show only this lab in the feed">
          <span class="dot"></span>${esc(lab.name)}<span class="muted">${lab.members.length} people</span></h3>
        ${lab.goals.length ? goalsHtml(lab.goals) : ''}`);
      patch(el.querySelector('.members'), membersHtml(lab));
      const monster = el.querySelector('.monster');
      if (monster.dataset.sig !== JSON.stringify(lab.monster)) {
        monster.dataset.sig = JSON.stringify(lab.monster);
        renderMonsterCard(monster, lab.monster, { size: 'small' });
      }
      const mini = el.querySelector('.mini');
      mini.hidden = !lab.graph;
      if (lab.graph) drawGraph(mini.querySelector('svg'), lab.graph, { compact: true, labels: true, maxCols: 4 });
      patch(el.querySelector('.lab-more'), moreHtml(lab));
    });
  }

  function membersHtml(lab) {
    const others = state.labs.filter((l) => l !== lab);
    return lab.members.map((m) => `
      <li><span class="online ${m.online ? 'on' : ''}" title="${m.online ? 'Online' : 'Offline'}"></span>
        <span class="name">${esc(m.name)}</span>
        ${step() >= 2 ? `<span class="pair">${esc(m.pair)}</span><span class="note">${esc(m.branch)}</span>` : ''}
        <select data-move="${esc(m.pid)}" aria-label="Move ${esc(m.name)}"><option value="">Move</option>
          ${others.map((o) => `<option value="${esc(o.id)}">to ${esc(o.name)}</option>`).join('')}</select></li>`).join('')
      || '<li class="muted">Nobody yet</li>';
  }

  function moreHtml(lab) {
    const n = step();
    const last = lab.lastOp;
    const done = lab.goals.length > 0 && lab.goals.every((g) => g.done);
    const canRescue = RESCUE_STEPS.includes(n) && !done && (n !== 7 || state.session.stepLab?.[7] === lab.id);
    return `
      ${last ? `<p class="last">${esc(last.who)} · ${esc(last.action)}${last.outcome ? ` → ${esc(last.outcome)}` : ''} · <span data-ago="${last.t}"></span></p>` : ''}
      ${n > 0 ? chipsHtml(lab.concepts, n) : ''}
      ${canRescue ? `<button class="small" data-rescue="${esc(lab.id)}">Rescue</button>` : ''}`.trim();
  }

  // The newest cards that fit the panel; a pill stands for the older ones.
  function renderWall() {
    const wall = state.wall?.graph;
    $('wall-panel').hidden = !wall;
    if (wall) drawGraph($('wall-graph'), wall, { labels: true, width: $('wall-panel').clientWidth });
  }

  const ago = (ms) => (ms < 10e3 ? 'just now' : ms < 60e3 ? `${Math.floor(ms / 1e3)} s ago` : `${Math.floor(ms / 60e3)} min ago`);

  function renderFeed() {
    const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const rows = state.feed.filter((f) => !feedLab || f.labId === feedLab);
    $('feed-all').hidden = !feedLab;
    patch($('feed'), rows.map((f) => `
      <li class="${isRedLine(f) ? 'bad' : ''}"><time>${time(f.t)}</time>
        <p>${f.labId ? `${esc(labById(f.labId)?.name ?? `Lab ${f.labId}`)} · ` : ''}${esc(f.who)} — ${esc(f.action)}${f.outcome ? ` → ${esc(f.outcome)}` : ''}
        ${f.porcelain ? `<code>${esc(f.porcelain)}</code>` : ''}</p></li>`).join('') || '<li class="muted">Nothing yet.</li>');
  }

  // Time-based text (timer, status lines, "ago") updates every second without a refetch.
  function tick() {
    if (!state) return;
    const now = Date.now();
    const { session } = state;
    const { timer } = session;
    const s = session.steps[session.step];
    const elapsed = now - timer.startedAt;
    const work = timer.minutes * 60e3;
    let text = `${clock(elapsed)} / ${clock(work)}`;
    if (session.planStartedAt) {
      // Late start, plus any time past this step's slot in the plan (work + talk).
      const next = session.steps[session.step + 1];
      const slot = ((next ? next.at : s.at + s.minutes) - s.at) * 60e3;
      const late = Math.round((timer.startedAt - session.planStartedAt - s.at * 60e3 + Math.max(0, elapsed - slot)) / 60e3);
      text += late > 0 ? ` · ${late} min behind plan` : late < 0 ? ` · ${-late} min ahead` : ' · on plan';
    }
    $('timer').textContent = text;
    const resting = onBreak(session, now);
    $('break').hidden = session.step !== 3 && !resting; // the lesson's one break comes after Step 3
    $('break').textContent = resting ? `End break (back at ${backAt(session)})` : 'Break · 4 min';
    $('break').classList.toggle('on', resting);
    $('timer').parentElement.classList.toggle('warn', elapsed >= 0.75 * work && elapsed < work);
    $('timer').parentElement.classList.toggle('over', elapsed >= work);

    state.labs.forEach((lab, i) => {
      const el = $('labs').children[i]?.querySelector('.status');
      if (!el) return;
      const status = labStatus(lab, state, now);
      el.textContent = status?.text ?? '';
      el.classList.toggle('alert', Boolean(status?.alert));
    });
    for (const el of document.querySelectorAll('[data-ago]')) el.textContent = ago(now - Number(el.dataset.ago));
  }

  live(render, (on) => $('conn').classList.toggle('off', !on));
  setInterval(tick, 1000);
  let settle = null; // redraw the Wall once the size settles
  addEventListener('resize', () => { clearTimeout(settle); settle = setTimeout(() => state && renderWall(), 150); });
}
