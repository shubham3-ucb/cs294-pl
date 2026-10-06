// Teacher console (/thu/admin): private. Next and Back run the class; the projector shows the preview.
import { api, key, poll, slideHtml, presenterKeys, move, md, esc, PROJECTOR_WINDOW } from '/thu-common.js';

const $ = (id) => document.getElementById(id);
let index = 0, shown = '', projector = null;
const ctx = (s) => ({ joinUrl: s.joinUrl, paper: s.paper, claims: s.claims, progress: s.progress, joined: s.people.length });

poll('/api/thu/admin/state', (s) => {
  index = s.index;
  const sc = s.scene;
  const html = slideHtml(sc, s.results, ctx(s));
  if (html !== shown) { $('preview').innerHTML = html; shown = html; }
  $('where').textContent = `Scene ${s.index + 1} of ${s.total} · ${sc.part} · ${sc.minutes} min`;
  $('next-up').textContent = s.next ? `Next: ${s.next.part} · ${s.next.title}` : 'Last scene.';
  // At the verdicts: why each claim in play shrinks, for the teacher to say.
  const whys = s.results?.type === 'claims'
    ? [...new Map(s.results.groups.filter((g) => g.claim).map((g) => [g.claim.id, g.claim])).values()]
      .map((c) => `<br><br><strong>“${esc(c.quote)}”</strong><br>${esc(c.why)}`).join('') : '';
  $('say').innerHTML = md(sc.say ?? '') + whys;
  $('ask-box').hidden = !sc.ask;
  $('ask').innerHTML = md(sc.ask ?? '');
  $('hope').innerHTML = md(sc.hope ?? '');
  $('back').disabled = s.index === 0;
  $('next').disabled = !s.next;
  $('here').textContent = `${s.hereCount} here · ${s.people.length} joined`;
  const p = s.progress;
  $('progress-box').hidden = !p;
  if (p) {
    $('progress-label').textContent = `${p.done} of ${p.of} ${p.unit === 'groups' ? 'groups done' : 'done'}`;
    $('progress-bar').style.width = `${p.of ? Math.round((100 * p.done) / p.of) : 0}%`;
  }
  $('people').innerHTML = s.people.map((x) => `<span class="${x.here ? '' : 'away'}">${esc(x.name)}</span>`).join('') || '<span class="away">Nobody yet</span>';
  $('groups').innerHTML = s.groups.map((g) => `<p><strong>${esc(g.name)}</strong> · ${esc(g.members.join(', '))}</p>`).join('');
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
$('reset').onclick = async () => {
  if (!confirm('Reset Thursday? Everyone joins again and all answers are deleted.')) return;
  await api('/api/thu/admin/reset', {});
};
