// Thursday in sync: with bots playing the class, every scene's text (from server/thursday_scenes.js, after any
// text edits) must show on the student page, the projector and the teacher console.
//   node e2e/thursday_sync.mjs        (npx playwright install --only-shell chromium, once)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_PORT) || 3107;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (s) => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/\s+/g, ' ').trim();

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thu-sync-'));
const server = spawn(process.execPath, ['server/index.js'], { cwd: APP, env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir } });
const key = await new Promise((resolve, reject) => {
  let out = '';
  server.stdout.on('data', (d) => { out += d; const m = /key=([\w-]+)\n/.exec(out); if (m) resolve(m[1]); });
  server.on('exit', () => reject(new Error(`server stopped:\n${out}`)));
});
const api = async (p, body) => (await fetch(`${BASE}${p}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-admin-key': key }, body: body && JSON.stringify(body) })).json();

const problems = [];
let browser;
try {
  browser = await chromium.launch(process.env.PW_BROWSER ? {} : { channel: 'chrome' });
  await api('/api/thu/admin/reset', {});
  await api('/api/thu/admin/rehearse', { on: true, count: 6, speed: 20 });
  const teacher = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await teacher.goto(`${BASE}/thu/admin?key=${key}`);
  const screen = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await screen.goto(`${BASE}/thu/screen?key=${key}`);

  const first = await api('/api/thu/admin/state');
  if (!first.ok) throw new Error(JSON.stringify(first));
  const total = first.total;
  for (let i = 0; i < total; i++) {
    let st = await api('/api/thu/admin/state');
    for (let t = 0; st.progress && st.progress.done < st.progress.of && t < 240; t++) { await sleep(250); st = await api('/api/thu/admin/state'); }
    const s = st.scene;
    // A new student who joins now sees this scene (nothing earlier left to finish).
    const student = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await student.goto(`${BASE}/thu`);
    await student.fill('input', `Checker ${i + 1}`);
    await student.keyboard.press('Enter');
    await sleep(2500);
    const text = {
      student: plain(await student.innerText('body')),
      projector: plain(await screen.innerText('body')),
      teacher: plain(await teacher.innerText('body')),
    };
    const want = (where, what, label) => {
      if (what && !text[where].includes(plain(what))) problems.push(`${s.id}: ${where} is missing ${label}: "${plain(what).slice(0, 80)}"`);
    };
    // A student who joins late finishes the open activity first, and the join scene greets them: both by design.
    const late = text.student.includes('The class has moved on') || s.kind === 'join';
    for (const where of late ? ['projector', 'teacher'] : ['student', 'projector', 'teacher']) want(where, s.title, 'the title');
    for (const l of s.lines || []) want('projector', l, 'a line');
    if (!late) for (const l of String(s.about || '').split('\n')) want('student', l, 'the instructions');
    if (s.ask) { want('projector', s.ask, 'the question'); want('teacher', s.ask, 'the question'); }
    for (const [k, v] of s.table || []) { want('projector', k, 'a table row'); want('projector', v, 'a table row'); }
    console.log(`${String(i + 1).padStart(2)} ${s.id.padEnd(18)} ${problems.filter((p) => p.startsWith(`${s.id}:`)).length ? 'MISMATCH' : 'in sync'}${late ? ' (student page: finishing an earlier activity)' : ''}`);
    await student.context().close();
    if (i < total - 1) { await api('/api/thu/admin/next', {}); await sleep(1500); }
  }
} finally {
  await browser?.close();
  server.kill();
}
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.join('\n')}`); process.exit(1); }
console.log('\nAll scenes in sync on the student page, the projector and the teacher console.');
