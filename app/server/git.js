// The Git engine. Every button runs real Git plumbing here, on real repos:
// DATA_DIR/wall.git (bare, "like GitHub") and DATA_DIR/labs/<id> (one repo per lab, no worktree).
// Each operation returns { ...result, commands: [{cmd, out, code}], porcelain, explain }:
// the plumbing it ran, what you would type in your own copy, and one plain explanation.
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PARTS, START, describeChange, isMonster, merge3, parse, serialize } from './monster.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const LABS = path.join(DATA_DIR, 'labs');
const WALL_URL = '../../wall.git'; // relative to a lab repo, so DATA_DIR can move
const START_TIME = Date.parse('2026-10-01T00:00:00Z'); // in the past: no card is older than its parent
const SYSTEM = { pid: 'lab', name: 'Monster Lab' };
const INTERN = { pid: 'intern', name: 'The Intern' };
const CLEAN = 'Clean history';
const SABOTAGE = 'Tiny style fix';
const ID = /^[0-9a-f]{40}$/;
const NOTE = /^[a-z0-9][a-z0-9-]{0,19}$/;

const short = (id) => String(id).slice(0, 7);
const lines = (text) => String(text).split('\n').filter(Boolean);
const P = (part) => part.toUpperCase();
const list = (parts) => parts.map(P).join(' and ');

// ---------- Runner ----------

const dirOf = (repo) => {
  if (path.isAbsolute(repo)) return repo;
  if (repo === 'wall') return path.join(DATA_DIR, 'wall.git');
  if (!/^\w{1,20}$/.test(repo)) throw new Error(`Bad lab id: ${repo}`);
  return path.join(LABS, repo);
};

// Author and committer are always explicit: name, <pid>@monster.lab, and the time.
function identity(who = SYSTEM, time = Date.now()) {
  const name = String(who.name).replace(/[\x00-\x1f\x7f<>]/g, ' ').trim() || 'Someone';
  const email = `${/^[\w-]{1,40}$/.test(who.pid) ? who.pid : 'someone'}@monster.lab`;
  const date = `@${Math.floor(time / 1000)} +0000`;
  return {
    GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_COMMITTER_DATE: date,
  };
}

// Run git in a repo ('wall', a lab id, or an absolute dir). Resolves with the exit code; never throws on exit codes.
export function git(repo, args, { input, env, buffer = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile('git', args, {
      cwd: dirOf(repo),
      encoding: buffer ? 'buffer' : 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        PATH: process.env.PATH, LC_ALL: 'C', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
        GIT_TERMINAL_PROMPT: '0', ...identity(), ...env,
      },
    }, (err, out, stderr) => {
      if (err && typeof err.code !== 'number') reject(err);
      else resolve({ code: err ? err.code : 0, out, err: String(stderr) });
    });
    child.stdin.on('error', () => {}); // git may exit before reading its input
    child.stdin.end(input ?? '');
  });
}

// How a command reads in "Show the low-level steps": runnable in a shell, input included.
const quote = (a) => (/^[\w@%^{}:/.,=+-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);
function shown(args, input) {
  const cmd = `git ${args.map(quote).join(' ')}`;
  return input === undefined ? cmd : `printf ${quote(input.replace(/\t/g, '\\t').replace(/\n/g, '\\n'))} | ${cmd}`;
}

// Run one step of an operation: record it in ctx (when given) and throw on unexpected exit codes.
// The error keeps git's stderr, so a stale lock reads as "Unable to create '...lock'" (the server says "Busy").
async function run(ctx, repo, args, { ok = [0], ...opts } = {}) {
  const r = await git(repo, args, opts);
  ctx?.commands.push({
    cmd: shown(args, opts.input),
    out: [String(r.out), r.err].map((s) => s.trim()).filter(Boolean).join('\n'),
    code: r.code,
  });
  if (!ok.includes(r.code)) throw new Error(`git ${args[0]} failed (${r.code}): ${r.err.trim()}`);
  return r;
}

const op = () => ({ commands: [] });
const finish = (ctx, result, porcelain, explain) => ({ ...result, commands: ctx.commands, porcelain, explain });

// ---------- Locks: one promise queue per lab repo + one for the Wall ----------

// Always lab first, then the Wall. A lock already held by this call chain is not taken again.
const held = new AsyncLocalStorage();
const queues = new Map();
const labKey = (id) => `lab:${id}`;

function locked(keys, fn) {
  const mine = held.getStore() ?? new Set();
  const [key, ...rest] = keys.filter((k) => !mine.has(k));
  if (!key) return fn();
  const turn = (queues.get(key) ?? Promise.resolve())
    .then(() => held.run(new Set([...mine, key]), () => locked(rest, fn)));
  queues.set(key, turn.catch(() => {}));
  return turn;
}

const onLab = (id, fn) => locked([labKey(id)], fn);
const onLabAndWall = (id, fn) => locked([labKey(id), 'wall'], fn);
const onWall = (fn) => locked(['wall'], fn);
const onRepo = (repo, fn) => (repo === 'wall' ? onWall(fn) : onLab(repo, fn));

function labIds() {
  return fs.existsSync(LABS) ? fs.readdirSync(LABS).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : [];
}

// Run fn while holding every lock (after running git ops finish).
export function exclusive(fn) {
  const labs = new Set([...labIds(), ...[...queues.keys()].filter((k) => k.startsWith('lab:')).map((k) => k.slice(4))]);
  return locked([...[...labs].sort().map(labKey), 'wall'], fn);
}

// ---------- Small reads and writes ----------

// Bumped by every git op that may move a ref; the graph cache checks it.
const versions = new Map();
const touch = (...repos) => repos.forEach((r) => versions.set(r, (versions.get(r) ?? 0) + 1));

async function tipOf(ctx, repo, ref) {
  const r = await run(ctx, repo, ['rev-parse', '--verify', '-q', `${ref}^{commit}`], { ok: [0, 1] });
  return r.code === 0 ? r.out.trim() : null;
}

// Client-sent card IDs: 40 hex and a commit in this repo.
async function isCard(repo, id) {
  return ID.test(String(id)) && (await git(repo, ['cat-file', '-e', `${id}^{commit}`])).code === 0;
}

async function isAncestor(ctx, repo, a, b) {
  return (await run(ctx, repo, ['merge-base', '--is-ancestor', a, b], { ok: [0, 1] })).code === 0;
}

async function monsterAt(ctx, repo, id) {
  return parse((await run(ctx, repo, ['cat-file', '-p', `${id}:monster.txt`])).out);
}

const commitTree = async (ctx, repo, tree, parents, message, who, time) => (await run(ctx, repo,
  ['commit-tree', tree, ...parents.flatMap((p) => ['-p', p]), ...message.split('\n\n').flatMap((m) => ['-m', m])],
  { env: identity(who, time) })).out.trim();

// A card from scratch: monster.txt → blob → tree → commit.
async function writeCard(ctx, repo, monster, parents, message, who, time) {
  const blob = (await run(ctx, repo, ['hash-object', '-w', '--stdin'], { input: serialize(monster) })).out.trim();
  const tree = (await run(ctx, repo, ['mktree'], { input: `100644 blob ${blob}\tmonster.txt\n` })).out.trim();
  return commitTree(ctx, repo, tree, parents, message, who, time);
}

// Compare-and-swap a ref (old = null: must not exist yet). The reason goes into the diary (reflog).
// Returns false when the ref was not where we expected: someone moved it meanwhile.
async function swap(ctx, repo, ref, next, old, reason, who) {
  const args = ['update-ref', ...(reason ? ['-m', reason] : []), ref, next, old ?? ''];
  const r = await run(ctx, repo, args, { ok: [0, 128], env: identity(who) });
  if (r.code === 0) {
    touch(repo);
    return true;
  }
  if (/but expected|reference already exists|unable to resolve reference/.test(r.err)) return false;
  throw new Error(`git update-ref failed: ${r.err.trim()}`);
}

// Full refnames everywhere. Note names were validated when the note was made; check again here.
function refOf(note) {
  if (note === 'wall/main') return 'refs/remotes/wall/main';
  if (!NOTE.test(note)) throw new Error(`Bad note name: ${note}`);
  return `refs/heads/${note}`;
}

const moved = (ctx) => finish(ctx, { moved: true }, '', 'Someone moved this sticky note meanwhile. Nothing changed.');

// An open merge holds its note: nothing else moves it until someone finishes or cancels.
// Checked inside the lock, so two people pressing at once can't open two merges or save under one.
const holding = (ctx) => finish(ctx, { merging: true }, '', 'Finish or cancel the merge first.');

// ---------- Session init ----------

// The Wall with its Start card. Fixed author and date, so the Start ID is the same in every session.
export function initWall() {
  return onWall(async () => {
    const ctx = op();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    await run(ctx, DATA_DIR, ['init', '--bare', '-b', 'main', '--object-format=sha1', '--ref-format=files', 'wall.git']);
    await run(ctx, 'wall', ['config', 'gc.auto', '0']);
    const id = await writeCard(ctx, 'wall', START, [], 'Start', SYSTEM, START_TIME);
    if (!(await swap(ctx, 'wall', 'refs/heads/main', id, null, null, SYSTEM))) throw new Error('The Wall already exists.');
    return finish(ctx, { id }, 'git init --bare wall.git', `Git made the Wall and its Start card, ${short(id)}.`);
  });
}

// A lab's repo = a full copy of the Wall. Used at session start and when entering Step 4.
export function cloneLab(id, { replace = false } = {}) {
  return onLabAndWall(id, async () => {
    const ctx = op();
    const dir = dirOf(id);
    if (replace) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(LABS, { recursive: true });
    await run(ctx, DATA_DIR, ['clone', '--no-checkout', '--ref-format=files', '-o', 'wall', 'wall.git', `labs/${id}`]);
    await run(ctx, id, ['remote', 'set-url', 'wall', WALL_URL]); // clone stored an absolute path
    await run(ctx, id, ['config', 'core.logAllRefUpdates', 'always']);
    await run(ctx, id, ['config', 'gc.auto', '0']);
    touch(id);
    const tip = await tipOf(ctx, id, 'refs/heads/main');
    return finish(ctx, { id: tip }, 'git clone wall.git',
      `Git copied every card from the Wall. Same cards, same IDs: main is at ${short(tip)}.`);
  });
}

export function removeLab(id) {
  return onLab(id, async () => {
    fs.rmSync(dirOf(id), { recursive: true, force: true });
    touch(id);
    cache.delete(id);
  });
}

// ---------- Saving and sticky notes ----------

// Save the note's unsaved parts as a new card. Parts edited during the save stay unsaved.
export function commit(lab, note, author) {
  return onLab(lab.id, async () => {
    const ctx = op();
    if (lab.merging[note]) return holding(ctx);
    const parts = { ...lab.drafts[note] };
    const clearSaved = () => {
      const draft = lab.drafts[note] ?? {};
      for (const [part, value] of Object.entries(parts)) if (draft[part] === value) delete draft[part];
    };
    const nothing = () => finish(ctx, { nothing: true }, 'git commit', 'Nothing changed, so Git made no card.');
    if (!Object.keys(parts).length) return nothing();
    const ref = refOf(note);
    const tip = await tipOf(ctx, lab.id, ref);
    if (!tip) return moved(ctx);
    const card = await monsterAt(ctx, lab.id, tip);
    const next = { ...card, ...Object.fromEntries(PARTS.filter((p) => Object.hasOwn(parts, p)).map((p) => [p, parts[p]])) };
    const message = describeChange(card, next);
    if (!message) {
      clearSaved();
      return nothing();
    }
    const id = await writeCard(ctx, lab.id, next, [tip], message, author);
    if (!(await swap(ctx, lab.id, ref, id, tip, `commit: ${message}`, author))) return moved(ctx);
    clearSaved();
    return finish(ctx, { id, parent: tip, message, monster: next }, `git commit -am ${quote(message)}`,
      `Git stored the monster as card ${short(id)}. It points back to ${short(tip)}. ${note} moved to it.`);
  });
}

// A new sticky note on main's card. Nothing is copied: a note is a tiny file holding one ID.
export function createBranch(lab, name, author = SYSTEM) {
  return onLab(lab.id, async () => {
    const ctx = op();
    if (!NOTE.test(name) || name === 'wall') return finish(ctx, { refused: 'Use a–z, 0–9 and dashes, up to 20.' }, '', '');
    const main = await tipOf(ctx, lab.id, 'refs/heads/main');
    if (!(await swap(ctx, lab.id, refOf(name), main, null, 'branch: Created from main', author))) {
      return finish(ctx, { exists: true }, '', `${name} already exists.`);
    }
    return finish(ctx, { id: main, name }, `git switch -c ${name} main`,
      `Git wrote a new sticky note, ${name}, on main's card ${short(main)}. Nothing was copied.`);
  });
}

// ---------- Merging ----------

const nameOf = (note) => (note === 'wall/main' ? 'the Wall' : note);

// Git's own default merge messages.
function mergeMessage(into, from) {
  if (from === 'wall/main') return "Merge remote-tracking branch 'wall/main'";
  return into === 'main' ? `Merge branch '${from}'` : `Merge branch '${from}' into ${into}`;
}

// Open a merge on the lab (shared by everyone on the note) and say which parts need a person.
async function openMerge(ctx, lab, note, { kind, from, intoTip, theirs, baseId, tree, message, who }) {
  const conflictedText = (await run(ctx, lab.id, ['cat-file', '-p', `${tree}:monster.txt`])).out;
  const base = await monsterAt(ctx, lab.id, baseId);
  const ours = await monsterAt(ctx, lab.id, intoTip);
  const theirsMonster = await monsterAt(ctx, lab.id, theirs);
  const { auto, conflicts } = merge3(base, ours, theirsMonster);
  lab.merging[note] = {
    kind, from, intoTip, theirs, base, ours, theirsMonster, auto, conflicts, conflictedText, message,
    startedBy: who.name, t: Date.now(),
  };
  return { conflict: true, conflicts, auto, base: baseId };
}

// Merge `from` (a note or 'wall/main') into `into`. verb names the diary line: "merge <from>" or "pull".
async function mergeIn(ctx, lab, into, from, who, verb = `merge ${from}`) {
  if (lab.merging[into]) return { merging: true };
  const ref = refOf(into);
  const intoTip = await tipOf(ctx, lab.id, ref);
  const fromTip = await tipOf(ctx, lab.id, refOf(from));
  if (!intoTip || !fromTip) return { moved: true };
  if (await isAncestor(ctx, lab.id, fromTip, intoTip)) return { nothing: true, id: intoTip };
  if (await isAncestor(ctx, lab.id, intoTip, fromTip)) {
    if (!(await swap(ctx, lab.id, ref, fromTip, intoTip, `${verb}: Fast-forward`, who))) return { moved: true };
    return { fastForward: true, id: fromTip, from: intoTip };
  }
  // Short names, so the conflict markers read "<<<<<<< main" and ">>>>>>> superhero".
  const mt = await run(ctx, lab.id, ['merge-tree', '--write-tree', into, from], { ok: [0, 1] });
  const tree = lines(mt.out)[0];
  const message = mergeMessage(into, from);
  if (mt.code === 0) {
    const id = await commitTree(ctx, lab.id, tree, [intoTip, fromTip], message, who);
    if (!(await swap(ctx, lab.id, ref, id, intoTip, `${verb}: Merge made by the 'ort' strategy.`, who))) return { moved: true };
    return { merged: true, id, parents: [intoTip, fromTip] };
  }
  const baseId = (await run(ctx, lab.id, ['merge-base', intoTip, fromTip])).out.trim();
  return openMerge(ctx, lab, into, { kind: 'merge', from, intoTip, theirs: fromTip, baseId, tree, message, who });
}

function mergeExplain(r, into, from) {
  if (r.merging) return 'Finish or cancel the merge first.';
  if (r.moved) return 'Someone moved this sticky note meanwhile. Nothing changed.';
  if (r.nothing) return `${into} already has every card of ${nameOf(from)}. Nothing to do.`;
  if (r.fastForward) {
    return `${into}'s card was already in ${nameOf(from)}'s history. Git slid ${into} forward to ${short(r.id)}. No new card (fast-forward).`;
  }
  if (r.merged) return `Each part changed on one side only. Git made merge card ${short(r.id)} with two parents.`;
  return `${list(r.conflicts)} changed on both sides since card ${short(r.base)}. Git needs a person to pick.`;
}

export function merge(lab, into, from, author) {
  return onLab(lab.id, async () => {
    const ctx = op();
    const r = await mergeIn(ctx, lab, into, from, author);
    return finish(ctx, r, `git merge ${from}`, mergeExplain(r, into, from));
  });
}

// Finish an open merge (or undo) with the monster people chose.
export function resolve(lab, note, monster, author) {
  return onLab(lab.id, async () => {
    const ctx = op();
    const open = lab.merging[note];
    if (!open) return finish(ctx, { refused: 'There is no merge to finish.' }, '', '');
    if (!isMonster(monster)) return finish(ctx, { refused: 'Pick a value for every part.' }, '', '');
    const merging = open.kind === 'merge';
    const parents = merging ? [open.intoTip, open.theirs] : [open.intoTip];
    const subject = open.message.split('\n')[0];
    const id = await writeCard(ctx, lab.id, monster, parents, open.message, author);
    const reason = merging ? `commit (merge): ${subject}` : `revert: ${subject}`;
    if (!(await swap(ctx, lab.id, refOf(note), id, open.intoTip, reason, author))) return moved(ctx);
    delete lab.merging[note];
    const explain = merging
      ? `Git made merge card ${short(id)} with two parents: ${note} and ${nameOf(open.from)}.`
      : `Git made fix card ${short(id)}. The old card stays in the history.`;
    return finish(ctx, { id, parents, monster }, merging ? 'git add monster.txt\ngit commit' : 'git add monster.txt\ngit revert --continue', explain);
  });
}

// Cancel an open merge. No card was made, so the note stays where it was.
export function abort(lab, note) {
  return onLab(lab.id, async () => {
    const ctx = op();
    const open = lab.merging[note];
    if (!open) return finish(ctx, { nothing: true }, '', 'There is no merge to cancel.');
    delete lab.merging[note];
    return finish(ctx, { kind: open.kind }, open.kind === 'merge' ? 'git merge --abort' : 'git revert --abort',
      `Cancelled. ${note} is where it was, at ${short(open.intoTip)}.`);
  });
}

// ---------- The Wall ----------

// Send main to the Wall. The flag on the ref's porcelain line says what happened.
async function pushIn(ctx, lab, force) {
  const tip = await tipOf(ctx, lab.id, 'refs/heads/main');
  const r = await run(ctx, lab.id, ['push', '--porcelain', ...(force ? ['--force'] : []), 'wall', 'refs/heads/main:refs/heads/main'],
    { ok: [0, 1] });
  touch(lab.id, 'wall');
  const line = lines(r.out).find((l) => l.slice(1).startsWith('\trefs/heads/main:refs/heads/main\t')) ?? '';
  const flag = line[0];
  if (r.code === 0 && (flag === ' ' || flag === '+')) return { id: tip, forced: flag === '+' };
  if (r.code === 0 && flag === '=') return { already: true, id: tip };
  const reason = flag === '!' && /\((fetch first|non-fast-forward)\)/.exec(line)?.[1];
  if (reason) return { rejected: true, reason, id: tip };
  throw new Error(`git push failed (${r.code}): ${line} ${r.err.trim()}`);
}

function pushExplain(r) {
  if (r.rejected) return "The Wall has cards you don't have. Git refuses, so nobody's card gets lost.";
  if (r.already) return `The Wall already has card ${short(r.id)}. Nothing to send.`;
  if (r.forced) return `The Wall's main was forced to ${short(r.id)}. Its old cards have no sticky note now.`;
  return `Git sent the cards the Wall was missing. The Wall's main moved to ${short(r.id)}.`;
}

export function push(lab, { force = false } = {}) {
  return onLabAndWall(lab.id, async () => {
    const ctx = op();
    const r = await pushIn(ctx, lab, force);
    return finish(ctx, r, force ? 'git push --force' : 'git push', pushExplain(r));
  });
}

// Get & combine: fetch the Wall's cards, then merge wall/main into main.
export function pull(lab, author) {
  return onLab(lab.id, async () => {
    const ctx = op();
    await onWall(() => run(ctx, lab.id, ['fetch', 'wall']));
    touch(lab.id);
    const r = await mergeIn(ctx, lab, 'main', 'wall/main', author, 'pull');
    const explain = r.nothing ? 'Git fetched from the Wall. Nothing new: main has every card already.'
      : `Git fetched the Wall's cards into wall/main, then merged. ${mergeExplain(r, 'main', 'wall/main')}`;
    return finish(ctx, r, 'git fetch wall\ngit merge wall/main', explain);
  });
}

// ---------- Undo ----------

// Undo a card by adding a new one: merge with the card as base and its first parent as "theirs".
export function revert(lab, note, commit, author) {
  return onLab(lab.id, async () => {
    const ctx = op();
    const refuse = (refused) => finish(ctx, { refused }, '', '');
    if (!(await isCard(lab.id, commit))) return refuse("That card isn't in your lab's cards.");
    const ref = refOf(note);
    const tip = await tipOf(ctx, lab.id, ref);
    if (!tip) return moved(ctx);
    const [, parent, ...others] = (await run(ctx, lab.id, ['rev-list', '--parents', '-n', '1', commit])).out.trim().split(' ');
    if (!parent) return refuse("The Start card can't be undone.");
    if (!(await isAncestor(ctx, lab.id, commit, tip))) return refuse(`This card isn't in ${note}'s history.`);
    if (lab.merging[note]) return holding(ctx);
    const porcelain = others.length ? `git revert -m 1 ${short(commit)}` : `git revert ${short(commit)}`;
    const subject = (await run(ctx, lab.id, ['log', '-1', '--format=%s', commit])).out.trim();
    const message = `Revert "${subject}"\n\nThis reverts commit ${commit}.`;
    const parentName = (await run(ctx, lab.id, ['rev-parse', '--short', parent])).out.trim();
    const mt = await run(ctx, lab.id, ['merge-tree', '--write-tree', `--merge-base=${commit}`, note, parentName], { ok: [0, 1] });
    const tree = lines(mt.out)[0];
    if (mt.code === 1) {
      const r = await openMerge(ctx, lab, note, { kind: 'revert', from: commit, intoTip: tip, theirs: parent, baseId: commit, tree, message, who: author });
      return finish(ctx, r, porcelain, `${list(r.conflicts)} changed again after ${short(commit)}. Pick what to keep.`);
    }
    if (tree === (await run(ctx, lab.id, ['rev-parse', `${tip}^{tree}`])).out.trim()) {
      return finish(ctx, { nothing: true }, porcelain, `Nothing to undo: ${note} already looks like the card before ${short(commit)}.`);
    }
    const id = await commitTree(ctx, lab.id, tree, [tip], message, author);
    if (!(await swap(ctx, lab.id, ref, id, tip, `revert: Revert "${subject}"`, author))) return moved(ctx);
    return finish(ctx, { id, reverted: commit }, porcelain,
      `Git made card ${short(id)}, which takes back what ${short(commit)} changed. The old card stays.`);
  });
}

// Move a note back (or anywhere). Cards after it stay in the diary.
export function reset(lab, note, commit, author = SYSTEM) {
  return onLab(lab.id, async () => {
    const ctx = op();
    if (!(await isCard(lab.id, commit))) return finish(ctx, { refused: "That card isn't in your lab's cards." }, '', '');
    if (lab.merging[note]) return holding(ctx);
    const ref = refOf(note);
    const tip = await tipOf(ctx, lab.id, ref);
    if (!tip) return moved(ctx);
    if (!(await swap(ctx, lab.id, ref, commit, tip, `reset: moving to ${short(commit)}`, author))) return moved(ctx);
    return finish(ctx, { id: commit, from: tip }, `git reset --hard ${short(commit)}`,
      `${note} now points to ${short(commit)}. Nothing was deleted: the diary remembers where it was.`);
  });
}

// The safety diary: every place the note has been, newest first.
export function reflog(lab, note) {
  return onLab(lab.id, async () => {
    const ctx = op();
    const ref = refOf(note);
    if (!(await tipOf(null, lab.id, ref))) return finish(ctx, { note, entries: [] }, '', '');
    const r = await run(ctx, lab.id, ['reflog', 'show', '--date=unix', '--format=%H%x00%gd%x00%gs', ref]);
    const entries = lines(r.out).map((line) => {
      const [id, selector, message] = line.split('\0');
      return { id, time: Number(/@\{(\d+)\}/.exec(selector)?.[1]), message: message.replace(/^clone: from .*/, 'clone: from the Wall') };
    });
    return finish(ctx, { note, entries }, `git reflog ${note}`, `Every place ${note} has been, newest first. Git keeps it locally.`);
  });
}

// ---------- Rewriting history ----------

// One new card with main's monster after Start, then force the Wall onto it.
export function squashForcePush(lab, author) {
  return onLabAndWall(lab.id, async () => {
    const ctx = op();
    if (lab.merging.main) return holding(ctx);
    const ref = 'refs/heads/main';
    const tip = await tipOf(ctx, lab.id, ref);
    const start = lines((await run(ctx, lab.id, ['rev-list', '--max-parents=0', ref])).out).at(-1);
    // Pressed twice (or by two people at once): the Wall is already Start ← this one card.
    const parents = (await run(ctx, lab.id, ['rev-list', '--parents', '-n', '1', tip])).out.trim().split(' ').slice(1);
    if (parents.join() === start && (await tipOf(ctx, 'wall', ref)) === tip) {
      return finish(ctx, { already: true, id: tip }, 'git push --force', 'The Wall already has one clean card. Nothing to replace.');
    }
    const tree = (await run(ctx, lab.id, ['rev-parse', `${tip}^{tree}`])).out.trim();
    const id = await commitTree(ctx, lab.id, tree, [start], CLEAN, author);
    // Like `git reset --soft <Start>` then `git commit`: two lines in the diary.
    if (!(await swap(ctx, lab.id, ref, start, tip, `reset: moving to ${short(start)}`, author))) return moved(ctx);
    if (!(await swap(ctx, lab.id, ref, id, start, `commit: ${CLEAN}`, author))) return moved(ctx);
    const sent = await pushIn(ctx, lab, true);
    return finish(ctx, { ...sent, id, start }, `git reset --soft ${short(start)}\ngit commit -m "${CLEAN}"\ngit push --force`,
      `Git made one new card, ${short(id)}, right after Start. \`git push --force\` moved the Wall onto it.`);
  });
}

// The Intern's "tiny style fix" lands on the Wall: FACE → mustache. Once.
export function wallSabotage() {
  return onWall(async () => {
    const ctx = op();
    const tip = await tipOf(ctx, 'wall', 'refs/heads/main');
    const monster = await monsterAt(ctx, 'wall', tip);
    if (monster.face === 'mustache') return finish(ctx, { nothing: true }, '', 'The mustache is already on the Wall.');
    const id = await writeCard(ctx, 'wall', { ...monster, face: 'mustache' }, [tip], SABOTAGE, INTERN);
    if (!(await swap(ctx, 'wall', 'refs/heads/main', id, tip, null, INTERN))) return moved(ctx);
    return finish(ctx, { id }, `git commit -am "${SABOTAGE}"\ngit push`,
      `The Intern added card ${short(id)} to the Wall: FACE → mustache.`);
  });
}

// Empty the Wall's bin: cards no note points to are deleted for good. The bare Wall keeps no reflog.
export function gcWall() {
  return onWall(async () => {
    const ctx = op();
    const bin = async () => lines((await run(ctx, 'wall', ['fsck', '--unreachable', '--no-reflogs'])).out)
      .filter((l) => l.startsWith('unreachable commit')).length;
    const before = await bin();
    await run(ctx, 'wall', ['gc', '--prune=now', '--quiet']);
    const after = await bin();
    touch('wall');
    return finish(ctx, { before, after }, 'git gc --prune=now',
      `\`git gc\` deleted ${before} ${before === 1 ? 'card' : 'cards'} that no sticky note pointed to.`);
  });
}

// ---------- Reading ----------

// Each commit's monster in one call: `git cat-file --batch` with "<id>:monster.txt" lines.
async function monstersOf(repo, ids) {
  const input = ids.map((id) => `${id}:monster.txt\n`).join('');
  const r = await git(repo, ['cat-file', '--batch'], { input, buffer: true });
  if (r.code !== 0) throw new Error(`git cat-file failed: ${r.err.trim()}`);
  const monsters = new Map();
  let at = 0;
  for (const id of ids) {
    const nl = r.out.indexOf(10, at);
    const [, type, size] = r.out.toString('utf8', at, nl).split(' ');
    at = nl + 1;
    if (type !== 'blob') continue; // "<id>:monster.txt missing"
    monsters.set(id, parse(r.out.toString('utf8', at, at + Number(size))));
    at += Number(size) + 1;
  }
  return monsters;
}

const cache = new Map(); // repo → {v, graph}

async function readGraph(repo) {
  const refsOut = await run(null, repo, ['for-each-ref', '--format=%(refname)%00%(objectname)', 'refs/heads', 'refs/remotes/wall/main']);
  const refs = Object.fromEntries(lines(refsOut.out).map((l) => l.split('\0')));
  const scope = repo === 'wall' ? ['--all'] : ['--all', '--reflog'];
  const log = await run(null, repo, ['log', ...scope, '--topo-order', '--format=%H%x00%P%x00%an%x00%at%x00%s']);
  const commits = lines(log.out).map((line) => {
    const [id, parents, author, at, message] = line.split('\0');
    return { id, parents: parents ? parents.split(' ') : [], author, time: Number(at), message };
  });
  const monsters = await monstersOf(repo, commits.map((c) => c.id));
  const byId = new Map(commits.map((c) => [c.id, c]));
  const reachable = new Set();
  const todo = Object.values(refs);
  while (todo.length) {
    const id = todo.pop();
    if (reachable.has(id) || !byId.has(id)) continue;
    reachable.add(id);
    todo.push(...byId.get(id).parents);
  }
  for (const c of commits) Object.assign(c, { monster: monsters.get(c.id) ?? null, reachable: reachable.has(c.id) });
  return { refs, commits };
}

// The cards and sticky notes of a repo ('wall' or a lab id): {refs: {refname: id}, commits: [...]}.
// Labs include diary-only cards (reachable: false). Cached until a git op moves a ref.
export async function graph(repo) {
  const hit = cache.get(repo);
  if (hit && hit.v === (versions.get(repo) ?? 0)) return hit.graph;
  return onRepo(repo, async () => {
    const v = versions.get(repo) ?? 0;
    if (cache.get(repo)?.v !== v) cache.set(repo, { v, graph: await readGraph(repo) });
    return cache.get(repo).graph;
  });
}

// What Git stored for a card: the commit object and its monster.txt.
export function inspect(repo, commit) {
  return onRepo(repo, async () => {
    const ctx = op();
    if (!(await isCard(repo, commit))) {
      return finish(ctx, { refused: repo === 'wall' ? "That card isn't on the Wall." : "That card isn't in your lab's cards." }, '', '');
    }
    const raw = (await run(ctx, repo, ['cat-file', '-p', commit])).out;
    const text = (await run(ctx, repo, ['cat-file', '-p', `${commit}:monster.txt`])).out;
    return finish(ctx, { id: commit, raw, text, monster: parse(text) }, `git cat-file -p ${short(commit)}`,
      'The card as Git stored it: the tree (the monster), the parent card(s), the author and the time.');
  });
}

// Who first added part=value to a repo's main? Follows parent links, never timestamps.
async function firstWith(ctx, repo, part, value) {
  const r = await run(ctx, repo, ['rev-list', '--reverse', '--topo-order', '--no-commit-header',
    '--format=%H%x00%P%x00%an%x00%ae%x00%s', 'refs/heads/main']);
  const cards = lines(r.out).map((line) => {
    const [id, parents, author, email, message] = line.split('\0');
    return { id, parents: parents ? parents.split(' ') : [], author, email, message };
  });
  const monsters = await monstersOf(repo, cards.map((c) => c.id));
  const has = (id) => monsters.get(id)?.[part] === value;
  const card = cards.find((c) => has(c.id) && !c.parents.some(has));
  if (!card) return null;
  const pid = card.email.endsWith('@monster.lab') ? card.email.slice(0, -'@monster.lab'.length) : null;
  return { id: card.id, short: short(card.id), author: card.author, pid, clean: card.message === CLEAN };
}

// Audit the Wall and every lab. null = not found.
export async function audit(part, value) {
  const ctx = op();
  if (!PARTS.includes(part) || !/^[a-z]{1,20}$/.test(value)) throw new Error(`Bad audit: ${part}=${value}`);
  const wall = await onWall(() => firstWith(ctx, 'wall', part, value));
  const labs = {};
  for (const id of labIds()) labs[id] = await onLab(id, () => firstWith(ctx, id, part, value));
  return finish(ctx, { part, value, wall, labs }, `git log --reverse --format="%h %an" main`,
    `For each copy, Git walked main's history from Start. The first card with ${P(part)}: ${value} names its author.`);
}
