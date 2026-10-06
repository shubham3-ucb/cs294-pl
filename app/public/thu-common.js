// Thursday: what the projector, the console preview and the students' screens share.
// slideHtml(scene, results, ctx) draws one slide from the scene text (server/thursday_scenes.js) and the class's results.

export const key = (() => {
  const url = new URL(location.href);
  const k = url.searchParams.get('key') || sessionStorage.getItem('thu-key') || '';
  if (url.searchParams.has('key')) {
    sessionStorage.setItem('thu-key', k);
    url.searchParams.delete('key');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return k;
})();

export async function api(path, body) {
  try {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(key && { 'x-admin-key': key }), ...(body && { 'content-type': 'application/json' }) },
      body: body && JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'No answer from the server. Try again.' };
  }
}

// Poll every `ms`; one request in flight. onState(state) on every answer, onConnection(bool) always.
export function poll(path, onState, onConnection = () => {}, ms = 1500) {
  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    const s = await api(typeof path === 'function' ? path() : path);
    busy = false;
    onConnection(Boolean(s.ok));
    if (s.ok) onState(s);
  }
  tick();
  setInterval(tick, ms);
  return tick;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
export const qrSrc = (url) => `/api/qr.svg?text=${encodeURIComponent(url)}`;
export const shortUrl = (url) => String(url).replace(/^https?:\/\//, '').replace(/\/$/, '');
const pct = (n, of) => (of ? Math.round((100 * n) / of) : 0);

// → / Space / PageDown = Next, ← / PageUp = Back (what clickers send). Typing is left alone.
const KEYS = { ArrowRight: 'next', ' ': 'next', PageDown: 'next', ArrowLeft: 'back', PageUp: 'back' };
export function presenterKeys(go) {
  addEventListener('keydown', (e) => {
    const dir = KEYS[e.key];
    if (!dir || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    if (e.target.closest?.('input, textarea, select')) return;
    e.preventDefault(); // Space must not also press the focused button
    go(dir);
  });
}

let moving = false;
export async function move(dir, from) {
  if (moving) return { ok: true };
  moving = true;
  const res = await api(`/api/thu/admin/${dir}`, { from });
  setTimeout(() => { moving = false; }, 400);
  return res;
}

export const PROJECTOR_WINDOW = 'thursday-projector';
const LEARN_SHORT = ['In class', 'Online courses', 'Peers or seniors', 'Documentation', 'Internet', 'Other'];

// ---------- Pieces ----------

const lines = (ls = []) => (ls.length ? `<div class="t-lines">${ls.map((l) => `<p>${md(l)}</p>`).join('')}</div>` : '');
const head = (s) => `<p class="t-part">${esc(s.part)}</p><h1 class="t-title">${md(s.title)}</h1>`;
const ask = (s) => (s.ask ? `<p class="t-ask">${md(s.ask)}</p>` : '');

function table(rows, cls = '') {
  const [first, ...rest] = rows;
  const header = first[0] === '' ? `<tr>${first.map((c) => `<th>${md(c)}</th>`).join('')}</tr>` : '';
  const body = (header ? rest : rows).map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('');
  const big = rows.length <= 3 ? 'big' : '';
  return `<table class="t-table ${header ? 'ranks' : ''} ${big} ${cls}">${header}${body}</table>`;
}

const count = (p) => (p ? `<p class="t-count">${p.done} <small>of ${p.of} ${p.unit === 'groups' ? 'groups done' : 'done'}</small></p>` : '');

function voteBars(r, correct) {
  return `<ul class="t-bars">${r.options.map((o, i) => `<li class="${i === correct ? 'right' : ''}">
    <span>${md(o)}</span><span class="bar"><i style="width:${pct(r.counts[i], r.n)}%"></i></span><b>${r.counts[i]}</b></li>`).join('')}</ul>`;
}

// Class vs paper, as shares of people.
function pairBars(labels, mine, n, theirs, N) {
  return `<ul class="t-pair">${labels.map((l, i) => `<li><span>${esc(l)}</span>
    <span class="bars"><span class="bar you"><i style="width:${pct(mine[i], n)}%"></i></span><span class="bar them"><i style="width:${pct(theirs[i], N)}%"></i></span></span>
    <span class="nums"><span class="y">${n ? `${pct(mine[i], n)}%` : '—'}</span><span>${pct(theirs[i], N)}%</span></span></li>`).join('')}</ul>`;
}

function surveyResult(r) {
  const p = r.paper;
  return `<div class="t-two">
    <section class="t-panel"><h2>How you learned Git</h2>${pairBars(LEARN_SHORT, r.learn, r.n, p.learn, p.n)}</section>
    <section class="t-panel"><h2>Your Git level, self-rated</h2>${pairBars(r.levels, r.level, r.n, p.level, p.n)}</section>
  </div>
  <p class="t-key"><span><i style="background:var(--purple)"></i>You: ${r.n} answered${r.medianYears !== null ? `, median ${r.medianYears} years of Git` : ''}</span>
    <span><i style="background:#B9B9C2"></i>The paper: 92, median ${p.medianYears} years</span></p>`;
}

const LABEL_COLORS = ['var(--purple)', '#F59E0B', '#C9C9D1'];
function labelsResult(r) {
  const rows = r.posts.map((p) => {
    const n = p.counts.reduce((a, b) => a + b, 0);
    const split = n ? p.counts.map((c, i) => `<span style="width:${pct(c, n)}%;background:${LABEL_COLORS[i]}"></span>`).join('') : '';
    return `<li><span class="tt">${esc(p.title)} <small>· ${p.views.toLocaleString('en-US')} views</small></span><code>${esc(p.command)}</code>
      <span class="names ${p.askerNamesIt ? '' : 'no'}">${p.askerNamesIt ? 'Yes' : 'Answer only'}</span>
      <span class="t-split">${split}</span><span class="t-split-num">${n ? `${pct(Math.max(...p.counts), n)}% agree` : '—'}</span></li>`;
  }).join('');
  const key = r.labels.map((l, i) => `<span><i style="background:${LABEL_COLORS[i]}"></i>${esc(l.label)}</span>`).join('');
  return `<ul class="t-posts"><li class="h"><span>Post</span><span>Counted for</span><span>Asker names it</span><span>You</span><span></span></li>${rows}</ul>
    <p class="t-key">${key}</p>`;
}

// Coding Table 8: for each comment, the paper's category, and how many of you chose it; how much you agreed.
function codesResult(r) {
  const rows = r.items.map((i) => `<li><span class="tt">#${esc(i.id)} “${esc(i.text)}”</span><span class="cat">${esc(r.categories[i.category])}</span>
    <span class="t-split"><span style="width:${i.withPaper === null ? 0 : Math.round(100 * i.withPaper)}%;background:var(--purple)"></span></span>
    <span class="t-split-num">${i.withPaper === null ? '—' : `${Math.round(100 * i.withPaper)}% · ${Math.round(100 * i.agreement)}%`}</span></li>`).join('');
  const sum = r.withPaper === null ? '' : `<p class="t-key"><span>You agreed with the paper on ${Math.round(100 * r.withPaper)}% of labels, and with each other on ${Math.round(100 * r.agreement)}%.</span></p>`;
  return `<ul class="t-posts codes"><li class="h"><span>Comment</span><span>The paper’s category</span><span>Agree</span><span>Paper · peers</span></li>${rows}</ul>${sum}`;
}

// While groups work: who is in which group (and their claim). At the design reveal: each group's answers.
function groupCards(r, { reveal }) {
  const n = r.groups.length;
  const cols = n > 4 ? 3 : n === 3 ? 3 : 2;
  return `<div class="t-groups ${reveal ? 'designs' : ''} ${n > 4 ? 'many' : ''}" style="--cols:${cols}">${r.groups.map((g) => {
    const filled = r.fields.every((f) => g.answers?.[f.id]);
    const theirs = r.fields.map((f) => `<p><span class="lab">${esc(f.label)}</span>${g.answers?.[f.id] ? md(g.answers[f.id]) : '<span class="empty">—</span>'}</p>`).join('');
    const body = reveal ? theirs : `<p class="muted">${esc(g.members.join(', '))}</p>`;
    return `<article class="t-group ${filled ? 'done' : ''}"><h2>${esc(g.name)}${reveal ? ` <small>${esc(g.members.join(', '))}</small>` : ''}</h2>
      ${g.claim ? `<p class="quote">“${esc(g.claim.quote)}”</p>` : ''}${body}</article>`;
  }).join('')}</div>`;
}

// The verdicts: one card per claim in play, in one row: each group's sentence, then the model answer.
// With no groups (a rehearsal, or nobody joined): every claim with what was measured and the model answer.
function verdicts(r, claims) {
  const inPlay = new Map();
  for (const g of r.groups) if (g.claim) (inPlay.get(g.claim.id) ?? inPlay.set(g.claim.id, { claim: g.claim, groups: [] }).get(g.claim.id)).groups.push(g);
  const cards = inPlay.size ? [...inPlay.values()] : (claims ?? []).map((claim) => ({ claim, groups: [] }));
  return `<div class="t-groups verdicts" style="--cols:${Math.max(2, cards.length)}">${cards.map(({ claim, groups }) => `<article class="t-group">
    <p class="quote">“${esc(claim.quote)}”</p>
    ${groups.length ? groups.map((g) => `<p><span class="lab">${esc(g.name)}</span>${g.answers?.supports ? md(g.answers.supports) : '<span class="empty">—</span>'}</p>`).join('')
      : `<p><span class="lab">They measured</span>${esc(claim.measured)}</p>`}
    <div class="model"><span class="lab">The data supports</span>${esc(claim.supports)}</div></article>`).join('')}</div>`;
}

// ---------- The slide ----------

export function slideHtml(s, r, ctx = {}) {
  const k = `ts k-${s.kind}`;
  if (s.kind === 'join') {
    const url = ctx.joinUrl;
    return `<div class="${k}"><p class="t-part">Thursday · Git, Part 2</p><h1 class="t-title">${md(s.title)}</h1>
      <div class="t-join"><div class="t-lines">
        <p class="t-cite">${esc(ctx.paper?.title ?? '')}<br>${esc(ctx.paper ? `${ctx.paper.authors} · ${ctx.paper.venue}` : '')}</p>
        ${lines(s.lines)}${url ? `<p class="t-url">${esc(shortUrl(url))}</p>` : ''}
        ${ctx.joined !== undefined ? `<p class="t-count">${ctx.joined} <small>joined</small></p>` : ''}</div>
        ${url ? `<img alt="QR code for the join link" src="${qrSrc(url)}">` : ''}</div></div>`;
  }
  if (s.kind === 'break' || s.kind === 'end') {
    const wall = s.kind === 'end' && r?.lines?.length
      ? `<ul class="t-wall">${r.lines.slice(-12).map((l) => `<li>${md(l)}</li>`).join('')}</ul>` : '';
    return `<div class="${k}"><p class="t-part">${esc(s.part)}</p><h1 class="t-title">${md(s.title)}</h1>${lines(s.lines)}${wall}</div>`;
  }
  if (s.kind === 'slide' && s.columns) {
    return `<div class="${k}">${head(s)}<div class="t-cols">${s.columns.map((c, i) => `<section class="t-col ${i ? 'no' : 'yes'}">
      <h2>${esc(c.title)}</h2><ul>${c.items.map((x) => `<li>${md(x)}</li>`).join('')}</ul></section>`).join('')}</div></div>`;
  }
  if (s.kind === 'slide') {
    return `<div class="${k}">${head(s)}${lines(s.lines)}${s.table ? table(s.table) : ''}
      ${s.foot ? `<p class="t-foot">${md(s.foot)}</p>` : ''}${ask(s)}</div>`;
  }
  if (s.kind === 'vote') {
    return `<div class="${k}">${head(s)}${lines(s.lines)}<ul class="t-options">${s.options.map((o) => `<li>${md(o)}</li>`).join('')}</ul>${count(ctx.progress)}</div>`;
  }
  if (s.kind === 'survey' || s.kind === 'label' || s.kind === 'code' || s.kind === 'exit') {
    return `<div class="${k}">${head(s)}${lines(s.lines)}${count(ctx.progress)}</div>`;
  }
  if (s.kind === 'group') {
    return `<div class="${k}">${head(s)}${lines(s.lines)}${r ? groupCards(r, { reveal: false }) : ''}${count(ctx.progress)}</div>`;
  }
  if (s.kind === 'reveal') {
    let body = '';
    if (r?.type === 'vote') body = voteBars(r, s.correct);
    else if (r?.type === 'survey') body = surveyResult(r);
    else if (r?.type === 'labels') body = labelsResult(r);
    else if (r?.type === 'codes') body = codesResult(r);
    else if (r?.type === 'claims') body = verdicts(r, ctx.claims);
    else if (r?.type === 'design') body = r.groups.length ? groupCards(r, { reveal: true }) : '';
    const before = r?.type === 'vote' ? '' : lines(s.lines);
    const after = r?.type === 'vote' ? lines(s.lines) : '';
    return `<div class="${k}">${head(s)}${before}${body}${after}${ask(s)}</div>`;
  }
  return `<div class="${k}">${head(s)}${lines(s.lines)}</div>`;
}
