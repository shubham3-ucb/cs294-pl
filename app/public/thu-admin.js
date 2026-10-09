// Teacher console (/thu/admin): private. Next and Back run the class; the projector shows the preview.
import { api, key, poll, slideHtml, presenterKeys, move, md, esc, PROJECTOR_WINDOW } from '/thu-common.js';
import { ed, busy, startEditing, editingOn, editFromUrl } from '/editable.js';

const $ = (id) => document.getElementById(id);

editFromUrl(key);
addEventListener('text-edited', () => { shown = ''; });
// Edit text: the console's own texts (the slide preview, Say, Ask, Hope) become editable, and the student page
// opens in edit mode too, so every student-facing text can be changed where it appears.
$('edit-toggle').onclick = () => {
  if (!editingOn()) startEditing(key);
  window.open(`/thu?key=${encodeURIComponent(key)}&edit`, 'thursday-edit-students');
};

if (!key) document.body.innerHTML = '<p style="padding:24px;font:18px Inter,sans-serif">Open the teacher link: it ends in ?key=…</p>';
let index = 0, shown = '', projector = null, sceneStart = 0, planned = 0, rehearsal = null;
const mmss = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
// Time in this scene against its plan; red when over.
setInterval(() => {
  if (!sceneStart) return;
  const used = Date.now() - sceneStart;
  $('clock').textContent = `${mmss(used)} / ${mmss(planned)}`;
  $('clock').classList.toggle('over', used > planned);
}, 500);
const ctx = (s) => ({ joinUrl: s.joinUrl, paper: s.paper, claims: s.claims, progress: s.progress, joined: s.people.length });
const star = (key, on) => `<button class="c-star ${on ? 'on' : ''}" data-star="${esc(key)}" title="${on ? 'Starred: on the projector' : 'Star: put it on the projector'}">${on ? '★' : '☆'}</button>`;
const WHO = { pair: 'pairs', team: 'teams', big: 'groups' };
// Answers of the current write or discussion scene, with names (private to the console).
function drawAnswers(r) {
  const box = $('answers-box');
  box.hidden = !r || r.type !== 'entries' || r.from === 'questions';
  if (box.hidden) return;
  $('answers-label').textContent = `Answers · ${r.all.length} of ${r.total || r.all.length}${r.starred.length ? ` · ${r.starred.length} starred` : ''}`;
  $('answers').innerHTML = r.all.map((e) => `<li>${star(e.key, e.starred)}<div><b>${esc(e.who)}</b>${e.claim ? ` <span class="muted">· “${esc(e.claim.quote.slice(0, 60))}…”</span>` : ''}
    ${r.fields.map((f) => (e.answers?.[f.id] ? `<p><span class="muted">${esc(f.short)}:</span> ${md(e.answers[f.id])}</p>` : '')).join('')}</div></li>`).join('')
    || '<li class="muted">Nothing yet.</li>';
}
function drawQuestions(qs) {
  const n = qs.filter((q) => q.starred).length;
  $('questions-label').textContent = `Questions from the class · ${qs.length}${n ? ` · ${n} starred` : ''}`;
  $('questions').innerHTML = [...qs].reverse().map((q) => `<li>${star(q.key, q.starred)}<div><b>${esc(q.who)}</b><p>${esc(q.text)}</p></div></li>`).join('')
    || '<li class="muted">None yet.</li>';
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-star]');
  if (!b) return;
  b.disabled = true;
  await api('/api/thu/admin/star', { key: b.dataset.star });
  b.disabled = false;
});

poll('/api/thu/admin/state', (s) => {
  if (busy()) return; // a text is being edited: redraw after
  index = s.index;
  const sc = s.scene;
  // The preview is the projector's slide: no names.
  const html = slideHtml(sc, s.projector ?? s.results, ctx(s));
  drawAnswers(s.results);
  drawQuestions(s.questions);
  if (html !== shown) { $('preview').innerHTML = html; shown = html; }
  $('where').textContent = `Scene ${s.index + 1} of ${s.total}`;
  sceneStart = Date.now() - s.elapsed;
  planned = sc.minutes * 60_000;
  $('next-up').textContent = s.next ? `Next: ${s.next.title}` : 'Last scene.';
  // At the verdicts: the biggest threat to each claim in play, for the teacher to say.
  const whys = s.results?.type === 'claims'
    ? [...new Map(s.results.teams.filter((t) => t.claim).map((t) => [t.claim.id, t.claim])).values()]
      .map((c) => `<br><br><strong>“${esc(c.quote)}”</strong><br>${esc(c.why)}`).join('') : '';
  const at = (f) => `thu/SCENES/${sc.id}/${f}`;
  $('say').innerHTML = `<span${ed(at('say'), sc.say)}>${md(sc.say ?? '')}</span>${whys}`;
  $('ask-box').hidden = !sc.ask;
  $('ask').innerHTML = `<span${ed(at('ask'), sc.ask)}>${md(sc.ask ?? '')}</span>`;
  $('hope').innerHTML = `<span${ed(at('hope'), sc.hope)}>${md(sc.hope ?? '')}</span>`;
  $('back').disabled = s.index === 0;
  $('next').disabled = !s.next;
  $('here').textContent = `${s.hereCount} here · ${s.people.length} joined`;
  rehearsal = s.rehearsal;
  $('rehearsing').hidden = !rehearsal;
  if (rehearsal) $('rehearsing').textContent = `Rehearsal · ${rehearsal.count} bots · ${rehearsal.speed === 1 ? 'real time' : `${rehearsal.speed}×`}`;
  $('bot-toggle').textContent = rehearsal ? 'Stop rehearsal' : 'Start rehearsal';
  const p = s.progress;
  $('progress-box').hidden = !p;
  if (p) {
    $('progress-label').textContent = `${p.done} of ${p.of} ${p.unit === 'groups' ? 'groups done' : 'done'}`;
    $('progress-bar').style.width = `${p.of ? Math.round((100 * p.done) / p.of) : 0}%`;
  }
  $('people').innerHTML = s.people.map((x) => `<span class="${x.here ? '' : 'away'}">${esc(x.name)}</span>`).join('') || '<span class="away">Nobody yet</span>';
  const gs = s.who && s.groupings[s.who];
  $('groups').innerHTML = gs ? gs.map((g) => `<p><strong>${esc(g.name)}</strong> · ${esc(g.members.join(', '))}</p>`).join('') : '';
  $('regroup').hidden = !gs;
  $('regroup').textContent = gs ? `Re-form the ${WHO[s.who]}` : 'Re-form groups';
  const screen = `${location.origin}/thu/screen?key=${encodeURIComponent(key)}`;
  $('links').innerHTML = `<p>Students: <a href="${esc(s.joinUrl)}" target="_blank">${esc(s.joinUrl)}</a></p>
    <p>Projector: <a href="${esc(screen)}" target="_blank">${esc(screen)}</a></p>`;
}, (up) => { $('conn').classList.toggle('off', !up); $('conn').title = up ? 'Connected' : 'No answer from the server'; });

const go = async (dir) => { await move(dir, index); };
$('next').onclick = () => go('next');
$('back').onclick = () => go('back');
presenterKeys(go);

$('present').onclick = () => {
  projector = window.open(`/thu/screen?key=${encodeURIComponent(key)}`, PROJECTOR_WINDOW, 'popup,width=1280,height=720');
  projector?.focus();
};
$('export').onclick = async (e) => {
  e.preventDefault();
  const res = await fetch('/api/thu/admin/export', { headers: { 'x-admin-key': key } });
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement('a'), { href: url, download: 'thursday-answers.md' }).click();
  URL.revokeObjectURL(url);
};
const rehearse = (on) => api('/api/thu/admin/rehearse', { on, count: Number($('bot-count').value), speed: Number($('bot-speed').value) });
$('bot-toggle').onclick = () => rehearse(!rehearsal);
$('bot-speed').onchange = () => rehearsal && rehearse(true);
$('regroup').onclick = async () => {
  if (!confirm('Re-form these groups from the people in the room? What they wrote so far is cleared.')) return;
  const r = await api('/api/thu/admin/regroup', {});
  if (!r.ok) alert(r.error);
};
$('reset').onclick = async () => {
  if (!confirm('Reset Thursday? Everyone joins again and all answers are deleted.')) return;
  await api('/api/thu/admin/reset', {});
};
