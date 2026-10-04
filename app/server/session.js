// Session state: people, labs, drafts, the step, concepts, feed and admin actions.
// Ref tips are never stored here; they are always read from Git (server/git.js).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as git from './git.js';
import { palette, PALETTE, PARTS, START } from '../public/monster.js';
import { STEPS, UNLOCK, CONCEPTS, FIXED_LINE, PAIR_NOTES, PAIR_PARTS, LAB_CHANGES, missionFor } from './steps.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const SESSION_FILE = path.join(DATA_DIR, 'session.json');
const KEY_FILE = path.join(DATA_DIR, 'admin.key');
const LAB_COLORS = ['#8B3DFF', '#0EA5E9', '#F97316', '#16A34A', '#E11D48', '#CA8A04'];
const TEACHER = { pid: 'teacher', name: 'Teacher' };
const INTERN = { pid: 'intern', name: 'The Intern' };
const FEED_MAX = 300;
const SAVE_DELAY_MS = 250;
const BREAK_MS = 4 * 60e3; // the lesson's break, after Step 3

const T = {
  unsaved: "Save your changes first. Git won't overwrite unsaved work.",
  merging: 'Finish or cancel the merge first.',
  mainLocked: 'main is the approved monster. Make or switch to a sticky note first.',
  mainOnly: 'Switch to main first.',
  boss: 'The boss is cleaning the Wall. Watch.',
  moved: 'Someone in your lab changed this note meanwhile. Press again.',
  busy: 'Busy, press again.',
  refused: "Refused: the Wall has cards you don't have. Press Get & combine first.",
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
// Lookups by client-sent keys: own properties only (so "__proto__" finds nothing).
const own = (obj, k) => (Object.hasOwn(obj, String(k ?? '')) ? obj[String(k)] : undefined);
const person = (pid) => own(S.people, pid);
const labById = (id) => own(S.labs, id);
const labName = (id) => labById(id)?.name ?? `Lab ${id}`;
const authorOf = (me) => ({ pid: me.pid, name: me.name });
const mainLocked = (note) => note === 'main' && (S.step === 2 || S.step === 3);
const isBoss = (lab) => S.step === 7 && S.stepLab[7] === lab.id;
const allowed = (part, value) => PARTS.includes(part) && palette(S.step)[part].includes(value);
const clone = (id) => git.cloneLab(id, { replace: true });

export const adminKey = () => key;
export const version = () => ({ v, boot: S.boot });
export const labOf = (pid) => person(pid)?.labId;
export const onChange = (fn) => listeners.push(fn);

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
// Step changes, lab-count changes and Reset run alone: new requests wait at the gate,
// requests already running finish first. Everything else runs through work().

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
    chaos: { ...START },
    drafts: { main: {} },
    merging: {},
    concepts: {},
    by: {}, // pid → concept counts
    lastOp: null,
    lastClickAt: null,
    refusedInARow: 0,
  };
}

async function fresh(labCount) {
  fs.rmSync(path.join(DATA_DIR, 'labs'), { recursive: true, force: true });
  fs.rmSync(path.join(DATA_DIR, 'wall.git'), { recursive: true, force: true });
  await git.initWall();
  const labs = {};
  for (let n = 1; n <= labCount; n++) {
    labs[n] = newLab(String(n));
    await clone(String(n));
  }
  S = {
    boot: crypto.randomBytes(4).toString('hex'),
    step: 0,
    stepStartedAt: now(),
    planStartedAt: null, // the class clock: first join, or the timer restart on Step 0
    ask: false,
    breakUntil: null, // the break's end time while it runs
    stepLab: {}, // 4: whose main went to the Wall · 7: the boss lab
    wallMet: false, // Step 4's one-time send + clone ran
    sabotaged: false, // the Intern's card went to the Wall (admin button or entering Step 6)
    replacedAt: null, // when the boss lab last replaced the Wall (audits read as before / after it)
    labs,
    people: {},
    feed: [],
    audits: [],
  };
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
  if (saved && fs.existsSync(path.join(DATA_DIR, 'wall.git'))) {
    S = saved;
    for (const id of Object.keys(S.labs)) {
      if (!fs.existsSync(path.join(DATA_DIR, 'labs', id))) await clone(id);
    }
    await agreeWithGit();
  } else {
    await fresh(Math.min(6, Math.max(2, Number(process.env.LABS) || 3)));
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

// What steps.js goals read about a lab.
function labView(lab, graph, wallGraph) {
  const byId = index(graph);
  const wallById = wallGraph ? index(wallGraph) : new Map();
  const wallTip = wallGraph && tipOf(wallGraph, 'main');
  const mainHistory = history(byId, tipOf(graph, 'main'));
  const wallHistory = history(wallById, wallTip);
  return {
    labId: lab.id,
    savers() {
      const here = membersOf(lab).filter((m) => m.online);
      return { saved: here.filter((m) => lab.by[m.pid]?.save).length, online: here.length };
    },
    noteHas(note, parts) {
      const card = byId.get(tipOf(graph, note));
      return !!card && Object.entries(parts).every(([p, val]) => card.monster[p] === val);
    },
    mainHas: (note) => mainHistory.has(tipOf(graph, note)),
    mainHasMergeCard: () => [...mainHistory].some((id) => byId.get(id).parents.length > 1),
    wallHasPart: (part, value) => [...wallHistory].some((id) => wallById.get(id).monster[part] === value),
    matchesWall: () => !!wallTip && tipOf(graph, 'main') === wallTip,
    wallMonster: () => wallById.get(wallTip)?.monster,
    gotSabotage: () => graph.commits.some((c) => c.author === INTERN.name),
    wallIsClean: () => wallHistory.size === 2,
  };
}

const goalsFor = (lab, graph, wallGraph) => STEPS[S.step].goals(labView(lab, graph, wallGraph));

// Students see the blue wall/main note from Step 4 and diary-only cards from Step 6.
function shownGraph(graph) {
  const refs = Object.fromEntries(Object.entries(graph.refs)
    .filter(([name]) => S.step >= 4 || !name.startsWith('refs/remotes/')));
  const commits = S.step >= 6 ? graph.commits : graph.commits.filter((c) => c.reachable);
  return { ...graph, refs, commits };
}

async function noteCard(lab, note) {
  const graph = await git.graph(lab.id);
  return index(graph).get(tipOf(graph, note)) ?? null;
}

const noteMonster = async (lab, note) => (await noteCard(lab, note))?.monster ?? null;

function membersOf(lab) {
  return Object.values(S.people)
    .filter((p) => p.labId === lab.id)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map(({ pid, name, pair, branch }) => ({ pid, name, pair, branch, online: online.has(pid) }));
}

function branchesOf(graph) {
  return Object.fromEntries(Object.entries(graph.refs)
    .filter(([name]) => name.startsWith('refs/heads/'))
    .map(([name, id]) => [name.slice('refs/heads/'.length), id]));
}

// The lab's monster for the admin and projector: the chaos monster, then main + its draft.
function labMonster(lab, graph) {
  if (S.step === 0) return lab.chaos;
  return { ...index(graph).get(tipOf(graph, 'main'))?.monster, ...lab.drafts.main };
}

// ---------- State for clients ----------

// One step's copy for students. Step 7's instruction depends on the lab (boss or not).
function stepFor(n, lab) {
  const s = STEPS[n];
  const boss = n === 7 && lab && S.stepLab[7] === lab.id;
  return {
    n,
    id: s.id,
    title: s.title,
    fixedLine: n >= 3 && n <= 7 ? FIXED_LINE : null,
    instruction: boss ? s.bossInstruction : s.instruction.replace('{wallLab}', labName(S.stepLab[4] ?? '1')),
    unlocks: s.unlocks,
    bonus: s.bonus ?? null,
    check: s.check,
    behind: s.behind,
    minutes: s.minutes,
    at: s.at,
  };
}

function publicSession(lab) {
  return {
    boot: S.boot,
    step: S.step,
    steps: STEPS.map((_, n) => stepFor(n, lab)),
    labs: Object.values(S.labs).map((l) => ({ id: l.id, name: l.name, color: l.color, members: membersOf(l).length })),
    timer: { startedAt: S.stepStartedAt, minutes: STEPS[S.step].minutes },
    ask: S.ask,
    breakUntil: S.breakUntil ?? null,
    bossLab: S.step === 7 ? S.stepLab[7] : null,
  };
}

export const state = (pid) => work(async () => {
  const me = person(pid);
  if (!me) return { ok: true, session: publicSession(null), me: null };
  const lab = S.labs[me.labId];
  const graph = await git.graph(lab.id);
  const wallGraph = S.step >= 4 ? await git.graph('wall') : null;
  if (!tipOf(graph, me.branch)) me.branch = 'main';
  return {
    ok: true,
    session: publicSession(lab),
    me: {
      pid: me.pid,
      name: me.name,
      labId: me.labId,
      pair: me.pair,
      branch: me.branch,
      mission: missionFor(S.step, lab.id, me.pair),
      pairNote: PAIR_NOTES[me.pair],
    },
    lab: {
      id: lab.id,
      name: lab.name,
      color: lab.color,
      members: membersOf(lab),
      branches: branchesOf(graph),
      drafts: lab.drafts,
      merging: lab.merging,
      goals: goalsFor(lab, graph, wallGraph),
      chaos: lab.chaos,
      graph: S.step >= 1 ? shownGraph(graph) : null,
      lastOp: lab.lastOp,
      concepts: lab.concepts,
    },
    wall: wallGraph ? { graph: wallGraph } : undefined,
  };
});

export const adminState = (joinUrl) => work(async () => {
  const wallGraph = S.step >= 4 ? await git.graph('wall') : null;
  const labs = await Promise.all(Object.values(S.labs).map(async (lab) => {
    const graph = await git.graph(lab.id);
    return {
      id: lab.id,
      name: lab.name,
      color: lab.color,
      members: membersOf(lab),
      goals: goalsFor(lab, graph, wallGraph),
      merging: lab.merging,
      refusedInARow: lab.refusedInARow,
      lastClickAt: lab.lastClickAt,
      monster: labMonster(lab, graph),
      graph: S.step >= 1 ? shownGraph(graph) : null,
      lastOp: lab.lastOp && { t: lab.lastOp.t, who: lab.lastOp.who, action: lab.lastOp.action, outcome: lab.lastOp.outcome },
      concepts: lab.concepts,
    };
  }));
  return {
    ok: true,
    session: {
      ...publicSession(null),
      steps: STEPS.map((s, n) => ({
        ...stepFor(n, null), hope: s.hope, askFirst: s.askFirst, next: s.next, facilitator: s.facilitator,
      })),
      planStartedAt: S.planStartedAt,
      joinUrl,
      stepLab: S.stepLab,
      audits: S.audits,
      replacedAt: S.replacedAt ?? null,
      concepts: CONCEPTS,
    },
    labs,
    wall: wallGraph ? { graph: wallGraph } : null,
    feed: S.feed,
  };
});

// ---------- Records: concepts, feed, last op ----------

function count(lab, pid, concept) {
  lab.concepts[concept] = (lab.concepts[concept] || 0) + 1;
  const mine = (lab.by[pid] ??= {});
  mine[concept] = (mine[concept] || 0) + 1;
}

const opOf = (r) => ({ porcelain: r.porcelain, explain: r.explain, commands: r.commands });

// The concept tracker counts what students did; rescues log without concepts.
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

// ---------- Join ----------

function freePair(labId) {
  const inLab = Object.values(S.people).filter((p) => p.labId === labId);
  const a = inLab.filter((p) => p.pair === 'A').length;
  return a <= inLab.length - a ? 'A' : 'B';
}

export const join = ({ name, labId, pid }) => work(async () => {
  const clean = [...String(name ?? '').trim()].slice(0, 24).join('').trim();
  if (!/[\p{L}\p{N}]/u.test(clean)) return fail('Type your name (a letter or digit).');
  labId = String(labId ?? '');
  if (!labById(labId)) return fail('Pick your lab.');
  let me = person(pid);
  if (me) {
    me.name = clean;
    if (me.labId !== labId) Object.assign(me, { labId, pair: freePair(labId), branch: 'main' });
  } else {
    me = { pid: crypto.randomBytes(6).toString('hex'), name: clean, labId, pair: freePair(labId), branch: 'main', joinedAt: now() };
    S.people[me.pid] = me;
  }
  S.planStartedAt ??= now();
  bump();
  return { ok: true, pid: me.pid, labId: me.labId, pair: me.pair };
});

// ---------- Student actions ----------

export const act = (action, input) => work(async () => {
  const me = person(input.pid);
  if (!me) return fail(T.rejoin, { rejoin: true });
  const need = UNLOCK[action];
  if (S.step < need) return fail(`Not yet — this unlocks in Step ${need}.`);
  const lab = S.labs[me.labId];
  if (action !== 'inspect' && action !== 'reflog') lab.lastClickAt = now();
  try {
    return await ACTIONS[action](me, lab, input);
  } catch (err) {
    return gitError(err);
  }
});

// Shared guards for anything that would move the note: open merge, then unsaved parts.
function blocked(lab, note) {
  if (lab.merging[note]) return fail(T.merging);
  if (Object.keys(lab.drafts[note] ?? {}).length) return fail(T.unsaved);
  return null;
}

const partsOf = (conflicts) => conflicts.map((p) => p.toUpperCase()).join(', ');

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
    if (mainLocked(note)) return fail(T.mainLocked);
    const card = await noteMonster(lab, note);
    const draft = (lab.drafts[note] ??= {});
    if (card?.[part] === value) delete draft[part];
    else draft[part] = value;
    bump(lab.id);
    return { ok: true, result: { draft } };
  },

  async commit(me, lab) {
    const note = me.branch;
    if (lab.merging[note]) return fail(T.merging);
    if (mainLocked(note)) return fail(T.mainLocked);
    const waiting = Object.keys(lab.drafts[note] ?? {}).length > 0; // someone may save these parts first
    const r = await git.commit(lab, note, authorOf(me));
    if (r.nothing) {
      const card = waiting && await noteCard(lab, note);
      const message = card ? `Already saved by ${card.author}: card ${short(card.id)}.` : 'Nothing changed — nothing to save.';
      return reply(lab, me, r, null, { message });
    }
    return reply(lab, me, r, { action: 'Save card', outcome: `card ${short(r.id)}`, concepts: ['save'] },
      { message: `Saved card ${short(r.id)}.` });
  },

  async branch(me, lab, { name }) {
    const note = String(name ?? '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,19}$/.test(note)) return fail('Use a–z, 0–9 and dashes, up to 20.');
    if (note === 'wall') return fail('"wall" is the Wall\'s name. Pick another.');
    const r = await git.createBranch(lab, note);
    if (r.exists) return fail(`${note} already exists. Press Switch to join it.`);
    me.branch = note;
    lab.drafts[note] ??= {};
    return reply(lab, me, r, { action: `New sticky note ${note}`, outcome: 'from main', concepts: ['branch'] });
  },

  // Switch runs no git: your pin lives in the session, and each note keeps its own draft.
  async switch(me, lab, { branch }) {
    const note = String(branch ?? '');
    if (!tipOf(await git.graph(lab.id), note)) return fail('That sticky note does not exist.');
    me.branch = note;
    const r = {
      porcelain: `git switch ${note}`,
      explain: `In your own copy this is \`git switch ${note}\`: \`.git/HEAD\` becomes \`ref: refs/heads/${note}\`. Here each note keeps its own draft; real Git brings unsaved changes along, or refuses.`,
      commands: [],
    };
    return reply(lab, me, r, { action: `Switch to ${note}`, concepts: ['switch'] });
  },

  // Merges always go into main ("Merge [note] into main").
  async merge(me, lab, { from }) {
    if (me.branch !== 'main') return fail(T.mainOnly);
    const into = 'main';
    from = String(from ?? '');
    if (from === into || !tipOf(await git.graph(lab.id), from)) return fail('Pick another sticky note to merge.');
    const stop = blocked(lab, into);
    if (stop) return stop;
    const r = await git.merge(lab, into, from, authorOf(me));
    if (r.nothing) return reply(lab, me, r, null, { message: `${into} already has ${from}. Nothing to merge.` });
    return reply(lab, me, r, mergeEntry(r, from, into));
  },

  async resolve(me, lab, { monster }) {
    const note = me.branch;
    const open = lab.merging[note];
    if (!open) return closed();
    // Any palette part, or a value one side already has (the mustache is never in the palette).
    const choice = {};
    for (const part of PARTS) {
      const value = monster?.[part];
      const sides = [open.auto[part], open.ours[part], open.theirsMonster[part]];
      if (!allowed(part, value) && !sides.includes(value)) return fail(T.badPart);
      choice[part] = value;
    }
    const r = await git.resolve(lab, note, choice, authorOf(me));
    if (r.refused && !lab.merging[note]) return closed();
    const what = open.kind === 'revert' ? 'revert' : 'merge';
    return reply(lab, me, r, { action: 'Finish merge', outcome: `${what} card ${short(r.id)}`, concepts: ['conflict', what] });
  },

  async abort(me, lab) {
    const note = me.branch;
    if (!lab.merging[note]) return closed();
    const r = await git.abort(lab, note);
    if (r.nothing) return closed();
    return reply(lab, me, r, { action: 'Cancel merge', outcome: `${note} unchanged` });
  },

  async push(me, lab) {
    if (me.branch !== 'main') return fail(T.mainOnly);
    if (S.step === 7 && !isBoss(lab)) return fail(T.boss);
    const unsaved = Object.keys(lab.drafts.main ?? {}).length > 0;
    const r = await git.push(lab, { force: false });
    if (r.rejected) {
      lab.refusedInARow += 1;
      const entry = { action: 'Send to Wall', outcome: `refused (${r.reason})`, bad: true, concepts: ['rejected'] };
      return { ...reply(lab, me, r, entry), ok: false, error: T.refused };
    }
    if (r.already) return reply(lab, me, r, null, { message: 'The Wall already has this card.' });
    lab.refusedInARow = 0;
    const sent = `Sent! The Wall moved to ${short(r.id)}.`;
    return reply(lab, me, r, { action: 'Send to Wall', outcome: `sent ${short(r.id)}`, concepts: ['push'] },
      { message: unsaved ? `${sent} Sent your last saved card. Unsaved parts weren't sent.` : sent, wall: true });
  },

  async pull(me, lab) {
    if (me.branch !== 'main') return fail(T.mainOnly);
    const stop = blocked(lab, 'main');
    if (stop) return stop;
    const r = await git.pull(lab, authorOf(me));
    if (r.nothing) {
      return reply(lab, me, r, { action: 'Get & combine', outcome: 'nothing new', concepts: ['pull'] }, { message: 'Nothing new on the Wall.' });
    }
    return reply(lab, me, r, pullEntry(r));
  },

  // git.js refuses the Start card and cards outside the note's history, in the client's words.
  async revert(me, lab, { commit }) {
    const note = me.branch;
    const stop = blocked(lab, note);
    if (stop) return stop;
    const r = await git.revert(lab, note, String(commit ?? ''), authorOf(me));
    if (r.nothing) return reply(lab, me, r, null, { message: 'Already undone. Nothing to change.' });
    const action = `Undo card ${short(commit)}`;
    if (r.conflict) return reply(lab, me, r, { action, outcome: `conflict: ${partsOf(r.conflicts)}`, bad: true });
    return reply(lab, me, r, { action, outcome: `fix card ${short(r.id)}`, concepts: ['revert'] });
  },

  // Any card in the lab, diary-only ones included: that's how you recover.
  async reset(me, lab, { commit }) {
    const note = me.branch;
    const stop = blocked(lab, note);
    if (stop) return stop;
    const r = await git.reset(lab, note, String(commit ?? ''), authorOf(me));
    return reply(lab, me, r, { action: 'Move my note back here', outcome: `${note} → ${short(commit)}`, concepts: ['reset'] });
  },

  async reflog(me, lab) {
    const r = await git.reflog(lab, me.branch);
    count(lab, me.pid, 'diary');
    bump(lab.id);
    const { commands, porcelain, explain, ...result } = r;
    return { ok: true, result, op: opOf(r) };
  },

  async inspect(me, lab, { commit, repo }) {
    const onWall = repo === 'wall';
    if (onWall && S.step < UNLOCK.wall) return fail(`Not yet — this unlocks in Step ${UNLOCK.wall}.`);
    const r = await git.inspect(onWall ? 'wall' : lab.id, String(commit ?? ''));
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
    if (r.forced) S.replacedAt = now();
    return reply(lab, me, r, { action: 'Replace the Wall with one card', outcome: `forced ${short(r.id)}`, bad: true, concepts: ['force'] },
      { wall: true });
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
    Object.assign(l, { drafts: { main: {} }, merging: {}, refusedInARow: 0 });
    log(l, TEACHER, { action: 'Copy the Wall', outcome: `${l.name}'s cards = the Wall's` }, r);
  }
  for (const p of Object.values(S.people)) p.branch = 'main';
}

async function sabotage() {
  const r = await git.wallSabotage();
  if (r.moved) throw Object.assign(new Error('The Wall moved during the sabotage.'), { busy: true });
  S.sabotaged = true;
  if (r.nothing) return 'The mustache is already on the Wall.';
  log(null, INTERN, { action: 'Tiny style fix', outcome: `mustache card ${short(r.id)} on the Wall`, bad: true }, r);
  return `The Intern put card ${short(r.id)} on the Wall.`;
}

// The first lab whose Step 3 goals all tick: Step 4's default lab.
async function firstReadyLab() {
  for (const lab of Object.values(S.labs)) {
    const goals = STEPS[3].goals(labView(lab, await git.graph(lab.id), null));
    if (goals.every((g) => g.done)) return lab.id;
  }
  return Object.keys(S.labs)[0];
}

// labId is the admin's pick for the target step (4: whose main goes to the Wall; 7: the boss).
// Jumping ahead runs every skipped one-time side effect, in order; Prev never undoes them.
// The lesson presses Sabotage on Step 5; entering Step 6 only runs it if nobody did.
async function goToStep(step, labId) {
  const picked = labById(labId) ? String(labId) : null;
  if (step >= 4 && !S.wallMet) {
    S.stepLab[4] = (step === 4 && picked) || await firstReadyLab();
    await meetTheWall(S.stepLab[4]);
    S.wallMet = true;
  }
  if (step >= 6 && !S.sabotaged) await sabotage();
  if (step === 7) S.stepLab[7] = picked ?? S.stepLab[7] ?? Object.keys(S.labs)[0];
  // main is read-only in Steps 2–3, so leftover unsaved parts there could never be saved.
  if (step === 2 || step === 3) for (const lab of Object.values(S.labs)) lab.drafts.main = {};
  for (const lab of Object.values(S.labs)) lab.lastClickAt = now(); // "No clicks for" counts from here
  Object.assign(S, { step, stepStartedAt: now(), ask: false, breakUntil: null });
}

// ---------- Rescue: finish the current step for one lab, doing only what's missing ----------

// Rescue runs several ops in a row. If a student moved a note meanwhile, stop: the teacher presses again.
function must(r) {
  if (r.moved || r.refused || r.merging) throw Object.assign(new Error('A note moved during the rescue.'), { busy: true });
  return r;
}

const ours = (part, open) => open.ours[part];
const theirs = (part, open) => open.theirsMonster[part];

// Finish an open merge, choosing each conflicted part with pick(part, open).
async function settle(lab, note, pick) {
  const open = lab.merging[note];
  if (!open) return;
  const monster = { ...open.auto };
  for (const part of open.conflicts) monster[part] = pick(part, open);
  const r = must(await git.resolve(lab, note, monster, TEACHER));
  log(lab, TEACHER, { action: 'Finish merge', outcome: `card ${short(r.id)}` }, r);
}

// Cancel open merges and drop unsaved parts on the notes rescue touches.
async function clearNotes(lab, notes) {
  for (const note of notes) {
    if (lab.merging[note]) must(await git.abort(lab, note));
    lab.drafts[note] = {};
  }
}

async function teacherCommit(lab, note, parts) {
  lab.drafts[note] = parts;
  const r = must(await git.commit(lab, note, TEACHER));
  if (!r.nothing) log(lab, TEACHER, { action: 'Save card', outcome: `card ${short(r.id)}` }, r);
}

async function teacherMerge(lab, from, pick) {
  const r = must(await git.merge(lab, 'main', from, TEACHER));
  if (r.nothing) return;
  log(lab, TEACHER, { ...mergeEntry(r, from, 'main'), concepts: [] }, r);
  await settle(lab, 'main', pick);
}

async function teacherPull(lab, pick) {
  const r = must(await git.pull(lab, TEACHER));
  if (r.nothing) return;
  log(lab, TEACHER, { ...pullEntry(r), concepts: [] }, r);
  await settle(lab, 'main', pick);
}

// Send; if refused, get & combine once and send again.
async function teacherPush(lab, pick) {
  let r = await git.push(lab, { force: false });
  if (r.rejected) {
    log(lab, TEACHER, { action: 'Send to Wall', outcome: `refused (${r.reason})`, bad: true }, r);
    await teacherPull(lab, pick);
    r = await git.push(lab, { force: false });
  }
  if (r.rejected || r.already) return;
  lab.refusedInARow = 0;
  log(lab, TEACHER, { action: 'Send to Wall', outcome: `sent ${short(r.id)}` }, r);
}

async function rescueBranches(lab, graph) {
  await clearNotes(lab, Object.values(PAIR_NOTES).filter((n) => tipOf(graph, n)));
  for (const note of Object.values(PAIR_NOTES)) {
    if (!tipOf(graph, note)) {
      const r = must(await git.createBranch(lab, note));
      lab.drafts[note] = {};
      log(lab, TEACHER, { action: `New sticky note ${note}`, outcome: 'from main' }, r);
    }
    const card = await noteMonster(lab, note);
    const missing = Object.fromEntries(Object.entries(PAIR_PARTS[note]).filter(([p, val]) => card[p] !== val));
    if (Object.keys(missing).length) await teacherCommit(lab, note, missing);
  }
}

// Each plan returns a refusal message, or nothing when it ran.
const RESCUE = {
  2: rescueBranches,
  async 3(lab, graph) {
    await rescueBranches(lab, graph);
    await clearNotes(lab, ['main']);
    const robot = (part, open) => (part === 'body' ? 'robot' : open.ours[part]);
    await teacherMerge(lab, 'cat-robot', robot);
    await teacherMerge(lab, 'superhero', robot);
  },
  async 5(lab) {
    const change = LAB_CHANGES[lab.id];
    const mine = (part, open) => (part === change.part ? change.value : open.ours[part]);
    await clearNotes(lab, ['main']);
    await teacherPull(lab, mine);
    if ((await noteMonster(lab, 'main'))[change.part] !== change.value) {
      await teacherCommit(lab, 'main', { [change.part]: change.value });
    }
    await teacherPush(lab, mine);
  },
  async 6(lab) {
    await clearNotes(lab, ['main']);
    await teacherPull(lab, theirs);
    const graph = await git.graph(lab.id);
    const byId = index(graph);
    const main = tipOf(graph, 'main');
    const intern = [...history(byId, main)].find((id) => byId.get(id).author === INTERN.name);
    if (intern && byId.get(main).monster.face === 'mustache') {
      const r = must(await git.revert(lab, 'main', intern, TEACHER));
      if (!r.nothing) log(lab, TEACHER, { action: `Undo card ${short(intern)}`, outcome: r.conflict ? 'conflict' : `fix card ${short(r.id)}` }, r);
      await settle(lab, 'main', theirs);
    }
    await teacherPush(lab, theirs);
  },
  async 7(lab) {
    if (!isBoss(lab)) return 'Only the boss lab replaces the Wall.';
    await clearNotes(lab, ['main']);
    await teacherPull(lab, ours);
    const r = must(await git.squashForcePush(lab, TEACHER));
    if (r.forced) S.replacedAt = now();
    log(lab, TEACHER, { action: 'Replace the Wall with one card', outcome: `forced ${short(r.id)}`, bad: true }, r);
  },
};

async function rescue(lab) {
  const plan = RESCUE[S.step];
  if (!plan) return fail('Nothing to rescue in this step.');
  const graph = await git.graph(lab.id);
  const wallGraph = S.step >= 4 ? await git.graph('wall') : null;
  if (goalsFor(lab, graph, wallGraph).every((g) => g.done)) return { ok: true, result: { message: `${lab.name} is already done.` } };
  const refusal = await plan(lab, graph);
  if (refusal) return fail(refusal);
  return { ok: true, result: { message: `Rescued ${lab.name}.` } };
}

// ---------- Admin actions ----------

async function setLabCount(count) {
  if (S.step > 0) return fail('Set the number of labs before Step 1.');
  if (!Number.isInteger(count) || count < 2 || count > 6) return fail('Pick 2 to 6 labs.');
  for (let n = Object.keys(S.labs).length + 1; n <= count; n++) {
    await clone(String(n));
    S.labs[n] = newLab(String(n));
  }
  for (const id of Object.keys(S.labs).slice(count)) {
    delete S.labs[id];
    await git.removeLab(id);
    for (const p of Object.values(S.people).filter((x) => x.labId === id)) {
      const target = Object.values(S.labs).sort((a, b) => membersOf(a).length - membersOf(b).length)[0].id;
      Object.assign(p, { labId: target, pair: freePair(target), branch: 'main' });
    }
  }
  return { ok: true, result: { message: `${count} labs.` } };
}

// "Wall: Priya (Lab 2), 3fa9c1e" — one line for the Wall, then one per lab.
function auditLines(r) {
  const line = (where, found) => {
    if (!found) return `${where}: not found`;
    if (found.clean) return `${where}: Only the clean card has it. The real author is gone.`;
    const from = person(found.pid)?.labId;
    return `${where}: ${found.author}${from ? ` (${labName(from)})` : ''}, ${short(found.id)}`;
  };
  return [line('Wall', r.wall), ...Object.keys(S.labs).map((id) => line(labName(id), r.labs[id]))];
}

const ADMIN = {
  async step({ step, labId }) {
    step = Number(step);
    if (!Number.isInteger(step) || step < 0 || step >= STEPS.length) return fail('No such step.');
    await goToStep(step, labId);
    return { ok: true, result: { message: `Step ${step} · ${STEPS[step].title}` } };
  },
  labs: ({ count }) => setLabCount(Number(count)),
  move({ pid, labId }) {
    const p = person(pid);
    if (!p || !labById(labId)) return fail('Pick a person and a lab.');
    labId = String(labId);
    if (p.labId !== labId) Object.assign(p, { labId, pair: freePair(labId), branch: 'main' });
    return { ok: true, result: { message: `${p.name} moved to ${labName(labId)}.` } };
  },
  async rescue({ labId }) {
    const lab = labById(labId);
    return lab ? rescue(lab) : fail('Pick a lab.');
  },
  ask({ on }) {
    S.ask = !!on;
    return { ok: true, result: { ask: S.ask } };
  },
  break({ on }) {
    S.breakUntil = on ? now() + BREAK_MS : null;
    return { ok: true, result: { message: on ? 'Break: back in 4 minutes.' : 'Break over.' } };
  },
  timer() {
    S.stepStartedAt = now();
    // Restarting on Step 0 also sets the class clock: Step 0 starts 3 minutes in (join comes first).
    if (S.step === 0) S.planStartedAt = now() - STEPS[0].at * 60e3;
    return { ok: true, result: {} };
  },
  async sabotage() {
    if (S.step < UNLOCK.wall) return fail(`The Wall opens in Step ${UNLOCK.wall}.`);
    return { ok: true, result: { message: await sabotage() } };
  },
  async audit({ part = 'legs', value = 'tentacles' }) {
    if (!PARTS.includes(part) || !Object.hasOwn(PALETTE[part], value)) return fail(T.badPart);
    const audit = { t: now(), part, value, lines: auditLines(await git.audit(part, value)) };
    S.audits = [...S.audits, audit].slice(-2); // before and after the boss replaces the Wall
    return { ok: true, result: { message: audit.lines.join(' · '), audit } };
  },
  async gc() {
    const r = await git.gcWall();
    const message = `The Wall's bin had ${r.before} old card${r.before === 1 ? '' : 's'}. Now ${r.after}.`;
    log(null, TEACHER, { action: "Empty the Wall's bin", outcome: message }, r);
    return { ok: true, result: { message }, op: opOf(r) };
  },
  async reset() {
    await fresh(Object.keys(S.labs).length);
    return { ok: true, result: { message: 'New session. Everyone joins again.' } };
  },
};

// These change the shape of the session, so they run alone.
const ALONE = new Set(['step', 'labs', 'reset']);

export const admin = (action, input) => (ALONE.has(action) ? alone : work)(async () => {
  try {
    const out = await ADMIN[action](input);
    bump();
    return out;
  } catch (err) {
    return gitError(err);
  }
});
