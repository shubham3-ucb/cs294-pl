// A whole class in a real browser: the teacher page, the projector and 3 labs x 3 students
// (one browser context each) walk Steps 0 to 8 by clicking the real UI. Proves SPEC §8.
// Starts its own server on 127.0.0.1:3102 with a fresh DATA_DIR=/tmp/ml_e2e and ADMIN_KEY=test, and
// always stops it. Screenshots go to e2e/shots/. Any failed check, console error or warning, page
// error, failed request, 5xx or server error output fails the run.
//   npx playwright install --only-shell chromium   (once)
//   npm run e2e
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(APP, 'e2e', 'shots');
const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const KEY = 'test';
const DATA_DIR = '/tmp/ml_e2e';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const WAIT = 10_000;

const LABS = { 1: ['Ana', 'Raj', 'Mei'], 2: ['Priya', 'Tom', 'Lea'], 3: ['Sam', 'Kim', 'Ola'] }; // pairs A, B, A
const LEADS = ['Ana', 'Priya', 'Sam']; // one student per lab in the screenshots
const MAIN_LOCKED = 'main is the approved monster. Make or switch to a sticky note first.';
const REFUSED = "Refused: the Wall has cards you don't have. Press Get & combine first.";
const SENT = /^Sent! The Wall moved to [0-9a-f]{7}\.$/;
const API = { commit: 'commit', switch: 'switch', tomain: 'switch', merge: 'merge', push: 'push', pull: 'pull', reflog: 'reflog' };

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Server ----------

let server = null;
let serverErr = '';
async function startServer() {
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: APP, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR, ADMIN_KEY: KEY },
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
  const cwd = repo === 'wall' ? path.join(DATA_DIR, 'wall.git') : path.join(DATA_DIR, 'labs', repo);
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).trim();
  } catch (err) {
    if (err.status === 1) return String(err.stdout).trim(); // merge-tree: 1 = conflict
    throw err;
  }
}
const tipIn = (repo, note = 'main') => gitIn(repo, 'rev-parse', `refs/heads/${note}`);

// ---------- Browser ----------

let browser = null;
const NAMES = new Map(); // page → who
const problems = [];
let quiet = false; // while the server restarts, refused connections are expected

async function open(who, url) {
  const page = await (await browser.newContext({ viewport: DESKTOP })).newPage();
  NAMES.set(page, who);
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
    if (who === 'Teacher') return d.accept(); // Next into Step 4, Rescue and Reset ask first
    problems.push(`${who}: unexpected browser dialog "${d.message()}"`);
    return d.dismiss();
  });
  await page.goto(BASE + url);
  return page;
}

function checkClean(where) {
  const errors = [...problems, ...(serverErr.trim() ? [`server: ${serverErr.trim()}`] : [])];
  if (errors.length) throw new Error(`${where}: something went wrong underneath:\n  ${errors.join('\n  ')}`);
}

// Poll until check() is truthy. `got` describes what was there last, for the failure message.
async function until(what, check, got = () => '') {
  const end = Date.now() + WAIT;
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

async function sees(p, sel, pattern, what = `${NAMES.get(p)} sees ${pattern} in ${sel}`) {
  let text = '';
  await until(what, async () => matches((text = await textOf(p, sel)), pattern), () => JSON.stringify(text));
}
const shown = (p, sel) => p.locator(sel).first().isVisible();
const count = (p, sel) => p.locator(sel).count();

// Cards in a graph, left to right: {id, x, author, message}. Each card's <title> reads "id7 · author · message".
const cardsIn = (p, svg) => p.$$eval(`${svg} .g-card`, (els) => els.map((e) => {
  const [, author, ...message] = (e.querySelector('title')?.textContent ?? '').split(' · ');
  return { id: e.dataset.key, x: Number(e.dataset.x), author, message: message.join(' · ') };
}).sort((a, b) => a.x - b.x));
const newestIn = async (p, svg) => (await cardsIn(p, svg)).at(-1)?.id;
// The card a sticky note sits on (notes sit right above their card, at the same x).
const noteIn = (p, svg, note) => p.$eval(svg, (s, name) => {
  const n = [...s.querySelectorAll('.g-note')].find((e) => e.dataset.key === name);
  return n && [...s.querySelectorAll('.g-card')].find((c) => c.dataset.x === n.dataset.x)?.dataset.key;
}, note);

// Click something that calls the API; check the student sees the server's words as a toast.
async function hit(p, selector, api, clickOpts = {}) {
  const [res] = await Promise.all([
    p.waitForResponse((r) => new URL(r.url()).pathname === `/api/${api}`),
    p.locator(selector).first().click(clickOpts),
  ]);
  const json = await res.json();
  const words = json.ok ? json.result?.message : json.error;
  if (words) await sees(p, '#toasts', words, `${NAMES.get(p)} sees the toast "${words}"`);
  return json;
}
// Action-row buttons. Sentence buttons hold a dropdown, so press near the corner, on the words' side.
const press = (p, act) => hit(p, `#actions [data-act="${act}"]`, API[act], { position: { x: 10, y: 10 } });
const ok = (r, what) => { assert.ok(r.ok, `${what}: ${r.error}`); return r; };

async function pick(p, part, slug) {
  await p.click(`#draft [data-part="${part}"]`);
  const [res] = await Promise.all([
    p.waitForResponse((r) => /^\/api\/(draft|chaos)$/.test(new URL(r.url()).pathname)),
    p.click(`#popover [data-slug="${slug}"]`),
  ]);
  ok(await res.json(), `${NAMES.get(p)}: ${part} → ${slug}`);
}

async function newNote(p, name) {
  await p.click('#actions [data-act="branch"]');
  assert.equal(await p.inputValue('#popover input'), name, `${NAMES.get(p)}: the note name is pre-filled`);
  return hit(p, '#popover button.primary', 'branch');
}

async function switchTo(p, note) {
  await p.selectOption('#actions select[data-pick="switch"]', note);
  ok(await press(p, 'switch'), `${NAMES.get(p)}: switch to ${note}`);
  await sees(p, '#on-note', note);
}

async function mergeIn(p, note) {
  await p.selectOption('#actions select[data-pick="merge"]', note);
  return ok(await press(p, 'merge'), `${NAMES.get(p)}: merge ${note}`);
}

async function openCard(p, id) {
  await p.click(`#graph .g-card[data-key="${id}"]`);
  await until(`${NAMES.get(p)} opens card ${id.slice(0, 7)}`, () => p.$eval('#card-dialog', (d) => d.open));
}
const closeDialog = (p, id) => p.click(`#${id} [data-close]`);
const goalsDone = (p) => until(`${NAMES.get(p)}: every goal ticks`, async () =>
  (await count(p, '#mission .goals li')) > 0 && (await count(p, '#mission .goals li:not(.done)')) === 0,
() => textOf(p, '#mission .goals'));

// ---------- The teacher ----------

let admin = null;
let screen = null;
const S = {}; // student name → page
const students = () => Object.values(S);

async function tool(selector, api) {
  const [res] = await Promise.all([
    admin.waitForResponse((r) => new URL(r.url()).pathname === `/api/admin/${api}`),
    admin.click(selector),
  ]);
  const json = ok(await res.json(), `Teacher: ${api}`);
  if (json.result?.message) await sees(admin, '#tool-result', json.result.message);
  return json;
}

async function next(step, labId) {
  if (labId) await admin.selectOption('#step-lab-select', labId);
  await tool('#next', 'step');
  await sees(admin, '#step-title', `Step ${step} ·`);
  await Promise.all(students().map((p) => sees(p, '#crumbs', `Step ${step} ·`)));
  await sees(screen, '#s-title', step === 8 ? 'What you built' : `Step ${step}`);
}

// One shot per lab, the teacher page and the projector, once old toasts have faded.
async function shoot(tag) {
  await Promise.all(LEADS.map((name) => until(`${name}'s toasts fade`, async () => !(await count(S[name], '#toasts .toast')))));
  await sleep(300); // let cards and notes finish gliding
  await Promise.all([
    ...LEADS.map((name, i) => S[name].screenshot({ path: `${SHOTS}/${tag}-lab${i + 1}-student.png`, fullPage: true })),
    admin.screenshot({ path: `${SHOTS}/${tag}-admin.png`, fullPage: true }),
    screen.screenshot({ path: `${SHOTS}/${tag}-screen.png` }),
  ]);
}

// One page's view (dialogs fade in first).
async function snap(p, name) {
  await sleep(400);
  await p.screenshot({ path: `${SHOTS}/${name}.png` });
}

// The same student on a phone: nothing may stick out sideways.
async function phoneShot(p, tag) {
  await p.setViewportSize(PHONE);
  await sleep(400);
  const wider = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(wider <= 0, `${tag}: the student page is ${wider}px wider than a 390px phone`);
  await p.screenshot({ path: `${SHOTS}/${tag}-mobile.png`, fullPage: true });
  await p.setViewportSize(DESKTOP);
}

// Stop the server mid-session, leave a stale lock behind (a kill mid-update-ref does that), start again.
async function restart() {
  quiet = true;
  await stopServer();
  await until('Ana sees the grey "reconnecting" dot', () => shown(S.Ana, '#crumbs .lab-dot.offline'));
  const lock = path.join(DATA_DIR, 'labs', '1', '.git', 'refs', 'heads', 'main.lock');
  fs.writeFileSync(lock, '');
  await startServer();
  assert.ok(!fs.existsSync(lock), 'the server removes stale lock files on boot');
  await Promise.all(students().map((p) => until(`${NAMES.get(p)} reconnects`, async () => !(await shown(p, '#crumbs .lab-dot.offline')))));
  await until('the teacher page reconnects', async () => !(await admin.$eval('#conn', (e) => e.classList.contains('off'))));
  await sleep(500);
  quiet = false;
}

// ---------- The class ----------

async function run() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  await startServer();
  browser = await chromium.launch();

  admin = await open('Teacher', `/admin?key=${KEY}`);
  screen = await open('Projector', `/screen?key=${KEY}`);
  for (const names of Object.values(LABS)) for (const name of names) S[name] = await open(name, '/');

  // ---------- Join ----------
  await S.Ana.click('#join-form button[type=submit]');
  await sees(S.Ana, '#join-error', 'Type your name (a letter or digit).');
  for (const [lab, names] of Object.entries(LABS)) {
    for (const name of names) {
      const p = S[name];
      await p.fill('#join-name', name);
      await p.click(`#join-labs [data-lab="${lab}"]`);
      await p.click('#join-form button[type=submit]');
      await sees(p, '#crumbs', `Lab ${lab} · ${name} · Step 0`);
    }
  }
  await sees(screen, '#s-labs', 'Ana, Raj, Mei');
  await sees(admin, '#people', '9 people · 9 online');
  assert.ok(await shown(screen, '#s-join img'), 'the projector shows the QR code on Step 0');
  checkClean('Join');
  log('join: 9 students in 3 labs');

  // ---------- Step 0: one shared monster per lab, live, and no history ----------
  await pick(S.Ana, 'legs', 'wheels');
  await sees(S.Raj, '#draft [data-part="legs"]', 'wheels');
  await pick(S.Raj, 'face', 'frog');
  await sees(S.Ana, '#draft [data-part="face"]', 'frog');
  await sees(screen, '#s-labs .s-lab:first-child .monster', '🐸');
  assert.match(await textOf(S.Priya, '#draft [data-part="legs"]'), /sticks/, "Lab 2's monster is its own");
  await S.Mei.click('#draft [data-part="face"]');
  assert.equal(await count(S.Mei, '#popover [data-slug="cat"]'), 0, 'cat only appears in Step 2');
  await S.Mei.keyboard.press('Escape');
  for (const lab of Object.keys(LABS)) assert.equal(gitIn(lab, 'rev-list', '--all', '--count'), '1', `Lab ${lab} has only the Start card`);
  assert.ok(!(await shown(S.Ana, '#table')) && !(await shown(S.Ana, '#actions')), 'Step 0 shows no cards and no buttons');
  await shoot('s00-chaos');
  checkClean('Step 0');
  log('step 0: shared live monster, no history');

  // ---------- Step 1: everyone saves; the graph is a chain with authors ----------
  await next(1);
  const CHANGES = [['face', 'frog', 'FACE: smiley → frog'], ['body', 'coat', 'BODY: box → coat'], ['legs', 'duck', 'LEGS: sticks → duck']];
  await Promise.all(Object.values(LABS).map(async (names) => {
    for (const [i, name] of names.entries()) { // inside a lab, people take turns
      await pick(S[name], CHANGES[i][0], CHANGES[i][1]);
      await sees(S[name], '#draft-status', '1 part not saved yet');
      const r = ok(await press(S[name], 'commit'), `${name}: Save card`);
      assert.match(r.result.message, /^Saved card [0-9a-f]{7}\.$/);
      await sees(S[name], '#draft-status', 'All saved');
    }
  }));
  for (const [lab, names] of Object.entries(LABS)) {
    const p = S[names[0]];
    const cards = await until(`Lab ${lab} shows 4 cards`, async () => { const c = await cardsIn(p, '#graph'); return c.length === 4 && c; });
    assert.deepEqual(cards.map((c) => c.author), ['Monster Lab', ...names], `Lab ${lab}: authors, oldest first`);
    assert.deepEqual(cards.map((c) => c.message), ['Start', ...CHANGES.map((c) => c[2])], `Lab ${lab}: automatic messages`);
    const chain = gitIn(lab, 'log', '--reverse', '--format=%H %P', 'refs/heads/main').split('\n').map((l) => l.trim().split(' '));
    chain.forEach(([id, ...parents], i) => {
      assert.equal(id, cards[i].id, `Lab ${lab}: card ${i} in the graph is Git's`);
      assert.deepEqual(parents, i ? [chain[i - 1][0]] : [], `Lab ${lab}: each card points to the one before`);
    });
    assert.equal(await count(p, '#graph .g-edges path'), 3, `Lab ${lab}: 3 arrows`);
    await sees(p, '#mission .goals li.done', 'Everyone saved a card (3/3)');
    await sees(p, '#mission .bonus', 'Click the oldest card');
  }
  const nothing = await press(S.Ana, 'commit');
  assert.equal(nothing.result.message, 'Nothing changed — nothing to save.');
  // Bonus: the oldest card, and what Git stored.
  const startId = (await cardsIn(S.Ana, '#graph'))[0].id;
  await openCard(S.Ana, startId);
  await sees(S.Ana, '#card-dialog .facts', 'None. This is the Start card.');
  await S.Ana.click('#card-dialog .stored summary');
  await sees(S.Ana, '#card-dialog .stored-body', /tree [0-9a-f]{40}/);
  await closeDialog(S.Ana, 'card-dialog');
  // The pause question goes on the projector.
  await admin.click('#ask');
  await sees(screen, '#s-line.ask', 'Why do arrows point back');
  await until('students see the question highlighted', () => shown(S.Sam, '#mission .ask.on'));
  await phoneShot(S.Ana, 's01-commit');
  await shoot('s01-commit');
  await admin.click('#ask');
  await until('the question leaves the projector', async () => !(await screen.$eval('#s-line', (e) => e.classList.contains('ask'))));
  for (const lab of Object.keys(LABS)) await sees(admin, `#labs .lab:nth-child(${lab}) .chip.on`, 'Save');
  checkClean('Step 1');
  log('step 1: 4 cards per lab, a chain with authors, nothing to save, goals tick');

  // ---------- Step 2: main is read-only; two sticky notes from main ----------
  await next(2);
  await S.Ana.click('#draft [data-part="face"]');
  await sees(S.Ana, '#toasts', MAIN_LOCKED);
  assert.ok(!(await shown(S.Ana, '#popover')), 'no palette on main in Step 2');
  await sees(S.Ana, '#draft-status', MAIN_LOCKED);
  await S.Ola.click('#mission [data-pair]');
  await sees(S.Ola, '#mission .mission-box', /superhero.*Pair B/);
  await S.Ola.click('#mission [data-pair]');
  await sees(S.Ola, '#mission .mission-box', /cat-robot.*Pair A/);
  await Promise.all(Object.entries(LABS).map(async ([lab, [a, b, a2]]) => {
    ok(await newNote(S[a], 'cat-robot'), `${a}: new sticky note`);
    await sees(S[a], '#on-note', 'cat-robot');
    assert.equal(tipIn(lab, 'cat-robot'), tipIn(lab, 'main'), `Lab ${lab}: cat-robot starts on main's card`);
    const twice = await newNote(S[a2], 'cat-robot');
    assert.equal(twice.error, 'cat-robot already exists. Press Switch to join it.');
    await S[a2].keyboard.press('Escape');
    await switchTo(S[a2], 'cat-robot');
    await pick(S[a], 'face', 'cat');
    await sees(S[a2], '#draft [data-part="face"]', /cat.*not saved/); // one shared draft per note
    await pick(S[a2], 'body', 'robot');
    ok(await press(S[a2], 'commit'), `${a2}: save cat-robot`);
    ok(await newNote(S[b], 'superhero'), `${b}: new sticky note`);
    assert.equal(tipIn(lab, 'superhero'), tipIn(lab, 'main'), `Lab ${lab}: superhero starts on main's card`);
    await pick(S[b], 'body', 'superhero');
    await pick(S[b], 'legs', 'tentacles');
    ok(await press(S[b], 'commit'), `${b}: save superhero`);
  }));
  for (const name of LEADS) await goalsDone(S[name]);
  // A refresh keeps who you are and where your pin is.
  await S.Mei.reload();
  await sees(S.Mei, '#crumbs', 'Lab 1 · Mei · Step 2');
  await sees(S.Mei, '#on-note', 'cat-robot');
  await shoot('s02-branch');
  checkClean('Step 2');
  log('step 2: main read-only, cat-robot + superhero from main, "already exists", refresh keeps identity');

  // ---------- Step 3: fast-forward, then a BODY conflict; cancel; a second student finishes ----------
  await next(3);
  await sees(S.Ana, '#mission .fixed-line', 'One person presses, everyone watches. Swap each step.');
  await sees(S.Ana, '#actions', 'Switch to main first');
  await Promise.all(students().map(async (p) => ok(await press(p, 'tomain'), `${NAMES.get(p)}: back to main`)));
  await Promise.all(students().map((p) => sees(p, '#on-note', 'main')));

  // The resolver's per-part view must say exactly what Git's conflict markers say.
  async function resolverIsGit(p, lab) {
    await until(`${NAMES.get(p)}'s resolver opens`, () => p.$eval('#resolver-dialog', (d) => d.open));
    const view = await p.$eval('#resolver-dialog', (d) => ({
      conflicts: [...d.querySelectorAll('.rrow.conflict')].map((r) => [r.querySelector('.pname').textContent.toLowerCase(),
        [...r.querySelectorAll('.opt[data-slug]')].map((o) => o.dataset.slug)]),
      auto: [...d.querySelectorAll('.rrow.auto')].map((r) => [r.querySelector('.pname').textContent.toLowerCase(),
        r.querySelector('.val').textContent.trim().split(' ').at(-1)]),
      text: d.querySelector('.conflict-text').textContent,
      finish: d.querySelector('[data-finish]').disabled,
    }));
    const tree = gitIn(lab, 'merge-tree', '--write-tree', 'main', 'superhero').split('\n')[0];
    const gitText = gitIn(lab, 'cat-file', '-p', `${tree}:monster.txt`);
    assert.equal(view.text.trim(), gitText, `Lab ${lab}: the resolver shows Git's own monster.txt`);
    const marked = [...gitText.matchAll(/^<{7} main\n(\w+): (\S+)\n={7}\n\w+: (\S+)\n>{7} superhero$/gm)].map(([, part, ours, theirs]) => [part, [ours, theirs]]);
    const clean = gitText.replace(/^<{7}[\s\S]*?^>{7}.*$/gm, '').match(/^\w+: \S+$/gm).map((l) => l.split(': '));
    assert.deepEqual(view.conflicts, marked, `Lab ${lab}: conflicted parts and sides = Git's markers`);
    assert.deepEqual(view.auto, clean, `Lab ${lab}: auto-merged parts = Git's clean lines`);
    assert.deepEqual(marked.map(([part]) => part), ['body'], 'only BODY conflicts');
    assert.deepEqual(view.auto, [['face', 'cat'], ['legs', 'tentacles']], 'FACE and LEGS combine on their own');
    assert.equal(view.finish, true, 'Finish merge waits for a choice');
  }

  async function fastForward(p, lab) {
    const r = await mergeIn(p, 'cat-robot');
    assert.equal(r.result.fastForward, true, `Lab ${lab}: cat-robot is a fast-forward`);
    assert.equal(tipIn(lab), tipIn(lab, 'cat-robot'));
    await sees(p, '#behind-body .last', 'Merge cat-robot into main → fast-forward');
  }

  async function finish(p) {
    const r = ok(await hit(p, '#resolver-dialog [data-finish]', 'resolve'), `${NAMES.get(p)}: finish merge`);
    assert.equal(r.result.parents.length, 2, 'the merge card has two parents');
    await until(`${NAMES.get(p)}'s resolver closes`, async () => !(await p.$eval('#resolver-dialog', (d) => d.open)));
    return r;
  }

  await Promise.all([
    (async () => { // Lab 1: Ana merges, Raj opens the same merge from the banner and finishes it.
      await fastForward(S.Ana, '1');
      assert.equal((await mergeIn(S.Ana, 'superhero')).result.conflict, true);
      await resolverIsGit(S.Ana, '1');
      await snap(S.Ana, 's03-merge-resolver-lab1-student');
      await sees(S.Raj, '#banner', 'Merging superhero into main. BODY needs a choice.');
      await phoneShot(S.Raj, 's03-merge');
      await S.Raj.click('#banner [data-open-resolver]');
      await S.Raj.click('#resolver-dialog [data-choose="body"][data-slug="robot"]');
      await finish(S.Raj);
      await until("Ana's resolver closes too", async () => !(await S.Ana.$eval('#resolver-dialog', (d) => d.open)));
      assert.equal(gitIn('1', 'rev-list', '--parents', '-n', '1', 'refs/heads/main').split(' ').length, 3);
      await openCard(S.Ana, tipIn('1'));
      await sees(S.Ana, '#card-dialog .facts', 'Parents');
      assert.equal(await count(S.Ana, '#card-dialog .facts .id-chip'), 2, 'card details list two parents');
      await closeDialog(S.Ana, 'card-dialog');
    })(),
    (async () => { // Lab 2: Priya cancels; Tom merges again and picks another body.
      await fastForward(S.Priya, '2');
      const before = tipIn('2');
      assert.equal((await mergeIn(S.Priya, 'superhero')).result.conflict, true);
      await resolverIsGit(S.Priya, '2');
      ok(await hit(S.Priya, '#resolver-dialog [data-abort]', 'abort'), 'Priya: cancel merge');
      assert.equal(tipIn('2'), before, 'Cancel merge leaves main unchanged');
      await until('the banner goes', async () => !(await shown(S.Tom, '#banner')));
      assert.equal(await noteIn(S.Priya, '#graph', 'main'), before);
      assert.equal((await mergeIn(S.Tom, 'superhero')).result.conflict, true);
      await until("Tom's resolver opens", () => S.Tom.$eval('#resolver-dialog', (d) => d.open));
      await S.Tom.click('#resolver-dialog [data-another="body"]');
      await S.Tom.click('#resolver-dialog .choices [data-choose="body"][data-slug="shell"]');
      await finish(S.Tom);
    })(),
    (async () => { // Lab 3: Sam merges, Kim finishes from the banner.
      await fastForward(S.Sam, '3');
      assert.equal((await mergeIn(S.Sam, 'superhero')).result.conflict, true);
      await S.Kim.click('#banner [data-open-resolver]');
      await S.Kim.click('#resolver-dialog [data-choose="body"][data-slug="superhero"]');
      await finish(S.Kim);
    })(),
  ]);
  for (const name of LEADS) await goalsDone(S[name]);
  await shoot('s03-merge');
  // The break, after Step 3.
  await tool('#break', 'break');
  await Promise.all(students().map((p) => sees(p, '#mission .break-line', 'Break · back at')));
  await sees(screen, '#s-title', 'Break');
  await sees(screen, '#s-line', 'Back at');
  await sees(admin, '#break', 'End break (back at');
  await shoot('s03-break');
  checkClean('Step 3');
  log('step 3: fast-forward, BODY-only conflict = Git markers, finished by a second student, cancel, break');

  // ---------- Step 4: Lab 2's main goes to the Wall; every lab is a copy ----------
  const lab2Main = tipIn('2');
  await next(4, '2');
  assert.equal(tipIn('wall'), lab2Main, "Lab 2's main is on the Wall");
  for (const lab of Object.keys(LABS)) assert.equal(tipIn(lab), lab2Main, `Lab ${lab} is a copy of the Wall`);
  await Promise.all(students().map(async (p) => {
    const who = NAMES.get(p);
    await sees(p, '#on-note', 'main');
    await until(`${who}: the newest card has the Wall's ID`, async () =>
      (await newestIn(p, '#graph')) === lab2Main && (await newestIn(p, '#wall-graph')) === lab2Main);
    assert.equal(await noteIn(p, '#graph', 'wall/main'), lab2Main, `${who}: the blue wall/main note`);
    assert.match(await textOf(p, '#graph .g-note[data-key="main"]'), /YOU/, `${who}: the pin is on main`);
    assert.equal(await count(p, '#mission .break-line'), 0, `${who}: Next ended the break`);
  }));
  await sees(S.Sam, '#mission .instruction', "Lab 2's monster");
  assert.ok(await shown(screen, '#s-wall'), 'the projector shows the Wall');
  await shoot('s04-remote');
  checkClean('Step 4');
  log(`step 4: the Wall and all 3 labs have newest card ${lab2Main.slice(0, 7)}; every pin on main`);

  // ---------- Step 5: send; refused; Get & combine with no conflict; send ----------
  await next(5);
  await sees(S.Ana, '#mission .mission-box', 'FACE → 🐲');
  await pick(S.Ana, 'face', 'dragon');
  ok(await press(S.Ana, 'commit'), 'Ana: save');
  assert.match(ok(await press(S.Ana, 'push'), 'Lab 1 sends').result.message, SENT);
  for (const [name, part, value] of [['Priya', 'legs', 'skates'], ['Sam', 'body', 'cactus']]) {
    const p = S[name];
    await pick(p, part, value);
    ok(await press(p, 'commit'), `${name}: save`);
    const refused = await press(p, 'push');
    assert.equal(refused.ok, false, `${name}: the send is refused`);
    assert.equal(refused.error, REFUSED);
    const combined = ok(await press(p, 'pull'), `${name}: Get & combine`);
    assert.equal(combined.result.merged, true, `${name}: Get & combine makes a merge card`);
    assert.ok(!combined.result.conflict && !(await shown(p, '#banner')), `${name}: no conflict`);
    if (name === 'Priya') { // Behind the door: what Git just did, and the low-level steps
      await p.click('#behind > summary');
      await sees(p, '#behind-body .last', 'Get & combine');
      await p.click('#plumbing > summary');
      await sees(p, '#plumbing-list', 'git fetch wall');
      await p.locator('#behind-body').scrollIntoViewIfNeeded();
      await snap(p, 's05-push-behind-lab2-student');
      await p.click('#behind > summary');
    }
    assert.match(ok(await press(p, 'push'), `${name}: send again`).result.message, SENT);
  }
  for (const name of ['Ana', 'Priya']) ok(await press(S[name], 'pull'), `${name}: catch up`);
  for (const name of LEADS) await goalsDone(S[name]);
  await sees(admin, '#feed li.bad', 'Lab 2 · Priya — Send to Wall → refused');
  // 8 sends at once, with new cards in Labs 1 and 3: one is sent, the rest are refused or already there.
  await pick(S.Raj, 'body', 'donut');
  ok(await press(S.Raj, 'commit'), 'Raj: save');
  await pick(S.Kim, 'legs', 'paws');
  ok(await press(S.Kim, 'commit'), 'Kim: save');
  const senders = ['Ana', 'Raj', 'Mei', 'Priya', 'Tom', 'Sam', 'Kim', 'Ola'];
  const sends = await Promise.all(senders.map((name) => press(S[name], 'push')));
  const said = sends.map((r) => (r.ok ? r.result.message : r.error));
  said.forEach((words, i) => assert.ok(SENT.test(words) || words === REFUSED || words === 'The Wall already has this card.',
    `${senders[i]}: 8 sends at once said "${words}"`));
  assert.equal(said.filter((w) => SENT.test(w)).length, 1, 'exactly one of 8 simultaneous sends goes in');
  log('step 5: 8 sends at once:', said.map((w) => (SENT.test(w) ? 'sent' : w === REFUSED ? 'refused' : 'already')).join(' '));
  // The server restarts mid-session; everyone carries on.
  await restart();
  checkClean('Restart');
  for (const name of LEADS) {
    const r = ok(await press(S[name], 'pull'), `${name}: Get & combine after the restart`);
    assert.ok(!r.result.conflict, `${name}: no conflict`);
    ok(await press(S[name], 'push'), `${name}: send`);
  }
  for (const name of ['Ana', 'Priya']) ok(await press(S[name], 'pull'), `${name}: catch up`);
  for (const name of LEADS) await goalsDone(S[name]);
  await shoot('s05-push');
  checkClean('Step 5');
  log('step 5: sent, refused, combined without conflict, sent; restart with a stale lock recovered');

  // ---------- Step 6: entering puts the mustache on the Wall; undo vs move back ----------
  await next(6);
  const intern = await until('the Wall shows the mustache card', async () =>
    (await cardsIn(S.Ana, '#wall-graph')).find((c) => c.author === 'The Intern' && c.message === 'Tiny style fix'));
  assert.equal(tipIn('wall'), intern.id);
  assert.match(gitIn('wall', 'cat-file', '-p', 'refs/heads/main:monster.txt'), /^face: mustache$/m);
  await until('the projector shows the mustache card', async () => (await cardsIn(screen, '#s-wall-graph')).some((c) => c.id === intern.id));
  await tool('#sabotage', 'sabotage');
  await sees(admin, '#tool-result', 'The mustache is already on the Wall.');
  const beforeMustache = gitIn('wall', 'rev-parse', `${intern.id}^`);
  // Lab 2 (even): get it, move back, send → refused; the diary; Get & combine brings it back.
  ok(await press(S.Priya, 'pull'), 'Priya: Get & combine');
  await sees(S.Priya, '#draft [data-part="face"]', 'mustache');
  await openCard(S.Priya, beforeMustache);
  ok(await hit(S.Priya, '#card-dialog [data-card-act="reset"]', 'reset'), 'Priya: move my note back');
  assert.equal(tipIn('2'), beforeMustache);
  await until('Priya sees the mustache gone', async () => !/mustache/.test(await textOf(S.Priya, '#draft [data-part="face"]')));
  const refused = await press(S.Priya, 'push');
  assert.equal(refused.error, REFUSED, 'a moved-back main is refused');
  ok(await press(S.Priya, 'reflog'), 'Priya: Safety diary');
  await sees(S.Priya, '#diary-dialog .diary li:first-child', /reset: moving to [0-9a-f]{7}/);
  await sees(S.Priya, '#diary-dialog .diary', 'clone: from the Wall');
  await snap(S.Priya, 's06-undo-diary-lab2-student');
  await closeDialog(S.Priya, 'diary-dialog');
  ok(await press(S.Priya, 'pull'), 'Priya: Get & combine again');
  assert.equal(tipIn('2'), intern.id, 'Get & combine brings the mustache card back');
  await sees(S.Priya, '#draft [data-part="face"]', 'mustache');
  // Lab 1 (odd): get it, undo it, send.
  ok(await press(S.Ana, 'pull'), 'Ana: Get & combine');
  await openCard(S.Ana, intern.id);
  await S.Ana.click('#card-dialog .stored summary');
  await sees(S.Ana, '#card-dialog .stored-body', 'face: mustache');
  await snap(S.Ana, 's06-undo-card-lab1-student');
  const undo = ok(await hit(S.Ana, '#card-dialog [data-card-act="revert"]', 'revert'), 'Ana: undo this card');
  assert.ok(undo.result.id, 'undo makes a new fix card');
  await until("Ana's card details close", async () => !(await S.Ana.$eval('#card-dialog', (d) => d.open)));
  await sees(S.Ana, '#draft [data-part="face"]', 'dragon');
  assert.equal((await cardsIn(S.Ana, '#graph')).at(-1).message, 'Revert "Tiny style fix"');
  await openCard(S.Raj, intern.id); // a lab-mate presses Undo too
  const again = await hit(S.Raj, '#card-dialog [data-card-act="revert"]', 'revert');
  assert.equal(again.result?.message, 'Already undone. Nothing to change.');
  assert.match(ok(await press(S.Ana, 'push'), 'Ana: send the fix').result.message, SENT);
  await openCard(S.Ana, startId);
  assert.ok(await S.Ana.locator('#card-dialog [data-card-act="revert"]').isDisabled(), 'the Start card cannot be undone');
  await sees(S.Ana, '#card-dialog .why', "The Start card can't be undone.");
  await closeDialog(S.Ana, 'card-dialog');
  ok(await press(S.Priya, 'pull'), 'Priya: get the fix');
  // Lab 3: the teacher rescues.
  await tool('#labs [data-rescue="3"]', 'rescue');
  await sees(admin, '#tool-result', 'Rescued Lab 3.');
  for (const name of LEADS) await goalsDone(S[name]);
  // A late joiner lands on main, in Step 6, with the lab's cards.
  const zoe = await open('Zoe', '/');
  await zoe.fill('#join-name', 'Zoe');
  await zoe.click('#join-labs [data-lab="3"]');
  await zoe.click('#join-form button[type=submit]');
  await sees(zoe, '#crumbs', 'Lab 3 · Zoe · Step 6');
  await sees(zoe, '#on-note', 'main');
  await sees(zoe, '#mission .mission-box', 'Undo this card');
  await until('Zoe sees the mustache card', async () => (await cardsIn(zoe, '#graph')).some((c) => c.id === intern.id));
  S.Zoe = zoe;
  await shoot('s06-undo');
  checkClean('Step 6');
  log('step 6: mustache on entry; undo + send; move back refused; diary shows the reset; the mustache came back; rescue; late joiner');

  // ---------- Step 7: only the boss sees the button; audit; replace the Wall; audit; empty the bin ----------
  await next(7, '1');
  await sees(S.Ana, '#actions [data-act="squash"]', 'Replace the Wall with one card');
  await sees(S.Raj, '#actions [data-act="squash"]', 'Replace the Wall with one card'); // the whole boss lab
  for (const name of ['Priya', 'Tom', 'Sam', 'Zoe']) assert.equal(await count(S[name], '#actions [data-act="squash"]'), 0, `${name} has no replace button`);
  assert.equal((await press(S.Priya, 'push')).error, 'The boss is cleaning the Wall. Watch.');
  const audit1 = (await tool('#audit', 'audit')).result.audit;
  assert.match(audit1.lines[0], /^Wall: Tom \(Lab 2\), [0-9a-f]{7}$/, 'before: the Wall knows who added the tentacles');
  assert.equal((await press(S.Ana, 'pull')).result.message, 'Nothing new on the Wall.');
  await S.Ana.click('#actions [data-act="squash"]', { position: { x: 10, y: 10 } });
  await sees(S.Ana, '#confirm-dialog', "This erases the Wall's history for everyone. Sure?");
  const forced = ok(await hit(S.Ana, '#confirm-dialog [data-yes]', 'squash-force'), 'Ana: replace the Wall');
  assert.equal(forced.result.forced, true);
  await until("the Wall's history is Start ← Clean", async () =>
    JSON.stringify((await cardsIn(S.Ana, '#wall-graph')).map((c) => c.message)) === '["Start","Clean history"]',
  async () => JSON.stringify((await cardsIn(S.Ana, '#wall-graph')).map((c) => c.message)));
  assert.equal(gitIn('wall', 'log', '--format=%s', 'refs/heads/main'), 'Clean history\nStart');
  const audit2 = (await tool('#audit', 'audit')).result.audit;
  assert.match(audit2.lines[0], /^Wall: (not found|Only the clean card has it\. The real author is gone\.)$/, 'after: the Wall forgot');
  for (const lab of ['2', '3']) assert.ok(audit2.lines.includes(audit1.lines[0].replace('Wall', `Lab ${lab}`)), `Lab ${lab} still knows`);
  await sees(screen, '#s-audits', /Before the clean-up.*Wall: Tom \(Lab 2\).*After the clean-up/i);
  await sees(admin, '#audits', /Before the clean-up.*After the clean-up/i);
  const gc = (await tool('#gc', 'gc')).result.message;
  const bin = gc.match(/^The Wall's bin had (\d+) old cards?\. Now 0\.$/);
  assert.ok(bin && Number(bin[1]) > 0, `gc empties the bin: "${gc}"`);
  for (const name of LEADS) await goalsDone(S[name]);
  await shoot('s07-rewrite');
  checkClean('Step 7');
  log(`step 7: boss-only button, Wall = Start ← Clean, audits "${audit1.lines[0]}" → "${audit2.lines[0]}", ${gc}`);

  // ---------- Step 8: the wrap ----------
  await next(8);
  await Promise.all(students().map((p) => sees(p, '#wrap', 'What your lab did')));
  await sees(S.Ana, '#wrap .concepts li.on', 'Undo with a fix card');
  await sees(screen, '#s-wrap', "Cards never change. Sticky notes move. The Wall copies cards. That's Git.");
  assert.equal(await count(screen, '#s-wrap tbody tr'), 3, 'one summary row per lab');
  const did = {
    1: { on: ['Save', 'Branch', 'Fast-forward', 'Merge', 'Conflict solved', 'Push', 'Pull', 'Revert', 'Force push'], off: ['Reset', 'Diary'] },
    2: { on: ['Save', 'Branch', 'Fast-forward', 'Merge', 'Conflict solved', 'Push', 'Refused push', 'Pull', 'Reset', 'Diary'], off: ['Revert', 'Force push'] },
    3: { on: ['Save', 'Branch', 'Fast-forward', 'Merge', 'Conflict solved', 'Push', 'Refused push', 'Pull'], off: ['Revert', 'Reset', 'Diary', 'Force push'] },
  };
  for (const [lab, { on, off }] of Object.entries(did)) {
    const chips = await admin.$$eval(`#labs .lab:nth-child(${lab}) .chip`, (els) =>
      els.map((e) => [e.firstChild.textContent.trim(), e.classList.contains('on')]));
    const lit = chips.filter(([, isOn]) => isOn).map(([label]) => label);
    for (const label of on) assert.ok(lit.includes(label), `Lab ${lab}: the "${label}" chip is lit (lit: ${lit.join(', ')})`);
    for (const label of off) assert.ok(!lit.includes(label), `Lab ${lab}: the "${label}" chip is not lit`);
  }
  await shoot('s08-wrap');
  checkClean('Step 8');
  log('step 8: wrap summaries; concept chips match what each lab did');

  // ---------- Keys, then Reset sends everyone back to Join ----------
  assert.equal((await fetch(`${BASE}/admin`)).status, 403);
  assert.equal((await fetch(`${BASE}/api/admin/state`)).status, 401);
  await tool('#reset', 'reset');
  await Promise.all(students().map((p) => until(`${NAMES.get(p)} is back on Join`, () => shown(p, '#join'))));
  assert.equal(await S.Ana.inputValue('#join-name'), 'Ana', 'the name is remembered');
  await sees(admin, '#step-title', 'Step 0 ·');
  checkClean('Reset');
  log('reset: everyone joins again');
}

let failed = false;
const started = Date.now();
try {
  await run();
  log(`\nAll steps passed in ${Math.round((Date.now() - started) / 1000)} s. Screenshots: ${SHOTS}`);
} catch (err) {
  failed = true;
  console.error(`\nFAILED: ${err.stack || err}`);
  if (problems.length) console.error(`--- page problems\n${problems.join('\n')}`);
  if (serverErr) console.error(`--- server errors\n${serverErr}`);
  for (const [page, who] of NAMES) await page.screenshot({ path: `${SHOTS}/FAILED-${who}.png`, fullPage: true }).catch(() => {});
  console.error(`--- what every page showed: ${SHOTS}/FAILED-*.png\n--- the repos are kept in ${DATA_DIR}`);
} finally {
  quiet = true;
  await browser?.close();
  await stopServer();
  if (!failed) fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
