// Robustness probe: a whole class hammering one real server over HTTP and SSE.
// Two students in one lab pressing Save / Merge / Finish / Send at the same moment, double clicks,
// a refresh and a restart in the middle of a conflict, a late joiner, the teacher going back a step,
// Reset mid-class, crashes mid-save and mid-merge, stale lock files, a half-cloned lab, invalid input,
// and 40 live clients for SSE_SECONDS (default 120) while memory and CPU are sampled.
// Then two students in real browsers double-click Save, Merge and Finish and reload mid-conflict.
// Starts its own server on 127.0.0.1:3103 with a fresh DATA_DIR=/tmp/ml_stress and ADMIN_KEY=test,
// and always stops it. Any 5xx, server error output, unexplained message or corrupt repo fails the run.
//   npm run stress            (SSE_SECONDS=20 npm run stress for a quick run)
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3103;
const BASE = `http://127.0.0.1:${PORT}`;
const KEY = 'test';
const DATA_DIR = '/tmp/ml_stress';
const SSE_SECONDS = Number(process.env.SSE_SECONDS ?? 120);
const SSE_CLIENTS = 40;

const SENT = /^Sent! The Wall moved to [0-9a-f]{7}\.$/;
const REFUSED = "Refused: the Wall has cards you don't have. Press Get & combine first.";
const ALREADY_SENT = 'The Wall already has this card.';
const SAVED = /^Saved card [0-9a-f]{7}\.$/;
const SAVED_BY = /^Already saved by .+: card [0-9a-f]{7}\.$/;
const CLOSED = 'Someone already finished or cancelled this merge.';
const MERGING = 'Finish or cancel the merge first.';
const UNSAVED = "Save your changes first. Git won't overwrite unsaved work.";
const MAIN_LOCKED = 'main keeps the monster you have. Make or switch to a sticky note to edit.'; // Step 2
const BAD_NAME = 'Use a–z, 0–9 and dashes, up to 20.';
const NOT_A_CARD = "That card isn't in your lab's cards.";
const notYet = (n) => `Not yet — this unlocks in Step ${n}.`;

// Every error a student or teacher can see must be one of the app's own sentences.
const KNOWN = [
  UNSAVED, MERGING, MAIN_LOCKED, 'In this step, main changes only by merging.', REFUSED, BAD_NAME, NOT_A_CARD, 'Switch to main first.',
  'Look only in this step. You change main in Step 5.',
  'The boss is cleaning the Wall. Watch.', 'Someone in your lab changed this note meanwhile. Press again.',
  'Busy, press again.', 'Please join again.', 'Pick a part from the list.', 'Pairs are set in Step 2.',
  'That round is over. Use your draft.', '"wall" is the Wall\'s name. Pick another.', 'That sticky note does not exist.',
  'Pick another sticky note to merge.',
  "The Start card can't be undone.", "That card isn't on the Wall.", 'Only the boss lab can do this.',
  'Type your name (a letter or digit).', 'Pick your lab.', 'Pick a value for every part.', 'No such step.',
  'Pick 2 to 6 labs.', 'Set the number of labs before Step 1.', 'Pick a person and a lab.',
  'Bad request.', 'Wrong or missing key.', 'No such thing.',
  /^Not yet — this unlocks in Step \d\.$/, /^[a-z0-9-]+ already exists\. Press Switch to join it\.$/,
  /^This card isn't in [a-z0-9-]+'s history\.$/,
];

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];

async function until(what, check) {
  for (const end = Date.now() + 10_000; !(await check());) {
    if (Date.now() > end) throw new Error(`Timed out waiting: ${what}`);
    await sleep(100);
  }
}

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

async function stopServer(signal = 'SIGTERM') {
  if (!server) return;
  const exited = new Promise((r) => server.once('exit', r));
  server.kill(signal);
  await exited;
  server = null;
}

// Memory (RSS, MB) and CPU time (seconds) of the server process, from /proc.
function usage() {
  const rss = Number(/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${server.pid}/status`, 'utf8'))[1]) / 1024;
  const stat = fs.readFileSync(`/proc/${server.pid}/stat`, 'utf8').split(') ')[1].split(' ');
  return { rss, cpu: (Number(stat[11]) + Number(stat[12])) / 100 };
}

// ---------- HTTP ----------

async function call(method, url, body, headers = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { ok: false, error: text }; }
  if (res.status >= 500) problems.push(`${res.status} from ${method} ${url}: ${text}`);
  if (json.ok === false && !KNOWN.some((k) => (k instanceof RegExp ? k.test(json.error) : k === json.error))) {
    problems.push(`unexplained message from ${method} ${url}: ${JSON.stringify(json.error)}`);
  }
  return { status: res.status, ...json };
}

const post = (url, body) => call('POST', url, body);
const get = (url, query) => call('GET', `${url}?${new URLSearchParams(query)}`);
const act = (who, action, body = {}) => post(`/api/${action}`, { pid: who.pid, ...body });
const look = (who, action, query = {}) => get(`/api/${action}`, { pid: who.pid, ...query });
const stateOf = (who) => get('/api/state', { pid: who.pid });
const admin = (action, body = {}) => call('POST', `/api/admin/${action}`, body, { 'x-admin-key': KEY });
const adminState = () => call('GET', '/api/admin/state', undefined, { 'x-admin-key': KEY });

// What the student reads: the toast for a success, the error otherwise.
const words = (r) => (r.ok ? r.result?.message ?? 'ok' : r.error);
const tally = (rs) => rs.map(words).reduce((t, w) => ({ ...t, [w]: (t[w] ?? 0) + 1 }), {});
const count = (rs, pattern) => rs.filter((r) => pattern.test(words(r))).length;
const okay = (r, what) => { assert.ok(r.ok, `${what}: ${r.error}`); return r; };

// The same click from several students at once.
const together = (people, fn) => Promise.all(people.map(fn));

async function step(n, labId) {
  okay(await admin('step', { step: n, labId }), `Next to Step ${n}`);
}

// ---------- Git, straight from disk ----------

function gitIn(repo, ...args) {
  const cwd = repo === 'wall' ? path.join(DATA_DIR, 'wall.git') : path.join(DATA_DIR, 'labs', repo);
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
}
const tipIn = (repo, note = 'main') => gitIn(repo, 'rev-parse', `refs/heads/${note}`);
const parentsOf = (repo, id) => gitIn(repo, 'rev-list', '--parents', '-n', '1', id).split(' ').slice(1);
const monsterIn = (repo, id) => Object.fromEntries(gitIn(repo, 'cat-file', '-p', `${id}:monster.txt`)
  .split('\n').filter((l) => l !== '---').map((l) => l.split(': ')));
const repos = () => ['wall', ...fs.readdirSync(path.join(DATA_DIR, 'labs'))];

// No corrupt objects or refs, and no lock file left behind anywhere.
function checkRepos(where) {
  for (const repo of repos()) {
    try {
      gitIn(repo, 'fsck', '--strict', '--no-dangling', '--no-progress');
    } catch (err) {
      problems.push(`${where}: git fsck failed in ${repo}: ${err.stderr || err.message}`);
    }
  }
  const locks = execFileSync('find', [DATA_DIR, '-name', '*.lock'], { encoding: 'utf8' }).trim();
  if (locks) problems.push(`${where}: lock files left behind: ${locks}`);
}

function checkClean(where) {
  checkRepos(where);
  const errors = [...problems, ...(serverErr.trim() ? [`server: ${serverErr.trim()}`] : [])];
  if (errors.length) throw new Error(`${where}:\n  ${errors.join('\n  ')}`);
  log(`ok  ${where}`);
}

// The session must agree with Git: no saved part shows as "not saved", and an open merge
// still starts from its note's card (else Finish could never land).
async function checkSessionMatchesGit(people) {
  for (const labId of new Set(people.map((w) => w.labId))) {
    const { lab } = await stateOf(people.find((w) => w.labId === labId));
    for (const [note, draft] of Object.entries(lab.drafts)) {
      const card = lab.graph.commits.find((x) => x.id === lab.branches[note])?.monster ?? {};
      for (const [part, value] of Object.entries(draft)) {
        if (card[part] === value) problems.push(`Lab ${labId}: ${note}'s draft shows ${part}=${value} as not saved, but the card has it`);
      }
    }
    for (const [note, open] of Object.entries(lab.merging)) {
      if (open.intoTip !== lab.branches[note]) problems.push(`Lab ${labId}: the open merge on ${note} starts from a card ${note} left`);
    }
  }
}

// ---------- People ----------

async function joinAs(name, labId) {
  const r = okay(await post('/api/join', { name, labId }), `${name} joins Lab ${labId}`);
  return { pid: r.pid, name, labId: String(labId), pair: r.pair };
}

async function joinClass(perLab) {
  const lab = {};
  for (const [labId, names] of Object.entries(perLab)) {
    lab[labId] = [];
    for (const name of names) lab[labId].push(await joinAs(name, labId));
  }
  return lab;
}

// ---------- Scenarios ----------

async function invalidInput() {
  const bad = [
    [{ name: '', labId: '1' }, 'Type your name (a letter or digit).'],
    [{ name: '  !!! ', labId: '1' }, 'Type your name (a letter or digit).'],
    [{ name: 'Ana', labId: '9' }, 'Pick your lab.'],
    [{ name: 'Ana', labId: '__proto__' }, 'Pick your lab.'],
    [{ name: 'Ana', labId: { toString: 1 } }, 'Pick your lab.'],
    [{ name: { toString: 1 }, labId: '1' }, 'Type your name (a letter or digit).'],
    [{ name: ['Ana'], labId: ['1'], pid: { toString: 1 } }, null],
  ];
  for (const [body, error] of bad) {
    const r = await post('/api/join', body);
    if (error) assert.equal(r.error, error, `join ${JSON.stringify(body)}`);
  }
  const long = okay(await post('/api/join', { name: `  ${'Z'.repeat(80)}  `, labId: '2' }), 'a long name');
  assert.equal((await stateOf(long)).me.name.length, 24, 'names are cut to 24 characters');
  assert.equal((await post('/api/join', '{"name": "Ana",')).error, 'Bad request.', 'broken JSON');
  assert.equal((await post('/api/join', { name: 'x'.repeat(40_000), labId: '1' })).error, 'Bad request.', 'a huge body');
  assert.equal((await act({ pid: 'nobody' }, 'commit')).error, 'Please join again.');
  assert.equal((await act({ pid: { toString: 1 } }, 'commit')).error, 'Please join again.');
  assert.equal((await stateOf({ pid: '__proto__' })).me, null, 'a made-up pid is not a person');
  assert.equal((await call('GET', '/api/admin/state')).status, 401, 'admin needs the key');
  assert.equal((await call('POST', '/api/admin/step', { step: 3 }, { 'x-admin-key': 'tesT' })).status, 401);
  for (const s of [-1, 9, 'two', 1.5, {}]) assert.equal((await admin('step', { step: s })).error, 'No such step.');
  assert.equal((await get('/api/nope', {})).error, 'No such thing.');
  return long;
}

// Step 0 refuses every Git button with the step that unlocks it.
async function gating(who) {
  const unlocks = {
    draft: 1, commit: 1, branch: 2, switch: 2, pair: 2, merge: 3, resolve: 3, abort: 3,
    push: 5, pull: 5, revert: 6, reset: 6, 'squash-force': 7,
  };
  for (const [action, n] of Object.entries(unlocks)) {
    assert.equal((await act(who, action, { part: 'face', value: 'frog', name: 'x', branch: 'main', from: 'x' })).error, notYet(n), action);
  }
  assert.equal((await look(who, 'reflog')).error, notYet(6));
  assert.equal((await look(who, 'inspect', { commit: 'x' })).error, notYet(1));
  for (const [part, value] of [['tail', 'cat'], ['face', 'cat'], ['face', 'mustache'], ['__proto__', 'x'], ['face', '__proto__']]) {
    assert.equal((await act(who, 'chaos', { part, value })).error, 'Pick a part from the list.', `chaos ${part}=${value}`);
  }
}

// Before Step 1 the teacher changes the number of labs while people join and click.
async function labCounts(labs) {
  for (const n of [1, 7, 'x', 2.5]) assert.equal((await admin('labs', { count: n })).error, 'Pick 2 to 6 labs.');
  const clicks = () => Object.values(labs).flat().map((w) => act(w, 'chaos', { part: 'face', value: 'ghost' }));
  const [four] = await Promise.all([admin('labs', { count: 4 }), ...clicks(), post('/api/join', { name: 'Noor', labId: '4' })]);
  okay(four, '4 labs');
  assert.equal(tipIn('4'), tipIn('wall'), 'a new lab is a copy of the Wall');
  const [two] = await Promise.all([admin('labs', { count: 2 }), ...clicks(), post('/api/join', { name: 'Omar', labId: '3' })]);
  okay(two, '2 labs');
  assert.deepEqual(fs.readdirSync(path.join(DATA_DIR, 'labs')).sort(), ['1', '2'], 'removed labs are deleted');
  for (const w of labs[3]) assert.ok(['1', '2'].includes((await stateOf(w)).me.labId), `${w.name} moved to a lab that exists`);
  okay(await admin('labs', { count: 3 }), '3 labs');
  assert.equal((await admin('move', { pid: 'nobody', labId: '3' })).error, 'Pick a person and a lab.');
  assert.equal((await admin('move', { pid: labs[3][0].pid, labId: '9' })).error, 'Pick a person and a lab.');
  for (const w of labs[3]) okay(await admin('move', { pid: w.pid, labId: '3' }), `move ${w.name} back`);
  for (const w of labs[3]) assert.equal((await stateOf(w)).me.labId, '3');
}

async function chaos(lab) {
  const choices = { face: ['frog', 'ghost', 'lion'], body: ['coat', 'donut', 'shell'], legs: ['wheels', 'duck', 'paws'] };
  const rs = await Promise.all(lab.flatMap((who, i) => Array.from({ length: 10 }, (_, k) => {
    const part = ['face', 'body', 'legs'][(i + k) % 3];
    return act(who, 'chaos', { part, value: choices[part][k % 3] });
  })));
  assert.ok(rs.every((r) => r.ok), JSON.stringify(tally(rs)));
  const s = await stateOf(lab[0]);
  for (const part of ['face', 'body', 'legs']) assert.ok(choices[part].includes(s.lab.chaos[part]), `chaos ${part}`);
}

// Save at the same moment: one card, the rest hear who saved their parts, no part lost.
async function saveRaces(lab) {
  const [a, b, c, d] = lab;
  const before = tipIn('1');
  await together([[a, 'face', 'frog'], [b, 'body', 'coat'], [c, 'legs', 'wheels']], ([w, part, value]) => act(w, 'draft', { part, value }));
  const rs = await together(lab, (w) => act(w, 'commit'));
  assert.equal(count(rs, SAVED), 1, `4 saves at once: ${JSON.stringify(tally(rs))}`);
  assert.equal(count(rs, SAVED_BY), 3, `the other 3 hear who saved: ${JSON.stringify(tally(rs))}`);
  assert.deepEqual(parentsOf('1', tipIn('1')), [before], 'one card on top of the last one');
  assert.deepEqual(monsterIn('1', tipIn('1')), { face: 'frog', body: 'coat', legs: 'wheels' });
  assert.deepEqual((await stateOf(a)).lab.drafts.main, {}, 'the draft is empty after the save');

  // A double click: one card, then "already saved".
  okay(await act(d, 'draft', { part: 'face', value: 'ghost' }), 'draft');
  const twice = await Promise.all([act(d, 'commit'), act(d, 'commit')]);
  assert.deepEqual([count(twice, SAVED), count(twice, SAVED_BY)], [1, 1], JSON.stringify(tally(twice)));
  assert.equal((await act(d, 'commit')).result.message, 'Nothing changed — nothing to save.');

  // Everyone edits and saves at once, many times: every saved card is on main, in one chain.
  const saved = [];
  const values = { face: ['lion', 'monkey', 'smiley', 'frog'], body: ['donut', 'shell', 'box', 'coat'], legs: ['duck', 'paws', 'sticks', 'wheels'] };
  for (let round = 0; round < 12; round++) {
    const results = await together(lab, async (w, i) => {
      const part = ['face', 'body', 'legs'][(round + i) % 3];
      await act(w, 'draft', { part, value: values[part][(round + i) % 4] });
      return act(w, 'commit');
    });
    for (const r of results) if (r.ok && r.result?.id) saved.push(r.result.id);
  }
  await together(lab, (w) => act(w, 'commit')); // whatever was left
  const chain = gitIn('1', 'rev-list', '--first-parent', 'refs/heads/main').split('\n');
  for (const id of saved) assert.ok(chain.includes(id), `saved card ${id.slice(0, 7)} is on main`);
  assert.equal(gitIn('1', 'rev-list', '--merges', 'refs/heads/main'), '', 'saves never make merge cards');
  const commits = gitIn('1', 'reflog', 'show', '--format=%gs', 'refs/heads/main').split('\n').filter((l) => l.startsWith('commit:'));
  assert.equal(commits.length, saved.length + 2, 'one diary line per saved card');
  assert.deepEqual((await stateOf(a)).lab.drafts.main, {}, 'nothing left unsaved');
  return saved.length;
}

async function branchRaces(labs) {
  const [a, b, c, d] = labs[1];
  // Three people make the same note at once: one note, two "already exists".
  const rs = await together([a, c, d], (w) => act(w, 'branch', { name: 'cat-robot' }));
  const t = tally(rs);
  assert.equal(count(rs, /^You're on cat-robot now\./), 1, JSON.stringify(t));
  assert.equal(t['cat-robot already exists. Press Switch to join it.'], 2);
  const names = ['', ' ', 'Cat Robot', '-x', 'a/b', '../x', 'a.lock', 'x'.repeat(21), 'HEAD~1', 'é', 'a b', null, {}, 'refs/heads/x'];
  for (const name of names) assert.equal((await act(b, 'branch', { name })).error, BAD_NAME, `branch ${JSON.stringify(name)}`);
  assert.equal((await act(b, 'branch', { name: 'wall' })).error, '"wall" is the Wall\'s name. Pick another.');
  assert.equal((await act(b, 'branch', { name: 'main' })).error, 'main already exists. Press Switch to join it.');
  for (const branch of ['nope', '__proto__', 'wall/main', '../../x', 'refs/heads/main', '', null]) {
    assert.equal((await act(b, 'switch', { branch })).error, 'That sticky note does not exist.', `switch ${branch}`);
  }
  assert.equal((await act(b, 'draft', { part: 'face', value: 'cat' })).error, MAIN_LOCKED);
  assert.equal((await act(b, 'commit')).error, MAIN_LOCKED);

  okay(await act(b, 'branch', { name: 'superhero' }), 'superhero');
  for (const w of [a, c, d]) okay(await act(w, 'switch', { branch: w === d ? 'superhero' : 'cat-robot' }), 'switch');
  // Two partners build the same idea and save at the same moment.
  await Promise.all([act(a, 'draft', { part: 'face', value: 'cat' }), act(c, 'draft', { part: 'body', value: 'robot' })]);
  const saves = await Promise.all([act(a, 'commit'), act(c, 'commit')]);
  assert.deepEqual([count(saves, SAVED), count(saves, SAVED_BY)], [1, 1], JSON.stringify(tally(saves)));
  await Promise.all([act(b, 'draft', { part: 'body', value: 'superhero' }), act(d, 'draft', { part: 'legs', value: 'tentacles' })]);
  await Promise.all([act(b, 'commit'), act(d, 'commit')]);
  const catRobot = monsterIn('1', tipIn('1', 'cat-robot'));
  assert.deepEqual([catRobot.face, catRobot.body], ['cat', 'robot'], "both partners' parts are saved");
  assert.equal(monsterIn('1', tipIn('1', 'superhero')).body, 'superhero');
  for (const labId of ['2', '3']) okay(await admin('rescue', { labId }), `rescue Lab ${labId}`);
}

// Two students press Merge, then Finish, at the same moment. A refresh and a restart in the middle.
async function mergeRaces(labs) {
  const [a, b, c] = labs[1];
  for (const w of labs[1]) okay(await act(w, 'switch', { branch: 'main' }), 'switch to main');
  const ff = await Promise.all([act(a, 'merge', { from: 'cat-robot' }), act(b, 'merge', { from: 'cat-robot' })]);
  assert.deepEqual([count(ff, /^main slid forward to [0-9a-f]{7}\. No new card\.$/), count(ff, /^main already has cat-robot\. Nothing to merge\.$/)],
    [1, 1], `two fast-forwards at once: ${JSON.stringify(tally(ff))}`);

  const main = tipIn('1');
  const merges = await Promise.all([act(a, 'merge', { from: 'superhero' }), act(b, 'merge', { from: 'superhero' })]);
  const opened = merges.filter((r) => r.result?.conflict);
  assert.equal(opened.length, 1, `two merges at once open one conflict: ${JSON.stringify(tally(merges))}`);
  assert.equal(merges.find((r) => !r.result?.conflict).error, MERGING, 'the second presser hears why');

  // A refresh: the open merge lives on the server, for everyone on main.
  const open = (await stateOf(c)).lab.merging.main;
  assert.deepEqual(open.conflicts, ['body']);
  assert.equal(open.intoTip, main);
  assert.equal(tipIn('1'), main, 'an open merge does not move main');

  // Everything that would move main waits for the merge.
  assert.equal((await act(c, 'merge', { from: 'superhero' })).error, MERGING);
  assert.equal((await act(c, 'draft', { part: 'face', value: 'frog' })).error, MERGING);

  // A restart in the middle of the conflict.
  await stopServer();
  await startServer();
  assert.deepEqual((await stateOf(c)).lab.merging.main, open, 'the open merge survives a restart');

  // Bad monsters are refused.
  for (const monster of [null, 'robot', {}, { face: 'cat', body: '__proto__', legs: 'tentacles' }, { face: 'cat', body: 'mustache', legs: 'tentacles' }]) {
    assert.equal((await act(a, 'resolve', { monster })).error, 'Pick a part from the list.', `resolve ${JSON.stringify(monster)}`);
  }
  // Two people press Finish with different picks: one merge card, the other hears it is done.
  const pick = (body) => ({ ...open.auto, body });
  const finish = await Promise.all([act(a, 'resolve', { monster: pick('robot') }), act(b, 'resolve', { monster: pick('superhero') })]);
  assert.equal(tally(finish)[CLOSED], 1, JSON.stringify(tally(finish)));
  const winner = finish.findIndex((r) => r.result?.id);
  assert.equal(monsterIn('1', tipIn('1')).body, winner === 0 ? 'robot' : 'superhero');
  assert.equal(parentsOf('1', tipIn('1')).length, 2, 'the merge card has two parents');
  assert.deepEqual((await stateOf(c)).lab.merging, {}, 'the merge is closed for everyone');

  // Lab 2: Cancel and Finish at the same moment, in both orders. One wins, the other hears how it ended.
  const [p, q] = labs[2];
  for (const w of [p, q]) await act(w, 'switch', { branch: 'main' });
  await act(p, 'merge', { from: 'cat-robot' });
  const before = tipIn('2');
  for (const cancelFirst of [true, false]) {
    if (tipIn('2') !== before) break; // a Finish already won
    assert.ok((await act(p, 'merge', { from: 'superhero' })).result?.conflict, 'Lab 2 conflict');
    const { auto } = (await stateOf(p)).lab.merging.main;
    const finishIt = () => act(q, 'resolve', { monster: { ...auto, body: 'robot' } });
    const [cancel, done] = cancelFirst ? await Promise.all([act(p, 'abort'), finishIt()]) : (await Promise.all([finishIt(), act(p, 'abort')])).reverse();
    const cancelled = cancel.ok && !cancel.result?.nothing;
    assert.ok(cancelled !== Boolean(done.result?.id), `exactly one wins: ${JSON.stringify(tally([cancel, done]))}`);
    assert.equal(words(cancelled ? done : cancel), CLOSED, 'the other one hears it is done');
    assert.deepEqual((await stateOf(p)).lab.merging, {}, 'the merge is closed');
    if (cancelled) assert.equal(tipIn('2'), before, 'cancel leaves main where it was');
    else assert.equal(parentsOf('2', tipIn('2')).length, 2, 'finish makes a merge card');
  }

  // Lab 3: students merge while the teacher rescues the lab.
  const lab3 = labs[3];
  for (const w of lab3) await act(w, 'switch', { branch: 'main' });
  await Promise.all([admin('rescue', { labId: '3' }), act(lab3[0], 'merge', { from: 'cat-robot' }), act(lab3[1], 'merge', { from: 'superhero' })]);
  for (let i = 0; i < 3; i++) {
    const r = await admin('rescue', { labId: '3' });
    if (/already done|Rescued/.test(r.result?.message ?? '')) break;
  }
  okay(await admin('rescue', { labId: '2' }), 'rescue Lab 2');
  const goals = (await adminState()).labs.map((l) => l.goals.every((g) => g.done));
  assert.deepEqual(goals, [true, true, true], 'every lab has both merges');
}

// The teacher presses Prev, then Next again.
async function backAStep(labs) {
  const [a] = labs[1];
  await step(2);
  assert.equal((await act(a, 'merge', { from: 'superhero' })).error, notYet(3), 'merge waits for Step 3 again');
  assert.equal((await act(a, 'draft', { part: 'face', value: 'frog' })).error, MAIN_LOCKED);
  assert.equal((await stateOf(a)).session.step, 2);
  await step(3);
}

// Next into Step 4 while students are still clicking.
async function meetTheWall(labs) {
  const everyone = Object.values(labs).flat();
  const [a, b] = labs[1];
  okay(await act(a, 'switch', { branch: 'cat-robot' }), 'switch');
  okay(await act(a, 'draft', { part: 'legs', value: 'duck' }), 'draft');
  await Promise.all([step(4, '2'), act(a, 'commit'), act(b, 'merge', { from: 'superhero' }), ...everyone.map((w) => stateOf(w))]);
  const wall = tipIn('wall');
  assert.equal(wall, tipIn('2'), "Lab 2's main is on the Wall");
  for (const labId of ['1', '2', '3']) {
    assert.equal(tipIn(labId), wall, `Lab ${labId} is a copy of the Wall`);
    assert.equal(gitIn(labId, 'for-each-ref', '--format=%(refname)', 'refs/heads'), 'refs/heads/main', `Lab ${labId} has only main`);
  }
  for (const w of everyone) {
    const s = await stateOf(w);
    assert.equal(s.me.branch, 'main', `${w.name} is on main`);
    assert.deepEqual([s.lab.drafts, s.lab.merging], [{ main: {} }, {}]);
  }
}

const CHANGES = { 1: ['face', 'dragon'], 2: ['legs', 'skates'], 3: ['body', 'cactus'] };

async function sendRaces(labs) {
  // A late joiner lands on main, with the lab's cards, the Wall and the mission.
  const zoe = await joinAs('Zoe', '2');
  labs[2].push(zoe);
  const z = await stateOf(zoe);
  assert.equal(z.me.branch, 'main');
  assert.equal(z.me.mission, 'LEGS → 🛼. Change nothing else.');
  assert.ok(z.wall.graph && z.lab.graph.commits.length > 3, 'the late joiner sees the cards and the Wall');

  // Each lab: two people make the change and save at once.
  for (const [labId, [part, value]] of Object.entries(CHANGES)) {
    const [a, b] = labs[labId];
    await Promise.all([act(a, 'draft', { part, value }), act(b, 'draft', { part, value })]);
    const saves = await Promise.all([act(a, 'commit'), act(b, 'commit')]);
    assert.deepEqual([count(saves, SAVED), count(saves, SAVED_BY)], [1, 1], JSON.stringify(tally(saves)));
  }
  // Everyone presses Send at once: one card goes in, the rest are refused or already there.
  const everyone = Object.values(labs).flat();
  const sends = await together(everyone, (w) => act(w, 'push'));
  const kinds = sends.map((r) => (SENT.test(words(r)) ? 'sent' : words(r)));
  assert.equal(kinds.filter((k) => k === 'sent').length, 1, JSON.stringify(tally(sends)));
  assert.ok(kinds.every((k) => ['sent', REFUSED, ALREADY_SENT].includes(k)), JSON.stringify(tally(sends)));

  // Each lab, at the same time: two people press Get & combine, then two press Send, until all are in.
  await Promise.all(Object.keys(CHANGES).map(async (labId) => {
    const [a, b] = labs[labId];
    for (let i = 0; i < 8; i++) {
      const lab = (await stateOf(a)).lab;
      if (lab.goals.every((g) => g.done)) return;
      const pulls = await Promise.all([act(a, 'pull'), act(b, 'pull')]);
      for (const r of pulls) assert.ok(r.ok || r.error === MERGING, `pull: ${words(r)}`);
      assert.ok(!pulls.some((r) => r.result?.conflict), 'three labs combine without conflicts');
      await Promise.all([act(a, 'push'), act(b, 'push')]);
    }
  }));
  // Late senders may have moved the Wall after an earlier lab matched it: catch up.
  for (const labId of Object.keys(CHANGES)) await act(labs[labId][0], 'pull');
  const wall = monsterIn('wall', tipIn('wall'));
  assert.deepEqual(wall, { face: 'dragon', body: 'cactus', legs: 'skates' }, 'every lab’s change is on the Wall');
  const goals = (await adminState()).labs.map((l) => l.goals.every((g) => g.done));
  assert.deepEqual(goals, [true, true, true], 'every lab matches the Wall');
}

// A clean stop flushes the session. A crash (SIGKILL) can leave lock files and a half-cloned lab behind.
async function restarts(labs) {
  const [a] = labs[1];
  const [p] = labs[2];
  okay(await act(a, 'draft', { part: 'legs', value: 'paws' }), 'draft');
  await stopServer('SIGTERM'); // right away: the debounced save must be flushed on SIGTERM
  await startServer();
  assert.deepEqual((await stateOf(a)).lab.drafts.main, { legs: 'paws' }, 'the draft survives a clean restart');

  okay(await act(p, 'draft', { part: 'face', value: 'lion' }), 'draft');
  await sleep(600);
  await stopServer('SIGKILL');
  const labLock = path.join(DATA_DIR, 'labs', '2', '.git', 'refs', 'heads', 'main.lock');
  const wallLock = path.join(DATA_DIR, 'wall.git', 'refs', 'heads', 'main.lock');
  fs.writeFileSync(labLock, '');
  fs.writeFileSync(wallLock, '');
  const lab3 = path.join(DATA_DIR, 'labs', '3');
  fs.rmSync(path.join(lab3, '.git', 'HEAD')); // a kill in the middle of Lab 3's clone
  await startServer();
  assert.ok(!fs.existsSync(labLock) && !fs.existsSync(wallLock), 'stale locks are removed on boot');
  assert.equal(tipIn('3'), tipIn('wall'), 'a broken lab starts over from the Wall');
  assert.ok((await stateOf(labs[3][0])).lab.graph, 'and its students carry on');
  const s = await stateOf(p);
  assert.deepEqual(s.lab.drafts.main, { face: 'lion' }, 'the draft survives a crash');
  assert.equal(s.session.step, 5);
  assert.ok(okay(await act(p, 'commit'), 'save after the crash').result.id, 'saving works after the crash');
  await act(a, 'commit');
}

// SIGKILL in the middle of saves and a Finish merge, six times: Git stays sound and the session agrees with it.
async function crashes(labs) {
  const [s0, s1, s2] = labs[3];
  const legs = ['paws', 'wheels', 'duck', 'sticks'];
  for (let i = 0; i < 6; i++) {
    const before = await stateOf(s1);
    if (before.lab.merging.main) await act(s1, 'abort');
    const base = monsterIn('3', tipIn('3')).legs;
    const [ours, theirs] = legs.filter((l) => l !== base);
    okay(await act(s0, 'branch', { name: `crash-${i}` }), 'a note');
    await act(s0, 'draft', { part: 'legs', value: theirs });
    okay(await act(s0, 'commit'), 'save on the note');
    await act(s1, 'draft', { part: 'legs', value: ours });
    okay(await act(s1, 'commit'), 'save on main');
    assert.ok((await act(s1, 'merge', { from: `crash-${i}` })).result?.conflict, 'a conflict');
    const { auto } = (await stateOf(s1)).lab.merging.main;
    await sleep(300); // the open merge reaches the session file
    const inFlight = [
      act(s1, 'resolve', { monster: { ...auto, legs: 'duck' } }),
      act(s0, 'draft', { part: 'face', value: 'ghost' }).then(() => act(s0, 'commit')),
      act(s2, 'draft', { part: 'body', value: 'coat' }),
    ].map((r) => r.catch(() => null));
    await sleep(Math.random() * 80);
    await stopServer('SIGKILL');
    await Promise.all(inFlight);
    await startServer();
    await checkSessionMatchesGit(Object.values(labs).flat());
    await act(s0, 'switch', { branch: 'main' });
  }
  if ((await stateOf(s1)).lab.merging.main) await act(s1, 'abort');
  await act(s2, 'draft', { part: 'face', value: 'lion' });
  assert.match(words(await act(s2, 'commit')), /^(Saved card|Already saved by)/, 'saving works after the crashes');
}

async function undoRaces(labs) {
  await step(6);
  const [a, b] = labs[1];
  const [p, q] = labs[2];
  const intern = gitIn('wall', 'log', '-1', '--format=%H', '--author=The Intern', 'refs/heads/main');
  assert.equal(monsterIn('wall', intern).face, 'mustache', 'the mustache card is on the Wall');

  // Unknown, malformed and foreign IDs, before Lab 3 has the mustache card.
  const tree = gitIn('1', 'rev-parse', 'refs/heads/main^{tree}');
  for (const commit of ['abc', '0'.repeat(40), intern, tree, 'HEAD', 'main', `${tipIn('3')}^`, null, {}, tipIn('3').toUpperCase()]) {
    const w = labs[3][0];
    assert.equal((await act(w, 'revert', { commit })).error, NOT_A_CARD, `undo ${JSON.stringify(commit)}`);
    assert.equal((await act(w, 'reset', { commit })).error, NOT_A_CARD, `move back ${JSON.stringify(commit)}`);
    assert.equal((await look(w, 'inspect', { commit })).error, NOT_A_CARD, `inspect ${JSON.stringify(commit)}`);
  }
  assert.ok(okay(await look(labs[3][0], 'inspect', { commit: intern, repo: 'wall' }), 'inspect on the Wall').result.raw);
  assert.equal((await act(a, 'revert', { commit: gitIn('1', 'rev-list', '--max-parents=0', 'refs/heads/main') })).error,
    "The Start card can't be undone.");

  // Lab 1: two Get & combine at once, then two Undo at once.
  const pulls = await Promise.all([act(a, 'pull'), act(b, 'pull')]);
  assert.deepEqual([count(pulls, /^Got the Wall's cards/), count(pulls, /^Nothing new on the Wall\.$/)], [1, 1], JSON.stringify(tally(pulls)));
  const undos = await Promise.all([act(a, 'revert', { commit: intern }), act(b, 'revert', { commit: intern })]);
  assert.deepEqual([count(undos, /^Added fix card [0-9a-f]{7}\./), count(undos, /^Already undone\. Nothing to change\.$/)], [1, 1],
    JSON.stringify(tally(undos)));
  assert.ok(SENT.test(words(await act(a, 'push'))), 'Lab 1 sends the fix');

  // Lab 2: move back at the same moment as someone saves; the diary keeps both.
  okay(await act(p, 'pull'), 'Lab 2 gets the mustache');
  const back = parentsOf('2', tipIn('2'))[0];
  okay(await act(q, 'draft', { part: 'body', value: 'donut' }), 'draft');
  const race = await Promise.all([act(p, 'reset', { commit: back }), act(q, 'commit')]);
  for (const r of race) assert.ok(r.ok || r.error === UNSAVED, words(r));
  const diary = okay(await look(p, 'reflog'), 'diary').result.entries;
  assert.ok(diary.length >= 5 && diary.every((e) => /^[0-9a-f]{40}$/.test(e.id) && e.time > 0 && e.message), 'diary entries');
  okay(await admin('rescue', { labId: '2' }), 'rescue Lab 2');
  // Rescue pressed twice at once (two teachers, or a double click).
  const twice = await Promise.all([admin('rescue', { labId: '3' }), admin('rescue', { labId: '3' })]);
  for (const r of twice) assert.ok(r.ok || r.error === 'Busy, press again.', words(r));
  okay(await admin('rescue', { labId: '3' }), 'rescue Lab 3 again');
  for (const labId of ['1', '2', '3']) okay(await act(labs[labId][0], 'pull'), `Lab ${labId} catches up with the Wall`);
  const goals = (await adminState()).labs.map((l) => l.goals.every((g) => g.done));
  assert.deepEqual(goals, [true, true, true], 'every lab is done with Step 6');
}

async function bossRaces(labs) {
  await step(7, '1');
  const [a, b] = labs[1];
  const [p] = labs[2];
  assert.equal((await act(p, 'push')).error, 'The boss is cleaning the Wall. Watch.');
  assert.equal((await act(p, 'squash-force')).error, 'Only the boss lab can do this.');
  okay(await admin('audit', { part: 'legs', value: 'tentacles' }), 'audit');
  for (const [part, value] of [['tail', 'x'], ['legs', '__proto__'], ['legs', 'tentacles; rm -rf /']]) {
    assert.equal((await admin('audit', { part, value })).error, 'Pick a part from the list.');
  }
  await act(a, 'pull');
  const rs = await Promise.all([act(a, 'squash-force'), act(b, 'squash-force')]);
  assert.equal(tally(rs)['The Wall already has one clean card.'], 1, `two replaces at once: ${JSON.stringify(tally(rs))}`);
  assert.equal(gitIn('wall', 'rev-list', '--count', 'refs/heads/main'), '2', "the Wall's history is Start ← Clean");
  assert.equal(rs.find((r) => r.result?.forced).result.id, tipIn('wall'), 'the Wall was replaced once');
  okay(await admin('audit', { part: 'legs', value: 'tentacles' }), 'audit');
  const gc = okay(await admin('gc'), 'gc');
  assert.match(gc.result.message, /Now 0\.$/);
}

// Reset session while 30 requests are in flight: nothing half-done, everyone joins again.
async function resetMidClass(labs) {
  const everyone = Object.values(labs).flat();
  const { boot } = (await stateOf(everyone[0])).session;
  const inFlight = everyone.flatMap((w) => [act(w, 'draft', { part: 'face', value: 'frog' }), act(w, 'commit'), stateOf(w)]);
  const [reset, ...rest] = await Promise.all([admin('reset'), ...inFlight]);
  okay(reset, 'reset');
  for (const r of rest) assert.ok(r.status < 500, JSON.stringify(r));
  const s = await stateOf(everyone[0]);
  assert.notEqual(s.session.boot, boot, 'a new boot sends everyone back to Join');
  assert.equal(s.me, null);
  assert.equal(s.session.step, 0);
  assert.equal((await act(everyone[0], 'chaos', { part: 'face', value: 'frog' })).error, 'Please join again.');
  const start = tipIn('wall');
  assert.equal(gitIn('wall', 'rev-list', '--count', 'refs/heads/main'), '1', 'the Wall holds only Start');
  for (const labId of ['1', '2', '3']) assert.equal(tipIn(labId), start, `Lab ${labId} starts over`);
  assert.equal((await adminState()).feed.length, 0, 'the feed starts over');
}

// ---------- 40 live clients ----------

// A live page like app.js and admin.js: listen to the event stream; refetch the state when {v, boot}
// changes, one fetch in flight and at most one queued. Like EventSource, reconnect 2 s after the
// stream drops; the first message after a reconnect always refetches.
function livePage(eventsUrl, fetchState) {
  const c = { fetchState, events: 0, heartbeats: 0, reconnects: 0, latencies: [], state: null, loading: null, queued: false, open: false };
  let aborter = null;
  const refresh = async () => {
    if (c.loading) { c.queued = true; return; }
    c.loading = (async () => {
      const t = performance.now();
      const s = await fetchState().catch(() => null); // the server is restarting; the reconnect refetches
      if (s?.session) { c.latencies.push(performance.now() - t); c.state = s; }
    })();
    await c.loading;
    c.loading = null;
    if (c.queued) { c.queued = false; refresh(); }
  };
  async function listen(signal) {
    while (!signal.aborted) {
      let seen = '';
      try {
        const res = await fetch(BASE + eventsUrl, { signal });
        assert.equal(res.headers.get('content-type'), 'text/event-stream');
        c.open = true;
        const decoder = new TextDecoder();
        let buffer = '';
        for await (const chunk of res.body) {
          buffer += decoder.decode(chunk, { stream: true });
          for (let i; (i = buffer.indexOf('\n\n')) >= 0;) {
            const block = buffer.slice(0, i);
            buffer = buffer.slice(i + 2);
            if (block.startsWith(': hb')) c.heartbeats += 1;
            const data = /^data: (.*)$/m.exec(block)?.[1];
            if (!data) continue;
            c.events += 1;
            const { v, boot } = JSON.parse(data);
            if (`${boot}:${v}` !== seen) { seen = `${boot}:${v}`; refresh(); }
          }
        }
      } catch { /* dropped: retry below */ }
      c.open = false;
      if (signal.aborted) return;
      c.reconnects += 1;
      await sleep(2000);
    }
  }
  c.connect = () => { aborter = new AbortController(); listen(aborter.signal); };
  c.close = () => aborter.abort();
  return c;
}

const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))] ?? 0;

// Wait for every page to finish refetching, then compare each with a fresh fetch of its state.
async function stalePages(pages) {
  for (let i = 0; i < 100 && pages.some((c) => c.loading || c.queued); i++) await sleep(100);
  await sleep(1000);
  let stale = 0;
  for (const c of pages) if (JSON.stringify(c.state) !== JSON.stringify(await c.fetchState())) stale += 1;
  return stale;
}

async function liveClass() {
  const people = [];
  for (let i = 0; i < SSE_CLIENTS; i++) people.push(await joinAs(`Student ${i + 1}`, String((i % 3) + 1)));
  const students = people.map((who) => livePage(`/api/events?pid=${who.pid}`, () => stateOf(who)));
  const teachers = [0, 1].map(() => livePage(`/api/admin/events?key=${KEY}`, adminState)); // admin page + projector
  const pages = [...students, ...teachers];
  for (const c of pages) c.connect();
  try {
    await liveRun(people, students, pages);
  } finally {
    for (const c of pages) c.close();
  }
}

async function liveRun(people, students, pages) {
  await sleep(1500);
  await step(1);

  const values = { face: ['smiley', 'frog', 'ghost', 'lion', 'monkey'], body: ['box', 'coat', 'donut', 'shell'], legs: ['sticks', 'wheels', 'duck', 'paws'] };
  const any = (xs) => xs[Math.floor(Math.random() * xs.length)];
  const click = (who) => {
    if (Math.random() < 0.25) return act(who, 'commit');
    const part = any(['face', 'body', 'legs']);
    return act(who, 'draft', { part, value: any(values[part]) });
  };
  const t0 = Date.now();
  const first = usage();
  const samples = [first];
  const sampler = setInterval(() => samples.push(usage()), 5000);
  const pending = new Set();
  let clicks = 0;
  let nextAsk = t0 + 10_000;
  let nextChurn = t0 + 20_000;
  while (Date.now() < t0 + SSE_SECONDS * 1000) {
    const r = click(any(people)); // about 8 clicks a second across the class
    pending.add(r);
    r.finally(() => pending.delete(r));
    clicks += 1;
    if (Date.now() > nextAsk) { nextAsk += 10_000; pending.add(admin('ask', { on: Math.random() < 0.5 })); }
    if (Date.now() > nextChurn) { // a few laptops sleep and wake up
      nextChurn += 20_000;
      for (const c of students.slice(0, 3)) { c.close(); c.connect(); }
    }
    await sleep(125);
  }
  clearInterval(sampler);
  await Promise.all(pending);
  const stale = await stalePages(pages);
  await checkSessionMatchesGit(people);
  const last = usage();
  const steady = pages.flatMap((c) => c.latencies);
  const seconds = (Date.now() - t0) / 1000;

  // Then everyone clicks five times as fast as they can.
  const mark = pages.map((c) => c.latencies.length);
  const t1 = Date.now();
  await Promise.all(people.map(async (w) => { for (let k = 0; k < 5; k++) await click(w); }));
  const burstMs = Date.now() - t1;
  const burstStale = await stalePages(pages);
  const burst = pages.flatMap((c, i) => c.latencies.slice(mark[i]));
  await checkSessionMatchesGit(people);

  const ms = (xs) => ({ p50: Math.round(pct(xs, 50)), p95: Math.round(pct(xs, 95)), max: Math.round(Math.max(...xs)) });
  const report = {
    seconds: Math.round(seconds),
    clicks,
    events: pages.reduce((n, c) => n + c.events, 0),
    stateFetches: steady.length,
    stateMs: ms(steady),
    rssMB: { start: Math.round(first.rss), max: Math.round(Math.max(...samples.map((x) => x.rss))), end: Math.round(last.rss) },
    cpuPercent: Math.round(((last.cpu - first.cpu) / seconds) * 100),
    minHeartbeats: Math.min(...pages.slice(3).map((c) => c.heartbeats)),
    drops: pages.slice(3).reduce((n, c) => n + c.reconnects, 0),
    stalePages: stale,
    burst: { clicks: people.length * 5, ms: burstMs, stateMs: ms(burst), stalePages: burstStale },
  };
  log('    live class:', JSON.stringify(report));
  assert.equal(stale, 0, 'every page ends on the latest state (no dropped updates)');
  assert.equal(burstStale, 0, 'every page ends on the latest state after the burst');
  assert.equal(report.drops, 0, 'no event stream dropped');
  assert.ok(report.stateMs.p95 < 500 && report.burst.stateMs.p95 < 1500, `state times ${JSON.stringify([report.stateMs, report.burst])}`);
  assert.ok(report.rssMB.max < 250 && report.rssMB.end - report.rssMB.start < 80, `memory ${JSON.stringify(report.rssMB)}`);
  assert.ok(report.cpuPercent < 80, `cpu ${report.cpuPercent}%`);
  if (SSE_SECONDS >= 45) assert.ok(report.minHeartbeats >= Math.floor(SSE_SECONDS / 15) - 1, 'heartbeats every 15 s');

  // The server restarts under the whole class: every page reconnects and lands on the same state.
  const drafts = (await stateOf(people[0])).lab.drafts;
  await stopServer();
  await sleep(500);
  await startServer();
  for (let i = 0; i < 50 && pages.some((c) => !c.reconnects || !c.open); i++) await sleep(200);
  assert.ok(pages.every((c) => c.reconnects && c.open), 'every page reconnected');
  await Promise.all(people.slice(0, 12).map(click));
  assert.equal(await stalePages(pages), 0, 'every page is up to date after the restart');
  assert.deepEqual(Object.keys((await stateOf(people[0])).lab.drafts), Object.keys(drafts), 'notes and drafts survive');
  const online = async () => (await adminState()).labs.flatMap((l) => l.members).filter((m) => m.online).length;
  assert.equal(await online(), SSE_CLIENTS, 'everyone is online again');
  for (const c of pages) c.close();
  await sleep(500);
  assert.equal(await online(), 0, 'closed streams leave nobody online');
}

// ---------- Two students in real browsers ----------

// Double clicks, two people clicking at once, and a reload in the middle of a conflict, through the real UI.
async function inTheBrowser() {
  okay(await admin('reset'), 'reset');
  const [ana, raj] = [await joinAs('Ana', '1'), await joinAs('Raj', '1')];
  const browser = await chromium.launch();
  const seen = [];
  const open = async (who) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((pid) => localStorage.setItem('monsterLab.pid', pid), who.pid);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on('pageerror', (e) => seen.push(`${who.name}: page error: ${e.message}`));
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) seen.push(`${who.name}: console.${m.type()}: ${m.text()}`); });
    await page.goto(BASE);
    await page.waitForSelector('#main:not([hidden])');
    return page;
  };
  const toast = (page, text) => page.locator('#toasts .toast', { hasText: text }).first().waitFor();
  const actionButton = (page, act) => page.locator(`#actions [data-act="${act}"]`).first();
  const corner = { position: { x: 10, y: 10 } }; // sentence buttons hold a dropdown: press on the words' side
  const resolverOpen = (page) => page.$eval('#resolver-dialog', (d) => d.open);
  try {
    const [A, R] = [await open(ana), await open(raj)];
    await step(1);
    await A.locator('#crumbs', { hasText: 'Step 1' }).waitFor();
    await A.click('#draft [data-part="face"]');
    await A.click('#popover [data-slug="frog"]');
    await R.locator('#draft [data-part="face"].unsaved').waitFor();
    const before = Number(gitIn('1', 'rev-list', '--count', 'refs/heads/main'));
    await Promise.all([actionButton(A, 'commit').dblclick(), actionButton(R, 'commit').click()]);
    await Promise.all([toast(A, 'card'), toast(R, 'card')]);
    assert.equal(Number(gitIn('1', 'rev-list', '--count', 'refs/heads/main')), before + 1, 'a double click and a click at once save one card');

    await step(2);
    okay(await admin('rescue', { labId: '1' }), 'rescue Lab 1');
    await step(3);
    for (const page of [A, R]) await page.locator('#on-note', { hasText: 'main' }).waitFor();
    for (const [page, note] of [[A, 'cat-robot'], [R, 'cat-robot']]) await page.selectOption('#actions select[data-pick="merge"]', note);
    await Promise.all([actionButton(A, 'merge').dblclick(corner), actionButton(R, 'merge').click(corner)]);
    await until('one fast-forward', () => tipIn('1') === tipIn('1', 'cat-robot'));
    await R.locator('#behind-body .last', { hasText: 'fast-forward' }).waitFor({ state: 'attached' });

    for (const page of [A, R]) await page.selectOption('#actions select[data-pick="merge"]', 'superhero');
    await Promise.all([actionButton(A, 'merge').dblclick(corner), actionButton(R, 'merge').click(corner)]);
    await R.locator('#banner', { hasText: 'Merging superhero into main' }).waitFor();
    const opener = (await resolverOpen(A)) ? A : R;
    const other = opener === A ? R : A;
    assert.ok(await resolverOpen(opener), 'the resolver opens for whoever opened the merge');
    await toast(other, MERGING);

    await other.reload(); // a refresh in the middle of the conflict
    await other.locator('#banner', { hasText: 'BODY needs a choice' }).waitFor();
    await other.click('#banner [data-open-resolver]');
    for (const [page, body] of [[opener, 'robot'], [other, 'superhero']]) {
      await page.click(`#resolver-dialog [data-choose="body"][data-slug="${body}"]`);
    }
    await Promise.all([opener.dblclick('#resolver-dialog [data-finish]'), other.click('#resolver-dialog [data-finish]')]);
    await Promise.race([toast(A, CLOSED), toast(R, CLOSED)]);
    for (const page of [A, R]) {
      await page.waitForFunction(() => !document.querySelector('#resolver-dialog').open && document.querySelector('#banner').hidden);
    }
    assert.equal(parentsOf('1', tipIn('1')).length, 2, 'one merge card with two parents');
    assert.equal(parentsOf('1', parentsOf('1', tipIn('1'))[0]).length, 1, 'and only one');
    assert.deepEqual(seen, [], 'no console errors or warnings');
  } finally {
    await browser.close();
  }
}

// ---------- The run ----------

async function run() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  await startServer();
  try {
    const labs = await joinClass({ 1: ['Ana', 'Raj', 'Mei', 'Ivo'], 2: ['Priya', 'Tom', 'Lea'], 3: ['Sam', 'Kim', 'Ola'] });
    const long = await invalidInput();
    labs[2].push(long);
    checkClean('invalid input is refused in plain words');
    await gating(labs[1][0]);
    await labCounts(labs);
    await chaos(labs[1]);
    checkClean('Step 0: Git buttons wait for their step; lab count changes while people click; chaos clicks at once');
    await step(1);
    const n = await saveRaces(labs[1]);
    checkClean(`Step 1: saves at once, double click, ${n} cards from racing saves, none lost`);
    await step(2);
    await branchRaces(labs);
    checkClean('Step 2: one note from three presses, bad names, partners saving at once');
    await step(3);
    await mergeRaces(labs);
    checkClean('Step 3: merge and finish races, refresh and restart mid-conflict, cancel vs finish, rescue vs students');
    await backAStep(labs);
    checkClean('Prev to Step 2 and back');
    await meetTheWall(labs);
    checkClean('Step 4 while students click: every lab is a copy of the Wall');
    await step(5);
    await sendRaces(labs);
    checkClean('Step 5: late joiner, 11 sends at once, combine + send races in 3 labs');
    await restarts(labs);
    await crashes(labs);
    checkClean('restart (flush), crash with stale locks, 6 crashes mid-save and mid-merge: state and repos survive');
    await undoRaces(labs);
    checkClean('Step 6: bad card IDs, pull and undo races, move back vs save, rescue pressed twice');
    await bossRaces(labs);
    checkClean('Step 7: only the boss; two replaces at once; audit; gc');
    await resetMidClass(labs);
    checkClean('Reset session with 30 requests in flight');
    await liveClass();
    checkClean(`${SSE_CLIENTS} live students + teacher page + projector for ${SSE_SECONDS} s, a burst, a restart under all of them`);
    await inTheBrowser();
    checkClean('in real browsers: double clicks, clicks at once, reload mid-conflict');
  } finally {
    await stopServer();
  }
}

run().then(() => log('stress: all good'), (err) => {
  console.error(err);
  process.exitCode = 1;
});
