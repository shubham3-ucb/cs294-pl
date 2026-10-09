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
const head = (s) => `<h1 class="t-title">${md(s.title)}</h1>`;
const ask = (s) => (s.ask ? `<p class="t-ask">${md(s.ask)}</p>` : '');

function table(rows, cls = '') {
  const [first, ...rest] = rows;
  const header = first[0] === '' ? `<tr>${first.map((c) => `<th>${md(c)}</th>`).join('')}</tr>` : '';
  const body = (header ? rest : rows).map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('');
  const big = rows.length <= 3 ? 'big' : '';
  return `<table class="t-table ${header ? 'ranks' : ''} ${big} ${cls}">${header}${body}</table>`;
}

const count = (p) => (p ? `<p class="t-count">${p.done} <small>of ${p.of} ${p.unit === 'groups' ? 'groups done' : 'done'}</small></p>` : '');

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
    <section class="t-panel"><h2>Your self-rated Git level</h2>${pairBars(r.levels, r.level, r.n, p.level, p.n)}</section>
  </div>
  <p class="t-key"><span><i style="background:var(--purple)"></i>You: ${r.n} answered${r.medianYears !== null ? `, median ${r.medianYears} years of Git` : ''}</span>
    <span><i style="background:#B9B9C2"></i>The paper’s 92: median ${p.medianYears} years</span></p>`;
}

const LABEL_COLORS = ['var(--purple)', '#F59E0B', '#C9C9D1'];
function labelsResult(r) {
  const rows = r.posts.map((p) => {
    const n = p.counts.reduce((a, b) => a + b, 0);
    const split = n ? p.counts.map((c, i) => `<span style="width:${pct(c, n)}%;background:${LABEL_COLORS[i]}"></span>`).join('') : '';
    return `<li><span class="tt">${esc(p.title)} <small>· ${p.views.toLocaleString('en-US')} views</small></span><code>${esc(p.command)}</code>
      <span class="names ${p.askerNamesIt ? '' : 'no'}">${p.askerNamesIt ? 'The asker' : 'Only the answer'}</span>
      <span class="t-split">${split}</span><span class="t-split-num">${n ? `${pct(Math.max(...p.counts), n)}% agree` : '—'}</span></li>`;
  }).join('');
  const key = r.labels.map((l, i) => `<span><i style="background:${LABEL_COLORS[i]}"></i>${esc(l.label)}</span>`).join('');
  return `<ul class="t-posts"><li class="h"><span>Post</span><span>Counted for</span><span>Who names it</span><span>Your labels</span><span></span></li>${rows}</ul>
    <p class="t-key">${key}</p>`;
}

// The seven tasks: per task, the right command and how many picked it; then, by how sure people were, how often
// they were right.
function tasksResult(r) {
  const rows = r.rows.map((t) => `<li><span class="tt">${md(t.short)}</span>
    <span class="t-split"><span style="width:${pct(t.right, t.n)}%;background:var(--green)"></span></span>
    <span class="t-split-num">${t.n ? `${t.right} of ${t.n}` : '—'}</span><span class="key">${md(t.answer)}</span></li>`).join('');
  const sure = r.sure.map((x, i) => `<span><b>${esc(x)}:</b> ${r.sureN[i] ? `${pct(r.sureRight[i], r.sureN[i])}% right` : '—'}</span>`).join('');
  return `<ul class="t-posts tasks"><li class="h"><span>Task</span><span>Picked the right command</span><span></span><span>The right command</span></li>${rows}</ul>
    <p class="t-key">${sure}</p>`;
}

// A sort: for each item, how the class split across the categories, and the key.
const SORT_COLORS = ['var(--purple)', '#F59E0B', '#0EA5E9', '#C9C9D1'];
function sortResult(r) {
  const rows = r.rows.map((x) => {
    const n = x.counts.reduce((a, b) => a + b, 0);
    const split = n ? x.counts.map((c, i) => `<span style="width:${pct(c, n)}%;background:${SORT_COLORS[i]}"></span>`).join('') : '';
    return `<li><span class="tt">${md(x.text)}</span><span class="t-split">${split}</span>
      <span class="key">${esc(r.categories[x.key])}</span><span class="t-split-num">${n ? `${x.counts[x.key]} of ${n}` : '—'}</span></li>`;
  }).join('');
  const key = r.categories.map((c, i) => `<span><i style="background:${SORT_COLORS[i]}"></i>${esc(c)}</span>`).join('');
  return `<ul class="t-posts sorts"><li class="h"><span></span><span>Your answers</span><span>The answer</span><span>Right</span></li>${rows}</ul>
    <p class="t-key">${key}</p>`;
}

// What people or groups wrote: the starred ones if the teacher starred any, else everything (no names).
function entryCards(r, { live = false } = {}) {
  const list = r.starred.length ? r.starred : r.all;
  if (!list.length) return `<p class="t-empty">${live ? 'Answers appear here as they come in.' : 'No answers yet.'}</p>`;
  const one = r.fields.length === 1;
  const shown = list.slice(0, 9);
  const cols = shown.length > 4 ? 3 : Math.min(2, shown.length);
  return `<div class="t-entries ${one ? 'one' : ''} ${r.starred.length ? 'starred' : ''}" style="--cols:${cols}">${shown.map((e) => `<article class="t-entry">
    ${e.group ? `<h2>${esc(e.group)}</h2>` : ''}
    ${one ? `<p class="ans">${md(e.answers?.[r.fields[0].id] ?? '')}</p>`
      : r.fields.map((f) => `<div><span class="lab">${esc(f.short)}</span><p class="ans">${e.answers?.[f.id] ? md(e.answers[f.id]) : '<span class="empty">—</span>'}</p></div>`).join('')}
    </article>`).join('')}</div>${list.length > shown.length ? `<p class="t-foot">and ${list.length - shown.length} more</p>` : ''}`;
}

// The verdicts: per team, its claim, its verdict and the model answer.
function verdicts(r, claims) {
  const teams = r.teams.filter((t) => t.claim);
  const cards = teams.length ? teams : (claims ?? []).map((claim) => ({ claim, group: null, answers: null }));
  const cols = cards.length > 3 ? 3 : Math.max(1, cards.length);
  return `<div class="t-groups verdicts" style="--cols:${cols}">${cards.map(({ claim, group, answers }) => `<article class="t-group">
    <p class="quote">“${esc(claim.quote)}”</p>
    ${group ? `<p><span class="lab">${esc(group)}’s answer</span>${answers?.verdict ? md(answers.verdict) : '<span class="empty">—</span>'}</p>` : ''}
    <div class="model"><span class="lab">What the data supports</span>${esc(claim.supports)}</div></article>`).join('')}</div>`;
}

// ---------- The slide ----------

export function slideHtml(s, r, ctx = {}) {
  const k = `ts k-${s.kind}`;
  if (s.kind === 'join') {
    const url = ctx.joinUrl;
    return `<div class="${k}"><h1 class="t-title">${md(s.title)}</h1>
      <div class="t-join"><div class="t-lines">
        <p class="t-cite">${esc(ctx.paper?.title ?? '')}<br>${esc(ctx.paper ? `${ctx.paper.authors} · ${ctx.paper.venue}` : '')}</p>
        ${lines(s.lines)}${url ? `<p class="t-url">${esc(shortUrl(url))}</p>` : ''}
        ${ctx.joined !== undefined ? `<p class="t-count">${ctx.joined} <small>joined</small></p>` : ''}</div>
        ${url ? `<img alt="QR code for the join link" src="${qrSrc(url)}">` : ''}</div></div>`;
  }
  if (s.kind === 'end') {
    const wall = r?.lines?.length
      ? `<p class="t-wall-sub">What you wrote. When you build a tool for people, …</p><ul class="t-wall">${r.lines.slice(-12).map((l) => `<li>${md(l)}</li>`).join('')}</ul>` : '';
    return `<div class="${k}"><h1 class="t-title">${md(s.title)}</h1>${lines(s.lines)}${wall}</div>`;
  }
  if (s.kind === 'slide') {
    return `<div class="${k}">${head(s)}${lines(s.lines)}${s.table ? table(s.table) : ''}
      ${s.foot ? `<p class="t-foot">${md(s.foot)}</p>` : ''}${ask(s)}</div>`;
  }
  if (s.kind === 'write') {
    const who = s.whoLine ?? '';
    return `<div class="${k}">${head(s)}${who ? `<p class="t-who">${esc(who)}</p>` : ''}${lines(s.lines)}${count(ctx.progress)}</div>`;
  }
  if (['tasks', 'survey', 'label', 'sort', 'exit'].includes(s.kind)) {
    return `<div class="${k}">${head(s)}${lines(s.lines)}${count(ctx.progress)}</div>`;
  }
  if (s.kind === 'discuss') {
    return `<div class="${k}">${head(s)}${r ? entryCards(r) : ''}${ask(s)}</div>`;
  }
  if (s.kind === 'reveal') {
    let body = '';
    if (r?.type === 'survey') body = surveyResult(r);
    else if (r?.type === 'tasks') body = tasksResult(r);
    else if (r?.type === 'labels') body = labelsResult(r);
    else if (r?.type === 'sort') body = sortResult(r);
    else if (r?.type === 'claims') body = verdicts(r, ctx.claims);
    return `<div class="${k}">${head(s)}${lines(s.lines)}${body}${ask(s)}</div>`;
  }
  return `<div class="${k}">${head(s)}${lines(s.lines)}</div>`;
}
