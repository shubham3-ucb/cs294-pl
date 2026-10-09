// Session state: people, labs, drafts, the scene and its step, concepts, answers, takeaways, feed and admin actions.
// Ref tips are never stored here; they are always read from Git (server/git.js).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as git from './git.js';
import { emoji, palette, PARTS, START } from '../public/monster.js';
import {
  STEPS, SCENES, UNLOCK, CONCEPTS, FIXED_LINE, DONE_LINE, PAIR_NOTES, PAIR_PARTS, LAB_CHANGES, SABOTAGE, AUDIT, PAPER, PATHS, WRAP_LINE,
  COPY_LINE, MERGE_LINE, TAKEAWAY_STEPS, ANSWER_MAX, TAKEAWAY_MAX, missionFor, SWITCH_UNSAVED,
  PREDICT, PREDICT_STEPS, predictCopy, validGuess, isRight, verdict, accuracyLine, ACCURACY_PART,
  WAYS, WHY_Q, WHY_MAX, NOT_CHOSEN, UNDO_WAYS, UNDO_NOT_CHOSEN, choiceLine,
} from './steps.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const SESSION_FILE = path.join(DATA_DIR, 'session.json');
const KEY_FILE = path.join(DATA_DIR, 'admin.key');
const LAB_COLORS = ['#8B3DFF', '#0EA5E9', '#F97316', '#16A34A', '#E11D48', '#CA8A04'];
const PRACTICE_COLOR = '#9CA3AF';
const TEACHER = { pid: 'teacher', name: 'Teacher' };
const INTERN = { pid: 'intern', name: 'The Intern' };
const PRACTICE = { pid: 'practice', name: 'Practice lab' };
const FEED_MAX = 300;
const SAVE_DELAY_MS = 250;
const WALL_SAMPLE = 12; // takeaways on the projector at the wrap
const FORMAT = 5; // session.json from another version starts a fresh session
const DISGUISE = emoji(SABOTAGE.part, SABOTAGE.value);
// "Stuck? Hint" waits this long after a step starts for a student, or after the lab's latest refusal or conflict:
// time to think first. HINT_DELAY (seconds) shortens it for the browser tests.
const HINT_DELAY_MS = (/^\d+(\.\d+)?$/.test(process.env.HINT_DELAY ?? '') ? Number(process.env.HINT_DELAY) : 45) * 1e3;

const T = {
  unsaved: "You have unsaved parts. Press Save card first. Git won't overwrite them.",
  merging: 'Finish or cancel the merge first.',
  mainOnly: 'Switch to main first.',
  boss: 'The boss is cleaning the Wall. Watch.',
  moved: 'Someone in your lab changed this branch meanwhile. Press again.',
  busy: 'Busy, press again.',
  refused: "Refused: the Wall has cards your main doesn't. Press Get & combine first.",
  refusedChoose: "Refused: the Wall has cards your main doesn't. Choose a way to get them: Get & combine (merge) or Replay on top (rebase). Then send again.",
  refusedWay: (way) => `Refused: the Wall has cards your main doesn't. Get them your lab's way (${WAYS[way].name}), then send again.`,
  refusedMovedBack: `Refused: the Wall still has the ${DISGUISE} card. Open the Safety diary, then press Get & combine.`,
  rejoin: 'Please join again.',
  closed: 'Someone already finished or cancelled this merge.',
  badPart: 'Pick a part from the list.',
};

let S = null; // the persisted session
let v = 0; // bumped on every change; a restart resets it (clients refetch on reconnect)
let key = '';
const online = new Map(); // pid → open event streams
const listeners = [];

// ---------- Small helpers ----------

const now = () => Date.now();
const short = (id) => String(id).slice(0, 7);
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
const done = (message, extra = {}) => ({ ok: true, result: { message, ...extra } });
// Lookups by client-sent keys: own properties only (so "__proto__" finds nothing).
const own = (obj, k) => (Object.hasOwn(obj, String(k ?? '')) ? obj[String(k)] : undefined);
const person = (pid) => own(S.people, pid);
const labById = (id) => own(S.labs, id);
const labName = (id) => labById(id)?.name ?? `Lab ${id}`;
const authorOf = (me) => ({ pid: me.pid, name: me.name });
const mainLocked = (note) => (note === 'main' && STEPS[S.step].mainLocked) || null;
const isBoss = (lab) => S.step === 6 && S.stepLab[6] === lab.id;
const allowed = (part, value) => PARTS.includes(part) && palette(S.step)[part].includes(value);
const clone = (id) => git.cloneLab(id, { replace: true });
// One line of student text: spaces collapsed, at most max characters.
const tidy = (text, max) => [...String(text ?? '').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();

export const adminKey = () => key;
export const version = () => ({ v, boot: S.boot });
export const labOf = (pid) => person(pid)?.labId;
export const onChange = (fn) => listeners.push(fn);
// Something the console shows changed outside the session (the rehearsal bots, server/bots.js).
export const touch = () => bump();

// labId = null means the whole session (and the Wall) changed.
function bump(labId = null) {
  v += 1;
  save();
  for (const fn of listeners) fn(labId);
}

export function connect(pid) {
  online.set(pid, (online.get(pid) || 0) + 1);
  if (online.get(pid) === 1 && person(pid)) bump(person(pid).labId);
}

export function disconnect(pid) {
  const left = (online.get(pid) || 1) - 1;
  if (left) online.set(pid, left);
  else online.delete(pid);
  if (!left && person(pid)) bump(person(pid).labId);
}

// ---------- Running alone ----------
// Scene changes, joins (they may add or remove labs), lab-count changes and Reset run alone:
// new requests wait at the gate, requests already running finish first. Everything else runs through work().

let gate = null;
let running = 0;
let drained = null;

async function work(fn) {
  while (gate) await gate;
  running += 1;
  try {
    return await fn();
  } finally {
    running -= 1;
    if (!running) drained?.();
  }
}

async function alone(fn) {
  while (gate) await gate;
  let open;
  gate = new Promise((resolve) => { open = resolve; });
  try {
    while (running) await new Promise((resolve) => { drained = resolve; });
    return await fn();
  } finally {
    gate = null;
    open();
  }
}

// ---------- Persistence ----------

let saveTimer = null;
function save() {
  saveTimer ??= setTimeout(flush, SAVE_DELAY_MS);
}

export function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!S) return;
  const tmp = `${SESSION_FILE}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  fs.writeSync(fd, JSON.stringify(S));
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmp, SESSION_FILE);
}

// A kill in the middle of update-ref leaves e.g. refs/heads/main.lock behind; every later save would fail.
function removeStaleLocks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) removeStaleLocks(p);
    else if (entry.name.endsWith('.lock')) fs.rmSync(p, { force: true });
  }
}

function newLab(id) {
  return {
    id,
    name: `Lab ${id}`,
    color: LAB_COLORS[Number(id) - 1],
    practice: false, // the scripted practice lab: no people, plays its part on the Wall
    chaos: { ...START },
    drafts: { main: {} },
    draftBy: {}, // note → part → pid of who changed it last
    merging: {},
    concepts: {},
    by: {}, // pid → concept counts
    lastOp: null,
    lastClickAt: null,
    refusedInARow: 0,
  };
}

// fixed: the teacher's (or LABS=) lab count; null = from the headcount.
async function fresh(fixed) {
  fs.rmSync(path.join(DATA_DIR, 'labs'), { recursive: true, force: true });
  fs.rmSync(path.join(DATA_DIR, 'wall.git'), { recursive: true, force: true });
  await git.initWall();
  S = {
    format: FORMAT,
    boot: crypto.randomBytes(4).toString('hex'),
    scene: 0, // index into SCENES; the teacher's Next and Back move it
    step: 0, // always SCENES[scene].step: whose buttons are on
    sceneStartedAt: now(),
    stepStartedAt: now(),
    planStartedAt: null, // the class clock: first join, or the timer restart during Step 0
    ask: false, // the scene's question is on the projector
    show: { answers: false, names: false }, // the scene's answers are on the projector (names hidden by default)
    autoLabs: !fixed, // the lab count follows the headcount until the teacher sets it
    labsLocked: false, // Step 1 was entered: labs have history now, so the count and the labs stay (Back too)
    stepLab: {}, // 4: whose main went to the Wall · 6: the boss lab
    wallMet: false, // Step 4's one-time send + clone ran
    practiced: false, // the practice lab sent its Step 4 card
    ways: {}, // Step 4: labId → {way: 'merge' | 'rebase', by, why, t}, the way the lab chose to get the Wall's cards
    undos: {}, // Step 5: labId → {way: 'revert' | 'reset', by, t}, how the lab chose to undo the Intern's card
    moments: {}, // predictions, by moment id ("3:2:merge:sporty", "4:2:push:1"): {step, labId, kind, target, guesses, outcome}
    integration: null, // the Wall's integration paths at the end of Step 4, for the paper (the squash erases them)
    pathsTier: 0, // "Find the path back": the tier on the projector
    sabotaged: false, // the Intern's card went to the Wall (admin button or entering Step 5)
    handedOut: false, // Step 5 was entered: every lab level with the Wall got the Intern's card
    labs: {},
    people: {},
    answers: {}, // scene id → pid → {text, t}
    takeaways: {}, // pid → step → {text, t}
    feed: [],
    audits: { before: null, after: null }, // "who first added the boots?", before and after the Wall was replaced
    bin: null, // the last "Empty the Wall's bin": {before, after}
  };
  await setLabs(fixed || labsFor(0));
  flush();
}

export async function boot() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  removeStaleLocks(DATA_DIR);
  key = process.env.ADMIN_KEY || (fs.existsSync(KEY_FILE) && fs.readFileSync(KEY_FILE, 'utf8').trim());
  if (!key) {
    key = crypto.randomBytes(9).toString('base64url');
    fs.writeFileSync(KEY_FILE, `${key}\n`, { mode: 0o600 });
  }
  const saved = fs.existsSync(SESSION_FILE) && JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  if (saved?.format === FORMAT && fs.existsSync(path.join(DATA_DIR, 'wall.git'))) {
    S = saved;
    // A lab that is missing, or broken by a kill in the middle of its clone, starts over from the Wall.
    for (const id of Object.keys(S.labs)) {
      const sound = fs.existsSync(path.join(DATA_DIR, 'labs', id))
        && (await git.git(id, ['rev-parse', '--verify', '-q', 'refs/heads/main'])).code === 0;
      if (!sound) await clone(id);
    }
    await agreeWithGit();
    drop(Object.values(S.people).filter((p) => p.bot).map((p) => p.pid)); // bots never outlive their server
  } else {
    const fixed = Number(process.env.LABS);
    await fresh(Number.isInteger(fixed) && fixed >= 1 && fixed <= 6 ? fixed : null);
  }
}

// After a crash the session file can be one debounce behind Git. Git wins: drop draft parts a card
// already has, and open merges whose note has moved on (they could never finish).
async function agreeWithGit() {
  for (const lab of Object.values(S.labs)) {
    const graph = await git.graph(lab.id);
    for (const [note, draft] of Object.entries(lab.drafts)) {
      const card = index(graph).get(tipOf(graph, note))?.monster ?? {};
      for (const part of Object.keys(draft)) if (draft[part] === card[part]) delete draft[part];
    }
    for (const [note, open] of Object.entries(lab.merging)) {
      if (tipOf(graph, note) !== open.intoTip) delete lab.merging[note];
    }
  }
}

// ---------- Labs and people ----------

// The lab count for a headcount, about 4 per lab (two pairs of 2): 1–3 → 1 (plus the practice lab),
// 4–8 → 2, 9–12 → 3, 13+ → 4 to 6. With 2 or more labs, every lab starts with at least 2 people.
export function labsFor(people) {
  if (people <= 3) return 1;
  if (people <= 8) return 2;
  return Math.min(6, Math.ceil(people / 4));
}
const BIG_LAB = 6; // more people than this in one lab: idle hands

const realLabs = () => Object.values(S.labs).filter((l) => !l.practice);
const practiceLab = () => Object.values(S.labs).find((l) => l.practice) ?? null;
const peopleIn = (id) => Object.values(S.people).filter((p) => p.labId === id);
const byJoin = (a, b) => a.joinedAt - b.joinedAt;
const randomOf = (items) => items[crypto.randomInt(items.length)];

// Step 4: the lab's way to get the Wall's cards is its own choice: the first Get & combine or Replay on top
// that had to combine two lines (not a fast-forward). Step 5: its first Undo on the Intern's card, or Move back.
// Kept once chosen; the practice lab never chooses.
function chooseWay(lab, way, who) {
  if (S.step !== 4 || lab.practice || S.ways[lab.id]) return;
  S.ways[lab.id] = { way, by: who.name, byPid: who.pid, why: '', t: now() };
}
function chooseUndo(lab, way, who) {
  if (S.step !== 5 || lab.practice || S.undos[lab.id]) return;
  S.undos[lab.id] = { way, by: who.name, byPid: who.pid, t: now() };
}
const wayOf = (lab) => S.ways[lab.id]?.way ?? null;

// The real lab with the fewest people; a tie is broken at random.
function smallestLab() {
  const labs = realLabs();
  const fewest = Math.min(...labs.map((l) => peopleIn(l.id).length));
  return randomOf(labs.filter((l) => peopleIn(l.id).length === fewest));
}

function freePair(labId) {
  const inLab = peopleIn(labId);
  const a = inLab.filter((p) => p.pair === 'A').length;
  return a <= inLab.length - a ? 'A' : 'B';
}

// Put everyone in a real lab, then even out: move a random person from the biggest lab to the
// smallest until sizes differ by at most one. Pairs alternate A/B by join order. Only before Step 1.
function rebalance() {
  const labs = realLabs();
  const real = new Set(labs.map((l) => l.id));
  for (const p of Object.values(S.people).filter((x) => !real.has(x.labId))) p.labId = smallestLab().id;
  for (;;) {
    const sizes = labs.map((l) => peopleIn(l.id)).sort((a, b) => a.length - b.length);
    if (sizes.at(-1).length - sizes[0].length <= 1) break;
    randomOf(sizes.at(-1)).labId = smallestLab().id;
  }
  for (const lab of labs) {
    peopleIn(lab.id).sort(byJoin).forEach((p, i) => Object.assign(p, { pair: i % 2 ? 'B' : 'A', branch: 'main' }));
  }
}

// count real labs; a single lab plays next to the practice lab (Lab 2's slot), so every lesson still happens.
async function setLabs(count) {
  const total = count === 1 ? 2 : count;
  for (let n = Object.keys(S.labs).length + 1; n <= total; n++) {
    await clone(String(n));
    S.labs[n] = newLab(String(n));
  }
  for (const id of Object.keys(S.labs).slice(total)) {
    delete S.labs[id];
    await git.removeLab(id);
  }
  for (const lab of Object.values(S.labs)) {
    const practice = count === 1 && lab.id === '2';
    Object.assign(lab, practice
      ? { practice, name: PRACTICE.name, color: PRACTICE_COLOR }
      : { practice, name: `Lab ${lab.id}`, color: LAB_COLORS[Number(lab.id) - 1] });
  }
  rebalance();
}

// A new person: before Step 1 the lab count follows the headcount (unless the teacher set it),
// and the labs even out. Later, the smallest lab.
async function place(me) {
  if (!S.labsLocked && S.autoLabs) return setLabs(labsFor(Object.keys(S.people).length));
  const lab = smallestLab();
  Object.assign(me, { labId: lab.id, pair: freePair(lab.id), branch: 'main' });
}

// ---------- Reading Git state ----------

const tipOf = (graph, note) => graph.refs[`refs/heads/${note}`] ?? null;
const index = (graph) => new Map(graph.commits.map((c) => [c.id, c]));

// Every card reachable from id by following parent arrows (id included).
function history(byId, id) {
  const seen = new Set();
  const todo = id ? [id] : [];
  while (todo.length) {
    const c = byId.get(todo.pop());
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    todo.push(...c.parents);
  }
  return seen;
}

// What a lab did since its step began, read from the feed.
const DID = {
  refused: (e) => e.action === 'Send to Wall' && e.bad,
  reset: (e) => e.action === 'Move my branch back here',
};
const didThisStep = (lab, test) => S.feed.some((e) => e.labId === lab.id && e.t >= S.stepStartedAt && test(e));

function membersOf(lab) {
  return peopleIn(lab.id)
    .sort(byJoin)
    .map(({ pid, name, pair, branch }) => ({ pid, name, pair, branch, online: online.has(pid) }));
}

// What steps.js goals and hints read about a lab (the list is in steps.js).
function labView(lab, graph, wallGraph) {
  const byId = index(graph);
  const wallById = wallGraph ? index(wallGraph) : new Map();
  const mainTip = tipOf(graph, 'main');
  const wallTip = wallGraph && tipOf(wallGraph, 'main');
  const mainHistory = history(byId, mainTip);
  const wallHistory = history(wallById, wallTip);
  const intern = graph.commits.find((c) => c.author === INTERN.name);
  const hasParts = (id, parts) => Object.entries(parts).every(([part, value]) => byId.get(id)?.monster?.[part] === value);
  return {
    labId: lab.id,
    isBoss: isBoss(lab),
    way: () => wayOf(lab),
    card: (note) => byId.get(tipOf(graph, note))?.monster ?? null,
    draft: (note) => lab.drafts[note] ?? {},
    merging: (note) => lab.merging[note] ?? null,
    mainHasIdea: (note) => [...mainHistory].some((id) => hasParts(id, PAIR_PARTS[note])),
    wall() {
      if (!wallTip || mainTip === wallTip) return 'same';
      if (mainHistory.has(wallTip)) return 'ahead';
      return wallHistory.has(mainTip) ? 'behind' : 'diverged';
    },
    wallHas: (part, value) => [...wallHistory].some((id) => wallById.get(id).monster[part] === value),
    wallOutfit: () => wallById.get(wallTip)?.monster ?? null,
    wallIsClean: () => wallHistory.size === 2,
    gotSabotage: () => !!intern,
    mainHasSabotage: () => !!intern && mainHistory.has(intern.id),
    undidSabotage: () => didThisStep(lab, DID.reset) || (!!intern && didThisStep(lab, (e) => e.action === `Undo card ${short(intern.id)}`)),
    savers() {
      const here = membersOf(lab).filter((m) => m.online);
      const waiting = here.filter((m) => !lab.by[m.pid]?.save).map((m) => m.name);
      return { saved: here.length - waiting.length, online: here.length, waiting };
    },
    did: (what) => didThisStep(lab, DID[what]),
  };
}

// The step's goals for a lab; done = every goal ticks (steps without goals are never done).
// The practice lab has none: it never needs attention.
function progress(lab, graph, wallGraph) {
  const view = labView(lab, graph, wallGraph);
  const goals = lab.practice ? [] : STEPS[S.step].goals(view);
  return { view, goals, done: goals.length > 0 && goals.every((g) => g.done) };
}

// Students see the blue wall/main note and diary-only cards (a replay's originals, a moved-back card) from Step 4.
function shownGraph(graph) {
  const refs = Object.fromEntries(Object.entries(graph.refs)
    .filter(([name]) => S.step >= 4 || !name.startsWith('refs/remotes/')));
  const commits = S.step >= 4 ? graph.commits : graph.commits.filter((c) => c.reachable);
  return { ...graph, refs, commits };
}

async function noteCard(lab, note) {
  const graph = await git.graph(lab.id);
  return index(graph).get(tipOf(graph, note)) ?? null;
}

const noteMonster = async (lab, note) => (await noteCard(lab, note))?.monster ?? null;

// Step 5: the lab has the Intern's card, but main moved back off it (the card is only on wall/main or in the diary).
async function movedOffSabotage(lab) {
  if (S.step !== 5) return false;
  const view = labView(lab, await git.graph(lab.id), null);
  return view.gotSabotage() && !view.mainHasSabotage();
}

function branchesOf(graph) {
  return Object.fromEntries(Object.entries(graph.refs)
    .filter(([name]) => name.startsWith('refs/heads/'))
    .map(([name, id]) => [name.slice('refs/heads/'.length), id]));
}

// The lab's outfit for the admin and projector: the Step 0 outfit, then main + its draft.
function labMonster(lab, graph) {
  if (S.step === 0) return lab.chaos;
  return { ...index(graph).get(tipOf(graph, 'main'))?.monster, ...lab.drafts.main };
}

// ---------- Predictions: Step 3's merges, Steps 4–5's sends ----------
// A moment is one lab action the class predicts: "3:2:merge:sporty", "4:2:push:1". The presser's guess travels
// with the action; anyone else in the lab may guess while the moment is open. Git's answer closes it and scores
// every guess. A send that changes nothing ("already on the Wall") leaves the moment open.

const MERGE_TARGETS = Object.values(PAIR_NOTES);
const PUSH_STEPS = [4, 5];

// The lab's open moment for an action, made on first use; null when nothing is predicted (or Git answered).
function moment(lab, kind, target = null) {
  if (lab.practice) return null;
  if (kind === 'merge') {
    if (S.step !== 3 || !MERGE_TARGETS.includes(target)) return null;
    const id = `3:${lab.id}:merge:${target}`;
    const m = (S.moments[id] ??= { id, step: 3, labId: lab.id, kind, target, guesses: {}, outcome: null });
    return m.outcome ? null : m;
  }
  if (!PUSH_STEPS.includes(S.step)) return null;
  for (let n = 1; ; n++) {
    const id = `${S.step}:${lab.id}:push:${n}`;
    const m = (S.moments[id] ??= { id, step: S.step, labId: lab.id, kind, target: null, n, guesses: {}, outcome: null });
    if (!m.outcome) return m;
  }
}

// The lab's open moments, in the order they come (fancy before sporty).
const openMoments = (lab) => (S.step === 3 ? MERGE_TARGETS.map((t) => moment(lab, 'merge', t)) : [moment(lab, 'push')]).filter(Boolean);

const mergeOutcome = (r) => (r.fastForward ? { result: 'ff' } : r.merged ? { result: 'clean' } : r.conflict ? { result: 'conflict', parts: r.conflicts } : null);
const pushOutcome = (r) => (r.rejected ? { result: 'refused', reason: r.reason } : r.already ? null : { result: 'accepted' });

// Git answered: close the moment and score each guess.
function settleMoment(m, outcome, who) {
  if (!m || m.outcome || !outcome) return;
  m.outcome = { ...outcome, t: now(), by: who.name, byPid: who.pid };
  for (const g of Object.values(m.guesses)) g.right = isRight(g.guess, m.outcome);
}

// The presser's guess, sent with the action: kept even if the action then waits (an open merge, unsaved parts).
function takeGuess(m, me, guess) {
  if (!m || guess == null || guess === '') return null;
  if (!validGuess(m.kind, String(guess))) return fail('Pick one of the answers.');
  m.guesses[me.pid] = { guess: String(guess), t: now(), pressed: true };
  return null;
}

// The action runs only once the presser has predicted.
function needGuess(m, me) {
  if (!m) return null;
  if (!m.guesses[me.pid]) return fail(PREDICT.first, { predict: m.id, tone: 'info' });
  m.guesses[me.pid].pressed = true;
  return null;
}

// My latest scored prediction in this step: one line, for the panel (and the resolver).
function myVerdict(lab, pid) {
  const last = Object.values(S.moments)
    .filter((m) => m.labId === lab.id && m.step === S.step && m.outcome && m.guesses[pid])
    .sort((a, b) => a.outcome.t - b.outcome.t).at(-1);
  if (!last) return null;
  const g = last.guesses[pid];
  return { moment: last.id, kind: last.kind, target: last.target, right: g.right, line: verdict(g.guess, last.outcome) };
}

// The class's predictions in a step, real labs only: right of total, by part, and guesses still waiting for Git.
function accuracy(step) {
  const real = new Set(realLabs().map((l) => l.id));
  const parts = Object.fromEntries(Object.entries(ACCURACY_PART).map(([key, label]) => [key, { label, right: 0, total: 0 }]));
  let right = 0;
  let total = 0;
  let waiting = 0;
  for (const m of Object.values(S.moments)) {
    if (m.step !== step || !real.has(m.labId)) continue;
    const guesses = Object.values(m.guesses);
    if (!m.outcome) { waiting += guesses.length; continue; }
    const part = parts[m.kind === 'merge' ? m.target : m.outcome.result];
    for (const g of guesses) {
      part.total += 1;
      total += 1;
      if (g.right) { part.right += 1; right += 1; }
    }
  }
  if (!total && !waiting) return null;
  const shown = Object.values(parts).filter((p) => p.total);
  return { step, right, total, waiting, parts: shown, line: total ? accuracyLine({ right, total, parts: shown }) : null };
}

// What the Step 3–5 reveals add under the cards: the class's accuracy, then (Steps 4–5) what each lab chose,
// and what a way nobody chose would have done.
function factsFor(scene) {
  if (scene.kind !== 'reveal' || !PREDICT_STEPS.includes(scene.step)) return [];
  const out = [];
  const acc = accuracy(scene.step);
  if (acc?.total) out.push(acc.line);
  const [chosen, names, missing] = scene.step === 4 ? [S.ways, WAYS, NOT_CHOSEN] : scene.step === 5 ? [S.undos, UNDO_WAYS, UNDO_NOT_CHOSEN] : [];
  if (!chosen) return out;
  const rows = realLabs().filter((l) => chosen[l.id]).map((l) => ({ name: l.name, way: names[chosen[l.id].way].name, why: chosen[l.id].why }));
  if (rows.length) out.push(choiceLine(rows));
  for (const way of Object.keys(names)) if (!realLabs().some((l) => chosen[l.id]?.way === way)) out.push(missing[way]);
  return out;
}

// The paper: Step 4's lived line says what would happen when no lab replayed on top.
function paperFor() {
  const replayed = Object.values(S.ways).some((w) => w.way === 'rebase');
  return { ...PAPER, lived: PAPER.lived.map(({ none, ...line }) => (none && !replayed ? { ...line, text: none } : line)) };
}

// "Stuck? Hint" shows once the step has run HINT_DELAY for me (I may have joined late), and again HINT_DELAY
// after my lab's latest refusal or conflict.
function hintAt(lab, me) {
  const stuck = S.feed.find((e) => e.labId === lab.id && e.bad && e.t >= S.stepStartedAt)?.t ?? 0;
  return Math.max(S.stepStartedAt, me.joinedAt ?? 0, stuck) + HINT_DELAY_MS;
}

// Step 4, for the rehearsal bots: the labs in the order the Wall first refused them in this step.
export function refusedOrder() {
  const out = [];
  for (let i = S.feed.length - 1; i >= 0; i--) {
    const e = S.feed[i];
    if (e.labId && e.t >= S.stepStartedAt && DID.refused(e) && !out.includes(e.labId)) out.push(e.labId);
  }
  return out;
}

// ---------- State for clients ----------

// Step 6's boss lab: the admin's pick, else the first real lab with someone online.
const defaultBoss = () => (realLabs().find((l) => membersOf(l).some((m) => m.online)) ?? realLabs()[0]).id;
const bossLab = () => S.stepLab[6] ?? defaultBoss();
const fillBoss = (text) => text?.replaceAll('{boss}', labName(bossLab())) ?? null;

// One step's copy for students (lab) or the projector (no lab). Step 4's and Step 6's instructions depend on the lab.
// Where each editable text comes from (server/text.js), with its template before {wallLab} and {boss} are filled.
const src = (p, r) => (typeof r === 'string' ? { p, r } : null);

function stepFor(n, lab) {
  const s = STEPS[n];
  const boss = lab && lab.id === S.stepLab[6];
  const at = `tue/STEPS/${n}`;
  const wallLab = !S.stepLab[4] ? 'one lab' : lab?.id === S.stepLab[4] ? 'your lab' : labName(S.stepLab[4]);
  return {
    n,
    id: s.id,
    title: s.title,
    // Only where the lab presses something: in Step 6 only for the boss lab.
    fixedLine: [3, 4, 5].includes(n) || (n === 6 && boss) ? FIXED_LINE : null,
    instruction: fillBoss((boss && s.bossInstruction) || s.instruction).replaceAll('{wallLab}', wallLab),
    story: s.story && {
      now: fillBoss(s.story.now).replaceAll('{wallLab}', wallLab),
      job: fillBoss((boss && s.story.jobBoss) || s.story.job),
      git: s.story.git,
    },
    // Step 4: what the fresh copy of the Wall holds, so no lab thinks its history vanished silently.
    fresh: s.fresh && lab && S.wallMet ? (lab.id === S.stepLab[4] ? s.fresh.wallLab : s.fresh.other.replaceAll('{wallLab}', wallLab)) : null,
    screen: fillBoss(s.screen),
    unlocks: s.unlocks,
    tips: n === 6 && !boss ? [] : s.tips, // only the boss lab gets the replace button
    mainLocked: s.mainLocked ?? null,
    choices: n === 4 ? { ways: WAYS, whyQ: WHY_Q, whyMax: WHY_MAX } : null, // Step 4: the two ways, one line each
    bonus: s.bonus ?? null,
    doneLine: DONE_LINE,
    behind: s.behind,
    src: {
      title: src(`${at}/title`, s.title),
      instruction: boss && s.bossInstruction ? src(`${at}/bossInstruction`, s.bossInstruction) : src(`${at}/instruction`, s.instruction),
      now: src(`${at}/story/now`, s.story?.now),
      job: boss && s.story?.jobBoss ? src(`${at}/story/jobBoss`, s.story.jobBoss) : src(`${at}/story/job`, s.story?.job),
      git: src(`${at}/story/git`, s.story?.git),
      screen: src(`${at}/screen`, s.screen),
      bonus: src(`${at}/bonus`, s.bonus),
      behind: src(`${at}/behind/text`, s.behind?.text),
    },
  };
}

// A scene as students and the projector see it. Questions show; answers and teacher lines never do.
function sceneFor(n) {
  const s = SCENES[n];
  return {
    n,
    id: s.id,
    kind: s.kind,
    step: s.step,
    title: s.title,
    line: fillBoss(s.line ?? (s.kind === 'task' ? STEPS[s.step].screen : null)),
    question: s.answerable ? s.ask.q : null,
    answerable: s.answerable,
    src: {
      title: src(`tue/SCENES/${s.id}/title`, s.title),
      line: s.line ? src(`tue/SCENES/${s.id}/line`, s.line) : s.kind === 'task' ? src(`tue/STEPS/${s.step}/screen`, STEPS[s.step].screen) : null,
      question: src(`tue/SCENES/${s.id}/ask/q`, s.ask?.q),
      sentence: src(`tue/SCENES/${s.id}/reveal/sentence`, s.reveal?.sentence),
      behind: src(`tue/SCENES/${s.id}/reveal/behind`, s.reveal?.behind),
      note: src(`tue/SCENES/${s.id}/reveal/note`, s.reveal?.note),
    },
    takeawayStep: s.takeawayStep,
    reveal: s.reveal ?? null,
    facts: factsFor(s),
    paper: s.kind === 'paper' ? paperFor() : null,
    wrap: s.kind === 'wrap' ? { line: WRAP_LINE } : null,
  };
}

// The rescue plan for the scene's step, where the teacher can still help a lab.
const rescues = (s) => ['task', 'reveal', 'break'].includes(s.kind) && !!RESCUE[s.step];

// The scene with the teacher's lines and tools. picks fills {wallLab} and {boss}.
function teacherScene(n, picks) {
  const s = SCENES[n];
  const fill = (text) => text?.replaceAll('{wallLab}', picks.wallLab).replaceAll('{boss}', picks.boss) ?? null;
  const next = SCENES[n + 1];
  const practiceNote = practiceLab() && next?.practiceNext;
  return {
    ...sceneFor(n),
    at: s.at,
    minutes: s.minutes,
    say: fill(s.say),
    do: fill(s.do),
    ask: s.ask,
    board: s.board ?? null,
    teacherSrc: {
      say: src(`tue/SCENES/${s.id}/say`, s.say), do: src(`tue/SCENES/${s.id}/do`, s.do),
      ask: src(`tue/SCENES/${s.id}/ask/q`, s.ask?.q), answer: src(`tue/SCENES/${s.id}/ask/a`, s.ask?.a),
      board: src(`tue/SCENES/${s.id}/board`, s.board),
    },
    tools: [...s.tools, ...(rescues(s) ? ['rescue'] : []), ...(s.answerable ? ['answers'] : [])],
    next: next ? { n: n + 1, title: next.title, note: [fill(next.next), practiceNote].filter(Boolean).join(' ') || null } : null,
    back: n > 0 ? { n: n - 1, title: SCENES[n - 1].title } : null,
  };
}

const labsList = () => Object.values(S.labs).map((l) => ({
  id: l.id, name: l.name, color: l.color, practice: l.practice, members: peopleIn(l.id).length,
}));

async function publicSession(lab) {
  const scene = SCENES[S.scene];
  return {
    boot: S.boot,
    step: S.step,
    scene: sceneFor(S.scene),
    steps: STEPS.map((_, n) => stepFor(n, lab)),
    labs: labsList(),
    timer: { startedAt: S.sceneStartedAt, minutes: scene.minutes },
    ask: (S.ask && scene.ask?.q) || null,
    bossLab: S.step === 6 ? S.stepLab[6] : null,
    audits: S.step >= 6 ? S.audits : null,
    bin: S.step >= 6 ? S.bin : null,
    integration: await integrationFor(scene),
    paths: scene.kind === 'paths' ? pathsView() : null,
  };
}

// "Find the path back": the paper's algorithm on its Figure 3. The projector shows the teacher's tier;
// students step through the tiers on their own.
const pathsView = () => ({ ...PATHS, tier: S.pathsTier ?? 0 });

// ---------- Integration paths: Step 4's reveal and the paper ----------
// Each lab's Step 4 change on the Wall's main: the cards from the change's card up to the card the lab's own send
// made main (the shortest run, following arrows back), when the change was made (its card's author time) and when it
// reached the Wall (that send: Git's "update by push" line in its wall/main reflog). The class's real times.
// A replayed change starts at a copy: the lab's original card (same author, author time and message) is only in its diary.
// A combined change ends at the lab's own merge card.

// The shortest run of cards from id up to tip, as [id, ..., tip].
function pathTo(byId, tip, id) {
  const child = new Map([[tip, null]]); // card → the card one step nearer tip
  for (const todo = [tip]; todo.length && !child.has(id);) {
    const c = byId.get(todo.shift());
    for (const p of c?.parents ?? []) {
      if (!child.has(p)) {
        child.set(p, c.id);
        todo.push(p);
      }
    }
  }
  const path = [];
  for (let at = id; at; at = child.get(at)) path.push(at);
  return path;
}

let pathsCache = { key: [], value: null }; // the graphs it was read from → {graph, paths}

async function integrationNow() {
  const labs = Object.values(S.labs);
  const wall = await git.graph('wall');
  const graphs = await Promise.all(labs.map((l) => git.graph(l.id)));
  const key = [wall, ...graphs];
  if (key.length === pathsCache.key.length && key.every((g, i) => g === pathsCache.key[i])) return pathsCache.value;
  const byId = index(wall);
  const tip = tipOf(wall, 'main');
  const onWall = history(byId, tip);
  const paths = [];
  for (const [i, lab] of labs.entries()) {
    const c = LAB_CHANGES[lab.id];
    const has = (id) => byId.get(id)?.monster?.[c.part] === c.value;
    const card = wall.commits.findLast((x) => onWall.has(x.id) && has(x.id) && !x.parents.some(has));
    if (!card) continue;
    const mine = index(graphs[i]);
    // Replayed twice? The first of its copies to be committed is the card the lab saved.
    const original = graphs[i].commits
      .filter((x) => !onWall.has(x.id) && x.author === card.author && x.time === card.time && x.message === card.message)
      .sort((a, b) => a.committerTime - b.committerTime)[0];
    const sent = (await git.pushes(lab.id)).find((p) => history(mine, p.id).has(card.id));
    if (!sent) continue;
    const cards = pathTo(byId, sent.id, card.id);
    const merged = cards.some((id) => byId.get(id)?.parents.length === 2);
    paths.push({
      labId: lab.id, name: lab.name, part: c.part, value: c.value, cards, made: card.time, onWall: sent.time,
      copy: !!original, original: original?.id ?? null, note: original ? COPY_LINE : merged ? MERGE_LINE : null, sent: sent.id,
    });
  }
  // In the order they reached the Wall: by time, then (within a second) by the Wall's history, which only grows.
  const earlier = (a, b) => history(byId, b.sent).has(a.sent);
  paths.sort((a, b) => a.onWall - b.onWall || (earlier(a, b) ? -1 : earlier(b, a) ? 1 : 0));
  pathsCache = { key, value: { graph: wall, paths: paths.map(({ sent, ...p }) => p) } };
  return pathsCache.value;
}

// Step 4's reveal reads the paths live; the paper shows them as they were at the end of Step 4.
async function integrationFor(scene) {
  if (scene.id === 'reveal-4') return { live: true, ...(await integrationNow()) };
  if (scene.id === 'paper' && S.integration) return { live: false, ...S.integration };
  return null;
}

// "My Git in 7 lines": my takeaway for each step (0–6), with the board line beside it.
function gitIn7(pid) {
  const mine = S.takeaways[pid] ?? {};
  return TAKEAWAY_STEPS.map((step) => ({
    step,
    title: STEPS[step].title,
    text: mine[step]?.text ?? '',
    board: SCENES.find((s) => s.takeawayStep === step).board,
  }));
}

const myAnswers = (pid) => Object.fromEntries(Object.entries(S.answers)
  .filter(([, given]) => given[pid]).map(([scene, given]) => [scene, given[pid].text]));

export const state = (pid) => work(async () => {
  const me = person(pid);
  if (!me) return { ok: true, session: await publicSession(null), me: null };
  const lab = S.labs[me.labId];
  const graph = await git.graph(lab.id);
  const wallGraph = S.step >= 4 ? await git.graph('wall') : null;
  if (!tipOf(graph, me.branch)) me.branch = 'main';
  const others = membersOf(lab).filter((m) => m.online && m.pid !== me.pid);
  const both = others.length === 0; // nobody else here: do both pairs' work
  const solo = !others.some((m) => m.pair === me.pair);
  const { view, goals, done: labDone } = progress(lab, graph, wallGraph);
  const hint = labDone ? null : STEPS[S.step].hint(view, { pair: me.pair, branch: me.branch, saved: !!lab.by[me.pid]?.save, both });
  return {
    ok: true,
    now: now(), // the server's clock: the page times the hint from it
    session: await publicSession(lab),
    me: {
      pid: me.pid,
      name: me.name,
      labId: me.labId,
      pair: me.pair,
      both,
      branch: me.branch,
      mission: missionFor(S.step, lab.id, me.pair, {
        solo, both, fancyMerged: view.mainHasIdea('fancy'), fancyLeft: !!view.card('fancy'), way: view.way(), done: labDone,
        got: view.gotSabotage(), undo: S.undos[lab.id]?.way ?? null, refused: didThisStep(lab, DID.refused),
      }),
      // The name New branch suggests: my pair's, or the next one not made yet when I do both.
      pairNote: both ? (Object.values(PAIR_NOTES).find((n) => !tipOf(graph, n)) ?? PAIR_NOTES.B) : PAIR_NOTES[me.pair],
      hint, // {idea, click}: the page shows the idea first, the click on a second press
      hintAt: hintAt(lab, me),
      verdict: myVerdict(lab, me.pid),
      answers: myAnswers(me.pid),
      gitIn7: gitIn7(me.pid),
    },
    lab: {
      id: lab.id,
      name: lab.name,
      color: lab.color,
      way: wayOf(lab),
      why: S.ways[lab.id]?.why ?? '',
      undo: S.undos[lab.id]?.way ?? null,
      // What the lab can predict now; mine = my guess. The presser predicts in a dialog, the others in the panel.
      moments: openMoments(lab).map((m) => ({
        id: m.id, kind: m.kind, target: m.target, ...predictCopy(m.kind, m.target),
        mine: m.guesses[me.pid]?.guess ?? null, count: Object.keys(m.guesses).length,
      })),
      members: membersOf(lab),
      branches: branchesOf(graph),
      drafts: lab.drafts,
      draftBy: lab.draftBy,
      merging: lab.merging,
      goals,
      done: labDone,
      chaos: lab.chaos,
      graph: S.step >= 1 ? shownGraph(graph) : null,
      lastOp: lab.lastOp,
      concepts: lab.concepts,
    },
    wall: wallGraph ? { graph: wallGraph } : undefined,
  };
});

// People who could answer now: those online (everyone, if nobody is).
const audience = () => Object.keys(S.people).filter((pid) => online.has(pid)).length || Object.keys(S.people).length;

function answersFor(sceneId) {
  const list = Object.entries(S.answers[sceneId] ?? {})
    .map(([pid, a]) => ({ pid, name: person(pid)?.name ?? '?', labId: person(pid)?.labId ?? null, text: a.text, t: a.t }))
    .sort((a, b) => a.t - b.t);
  return { count: list.length, of: audience(), list };
}

const takeawaysFor = (step) => ({
  count: Object.values(S.takeaways).filter((mine) => mine[step]).length,
  of: audience(),
});

// A random sample of takeaways, names hidden. The order is fixed per session, so the wall doesn't jump.
function takeawayWall() {
  const rank = (k) => crypto.createHash('sha1').update(`${S.boot}:${k}`).digest('hex');
  return Object.entries(S.takeaways)
    .flatMap(([pid, mine]) => Object.entries(mine).map(([step, t]) => ({ k: rank(`${pid}:${step}`), step: Number(step), text: t.text })))
    .sort((a, b) => a.k.localeCompare(b.k))
    .slice(0, WALL_SAMPLE)
    .map(({ step, text }) => ({ step, text }));
}

// What the projector shows, and nothing private: the scene, the question while the teacher shows it,
// the answers while shown (names only if the teacher turns them on), and the takeaway wall at the wrap.
function projectorView() {
  const scene = SCENES[S.scene];
  const shown = S.show.answers && scene.answerable;
  return {
    scene: sceneFor(S.scene),
    question: (S.ask || shown) ? scene.ask?.q ?? null : null,
    answers: shown ? answersFor(scene.id).list.map(({ name, text }) => (S.show.names ? { name, text } : { text })) : null,
    takeaways: scene.kind === 'wrap' ? takeawayWall() : null,
  };
}

// One status per lab for the teacher: tone 'done' | 'ok' | 'alert' | 'practice', and a few plain words.
// Time-based alerts (a long conflict, no clicks) are the page's to add, from merging[].t and lastClickAt.
function statusOf(lab, isDone) {
  if (lab.practice) return { tone: 'practice', text: 'Played by the app, so your lab has someone to share with' };
  if (isDone) return { tone: 'done', text: 'Done' };
  const open = Object.values(lab.merging)[0];
  if (open) return { tone: 'ok', text: `${{ merge: 'Merging', revert: 'Undoing', rebase: 'Replaying' }[open.kind]}: ${partsOf(open.conflicts)} to pick` };
  if (lab.refusedInARow >= 2) return { tone: 'alert', text: 'Refused twice in a row' };
  return { tone: 'ok', text: 'Working' };
}

// "Labs done: 2/3 · Lab 3: Merging: TOP to pick", for steps with goals.
function readiness(labs) {
  const real = labs.filter((l) => !l.practice);
  if (!real.some((l) => l.goals.length)) return null;
  const finished = real.filter((l) => l.done).length;
  const notes = real.filter((l) => !l.done && l.status.text !== 'Working').map((l) => `${l.name}: ${l.status.text}`);
  return { done: finished, of: real.length, text: [`Labs done: ${finished}/${real.length}`, ...notes].join(' · ') };
}

export const adminState = (joinUrl) => work(async () => {
  const wallGraph = S.step >= 4 ? await git.graph('wall') : null;
  const labs = await Promise.all(Object.values(S.labs).map(async (lab) => {
    const graph = await git.graph(lab.id);
    const { goals, done: labDone } = progress(lab, graph, wallGraph);
    return {
      id: lab.id,
      name: lab.name,
      color: lab.color,
      practice: lab.practice,
      way: wayOf(lab),
      why: S.ways[lab.id]?.why ?? '',
      undo: S.undos[lab.id]?.way ?? null,
      members: membersOf(lab),
      goals,
      done: labDone,
      status: statusOf(lab, labDone),
      merging: lab.merging,
      refusedInARow: lab.refusedInARow,
      lastClickAt: lab.lastClickAt,
      monster: labMonster(lab, graph),
      graph: S.step >= 1 ? shownGraph(graph) : null,
      lastOp: lab.lastOp && { t: lab.lastOp.t, who: lab.lastOp.who, action: lab.lastOp.action, outcome: lab.lastOp.outcome },
      concepts: lab.concepts,
    };
  }));
  const picks = { wallLab: labName(S.stepLab[4] ?? await firstReadyLab()), boss: labName(bossLab()) };
  const scene = SCENES[S.scene];
  return {
    ok: true,
    session: {
      ...await publicSession(null),
      scene: {
        ...teacherScene(S.scene, picks),
        answers: scene.answerable ? answersFor(scene.id) : null,
        takeaways: scene.takeawayStep !== null ? takeawaysFor(scene.takeawayStep) : null,
      },
      scenes: SCENES.map((s, n) => ({ n, id: s.id, kind: s.kind, step: s.step, title: s.title, at: s.at, minutes: s.minutes })),
      planStartedAt: S.planStartedAt,
      joinUrl,
      people: Object.keys(S.people).length,
      autoLabs: S.autoLabs,
      show: S.show,
      stepLab: S.stepLab,
      ready: readiness(labs),
      predictions: PREDICT_STEPS.includes(S.step) ? accuracy(S.step) : null, // live, Steps 3–5
      concepts: CONCEPTS,
    },
    labs,
    wall: wallGraph ? { graph: wallGraph } : null,
    feed: S.feed,
    projector: projectorView(),
  };
});

// ---------- Export: every answer and takeaway, as Markdown ----------

const quoteLine = (text) => text.replace(/\s+/g, ' ');

export const exportMarkdown = () => work(async () => {
  const people = Object.values(S.people).sort((a, b) => a.labId.localeCompare(b.labId, 'en', { numeric: true }) || a.name.localeCompare(b.name));
  const who = (pid) => `${person(pid)?.name ?? '?'} (${labName(person(pid)?.labId)})`;
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const out = ['# Outfit Lab · answers and takeaways', '', `Exported ${stamp} UTC · ${people.length} people · ${realLabs().length} labs`, '', '## By question', ''];
  for (const s of SCENES.filter((x) => x.answerable || x.takeawayStep !== null)) {
    out.push(`### ${s.kind === 'reveal' ? `Step ${s.step} · ${STEPS[s.step].title}` : s.title}`, '', `**Ask:** ${s.ask.q}`, '');
    const answers = answersFor(s.id).list;
    out.push(`Answers (${answers.length}):`, ...answers.map((a) => `- ${who(a.pid)}: ${quoteLine(a.text)}`), '');
    if (s.takeawayStep !== null) {
      const lines = people.filter((p) => S.takeaways[p.pid]?.[s.takeawayStep]);
      out.push(`Takeaways (${lines.length}):`, ...lines.map((p) => `- ${who(p.pid)}: ${quoteLine(S.takeaways[p.pid][s.takeawayStep].text)}`), '');
    }
  }
  out.push(...predictionsMarkdown(who), '## By person', '');
  for (const p of people) {
    out.push(`### ${p.name} · ${labName(p.labId)}`, '', 'My Git in 7 lines:');
    for (const line of gitIn7(p.pid)) out.push(`${line.step}. ${line.text ? quoteLine(line.text) : '—'}`);
    const mine = myAnswers(p.pid);
    out.push('', 'Answers:', ...SCENES.filter((s) => mine[s.id]).map((s) => `- ${s.title}: ${quoteLine(mine[s.id])}`), '');
  }
  return out.join('\n');
});

// Every prediction, per step and per moment, with the class's accuracy; then what each lab chose (Steps 4–5).
function predictionsMarkdown(who) {
  const out = ['## Predictions', ''];
  for (const step of PREDICT_STEPS) {
    const acc = accuracy(step);
    out.push(`### Step ${step} · ${STEPS[step].title}`, '', acc?.line ?? 'No predictions.', '');
    const moments = Object.values(S.moments).filter((m) => m.step === step && m.outcome && Object.keys(m.guesses).some(person))
      .sort((a, b) => a.outcome.t - b.outcome.t);
    for (const m of moments) {
      const what = m.kind === 'merge' ? `merge ${m.target}` : `send ${m.n}`;
      out.push(`${labName(m.labId)} · ${what}${m.outcome.by ? `, pressed by ${m.outcome.by}` : ''}:`);
      for (const [pid, g] of Object.entries(m.guesses).filter(([pid]) => person(pid))) {
        out.push(`- ${who(pid)}${g.pressed ? ' (pressed)' : ''}: ${verdict(g.guess, m.outcome)}`);
      }
      out.push('');
    }
  }
  out.push('## Choices', '');
  for (const lab of realLabs()) {
    const w = S.ways[lab.id];
    const u = S.undos[lab.id];
    const by = (c) => (c.by ? `, by ${c.by}` : '');
    out.push(`- ${lab.name} · Step 4: ${w ? `${WAYS[w.way].name}${by(w)}${w.why ? `. Why: ${quoteLine(w.why)}` : ''}` : '—'}`
      + ` · Step 5: ${u ? `${UNDO_WAYS[u.way].name}${by(u)}` : '—'}`);
  }
  out.push('');
  return out;
}

// ---------- Records: concepts, feed, last op ----------

function count(lab, pid, concept) {
  lab.concepts[concept] = (lab.concepts[concept] || 0) + 1;
  const mine = (lab.by[pid] ??= {});
  mine[concept] = (mine[concept] || 0) + 1;
}

const opOf = (r) => ({ porcelain: r.porcelain, explain: r.explain, commands: r.commands });

// The concept tracker counts what students did; rescues and the practice lab log without concepts.
function log(lab, who, { action, outcome = '', bad = false, concepts = [] }, r = {}) {
  if (lab) for (const c of concepts) count(lab, who.pid, c);
  const entry = { t: now(), labId: lab?.id ?? null, who: who.name, action, outcome, porcelain: r.porcelain ?? '', bad };
  S.feed.unshift(entry);
  S.feed.length = Math.min(S.feed.length, FEED_MAX);
  if (lab) lab.lastOp = { ...entry, explain: r.explain ?? '', commands: r.commands ?? [] };
}

// A finished git op: log it, tell clients, and answer the caller.
// git.js refuses with student-ready words ({refused}) and reports lost compare-and-swaps ({moved}).
function reply(lab, who, r, entry, { message = null, wall = false } = {}) {
  if (r.refused) return fail(r.refused);
  if (r.merging) return fail(T.merging);
  if (r.moved) return fail(T.moved, { op: opOf(r) });
  if (entry) log(lab, who, entry, r);
  bump(wall ? null : lab.id);
  const { commands, porcelain, explain, ...result } = r;
  return { ok: true, result: { ...result, message }, op: opOf(r) };
}

// Errors about timing, not mistakes, read as "press again". Anything else is a real bug: rethrow.
function gitError(err) {
  if (err?.busy || /\.lock|cannot lock|unable to lock|Unable to create/i.test(String(err?.message ?? err))) return fail(T.busy);
  throw err;
}

// ---------- Join: name only; the server picks the lab ----------

// The same name again, from a new browser or a new link: you get your place back (only while that person is offline).
const returning = (name) => Object.values(S.people)
  .find((p) => p.name.toLowerCase() === name.toLowerCase() && !online.has(p.pid));

// bot: a rehearsal bot (server/bots.js; never from the HTTP API).
export const join = ({ name, pid }, { bot = false } = {}) => alone(async () => {
  const clean = tidy(name, 24);
  if (!/[\p{L}\p{N}]/u.test(clean)) return fail('Type your name (a letter or digit).');
  let me = person(pid) ?? returning(clean);
  try {
    if (me) {
      me.name = clean;
    } else {
      me = { pid: crypto.randomBytes(6).toString('hex'), name: clean, labId: null, pair: 'A', branch: 'main', joinedAt: now(), bot };
      S.people[me.pid] = me;
      await place(me);
    }
  } catch (err) {
    return gitError(err);
  }
  S.planStartedAt ??= now();
  bump();
  return { ok: true, pid: me.pid, labId: me.labId, pair: me.pair };
});

function drop(pids) {
  for (const pid of pids) {
    delete S.people[pid];
    delete S.takeaways[pid];
    for (const given of Object.values(S.answers)) delete given[pid];
    // Their predictions go; a choice or a press they made stays, without their name.
    for (const m of Object.values(S.moments)) {
      delete m.guesses[pid];
      if (m.outcome?.byPid === pid) m.outcome.by = null;
    }
    for (const c of [...Object.values(S.ways), ...Object.values(S.undos)]) if (c.byPid === pid) c.by = null;
    online.delete(pid);
  }
}

// Rehearsal bots leave, with their answers and takeaways (real people stay until Reset).
// Before Step 1 the labs follow the headcount again. Their cards stay in Git.
export const leave = (pids) => alone(async () => {
  drop(pids.filter((pid) => person(pid)?.bot));
  try {
    if (!S.labsLocked && S.autoLabs) await setLabs(labsFor(Object.keys(S.people).length));
  } catch (err) {
    return gitError(err);
  }
  bump();
  return { ok: true };
});

// ---------- Student actions ----------

// Reading, answering and writing takeaways are not clicks on the lab's outfit.
const QUIET = new Set(['inspect', 'reflog', 'answer', 'takeaway', 'predict', 'why']);

export const act = (action, input) => work(async () => {
  const me = person(input.pid);
  if (!me) return fail(T.rejoin, { rejoin: true });
  const need = UNLOCK[action] ?? 0;
  if (S.step < need) return fail(`Not yet — this unlocks in Step ${need}.`);
  const lab = S.labs[me.labId];
  if (!QUIET.has(action)) lab.lastClickAt = now();
  try {
    return await ACTIONS[action](me, lab, input);
  } catch (err) {
    return gitError(err);
  }
});

// Shared guards for anything that would move the branch: open merge, then unsaved parts.
function blocked(lab, note) {
  if (lab.merging[note]) return fail(T.merging);
  if (Object.keys(lab.drafts[note] ?? {}).length) return fail(T.unsaved);
  return null;
}

const partsOf = (conflicts) => conflicts.map((p) => p.toUpperCase()).join(', ');

// The Wall's refusal, in words that name the next move (Step 4: the lab's way, or a choice of two).
const refusal = (lab) => (S.step !== 4 ? T.refused : wayOf(lab) ? T.refusedWay(wayOf(lab)) : T.refusedChoose);

// "Replayed your card on top of the Wall's: 1a2b3c4 is now 5d6e7f8, a new ID."
function replayed(r) {
  const [one, ...more] = r.replaced;
  if (!one) return 'Your changes were already on the Wall. Nothing to replay.';
  if (!more.length) return `Replayed your card on top of the Wall's: ${short(one.from)} is now ${short(one.to)}, a new ID.`;
  return `Replayed ${r.replaced.length} cards on top of the Wall's, each with a new ID.`;
}

function rebaseEntry(r) {
  const action = 'Replay on top';
  if (r.conflict) return { action, outcome: `conflict: ${partsOf(r.conflicts)}`, bad: true };
  if (r.fastForward) return { action, outcome: 'fast-forward', concepts: ['rebase', 'fastforward'] };
  return { action, outcome: r.replaced.map(({ from, to }) => `${short(from)} → ${short(to)}`).join(', ') || 'nothing to replay', concepts: ['rebase'] };
}

// After an undo or a move back on main, the next move is to send.
const sendNext = (note) => (note === 'main' ? ' Now press Send to Wall.' : '');

// Finish or Cancel pressed just after someone else's (the merge banner was still up): nothing left to do.
const closed = () => ({ ok: true, result: { nothing: true, message: T.closed } });

function mergeEntry(r, from, into) {
  const action = `Merge ${from} into ${into}`;
  if (r.conflict) return { action, outcome: `conflict: ${partsOf(r.conflicts)}`, bad: true };
  if (r.fastForward) return { action, outcome: 'fast-forward', concepts: ['fastforward'] };
  return { action, outcome: `merge card ${short(r.id)}`, concepts: ['merge'] };
}

function pullEntry(r) {
  const merged = mergeEntry(r, 'wall/main', 'main');
  return { ...merged, action: 'Get & combine', concepts: ['pull', ...(merged.concepts ?? [])] };
}

// The scene index of a question students may answer: answerable, and already reached.
function openQuestion(sceneId) {
  const n = SCENES.findIndex((s) => s.id === String(sceneId ?? ''));
  return n >= 0 && n <= S.scene && SCENES[n].answerable ? SCENES[n] : null;
}

const ACTIONS = {
  async pair(me) {
    if (S.step !== 2) return fail('Pairs are set in Step 2.');
    me.pair = me.pair === 'A' ? 'B' : 'A';
    bump(me.labId);
    return { ok: true, result: { pair: me.pair } };
  },

  async chaos(me, lab, { part, value }) {
    if (S.step !== 0) return fail('That round is over. Use your draft.');
    if (!allowed(part, value)) return fail(T.badPart);
    lab.chaos[part] = value;
    bump(lab.id);
    return { ok: true, result: { chaos: lab.chaos } };
  },

  async draft(me, lab, { part, value }) {
    const note = me.branch;
    if (!allowed(part, value)) return fail(T.badPart);
    if (lab.merging[note]) return fail(T.merging);
    if (mainLocked(note)) return fail(mainLocked(note));
    const card = await noteMonster(lab, note);
    const draft = (lab.drafts[note] ??= {});
    if (card?.[part] === value) delete draft[part];
    else draft[part] = value;
    (lab.draftBy[note] ??= {})[part] = me.pid; // who changed it, for "changed by Ben"
    bump(lab.id);
    return { ok: true, result: { draft } };
  },

  async commit(me, lab) {
    const note = me.branch;
    if (lab.merging[note]) return fail(T.merging);
    if (mainLocked(note)) return fail(mainLocked(note));
    const waiting = Object.keys(lab.drafts[note] ?? {}).length > 0; // someone may save these parts first
    // The draft is shared: say whose changes this card also saves ("It includes Maya's SHOES.").
    const by = lab.draftBy[note] ?? {};
    const others = Object.keys(lab.drafts[note] ?? {}).filter((part) => by[part] && by[part] !== me.pid)
      .map((part) => `${person(by[part])?.name ?? 'someone'}'s ${part.toUpperCase()}`);
    const r = await git.commit(lab, note, authorOf(me));
    if (r.nothing) {
      const card = waiting && await noteCard(lab, note);
      const message = card ? `Already saved by ${card.author}: card ${short(card.id)}.` : 'Nothing changed. Click change on a part first.';
      return reply(lab, me, r, null, { message });
    }
    const includes = others.length ? ` It includes ${others.join(' and ')}.` : '';
    return reply(lab, me, r, { action: 'Save card', outcome: `card ${short(r.id)}`, concepts: ['save'] },
      { message: `Saved card ${short(r.id)}.${includes}` });
  },

  async branch(me, lab, { name }) {
    const note = String(name ?? '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,19}$/.test(note)) return fail('Use a–z, 0–9 and dashes, up to 20.');
    if (note === 'wall') return fail('"wall" is the Wall\'s name. Pick another.');
    const r = await git.createBranch(lab, note);
    if (r.exists) return fail(`${note} already exists. Press Switch to join it.`);
    me.branch = note;
    lab.drafts[note] ??= {};
    return reply(lab, me, r, { action: `New branch ${note}`, outcome: 'from main', concepts: ['branch'] },
      { message: `You're on ${note} now. Change parts, then Save card.` });
  },

  // Switch runs no git: your pin lives in the session, and each branch keeps its own draft.
  // Like git switch, it refuses to leave unsaved parts behind: Git keeps one working copy.
  async switch(me, lab, { branch }) {
    const note = String(branch ?? '');
    if (!tipOf(await git.graph(lab.id), note)) return fail('That branch does not exist.');
    if (note !== me.branch && Object.keys(lab.drafts[me.branch] ?? {}).length) return fail(SWITCH_UNSAVED);
    me.branch = note;
    const r = {
      porcelain: `git switch ${note}`,
      explain: `In real Git, \`git switch ${note}\` writes \`ref: refs/heads/${note}\` into \`.git/HEAD\`. Here your pin (HEAD) is yours alone, so each person can be on a different branch, and each branch keeps its own draft.`,
      commands: [],
    };
    return reply(lab, me, r, { action: `Switch to ${note}`, concepts: ['switch'] }, { message: `You're on ${note} now.` });
  },

  // Merges always go into main ("Merge [note] into main"). Step 3: predict first (guess: what Git will do).
  async merge(me, lab, { from, guess }) {
    if (me.branch !== 'main') return fail(T.mainOnly);
    const into = 'main';
    from = String(from ?? '');
    if (from === into || !tipOf(await git.graph(lab.id), from)) return fail('Pick another branch to merge.');
    const m = moment(lab, 'merge', from);
    const stop = takeGuess(m, me, guess) || blocked(lab, into) || needGuess(m, me);
    if (stop) return stop;
    const r = await git.merge(lab, into, from, authorOf(me));
    settleMoment(m, mergeOutcome(r), me);
    if (r.nothing) return reply(lab, me, r, null, { message: `${into} already has ${from}. Nothing to merge.` });
    const message = r.fastForward ? `${into} slid forward to ${short(r.id)}. No new card.`
      : r.merged ? `Merged. New card ${short(r.id)} has two parents.`
        : r.conflict ? `${partsOf(r.conflicts)} changed on both sides. Pick one, then press Finish merge.` : null;
    return reply(lab, me, r, mergeEntry(r, from, into), { message });
  },

  async resolve(me, lab, { monster }) {
    const note = me.branch;
    const open = lab.merging[note];
    if (!open) return closed();
    // Any palette part, or a value one side already has (the disguise is never in the palette).
    const choice = {};
    for (const part of PARTS) {
      const value = monster?.[part];
      const sides = [open.auto[part], open.ours[part], open.theirsMonster[part]];
      if (!allowed(part, value) && !sides.includes(value)) return fail(T.badPart);
      choice[part] = value;
    }
    const r = await git.resolve(lab, note, choice, authorOf(me));
    if (r.refused && !lab.merging[note]) return closed();
    if (open.kind === 'rebase') {
      // The replay goes on; another card may need a person too.
      const message = r.conflict ? `${partsOf(r.conflicts)} changed on both sides. Pick one, then press Finish merge.` : `${replayed(r)} Now press Send to Wall.`;
      const outcome = r.conflict ? `conflict: ${partsOf(r.conflicts)}` : `main → ${short(r.id)}`;
      return reply(lab, me, r, { action: 'Finish merge', outcome, concepts: ['conflict', ...(r.rebased ? ['rebase'] : [])] }, { message });
    }
    const what = open.kind === 'revert' ? 'revert' : 'merge';
    const message = what === 'merge' ? `Saved merge card ${short(r.id)}. It has two parents.` : `Saved fix card ${short(r.id)}.${sendNext(note)}`;
    return reply(lab, me, r, { action: 'Finish merge', outcome: `${what} card ${short(r.id)}`, concepts: ['conflict', what] }, { message });
  },

  async abort(me, lab) {
    const note = me.branch;
    if (!lab.merging[note]) return closed();
    const r = await git.abort(lab, note);
    if (r.nothing) return closed();
    const message = `${{ merge: 'Merge', revert: 'Undo', rebase: 'Replay' }[r.kind]} cancelled. ${note} is unchanged.`;
    return reply(lab, me, r, { action: 'Cancel merge', outcome: `${note} unchanged` }, { message });
  },

  // Steps 4–5: predict first (guess: will the Wall accept it?).
  async push(me, lab, { guess }) {
    if (me.branch !== 'main') return fail(T.mainOnly);
    if (S.step === 6 && !isBoss(lab)) return fail(T.boss, { tone: 'info' }); // nothing to do but watch: no sticky red toast
    const m = moment(lab, 'push');
    const stop = takeGuess(m, me, guess) || needGuess(m, me);
    if (stop) return stop;
    const unsaved = Object.keys(lab.drafts.main ?? {}).length > 0;
    const r = await git.push(lab, { force: false });
    settleMoment(m, pushOutcome(r), me);
    if (r.rejected) {
      lab.refusedInARow += 1;
      const entry = { action: 'Send to Wall', outcome: `refused (${r.reason})`, bad: true, concepts: ['rejected'] };
      const error = (await movedOffSabotage(lab)) ? T.refusedMovedBack : refusal(lab);
      return { ...reply(lab, me, r, entry), ok: false, error };
    }
    lab.refusedInARow = 0;
    if (r.already) return reply(lab, me, r, null, { message: 'The Wall already has this card.' });
    const sent = `Sent! The Wall moved to ${short(r.id)}.`;
    return reply(lab, me, r, { action: 'Send to Wall', outcome: `sent ${short(r.id)}`, concepts: ['push'] },
      { message: unsaved ? `${sent} Sent your last saved card. Unsaved parts weren't sent.` : sent, wall: true });
  },

  async pull(me, lab) {
    if (me.branch !== 'main') return fail(T.mainOnly);
    if (S.step === 6 && !isBoss(lab)) return fail(T.boss, { tone: 'info' });
    const stop = blocked(lab, 'main');
    if (stop) return stop;
    const movedOff = await movedOffSabotage(lab);
    const r = await git.pull(lab, authorOf(me));
    if (!r.moved) lab.refusedInARow = 0;
    if (r.merged || r.conflict) chooseWay(lab, 'merge', me);
    if (r.nothing) {
      return reply(lab, me, r, { action: 'Get & combine', outcome: 'nothing new', concepts: ['pull'] }, { message: 'Nothing new on the Wall.' });
    }
    // Moved back off the Intern's card: Get & combine brings it back (with any fix card the Wall has on top).
    const back = !movedOff || (await movedOffSabotage(lab)) ? ''
      : (await noteMonster(lab, 'main'))?.[SABOTAGE.part] === SABOTAGE.value ? ` The ${DISGUISE} card is back: the Wall still had it.`
        : ` The ${DISGUISE} card is back in main's history: the Wall still had it, with a fix card on top.`;
    const message = r.fastForward ? `Got the Wall's cards. main slid forward to ${short(r.id)}.${back}`
      : r.merged ? `Got the Wall's cards and combined them.${back} Now press Send to Wall.`
        : r.conflict ? `${partsOf(r.conflicts)} changed on both sides. Pick one, then press Finish merge.` : null;
    return reply(lab, me, r, pullEntry(r), { message });
  },

  // Replay on top: git pull --rebase. main's own cards are copied onto the Wall's newest card.
  async rebase(me, lab) {
    if (me.branch !== 'main') return fail(T.mainOnly);
    if (S.step === 6 && !isBoss(lab)) return fail(T.boss, { tone: 'info' });
    const stop = blocked(lab, 'main');
    if (stop) return stop;
    const r = await git.rebase(lab, authorOf(me));
    if (!r.moved) lab.refusedInARow = 0;
    if (r.rebased || r.conflict) chooseWay(lab, 'rebase', me);
    if (r.nothing) {
      return reply(lab, me, r, { action: 'Replay on top', outcome: 'nothing new', concepts: ['rebase'] }, { message: 'Nothing new on the Wall.' });
    }
    const message = r.fastForward ? `Got the Wall's cards. main slid forward to ${short(r.id)}.`
      : r.conflict ? `${partsOf(r.conflicts)} changed on both sides. Pick one, then press Finish merge.`
        : `${replayed(r)} Now press Send to Wall.`;
    return reply(lab, me, r, rebaseEntry(r), { message });
  },

  // Delete a branch, as git branch -d: only once the branch you're on has its cards. Anyone else on it
  // goes back to main (here each person has a pin; real Git refuses a branch checked out elsewhere).
  async deleteNote(me, lab, { note }) {
    const name = String(note ?? '');
    if (name === 'main') return fail('main stays. Pick another branch.');
    if (!tipOf(await git.graph(lab.id), name)) return fail('That branch does not exist.');
    if (name === me.branch) return fail(`You're on ${name}. Switch to main first.`);
    if (lab.merging[name]) return fail(T.merging);
    if (Object.keys(lab.drafts[name] ?? {}).length) return fail(`${name} has unsaved parts. Save them on ${name} first.`);
    const r = await git.deleteBranch(lab, name, me.branch);
    if (r.unmerged) return fail(`Refused: ${name} has cards ${me.branch} doesn't have. Deleting it could lose them. Merge it first.`);
    for (const p of peopleIn(lab.id)) if (p.branch === name) p.branch = 'main';
    delete lab.drafts[name];
    delete lab.draftBy[name];
    return reply(lab, me, r, { action: `Delete branch ${name}`, outcome: `was ${short(r.id)}` },
      { message: `Deleted the ${name} branch. Its cards stay.` });
  },

  // git.js refuses the Start card and cards outside the branch's history, in the client's words.
  async revert(me, lab, { commit }) {
    const note = me.branch;
    const stop = blocked(lab, note);
    if (stop) return stop;
    const r = await git.revert(lab, note, String(commit ?? ''), authorOf(me));
    const action = `Undo card ${short(commit)}`;
    if (!r.refused && !r.moved && index(await git.graph(lab.id)).get(String(commit))?.author === INTERN.name) chooseUndo(lab, 'revert', me);
    // Logged, so a lab whose fix came from another lab (Get & combine) still counts its own undo (Step 5's goal).
    if (r.nothing) return reply(lab, me, r, { action, outcome: 'already undone' }, { message: 'Already undone. Nothing to change.' });
    if (r.conflict) {
      return reply(lab, me, r, { action, outcome: `conflict: ${partsOf(r.conflicts)}`, bad: true },
        { message: `${partsOf(r.conflicts)} changed again since. Pick one, then press Finish merge.` });
    }
    return reply(lab, me, r, { action, outcome: `fix card ${short(r.id)}`, concepts: ['revert'] },
      { message: `Added fix card ${short(r.id)}.${sendNext(note)}` });
  },

  // Any card in the lab, diary-only ones included: that's how you recover.
  async reset(me, lab, { commit }) {
    const note = me.branch;
    const stop = blocked(lab, note);
    if (stop) return stop;
    const r = await git.reset(lab, note, String(commit ?? ''), authorOf(me));
    if (!r.refused && !r.moved && note === 'main') chooseUndo(lab, 'reset', me);
    return reply(lab, me, r, { action: 'Move my branch back here', outcome: `${note} → ${short(commit)}`, concepts: ['reset'] },
      { message: `${note} moved back to ${short(commit)}.${sendNext(note)}` });
  },

  async reflog(me, lab) {
    const r = await git.reflog(lab, me.branch);
    count(lab, me.pid, 'diary');
    bump(lab.id);
    const { commands, porcelain, explain, ...result } = r;
    return { ok: true, result, op: opOf(r) };
  },

  async inspect(me, lab, { commit, repo }) {
    const where = repo === 'wall' ? 'wall' : 'lab';
    if (where === 'wall' && S.step < UNLOCK.wall) return fail(`Not yet — this unlocks in Step ${UNLOCK.wall}.`);
    const r = await git.inspect(where === 'wall' ? 'wall' : lab.id, String(commit ?? ''));
    if (r.refused) return fail(r.refused);
    count(lab, me.pid, 'inspect');
    save();
    const { commands, porcelain, explain, ...result } = r;
    return { ok: true, result, op: opOf(r) };
  },

  async squash(me, lab) {
    if (!isBoss(lab)) return fail('Only the boss lab can do this.');
    if (me.branch !== 'main') return fail(T.mainOnly);
    const stop = blocked(lab, 'main');
    if (stop) return stop;
    const r = await git.squashForcePush(lab, authorOf(me));
    if (r.already) return reply(lab, me, r, null, { message: 'The Wall already has one clean card.' });
    return reply(lab, me, r, { action: 'Replace the Wall with one card', outcome: `forced ${short(r.id)}`, bad: true, concepts: ['force'] },
      { message: `The Wall now has one clean card: ${short(r.id)}.`, wall: true });
  },

  // Predict the lab's next merge (Step 3) or send (Steps 4–5) before anyone presses. Changeable until Git answers.
  async predict(me, lab, { moment: id, guess }) {
    const m = openMoments(lab).find((x) => x.id === String(id ?? ''));
    if (!m) return fail('Git already answered this one.', { tone: 'info' });
    if (!validGuess(m.kind, String(guess ?? ''))) return fail('Pick one of the answers.');
    m.guesses[me.pid] = { guess: String(guess), t: now(), pressed: m.guesses[me.pid]?.pressed ?? false };
    bump(lab.id);
    return done(PREDICT.waiting, { guess: String(guess) });
  },

  // Step 4: one line on why the lab chose its way (optional, editable by anyone in the lab).
  async why(me, lab, { text }) {
    const w = S.ways[lab.id];
    if (S.step !== 4 || !w) return fail('Your lab has not chosen a way yet.');
    w.why = tidy(text, WHY_MAX);
    bump(lab.id);
    return done(w.why ? 'Saved.' : 'Removed.', { text: w.why });
  },

  // The pause question, answered in the app (optional, editable). Empty text removes the answer.
  async answer(me, lab, { scene, text }) {
    const s = openQuestion(scene);
    if (!s) return fail('That question is not open yet.');
    const clean = tidy(text, ANSWER_MAX);
    const given = (S.answers[s.id] ??= {});
    if (clean) given[me.pid] = { text: clean, t: now() };
    else delete given[me.pid];
    bump(lab.id);
    return done(clean ? 'Answer saved.' : 'Answer removed.', { text: clean });
  },

  // One line per step, opened at its reveal (optional, editable). Empty text removes it.
  async takeaway(me, lab, { step, text }) {
    const n = SCENES.findIndex((s) => s.takeawayStep === Number(step));
    if (n < 0 || n > S.scene) return fail('Takeaways open at each "How Git does it".');
    const clean = tidy(text, TAKEAWAY_MAX);
    const mine = (S.takeaways[me.pid] ??= {});
    if (clean) mine[SCENES[n].takeawayStep] = { text: clean, t: now() };
    else delete mine[SCENES[n].takeawayStep];
    bump(lab.id);
    return done(clean ? 'Takeaway saved.' : 'Takeaway removed.', { text: clean });
  },
};

// ---------- Step side effects ----------

// Step 4: the chosen lab's main goes to the Wall, then every lab is cloned again from it.
async function meetTheWall(labId) {
  const lab = S.labs[labId];
  const sent = await git.push(lab, { force: true });
  log(lab, TEACHER, { action: `Send ${lab.name}'s main to the Wall`, outcome: `the Wall is at ${short(sent.id)}` }, sent);
  for (const l of Object.values(S.labs)) {
    const r = await clone(l.id);
    Object.assign(l, { drafts: { main: {} }, draftBy: {}, merging: {}, refusedInARow: 0 });
    log(l, TEACHER, { action: 'Copy the Wall', outcome: `${l.name}'s cards = the Wall's` }, r);
  }
  for (const p of Object.values(S.people)) p.branch = 'main';
}

// Entering Step 5: every lab whose main is behind the Wall gets the Intern's card, a fast-forward (no new card).
// A lab with unsaved parts or an open merge on main gets it later with Get & combine.
async function handOut() {
  const wall = await git.graph('wall');
  for (const lab of realLabs()) {
    if (blocked(lab, 'main') || labView(lab, await git.graph(lab.id), wall).wall() !== 'behind') continue;
    const r = must(await git.pull(lab, TEACHER));
    log(lab, TEACHER, { ...pullEntry(r), concepts: [] }, r);
  }
  S.handedOut = true;
}

async function sabotage() {
  const r = await git.wallSabotage(SABOTAGE);
  if (r.moved) throw Object.assign(new Error('The Wall moved during the sabotage.'), { busy: true });
  S.sabotaged = true;
  if (r.nothing) return `The ${DISGUISE} card is already on the Wall.`;
  log(null, INTERN, { action: 'Tiny style fix', outcome: `${DISGUISE} card ${short(r.id)} on the Wall`, bad: true }, r);
  return `The Intern put card ${short(r.id)} on the Wall.`;
}

// The first real lab whose Step 3 goals all tick: Step 4's default lab.
async function firstReadyLab() {
  for (const lab of realLabs()) {
    const goals = STEPS[3].goals(labView(lab, await git.graph(lab.id), null));
    if (goals.every((g) => g.done)) return lab.id;
  }
  return realLabs()[0].id;
}

// Step 4 with the practice lab: it saves its change and sends first, so the real lab meets the refusal.
async function practiceTurn() {
  const lab = practiceLab();
  if (!lab || S.practiced) return;
  await RESCUE[4](lab, PRACTICE);
  S.practiced = true;
}

// labId is the admin's pick for the step being entered (4: whose main goes to the Wall; 6: the boss).
// One-time side effects run when their step is first entered; Back never undoes them.
// Leaving Step 4 keeps its integration paths for the paper, before anything else changes the Wall.
// The teacher may press Sabotage early (on Step 4's reveal); entering Step 5 runs it only if nobody did,
// then hands the card to every lab.
async function goToStep(step, labId) {
  const picked = labById(labId) && !labById(labId).practice ? String(labId) : null;
  for (const lab of Object.values(S.labs)) lab.lastOp = null; // Behind the door shows only this step's actions
  if (step >= 4 && !S.wallMet) {
    S.stepLab[4] = (step === 4 && picked) || await firstReadyLab();
    await meetTheWall(S.stepLab[4]);
    S.wallMet = true;
  }
  if (step >= 4) await practiceTurn();
  if (step >= 5) S.integration ??= await integrationNow();
  if (step >= 5 && !S.sabotaged) await sabotage();
  if (step === 5 && !S.handedOut) await handOut();
  if (step === 6) S.stepLab[6] = picked ?? bossLab();
  if (step >= 1) S.labsLocked = true;
  // main is read-only in Steps 2–3, so leftover unsaved parts there could never be saved.
  if (step === 2 || step === 3) for (const lab of Object.values(S.labs)) lab.drafts.main = {};
  for (const lab of Object.values(S.labs)) Object.assign(lab, { lastClickAt: now(), refusedInARow: 0 }); // status lines count from here
  Object.assign(S, { step, stepStartedAt: now() });
}

async function wallIsClean() {
  const wall = await git.graph('wall');
  return history(index(wall), tipOf(wall, 'main')).size === 2;
}

// "Wall: Priya (Lab 2), 3fa9c1e": one row for the Wall, then one per lab.
function auditRows(r) {
  const row = (where, found) => {
    if (!found) return { where, found: false, text: `${where}: not found` };
    if (found.clean) return { where, found: false, text: `${where}: only the clean card has it. The real author is gone.` };
    const from = person(found.pid)?.labId;
    return { where, found: true, text: `${where}: ${found.author}${from ? ` (${labName(from)})` : ''}, ${short(found.id)}` };
  };
  return [row('Wall', r.wall), ...Object.keys(S.labs).map((id) => row(labName(id), r.labs[id]))];
}

// Who first added the boots? Kept as "before" or "after", by whether the Wall was replaced.
async function audit() {
  const after = await wallIsClean();
  const result = { t: now(), part: AUDIT.part, value: AUDIT.value, rows: auditRows(await git.audit(AUDIT.part, AUDIT.value)) };
  S.audits[after ? 'after' : 'before'] = result;
  return result;
}

// Move the class to scene n. Step 6's scenes run the audit themselves, so the teacher only presses Next:
// entering Step 6 asks the Wall before the clean-up; its reveal finishes the boss lab's clean-up if
// needed, then asks again.
async function goToScene(n, labId) {
  const scene = SCENES[n];
  if (scene.step !== S.step) await goToStep(scene.step, labId);
  if (scene.id === 'task-6' && !(await wallIsClean())) await audit();
  if (scene.id === 'reveal-6') {
    if (!(await wallIsClean())) await RESCUE[6](S.labs[S.stepLab[6]]);
    await audit();
  }
  Object.assign(S, { scene: n, sceneStartedAt: now(), ask: false, show: { answers: false, names: false }, pathsTier: 0 });
}

// ---------- Rescue: finish the current step for one lab, doing only what's missing ----------
// The practice lab plays its Step 4 turn with the same moves, as itself.

// Rescue runs several ops in a row. If a student moved a note meanwhile, stop: the teacher presses again.
function must(r) {
  if (r.moved || r.refused || r.merging) throw Object.assign(new Error('A note moved during the rescue.'), { busy: true });
  return r;
}

const ours = (part, open) => open.ours[part];
const theirs = (part, open) => open.theirsMonster[part];

// Finish the open merge, choosing each conflicted part with pick(part, open). A replay may stop again.
async function settle(lab, note, pick, who) {
  while (lab.merging[note]) {
    const open = lab.merging[note];
    const monster = { ...open.auto };
    for (const part of open.conflicts) monster[part] = pick(part, open);
    const r = must(await git.resolve(lab, note, monster, who));
    log(lab, who, { action: 'Finish merge', outcome: r.conflict ? `conflict: ${partsOf(r.conflicts)}` : `card ${short(r.id)}` }, r);
  }
}

// Cancel open merges and drop unsaved parts on the branches rescue touches.
async function clearNotes(lab, notes) {
  for (const note of notes) {
    if (lab.merging[note]) must(await git.abort(lab, note));
    lab.drafts[note] = {};
  }
}

async function saveParts(lab, note, parts, who) {
  lab.drafts[note] = parts;
  const r = must(await git.commit(lab, note, who));
  if (!r.nothing) log(lab, who, { action: 'Save card', outcome: `card ${short(r.id)}` }, r);
}

async function mergeIn(lab, from, pick, who) {
  const m = moment(lab, 'merge', from);
  const r = must(await git.merge(lab, 'main', from, who));
  settleMoment(m, mergeOutcome(r), who); // anyone who predicted this merge still gets Git's answer
  if (r.nothing) return;
  log(lab, who, { ...mergeEntry(r, from, 'main'), concepts: [] }, r);
  await settle(lab, 'main', pick, who);
}

async function deleteIn(lab, note, who) {
  if (!tipOf(await git.graph(lab.id), note)) return;
  for (const p of peopleIn(lab.id)) if (p.branch === note) p.branch = 'main';
  const r = must(await git.deleteBranch(lab, note, 'main'));
  if (r.unmerged) throw Object.assign(new Error(`${note} moved during the rescue.`), { busy: true });
  delete lab.drafts[note];
  delete lab.draftBy[note];
  log(lab, who, { action: `Delete branch ${note}`, outcome: `was ${short(r.id)}` }, r);
}

// Get the Wall's cards the lab's way: Replay on top for a Step 4 lab that chose it, else Get & combine
// (a Step 4 lab that had not chosen yet is then logged as combining).
async function getIn(lab, pick, who) {
  const replay = S.step === 4 && wayOf(lab) === 'rebase';
  const r = must(await (replay ? git.rebase(lab, who) : git.pull(lab, who)));
  if (r.merged || r.rebased || r.conflict) chooseWay(lab, replay ? 'rebase' : 'merge', who);
  if (r.nothing) return;
  log(lab, who, { ...(replay ? rebaseEntry(r) : pullEntry(r)), concepts: [] }, r);
  await settle(lab, 'main', pick, who);
}

// Send; if refused, get the Wall's cards once and send again.
async function send(lab, pick, who) {
  const pushed = async () => {
    const m = moment(lab, 'push');
    const out = await git.push(lab, { force: false });
    settleMoment(m, pushOutcome(out), who);
    return out;
  };
  let r = await pushed();
  if (r.rejected) {
    log(lab, who, { action: 'Send to Wall', outcome: `refused (${r.reason})`, bad: true }, r);
    await getIn(lab, pick, who);
    r = await pushed();
  }
  if (r.rejected || r.already) return;
  lab.refusedInARow = 0;
  log(lab, who, { action: 'Send to Wall', outcome: `sent ${short(r.id)}` }, r);
}

// Build each pair's branch with its mission, unless main already has that idea.
async function rescueBranches(lab, who) {
  const graph = await git.graph(lab.id);
  const view = labView(lab, graph, null);
  const notes = Object.values(PAIR_NOTES).filter((note) => !view.mainHasIdea(note));
  await clearNotes(lab, notes.filter((n) => tipOf(graph, n)));
  for (const note of notes) {
    if (!tipOf(graph, note)) {
      const r = must(await git.createBranch(lab, note));
      lab.drafts[note] = {};
      log(lab, who, { action: `New branch ${note}`, outcome: 'from main' }, r);
    }
    const card = await noteMonster(lab, note);
    const missing = Object.fromEntries(Object.entries(PAIR_PARTS[note]).filter(([p, val]) => card[p] !== val));
    if (Object.keys(missing).length) await saveParts(lab, note, missing, who);
  }
}

// Each plan returns a refusal message, or nothing when it ran.
const RESCUE = {
  2: rescueBranches,
  async 3(lab, who = TEACHER) {
    await rescueBranches(lab, who);
    await clearNotes(lab, ['main']);
    // Merge fancy (a fast-forward), delete its branch, merge sporty. A conflicted part takes fancy's value.
    const fancy = (part, open) => PAIR_PARTS.fancy[part] ?? open.ours[part];
    for (const note of Object.values(PAIR_NOTES)) {
      if (tipOf(await git.graph(lab.id), note)) await mergeIn(lab, note, fancy, who);
      if (note === PAIR_NOTES.A) await deleteIn(lab, note, who);
    }
  },
  async 4(lab, who = TEACHER) {
    const c = LAB_CHANGES[lab.id];
    const mine = (part, open) => (part === c.part ? c.value : open.ours[part]);
    await clearNotes(lab, ['main']);
    await getIn(lab, mine, who);
    if ((await noteMonster(lab, 'main'))[c.part] !== c.value) await saveParts(lab, 'main', { [c.part]: c.value }, who);
    await send(lab, mine, who);
  },
  async 5(lab, who = TEACHER) {
    await clearNotes(lab, ['main']);
    await getIn(lab, theirs, who);
    const graph = await git.graph(lab.id);
    const byId = index(graph);
    const main = tipOf(graph, 'main');
    const intern = [...history(byId, main)].find((id) => byId.get(id).author === INTERN.name);
    if (intern && (byId.get(main).monster[SABOTAGE.part] === SABOTAGE.value || !labView(lab, graph, null).undidSabotage())) {
      const r = must(await git.revert(lab, 'main', intern, who));
      chooseUndo(lab, 'revert', who);
      const outcome = r.nothing ? 'already undone' : r.conflict ? 'conflict' : `fix card ${short(r.id)}`;
      log(lab, who, { action: `Undo card ${short(intern)}`, outcome }, r);
      await settle(lab, 'main', theirs, who);
    }
    await send(lab, theirs, who);
  },
  async 6(lab, who = TEACHER) {
    if (!isBoss(lab)) return 'Only the boss lab replaces the Wall.';
    await clearNotes(lab, ['main']);
    await getIn(lab, ours, who);
    const r = must(await git.squashForcePush(lab, who));
    log(lab, who, { action: 'Replace the Wall with one card', outcome: `forced ${short(r.id)}`, bad: true }, r);
  },
};

async function rescue(lab) {
  if (lab.practice) return fail('The practice lab is played by the app.');
  const plan = RESCUE[S.step];
  if (!plan) return fail('Nothing to rescue in this step.');
  const graph = await git.graph(lab.id);
  const wallGraph = S.step >= 4 ? await git.graph('wall') : null;
  if (progress(lab, graph, wallGraph).done) return done(`${lab.name} is already done.`);
  const refusal = await plan(lab, TEACHER);
  if (refusal) return fail(refusal);
  return done(`Rescued ${lab.name}.`);
}

// ---------- Admin actions ----------

// count: 1–6, or 'auto' (follow the headcount). Only before Step 1.
async function setLabCount(count) {
  if (S.labsLocked) return fail('Labs lock at Step 1.');
  const auto = count === 'auto';
  const n = auto ? labsFor(Object.keys(S.people).length) : Number(count);
  if (!Number.isInteger(n) || n < 1 || n > 6) return fail('Pick 1 to 6 labs.');
  S.autoLabs = auto;
  await setLabs(n);
  const labs = n === 1 ? '1 lab, plus the practice lab' : `${n} labs`;
  // A count the teacher forces may make a lab too big to keep everyone busy, or a lab of 1 with no partner.
  const sizes = realLabs().map((l) => peopleIn(l.id).length);
  const warning = Math.max(...sizes) > BIG_LAB ? ` Warning: ${Math.max(...sizes)} people in one lab leaves hands idle. About 4 per lab works best.`
    : n > 1 && Math.min(...sizes) === 1 ? ' Warning: a lab of 1 has no partner. About 4 per lab works best.' : '';
  return done(auto ? `${labs}, from the headcount.` : `${labs}.${warning}`);
}

// from: the scene the teacher's page showed. A second press before the page caught up (a clicker's
// double tap, a second tab) changes nothing, so Next never skips a scene by accident.
const stale = (from) => from != null && from !== '' && Number(from) !== S.scene;

const ADMIN = {
  async next({ from, labId }) {
    if (stale(from)) return { ok: true, result: { scene: S.scene, unchanged: true } };
    if (S.scene === SCENES.length - 1) return fail('This is the last scene.');
    await goToScene(S.scene + 1, labId);
    return { ok: true, result: { scene: S.scene } };
  },
  async back({ from }) {
    if (stale(from)) return { ok: true, result: { scene: S.scene, unchanged: true } };
    if (S.scene === 0) return fail('This is the first scene.');
    await goToScene(S.scene - 1);
    return { ok: true, result: { scene: S.scene } };
  },
  labs: ({ count }) => setLabCount(count),
  move({ pid, labId }) {
    const p = person(pid);
    const lab = labById(labId);
    if (!p || !lab || lab.practice) return fail('Pick a person and a lab.');
    if (p.labId !== lab.id) Object.assign(p, { labId: lab.id, pair: freePair(lab.id), branch: 'main' });
    return done(`${p.name} moved to ${lab.name}.`);
  },
  async rescue({ labId }) {
    const lab = labById(labId);
    return lab ? rescue(lab) : fail('Pick a lab.');
  },
  ask({ on }) {
    if (on && !SCENES[S.scene].ask) return fail('This scene has no question.');
    S.ask = !!on;
    return { ok: true, result: { ask: S.ask } };
  },
  // Answers on the projector; names stay hidden unless names is on.
  answers({ on, names }) {
    if (on && !SCENES[S.scene].answerable) return fail('This scene has no answers.');
    S.show = { answers: !!on, names: !!on && !!names };
    return { ok: true, result: { show: S.show } };
  },
  // "Find the path back": the projector's tier, one step back or on.
  tier({ dir }) {
    if (SCENES[S.scene].kind !== 'paths') return fail('This scene has no tiers.');
    const last = PATHS.tiers.length - 1;
    S.pathsTier = Math.max(0, Math.min(last, (S.pathsTier ?? 0) + (dir === 'back' ? -1 : 1)));
    return done(`Tier ${PATHS.tiers[S.pathsTier].n}: ${PATHS.tiers[S.pathsTier].name}.`, { tier: S.pathsTier });
  },
  // Restart the scene's timer (the break's countdown, too). During Step 0 it also sets the class clock.
  timer() {
    S.sceneStartedAt = now();
    if (S.step === 0) S.planStartedAt = now() - SCENES[S.scene].at * 60e3;
    return { ok: true, result: {} };
  },
  async sabotage() {
    if (S.step < UNLOCK.wall) return fail(`The Wall opens in Step ${UNLOCK.wall}.`);
    return done(await sabotage());
  },
  async audit() {
    if (S.step < UNLOCK.wall) return fail(`The Wall opens in Step ${UNLOCK.wall}.`);
    const result = await audit();
    return done(result.rows.map((r) => r.text).join(' · '), { audit: result });
  },
  async gc() {
    const r = await git.gcWall();
    const message = `The Wall's bin had ${r.before} old card${r.before === 1 ? '' : 's'}. Now ${r.after}.`;
    S.bin = { before: r.before, after: r.after };
    log(null, TEACHER, { action: "Empty the Wall's bin", outcome: message }, r);
    return { ok: true, result: { message }, op: opOf(r) };
  },
  async reset() {
    await fresh(S.autoLabs ? null : realLabs().length);
    return done('New session. Everyone joins again.');
  },
};

// These change the scene or the shape of the session, so they run alone.
const ALONE = new Set(['next', 'back', 'labs', 'reset']);

export const admin = (action, input) => (ALONE.has(action) ? alone : work)(async () => {
  try {
    const out = await ADMIN[action](input);
    bump();
    return out;
  } catch (err) {
    return gitError(err);
  }
});
