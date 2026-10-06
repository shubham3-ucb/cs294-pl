// A whole class in a real browser, scene by scene, through the 7 steps. Proves SPEC.md (acceptance).
// Run 1: the teacher console, the projector window it opens, and 9 students who join by name only
//   (the app makes 3 labs of 3). The teacher moves the class only with Next and Back (button, clicker
//   keys); students act through the real UI and dismiss the tour with real clicks.
// Run 2: 2 students make 1 lab plus the practice lab; the practice lab sends first, so the real lab is
//   refused and replays on top. A student page and the projector still follow Next with live updates blocked.
// Run 3: lab sizes for 1 to 13 people, over the API.
// Each run starts its own server on 127.0.0.1:E2E_PORT (3102) with a fresh DATA_DIR under /tmp and
// ADMIN_KEY=test, and always stops it. Screenshots go to e2e/shots/. Any failed check, console error or
// warning, page error, failed request, 5xx or server error output fails the run.
//   npx playwright install --only-shell chromium   (once)
//   npm run e2e
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { chromium } from 'playwright';
import { nameOf, palette } from '../public/monster.js';
import { clockOf, velocity } from '../public/graph.js';
import {
  SCENES, STEPS, CARDS, PAPER, WRAP_LINE, DONE_LINE, FIXED_LINE, TRUST_LINE, COPY_LINE, MERGE_LINE, TAGLINE, SWITCH_UNSAVED, WAYS,
} from '../server/steps.js';
import { ANSWERS, TAKEAWAYS } from '../server/bots.js'; // sample answers and takeaways, so the screenshots read like a class

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(APP, 'e2e', 'shots');
const PORT = Number(process.env.E2E_PORT) || 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const KEY = 'test';
const DESKTOP = { width: 1440, height: 900 };
const PROJECTOR = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };
const WAIT = 10_000;

const NAMES = ['Ana', 'Raj', 'Mei', 'Priya', 'Tom', 'Lea', 'Sam', 'Kim', 'Ola']; // join order
const MAIN_LOCKED = 'main keeps the outfit you have. Make or switch to a sticky note to edit.'; // Step 2
const REFUSED = "Refused: the Wall has cards your main doesn't. Press Get & combine first.";
const REFUSED_CHOOSE = "Refused: the Wall has cards your main doesn't. Choose a way to get them: Get & combine (merge) or Replay on top (rebase). Then send again.";
const REFUSED_MOVED_BACK = 'Refused: the Wall still has the 🥸 card. Open the Safety diary, then press Get & combine.';
const BOSS_ONLY = 'The boss is cleaning the Wall. Watch.';
const SENT = /^Sent! The Wall moved to [0-9a-f]{7}\.$/;
const INK = '#111111'; // an integration path on the Wall: bold ink
const HINT_DELAY = 1; // seconds before "Stuck? Hint" shows (45 in class); the server reads HINT_DELAY
const HINT_TEXT = '#mission .hint > p:not(.label):not(.hint-links)'; // the idea, or the exact click
const API = {
  commit: 'commit', switch: 'switch', tomain: 'switch', merge: 'merge', deleteNote: 'delete-note', push: 'push', pull: 'pull', rebase: 'rebase',
};
// No user-facing text may use the old theme's words.
const OLD_WORDS = /\b(monsters?|faces?|body|bodies|legs|tentacles?|mustaches?)\b/i;
// The 7 steps, in class order.
const ORDER = ['join', 'task-0', 'reveal-0', 'task-1', 'reveal-1', 'task-2', 'reveal-2', 'task-3', 'reveal-3', 'break',
  'task-4', 'reveal-4', 'task-5', 'reveal-5', 'task-6', 'reveal-6', 'paper', 'exit', 'wrap'];
const TITLES = ['Everyone, one outfit', 'Save every version', 'Try two ideas at once', 'Make one outfit from both',
  'Put your outfit on the Wall', 'Oops: undo a shared mistake', 'The boss wants it clean', 'What you built'];

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (text) => text.replace(/\*\*|`/g, ''); // the page shows **bold** and `code` without the marks

// ---------- Server ----------

let server = null;
let serverErr = '';
let dataDir = '';
async function startServer() {
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: APP, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, ADMIN_KEY: KEY, LABS: '', HINT_DELAY: String(HINT_DELAY) },
  });
  server.stderr.on('data', (d) => { serverErr += d; });
  for (let i = 0; i < 100; i++) {
    if (await fetch(BASE).then((r) => r.ok, () => false)) return;
    await sleep(100);
  }
  throw new Error(`The server did not start:\n${serverErr}`);
}
async function stopServer() {
  if (!server) return;
  const exited = new Promise((r) => server.once('exit', r));
  server.kill('SIGTERM');
  await exited;
  server = null;
}

// Read-only checks straight from the repos on disk.
function gitIn(repo, ...args) {
  const cwd = repo === 'wall' ? path.join(dataDir, 'wall.git') : path.join(dataDir, 'labs', repo);
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).trim();
  } catch (err) {
    if (err.status === 1) return String(err.stdout).trim(); // merge-tree: 1 = conflict
    throw err;
  }
}
const tipIn = (repo, note = 'main') => gitIn(repo, 'rev-parse', `refs/heads/${note}`);
const notesIn = (repo) => gitIn(repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').split('\n');
const inHistory = (repo, id) => gitIn(repo, 'merge-base', id, 'refs/heads/main') === id; // id is an ancestor of main
// A commit as Git stored it: its parents, author, author date and committer date (seconds).
function commitIn(repo, id) {
  const [parents, author, at, ct] = gitIn(repo, 'log', '-1', '--format=%P%x00%an%x00%at%x00%ct', id).split('\0');
  return { id, parents: parents ? parents.split(' ') : [], author, at: Number(at), ct: Number(ct) };
}
const adminState = () => fetch(`${BASE}/api/admin/state?key=${KEY}`).then((r) => r.json());
const adminPost = (action, body = {}) => fetch(`${BASE}/api/admin/${action}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify(body),
}).then((r) => r.json());

// ---------- Browser ----------

let browser = null;
const WHO = new Map(); // page → who
const problems = [];
let quiet = false; // while the server restarts, refused connections are expected

function watch(page, who) {
  WHO.set(page, who);
  page.setDefaultTimeout(WAIT);
  page.on('pageerror', (e) => problems.push(`${who}: page error: ${e.message}`));
  page.on('console', (m) => {
    if (!quiet && (m.type() === 'error' || m.type() === 'warning')) problems.push(`${who}: console.${m.type()}: ${m.text()}`);
  });
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`${who}: ${r.status()} from ${r.url()}`); });
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText ?? '';
    if (!quiet && !why.includes('ERR_ABORTED')) problems.push(`${who}: request failed: ${r.url()} ${why}`);
  });
  page.on('dialog', (d) => {
    if (who === 'Teacher') return d.accept(); // Reset asks first
    problems.push(`${who}: unexpected browser dialog "${d.message()}"`);
    return d.dismiss();
  });
  return page;
}

async function open(who, url, viewport = DESKTOP) {
  const context = await browser.newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = watch(await context.newPage(), who);
  await page.goto(BASE + url);
  return page;
}

function checkClean(where) {
  const errors = [...problems, ...(serverErr.trim() ? [`server: ${serverErr.trim()}`] : [])];
  if (errors.length) throw new Error(`${where}: something went wrong underneath:\n  ${errors.join('\n  ')}`);
}

// Poll until check() is truthy. `got` describes what was there last, for the failure message.
async function until(what, check, got = () => '', ms = WAIT) {
  const end = Date.now() + ms;
  for (;;) {
    let last;
    try { last = await check(); } catch (err) { last = null; got = () => err.message; }
    if (last) return last;
    if (Date.now() > end) throw new Error(`Timed out waiting: ${what}\n  last seen: ${await got()}`);
    await sleep(100);
  }
}

// What a selector reads; text inside a closed <details> counts too (innerText is empty there).
const textOf = (p, sel) => p.$$eval(sel, (els) => els.map((e) => (e.checkVisibility() && e.innerText) || e.textContent)
  .join(' | ').replace(/\s+/g, ' ').trim());
const matches = (text, pattern) => (pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern));

async function sees(p, sel, pattern, what = `${WHO.get(p)} sees ${pattern} in ${sel}`) {
  let text = '';
  await until(what, async () => matches((text = await textOf(p, sel)), pattern), () => JSON.stringify(text));
}
async function notSees(p, sel, pattern, what = `${WHO.get(p)} no longer sees ${pattern} in ${sel}`) {
  let text = '';
  await until(what, async () => !matches((text = await textOf(p, sel)), pattern), () => JSON.stringify(text));
}
const shown = (p, sel) => p.locator(sel).first().isVisible();
const count = (p, sel) => p.locator(sel).count();
const dialogOpen = (p, id) => p.$eval(`#${id}`, (d) => d.open);

// Cards in a graph, left to right: {id, x, author, message, dashed, marked}. Each card's <title> reads
// "id7 · author · message"; a card only in the safety diary has a dashed frame, a card on the marked path an ink one.
const cardsIn = (p, svg) => p.$$eval(`${svg} .g-card`, (els, ink) => els.map((e) => {
  const [, author, ...message] = (e.querySelector('title')?.textContent ?? '').split(' · ');
  const rect = e.querySelector('rect');
  return {
    id: e.dataset.key, x: Number(e.dataset.x), author, message: message.join(' · '),
    dashed: rect?.hasAttribute('stroke-dasharray') ?? false, marked: rect?.getAttribute('stroke') === ink,
  };
}).sort((a, b) => a.x - b.x), INK);
const newestIn = async (p, svg) => (await cardsIn(p, svg)).filter((c) => !c.dashed).at(-1)?.id;
// The card a sticky note sits on (notes sit right above their card, at the same x).
const noteIn = (p, svg, note) => p.$eval(svg, (s, name) => {
  const n = [...s.querySelectorAll('.g-note')].find((e) => e.dataset.key === name);
  return n && [...s.querySelectorAll('.g-card')].find((c) => c.dataset.x === n.dataset.x)?.dataset.key;
}, note);

// A coach bubble (the tour, or a tip on a new button) can sit over a button. A real student clicks
// its own button to dismiss it; so does this. A tip on a new button says at most 10 words.
async function calm(p) {
  const btn = p.locator('#coach:not([hidden]) .bubble [data-coach]').last();
  if (!(await btn.count()) || !(await btn.isVisible())) return;
  if (await p.$eval('#coach', (c) => c.classList.contains('tip'))) {
    const tip = await textOf(p, '#coach .bubble-text');
    assert.ok(tip.split(/\s+/).length <= 10, `a tip says more than 10 words: "${tip}"`);
  }
  await btn.click({ timeout: 2000 }).catch(() => {});
}

async function click(p, sel, opts = {}) {
  const target = typeof sel === 'string' ? p.locator(sel).first() : sel;
  for (let i = 0; ; i++) {
    if (!String(sel).startsWith('#coach')) await calm(p);
    try {
      await target.click({ timeout: 2500, ...opts });
      return;
    } catch (err) {
      if (i >= 3) throw err;
    }
  }
}

// Click something that calls the API; check the student sees the server's words as a toast.
async function hit(p, selector, api, clickOpts = {}) {
  const [res] = await Promise.all([
    p.waitForResponse((r) => new URL(r.url()).pathname === `/api/${api}`),
    click(p, selector, clickOpts),
  ]);
  const json = await res.json();
  const words = json.ok ? json.result?.message : json.error;
  if (words) {
    assert.doesNotMatch(words, OLD_WORDS, 'a toast uses an old word');
    await sees(p, '#toasts', words, `${WHO.get(p)} sees the toast "${words}"`);
  }
  return json;
}
// Action-row buttons. Sentence buttons hold a dropdown, so press near the corner, on the words' side.
const press = (p, act) => hit(p, `#actions [data-act="${act}"]`, API[act], { position: { x: 10, y: 10 } });
const ok = (r, what) => { assert.ok(r.ok, `${what}: ${r.error}`); return r; };

async function pick(p, part, slug) {
  await click(p, `#draft [data-part="${part}"]`);
  const [res] = await Promise.all([
    p.waitForResponse((r) => /^\/api\/(draft|chaos)$/.test(new URL(r.url()).pathname)),
    click(p, `#popover [data-slug="${slug}"]`),
  ]);
  ok(await res.json(), `${WHO.get(p)}: ${part} → ${slug}`);
}

async function newNote(p, name) {
  await click(p, '#actions [data-act="branch"]', { position: { x: 10, y: 10 } });
  assert.equal(await p.inputValue('#popover input'), name, `${WHO.get(p)}: the note name is pre-filled`);
  return hit(p, '#popover button.primary', 'branch');
}

async function switchTo(p, note) {
  await p.selectOption('#actions select[data-pick="switch"]', note);
  ok(await press(p, 'switch'), `${WHO.get(p)}: switch to ${note}`);
  await sees(p, '#on-note', note);
}

// Merge and Send: the press opens the prediction dialog (unless this student already predicted in the panel,
// or Git already answered this merge); one tap on the guess runs Git. Checks the toast like hit().
// shot: a screenshot name, taken while the dialog is open.
async function predictPress(p, act, guess, { shot = null } = {}) {
  const api = `/api/${API[act]}`;
  const respond = () => p.waitForResponse((r) => new URL(r.url()).pathname === api);
  let res = respond();
  await click(p, `#actions [data-act="${act}"]`, { position: { x: 10, y: 10 } });
  let waiting = true;
  const asked = (async () => {
    while (waiting) { if (await dialogOpen(p, 'predict-dialog')) return 'asked'; await sleep(40); }
    return 'sent';
  })();
  let first = await Promise.race([res.then(() => 'sent'), asked]);
  waiting = false;
  let json = first === 'sent' ? await (await res).json() : null;
  if (json?.predict) { // the page was a moment behind: the server asks, the dialog opens
    await until(`${WHO.get(p)}'s prediction dialog opens`, () => dialogOpen(p, 'predict-dialog'));
    first = 'asked';
  }
  if (first === 'asked') {
    await sees(p, '#predict-dialog .eyebrow', /predict first/i);
    if (shot) await snap(p, shot);
    res = respond();
    await click(p, `#predict-dialog [data-guess="${guess}"]`);
    json = await (await res).json();
  }
  const words = json.ok ? json.result?.message : json.error;
  if (words) {
    assert.doesNotMatch(words, OLD_WORDS, 'a toast uses an old word');
    await sees(p, '#toasts', words, `${WHO.get(p)} sees the toast "${words}"`);
  }
  return json;
}
const send = (p, guess = 'accepted') => predictPress(p, 'push', guess);

// A lab-mate predicts the lab's next merge or send in the panel, before anyone presses.
async function predictInPanel(p, guess) {
  const chip = `#mission .predict-chips [data-guess="${guess}"]`;
  const [res] = await Promise.all([p.waitForResponse((r) => new URL(r.url()).pathname === '/api/predict'), click(p, chip)]);
  ok(await res.json(), `${WHO.get(p)}: predict ${guess}`);
  await until(`${WHO.get(p)}'s prediction is marked`, () => p.$eval(chip, (b) => b.classList.contains('on')));
}

async function mergeIn(p, note, guess, opts) {
  await p.selectOption('#actions select[data-pick="merge"]', note);
  return ok(await predictPress(p, 'merge', guess, opts), `${WHO.get(p)}: merge ${note}`);
}

async function deleteNote(p, note) {
  await p.selectOption('#actions select[data-pick="deleteNote"]', note);
  return press(p, 'deleteNote');
}

async function openCard(p, id, svg = '#graph') {
  await click(p, `${svg} .g-card[data-key="${id}"]`);
  await until(`${WHO.get(p)} opens card ${id.slice(0, 7)}`, () => dialogOpen(p, 'card-dialog'));
}
async function closeDialog(p, id) {
  await click(p, `#${id} [data-close]`);
  await until(`${WHO.get(p)}'s ${id} closes`, async () => !(await dialogOpen(p, id)));
}
const goalsDone = (p) => until(`${WHO.get(p)}: every goal ticks`, async () =>
  (await count(p, '#mission .goals li')) > 0 && (await count(p, '#mission .goals li:not(.done)')) === 0,
() => textOf(p, '#mission .goals'));

// "Stuck? Hint": it shows after HINT_DELAY. The first press shows the idea; "Show the exact click" shows the
// next click (bold and code marks are gone in the page). Returns the click.
async function hintOf(p) {
  await until(`${WHO.get(p)} sees Stuck? Hint`, async () => (await shown(p, '#mission .hint-btn')) || (await shown(p, '#mission .hint')),
    () => textOf(p, '#mission'));
  if (await shown(p, '#mission .hint-btn')) await click(p, '#mission .hint-btn');
  await until(`${WHO.get(p)} sees a hint`, () => shown(p, '#mission .hint'));
  if (await shown(p, '#mission .hint .more')) {
    const idea = await textOf(p, HINT_TEXT);
    assert.doesNotMatch(idea, OLD_WORDS, 'a hint uses an old word');
    await sees(p, '#mission .hint .label', /think about/i);
    await click(p, '#mission .hint .more');
    await until(`${WHO.get(p)} sees the exact click`, async () => !(await shown(p, '#mission .hint .more')) && (await textOf(p, HINT_TEXT)) !== idea);
  }
  const hint = await textOf(p, HINT_TEXT);
  assert.doesNotMatch(hint, OLD_WORDS, 'a hint uses an old word');
  return hint;
}
const hinted = (p, sel) => until(`${WHO.get(p)}: the hint rings ${sel}`, () => p.$eval(sel, (el) =>
  (el.closest('.act') ?? el).classList.contains('hinted')));

// Type an answer or a takeaway and press Enter: it is saved, and the page says so.
async function type(p, field, text) {
  const box = p.locator(`#qa [data-field="${field}"]`);
  await calm(p);
  await box.fill(text);
  const api = field.startsWith('a:') ? '/api/answer' : '/api/takeaway';
  const [res] = await Promise.all([p.waitForResponse((r) => new URL(r.url()).pathname === api), box.press('Enter')]);
  ok(await res.json(), `${WHO.get(p)}: ${field}`);
}

// The old theme's words never show: text, titles, labels and placeholders.
async function noOldWords(p, where) {
  const found = await p.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const texts = [document.title];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentElement.closest('script, style')) texts.push(n.nodeValue);
    for (const el of document.querySelectorAll('[title], [aria-label], [placeholder], [alt]')) {
      texts.push(el.getAttribute('title'), el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('alt'));
    }
    return texts.find((t) => t && re.test(t)) ?? null;
  }, OLD_WORDS.source);
  assert.equal(found, null, `${where}: ${WHO.get(p)}'s page says "${found}"`);
}

// Wait until nothing moves: cards, sticky notes, toasts and dialogs finish their animations
// (the hint's gentle nudge loops, so it never finishes).
async function still(p) {
  await sleep(200); // a refetch after the last click may still be on its way
  await p.waitForFunction(() => document.getAnimations()
    .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
}
const toastsFade = (p) => until(`${WHO.get(p)}'s toasts fade`, async () => !(await count(p, '#toasts .toast:not(.bad)')));
async function settle(p) {
  await p.evaluate(() => scrollTo(0, 0));
  await still(p);
}

// The same student on a phone: nothing may stick out sideways.
async function phoneShot(p, tag) {
  await toastsFade(p);
  await p.setViewportSize(PHONE);
  await settle(p); // the graphs redraw for the new width
  const wider = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(wider <= 0, `${tag}: the student page is ${wider}px wider than a 390px phone`);
  await p.screenshot({ path: `${SHOTS}/${tag}-mobile.png`, fullPage: true });
  await p.setViewportSize(DESKTOP);
  await settle(p);
}

async function snap(p, name) {
  await still(p);
  await p.screenshot({ path: `${SHOTS}/${name}.png` });
}

// ---------- The teacher, the projector, the class ----------

let admin = null;
let screen = null;
const S = {}; // student name → page
let LAB = {}; // lab id → names, in join order (pairs A, B, A)
let LEADS = []; // one student per lab, for the screenshots
let scene = 0;
const students = () => Object.values(S);
const labOf = (name) => Object.keys(LAB).find((id) => LAB[id].includes(name));
const tag = (n = scene) => `${String(n).padStart(2, '0')}-${SCENES[n].id}`; // the scene's screenshot name

// Nothing on the slide is cut off: the projector must read from the back of the room.
async function slideFits(where) {
  const worst = await screen.evaluate(() => {
    const box = document.getElementById('slide').getBoundingClientRect();
    let out = { by: 0, what: '' };
    for (const el of document.querySelectorAll('#slide .sl *')) {
      if (!el.getClientRects().length || el.closest('.sl-answers')) continue;
      const r = el.getBoundingClientRect();
      const by = Math.max(r.bottom - box.bottom, r.right - box.right, box.top - r.top, box.left - r.left);
      if (by > out.by) out = { by, what: `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''} "${(el.textContent ?? '').trim().slice(0, 40)}"` };
    }
    return out;
  });
  assert.ok(worst.by <= 1, `${where}: the projector cuts off ${worst.what} by ${Math.ceil(worst.by)}px`);
}

// The projector's card IDs in px as drawn: the Wall graph is scaled to fit the slide.
const projectorIdPx = () => screen.$eval('#slide [data-wall]', (svg) => {
  const box = svg.getBoundingClientRect();
  const { width, height } = svg.viewBox.baseVal;
  const id = svg.querySelector('.g-card text[font-family*="monospace"]');
  return Math.min(box.width / width, box.height / height) * Number(id.getAttribute('font-size'));
});

// One shot per scene: the console, the projector, and one student per lab. Every page is scanned for old words.
async function shoot(name = tag()) {
  const leads = LEADS.map((n) => S[n]);
  await Promise.all(leads.map(toastsFade));
  await Promise.all([...leads, admin, screen].map(settle));
  await slideFits(name);
  if (await count(screen, '#slide [data-wall] .g-card')) {
    const px = await projectorIdPx(); // at least 1.5% of the screen's height: 16px on a 1080p projector
    assert.ok(px >= PROJECTOR.height * 0.015, `${name}: the projector's card IDs are ${px.toFixed(1)}px high on a ${PROJECTOR.height}px screen`);
  }
  for (const p of [admin, screen, ...students()]) await noOldWords(p, name);
  await Promise.all([
    ...leads.map((p, i) => p.screenshot({ path: `${SHOTS}/${name}-lab${i + 1}.png`, fullPage: true })),
    admin.screenshot({ path: `${SHOTS}/${name}-console.png`, fullPage: true }),
    screen.screenshot({ path: `${SHOTS}/${name}-projector.png` }),
  ]);
}

// The technical cards as a page draws them: [{command, is, does, how}], in plain words. row: a selector, $ = the row.
const techCards = (p, card, cmd, row) => p.evaluate(([cardSel, cmdSel, rowSel]) => [...document.querySelectorAll(cardSel)].map((el) => {
  const read = (sel) => (el.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { command: read(cmdSel), is: read(rowSel.replace('$', 'is')), does: read(rowSel.replace('$', 'does')), how: read(rowSel.replace('$', 'how')) };
}), [card, cmd, row]);
const wantCards = (cards) => cards.map((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, plain(v)])));

// Every page shows scene n: the console, its preview, the projector, and every student.
async function arrive(n) {
  const s = SCENES[n];
  scene = n;
  await until(`the console shows "${s.title}"`, async () => (await admin.textContent('#scene-title')) === s.title,
    () => admin.textContent('#scene-title'));
  await until(`the projector shows the ${s.kind} slide`, () => shown(screen, `#slide .sl.kind-${s.kind}`));
  await until(`the console preview shows the ${s.kind} slide`, () => shown(admin, `#preview .sl.kind-${s.kind}`));
  const crumb = s.kind === 'join' ? 'Getting ready' : s.title;
  await Promise.all(students().map((p) => sees(p, '#crumbs', crumb)));
  const following = SCENES[n + 1];
  await sees(admin, '#next', following ? `Next: ${following.title}` : 'Last scene');
  if (following) await sees(admin, '#coming-title', following.title);
  // Private lines stay on the teacher's laptop.
  const slide = await textOf(screen, '#slide');
  for (const secret of [s.do, s.ask?.a].filter(Boolean)) assert.ok(!slide.includes(secret), `${s.id}: the projector shows "${secret}"`);
  if (s.ask) await sees(admin, '#ask-q', s.ask.q);

  if (s.kind === 'reveal') {
    const { cards, sentence, behind, note } = s.reveal;
    // One technical card per tool, word for word, in the app and on the projector (and its preview).
    const want = wantCards(cards);
    for (const p of LEADS.map((name) => S[name])) {
      const drawn = () => techCards(p, '#reveal .tech', '.tech-cmd', 'dd.$');
      await until(`${WHO.get(p)} sees the technical cards of ${s.id}`, async () => isDeepStrictEqual(await drawn(), want),
        async () => JSON.stringify(await drawn()));
      if (sentence) await sees(p, '#reveal .reveal-sentence', sentence);
      if (behind) await sees(p, '#reveal .reveal-behind', plain(behind));
      if (note) await sees(p, '#reveal .tech-note', plain(note));
      await sees(p, '#qa .qa-q', s.ask.q);
    }
    for (const page of [screen, admin]) {
      const root = page === screen ? '#slide' : '#preview';
      assert.deepEqual(await techCards(page, `${root} .sl-card`, '.sl-cmd', `.sl-row.$ dd`), want, `${s.id}: the slide's technical cards`);
    }
    if (sentence) assert.equal(await textOf(screen, '.sl-sentence'), sentence);
    if (behind) await sees(screen, '.sl-behind', plain(behind));
    if (note) assert.equal(await textOf(screen, '.sl-trust'), plain(note));
    await sees(screen, '.sl-ask', s.ask.q);
  }
  if (s.kind === 'paper') {
    assert.equal(PAPER.message, 'For analysts, flat history is data loss.');
    for (const p of students()) await sees(p, '#scene-body .paper-message', PAPER.message);
    await sees(S[LEADS[0]], '#scene-body .paper-tradeoff', PAPER.tradeoff);
    for (const line of PAPER.lived) await sees(S[LEADS[0]], '#scene-body .lived', line.text);
    assert.equal(await textOf(screen, '.sl-message'), PAPER.message);
    assert.equal(await textOf(screen, '.sl-tradeoff'), PAPER.tradeoff);
    for (const line of PAPER.lived) await sees(screen, '.sl-lived', line.text);
    for (const col of [...PAPER.good, ...PAPER.bad, ...PAPER.ugly]) await sees(screen, '.sl-cols', col);
  }
  if (s.kind === 'exit') {
    for (const p of LEADS.map((name) => S[name])) await sees(p, '#scene-body .exit-q', s.ask.q);
    await sees(screen, '.sl-question', s.ask.q);
  }
}

// Next and Back ignore a second press within 400 ms (a clicker's double tap); a teacher is never that quick.
let lastMove = 0;
const settleMove = () => sleep(Math.max(0, lastMove + 450 - Date.now()));

async function next(how = 'button') {
  await settleMove();
  if (how === 'button') await click(admin, '#next');
  else if (how === 'projector key') await screen.keyboard.press('ArrowRight');
  else if (how === 'space') { await admin.focus('#next'); await admin.keyboard.press(' '); }
  await arrive(scene + 1);
  lastMove = Date.now();
}

async function back() {
  await settleMove();
  await click(admin, '#back');
  await arrive(scene - 1);
  lastMove = Date.now();
}

// Some students answer the scene's question (it is optional); the console counts them live.
// show: Show answers puts them on the projector, names hidden unless the teacher ticks "with names";
// a shot of that slide, then Hide answers brings the scene's slide back.
async function answer(id, { show = false, names = false } = {}) {
  const field = `a:${id}`;
  const who = NAMES.slice(scene % 6, scene % 6 + 4); // a different four each time
  for (const [i, name] of who.entries()) await type(S[name], field, ANSWERS[id][i]);
  await sees(admin, '#answers-count', `${who.length}/${students().length} answered`);
  for (const text of ANSWERS[id]) await sees(admin, '#answers-list', text);
  if (!show) return;
  await click(admin, '#answers-show');
  await until('the projector shows the answers', () => shown(screen, '#slide .sl.kind-answers'));
  for (const text of ANSWERS[id]) await sees(screen, '.sl-answers', text);
  assert.equal(await count(screen, '.sl-answers b'), 0, 'names are hidden by default');
  if (names) {
    await click(admin, '#answers-names');
    await sees(screen, '.sl-answers b', NAMES[scene % 6]);
  }
  await still(screen);
  await screen.screenshot({ path: `${SHOTS}/${tag()}-answers-projector.png` });
  if (names) {
    await click(admin, '#answers-names');
    await until('names leave the projector', async () => !(await count(screen, '.sl-answers b')));
  }
  await click(admin, '#answers-show');
  await sees(admin, '#answers-show', 'Show answers on projector');
  await until('the projector is back on the scene', () => shown(screen, `#slide .sl.kind-${SCENES[scene].kind}`));
}

// Everyone writes a takeaway at each step's reveal: "My Git in 7 lines".
async function takeaways(step) {
  await Promise.all(NAMES.map((name, i) => type(S[name], `t:${step}`, TAKEAWAYS[step][i % 3])));
  await sees(admin, '#takeaways', `Takeaways written: ${NAMES.length}/`);
}

// Stop the server mid-session, leave a stale lock behind (a kill mid-update-ref does that), start again.
async function restart() {
  quiet = true;
  await stopServer();
  await until(`${LEADS[0]} sees the grey "reconnecting" dot`, () => shown(S[LEADS[0]], '#crumbs .lab-dot.offline'));
  const lock = path.join(dataDir, 'labs', '1', '.git', 'refs', 'heads', 'main.lock');
  fs.writeFileSync(lock, '');
  await startServer();
  assert.ok(!fs.existsSync(lock), 'the server removes stale lock files on boot');
  await Promise.all(students().map((p) => until(`${WHO.get(p)} reconnects`, async () => !(await shown(p, '#crumbs .lab-dot.offline')))));
  await until('the console reconnects', async () => !(await admin.$eval('#conn', (e) => e.classList.contains('off'))));
  await sleep(500);
  quiet = false;
}

// Follow "Stuck? Hint" and nothing else: each hint's click names one concrete move, or two ways to choose from
// (way: Step 4, 'merge' | 'rebase'; undo: Step 5, 'revert' | 'reset'). Each send is predicted (guess). Returns the refusals met.
async function followHints(p, { moves = Infinity, way = 'merge', undo = 'revert', guess = 'accepted' } = {}) {
  const refusals = [];
  for (let i = 0; i < moves; i++) {
    if (await shown(p, '#mission .done-box')) return refusals;
    const hint = await hintOf(p);
    const intern = async () => (await cardsIn(p, '#graph')).find((c) => c.author === 'The Intern' && !c.dashed);
    let m;
    let r = null;
    if ((m = /^Click change on (HAT|GLASSES|TOP|SHOES)\. Pick \S+ (.+)\.$/.exec(hint))) {
      const part = m[1].toLowerCase();
      await hinted(p, `#draft [data-part="${part}"]`);
      await pick(p, part, palette(SCENES[scene].step)[part].find((slug) => nameOf(slug) === m[2]));
    } else if (hint === 'Press Save card.') {
      await hinted(p, '#actions [data-act="commit"]');
      r = await press(p, 'commit');
    } else if (hint === 'Press Send to Wall.') {
      await hinted(p, '#actions [data-act="push"]');
      r = await send(p, guess);
    } else if (/^Pick a way: press Get & combine \(merge\) or Replay on top \(rebase\)\. Then Send to Wall again\.$/.test(hint)) {
      await hinted(p, '#actions [data-act="pull"]');
      await hinted(p, '#actions [data-act="rebase"]');
      r = await press(p, way === 'merge' ? 'pull' : 'rebase');
    } else if (/^Press Get & combine\./.test(hint)) {
      await hinted(p, '#actions [data-act="pull"]');
      r = await press(p, 'pull');
    } else if (/^Press Replay on top\./.test(hint)) {
      await hinted(p, '#actions [data-act="rebase"]');
      r = await press(p, 'rebase');
    } else if ((m = /^Press Delete sticky note and pick (\S+)\.$/.exec(hint))) {
      await hinted(p, '#actions [data-act="deleteNote"]');
      assert.equal(await p.inputValue('#actions select[data-pick="deleteNote"]'), m[1], 'the hint picked the note in the dropdown');
      r = await press(p, 'deleteNote');
    } else if (/^Click the 🥸 card\. Press Undo this card\.$/.test(hint) || (/Undo this card, or click the card right before it and press Move my note back here\.$/.test(hint) && undo === 'revert')) {
      await hinted(p, '#graph-scroll');
      await openCard(p, (await intern()).id);
      r = await hit(p, '#card-dialog [data-card-act="revert"]', 'revert');
    } else if ((m = /^Press Switch to and pick (\S+)\.$/.exec(hint))) {
      await hinted(p, '#actions [data-act="switch"]');
      r = await press(p, 'switch');
      assert.equal(await textOf(p, '#on-note .note-chip'), m[1], 'the hint picked the note in the dropdown');
    } else {
      throw new Error(`${WHO.get(p)} got a hint the class cannot follow: "${hint}"`);
    }
    if (r && !r.ok) refusals.push(r.error);
    await until(`${WHO.get(p)}'s hint moves on from "${hint}"`, async () => (await shown(p, '#mission .done-box'))
      || (await textOf(p, HINT_TEXT)) !== hint);
  }
  return refusals;
}

async function joinByName(p, name) {
  await p.fill('#join-name', name);
  await click(p, '#join-form button[type=submit]');
  await sees(p, '#crumbs', `· ${name} ·`);
}

// ---------- Run 1: a class of 9 ----------

async function classRun() {
  assert.deepEqual(SCENES.map((s) => s.id), ORDER, 'the scene script walks the 7 steps in order');
  assert.deepEqual(STEPS.map((s) => s.title), TITLES, "the steps' titles");
  assert.deepEqual(Object.fromEntries(SCENES.filter((s) => s.kind === 'reveal').map((s) => [s.id, s.reveal.cards])), {
    'reveal-0': [], 'reveal-1': [CARDS.commit], 'reveal-2': [CARDS.branch], 'reveal-3': [CARDS.merge],
    'reveal-4': [CARDS.push, CARDS.rebase], 'reveal-5': [CARDS.undo], 'reveal-6': [CARDS.squash],
  }, 'one technical card per tool, at its reveal');
  admin = await open('Teacher', `/admin?key=${KEY}`);
  await until('the console drops the key from the address bar', () => admin.url() === `${BASE}/admin`, () => admin.url());
  const [popup] = await Promise.all([admin.waitForEvent('popup'), click(admin, '#present')]);
  screen = watch(popup, 'Projector');
  await screen.setViewportSize(PROJECTOR);
  await until('Start presenting opens the projector page, and the key leaves its address bar', () => screen.url() === `${BASE}/screen`, () => screen.url());
  await until('the projector shows the join slide', () => shown(screen, '#slide .sl.kind-join'));
  await sees(admin, '#scene-pos', new RegExp(`^Scene 1 of ${ORDER.length} `, 'i'));
  for (const name of NAMES) S[name] = await open(name, '/');

  // ---------- Join: name only; the app balances the labs ----------
  const first = S[NAMES[0]];
  await sees(first, '#join .lede', TAGLINE);
  assert.equal(await first.getAttribute('#join .join-thu a', 'href'), '/thu', "a quiet link for Thursday's class");
  await settle(first);
  await first.screenshot({ path: `${SHOTS}/00-join-student.png`, fullPage: true });
  await phoneShot(first, '00-join');
  await click(first, '#join-form button[type=submit]');
  await sees(first, '#join-error', 'Type your name (a letter or digit).');
  const labsAfter = {};
  for (const [i, name] of NAMES.entries()) {
    const p = S[name];
    await joinByName(p, name);
    // The tour: two bubbles in Step 0 (nothing to save yet). Dismissed with real clicks.
    await sees(p, '#coach .bubble-text', "This is your lab's outfit. Everyone in your lab shares it.");
    await sees(p, '#coach .bubble-count', '1 of 2');
    if (i % 2) {
      await click(p, '#coach [data-coach="skip"]');
    } else {
      await click(p, '#coach [data-coach="next"]');
      await sees(p, '#coach .bubble-text', 'Click change to pick a new hat, glasses, top, or shoes.');
      await sees(p, '#coach [data-coach="next"]', 'Done');
      if (i === 0) await snap(p, '00-join-tour-student');
      await click(p, '#coach [data-coach="next"]');
    }
    await until(`${name}'s tour closes`, async () => !(await shown(p, '#coach')));
    const st = await adminState();
    labsAfter[i + 1] = [...st.labs.filter((l) => !l.practice).map((l) => l.members.length).sort((a, b) => b - a),
      ...st.labs.filter((l) => l.practice).map((l) => `P${l.members.length}`)].join(',');
  }
  // About 4 per lab, and never a lab of 1 next to another lab.
  const sizes = { 1: '1,P0', 2: '2,P0', 3: '3,P0', 4: '2,2', 5: '3,2', 6: '3,3', 7: '4,3', 8: '4,4', 9: '3,3,3' };
  for (const [n, want] of Object.entries(sizes)) assert.equal(labsAfter[n], want, `${n} people: labs of ${want}`);
  const st = await adminState();
  LAB = Object.fromEntries(st.labs.map((l) => [l.id, l.members.map((m) => m.name)]));
  for (const lab of st.labs) {
    assert.deepEqual(lab.members.map((m) => m.pair), ['A', 'B', 'A'], `${lab.name}: pairs alternate by join order`);
    for (const name of LAB[lab.id]) await sees(S[name], '#crumbs', `${lab.name} · ${name}`);
  }
  LEADS = Object.values(LAB).map((names) => names[0]);
  log('labs:', Object.entries(LAB).map(([id, names]) => `Lab ${id}: ${names.join(', ')}`).join(' · '));
  await sees(admin, '#people', '9 people · 9 online');
  for (const [id, names] of Object.entries(LAB)) await sees(screen, '.sl-roster', new RegExp(`Lab ${id}\\s*${names.join(', ')}`));
  assert.equal(await count(admin, '#labs .tile'), 3, 'one tile per lab on the console');
  assert.equal(await admin.$eval('#details', (d) => d.open), false, 'Details start folded');
  // The console's Join QR shows on the projector too.
  await click(admin, '#join-qr');
  await until('the projector shows the big QR', () => shown(screen, '#qr'));
  await click(admin, '#qr-dialog button');
  await until('the projector hides the QR', async () => !(await shown(screen, '#qr')));
  await arrive(0);
  await shoot();
  checkClean('Join');
  log('join: 9 names, 3 balanced labs, pairs A/B/A, tours dismissed');

  // ---------- Step 0: one shared outfit per lab, live, no history ----------
  await next();
  const [a1, b1, c1] = LAB[1];
  await pick(S[a1], 'hat', 'helmet');
  await sees(S[b1], '#draft [data-part="hat"]', 'helmet');
  await pick(S[b1], 'shoes', 'sandals');
  await sees(S[a1], '#draft [data-part="shoes"]', 'sandals');
  await sees(screen, '.sl-lab:first-child .fig', '🩴');
  await sees(admin, '#labs .tile:first-child .fig', '🩴');
  assert.match(await textOf(S[LAB[2][0]], '#draft [data-part="shoes"]'), /sneakers/, "Lab 2's outfit is its own");
  await pick(S[LAB[2][1]], 'top', 'vest');
  await pick(S[LAB[3][2]], 'glasses', 'monocle');
  await click(S[c1], '#draft [data-part="hat"]');
  assert.equal(await count(S[c1], '#popover [data-slug="tophat"]'), 0, 'the top hat only appears in Step 2');
  await S[c1].keyboard.press('Escape');
  assert.equal(await hintOf(S[c1]), 'Click change on any part. Pick a new one.');
  await hinted(S[c1], '#draft');
  for (const lab of Object.keys(LAB)) assert.equal(gitIn(lab, 'rev-list', '--all', '--count'), '1', `Lab ${lab} has only the Start card`);
  assert.ok(!(await shown(S[a1], '#table')) && !(await shown(S[a1], '#actions')), 'Step 0 shows no cards and no buttons');
  await shoot();
  checkClean('Step 0');
  log('step 0: a shared live outfit, no history, a hint');

  await next();
  await answer('reveal-0');
  await takeaways(0);
  await shoot();
  checkClean('Reveal 0');

  // ---------- Step 1: everyone saves; the graph is a chain with authors ----------
  await next();
  // The new button's tip, then the next one; each goes on a real click.
  await sees(S[a1], '#coach .bubble-text', 'New: Save card keeps this outfit, with your name.');
  await click(S[a1], '#coach [data-coach="ok"]');
  await sees(S[a1], '#coach .bubble-text', 'Click any card to see what Git stored.');
  await click(S[a1], '#mission h1');
  await until(`${a1}'s tips are gone`, async () => !(await shown(S[a1], '#coach')));
  assert.equal(await hintOf(S[c1]), 'Click change on one part. Pick a new one. Then press Save card.');
  const CHANGES = [['hat', 'sunhat', 'HAT: cap → sunhat'], ['glasses', 'goggles', 'GLASSES: round → goggles'], ['top', 'coat', 'TOP: tshirt → coat']];
  await Promise.all(Object.values(LAB).map(async (names) => {
    for (const [i, name] of names.entries()) { // inside a lab, people take turns
      await pick(S[name], CHANGES[i][0], CHANGES[i][1]);
      await sees(S[name], '#draft-status', '1 part not saved yet');
      const r = ok(await press(S[name], 'commit'), `${name}: Save card`);
      assert.match(r.result.message, /^Saved card [0-9a-f]{7}\.$/);
      await sees(S[name], '#draft-status', 'All saved');
      if (i === 0 && name === a1) assert.equal(await hintOf(S[a1]), `You saved. Waiting for ${b1} and ${c1}.`);
    }
  }));
  for (const [lab, names] of Object.entries(LAB)) {
    const p = S[names[0]];
    const cards = await until(`Lab ${lab} shows 4 cards`, async () => { const c = await cardsIn(p, '#graph'); return c.length === 4 && c; });
    assert.deepEqual(cards.map((c) => c.author), ['Outfit Lab', ...names], `Lab ${lab}: authors, oldest first`);
    assert.deepEqual(cards.map((c) => c.message), ['Start', ...CHANGES.map((c) => c[2])], `Lab ${lab}: automatic messages`);
    const chain = gitIn(lab, 'log', '--reverse', '--format=%H %P', 'refs/heads/main').split('\n').map((l) => l.trim().split(' '));
    chain.forEach(([id, ...parents], i) => {
      assert.equal(id, cards[i].id, `Lab ${lab}: card ${i} in the graph is Git's`);
      assert.deepEqual(parents, i ? [chain[i - 1][0]] : [], `Lab ${lab}: each card points to the one before`);
    });
    assert.equal(await count(p, '#graph .g-edges path'), 3, `Lab ${lab}: 3 arrows`);
    await sees(p, '#mission .goals li.done', 'Everyone saved a card (3/3)');
    await sees(p, '#mission .done-line', DONE_LINE);
    await sees(p, '#mission .bonus', 'Show what Git stored');
  }
  const nothing = await press(S[a1], 'commit');
  assert.equal(nothing.result.message, 'Nothing changed. Click change on a part first.');
  const startId = (await cardsIn(S[a1], '#graph'))[0].id;
  await openCard(S[a1], startId);
  await sees(S[a1], '#card-dialog .facts', 'None. This is the Start card.');
  await click(S[a1], '#card-dialog .stored summary');
  await sees(S[a1], '#card-dialog .stored-body', /tree [0-9a-f]{40}/);
  await closeDialog(S[a1], 'card-dialog');
  // "?" replays the tour: four bubbles now.
  const kim = S[LAB[3][1]];
  await click(kim, '#tour-again');
  await sees(kim, '#coach .bubble-count', '1 of 4');
  for (const text of ["This is your lab's outfit.", 'Click change to pick', 'Save card keeps this exact outfit, with your name.',
    'Every saved card lives here. Each one points back to the one before.']) {
    await sees(kim, '#coach .bubble-text', text);
    await click(kim, '#coach [data-coach="next"]');
  }
  await until('the replayed tour closes', async () => !(await shown(kim, '#coach')));
  // The question goes on the projector, and the task panel says so.
  await click(admin, '#ask-show');
  await sees(screen, '#slide .sl.kind-question .sl-question', SCENES[scene].ask.q);
  await sees(S[LAB[3][0]], '#mission .ask.on', SCENES[scene].ask.q);
  await sees(admin, '#ready', 'Labs done: 3/3');
  await phoneShot(S[a1], tag());
  await shoot();
  checkClean('Step 1');
  log('step 1: 4 cards per lab, a chain with authors, nothing to save, tips, hints, tour replay, Ask on the projector');

  await next();
  assert.equal(await count(screen, '#slide .sl.kind-question'), 0, 'Next takes the question down');
  assert.equal(SCENES[scene].reveal.note, TRUST_LINE, 'Step 1: Git trusts your name and clock');
  await answer('reveal-1', { show: true });
  await takeaways(1);
  // Back, then Next again: answers stay.
  await back();
  await next();
  await sees(admin, '#answers-count', '4/9 answered');
  await shoot();
  checkClean('Reveal 1');

  // ---------- Step 2: main is read-only; two sticky notes from main ----------
  await next('projector key'); // a clicker on the projector window
  await sees(S[a1], '#coach .bubble-text', 'New: sticky notes. Try an idea without touching main.');
  await click(S[a1], '#draft [data-part="hat"]');
  await sees(S[a1], '#toasts', MAIN_LOCKED);
  assert.ok(!(await shown(S[a1], '#popover')), 'no palette on main in Step 2');
  await sees(S[a1], '#draft-status', MAIN_LOCKED);
  await sees(S[b1], '#mission .mission-box', "You're in Pair B, on your own"); // a pair of one: the solo mission
  assert.doesNotMatch(await textOf(S[b1], '#mission .mission-box'), /The other/);
  assert.equal(await hintOf(S[b1]), 'Press New sticky note. Name it sporty.');
  await hinted(S[b1], '#actions [data-act="branch"]');
  await click(S[c1], '#mission [data-pair]');
  await sees(S[c1], '#mission .mission-box', /sporty.*Pair B/);
  await click(S[c1], '#mission [data-pair]');
  await sees(S[c1], '#mission .mission-box', /fancy.*Pair A/);
  await Promise.all(Object.entries(LAB).map(async ([lab, [a, b, c]]) => {
    ok(await newNote(S[a], 'fancy'), `${a}: new sticky note`);
    await sees(S[a], '#on-note', 'fancy');
    assert.equal(tipIn(lab, 'fancy'), tipIn(lab, 'main'), `Lab ${lab}: fancy starts on main's card`);
    const twice = await newNote(S[c], 'fancy');
    assert.equal(twice.error, 'fancy already exists. Press Switch to join it.');
    await S[c].keyboard.press('Escape');
    await switchTo(S[c], 'fancy');
    await pick(S[a], 'hat', 'tophat');
    await sees(S[c], '#draft [data-part="hat"]', new RegExp(`top hat.*changed by ${a}.*not saved`)); // one shared draft per note
    if (lab === '1') { // Git keeps one working copy: Switch will not leave unsaved parts behind
      await S[a].selectOption('#actions select[data-pick="switch"]', 'main');
      assert.equal((await press(S[a], 'switch')).error, SWITCH_UNSAVED);
      assert.equal(await textOf(S[a], '#on-note .note-chip'), 'fancy', `${a} is still on fancy`);
    }
    await pick(S[c], 'top', 'tie');
    const saved = ok(await press(S[c], 'commit'), `${c}: save fancy`);
    assert.match(saved.result.message, new RegExp(`It includes ${a}'s HAT\\.$`), `${c}'s save names ${a}'s change`);
    ok(await newNote(S[b], 'sporty'), `${b}: new sticky note`);
    assert.equal(tipIn(lab, 'sporty'), tipIn(lab, 'main'), `Lab ${lab}: sporty starts on main's card`);
    await pick(S[b], 'top', 'jersey');
    await pick(S[b], 'shoes', 'boots');
    ok(await press(S[b], 'commit'), `${b}: save sporty`);
  }));
  for (const name of LEADS) {
    await goalsDone(S[name]);
    await sees(S[name], '#mission .goals', 'fancy has 🎩 + 👔');
    await sees(S[name], '#mission .goals', 'sporty has 🎽 + 🥾');
  }
  for (const note of ['main', 'fancy', 'sporty']) assert.ok(await noteIn(S[a1], '#graph', note), `${a1} sees the ${note} note`);
  await S[c1].reload(); // a refresh keeps who you are and where your pin is
  await sees(S[c1], '#crumbs', `Lab 1 · ${c1} · Step 2`);
  await sees(S[c1], '#on-note', 'fancy');
  // A new browser: the same name, typed again, gets the same place back.
  quiet = true;
  await S[c1].context().close();
  WHO.delete(S[c1]);
  quiet = false;
  await sees(admin, '#people', '9 people · 8 online');
  S[c1] = await open(c1, '/');
  await joinByName(S[c1], c1);
  await click(S[c1], '#coach [data-coach="skip"]');
  await sees(S[c1], '#crumbs', `Lab 1 · ${c1} · Step 2`);
  await sees(S[c1], '#on-note', 'fancy');
  await sees(admin, '#people', '9 people · 9 online');
  await shoot();
  checkClean('Step 2');
  log('step 2: main read-only, fancy + sporty from main, "already exists", hints, a refresh and a new browser keep identity');

  await next();
  await answer('reveal-2');
  await takeaways(2);
  await shoot();
  checkClean('Reveal 2');

  // ---------- Step 3: fast-forward fancy, delete its note, then a TOP-only conflict; cancel; a second student finishes ----------
  await next('space');
  await sees(S[a1], '#mission .fixed-line', FIXED_LINE);
  await sees(S[a1], '#actions', 'Switch to main first');
  const c3 = S[LAB[3][2]];
  assert.equal(await hintOf(c3), 'Press Switch to and pick main.');
  assert.deepEqual(await followHints(c3, { moves: 1 }), []);
  await Promise.all(students().filter((p) => p !== c3).map(async (p) => ok(await press(p, 'tomain'), `${WHO.get(p)}: back to main`)));
  await Promise.all(students().map((p) => sees(p, '#on-note', 'main')));

  // The resolver's per-part view must say exactly what Git's conflict markers say.
  async function resolverIsGit(p, lab) {
    await until(`${WHO.get(p)}'s resolver opens`, () => dialogOpen(p, 'resolver-dialog'));
    const view = await p.$eval('#resolver-dialog', (d) => ({
      conflicts: [...d.querySelectorAll('.rrow.conflict')].map((r) => [r.querySelector('.pname').textContent.toLowerCase(),
        [...r.querySelectorAll('.opt[data-slug]')].map((o) => o.dataset.slug)]),
      auto: [...d.querySelectorAll('.rrow.auto')].map((r) => r.querySelector('.pname').textContent.toLowerCase()),
      text: d.querySelector('.conflict-text').textContent,
      finish: d.querySelector('[data-finish]').disabled,
    }));
    const tree = gitIn(lab, 'merge-tree', '--write-tree', 'main', 'sporty').split('\n')[0];
    const gitText = gitIn(lab, 'cat-file', '-p', `${tree}:outfit.txt`);
    assert.equal(view.text.trim(), gitText, `Lab ${lab}: the resolver shows Git's own outfit.txt`);
    const marked = [...gitText.matchAll(/^<{7} main\n(\w+): (\S+)\n={7}\n\w+: (\S+)\n>{7} sporty$/gm)].map(([, part, ours, theirs]) => [part, [ours, theirs]]);
    const clean = gitText.replace(/^<{7}[\s\S]*?^>{7}.*$/gm, '').match(/^\w+: \S+$/gm).map((l) => l.split(': '));
    assert.deepEqual(view.conflicts, marked, `Lab ${lab}: conflicted parts and sides = Git's markers`);
    assert.deepEqual(marked, [['top', ['tie', 'jersey']]], 'only TOP conflicts: shirt & tie vs jersey');
    assert.deepEqual(clean.filter(([part]) => ['hat', 'shoes'].includes(part)), [['hat', 'tophat'], ['shoes', 'boots']],
      'HAT and SHOES combine on their own');
    assert.deepEqual(view.auto, ['hat', 'glasses', 'shoes'], 'the resolver ticks every part but TOP');
    assert.equal(view.finish, true, 'Finish merge waits for a choice');
  }
  // Merge fancy, predicted first: only main's note slides (a fast-forward). The mission then asks to delete the fancy note.
  async function fastForward(p, lab, guess, opts) {
    const fancy = tipIn(lab, 'fancy');
    assert.equal(await count(p, '#actions [data-act="deleteNote"]'), 0, `Lab ${lab}: no note to delete before a merge`);
    const r = await mergeIn(p, 'fancy', guess, opts);
    assert.equal(r.result.fastForward, true, `Lab ${lab}: fancy is a fast-forward`);
    await sees(p, '#mission .verdict', guess === 'ff' ? 'You predicted: fast-forward. Git: fast-forward. ✓'
      : 'Git: fast-forward. Why: main had no new card since the split, so Git only slid its note.');
    assert.equal(tipIn(lab), fancy);
    await sees(p, '#behind-body .last', 'Merge fancy into main → fast-forward');
    await sees(p, '#mission .mission-box', 'Delete the fancy note (git branch -d fancy).');
    return fancy;
  }
  // git branch -d: the note goes, its cards stay in main. No card says which cards were made on fancy.
  async function deleted(p, lab, fancyCard) {
    await until(`Lab ${lab}: the fancy note is gone`, () => !notesIn(lab).includes('fancy'));
    assert.deepEqual(notesIn(lab), ['main', 'sporty'], `Lab ${lab}: main and sporty are left`);
    assert.ok(inHistory(lab, fancyCard), `Lab ${lab}: fancy's card is still in main`);
    await until(`${WHO.get(p)} sees no fancy note`, async () => !(await noteIn(p, '#graph', 'fancy')));
    await sees(p, '#mission .goals li.done', 'The fancy note is deleted');
    await notSees(p, '#mission', 'Delete the fancy note', `${WHO.get(p)}: the mission goes with the note`);
  }
  async function finish(p) {
    const r = ok(await hit(p, '#resolver-dialog [data-finish]', 'resolve'), `${WHO.get(p)}: finish merge`);
    assert.equal(r.result.parents.length, 2, 'the merge card has two parents');
    await until(`${WHO.get(p)}'s resolver closes`, async () => !(await dialogOpen(p, 'resolver-dialog')));
    return r;
  }
  const [a2, b2] = LAB[2];
  const [a3, b3] = LAB[3];
  await Promise.all([
    (async () => { // Lab 1: lab-mates predict in the panel; only fancy can be deleted; the next student finishes the merge.
      await sees(S[b1], '#mission .predict-box', 'Before your lab merges fancy into main: What will Git do?');
      await predictInPanel(S[b1], 'ff');
      await predictInPanel(S[c1], 'clean');
      await phoneShot(S[c1], `${tag()}-predict`);
      const fancy = await fastForward(S[a1], '1', 'ff', { shot: `${tag()}-predict-dialog-lab1` });
      await sees(S[b1], '#mission .verdict.right', 'You predicted: fast-forward. Git: fast-forward. ✓');
      await sees(S[c1], '#mission .verdict.wrong', 'You predicted: merge, no conflict. Git: fast-forward. Why: main had no new card since the split');
      await sees(S[b1], '#mission .predict-box', 'Before your lab merges sporty into main');
      assert.equal(await hintOf(S[a1]), 'Press Delete sticky note and pick fancy.');
      await hinted(S[a1], '#actions [data-act="deleteNote"]');
      assert.deepEqual(await S[a1].$$eval('#actions select[data-pick="deleteNote"] option', (os) => os.map((o) => o.value)), ['fancy'],
        'Delete offers only a note whose card main has: sporty is not merged yet');
      const gone = ok(await deleteNote(S[a1], 'fancy'), `${a1}: delete fancy`);
      assert.equal(gone.result.message, 'Deleted the fancy note. Its cards stay.');
      await deleted(S[a1], '1', fancy);
      await sees(S[a1], '#behind-body', 'git branch -d fancy');
      assert.equal((await mergeIn(S[a1], 'sporty', 'conflict:top')).result.conflict, true);
      await resolverIsGit(S[a1], '1');
      await sees(S[a1], '#resolver-dialog .verdict.right', 'You predicted: conflict on TOP. Git: conflict on TOP. ✓');
      await snap(S[a1], `${tag()}-resolver-lab1`);
      await sees(S[b1], '#banner', 'Merging sporty into main. TOP needs a choice.');
      await phoneShot(S[b1], tag());
      await click(S[b1], '#banner [data-open-resolver]');
      await click(S[b1], '#resolver-dialog [data-choose="top"][data-slug="tie"]');
      await finish(S[b1]);
      await until(`${a1}'s resolver closes too`, async () => !(await dialogOpen(S[a1], 'resolver-dialog')));
      assert.equal(gitIn('1', 'rev-list', '--parents', '-n', '1', 'refs/heads/main').split(' ').length, 3);
      await openCard(S[a1], tipIn('1'));
      await sees(S[a1], '#card-dialog .facts', 'Parents');
      assert.equal(await count(S[a1], '#card-dialog .facts .id-chip'), 2, 'card details list two parents');
      await closeDialog(S[a1], 'card-dialog');
    })(),
    (async () => { // Lab 2: deletes fancy by its hint; the lead cancels the merge; the next student merges again, another top.
      const fancy = await fastForward(S[a2], '2', 'clean');
      assert.deepEqual(await followHints(S[a2], { moves: 1 }), []);
      await deleted(S[a2], '2', fancy);
      const before = tipIn('2');
      assert.equal((await mergeIn(S[a2], 'sporty', 'conflict:top')).result.conflict, true);
      await resolverIsGit(S[a2], '2');
      ok(await hit(S[a2], '#resolver-dialog [data-abort]', 'abort'), `${a2}: cancel merge`);
      assert.equal(tipIn('2'), before, 'Cancel merge leaves main unchanged');
      await until('the banner goes', async () => !(await shown(S[b2], '#banner')));
      assert.equal(await noteIn(S[a2], '#graph', 'main'), before);
      // Merging again after Cancel asks nothing: Git already answered this merge.
      assert.equal((await mergeIn(S[b2], 'sporty', 'ff')).result.conflict, true);
      assert.equal(await dialogOpen(S[b2], 'predict-dialog'), false);
      await until(`${b2}'s resolver opens`, () => dialogOpen(S[b2], 'resolver-dialog'));
      await click(S[b2], '#resolver-dialog [data-another="top"]');
      await click(S[b2], '#resolver-dialog .choices [data-choose="top"][data-slug="blouse"]');
      await finish(S[b2]);
    })(),
    (async () => { // Lab 3: the lead merges and deletes fancy, the next student finishes from the banner.
      const fancy = await fastForward(S[a3], '3', 'ff');
      ok(await deleteNote(S[a3], 'fancy'), `${a3}: delete fancy`);
      await deleted(S[a3], '3', fancy);
      assert.equal((await mergeIn(S[a3], 'sporty', 'clean')).result.conflict, true);
      await sees(S[a3], '#resolver-dialog .verdict.wrong', 'You predicted: merge, no conflict. Git: conflict on TOP. Why: TOP changed on both sides');
      await click(S[a3], '#resolver-dialog [data-close]');
      await click(S[b3], '#banner [data-open-resolver]');
      await click(S[b3], '#resolver-dialog [data-choose="top"][data-slug="jersey"]');
      await finish(S[b3]);
    })(),
  ]);
  for (const name of LEADS) await goalsDone(S[name]);
  await sees(admin, '#ready', 'Labs done: 3/3');
  const ACCURACY_3 = 'Predicted right: 5 of 8 · merge fancy 3/5 · merge sporty 2/3';
  await sees(admin, '#predictions', ACCURACY_3);
  await shoot();
  checkClean('Step 3');
  log('step 3: predicted first; fast-forward, the fancy note deleted (only it offered), TOP-only conflict = Git markers, finished by a second student, cancel');

  await next();
  for (const p of LEADS.map((n) => S[n])) await sees(p, '#reveal .reveal-fact', ACCURACY_3);
  await sees(screen, '.sl-facts', ACCURACY_3);
  await answer('reveal-3');
  await takeaways(3);
  await shoot();
  checkClean('Reveal 3');

  // ---------- The break ----------
  await next();
  await Promise.all(students().map((p) => sees(p, '#mission .break-line', 'Break · back at')));
  await sees(screen, '.sl-break', 'Back at');
  await sees(admin, '#tools', 'Restart the break timer');
  await sees(admin, '#coming-note', "Sends Lab 1's outfit to the Wall.");
  await shoot();
  checkClean('Break');

  // ---------- Step 4: the Wall; predict, send; refused; the lab chooses Combine (merge) or Replay on top (rebase); send ----------
  const lab1Main = tipIn('1');
  await next();
  assert.equal(tipIn('wall'), lab1Main, "Lab 1's main is on the Wall");
  for (const lab of Object.keys(LAB)) assert.equal(tipIn(lab), lab1Main, `Lab ${lab} is a full copy of the Wall (git clone)`);
  await Promise.all(students().map(async (p) => {
    const who = WHO.get(p);
    await sees(p, '#on-note', 'main');
    await until(`${who}: the newest card has the Wall's ID`, async () =>
      (await newestIn(p, '#graph')) === lab1Main && (await newestIn(p, '#wall-graph')) === lab1Main);
    assert.equal(await noteIn(p, '#graph', 'wall/main'), lab1Main, `${who}: the blue wall/main note`);
    assert.match(await textOf(p, '#graph .g-note[data-key="main"]'), /YOU/, `${who}: the pin is on main`);
    assert.equal(await count(p, '#mission .break-line'), 0, `${who}: Next ended the break`);
  }));
  for (const name of LEADS) {
    await sees(S[name], '#mission .instruction', "The Wall is the class's shared copy, like GitHub. Your lab already has a full copy of it (that is git clone).");
    await sees(S[name], '#mission .instruction', `It starts as ${name === a1 ? 'your lab' : 'Lab 1'}'s outfit, so your lab's cards are now a copy of it.`);
    await sees(S[name], '#mission .fresh-line', name === a1 ? STEPS[4].fresh.wallLab
      : "Your lab now starts from Lab 1's Wall. Your own Steps 1–3 cards are not in this fresh copy.");
    await sees(S[name], '#actions .ways-head', "Get the Wall's cards: choose a way.");
    for (const w of Object.values(WAYS)) await sees(S[name], '#actions .ways', `${w.name}: ${w.line}`);
  }
  await until('the projector shows the Wall', async () => (await cardsIn(screen, '#slide [data-wall]')).some((c) => c.id === lab1Main));
  // Lab 1 predicts, and sends first: it just sends.
  await sees(S[a1], '#mission .mission-box', 'HAT → 👑');
  await pick(S[a1], 'hat', 'crown');
  ok(await press(S[a1], 'commit'), `${a1}: save`);
  assert.match(ok(await send(S[a1], 'accepted'), 'Lab 1 sends').result.message, SENT);
  await sees(S[a1], '#mission .verdict.right', 'You predicted: accepted. Git: accepted. ✓');
  // Lab 3 saves its change now. Lab 2, by hints alone, predicts "accepted", is refused, chooses Combine (merge).
  await pick(S[a3], 'glasses', 'shades');
  ok(await press(S[a3], 'commit'), `${a3}: save`);
  const original = tipIn('3');
  assert.deepEqual(await followHints(S[a2], { way: 'merge' }), [REFUSED_CHOOSE], 'Lab 2, following hints, is refused once, chooses to combine, and sends');
  await notSees(S[a2], '#mission .mission-box', 'Your lab chose', `${a2}: done, so the mission no longer names the way`);
  const merge2 = commitIn('wall', tipIn('wall'));
  assert.equal(merge2.parents.length, 2, "Lab 2's Get & combine made a merge card with two parents");
  // Lab 3 looks at the Wall, predicts the refusal, and is refused: it chooses for itself.
  const refused3 = await send(S[a3], 'refused');
  assert.equal(refused3.error, REFUSED_CHOOSE, `${a3}: refused, and asked to choose a way`);
  await sees(S[a3], '#mission .verdict.right', 'You predicted: refused. Git: refused (fetch first). ✓');
  await sees(S[a3], '#mission .mission-box', 'The Wall refused your send. Choose how to get its cards: Combine (merge) or Replay on top (rebase).');
  assert.equal(await count(S[a3], '#actions .way.mine'), 0, 'the app marks no way: the lab chooses');
  assert.equal(await hintOf(S[a3]), 'Pick a way: press Get & combine (merge) or Replay on top (rebase). Then Send to Wall again.');
  await hinted(S[a3], '#actions [data-act="rebase"]');
  await hinted(S[a3], '#actions [data-act="pull"]');
  await click(S[a3], '#mission [data-hint="0"]'); // hide the hint for the screenshot of the choice
  await toastsFade(S[a3]).catch(() => {});
  await settle(S[a3]);
  await S[a3].screenshot({ path: `${SHOTS}/${tag()}-choice-lab3.png` });
  await phoneShot(S[a3], `${tag()}-choice`); // the two ways and their lines fit a 390px phone
  await sleep(1100); // Git's clock counts seconds; in class, minutes pass between the save and the replay
  const replayed = ok(await press(S[a3], 'rebase'), `${a3}: Replay on top`);
  await sees(S[a3], '#actions .way.mine', /your lab's choice.*Replay on top/i);
  await sees(S[a3], '#actions .ways-head', 'Your lab chose Replay on top (rebase).');
  // Why this way? One optional line, Enter saves; the lab sees it, and so does the console.
  const WHY = 'A straight line is easier to read';
  await S[a3].fill('#actions [data-why]', WHY);
  const [why] = await Promise.all([S[a3].waitForResponse((r) => new URL(r.url()).pathname === '/api/why'), S[a3].press('#actions [data-why]', 'Enter')]);
  ok(await why.json(), `${a3}: why this way`);
  await until(`${b3} sees the lab's why`, async () => (await S[b3].inputValue('#actions [data-why]')) === WHY);
  await sees(admin, '#labs .tile:nth-child(3) .way', `Chose: Replay on top (rebase) · "${WHY}"`);
  const copy = tipIn('3');
  assert.deepEqual(replayed.result.replaced, [{ from: original, to: copy }], 'Git wrote one new card for the one card');
  assert.match(replayed.result.message, new RegExp(`^Replayed your card on top of the Wall's: ${original.slice(0, 7)} is now ${copy.slice(0, 7)}, a new ID\\.`));
  const [was, now] = [commitIn('3', original), commitIn('3', copy)];
  assert.notEqual(copy, original, 'the replayed card has a new ID');
  assert.deepEqual(now.parents, [merge2.id], "its new parent is the Wall's newest card");
  assert.equal(now.author, was.author, 'the same author');
  assert.equal(now.at, was.at, 'the same author date');
  assert.ok(now.ct > was.ct, 'a later committer date');
  assert.ok(!inHistory('3', original), "the original is no longer in main's history");
  // The original: dashed, only in the safety diary. The copy's details show both times.
  await until(`${a3} sees the original card dashed`, async () => (await cardsIn(S[a3], '#graph')).some((c) => c.id === original && c.dashed));
  await sees(S[a3], '#graph', 'only in your safety diary');
  await openCard(S[a3], copy);
  const second = clockOf(was.at) === clockOf(now.ct); // the same minute: the details say the seconds
  await sees(S[a3], '#card-dialog .facts', `Author ${was.author} at ${clockOf(was.at, second)} · committed at ${clockOf(now.ct, second)}`);
  await sees(S[a3], '#card-dialog .facts', `Replay of ${original.slice(0, 7)} only in your safety diary`);
  await snap(S[a3], `${tag()}-replay-lab3`);
  await closeDialog(S[a3], 'card-dialog');
  await openCard(S[a3], original);
  await sees(S[a3], '#card-dialog .facts', 'Only in your safety diary');
  await sees(S[a3], '#card-dialog .facts', `Replayed as ${copy.slice(0, 7)}`);
  await closeDialog(S[a3], 'card-dialog');
  assert.match(ok(await send(S[a3], 'accepted'), `${a3}: send again`).result.message, SENT);
  await notSees(S[a3], '#mission .mission-box', 'Your lab chose', `${a3}: done, so the mission no longer names the way`);
  for (const name of [a1, a2]) ok(await press(S[name], 'pull'), `${name}: catch up`);
  for (const name of LEADS) await goalsDone(S[name]);
  await sees(admin, '#labs .tile:nth-child(2) .way', 'Chose: Combine (merge)');
  await sees(admin, '#labs .tile:nth-child(3) .way', 'Chose: Replay on top (rebase)');
  assert.equal(await count(admin, '#labs .tile:nth-child(1) .way'), 0, 'Lab 1 sent first: nothing to choose');
  const ACCURACY_4 = 'Predicted right: 4 of 5 · refused sends 1/2 · accepted sends 3/3';
  await sees(admin, '#predictions', ACCURACY_4);
  await click(admin, '#details > summary');
  await sees(admin, '#feed li.bad', `Lab 2 · ${a2}: Send to Wall → refused`);
  await sees(admin, '#feed', `Lab 3 · ${a3}: Replay on top → ${original.slice(0, 7)} → ${copy.slice(0, 7)}`);
  await snap(admin, `${tag()}-details-console`);
  await click(admin, '#details > summary');
  await shoot();
  checkClean('Step 4');
  log(`step 4: predicted sends; Lab 1 sent; Lab 2 refused, chose merge → merge card; Lab 3 refused, chose replay → ${original.slice(0, 7)} as ${copy.slice(0, 7)} (same author date, later committer date)`);

  // ---------- Reveal 4: merge vs rebase on the Wall, and each change's integration path, in this class's times ----------
  await next();
  const FACTS_4 = [ACCURACY_4, `Chose: Lab 2 Combine (merge) · Lab 3 Replay on top (rebase) ("${WHY}")`];
  assert.deepEqual((await adminState()).projector.scene.facts, FACTS_4, 'the reveal: accuracy, then what each lab chose');
  for (const line of FACTS_4) {
    await sees(screen, '.sl-facts', line);
    await sees(S[a1], '#reveal', line);
  }
  const st4 = await adminState();
  const paths = st4.session.integration.paths;
  assert.deepEqual(paths.map((p) => p.labId), ['1', '2', '3'], 'in the order the changes reached the Wall');
  for (const p of paths) {
    assert.equal(p.made, commitIn('wall', p.cards[0]).at, `${p.name}: made = its card's author date`);
    assert.match(gitIn('wall', 'cat-file', '-p', `${p.cards[0]}:outfit.txt`), new RegExp(`^${p.part}: ${p.value}$`, 'm'), `${p.name}: its change`);
    const sends = gitIn(p.labId, 'reflog', 'show', '--date=unix', '--format=%gd %gs', 'refs/remotes/wall/main').split('\n');
    assert.ok(sends.some((l) => l.includes(`@{${p.onWall}}`) && l.endsWith('update by push')), `${p.name}: on the Wall = its own send`);
    assert.ok(p.made <= p.onWall, `${p.name}: made, then on the Wall`);
  }
  assert.deepEqual(paths.map((p) => p.cards.at(-1)), [paths[0].cards[0], merge2.id, copy], 'each path ends at the card its own send made main');
  assert.deepEqual(paths.map((p) => p.copy), [false, false, true], "only Lab 3's path starts at a copy");
  assert.deepEqual([paths[2].cards, paths[2].original, paths[2].note], [[copy], original, COPY_LINE]);
  assert.equal(paths[1].cards.length, 2, "Lab 2's path: its card, then its own merge card");
  assert.equal(paths[1].note, MERGE_LINE, "Lab 2's path ends at its own merge card");
  // Each student's Wall labels the two ways: the merge card with two parents, and the copy with a new ID.
  await sees(S[a1], '#wall-graph', 'merge · 2 parents');
  await sees(S[a1], '#wall-graph', 'copy · new ID');
  await sees(screen, '.sl-paths', MERGE_LINE);
  for (const p of paths) {
    await sees(screen, '.sl-paths', velocity(p));
    await sees(admin, '#paths', velocity(p));
  }
  await sees(screen, '.sl-paths .sl-path-note', COPY_LINE);
  await sees(admin, '#paths', 'starts at a copy');
  await sees(screen, '.sl-wall .sl-label', /Lab 2's path to main \(bold\)/i);
  const marked = async (p, svg) => (await cardsIn(p, svg)).filter((c) => c.marked).map((c) => c.id).sort();
  assert.deepEqual(await marked(screen, '#slide [data-wall]'), [...paths[1].cards].sort(), "the projector marks Lab 2's path");
  for (const [i, name] of LEADS.entries()) {
    const p = S[name];
    await sees(p, '#paths .path.on .path-time', velocity(paths[i]));
    await until(`${name}'s Wall marks Lab ${i + 1}'s path`, async () => isDeepStrictEqual(await marked(p, '#wall-graph'), [...paths[i].cards].sort()));
  }
  await sees(S[a3], '#paths .path.on .path-note', COPY_LINE);
  await click(S[a1], '#paths [data-path="3"]');
  await until(`${a1} marks Lab 3's path instead`, async () => isDeepStrictEqual(await marked(S[a1], '#wall-graph'), [copy]));
  await sees(admin, '#tools', "Sabotage: the Intern's 🥸 card");
  await answer('reveal-4');
  await takeaways(4);
  await shoot();
  checkClean('Reveal 4');
  log(`reveal 4: paths ${paths.map((p) => `${p.name} ${velocity(p)}`).join(' · ')}`);

  // ---------- Step 5: entering puts the disguise on the Wall; each lab chooses undo or move back ----------
  await next();
  const intern = await until('the Wall shows the disguise card', async () =>
    (await cardsIn(S[a1], '#wall-graph')).find((c) => c.author === 'The Intern' && c.message === 'Tiny style fix'));
  assert.equal(tipIn('wall'), intern.id);
  assert.match(gitIn('wall', 'cat-file', '-p', 'refs/heads/main:outfit.txt'), /^glasses: disguise$/m);
  await until('the projector shows the disguise card', async () => (await cardsIn(screen, '#slide [data-wall]')).some((c) => c.id === intern.id));
  const beforeDisguise = gitIn('wall', 'rev-parse', `${intern.id}^`);
  // Next gave every lab the card at once: a fast-forward, no new card.
  for (const lab of Object.keys(LAB)) assert.equal(tipIn(lab), intern.id, `Lab ${lab} holds the disguise card`);
  for (const name of LEADS) {
    await sees(S[name], '#draft [data-part="glasses"]', 'disguise glasses');
    await sees(S[name], '#mission .mission-box', 'Your lab has it now. Choose: click the 🥸 card and press Undo this card (adds a fix card), or click the card right before it and press Move my note back here');
    await sees(S[name], '#behind-body .last', 'Teacher · Get & combine → fast-forward');
  }
  assert.equal(ok(await press(S[a1], 'pull'), `${a1}: Get & combine`).result.message, 'Nothing new on the Wall.');
  // Lab 2 chooses to move back: move back, send → refused; the diary; Get & combine brings the card back.
  await openCard(S[a2], beforeDisguise);
  ok(await hit(S[a2], '#card-dialog [data-card-act="reset"]', 'reset'), `${a2}: move my note back`);
  assert.equal(tipIn('2'), beforeDisguise);
  await notSees(S[a2], '#draft [data-part="glasses"]', 'disguise');
  await sees(S[a2], '#mission .mission-box', 'What happens?');
  const refusedBack = await send(S[a2], 'accepted');
  assert.equal(refusedBack.error, REFUSED_MOVED_BACK, 'a moved-back main is refused');
  // Git's own reason: the lab already has the Wall's newest card, so it is not "fetch first" but "non-fast-forward".
  await sees(S[a2], '#mission .verdict.wrong', "You predicted: accepted. Git: refused (non-fast-forward). Why: the Wall has cards your main doesn't");
  await sees(S[a2], '#mission .mission-box', 'Refused. Open the Safety diary');
  await click(S[a2], '#actions [data-act="reflog"]', { position: { x: 10, y: 10 } });
  await sees(S[a2], '#diary-dialog .diary li:first-child', /reset: moving to [0-9a-f]{7}/);
  await sees(S[a2], '#diary-dialog .diary', 'clone: from the Wall');
  await snap(S[a2], `${tag()}-diary-lab2`);
  await closeDialog(S[a2], 'diary-dialog');
  const zombie = ok(await press(S[a2], 'pull'), `${a2}: Get & combine again`);
  assert.equal(tipIn('2'), intern.id, 'Get & combine brings the disguise card back');
  assert.match(zombie.result.message, /The 🥸 card is back/, `${a2} is told the disguise card came back`);
  await sees(S[a2], '#draft [data-part="glasses"]', 'disguise');
  // Lab 2 undoes it and sends first.
  await openCard(S[a2], intern.id);
  ok(await hit(S[a2], '#card-dialog [data-card-act="revert"]', 'revert'), `${a2}: undo this card`);
  assert.match(ok(await send(S[a2], 'accepted'), `${a2}: send the fix`).result.message, SENT);
  // Lab 1: undo, a lab-mate presses Undo too, send → refused; combine without red; send.
  await openCard(S[a1], intern.id);
  await click(S[a1], '#card-dialog .stored summary');
  await sees(S[a1], '#card-dialog .stored-body', 'glasses: disguise');
  await snap(S[a1], `${tag()}-card-lab1`);
  const undo = ok(await hit(S[a1], '#card-dialog [data-card-act="revert"]', 'revert'), `${a1}: undo this card`);
  assert.ok(undo.result.id, 'undo makes a new fix card');
  await until(`${a1}'s card details close`, async () => !(await dialogOpen(S[a1], 'card-dialog')));
  await notSees(S[a1], '#draft [data-part="glasses"]', 'disguise');
  assert.equal((await cardsIn(S[a1], '#graph')).filter((c) => !c.dashed).at(-1).message, 'Revert "Tiny style fix"');
  await openCard(S[b1], intern.id);
  const again = await hit(S[b1], '#card-dialog [data-card-act="revert"]', 'revert');
  assert.equal(again.result?.message, 'Already undone. Nothing to change.');
  await until(`${b1}'s card details close`, async () => !(await dialogOpen(S[b1], 'card-dialog')));
  assert.equal((await send(S[a1], 'refused')).error, REFUSED, 'the second fix to arrive is refused');
  const fixes = ok(await press(S[a1], 'pull'), `${a1}: Get & combine`);
  assert.ok(!fixes.result.conflict, 'two fix cards combine without red');
  assert.match(ok(await send(S[a1], 'accepted'), `${a1}: send`).result.message, SENT);
  // Lab 3 by hints alone, choosing a fix card. Its safety diary still lists the card it saved before the replay.
  assert.deepEqual(await followHints(S[a3], { undo: 'revert' }), [REFUSED], 'Lab 3, following hints, undoes, is refused once, combines and sends');
  await sees(S[a3], '#mission .goals li.done', 'You undid the 🥸 card yourselves');
  await notSees(S[a3], '#mission', 'Your lab has it now.', `${a3}: done, so the mission goes`);
  await click(S[a3], '#actions [data-act="reflog"]', { position: { x: 10, y: 10 } });
  await sees(S[a3], '#diary-dialog .diary', `Replayed on top · ${copy.slice(0, 7)}`);
  await click(S[a3], `#diary-dialog [data-goto="${original}"]`);
  await until(`${a3} opens the original card from the diary`, () => dialogOpen(S[a3], 'card-dialog'));
  await sees(S[a3], '#card-dialog .facts', 'Only in your safety diary');
  await closeDialog(S[a3], 'card-dialog');
  // A long history: Start, then "← N older cards", then the newest. The pill draws them all.
  const drawnCards = await cardsIn(S[b1], '#graph');
  assert.equal(drawnCards[0].id, startId, 'Start stays drawn in front of the pill');
  for (const note of ['main', 'wall/main']) assert.ok(await noteIn(S[b1], '#graph', note), `the ${note} note is never folded away`);
  await click(S[b1], '#graph .g-older [role="button"]');
  await until('the pill draws every card', async () => (await cardsIn(S[b1], '#graph')).length > drawnCards.length);
  await openCard(S[b1], startId);
  assert.ok(await S[b1].locator('#card-dialog [data-card-act="revert"]').isDisabled(), 'the Start card cannot be undone');
  await sees(S[b1], '#card-dialog .why', "The Start card can't be undone.");
  await closeDialog(S[b1], 'card-dialog');
  for (const name of [a1, a2]) ok(await press(S[name], 'pull'), `${name}: get the last fix`);
  for (const name of LEADS) await goalsDone(S[name]);
  // A late joiner, by name only, lands in a lab on main, in Step 5, with the lab's cards.
  const zoe = await open('Zoe', '/');
  await joinByName(zoe, 'Zoe');
  await sees(zoe, '#coach .bubble-count', '1 of 4');
  await click(zoe, '#coach [data-coach="skip"]');
  const zoeLab = (await textOf(zoe, '#crumbs b')).replace('Lab ', '');
  await sees(zoe, '#crumbs', `Lab ${zoeLab} · Zoe · Step 5`);
  await sees(zoe, '#on-note', 'main');
  await sees(zoe, '#mission .instruction', 'card reached the Wall');
  await until('Zoe sees the disguise card', async () => (await cardsIn(zoe, '#graph')).some((c) => c.id === intern.id));
  S.Zoe = zoe;
  LAB[zoeLab].push('Zoe');
  // 8 sends at once, with new cards in Labs 1 and 3: one is sent, the rest are refused or already there.
  await pick(S[b1], 'top', 'vest');
  ok(await press(S[b1], 'commit'), `${b1}: save`);
  await pick(S[b3], 'glasses', 'monocle');
  ok(await press(S[b3], 'commit'), `${b3}: save`);
  const senders = NAMES.filter((n) => n !== LAB[2][2]);
  const sends = await Promise.all(senders.map((name) => send(S[name], 'accepted')));
  const said = sends.map((r) => (r.ok ? r.result.message : r.error));
  said.forEach((words, i) => assert.ok(SENT.test(words) || words === REFUSED || words === 'The Wall already has this card.',
    `${senders[i]}: 8 sends at once said "${words}"`));
  assert.equal(said.filter((w) => SENT.test(w)).length, 1, 'exactly one of 8 simultaneous sends goes in');
  log('step 5: 8 sends at once:', said.map((w) => (SENT.test(w) ? 'sent' : w === REFUSED ? 'refused' : 'already')).join(' '));
  for (const p of students()) if (await count(p, '#toasts .toast-close')) await click(p, '#toasts .toast-close');
  // The server restarts mid-session; everyone carries on.
  await restart();
  checkClean('Restart');
  for (const name of LEADS) {
    const r = ok(await press(S[name], 'pull'), `${name}: Get & combine after the restart`);
    assert.ok(!r.result.conflict, `${name}: no conflict`);
    const sent = await send(S[name], 'accepted');
    assert.ok(sent.ok, `${name}: send after the restart: ${sent.error}`);
  }
  for (const name of LEADS.slice(0, 2)) ok(await press(S[name], 'pull'), `${name}: catch up`);
  for (const name of LEADS) await goalsDone(S[name]);
  await shoot();
  checkClean('Step 5');
  log(`step 5: disguise on entry; labs chose: move back refused, diary, the card came back; undo + send; Lab 3 by hints; restart; Zoe joined Lab ${zoeLab}`);

  await next();
  const facts5 = (await adminState()).projector.scene.facts;
  assert.match(facts5[0], /^Predicted right: \d+ of \d+ · refused sends \d+\/\d+ · accepted sends \d+\/\d+$/);
  assert.deepEqual(facts5.slice(1), ['Chose: Lab 1 Undo this card (revert) · Lab 2 Move my note back (reset) · Lab 3 Undo this card (revert)']);
  for (const line of facts5) await sees(screen, '.sl-facts', line);
  await answer('reveal-5', { show: true });
  await takeaways(5);
  await sees(admin, '#coming-note', 'Only Lab 1 can replace the Wall.');
  await shoot();
  checkClean('Reveal 5');

  // ---------- Step 6: the boss lab squashes and force-pushes; the audit before and after ----------
  await next();
  const sportyAuthor = LAB[1][1]; // Lab 1's Pair B saved sporty, and Lab 1's main went to the Wall in Step 4
  await sees(admin, '#audits', new RegExp(`Before the clean-up.*Wall: ${sportyAuthor} \\(Lab 1\\), [0-9a-f]{7}`, 'i'));
  await sees(screen, '.sl-audits', new RegExp(`Wall: ${sportyAuthor} \\(Lab 1\\)`));
  for (const name of LAB[1]) await sees(S[name], '#actions [data-act="squash"]', 'Replace the Wall with one card');
  for (const id of ['2', '3']) {
    for (const name of LAB[id]) assert.equal(await count(S[name], '#actions [data-act="squash"]'), 0, `${name} has no replace button`);
  }
  assert.equal((await press(S[a2], 'push')).error, BOSS_ONLY);
  assert.equal((await press(S[a2], 'pull')).error, BOSS_ONLY);
  assert.equal(await hintOf(S[a2]), 'Press nothing. Watch the Wall.');
  const bossPull = ok(await press(S[a1], 'pull'), `${a1}: Get & combine first`);
  assert.ok(!bossPull.result.conflict, 'the boss combines without red');
  await click(S[a1], '#actions [data-act="squash"]', { position: { x: 10, y: 10 } });
  await sees(S[a1], '#confirm-dialog', "This replaces the Wall's history for everyone. Sure?");
  const forced = ok(await hit(S[a1], '#confirm-dialog [data-yes]', 'squash-force'), `${a1}: replace the Wall`);
  assert.ok(forced.result.id, 'the Wall has a new clean card');
  await until("the Wall's history is Start ← Clean history", async () =>
    JSON.stringify((await cardsIn(S[a1], '#wall-graph')).map((c) => c.message)) === '["Start","Clean history"]',
  async () => JSON.stringify((await cardsIn(S[a1], '#wall-graph')).map((c) => c.message)));
  assert.equal(gitIn('wall', 'log', '--format=%s', 'refs/heads/main'), 'Clean history\nStart');
  assert.equal(gitIn('wall', 'rev-parse', 'refs/heads/main^{tree}'), gitIn('1', 'rev-parse', 'refs/heads/main^{tree}'),
    "the clean card's tree is the final outfit");
  for (const name of LEADS) await goalsDone(S[name]);
  await shoot();
  checkClean('Step 6');

  // The reveal asks the Wall again: not found there, still found in the other labs. Then the bin is emptied.
  await next();
  const st6 = await adminState();
  const [beforeWall] = st6.session.audits.before.rows;
  const [afterWall, ...afterLabs] = st6.session.audits.after.rows;
  assert.equal(afterWall.text, 'Wall: not found', 'after: the Wall no longer knows who added the boots');
  const found = beforeWall.text.replace(/^Wall: /, '');
  for (const id of ['2', '3']) {
    assert.ok(afterLabs.some((r) => r.text === `Lab ${id}: ${found}`), `Lab ${id} still knows: ${found}`);
  }
  await sees(admin, '#audits', /Before the clean-up.*After the clean-up/i);
  await sees(screen, '.sl-evidence', afterWall.text);
  const gc = (await (async () => {
    const [res] = await Promise.all([
      admin.waitForResponse((r) => new URL(r.url()).pathname === '/api/admin/gc'),
      click(admin, '#tools [data-tool="gc"]'),
    ]);
    return res.json();
  })()).result.message;
  const bin = gc.match(/^The Wall's bin had (\d+) old cards?\. Now 0\.$/);
  assert.ok(bin && Number(bin[1]) > 0, `gc empties the bin: "${gc}"`);
  await sees(admin, '#tool-result', gc);
  await sees(screen, '.sl-evidence', `The Wall's bin: ${bin[1]} old card`);
  await answer('reveal-6');
  await takeaways(6);
  await shoot();
  checkClean('Reveal 6');
  log(`step 6: boss-only button, Wall = Start ← Clean, audit "${beforeWall.text}" → "${afterWall.text}", ${gc}`);

  // ---------- The paper, the exit question ----------
  await next();
  const paper = (await adminState()).session.integration;
  assert.deepEqual(paper.paths, paths, 'the paper shows the paths as they were at the end of Step 4');
  for (const p of paths) {
    await sees(screen, '.sl-paths', velocity(p));
    await sees(S[LEADS[0]], '#scene-body .velocity', velocity(p));
  }
  await sees(screen, '.sl-gone', 'After the squash, the Wall has none of these cards.');
  await sees(S[LEADS[0]], '#scene-body .velocity', "Since the squash, the Wall's main has none of these cards.");
  await answer('paper', { show: true });
  await shoot();
  checkClean('The paper');

  await next();
  await answer('exit', { show: true, names: true });
  await shoot();
  checkClean('Exit question');

  // ---------- Wrap: My Git in 7 lines, the takeaway wall, counts, Export ----------
  await next();
  const ana = S[NAMES[0]];
  const anaLines = [0, 1, 2, 3, 4, 5, 6].map((step) => TAKEAWAYS[step][0]);
  await until(`${NAMES[0]} sees her 7 takeaways`, async () => JSON.stringify(await ana.$$eval('.git7 [data-field]', (els) => els.map((e) => e.value)))
    === JSON.stringify(anaLines));
  // Takeaways stay editable: change one line; a reload keeps it.
  const edited = 'Merge = compare both sides with the card they share.';
  const line3 = ana.locator('.git7 [data-field="t:3"]');
  await line3.fill(edited);
  const [saved] = await Promise.all([ana.waitForResponse((r) => new URL(r.url()).pathname === '/api/takeaway'), line3.press('Enter')]);
  ok(await saved.json(), 'edit a takeaway');
  await ana.reload();
  await until('the edited line survives a reload', async () => (await ana.inputValue('.git7 [data-field="t:3"]')) === edited);
  await click(ana, '.git7 [data-copy]');
  await sees(ana, '#toasts', 'Copied. Paste it into your notes.');
  const copied = await ana.evaluate(() => navigator.clipboard.readText());
  assert.ok(copied.startsWith(`My Git in 7 lines\n0. ${anaLines[0]}\n`) && copied.includes(`3. ${edited}`) && copied.split('\n').length === 8,
    `the copy holds the 7 lines:\n${copied}`);
  await sees(ana, '#scene-body .wrap-line', WRAP_LINE);
  await sees(screen, '.sl-wrap-line', 'Cards never change.');
  const wall = await textOf(screen, '.sl-takeaways');
  assert.ok((await count(screen, '.sl-takeaways p')) > 0, 'the projector shows a takeaway wall');
  for (const name of NAMES) assert.doesNotMatch(wall, new RegExp(`\\b${name}\\b`), 'the takeaway wall hides names');
  // What each lab did, in each student's wrap and on the console tiles.
  const did = {
    1: { on: ['Save a card', 'Slide a note forward', 'Solve a conflict', 'Undo with a fix card', 'Get refused', 'Replace the Wall'], off: ['Move a note back', 'Replay on top'] },
    2: { on: ['Save a card', 'Solve a conflict', 'Get refused', 'Get & combine', 'Move a note back', 'Read the diary', 'Undo with a fix card'], off: ['Replace the Wall', 'Replay on top'] },
    3: { on: ['Save a card', 'Solve a conflict', 'Get refused', 'Replay on top', 'Undo with a fix card'], off: ['Move a note back', 'Replace the Wall'] },
  };
  for (const [id, { on, off }] of Object.entries(did)) {
    const p = S[LAB[id][0]];
    await sees(p, '#scene-foot', `What Lab ${id} did`);
    const lit = await p.$$eval('#scene-foot .concepts li.on', (els) => els.map((e) => e.firstChild.textContent.trim()));
    for (const words of on) assert.ok(lit.includes(words), `Lab ${id}: "${words}" is lit (lit: ${lit.join(', ')})`);
    for (const words of off) assert.ok(!lit.includes(words), `Lab ${id}: "${words}" is not lit`);
  }
  await sees(admin, '#labs .tile:nth-child(2) .counts', 'refused send');
  await sees(admin, '#labs .tile:nth-child(3) .counts', '1 replay');
  // Export: every answer and takeaway, per question and per person.
  const [download] = await Promise.all([admin.waitForEvent('download'), click(admin, '#tools a[download]')]);
  const md = fs.readFileSync(await download.path(), 'utf8');
  assert.match(md, /^# Outfit Lab · answers and takeaways/);
  assert.ok(md.includes(`### ${NAMES[0]} · Lab ${labOf(NAMES[0])}`) && md.includes(`3. ${edited}`), 'Export has the edited takeaway');
  for (const text of [...ANSWERS['reveal-1'], ...ANSWERS.exit, TAKEAWAYS[0][1], TAKEAWAYS[6][2]]) assert.ok(md.includes(text), `Export has "${text}"`);
  fs.writeFileSync(`${SHOTS}/${tag()}-export.md`, md);
  await shoot();
  checkClean('Wrap');
  log('wrap: My Git in 7 lines (edited, copied), the takeaway wall, counts per lab, Export');

  // ---------- Keys, then Reset sends everyone back to Join ----------
  // The key left the address bar; a reload still works (sessionStorage). Without any key, the page says how to get in.
  assert.equal((await fetch(`${BASE}/api/admin/state`)).status, 401);
  await admin.reload();
  assert.equal(admin.url(), `${BASE}/admin`);
  await until('the console works after a reload without ?key=', async () => (await admin.textContent('#scene-title')) === SCENES[scene].title);
  const stranger = await open('Stranger', '/admin');
  await sees(stranger, '.no-key', 'Open the Teacher link from the server');
  await stranger.context().close();
  WHO.delete(stranger);
  await click(admin, '#details > summary');
  await click(admin, '#reset');
  await Promise.all(students().map((p) => until(`${WHO.get(p)} is back on Join`, () => shown(p, '#join'))));
  assert.equal(await ana.inputValue('#join-name'), NAMES[0], 'the name is remembered');
  await until('the console is back at Join', async () => (await admin.textContent('#scene-title')) === 'Join');
  checkClean('Reset');
  log('reset: everyone joins again');
}

// ---------- Run 2: two students, one lab, and the practice lab ----------

async function practiceRun() {
  admin = await open('Teacher', `/admin?key=${KEY}`);
  screen = await open('Projector', `/screen?key=${KEY}`, PROJECTOR);
  for (const name of ['Noor', 'Eli']) {
    S[name] = await open(name, '/');
    await joinByName(S[name], name);
    await click(S[name], '#coach [data-coach="skip"]');
  }
  const [noor, eli] = [S.Noor, S.Eli];
  LAB = { 1: ['Noor', 'Eli'] };
  LEADS = ['Noor'];
  await sees(admin, '#labs .tile:nth-child(2)', 'Practice lab');
  await sees(admin, '#labs .tile.practice .status', 'Plays by itself');
  await sees(screen, '.sl-roster', /Practice lab\s*Plays by itself/);
  await sees(noor, '#crumbs', 'Lab 1 · Noor');
  await sees(eli, '#crumbs', 'Lab 1 · Eli');
  await arrive(0);

  // Step 1: both save. Then on to Step 4 with Next alone.
  while (SCENES[scene].id !== 'task-1') await next();
  for (const [p, part, slug] of [[noor, 'hat', 'sunhat'], [eli, 'top', 'coat']]) {
    await pick(p, part, slug);
    ok(await press(p, 'commit'), `${WHO.get(p)}: save`);
  }
  await goalsDone(noor);
  while (SCENES[scene].id !== 'break') await next();
  await sees(admin, '#coming-note', 'The practice lab sends its card to the Wall first.');
  await next();
  const wall = await until("the practice lab's card is on the Wall", async () =>
    (await cardsIn(noor, '#wall-graph')).find((c) => c.author === 'Practice lab'));
  assert.equal(tipIn('wall'), wall.id, 'the practice lab sent first');
  await sees(screen, '.sl-lab.practice', 'Plays by itself');
  // The real lab is refused, and chooses its way: Eli picks Replay on top.
  await pick(noor, 'hat', 'crown');
  ok(await press(noor, 'commit'), 'Noor: save');
  const original = tipIn('1');
  await predictInPanel(eli, 'refused');
  const refused = await send(noor, 'accepted');
  assert.equal(refused.error, REFUSED_CHOOSE, 'a class of one lab still meets the refusal, and chooses a way');
  await sees(eli, '#mission .verdict.right', 'You predicted: refused. Git: refused (fetch first). ✓');
  await sees(noor, '#mission .mission-box', 'Choose how to get its cards');
  await sees(eli, '#mission .mission-box', 'Choose how to get its cards');
  const replayed = ok(await press(eli, 'rebase'), 'Eli: Replay on top');
  await sees(noor, '#mission .mission-box', 'Your lab chose Replay on top (rebase).');
  assert.deepEqual(replayed.result.replaced.map((r) => r.from), [original], "Noor's card is replayed");
  const [was, now] = [commitIn('1', original), commitIn('1', tipIn('1'))];
  assert.deepEqual([now.author, now.at, now.parents], [was.author, was.at, [wall.id]], "the copy keeps Noor and her time, on the practice lab's card");
  await openCard(eli, tipIn('1'));
  const second = clockOf(was.at) === clockOf(now.ct); // the same minute: the details say the seconds
  await sees(eli, '#card-dialog .facts', `Author Noor at ${clockOf(was.at, second)} · committed by Eli at ${clockOf(now.ct, second)}`);
  await closeDialog(eli, 'card-dialog');
  assert.match(ok(await send(noor, 'accepted'), 'Noor: send again').result.message, SENT);
  await goalsDone(noor);
  await sees(eli, '#mission .done-line', DONE_LINE);
  assert.equal(await count(admin, '#labs .tile.practice [data-rescue]'), 0, 'the practice lab never needs a rescue');
  for (const p of [admin, screen, noor, eli]) await noOldWords(p, 'practice run');
  await shoot(`p${tag()}`);

  // A buffering proxy (a quick tunnel) can hold back live updates. Eli and the projector, reloaded with the
  // stream blocked, load at once and still follow Next within 5 s.
  const blocked = (pathname) => (route) => (new URL(route.request().url()).pathname === pathname ? route.abort('aborted') : route.fallback());
  await eli.route('**/api/events*', blocked('/api/events'));
  await screen.route('**/api/admin/events*', blocked('/api/admin/events'));
  await Promise.all([eli.reload(), screen.reload()]);
  await sees(eli, '#crumbs', SCENES[scene].title);
  await until('the projector loads with its stream blocked', () => shown(screen, '#slide .sl.kind-task'), () => '', 5000);
  await settleMove();
  await click(admin, '#next');
  const into = SCENES[scene + 1];
  await until(`Eli reaches "${into.title}" with live updates blocked`, async () => (await textOf(eli, '#crumbs')).includes(into.title),
    () => textOf(eli, '#crumbs'), 5000);
  await until(`the projector reaches the ${into.kind} slide with live updates blocked`, () => shown(screen, `#slide .sl.kind-${into.kind}`),
    () => '', 5000);
  await arrive(scene + 1);
  lastMove = Date.now();
  const paths = (await adminState()).session.integration.paths;
  assert.deepEqual(paths.map((p) => [p.name, p.copy]), [['Practice lab', false], ['Lab 1', true]], "Lab 1's path starts at a copy");
  for (const p of paths) await sees(screen, '.sl-paths', velocity(p));
  await shoot(`p${tag()}`);
  checkClean('Practice run');
  log('practice run: 2 students, 1 lab + the practice lab; it sends first, the real lab is refused, replays on top and sends; live updates blocked: still follows Next');
}

// ---------- Run 3: lab sizes, about 4 per lab ----------

async function sizingRun() {
  const join = (name) => fetch(`${BASE}/api/join`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
  }).then((r) => r.json());
  const sizes = async () => {
    const { labs } = await adminState();
    return [...labs.filter((l) => !l.practice).map((l) => l.members.length).sort((a, b) => b - a), ...labs.filter((l) => l.practice).map(() => 'practice')];
  };
  const WANT = { 1: [1, 'practice'], 2: [2, 'practice'], 4: [2, 2], 5: [3, 2], 7: [4, 3], 10: [4, 3, 3], 12: [4, 4, 4], 13: [4, 3, 3, 3] };
  for (const [n, want] of Object.entries(WANT)) {
    ok(await adminPost('reset'), 'Reset');
    for (let i = 0; i < n; i++) ok(await join(`P${i}`), `join P${i}`);
    assert.deepEqual(await sizes(), want, `${n} people`);
  }
  // Step 1 locks the labs; a late joiner goes to the smallest lab.
  while ((await adminState()).session.step < 1) ok(await adminPost('next'), 'Next');
  ok(await join('Late'), 'a late joiner');
  assert.deepEqual(await sizes(), [4, 4, 3, 3], 'a late joiner goes to the smallest lab');
  // The teacher can still force one big lab before Step 1, with a warning; Auto goes back.
  ok(await adminPost('reset'), 'Reset');
  for (let i = 0; i < 12; i++) ok(await join(`P${i}`), `join P${i}`);
  const forced = ok(await adminPost('labs', { count: 1 }), 'force 1 lab');
  assert.equal(forced.result.message, '1 lab, plus the practice lab. Warning: 12 people in one lab leaves hands idle. About 4 per lab works best.');
  assert.deepEqual(await sizes(), [12, 'practice']);
  ok(await adminPost('labs', { count: 'auto' }), 'Auto');
  assert.deepEqual(await sizes(), [4, 4, 4]);
  checkClean('Lab sizes');
  log(`lab sizes: ${Object.entries(WANT).map(([n, want]) => `${n} → ${want.join('+')}`).join(' · ')}; a late joiner → the smallest lab; 1 big lab only when forced, with a warning`);
}

// ---------- All runs ----------

const DIRS = ['class', 'practice', 'sizes'].map((run) => `/tmp/ol_e2e_${PORT}_${run}`);

async function fresh(dir) {
  dataDir = dir;
  fs.rmSync(dataDir, { recursive: true, force: true });
  await startServer();
}

async function closeAll() {
  quiet = true;
  for (const page of WHO.keys()) await page.context().close().catch(() => {});
  WHO.clear();
  for (const name of Object.keys(S)) delete S[name];
  scene = 0;
  quiet = false;
}

let failed = false;
const started = Date.now();
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
try {
  browser = await chromium.launch();
  await fresh(DIRS[0]);
  await classRun();
  await closeAll();
  await stopServer();
  await fresh(DIRS[1]);
  await practiceRun();
  await closeAll();
  await stopServer();
  await fresh(DIRS[2]);
  await sizingRun();
  log(`\nAll runs passed in ${Math.round((Date.now() - started) / 1000)} s. Screenshots: ${SHOTS}`);
} catch (err) {
  failed = true;
  console.error(`\nFAILED: ${err.stack || err}`);
  if (problems.length) console.error(`--- page problems\n${problems.join('\n')}`);
  if (serverErr) console.error(`--- server errors\n${serverErr}`);
  for (const [page, who] of WHO) await page.screenshot({ path: `${SHOTS}/FAILED-${who}.png`, fullPage: true }).catch(() => {});
  console.error(`--- what every page showed: ${SHOTS}/FAILED-*.png\n--- the repos are kept in ${dataDir}`);
} finally {
  quiet = true;
  await browser?.close();
  await stopServer();
  if (!failed) for (const dir of DIRS) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
