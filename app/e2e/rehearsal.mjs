// Rehearse with bots, in a real browser: the teacher starts 9 bots in the console (Details), then
// presses only Next. The bots join by name (3 labs of 3) and play every scene through the student
// actions: deleting fancy, the TOP conflict, the refused send and the lab's way back (Combine or Replay on
// top), Undo on the disguise card, the boss's clean-up, every answer and every takeaway. Next is pressed
// only when the console shows the scene is complete: all labs done, or every bot answered and wrote its
// takeaway. Then Stop rehearsal and Reset remove the bots. Own server on 127.0.0.1:E2E_PORT+2 (3104),
// fresh DATA_DIR under /tmp, ADMIN_KEY=test, always stopped. Any console error, page error, 5xx or server
// error output fails the run.
//   npm run rehearsal
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { START } from '../public/monster.js';
import { SCENES } from '../server/steps.js';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(APP, 'e2e', 'shots');
const PORT = (Number(process.env.E2E_PORT) || 3102) + 2;
const BASE = `http://127.0.0.1:${PORT}`;
const KEY = 'test';
const BOTS = 9;
const SCENE_WAIT = 120_000; // the longest a scene may take at 20× speed
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'outfit-lab-rehearsal-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adminState = () => fetch(`${BASE}/api/admin/state?key=${KEY}`).then((r) => r.json());
const isBot = (name) => / \(bot\)$/.test(name);

let server = null;
let serverErr = '';
const problems = [];

async function startServer() {
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: APP, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR, ADMIN_KEY: KEY, LABS: '' },
  });
  server.stderr.on('data', (d) => { serverErr += d; });
  for (let i = 0; i < 100; i++) {
    if (await fetch(BASE).then((r) => r.ok, () => false)) return;
    await sleep(100);
  }
  throw new Error(`The server did not start:\n${serverErr}`);
}

function checkClean(where) {
  const errors = [...problems, ...(serverErr.trim() ? [`server: ${serverErr.trim()}`] : [])];
  if (errors.length) throw new Error(`${where}: something went wrong underneath:\n  ${errors.join('\n  ')}`);
}

// Poll until check() is truthy; got() says what was there last.
async function until(what, check, got = () => '', ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const last = await check();
    if (last) return last;
    if (Date.now() > end) throw new Error(`Timed out waiting: ${what}\n  last seen: ${await got()}`);
    await sleep(200);
  }
}

// What the teacher waits for before pressing Next, read off the console.
async function sceneComplete(admin, scene) {
  const text = (sel) => admin.textContent(sel);
  if (scene.kind === 'join') return (await text('#people')).startsWith(`${BOTS} people · ${BOTS} online`);
  if (scene.kind === 'task' && scene.step === 0) {
    // Every lab's outfit changed: the bots played the chaos round.
    const { labs } = await adminState();
    return labs.every((l) => l.practice || JSON.stringify(l.monster) !== JSON.stringify(START));
  }
  if (scene.kind === 'task') return admin.$eval('#ready', (el) => el.classList.contains('all'));
  const answered = !scene.answerable || (await text('#answers-count')) === `${BOTS}/${BOTS} answered`;
  const written = scene.takeawayStep === null || (await text('#takeaways')) === `Takeaways written: ${BOTS}/${BOTS}`;
  return answered && written;
}

async function run() {
  await startServer();
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`console.${m.type()}: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 500) problems.push(`${r.status()} from ${r.url()}`); });
    page.on('dialog', (d) => d.accept()); // Reset asks first
    await page.goto(`${BASE}/admin?key=${KEY}`);
    await until('the console shows Join', async () => (await page.textContent('#scene-title')) === 'Join');
    assert.equal(await page.isVisible('#rehearsing'), false, 'no rehearsal yet');

    // Start the rehearsal: Details → 9 bots, 20× faster → Start rehearsal.
    await page.click('#details > summary');
    await page.selectOption('#bot-count', String(BOTS));
    await page.selectOption('#bot-speed', '20');
    await page.click('#bot-toggle');
    await until('the top bar says a rehearsal runs', async () => (await page.textContent('#rehearsing')) === `Rehearsal · ${BOTS} bots · 20× faster`);
    assert.equal(await page.textContent('#bot-toggle'), 'Stop rehearsal');
    await page.click('#details > summary');

    // The teacher presses only Next, once the console shows the scene is complete.
    for (const [n, scene] of SCENES.entries()) {
      await until(`the console shows "${scene.title}"`, async () => (await page.textContent('#scene-title')) === scene.title, () => page.textContent('#scene-title'));
      const started = Date.now();
      await until(`"${scene.title}" completes`, () => sceneComplete(page, scene),
        async () => `${await page.textContent('#ready')} · ${await page.textContent('#answers-count')} · ${await page.textContent('#takeaways')}`, SCENE_WAIT);
      console.log(`  ${scene.title}: complete in ${((Date.now() - started) / 1000).toFixed(1)} s`);
      if (scene.id === 'task-4') await page.screenshot({ path: path.join(SHOTS, 'rehearsal-1-task-4-console.png') });
      if (scene.id === 'reveal-4') {
        const { paths } = (await adminState()).session.integration;
        assert.equal(paths.length, 3, "Step 4's reveal: each lab's change has a path to main");
        assert.equal(paths.filter((p) => p.copy).length, 1, 'the replayed change starts at a copy');
      }
      if (n === SCENES.length - 1) break;
      await sleep(Math.max(0, 600 - (Date.now() - started))); // the console ignores a second press within 400 ms
      await page.click('#next');
    }
    await page.screenshot({ path: path.join(SHOTS, 'rehearsal-2-wrap-console.png') });

    // The bots did every mission themselves (no Rescue), labelled "(bot)" everywhere.
    const a = await adminState();
    const real = a.labs.filter((l) => !l.practice);
    assert.equal(real.length, 3);
    for (const lab of real) {
      assert.equal(lab.members.length, 3, `${lab.name} has 3 bots`);
      assert.ok(lab.members.every((m) => isBot(m.name) && m.online), `${lab.name}: every member is a "(bot)", online`);
    }
    const did = (labId, action, outcome = /./) => a.feed.some((e) => e.labId === labId && isBot(e.who) && action.test(e.action) && outcome.test(e.outcome));
    assert.ok(a.feed.every((e) => !e.labId || isBot(e.who) || ['Teacher', 'The Intern'].includes(e.who)), 'only bots acted in the labs');
    assert.ok(!a.feed.some((e) => e.who === 'Teacher' && /Finish merge|Save card|Replace/.test(e.action)), 'no Rescue was needed');
    for (const lab of real) {
      assert.ok(did(lab.id, /^Merge fancy into main$/, /^fast-forward$/), `${lab.name}: fancy, a fast-forward`);
      assert.ok(did(lab.id, /^Delete sticky note fancy$/), `${lab.name}: deleted the fancy note`);
      assert.ok(did(lab.id, /^Merge sporty into main$/, /^conflict: TOP$/), `${lab.name}: the TOP conflict`);
      assert.ok(did(lab.id, /^Finish merge$/, /^merge card/), `${lab.name}: resolved it`);
    }
    // Step 4: the first lab to send just sends. The next is refused and combines; the last is refused and replays.
    assert.deepEqual(real.map((l) => l.way ?? 'first').sort(), ['first', 'merge', 'rebase'], 'Step 4: one lab sent, one merged, one replayed');
    const replayer = real.find((l) => l.way === 'rebase');
    assert.ok(did(replayer.id, /^Replay on top$/, /^[0-9a-f]{7} → [0-9a-f]{7}$/), `${replayer.name}: replayed its card as a new one`);
    assert.ok(did(real.find((l) => l.way === 'merge').id, /^Get & combine$/, /^merge card/), 'the refused lab that combines makes a merge card');
    // Step 5: every lab got the card on Next, and every lab undid it itself (Undo this card, or Move my note back).
    for (const lab of real) assert.ok(did(lab.id, /^(Undo card|Move my note back here$)/), `Step 5: ${lab.name} undid the disguise card`);
    assert.ok(real.some((lab) => did(lab.id, /^Undo card/)), 'Step 5: a lab undid it with a fix card');
    assert.ok(did('2', /^Move my note back here$/) && did('2', /^Send to Wall$/, /^refused/), 'Step 5: Lab 2 moved back first, and was refused');
    assert.ok(a.feed.some((e) => isBot(e.who) && e.action === 'Replace the Wall with one card'), 'Step 6: a bot in the boss lab replaced the Wall');
    assert.match(a.session.audits.before.rows[0].text, /^Wall: \S+ \(bot\) \(Lab \d\), [0-9a-f]{7}$/, 'before: the Wall knows which bot added the boots');
    assert.equal(a.session.audits.after.rows[0].text, 'Wall: not found');
    assert.equal(a.projector.takeaways.length, 12, 'the takeaway wall at the wrap');
    const md = await fetch(`${BASE}/api/admin/export?key=${KEY}`).then((r) => r.text());
    assert.equal(md.match(/^### .+ \(bot\) · Lab \d$/gm)?.length, BOTS, 'the export lists every bot');
    await page.click('#details > summary');
    await until('Details lists every "(bot)"', async () => (await page.locator('#rosters li', { hasText: '(bot)' }).count()) === BOTS);

    // Stop rehearsal: the bots leave, with their answers.
    await page.click('#bot-toggle');
    await until('the bots left', async () => (await page.textContent('#people')).startsWith('0 people'));
    assert.equal(await page.isVisible('#rehearsing'), false);
    assert.equal(await page.textContent('#bot-toggle'), 'Start rehearsal');
    assert.doesNotMatch(await fetch(`${BASE}/api/admin/export?key=${KEY}`).then((r) => r.text()), /\(bot\)/);

    // Reset removes a running rehearsal too.
    await page.selectOption('#bot-count', '2');
    await page.click('#bot-toggle');
    await until('2 bots joined', async () => (await page.textContent('#people')).startsWith('2 people'));
    await page.click('#reset');
    await until('Reset sent everyone away', async () => (await page.textContent('#scene-title')) === 'Join'
      && (await page.textContent('#people')).startsWith('0 people') && !(await page.isVisible('#rehearsing')));
    await sleep(1000); // the stopped bots must not come back
    assert.equal((await adminState()).session.people, 0, 'no bot came back after Reset');
    checkClean('rehearsal');
  } finally {
    await browser.close();
  }
}

try {
  await run();
  console.log(`Rehearsal OK: ${BOTS} bots played every scene; the teacher pressed only Next.`);
} finally {
  if (server) {
    const exited = new Promise((r) => server.once('exit', r));
    server.kill('SIGTERM');
    await exited;
  }
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
