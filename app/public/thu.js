// Student page (/thu): join, then whatever the current scene asks. Polls the server every 2 s.
// An activity a student has not finished (survey, a sort, the posts) stays on screen until the class has moved past
// its reveal. A box for questions to the class sits at the bottom of every screen.
import { api, poll, slideHtml, esc, md, key } from '/thu-common.js';
import { ed, busy, editFromUrl } from '/editable.js';

// /thu?key=…&edit: edit the wording in place (teacher key). The same text then shows on the console and projector.
editFromUrl(key);

const app = document.getElementById('app');
const banner = Object.assign(document.createElement('p'), { className: 's-offline', hidden: true, textContent: 'Reconnecting…' });
document.body.prepend(banner);
const PID = 'thu-pid';
let pid = localStorage.getItem(PID) || '';
let st = null, drawn = '', passive = '';

// The scene this student works on: an unfinished earlier activity, else the class's scene.
const active = () => st.pending ?? st.scene;

// After an edit, redraw this page at once with the new wording.
addEventListener('text-edited', () => { drawn = ''; passive = ''; refresh(); });

const refresh = poll(() => `/api/thu/state?pid=${encodeURIComponent(pid)}`, (s) => {
  if (busy()) return; // someone is editing a text: redraw after
  st = s;
  if (!s.joined) { if (drawn !== 'join') drawJoin(); return; }
  const sig = `${s.boot}:${active().id}:${s.pending ? 'late' : ''}:${s.group?.name ?? ''}:${(s.group?.members ?? []).join(',')}`;
  if (sig !== drawn) { drawn = sig; draw(); } else update();
}, (up) => { banner.hidden = up; }, 2000);

const top = () => `<header class="s-top"><h1>Reading a user study</h1><span class="muted">Thursday · Git, part 2</span>
  <span class="who">${esc(st.me.name)}${st.group ? ` · ${esc(st.group.name)}` : ''}</span></header>`;
const late = () => (st.pending ? '<p class="s-late">The class has moved on. Finish this, then look up.</p>' : '');
const at = (s, ...keys) => ['thu/SCENES', s.id, ...keys].join('/');
const intro = (s) => `${late()}<div><h2 class="s-title"${ed(at(s, 'title'), s.title)}>${md(s.title)}</h2></div>
  ${s.about ? `<p class="s-about"${ed(at(s, 'about'), s.about)}>${md(s.about)}</p>` : s.lines?.length ? `<div class="s-lines">${s.lines.map((l, i) => `<p${ed(at(s, 'lines', i), l)}>${md(l)}</p>`).join('')}</div>` : ''}`;
const msg = (el, text, kind = '') => { if (el) { el.textContent = text; el.className = `s-msg ${kind}`; } };

function drawJoin() {
  drawn = 'join';
  app.innerHTML = `<form class="s-join" id="join">
    <h1>Reading a user study</h1><p class="muted">Thursday · Git, part 2</p>
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
  return api('/api/thu/answer', { pid, scene: active().id, ...body });
}

function draw() {
  const s = active();
  const views = { survey: drawSurvey, tasks: drawTasks, label: drawLabels, sort: drawSort, write: drawWrite, exit: drawExit };
  (views[s.kind] ?? drawPassive)(s);
  questionBox();
}

function update() {
  const s = active();
  if (s.kind === 'write') updateWrite();
  else if (!['survey', 'tasks', 'label', 'sort', 'exit'].includes(s.kind)) { drawPassive(s); questionBox(); }
}

// ---------- A question for the class, any time ----------
function questionBox() {
  if (document.getElementById('qbox')) { drawMine(); return; }
  const box = document.createElement('form');
  box.id = 'qbox';
  box.className = 's-qbox';
  box.innerHTML = `<label for="q">A question for the class? The teacher picks some to discuss.</label>
    <div class="s-qrow"><input id="q" maxlength="200" placeholder="Your question"><button class="primary" type="submit">Send</button></div>
    <p class="s-msg" id="qm"></p><ul class="s-mine" id="qmine"></ul>`;
  app.append(box);
  box.onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('q');
    const r = await api('/api/thu/ask', { pid, text: input.value });
    msg(document.getElementById('qm'), r.ok ? 'Sent.' : r.error, r.ok ? 'ok' : 'err');
    if (r.ok) { st.me.questions = [...(st.me.questions ?? []), input.value.trim()]; input.value = ''; drawMine(); }
  };
  drawMine();
}
function drawMine() {
  const ul = document.getElementById('qmine');
  if (ul) ul.innerHTML = (st.me.questions ?? []).map((q) => `<li>${esc(q)}</li>`).join('');
}

// Slides, reveals, the break: the projector's slide, on the laptop too. At the verdicts, the reasons as well.
function drawPassive(s) {
  if (s.kind === 'join') {
    if (passive === 'join' && app.querySelector('.s-in')) return;
    passive = 'join';
    app.innerHTML = `${top()}<div class="s-in"><h2 class="s-title">You’re in, ${esc(st.me.name)}.</h2>
      <p class="s-lines">The class starts soon. Keep this page open: it follows the projector.</p>
      <p class="muted">${esc(st.paper.title)} · ${esc(st.paper.authors)} · ${esc(st.paper.venue)}</p></div>`;
    return;
  }
  const why = s.shows === 'claims' && st.claims
    ? `<div class="s-why"><p class="s-sub">Each claim: what was measured, and the biggest threat</p>${st.claims.map((c) =>
      `<p><strong>“${esc(c.quote)}”</strong><br>They measured: ${esc(c.measured)} ${esc(c.why)}</p>`).join('')}</div>` : '';
  const slide = slideHtml(s, st.results, { paper: st.paper, claims: st.claims });
  if (slide + why === passive && app.querySelector('.s-slide')) return;
  // Keep a question being typed across redraws.
  const typing = document.getElementById('q')?.value ?? '';
  passive = slide + why;
  app.innerHTML = `${top()}<div class="slide s-slide">${slide}</div>${why}`;
  questionBox();
  if (typing) document.getElementById('q').value = typing;
}

// ---------- The paper's survey ----------
// The paper's survey.
function drawSurvey(s) {
  const saved = st.me.survey;
  const a = saved ?? {};
  const qs = s.survey;
  app.innerHTML = `${top()}${intro(s)}<form id="f">${qs.map((q, i) => question(q, a, i + 1)).join('')}
    <button class="primary" type="submit">${saved ? 'Update my answers' : 'Send'}</button>
    <p class="s-msg" id="m">${saved ? 'Saved. You can change it until the class moves on.' : ''}</p></form>`;
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

function question(q, a, n) {
  const label = `<p>${n}. <span${ed(`thu/SURVEY/${q.id}/q`, q.q)}>${esc(q.q)}</span>${q.optional ? ' <small>(optional)</small>' : ''}</p>`;
  if (q.type === 'one' || q.type === 'many') {
    const type = q.type === 'one' ? 'radio' : 'checkbox';
    const on = (i) => (q.type === 'one' ? a[q.id] === i : (a[q.id] ?? []).includes(i));
    const opts = q.options.map((o, i) => `<label><input type="${type}" name="${q.id}" value="${i}" ${on(i) ? 'checked' : ''}><span${ed(`thu/SURVEY/${q.id}/options/${i}`, o)}>${esc(o)}</span></label>`).join('');
    const other = q.options.includes('Other (please specify)')
      ? `<input name="${q.id}Other" maxlength="300" placeholder="Other (please specify)" value="${esc(a[`${q.id}Other`] ?? '')}">` : '';
    const extra = (q.why ? `<input name="why" maxlength="300" placeholder="${esc(q.why)}" value="${esc(a.why ?? '')}">` : '') + other;
    return `<div class="s-q">${label}<div class="s-choice">${opts}</div>${extra}</div>`;
  }
  if (q.type === 'number') return `<div class="s-q">${label}<input name="${q.id}" type="number" min="${q.min}" max="${q.max}" step="0.5" inputmode="decimal" value="${esc(a[q.id] ?? '')}" style="max-width:140px"></div>`;
  return `<div class="s-q">${label}<textarea name="${q.id}" maxlength="300">${esc(a[q.id] ?? '')}</textarea></div>`;
}
// The survey is numbered 1 to 6 here; on the authors' form these are Q2 to Q7 (Q1, a donation choice, is not asked).

// One choice per item (a post, a comment): buttons that stay pressed, a running count, a sticky progress line.
function choices(selector, total, mine, sendOne) {
  const prog = () => {
    const n = Object.keys(mine).length;
    document.getElementById('prog').textContent = `${n} of ${total} done${n === total ? ' · thank you' : ''}`;
  };
  prog();
  app.querySelectorAll(selector).forEach((el) => {
    el.querySelectorAll('button[data-v]').forEach((b) => {
      b.onclick = async () => {
        const r = await sendOne(el.dataset.id, b.dataset.v);
        if (!r.ok) return msg(el.querySelector('.s-msg'), r.error, 'err');
        mine[el.dataset.id] = b.dataset.v;
        el.classList.add('done');
        el.querySelectorAll('button[data-v]').forEach((x) => x.classList.toggle('on', x === b));
        msg(el.querySelector('.s-msg'), '');
        prog();
      };
    });
  });
}

// ---------- Label the posts ----------
const blocks = (bs) => bs.map((b) => (b.code ? `<pre>${esc(b.text)}</pre>` : `<p>${esc(b.text)}</p>`)).join('');

function drawLabels(s) {
  const mine = { ...st.me.labels };
  const key = `<div class="s-key"><p class="s-sub">The three labels</p>${s.labels.map((l) => `<p><b${ed(`thu/LABELS/${l.id}/label`, l.label)}>${esc(l.label)}</b>: <span${ed(`thu/LABELS/${l.id}/hint`, l.hint)}>${esc(l.hint)}</span></p>`).join('')}</div>`;
  app.innerHTML = `${top()}${intro(s)}${key}<p class="s-progress" id="prog"></p>${s.posts.map((p, i) => `
    <article class="s-post ${mine[p.id] ? 'done' : ''}" data-id="${esc(p.id)}">
      <div class="s-post-head"><h2>${i + 1}. ${esc(p.title)}</h2><code class="s-cmd">${esc(p.command)}</code></div>
      <div class="s-thread">
        <p class="s-sub">Question</p><div class="s-body">${blocks(p.question)}</div>
        <p class="s-sub">Accepted answer</p><div class="s-body s-answer">${blocks(p.answer)}</div>
      </div>
      <p><strong>Which is true of <code>${esc(p.command)}</code> in this post?</strong></p>
      <div class="s-yesno">${s.labels.map((l) => `<button data-v="${l.id}" title="${esc(l.hint)}" class="${mine[p.id] === l.id ? 'on' : ''}">${esc(l.label)}</button>`).join('')}</div>
      <p class="s-msg"></p>
    </article>`).join('')}`;
  choices('.s-post', s.posts.length, mine, (post, value) => send({ post, value }));
}

// ---------- Seven Git tasks: pick a command, then say how sure you are ----------
function drawTasks(s) {
  const mine = JSON.parse(JSON.stringify(st.me.tasks ?? {}));
  const full = (id) => mine[id]?.pick !== undefined && mine[id]?.sure !== undefined;
  app.innerHTML = `${top()}${intro(s)}<p class="s-progress" id="prog"></p>${s.tasks.map((t, i) => `
    <article class="s-post s-task ${full(t.id) ? 'done' : ''}" data-id="${esc(t.id)}">
      <p class="s-sub">Task ${i + 1} of ${s.tasks.length}</p>
      <p class="s-situation"${ed(`thu/TASKS/${t.id}/situation`, t.situation)}>${md(t.situation)}</p>
      <p><strong>Which command would you run?</strong></p>
      <div class="s-opts">${t.options.map((o, k) => `<button data-f="pick" data-v="${k}" class="${mine[t.id]?.pick === k ? 'on' : ''}"><span${ed(`thu/TASKS/${t.id}/options/${k}`, o)}>${md(o)}</span></button>`).join('')}</div>
      <p><strong>How sure are you?</strong></p>
      <div class="s-cats">${s.sure.map((x, k) => `<button data-f="sure" data-v="${k}" class="${mine[t.id]?.sure === k ? 'on' : ''}"><span${ed(`thu/SURE/${k}`, x)}>${esc(x)}</span></button>`).join('')}</div>
      <p class="s-msg"></p>
    </article>`).join('')}`;
  const prog = () => {
    const n = s.tasks.filter((t) => full(t.id)).length;
    document.getElementById('prog').textContent = `${n} of ${s.tasks.length} done${n === s.tasks.length ? ' · thank you' : ''}`;
  };
  prog();
  app.querySelectorAll('.s-task').forEach((el) => {
    el.querySelectorAll('button[data-f]').forEach((b) => {
      b.onclick = async () => {
        const r = await send({ item: el.dataset.id, field: b.dataset.f, value: Number(b.dataset.v) });
        if (!r.ok) return msg(el.querySelector('.s-msg'), r.error, 'err');
        (mine[el.dataset.id] ??= {})[b.dataset.f] = Number(b.dataset.v);
        el.querySelectorAll(`button[data-f="${b.dataset.f}"]`).forEach((x) => x.classList.toggle('on', x === b));
        el.classList.toggle('done', full(el.dataset.id));
        msg(el.querySelector('.s-msg'), '');
        prog();
      };
    });
  });
}

// ---------- Sort items into categories ----------
function drawSort(s) {
  const mine = Object.fromEntries(Object.entries(st.me.sorts?.[s.id] ?? {}).map(([k, v]) => [k, String(v)]));
  app.innerHTML = `${top()}${intro(s)}<p class="s-progress" id="prog"></p>${s.items.map((x) => `
    <article class="s-post ${mine[x.id] !== undefined ? 'done' : ''}" data-id="${esc(x.id)}">
      <p class="s-quote">${x.label ? `${esc(x.label)}: ` : ''}<span${ed(x.path, x.text)}>${md(x.text)}</span></p>
      <div class="s-cats">${s.categories.map((c, i) => `<button data-v="${i}" class="${mine[x.id] === String(i) ? 'on' : ''}"><span${ed(`thu/${s.catRoot}/${i}`, c)}>${esc(c)}</span></button>`).join('')}</div>
      <p class="s-msg"></p>
    </article>`).join('')}`;
  choices('.s-post', s.items.length, mine, (item, value) => send({ item, value: Number(value) }));
}

// ---------- Writing: alone, or one shared answer per pair, team or group ----------
const timers = {};
function drawWrite(s) {
  const g = st.group;
  if (s.who !== 'solo' && !g) { app.innerHTML = `${top()}${intro(s)}<p class="s-wait">Your ${s.who === 'pair' ? 'pair' : 'group'} is being formed…</p>`; return; }
  const who = `<b${ed(`thu/WHO_LINE/${s.who}`, s.whoLine)}>${esc(s.whoLine ?? '')}</b>`;
  const with_ = g ? `<p class="s-with">${who} (${esc(g.name)}: ${esc(g.members.join(', '))}). Write one answer together; one person types.</p>`
    : `<p class="s-with">${who}</p>`;
  const claim = g?.claim ? `<div class="s-claim"><p class="s-sub">Your team’s claim, in the paper’s own words</p>
    <p class="quote">“<span${ed(`thu/CLAIMS/${g.claim.id}/quote`, g.claim.quote)}>${esc(g.claim.quote)}</span>”</p><p class="s-sub">The facts behind it</p><ul class="s-facts">${(g.claim.facts ?? []).map((f, i) => `<li${ed(`thu/CLAIMS/${g.claim.id}/facts/${i}`, f)}>${esc(f)}</li>`).join('')}</ul></div>` : '';
  const exAt = (...keys) => ['thu/EXAMPLES', s.exampleKey, ...keys].join('/');
  const ex = s.example ? `<details class="s-example"><summary><span${ed(exAt('title'), s.example.title)}>${esc(s.example.title)}</span></summary>${s.example.intro ? `<p${ed(exAt('intro'), s.example.intro)}>${esc(s.example.intro)}</p>` : ''}
    ${s.example.rows.map(([k, v], i) => `<p><b>${esc(k)}:</b> <span${ed(exAt('rows', i, 1), v)}>${esc(v)}</span></p>`).join('')}</details>` : '';
  app.innerHTML = `${top()}${intro(s)}${with_}${claim}${ex}${s.fields.map((f) => `<div class="s-field"><label for="f-${f.id}"${ed(`thu/FIELDS/${s.fieldsKey}/${f.id}/label`, f.label)}>${esc(f.label)}</label>
      <textarea id="f-${f.id}" data-f="${f.id}" maxlength="300">${esc(st.answers?.[f.id] ?? '')}</textarea>
      <span class="by" id="by-${f.id}"></span></div>`).join('')}`;
  app.querySelectorAll('textarea[data-f]').forEach((t) => {
    // Only text this person changed is sent: clicking in and out never overwrites a partner.
    const save = async () => {
      clearTimeout(timers[t.dataset.f]);
      if (!t.dataset.dirty) return;
      delete t.dataset.dirty;
      const r = await send({ field: t.dataset.f, text: t.value });
      document.getElementById(`by-${t.dataset.f}`).textContent = r.ok ? 'Saved' : r.error;
    };
    t.oninput = () => { t.dataset.dirty = '1'; clearTimeout(timers[t.dataset.f]); timers[t.dataset.f] = setTimeout(save, 700); };
    t.onblur = save;
  });
  updateWrite();
}

function updateWrite() {
  const a = st.answers;
  if (!a) return;
  app.querySelectorAll('textarea[data-f]').forEach((t) => {
    if (document.activeElement !== t && !t.dataset.dirty && a[t.dataset.f] !== undefined && t.value !== a[t.dataset.f]) t.value = a[t.dataset.f];
    const by = document.getElementById(`by-${t.dataset.f}`);
    if (by && document.activeElement !== t && a.by && st.group) by.textContent = `Last saved by ${a.by}`;
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
