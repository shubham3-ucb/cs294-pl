// Student page (/thu): join, then whatever the current scene asks. Polls the server every 2 s.
import { api, poll, slideHtml, esc, md } from '/thu-common.js';

const app = document.getElementById('app');
const PID = 'thu-pid';
let pid = localStorage.getItem(PID) || '';
let st = null, drawn = '', passive = '';

const refresh = poll(() => `/api/thu/state?pid=${encodeURIComponent(pid)}`, (s) => {
  st = s;
  if (!s.joined) { if (drawn !== 'join') drawJoin(); return; }
  const g = s.group ? `${s.group.name}` : '';
  const sig = `${s.boot}:${s.scene.id}:${g}`;
  if (sig !== drawn) { drawn = sig; draw(); } else update();
}, () => {}, 2000);

const top = () => `<header class="s-top"><h1>The Humans</h1><span class="muted">Thursday · Git, Part 2</span>
  <span class="who">${esc(st.me.name)}${st.group ? ` · ${esc(st.group.name)}` : ''}</span></header>`;
const intro = (s) => `<div><p class="s-part">${esc(s.part)}</p><h2 class="s-title">${md(s.title)}</h2></div>
  ${s.lines?.length ? `<div class="s-lines">${s.lines.map((l) => `<p>${md(l)}</p>`).join('')}</div>` : ''}`;
const msg = (el, text, kind = '') => { if (el) { el.textContent = text; el.className = `s-msg ${kind}`; } };

function drawJoin() {
  drawn = 'join';
  app.innerHTML = `<form class="s-join" id="join">
    <p class="s-part">Thursday · Git, Part 2</p><h1>The Humans</h1>
    <label for="name">Your first name</label><input id="name" maxlength="24" autocomplete="given-name" required>
    <button class="primary" type="submit">Join</button><p class="s-msg" id="m"></p></form>`;
  document.getElementById('join').onsubmit = async (e) => {
    e.preventDefault();
    const r = await api('/api/thu/join', { name: document.getElementById('name').value });
    if (!r.ok) return msg(document.getElementById('m'), r.error, 'err');
    pid = r.pid;
    localStorage.setItem(PID, pid);
    drawn = '';
    refresh();
  };
}

async function send(body) {
  return api('/api/thu/answer', { pid, scene: st.scene.id, ...body });
}

function draw() {
  const s = st.scene;
  const views = { survey: drawSurvey, vote: drawVote, label: drawLabels, group: drawGroup, exit: drawExit };
  (views[s.kind] ?? drawPassive)(s);
}

function update() {
  const s = st.scene;
  if (s.kind === 'group') updateGroup();
  else if (!['survey', 'vote', 'label', 'exit'].includes(s.kind)) drawPassive(s);
}

// Slides, reveals, the break: the projector's slide, on the laptop too.
function drawPassive(s) {
  if (s.kind === 'join') {
    if (passive === 'join' && app.querySelector('.s-in')) return;
    passive = 'join';
    app.innerHTML = `${top()}<div class="s-in"><h2 class="s-title">You’re in, ${esc(st.me.name)}.</h2>
      <p class="s-lines">The class starts soon. Keep this page open: it follows the projector.</p>
      <p class="muted">${esc(st.paper.title)} · ${esc(st.paper.authors)} · ${esc(st.paper.venue)}</p></div>`;
    return;
  }
  const html = slideHtml(s, st.results, { paper: st.paper, claims: st.claims });
  if (html === passive && app.querySelector('.s-slide')) return;
  passive = html;
  app.innerHTML = `${top()}<div class="slide s-slide">${html}</div>`;
}

// ---------- The paper's survey ----------
function drawSurvey(s) {
  const a = st.me.survey ?? {};
  const qs = st.scene.survey;
  app.innerHTML = `${top()}${intro(s)}<form id="f">${qs.map((q) => question(q, a)).join('')}
    <button class="primary" type="submit">${st.me.survey ? 'Update my answers' : 'Send'}</button>
    <p class="s-msg" id="m">${st.me.survey ? 'Saved. You can change it until the class moves on.' : ''}</p></form>`;
  const f = document.getElementById('f');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const out = {};
    for (const q of qs) {
      if (q.type === 'many') out[q.id] = fd.getAll(q.id).map(Number);
      else if (q.type === 'one') out[q.id] = fd.get(q.id) === null ? null : Number(fd.get(q.id));
      else out[q.id] = fd.get(q.id) ?? '';
    }
    out.why = fd.get('why') ?? '';
    for (const q of qs) out[`${q.id}Other`] = fd.get(`${q.id}Other`) ?? '';
    const r = await send({ value: JSON.stringify(out) });
    msg(document.getElementById('m'), r.ok ? 'Saved. You can change it until the class moves on.' : r.error, r.ok ? 'ok' : 'err');
    if (r.ok) f.querySelector('button[type=submit]').textContent = 'Update my answers';
  };
}

function question(q, a) {
  const n = SURVEY_NUMBER[q.id];
  const label = `<p>${n}. ${esc(q.q)}${q.optional ? ' <small>(optional)</small>' : ''}</p>`;
  if (q.type === 'one' || q.type === 'many') {
    const type = q.type === 'one' ? 'radio' : 'checkbox';
    const on = (i) => (q.type === 'one' ? a[q.id] === i : (a[q.id] ?? []).includes(i));
    const opts = q.options.map((o, i) => `<label><input type="${type}" name="${q.id}" value="${i}" ${on(i) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('');
    const other = q.options.includes('Other (please specify)')
      ? `<input name="${q.id}Other" maxlength="300" placeholder="Other (please specify)" value="${esc(a[`${q.id}Other`] ?? '')}">` : '';
    const extra = (q.why ? `<input name="why" maxlength="300" placeholder="${esc(q.why)}" value="${esc(a.why ?? '')}">` : '') + other;
    return `<div class="s-q">${label}<div class="s-choice">${opts}</div>${extra}</div>`;
  }
  if (q.type === 'number') return `<div class="s-q">${label}<input name="${q.id}" type="number" min="${q.min}" max="${q.max}" step="0.5" inputmode="decimal" value="${esc(a[q.id] ?? '')}" style="max-width:140px"></div>`;
  return `<div class="s-q">${label}<textarea name="${q.id}" maxlength="300">${esc(a[q.id] ?? '')}</textarea></div>`;
}
// The form's own numbering (Q1, the donation choice, is not asked).
const SURVEY_NUMBER = { area: 2, degree: 3, years: 4, level: 5, learn: 6, tip: 7 };

// ---------- A vote ----------
function drawVote(s) {
  app.innerHTML = `${top()}${intro(s)}<div class="s-vote">${s.options.map((o, i) =>
    `<button data-i="${i}" class="${st.me.vote === i ? 'on' : ''}">${esc(o)}</button>`).join('')}</div><p class="s-msg" id="m"></p>`;
  app.querySelectorAll('.s-vote button').forEach((b) => {
    b.onclick = async () => {
      const r = await send({ value: Number(b.dataset.i) });
      if (!r.ok) return msg(document.getElementById('m'), r.error, 'err');
      app.querySelectorAll('.s-vote button').forEach((x) => x.classList.toggle('on', x === b));
      msg(document.getElementById('m'), 'Voted. You can change it.', 'ok');
    };
  });
}

// ---------- Label the posts ----------
const mark = (text, cmd) => esc(text).replace(new RegExp(`(${cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
const blocks = (bs, cmd) => bs.map((b) => (b.code ? `<pre>${mark(b.text, cmd)}</pre>` : `<p>${mark(b.text, cmd)}</p>`)).join('');

function drawLabels(s) {
  const posts = s.posts ?? [];
  const mine = st.me.labels;
  const done = () => posts.filter((p) => mine[p.id]).length;
  app.innerHTML = `${top()}${intro(s)}<p class="s-progress" id="prog"></p>${posts.map((p, i) => `
    <article class="s-post ${mine[p.id] ? 'done' : ''}" data-id="${esc(p.id)}">
      <p class="s-credit">The paper counts this post for <code>${esc(p.command)}</code></p>
      <h2>${i + 1}. ${esc(p.title)}</h2>
      <p class="s-meta"><span>${p.views.toLocaleString('en-US')} views</span><span>${esc(p.year)}</span>
        <a href="${esc(p.url)}" target="_blank" rel="noopener">Stack Overflow · ${esc(p.license)}</a></p>
      <p class="s-sub">The question</p><div class="s-body">${blocks(p.question, p.command)}</div>
      <p class="s-sub">From the accepted answer</p><div class="s-body s-answer">${blocks(p.answer, p.command)}</div>
      <p><strong>Is this question about <code>${esc(p.command)}</code>?</strong></p>
      <div class="s-yesno"><button data-v="yes" class="${mine[p.id] === 'yes' ? 'on' : ''}">Yes</button>
        <button data-v="no" class="${mine[p.id] === 'no' ? 'on' : ''}">No</button></div>
    </article>`).join('')}`;
  const prog = () => { document.getElementById('prog').textContent = `${done()} of ${posts.length} labeled${done() === posts.length ? ' · done, thank you' : ''}`; };
  prog();
  app.querySelectorAll('.s-post').forEach((el) => {
    el.querySelectorAll('button').forEach((b) => {
      b.onclick = async () => {
        const r = await send({ post: el.dataset.id, value: b.dataset.v });
        if (!r.ok) return;
        mine[el.dataset.id] = b.dataset.v;
        el.classList.add('done');
        el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        prog();
      };
    });
  });
}

// ---------- Group work: one shared answer per group ----------
const timers = {};
function drawGroup(s) {
  const g = st.group;
  if (!g) { app.innerHTML = `${top()}${intro(s)}<p class="s-wait">Your group is being formed…</p>`; return; }
  const fields = s.fields === 'claim' ? s.claimFields : s.designFields;
  const claim = s.fields === 'claim' && g.claim ? `<div class="s-claim"><p class="s-sub">Your claim · ${esc(g.claim.where)}</p>
    <p class="quote">“${esc(g.claim.quote)}”</p><p class="muted">Look at: ${esc(g.claim.look)}</p></div>` : '';
  app.innerHTML = `${top()}${intro(s)}<p class="muted">${esc(g.name)}: ${esc(g.members.join(', '))}. One answer per group: anyone can type.</p>
    ${claim}${(fields ?? []).map((f) => `<div class="s-field"><label for="f-${f.id}">${esc(f.label)}</label>
      <textarea id="f-${f.id}" data-f="${f.id}" maxlength="300" placeholder="${esc(f.placeholder)}">${esc(g.answers?.[f.id] ?? '')}</textarea>
      <span class="by" id="by-${f.id}"></span></div>`).join('')}`;
  app.querySelectorAll('textarea[data-f]').forEach((t) => {
    const save = async () => {
      clearTimeout(timers[t.dataset.f]);
      const r = await send({ field: t.dataset.f, text: t.value });
      document.getElementById(`by-${t.dataset.f}`).textContent = r.ok ? 'Saved' : r.error;
    };
    t.oninput = () => { clearTimeout(timers[t.dataset.f]); timers[t.dataset.f] = setTimeout(save, 700); };
    t.onblur = save;
  });
  updateGroup();
}

function updateGroup() {
  const a = st.group?.answers;
  if (!a) return;
  app.querySelectorAll('textarea[data-f]').forEach((t) => {
    if (document.activeElement !== t && a[t.dataset.f] !== undefined && t.value !== a[t.dataset.f]) t.value = a[t.dataset.f];
    const by = document.getElementById(`by-${t.dataset.f}`);
    if (by && document.activeElement !== t && a.by) by.textContent = `Last saved by ${a.by}`;
  });
}

// ---------- Exit line ----------
function drawExit(s) {
  app.innerHTML = `${top()}${intro(s)}<textarea id="t" maxlength="300" placeholder="When you build a tool for people, …">${esc(st.me.exit)}</textarea>
    <button class="primary" id="b">${st.me.exit ? 'Update' : 'Send'}</button><p class="s-msg" id="m"></p>`;
  document.getElementById('b').onclick = async () => {
    const r = await send({ text: document.getElementById('t').value });
    msg(document.getElementById('m'), r.ok ? 'Sent. Thank you.' : r.error, r.ok ? 'ok' : 'err');
  };
}
