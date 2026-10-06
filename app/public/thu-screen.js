// The projector (/thu/screen): the class's slide deck, live from the server. Keys: F full screen, → next, ← back.
import { key, poll, slideHtml, presenterKeys, move } from '/thu-common.js';

const slide = document.getElementById('slide');
if (!key) document.body.innerHTML = '<p style="padding:24px;font:18px Inter,sans-serif">Open the teacher link: it ends in ?key=…</p>';
let shown = '', index = 0;

poll('/api/thu/admin/state', (s) => {
  index = s.index;
  const html = slideHtml(s.scene, s.results, {
    joinUrl: s.joinUrl, paper: s.paper, claims: s.claims, progress: s.progress, joined: s.people.length,
  });
  if (html !== shown) { slide.innerHTML = html; shown = html; }
}, (up) => document.body.classList.toggle('offline', !up));

presenterKeys((dir) => move(dir, index));
addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
});
setTimeout(() => document.getElementById('keys-hint').classList.add('gone'), 6000);
