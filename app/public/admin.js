// Teacher console (/admin). One Next button walks the class through the scene script; the projector
// follows. Say, Do, the answer, lab status, tools and Details stay here, never on the projector.
import { renderGraph, velocity } from '/graph.js';
import { emoji, renderMonsterCard } from '/monster.js';
import {
  api, live, esc, md, clock, key, move, presenterKeys, renderSlide, tickSlide, qrSrc, shortUrl, channel, PROJECTOR_WINDOW,
} from '/screen.js';

const $ = (id) => document.getElementById(id);
const DISGUISE = emoji('glasses', 'disguise');
const BOOTS = emoji('shoes', 'boots');
const HANDS_ON = [1, 2, 3, 4, 5]; // steps where every lab should be clicking (Step 6: only the boss lab)
const STUCK_MS = 120e3;

// Wrap counts per lab: [concept id, one, many].
const COUNTS = [['save', 'card', 'cards'], ['merge', 'merge', 'merges'], ['conflict', 'conflict solved', 'conflicts solved'],
  ['rejected', 'refused send', 'refused sends'], ['rebase', 'replay', 'replays'], ['revert', 'undo', 'undos']];

// Step 4: how a refused lab gets the Wall's cards, as its mission names it.
const WAYS = { merge: 'Combine (merge)', rebase: 'Replay on top (rebase)' };

// The scene's tools, in the main card only when the scene needs them. Rescue sits on the lab tiles,
// Show answers with the question.
const TOOLS = {
  sabotage: { html: `Sabotage: the Intern's ${DISGUISE} card`, path: '/api/admin/sabotage' },
  audit: { html: `Ask the Wall: who added ${BOOTS}?`, path: '/api/admin/audit' },
  gc: { html: "Empty the Wall's bin <code>git gc --prune=now</code>", path: '/api/admin/gc' },
  timer: { html: 'Restart the break timer', path: '/api/admin/timer' },
};

let state = null;
const scene = () => state.session.scene;
// Scenes where the labs are at work, so their goals and status mean something.
const working = () => ['task', 'reveal', 'break'].includes(scene().kind);
const planClock = (min) => `${Math.floor(min / 60)}:${String(Math.floor(min % 60)).padStart(2, '0')}`;
const exportHref = `/api/admin/export?key=${encodeURIComponent(key)}`;

// Replace an element's content only when it changed, and never under a focused menu.
function patch(el, html, sig = html) {
  if (el.dataset.sig === sig) return false;
  if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return false;
  el.innerHTML = html;
  el.dataset.sig = sig;
  return true;
}

function report(text, error = false) {
  $('tool-result').textContent = text;
  $('tool-result').classList.toggle('error', error);
}

// Run an admin action; the pressed button waits until the server answers.
async function act(path, body, { sure, button } = {}) {
  if (sure && !confirm(sure)) return;
  if (button) button.disabled = true;
  const res = await api(path, body);
  if (button) button.disabled = false;
  report(res.ok ? res.result?.message ?? '' : res.error ?? 'Something went wrong.', !res.ok);
}

// ---------- Next and Back (button, keys, clicker) ----------

async function go(dir) {
  if (!state || !scene()[dir]) return;
  const labId = dir === 'next' && !$('pick').hidden ? $('pick-lab').value : undefined;
  $('next').disabled = $('back').disabled = true;
  const res = await move(dir, scene().n, labId);
  renderNav();
  if (!res.ok) report(res.error ?? 'Something went wrong.', true);
}

$('next').onclick = () => go('next');
$('back').onclick = () => go('back');
presenterKeys(go);

// ---------- Top bar ----------

$('present').onclick = () => {
  window.open(`/screen?key=${encodeURIComponent(key)}`, PROJECTOR_WINDOW, 'popup,width=1280,height=720')?.focus();
};
$('join-qr').onclick = () => {
  $('qr-dialog').showModal();
  channel?.postMessage({ qr: true });
};
$('qr-dialog').addEventListener('close', () => channel?.postMessage({ qr: false }));
addEventListener('pagehide', () => $('qr-dialog').open && channel?.postMessage({ qr: false }));

// ---------- The question and its answers ----------

$('ask-show').onclick = (e) => act('/api/admin/ask', { on: !state.session.ask }, { button: e.currentTarget });
$('answers-show').onclick = (e) => act('/api/admin/answers',
  { on: !state.session.show.answers, names: $('answers-names').checked }, { button: e.currentTarget });
$('answers-names').onchange = (e) => {
  if (state.session.show.answers) act('/api/admin/answers', { on: true, names: e.target.checked });
};

$('tools').addEventListener('click', (e) => {
  const button = e.target.closest('[data-tool]');
  if (button) act(TOOLS[button.dataset.tool].path, {}, { button });
});

// ---------- Labs ----------

$('labs').addEventListener('click', (e) => {
  const button = e.target.closest('[data-rescue]');
  if (!button) return;
  const lab = state.labs.find((l) => l.id === button.dataset.rescue);
  act('/api/admin/rescue', { labId: lab.id }, {
    sure: `Rescue ${lab.name}? The app finishes this step for them with real Git. Open merges and unsaved parts on those notes are dropped.`,
    button,
  });
});

$('pick-lab').onchange = (e) => {
  e.target.dataset.picked = state.session.scenes[scene().next.n].id;
  renderComing();
};

// ---------- Details ----------

$('lab-count').add(new Option('Auto', 'auto'));
for (let n = 1; n <= 6; n++) $('lab-count').add(new Option(n === 1 ? '1 + practice lab' : String(n), n));
$('lab-count').onchange = (e) => act('/api/admin/labs', { count: e.target.value === 'auto' ? 'auto' : Number(e.target.value) });
$('export').href = exportHref;
$('reset').onclick = (e) => act('/api/admin/reset', {}, {
  sure: 'Reset the whole session? Every card, lab, name and answer is wiped. Everyone joins again.',
  button: e.currentTarget,
});
$('rosters').addEventListener('change', (e) => {
  const { move: pid } = e.target.dataset;
  if (!pid || !e.target.value) return;
  e.target.blur();
  act('/api/admin/move', { pid, labId: e.target.value });
});
$('details').addEventListener('toggle', () => state && renderDetails());

// Rehearse with bots: bot students join and play every step, so one person can run the class alone.
const SPEEDS = { 1: 'Real time', 5: '5× faster', 20: '20× faster' };
for (let n = 2; n <= 12; n++) $('bot-count').add(new Option(String(n), n));
$('bot-count').value = '9';
for (const [speed, label] of Object.entries(SPEEDS)) $('bot-speed').add(new Option(label, speed));
const rehearse = (on, button) =>
  act('/api/admin/rehearse', { on, count: Number($('bot-count').value), speed: Number($('bot-speed').value) }, { button });
$('bot-toggle').onclick = (e) => rehearse(!state.rehearsal, e.currentTarget);
$('bot-speed').onchange = () => state.rehearsal && rehearse(true);

// ---------- Render ----------

function render(next) {
  const moved = !state || state.session.boot !== next.session.boot || state.session.scene.n !== next.session.scene.n;
  state = next;
  if (moved) report('');
  const { session } = state;
  const s = scene();

  const people = state.labs.flatMap((l) => l.members);
  $('people').textContent = `${session.people} ${session.people === 1 ? 'person' : 'people'} · ${people.filter((m) => m.online).length} online`;
  if ($('qr-img').getAttribute('src') !== qrSrc(session.joinUrl)) $('qr-img').src = qrSrc(session.joinUrl);
  $('qr-url').textContent = shortUrl(session.joinUrl);

  $('scene-pos').textContent = `Scene ${s.n + 1} of ${session.scenes.length} · plan ${planClock(s.at)}`;
  $('scene-title').textContent = s.title;

  // A row hides when it has nothing to say.
  const row = (id, html) => { $(id).innerHTML = html; $(id).closest('.row').hidden = !html; };
  row('say', md(s.say ?? ''));
  row('do', md(s.do ?? ''));
  row('board', md(s.board ?? ''));
  renderPaths();
  $('ask-q').closest('.row').hidden = !s.ask;
  if (s.ask) {
    $('ask-q').textContent = s.ask.q;
    $('ask-a').textContent = s.ask.a;
    $('ask-show').textContent = session.ask ? 'Hide from projector' : 'Show on projector';
    $('ask-show').classList.toggle('on', Boolean(session.ask));
  }
  renderAnswers();
  $('takeaways').hidden = !s.takeaways;
  if (s.takeaways) $('takeaways').textContent = `Takeaways written: ${s.takeaways.count}/${s.takeaways.of}`;

  patch($('tools'), s.tools.filter((t) => TOOLS[t]).map((t) => `<button data-tool="${t}">${TOOLS[t].html}</button>`).join('')
    + (s.tools.includes('export') ? `<a class="button" href="${exportHref}" download>Export answers</a>` : ''));
  renderAudits();

  $('ready').textContent = (['task', 'break'].includes(s.kind) && session.ready?.text) || '';
  $('ready').classList.toggle('all', Boolean(session.ready) && session.ready.done === session.ready.of);
  renderNav();
  renderComing();
  renderSlide($('preview'), state);
  renderTiles();
  renderRehearsal();
  renderDetails();
  tick();
}

function renderRehearsal() {
  const r = state.rehearsal;
  $('rehearsing').hidden = !r;
  if (r) $('rehearsing').textContent = `Rehearsal · ${r.count} bots${r.speed > 1 ? ` · ${SPEEDS[r.speed]}` : ''}`;
  $('bot-toggle').textContent = r ? 'Stop rehearsal' : 'Start rehearsal';
  $('bot-count').disabled = Boolean(r);
  if (r && document.activeElement !== $('bot-speed')) $('bot-speed').value = String(r.speed);
}

function renderNav() {
  const s = scene();
  $('next').textContent = s.next ? `Next: ${s.next.title}` : 'Last scene';
  $('next').disabled = !s.next;
  $('back').disabled = !s.back;
}

function renderAnswers() {
  const { answers } = scene();
  const { show } = state.session;
  $('answers').hidden = !answers;
  if (!answers) return;
  $('answers-count').textContent = `${answers.count}/${answers.of} answered`;
  $('answers-show').textContent = show.answers ? 'Hide answers' : 'Show answers on projector';
  $('answers-show').classList.toggle('on', show.answers);
  $('answers-show').disabled = !answers.count && !show.answers;
  if (show.answers) $('answers-names').checked = show.names;
  const labName = (id) => state.labs.find((l) => l.id === id)?.name ?? '';
  patch($('answers-list'), answers.list.map((a) =>
    `<li><b>${esc(a.name)}</b> <span class="muted">${esc(labName(a.labId))}</span> · ${esc(a.text)}</li>`).join(''));
}

// Step 4's reveal and the paper: each lab's change, when it was made and when it reached the Wall, to read aloud.
function renderPaths() {
  const paths = state.session.integration?.paths ?? [];
  $('paths').closest('.row').hidden = !paths.length;
  patch($('paths'), paths.map((p) => `<li><b>${esc(p.name)}</b> ${emoji(p.part, p.value)} ${esc(velocity(p))}${p.copy ? ' <span class="muted">· starts at a copy</span>' : ''}</li>`).join(''));
}

// Step 6: what the Wall and each lab answered, before and after the clean-up, and the bin.
function renderAudits() {
  const { audits, bin } = state.session;
  const shown = scene().tools.includes('audit') && audits;
  const card = (label, audit) => audit && `<div class="audit"><p class="label">${label} · who first added ${BOOTS}?</p>
    ${audit.rows.map((r, i) => `<p class="${i ? '' : 'audit-wall'}">${esc(r.text)}</p>`).join('')}</div>`;
  patch($('audits'), shown ? [
    card('Before the clean-up', audits.before),
    card('After the clean-up', audits.after),
    bin && `<div class="audit"><p class="label">The Wall's bin</p><p class="audit-wall">${bin.before} old card${bin.before === 1 ? '' : 's'}, now ${bin.after}</p></div>`,
  ].filter(Boolean).join('') : '');
}

// The Next card: what pressing Next does. Step 4 and Step 6 can take a lab other than the default.
function renderComing() {
  const { next } = scene();
  $('coming-title').textContent = next ? next.title : 'This is the last scene.';
  const coming = next && state.session.scenes[next.n];
  const id = coming?.id;
  // A task scene's one line, as the projector will show it.
  $('coming-line').textContent = coming?.kind === 'task' ? state.session.steps[coming.step].screen : '';
  const wallSet = state.session.stepLab[4] != null;
  const real = state.labs.filter((l) => !l.practice);
  const wanted = real.length > 1 && ((id === 'task-4' && !wallSet) || id === 'task-6');
  let note = next?.note ?? '';
  if (id === 'task-4' && wallSet) note = 'The Wall is already set up. Nothing is copied again.';
  $('pick').hidden = !wanted;
  if (wanted) {
    const select = $('pick-lab');
    // The server's default is the lab its note names.
    const fallback = real.find((l) => note.includes(l.name)) ?? real[0];
    $('pick-label').textContent = id === 'task-4' ? 'Whose outfit goes to the Wall:' : 'Boss lab:';
    patch(select, real.map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join(''));
    if (select.dataset.picked !== id) select.value = fallback.id;
    const picked = real.find((l) => l.id === select.value);
    if (picked) note = note.replaceAll(fallback.name, picked.name);
  }
  $('coming-note').textContent = note;
}

// One tile per lab: people, the outfit, goal checks, a status line (filled in by tick), Step 4's way, and Rescue.
function renderTiles() {
  const box = $('labs');
  const ids = state.labs.map((l) => l.id).join();
  if (box.dataset.ids !== ids) {
    box.innerHTML = state.labs.map(() => '<article class="tile"></article>').join('');
    box.dataset.ids = ids;
  }
  const s = scene();
  state.labs.forEach((lab, i) => {
    const el = box.children[i];
    const offline = lab.members.filter((m) => !m.online).length;
    const who = lab.practice ? ''
      : !lab.members.length ? 'Nobody yet'
        : `${lab.members.length} ${lab.members.length === 1 ? 'person' : 'people'}${offline ? ` · ${offline} offline` : ''}`;
    const rescue = s.tools.includes('rescue') && !lab.practice && !lab.done && (s.step !== 6 || state.session.bossLab === lab.id);
    const way = s.step === 4 && WAYS[lab.way] ? `<p class="way">Way: ${WAYS[lab.way]}</p>` : '';
    const counts = s.kind === 'wrap' && !lab.practice ? `<p class="counts">${COUNTS.map(([id, one, many]) => {
      const n = lab.concepts?.[id] ?? 0;
      return `${n} ${n === 1 ? one : many}`;
    }).join(' · ')}</p>` : '';
    const goals = working() && lab.goals.length ? `<ul class="goals">${lab.goals.map((g) =>
      `<li class="${g.done ? 'done' : ''}">${esc(g.text)}</li>`).join('')}</ul>` : '';
    const html = `<h3><span class="dot"></span>${esc(lab.name)}<span class="muted">${esc(who)}</span></h3>
      <div class="tile-body"><div class="fig"></div>${goals}</div>
      <p class="status"></p>${way}${counts}
      ${rescue ? `<button class="small" data-rescue="${esc(lab.id)}">Rescue</button>` : ''}`;
    el.style.setProperty('--lab', lab.color);
    el.classList.toggle('practice', lab.practice);
    if (patch(el, html, html + JSON.stringify(lab.monster))) renderMonsterCard(el.querySelector('.fig'), lab.monster, { size: 'small' });
  });
}

// The status line: the server's, plus what only time tells (a long conflict, no clicks).
function statusOf(lab, now) {
  if (lab.practice) return lab.status;
  if (!working() || !lab.goals.length) return null;
  if (lab.done) return lab.status;
  if (!lab.members.some((m) => m.online)) return { tone: 'ok', text: 'Nobody online' };
  const s = scene();
  const opened = Object.values(lab.merging ?? {}).map((m) => m.t).filter(Number.isFinite);
  const conflict = opened.length ? now - Math.min(...opened) : 0;
  if (conflict > STUCK_MS) return { tone: 'alert', text: `In a conflict for ${clock(conflict)}` };
  const acting = s.kind === 'task' && (HANDS_ON.includes(s.step) || (s.step === 6 && state.session.bossLab === lab.id));
  const quiet = now - Math.max(lab.lastClickAt ?? 0, lab.lastOp?.t ?? 0, state.session.timer.startedAt);
  if (acting && quiet > STUCK_MS) return { tone: 'alert', text: `No clicks for ${clock(quiet)}` };
  return lab.status;
}

// ---------- Details (drawn only while open) ----------

function renderDetails() {
  const { session, labs } = state;
  const select = $('lab-count');
  const real = labs.filter((l) => !l.practice);
  if (document.activeElement !== select) select.value = session.autoLabs ? 'auto' : String(real.length);
  select.disabled = session.step > 0;
  if (!$('details').open) return;

  patch($('rosters'), labs.map((lab) => `<div class="roster" style="--lab:${esc(lab.color)}">
    <h3><span class="dot"></span>${esc(lab.name)}</h3>
    ${lab.practice ? '<p class="muted small">The practice lab: no people. It plays its part on the Wall by itself.</p>'
      : `<ul>${lab.members.map((m) => `<li><span class="online${m.online ? ' on' : ''}"></span>${esc(m.name)}
        ${session.step >= 2 ? `<span class="muted">${esc(m.pair)}</span> <span class="note">${esc(m.branch)}</span>` : ''}
        <select data-move="${esc(m.pid)}" aria-label="Move ${esc(m.name)}"><option value="">Move to…</option>
        ${real.filter((o) => o !== lab).map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select></li>`).join('')
        || '<li class="muted">Nobody yet</li>'}</ul>`}</div>`).join(''));

  const wall = state.wall?.graph;
  $('wall-panel').hidden = !wall;
  if (wall) drawGraph($('wall-graph'), wall, { labels: true, width: $('wall-panel').clientWidth });

  const box = $('lab-graphs');
  const ids = labs.filter((l) => l.graph).map((l) => l.id).join();
  if (box.dataset.ids !== ids) {
    box.innerHTML = labs.filter((l) => l.graph).map((l) => `<div class="panel"><h3>${esc(l.name)}</h3><svg class="graph"></svg></div>`).join('');
    box.dataset.ids = ids;
  }
  labs.filter((l) => l.graph).forEach((lab, i) => {
    const svg = box.children[i].querySelector('svg');
    drawGraph(svg, lab.graph, { labels: true, compact: 'auto', width: box.children[i].clientWidth });
  });

  const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const labName = (id) => labs.find((l) => l.id === id)?.name ?? `Lab ${id}`;
  patch($('feed'), state.feed.map((f) => `<li class="${/refused|conflict|error/i.test(f.outcome ?? '') ? 'bad' : ''}">
    <time>${time(f.t)}</time><p>${f.labId ? `${esc(labName(f.labId))} · ` : ''}${esc(f.who)}: ${esc(f.action)}${f.outcome ? ` → ${esc(f.outcome)}` : ''}
    ${f.porcelain ? `<code>${esc(f.porcelain)}</code>` : ''}</p></li>`).join('') || '<li class="muted">Nothing yet.</li>');
}

// Draw a graph only when its data or size changed.
function drawGraph(svg, graph, opts) {
  const sig = JSON.stringify([graph, opts]);
  if (svg.dataset.sig === sig) return;
  svg.dataset.sig = sig;
  renderGraph(svg, graph, opts);
}

// ---------- Every second: timers and time-based status ----------

function tick() {
  if (!state) return;
  const now = Date.now();
  const { session } = state;
  const s = scene();
  const { startedAt, minutes } = session.timer;
  const elapsed = now - startedAt;
  let text = `${clock(elapsed)} / ${clock(minutes * 60e3)}`;
  if (session.planStartedAt) {
    // Minutes off the plan: a late start of this scene, plus any time past its planned length.
    const late = Math.round((startedAt - session.planStartedAt - s.at * 60e3 + Math.max(0, elapsed - minutes * 60e3)) / 60e3);
    text += late > 0 ? ` · ${late} min behind plan` : late < 0 ? ` · ${-late} min ahead` : ' · on plan';
  }
  $('timer').textContent = text;
  $('timer').classList.toggle('over', elapsed >= minutes * 60e3);

  state.labs.forEach((lab, i) => {
    const el = $('labs').children[i]?.querySelector('.status');
    if (!el) return;
    const status = statusOf(lab, now);
    el.hidden = !status;
    el.textContent = status?.text ?? '';
    el.dataset.tone = status?.tone ?? '';
  });
  tickSlide($('preview'), state);
}

live(render, (on) => $('conn').classList.toggle('off', !on));
setInterval(tick, 1000);
let settle = null; // redraw the Details graphs once the window size settles
addEventListener('resize', () => { clearTimeout(settle); settle = setTimeout(() => state && renderDetails(), 150); });
