// Projector (/screen): read-only and live. Same state and events as the teacher page.
import { renderMonsterCard } from '/monster.js';
import {
  live, esc, md, clock, isWrap, goalsHtml, chipsHtml, labStatus, auditCards, auditHtml, qrSrc, patch, drawGraph, onBreak, backAt,
} from '/admin.js';

const $ = (id) => document.getElementById(id);
let state = null;
let resting = false; // the break was on at the last render

// Step 8's per-lab counts: [heading, concept ids added up].
const SUMMARY = [
  ['Cards saved', ['save']], ['Merges', ['merge', 'fastforward']], ['Conflicts solved', ['conflict']],
  ['Pushes', ['push']], ['Refused pushes', ['rejected']], ['Reverts', ['revert']],
];

function render(next) {
  state = next;
  const { session } = state;
  const n = session.step;
  const s = session.steps[n];
  const wrap = isWrap(session);

  resting = onBreak(session);
  $('s-title').innerHTML = resting ? 'Break'
    : n === 0 || wrap ? esc(s.title) : `<span class="s-step">Step ${n} ·</span> ${esc(s.title)}`;
  const asking = Boolean(session.ask && s.check) && !resting;
  $('s-line').innerHTML = resting ? `Back at ${backAt(session)}.` : asking ? md(s.check) : wrap ? '' : md(s.instruction);
  $('s-line').classList.toggle('ask', asking);

  $('s-main').classList.toggle('joining', n === 0);
  $('s-join').hidden = n !== 0;
  if ($('s-qr').getAttribute('src') !== qrSrc(session.joinUrl)) $('s-qr').src = qrSrc(session.joinUrl);
  $('s-url').textContent = session.joinUrl;

  // The Wall from Step 4. A long history goes compact (newest cards only) so the emoji stay readable.
  const wall = n >= 4 && !wrap ? state.wall?.graph : null;
  $('s-wall').hidden = !wall;
  if (wall) drawGraph($('s-wall-graph'), wall, { labels: true, compact: wall.commits.length > 6 });

  // The tentacles audit runs at the end of Step 6 and again in Step 7.
  const audits = n >= 6 && !wrap ? auditCards(session) : [];
  $('s-audits').hidden = !audits.length;
  patch($('s-audits'), audits.map((c) => auditHtml(c, 's-audit')).join(''));
  $('s-stage').hidden = !wall && !audits.length;
  $('s-stage').classList.toggle('split', Boolean(wall && audits.length));

  $('s-wrap').hidden = !wrap;
  $('s-labs').hidden = wrap;
  if (wrap) patch($('s-wrap'), wrapHtml(s));
  tick();
}

// One tile per lab: monster, goal ticks, this step's Git ideas, and a red dot when the lab needs a teacher.
// Step 0 shows member names instead, so labs can balance themselves.
function renderTiles() {
  const { session, labs } = state;
  const n = session.step;
  const box = $('s-labs');
  const ids = labs.map((l) => l.id).join();
  if (box.dataset.ids !== ids) {
    box.innerHTML = labs.map((l) => `<article class="s-lab" style="--lab:${esc(l.color)}"></article>`).join('');
    box.dataset.ids = ids;
  }
  const now = Date.now();
  labs.forEach((lab, i) => {
    const el = box.children[i];
    const help = labStatus(lab, state, now)?.alert;
    const count = n === 0 ? `<span class="muted">${lab.members.length}</span>` : '';
    const html = `<h2><span class="dot"></span>${esc(lab.name)}${count}${help ? '<span class="help" title="Needs help"></span>' : ''}</h2>
      <div class="monster"></div>
      <div class="s-info">${n === 0
        ? `<p class="people">${lab.members.map((m) => esc(m.name)).join(', ') || 'Nobody yet'}</p>`
        : `${goalsHtml(lab.goals)}${chipsHtml(lab.concepts, n, n)}`}</div>`;
    if (patch(el, html, html + JSON.stringify(lab.monster))) {
      renderMonsterCard(el.querySelector('.monster'), lab.monster, { size: n >= 4 ? 'medium' : 'large' });
    }
  });
}

function wrapHtml(s) {
  const { session, labs } = state;
  const rows = labs.map((lab) => {
    const c = lab.concepts ?? {};
    return `<tr><td><span class="dot" style="--lab:${esc(lab.color)}"></span> ${esc(lab.name)}</td>
      ${SUMMARY.map(([, ids]) => `<td>${ids.reduce((sum, id) => sum + (c[id] || 0), 0)}</td>`).join('')}
      <td>${chipsHtml(c, session.step)}</td></tr>`;
  }).join('');
  return `<p class="s-wrap-line">${md(s.instruction)}</p>
    <table class="s-summary"><thead><tr><th>Lab</th>${SUMMARY.map(([label]) => `<th>${label}</th>`).join('')}<th>Git ideas used</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

// The countdown and the "needs help" dots depend on the time, not only on events.
function tick() {
  if (!state) return;
  const { session } = state;
  if (onBreak(session) !== resting) { render(state); return; }
  const counting = resting || (session.step > 0 && !isWrap(session));
  const left = resting ? session.breakUntil - Date.now() : session.timer.minutes * 60e3 - (Date.now() - session.timer.startedAt);
  $('s-clock').textContent = counting ? clock(left) : '';
  $('s-clock').classList.toggle('over', left <= 0);
  if (!$('s-labs').hidden) renderTiles();
}

live(render, () => {});
setInterval(tick, 1000);
