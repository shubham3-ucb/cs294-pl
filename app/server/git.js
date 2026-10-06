// The Git engine. Every save, merge, send and undo runs real Git plumbing here, on real repos:
// DATA_DIR/wall.git (bare, "like GitHub") and DATA_DIR/labs/<id> (one repo per lab, no worktree).
// Each operation returns { ...result, commands: [{cmd, out, code}], porcelain, explain }:
// the plumbing it ran, what you would type in your own copy, and one plain explanation.
// Reflog messages use Git's own wording, so the safety diary matches a real `git reflog`.
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FILE, PARTS, START, describeChange, isMonster, merge3, parse, serialize } from './monster.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const LABS = path.join(DATA_DIR, 'labs');
const WALL_URL = '../../wall.git'; // relative to a lab repo, so DATA_DIR can move
const START_TIME = Date.parse('2026-10-01T00:00:00Z'); // in the past: no card is older than its parent
const DOMAIN = 'outfit.lab';
const SYSTEM = { pid: 'lab', name: 'Outfit Lab' };
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

// Author and committer are always explicit: name, <pid>@outfit.lab, and the time.
function identity(who = SYSTEM, time = Date.now()) {
  const name = String(who.name).replace(/[\x00-\x1f\x7f<>]/g, ' ').trim() || 'Someone';
  const email = `${/^[\w-]{1,40}$/.test(who.pid) ? who.pid : 'someone'}@${DOMAIN}`;
  const date = `@${Math.floor(time / 1000)} +0000`;
  return {
    GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_COMMITTER_DATE: date,
  };
}

// Run git in a repo ('wall', a lab id, or an absolute dir). Resolves with the exit code; never throws on exit codes.
// Git never looks above DATA_DIR for a repo: a lab dir broken by a kill mid-clone fails instead of
// acting on whatever repo DATA_DIR sits in (./data inside the project's own checkout).
export function git(repo, args, { input, env, buffer = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile('git', args, {
      cwd: dirOf(repo),
      encoding: buffer ? 'buffer' : 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        PATH: process.env.PATH, LC_ALL: 'C', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
        GIT_TERMINAL_PROMPT: '0', GIT_CEILING_DIRECTORIES: DATA_DIR, ...identity(), ...env,
      },
    }, (err, out, stderr) => {
      if (err && typeof err.code !== 'number') reject(err);
      else resolve({ code: err ? err.code : 0, out, err: String(stderr) });
    });
    child.stdin.on('error', () => {}); // git may exit before reading its input
    child.stdin.end(input ?? '');
  });
}

// How a command reads in "Show the low-level steps": runnable in a shell, input and shown variables included.
// "Merge branch 'superhero'" reads better in double quotes than as 'Merge branch '\''superhero'\'''.
const quote = (a) => {
  if (/^[\w@%^{}:/.,=+-]+$/.test(a)) return a;
  if (a.includes("'") && !/["$`\\!]/.test(a)) return `"${a}"`;
  return `'${a.replace(/'/g, `'\\''`)}'`;
};
function shown(args, input, vars = {}) {
  const cmd = [...Object.entries(vars).map(([k, val]) => `${k}=${quote(val)}`), 'git', ...args.map(quote)].join(' ');
  return input === undefined ? cmd : `printf ${quote(input.replace(/\t/g, '\\t').replace(/\n/g, '\\n'))} | ${cmd}`;
}

// Run one step of an operation: record it in ctx (when given) and throw on unexpected exit codes.
// The error keeps git's stderr, so a stale lock reads as "Unable to create '...lock'" (the server says "Busy").
// show: environment variables worth seeing in the recorded command (a replayed card's kept author).
async function run(ctx, repo, args, { ok = [0], show, ...opts } = {}) {
  const r = await git(repo, args, opts);
  ctx?.commands.push({
    cmd: shown(args, opts.input, show),
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
  return parse((await run(ctx, repo, ['cat-file', '-p', `${id}:${FILE}`])).out);
}

const treeOf = async (ctx, repo, id) => (await run(ctx, repo, ['rev-parse', `${id}^{tree}`])).out.trim();

// author: {name, email, date} kept from another card (a replay); otherwise who made it now is the author too.
async function commitTree(ctx, repo, tree, parents, message, who, time, author = null) {
  const kept = author ? { GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email, GIT_AUTHOR_DATE: author.date } : undefined;
  const args = ['commit-tree', tree, ...parents.flatMap((p) => ['-p', p]), ...message.split('\n\n').flatMap((m) => ['-m', m])];
  return (await run(ctx, repo, args, { env: { ...identity(who, time), ...kept }, show: kept })).out.trim();
}

// outfit.txt → blob → tree.
async function writeTree(ctx, repo, monster) {
  const blob = (await run(ctx, repo, ['hash-object', '-w', '--stdin'], { input: serialize(monster) })).out.trim();
  return (await run(ctx, repo, ['mktree'], { input: `100644 blob ${blob}\t${FILE}\n` })).out.trim();
}

const writeCard = async (ctx, repo, monster, parents, message, who, time) =>
  commitTree(ctx, repo, await writeTree(ctx, repo, monster), parents, message, who, time);

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

// Full refnames everywhere. Note names were validated when the branch was made; check again here.
function refOf(note) {
  if (note === 'wall/main') return 'refs/remotes/wall/main';
  if (!NOTE.test(note)) throw new Error(`Bad note name: ${note}`);
  return `refs/heads/${note}`;
}

const moved = (ctx) => finish(ctx, { moved: true }, '', 'Someone moved this branch meanwhile. Nothing changed.');

// An open merge holds its branch: nothing else moves it until someone finishes or cancels.
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

// ---------- Saving and branches ----------

// Save the branch's unsaved parts as a new card. Parts edited during the save stay unsaved.
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
      `Git stored card ${short(id)}, pointing back to ${short(tip)}, and moved ${note} to it.`);
  });
}

// A new branch on main's card. Nothing is copied: a note is a tiny file holding one ID.
export function createBranch(lab, name, author = SYSTEM) {
  return onLab(lab.id, async () => {
    const ctx = op();
    if (!NOTE.test(name) || name === 'wall') return finish(ctx, { refused: 'Use a–z, 0–9 and dashes, up to 20.' }, '', '');
    const main = await tipOf(ctx, lab.id, 'refs/heads/main');
    if (!(await swap(ctx, lab.id, refOf(name), main, null, 'branch: Created from main', author))) {
      return finish(ctx, { exists: true }, '', `${name} already exists.`);
    }
    return finish(ctx, { id: main, name }, `git switch -c ${name} main`,
      `Git wrote branch ${name} on card ${short(main)}; nothing was copied.`);
  });
}

// Delete a branch, as `git branch -d`: only when its card is already in the current branch's history,
// and never the branch you are on. The cards stay; Git deletes the branch's file and its reflog.
export function deleteBranch(lab, note, current) {
  return onLab(lab.id, async () => {
    const ctx = op();
    const porcelain = `git branch -d ${note}`;
    if (note === current) return finish(ctx, { current: true }, porcelain, `You are on ${note}. Git never deletes the branch you are on.`);
    if (lab.merging[note]) return holding(ctx);
    const ref = refOf(note);
    const tip = await tipOf(ctx, lab.id, ref);
    const head = await tipOf(ctx, lab.id, refOf(current));
    if (!tip || !head) return moved(ctx);
    if (!(await isAncestor(ctx, lab.id, tip, head))) {
      return finish(ctx, { unmerged: true, id: tip }, porcelain, `${note} has cards ${current} doesn't. Git refuses: deleting it could lose them.`);
    }
    const r = await run(ctx, lab.id, ['update-ref', '-d', ref, tip], { ok: [0, 1] });
    if (r.code !== 0) {
      if (/but expected|unable to resolve reference/.test(r.err)) return moved(ctx);
      throw new Error(`git update-ref failed: ${r.err.trim()}`);
    }
    touch(lab.id);
    return finish(ctx, { deleted: note, id: tip }, porcelain,
      `Deleted branch ${note} (was ${short(tip)}). Its cards stay, and no card records that it was made on ${note}.`);
  });
}

// ---------- Merging ----------

const nameOf = (note) => (note === 'wall/main' ? 'the Wall' : note);

// Git's own default merge messages.
function mergeMessage(into, from) {
  if (from === 'wall/main') return "Merge remote-tracking branch 'wall/main'";
  return into === 'main' ? `Merge branch '${from}'` : `Merge branch '${from}' into ${into}`;
}

// Open a merge on the lab (shared by everyone on the branch) and say which parts need a person.
// intoTip is where the branch stays until someone finishes; oursId is the side being built on (a replay's new base).
async function openMerge(ctx, lab, note, { kind, from, intoTip, oursId = intoTip, theirs, baseId, tree, message, who, more = {} }) {
  const conflictedText = (await run(ctx, lab.id, ['cat-file', '-p', `${tree}:${FILE}`])).out;
  const base = await monsterAt(ctx, lab.id, baseId);
  const ours = await monsterAt(ctx, lab.id, oursId);
  const theirsMonster = await monsterAt(ctx, lab.id, theirs);
  const { auto, conflicts } = merge3(base, ours, theirsMonster);
  lab.merging[note] = {
    kind, from, intoTip, theirs, base, ours, theirsMonster, auto, conflicts, conflictedText, message,
    startedBy: who.name, t: Date.now(), ...more,
  };
  return { conflict: true, conflicts, auto, base: baseId };
}

// Merge `from` (a note or 'wall/main') into `into`. The diary line is Git's: "merge <from>: ...".
async function mergeIn(ctx, lab, into, from, who) {
  const verb = `merge ${from}`;
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
  // Short names, so the conflict markers read "<<<<<<< main" and ">>>>>>> sporty".
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
  if (r.moved) return 'Someone moved this branch meanwhile. Nothing changed.';
  if (r.nothing) return `${into} already has every card of ${nameOf(from)}. Nothing to do.`;
  if (r.fastForward) {
    return `Git slid ${into} forward to ${short(r.id)}: a fast-forward, so no new card. Every card on ${into} was already in ${nameOf(from)}.`;
  }
  if (r.merged) return `Git made merge card ${short(r.id)} alone: no part changed on both sides.`;
  return `${list(r.conflicts)} changed on both sides since card ${short(r.base)}, so you pick.`;
}

export function merge(lab, into, from, author) {
  return onLab(lab.id, async () => {
    const ctx = op();
    const r = await mergeIn(ctx, lab, into, from, author);
    return finish(ctx, r, `git merge ${from}`, mergeExplain(r, into, from));
  });
}

// Finish an open merge (or undo, or replay) with the outfit people chose.
export function resolve(lab, note, monster, author) {
  return onLab(lab.id, async () => {
    const ctx = op();
    const open = lab.merging[note];
    if (!open) return finish(ctx, { refused: 'There is no merge to finish.' }, '', '');
    if (!isMonster(monster)) return finish(ctx, { refused: 'Pick a value for every part.' }, '', '');
    if (open.kind === 'rebase') return continueRebase(ctx, lab, note, open, monster, author);
    const merging = open.kind === 'merge';
    const parents = merging ? [open.intoTip, open.theirs] : [open.intoTip];
    const subject = open.message.split('\n')[0];
    const id = await writeCard(ctx, lab.id, monster, parents, open.message, author);
    const reason = merging ? `commit (merge): ${subject}` : `revert: ${subject}`;
    if (!(await swap(ctx, lab.id, refOf(note), id, open.intoTip, reason, author))) return moved(ctx);
    delete lab.merging[note];
    const explain = merging
      ? `Git made merge card ${short(id)} with two parents: ${note} and ${nameOf(open.from)}.`
      : `Git made fix card ${short(id)}; the old card stays in the history.`;
    return finish(ctx, { id, parents, monster }, `git add ${FILE}\n${merging ? 'git commit' : 'git revert --continue'}`, explain);
  });
}

// Cancel an open merge. No card was made, so the branch stays where it was.
export function abort(lab, note) {
  return onLab(lab.id, async () => {
    const ctx = op();
    const open = lab.merging[note];
    if (!open) return finish(ctx, { nothing: true }, '', 'There is no merge to cancel.');
    delete lab.merging[note];
    return finish(ctx, { kind: open.kind }, `git ${open.kind} --abort`, `Cancelled. ${note} is where it was, at ${short(open.intoTip)}.`);
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
  if (r.rejected) return "The Wall's main has a card your main doesn't. Moving the Wall would drop it, so Git refuses.";
  if (r.already) return `The Wall already has card ${short(r.id)}. Nothing to send.`;
  if (r.forced) return `The Wall's main was forced to ${short(r.id)}. Its old cards have no branch now.`;
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
    const r = await mergeIn(ctx, lab, 'main', 'wall/main', author);
    return finish(ctx, r, 'git fetch wall\ngit merge wall/main', pullExplain(r));
  });
}

function pullExplain(r) {
  if (r.nothing) return 'Git fetched from the Wall. Nothing new: main has every card already.';
  if (r.merged) return `Git fetched the Wall's cards, then made merge card ${short(r.id)} with two parents.`;
  if (r.fastForward) return `Git fetched the Wall's cards, then slid main forward to ${short(r.id)}.`;
  if (r.conflict) return `Git fetched the Wall's cards; ${list(r.conflicts)} changed on both sides, so you pick.`;
  return mergeExplain(r, 'main', 'wall/main');
}

// ---------- Replay on top: git pull --rebase ----------

// What a replay needs from a card: its first parent, its author as Git stored it, its message.
async function cardOf(ctx, repo, id) {
  const out = (await run(ctx, repo, ['log', '-1', '--date=raw', '--format=%P%x00%an%x00%ae%x00%ad%x00%B', id])).out;
  const [parents, name, email, date, message] = out.split('\0');
  return { parent: parents.split(' ')[0], author: { name, email, date }, message: message.replace(/\n+$/, '') };
}

const shortName = async (ctx, repo, id) => (await run(ctx, repo, ['rev-parse', '--short', id])).out.trim();

// Like `git rebase`: apply each card's change (a 3-way merge against its parent, as cherry-pick does) on top
// of onto, and write a new card with the same author, author date and message, committed by who, now.
// A change that is already there is dropped. main moves once, at the end; a conflict stops the replay and
// waits for a person (resolve continues it). The reflog line is Git's: "<verb> (finish): refs/heads/main onto <id>".
async function replay(ctx, lab, { intoTip, upstream, onto, todo, replaced, dropped }, who, verb) {
  for (const [i, id] of todo.entries()) {
    const card = await cardOf(ctx, lab.id, id);
    const ours = onto === upstream ? 'wall/main' : await shortName(ctx, lab.id, onto);
    const mt = await run(ctx, lab.id, ['merge-tree', '--write-tree', `--merge-base=${card.parent}`, ours, await shortName(ctx, lab.id, id)], { ok: [0, 1] });
    const tree = lines(mt.out)[0];
    if (mt.code === 1) {
      return openMerge(ctx, lab, 'main', {
        kind: 'rebase', from: 'wall/main', intoTip, oursId: onto, theirs: id, baseId: card.parent, tree, message: card.message, who,
        more: { upstream, onto, todo: todo.slice(i + 1), replaced, dropped, author: card.author },
      });
    }
    if (tree === await treeOf(ctx, lab.id, onto)) {
      dropped.push(id);
      continue;
    }
    const next = await commitTree(ctx, lab.id, tree, [onto], card.message, who, undefined, card.author);
    replaced.push({ from: id, to: next });
    onto = next;
  }
  if (!(await swap(ctx, lab.id, 'refs/heads/main', onto, intoTip, `${verb} (finish): refs/heads/main onto ${upstream}`, who))) return { moved: true };
  return { rebased: true, id: onto, replaced, dropped };
}

// Replay on top: fetch the Wall's cards, then copy main's own cards onto wall/main. As `git rebase` does,
// merge cards are left out, and so is a card whose change (patch) the Wall already has.
// Behind: a fast-forward. Nothing new: nothing.
export function rebase(lab, author) {
  return onLab(lab.id, async () => {
    const ctx = op();
    if (lab.merging.main) return holding(ctx);
    await onWall(() => run(ctx, lab.id, ['fetch', 'wall']));
    touch(lab.id);
    const intoTip = await tipOf(ctx, lab.id, 'refs/heads/main');
    const upstream = await tipOf(ctx, lab.id, 'refs/remotes/wall/main');
    const done = (r) => finish(ctx, r, 'git pull --rebase', rebaseExplain(r));
    if (await isAncestor(ctx, lab.id, upstream, intoTip)) return done({ nothing: true, id: intoTip });
    if (await isAncestor(ctx, lab.id, intoTip, upstream)) {
      if (!(await swap(ctx, lab.id, 'refs/heads/main', upstream, intoTip, 'pull --rebase: Fast-forward', author))) return moved(ctx);
      return done({ fastForward: true, id: upstream, from: intoTip });
    }
    const list = async (...args) => lines((await run(ctx, lab.id, ['rev-list', '--reverse', '--topo-order', '--no-merges', ...args])).out);
    const mine = await list(`${upstream}..${intoTip}`);
    const todo = await list('--right-only', '--cherry-pick', `${upstream}...${intoTip}`);
    const dropped = mine.filter((id) => !todo.includes(id));
    const r = await replay(ctx, lab, { intoTip, upstream, onto: upstream, todo, replaced: [], dropped }, author, 'pull --rebase');
    return r.moved ? moved(ctx) : done(r);
  });
}

// Finish the card a replay stopped at, with the outfit people chose, then replay the rest (`git rebase --continue`).
async function continueRebase(ctx, lab, note, open, monster, who) {
  const { intoTip, upstream, onto, todo } = open;
  const replaced = [...open.replaced];
  const dropped = [...open.dropped];
  const tree = await writeTree(ctx, lab.id, monster);
  let next = onto;
  if (tree === await treeOf(ctx, lab.id, onto)) dropped.push(open.theirs);
  else {
    next = await commitTree(ctx, lab.id, tree, [onto], open.message, who, undefined, open.author);
    replaced.push({ from: open.theirs, to: next });
  }
  delete lab.merging[note];
  const r = await replay(ctx, lab, { intoTip, upstream, onto: next, todo, replaced, dropped }, who, 'rebase');
  if (r.moved) return moved(ctx);
  return finish(ctx, r, `git add ${FILE}\ngit rebase --continue`, rebaseExplain(r));
}

function rebaseExplain(r) {
  if (r.nothing) return 'Git fetched from the Wall. Nothing new: main has every card already.';
  if (r.fastForward) return `Git fetched the Wall's cards, then slid main forward to ${short(r.id)}. Nothing to replay.`;
  if (r.conflict) return `${list(r.conflicts)} changed on the Wall too, so you pick. Then Git replays the rest.`;
  const copies = r.replaced.map(({ from, to }) => `${short(from)} is now ${short(to)}`);
  const gone = r.dropped.length ? ` ${r.dropped.map(short).join(', ')}: already on the Wall, so dropped.` : '';
  if (!copies.length) return `Git fetched the Wall's cards. Your changes were already there.${gone}`;
  return `Git copied your ${copies.length === 1 ? 'card' : 'cards'} on top of the Wall's: ${copies.join(', ')}. `
    + `Same author and author time; a new parent (so a new snapshot) and committer time, so a new ID. The old ${copies.length === 1 ? 'card is' : 'cards are'} only in your safety diary (reflog).${gone}`;
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
    if (tree === await treeOf(ctx, lab.id, tip)) {
      return finish(ctx, { nothing: true }, porcelain, `Nothing to undo: ${note} already looks like the card before ${short(commit)}.`);
    }
    const id = await commitTree(ctx, lab.id, tree, [tip], message, author);
    if (!(await swap(ctx, lab.id, ref, id, tip, `revert: Revert "${subject}"`, author))) return moved(ctx);
    return finish(ctx, { id, reverted: commit }, porcelain,
      `Git added fix card ${short(id)}; card ${short(commit)} stays in the history.`);
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
      `${note} now points to ${short(commit)}; the diary still lists where it was.`);
  });
}

// The safety diary: every place the branch has been, newest first.
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

// One new card with main's outfit after Start, then force the Wall onto it.
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
    const id = await commitTree(ctx, lab.id, await treeOf(ctx, lab.id, tip), [start], CLEAN, author);
    // Like `git reset --soft <Start>` then `git commit`: two lines in the diary.
    if (!(await swap(ctx, lab.id, ref, start, tip, `reset: moving to ${short(start)}`, author))) return moved(ctx);
    if (!(await swap(ctx, lab.id, ref, id, start, `commit: ${CLEAN}`, author))) return moved(ctx);
    const sent = await pushIn(ctx, lab, true);
    return finish(ctx, { ...sent, id, start }, `git reset --soft ${short(start)}\ngit commit -m "${CLEAN}"\ngit push --force`,
      `Git made one new card, ${short(id)}, after Start, and forced the Wall onto it.`);
  });
}

// The Intern's "tiny style fix" lands on the Wall: one part changes. Once.
export function wallSabotage({ part, value }) {
  return onWall(async () => {
    const ctx = op();
    const tip = await tipOf(ctx, 'wall', 'refs/heads/main');
    const monster = await monsterAt(ctx, 'wall', tip);
    if (monster[part] === value) return finish(ctx, { nothing: true }, '', `The Wall already has ${P(part)}: ${value}.`);
    const id = await writeCard(ctx, 'wall', { ...monster, [part]: value }, [tip], SABOTAGE, INTERN);
    if (!(await swap(ctx, 'wall', 'refs/heads/main', id, tip, null, INTERN))) return moved(ctx);
    return finish(ctx, { id }, `git commit -am "${SABOTAGE}"\ngit push`,
      `The Intern added card ${short(id)} to the Wall: ${P(part)} → ${value}.`);
  });
}

// Empty the Wall's bin: cards no note leads to are deleted for good. The bare Wall keeps no reflog.
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
      `\`git gc --prune=now\` deleted ${before} ${before === 1 ? 'card' : 'cards'} that no branch leads to.`);
  });
}

// ---------- Reading ----------

// Each commit's outfit in one call: `git cat-file --batch` with "<id>:outfit.txt" lines.
async function monstersOf(repo, ids) {
  const input = ids.map((id) => `${id}:${FILE}\n`).join('');
  const r = await git(repo, ['cat-file', '--batch'], { input, buffer: true });
  if (r.code !== 0) throw new Error(`git cat-file failed: ${r.err.trim()}`);
  const monsters = new Map();
  let at = 0;
  for (const id of ids) {
    const nl = r.out.indexOf(10, at);
    const [, type, size] = r.out.toString('utf8', at, nl).split(' ');
    at = nl + 1;
    if (type !== 'blob') continue; // "<id>:outfit.txt missing"
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
  const log = await run(null, repo, ['log', ...scope, '--topo-order', '--format=%H%x00%P%x00%an%x00%at%x00%cn%x00%ct%x00%s']);
  const commits = lines(log.out).map((line) => {
    const [id, parents, author, at, committer, ct, message] = line.split('\0');
    return { id, parents: parents ? parents.split(' ') : [], author, time: Number(at), committer, committerTime: Number(ct), message };
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

// The cards and branches of a repo ('wall' or a lab id): {refs: {refname: id}, commits: [...]}.
// A commit: {id, parents, author, time (author date), committer, committerTime, message, monster, reachable}.
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

// When this lab's sends moved the Wall: the "update by push" lines of its wall/main reflog, oldest first.
// Git writes them when a push succeeds, with the time; the bare Wall itself keeps no reflog.
export function pushes(labId) {
  return onLab(labId, async () => {
    const r = await run(null, labId, ['reflog', 'show', '--date=unix', '--format=%H%x00%gd%x00%gs', 'refs/remotes/wall/main']);
    return lines(r.out).map((line) => line.split('\0'))
      .filter(([, , message]) => message === 'update by push')
      .map(([id, selector]) => ({ id, time: Number(/@\{(\d+)\}/.exec(selector)[1]) }))
      .reverse();
  });
}

// What Git stored for a card: the commit object and its outfit.txt.
export function inspect(repo, commit) {
  return onRepo(repo, async () => {
    const ctx = op();
    if (!(await isCard(repo, commit))) {
      return finish(ctx, { refused: repo === 'wall' ? "That card isn't on the Wall." : "That card isn't in your lab's cards." }, '', '');
    }
    const raw = (await run(ctx, repo, ['cat-file', '-p', commit])).out;
    const text = (await run(ctx, repo, ['cat-file', '-p', `${commit}:${FILE}`])).out;
    return finish(ctx, { id: commit, raw, text, monster: parse(text) }, `git cat-file -p ${short(commit)}`,
      'The card as Git stored it: the tree (the outfit), the parent card(s), the author and the time.');
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
  const pid = card.email.endsWith(`@${DOMAIN}`) ? card.email.slice(0, -DOMAIN.length - 1) : null;
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
