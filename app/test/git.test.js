// Unit tests for the git engine (server/git.js) and monster.txt helpers (server/monster.js).
// Every test runs real git in a private temp DATA_DIR.
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'monster-lab-test-'));
process.env.DATA_DIR = DATA;
const git = await import('../server/git.js');
const M = await import('../server/monster.js');

after(() => fs.rmSync(DATA, { recursive: true, force: true }));

// ---------- Helpers ----------

const ENV = { PATH: process.env.PATH, LC_ALL: 'C', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const dir = (repo) => (repo === 'wall' ? path.join(DATA, 'wall.git') : path.join(DATA, 'labs', repo));
// Plain git, outside the engine, to check what the engine left on disk.
const sh = (repo, ...args) => execFileSync('git', args, { cwd: dir(repo), env: ENV, encoding: 'utf8' }).trim();
const fails = (repo, ...args) => {
  try {
    execFileSync('git', args, { cwd: dir(repo), env: ENV, stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
};

const who = (name) => ({ pid: name.toLowerCase(), name });
const PRIYA = who('Priya');
const RAJ = who('Raj');
const ANA = who('Ana');

const newLab = (id) => ({ id: String(id), drafts: { main: {} }, merging: {} });

async function fresh(count = 3) {
  fs.rmSync(path.join(DATA, 'wall.git'), { recursive: true, force: true });
  fs.rmSync(path.join(DATA, 'labs'), { recursive: true, force: true });
  await git.initWall();
  const labs = [];
  for (let n = 1; n <= count; n++) {
    await git.cloneLab(String(n));
    labs.push(newLab(n));
  }
  return labs;
}

async function save(lab, note, parts, author = PRIYA) {
  lab.drafts[note] = { ...parts };
  return git.commit(lab, note, author);
}

const tip = async (repo, note = 'main') => (await git.graph(repo)).refs[`refs/heads/${note}`];
const card = async (repo, id) => (await git.graph(repo)).commits.find((c) => c.id === id);
const monsterOf = async (repo, note = 'main') => (await card(repo, await tip(repo, note))).monster;
const diary = (repo, note = 'main') => sh(repo, 'reflog', 'show', '--format=%gs', `refs/heads/${note}`).split('\n');

// Git's own view of a conflicted monster.txt: lines outside markers were combined by Git;
// a part is conflicted when its line differs between the two sides of a marker block.
function gitView(text) {
  const auto = {};
  const conflicted = new Set();
  let side = null;
  let sides = { ours: {}, theirs: {} };
  for (const line of text.split('\n')) {
    if (line.startsWith('<<<<<<< ')) side = 'ours';
    else if (line === '=======') side = 'theirs';
    else if (line.startsWith('>>>>>>> ')) {
      for (const part of M.PARTS) {
        if (!(part in sides.ours) && !(part in sides.theirs)) continue;
        if (sides.ours[part] === sides.theirs[part]) auto[part] = sides.ours[part];
        else conflicted.add(part);
      }
      side = null;
      sides = { ours: {}, theirs: {} };
    } else {
      const m = /^(face|body|legs): ([a-z]+)$/.exec(line);
      if (m) (side ? sides[side] : auto)[m[1]] = m[2];
    }
  }
  return { auto, conflicts: M.PARTS.filter((p) => conflicted.has(p)) };
}

// Steps 1–3 for one lab: two sticky notes from main, each with its pair's mission saved.
async function twoIdeas(lab) {
  await git.createBranch(lab, 'cat-robot');
  await git.createBranch(lab, 'superhero');
  await save(lab, 'cat-robot', { face: 'cat', body: 'robot' }, PRIYA);
  await save(lab, 'superhero', { body: 'superhero', legs: 'tentacles' }, RAJ);
}

// ---------- monster.js ----------

describe('monster.txt', () => {
  test('serialize writes the three parts with --- lines between them', () => {
    assert.equal(M.serialize(M.START), 'face: smiley\n---\nbody: box\n---\nlegs: sticks\n');
  });

  test('parse reads what serialize writes', () => {
    const monster = { face: 'dragon', body: 'cactus', legs: 'skates' };
    assert.deepEqual(M.parse(M.serialize(monster)), monster);
    assert.deepEqual(M.parse('face: cat\n---\nnot a part\nlegs: paws\n'), { face: 'cat', legs: 'paws' });
  });

  test('only palette slugs make a monster', () => {
    assert.equal(M.isMonster(M.START), true);
    assert.equal(M.isMonster({ ...M.START, face: 'mustache' }), true);
    for (const bad of [{ ...M.START, face: 'unicorn' }, { face: 'cat', body: 'box' }, { ...M.START, body: '__proto__' },
      { ...M.START, body: 'box\nface: cat' }, null]) {
      assert.equal(M.isMonster(bad), false, JSON.stringify(bad));
      assert.throws(() => M.serialize(bad));
    }
  });

  test('palette(step) shows mission parts only from their mission step, and never the mustache', () => {
    const has = (step, part, slug) => M.palette(step)[part].includes(slug);
    assert.deepEqual(M.palette(1), { face: ['smiley', 'frog', 'ghost', 'lion', 'monkey'], body: ['box', 'coat', 'donut', 'shell'], legs: ['sticks', 'wheels', 'duck', 'paws'] });
    for (const [part, slug] of [['face', 'cat'], ['body', 'robot'], ['body', 'superhero'], ['legs', 'tentacles']]) {
      assert.equal(has(1, part, slug), false);
      assert.equal(has(2, part, slug), true);
    }
    for (const [part, slug] of [['face', 'dragon'], ['legs', 'skates'], ['body', 'cactus'], ['face', 'alien'], ['legs', 'rocket'], ['body', 'pumpkin']]) {
      assert.equal(has(4, part, slug), false);
      assert.equal(has(5, part, slug), true);
    }
    for (let step = 0; step <= 8; step++) assert.equal(has(step, 'face', 'mustache'), false);
  });

  test('describeChange names each changed part, old → new', () => {
    assert.equal(M.describeChange(M.START, { ...M.START, face: 'cat' }), 'FACE: smiley → cat');
    assert.equal(M.describeChange(M.START, { face: 'cat', body: 'robot', legs: 'sticks' }), 'FACE: smiley → cat, BODY: box → robot');
    assert.equal(M.describeChange(M.START, M.START), '');
  });

  test('merge3 keeps one-sided changes and flags parts changed on both sides differently', () => {
    const base = M.START;
    assert.deepEqual(M.merge3(base, { ...base, face: 'cat' }, { ...base, legs: 'paws' }),
      { auto: { face: 'cat', body: 'box', legs: 'paws' }, conflicts: [] });
    assert.deepEqual(M.merge3(base, { ...base, body: 'robot' }, { ...base, body: 'robot' }),
      { auto: { face: 'smiley', body: 'robot', legs: 'sticks' }, conflicts: [] });
    assert.deepEqual(M.merge3(base, { face: 'cat', body: 'robot', legs: 'sticks' }, { face: 'smiley', body: 'superhero', legs: 'tentacles' }),
      { auto: { face: 'cat', legs: 'tentacles' }, conflicts: ['body'] });
  });
});

// The resolver's per-part view must say exactly what Git's conflict markers say, in every case.
describe('merge3 agrees with git merge-tree', () => {
  test('all 125 combinations of unchanged / ours / theirs / same on both / different on both', async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'monster-lab-merge-'));
    try {
      await git.git(repo, ['init', '-q', '-b', 'main']);
      const ids = new Map();
      const cardFor = async (monster, parents = []) => {
        const key = M.serialize(monster);
        if (!ids.has(key)) {
          const blob = (await git.git(repo, ['hash-object', '-w', '--stdin'], { input: key })).out.trim();
          const tree = (await git.git(repo, ['mktree'], { input: `100644 blob ${blob}\tmonster.txt\n` })).out.trim();
          ids.set(key, (await git.git(repo, ['commit-tree', tree, ...parents.flatMap((p) => ['-p', p]), '-m', key])).out.trim());
        }
        return ids.get(key);
      };
      const base = M.START;
      const baseId = await cardFor(base);
      const other = { face: ['cat', 'alien'], body: ['robot', 'superhero'], legs: ['tentacles', 'wheels'] };
      // Per part: [ours, theirs] as indexes into [base, A, B].
      const kinds = [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2]];
      const pick = (part, k) => (k === 0 ? base[part] : other[part][k - 1]);
      let conflicted = 0;
      for (const f of kinds) for (const b of kinds) for (const l of kinds) {
        const k = { face: f, body: b, legs: l };
        const ours = Object.fromEntries(M.PARTS.map((p) => [p, pick(p, k[p][0])]));
        const theirs = Object.fromEntries(M.PARTS.map((p) => [p, pick(p, k[p][1])]));
        const mine = M.merge3(base, ours, theirs);
        const oursId = await cardFor(ours, [baseId]);
        const theirsId = await cardFor(theirs, [baseId]);
        const mt = await git.git(repo, ['merge-tree', '--write-tree', `--merge-base=${baseId}`, oursId, theirsId]);
        const tree = mt.out.split('\n')[0];
        const text = (await git.git(repo, ['cat-file', '-p', `${tree}:monster.txt`])).out;
        const label = JSON.stringify({ ours, theirs });
        assert.equal(mt.code, mine.conflicts.length ? 1 : 0, label);
        const view = gitView(text);
        assert.deepEqual(view.conflicts, mine.conflicts, label);
        assert.deepEqual(view.auto, mine.auto, label);
        if (mine.conflicts.length) conflicted++;
      }
      assert.equal(conflicted, 125 - 4 ** 3); // a part conflicts only when both sides changed it differently
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});

// ---------- Session init ----------

describe('session init', () => {
  test('every lab and the Wall start on the same Start card, in every session', async () => {
    await fresh(3);
    const start = await tip('wall');
    assert.match(start, /^[0-9a-f]{40}$/);
    for (const id of ['1', '2', '3']) {
      assert.equal(await tip(id), start);
      assert.equal((await git.graph(id)).refs['refs/remotes/wall/main'], start);
    }
    await fresh(2);
    assert.equal(await tip('wall'), start, 'same Start ID after a reset');
    assert.equal(sh('wall', 'log', '-1', '--format=%an <%ae> %at | %cn <%ce> %ct | %s'),
      `Monster Lab <lab@monster.lab> ${Date.parse('2026-10-01T00:00:00Z') / 1000} | Monster Lab <lab@monster.lab> ${Date.parse('2026-10-01T00:00:00Z') / 1000} | Start`);
    assert.equal(sh('wall', 'cat-file', '-p', `${start}:monster.txt`), M.serialize(M.START).trim());
  });

  test('repos are pinned to sha1 + files, labs point at the Wall by a relative path', async () => {
    await fresh(1);
    assert.equal(sh('wall', 'rev-parse', '--show-object-format'), 'sha1');
    assert.equal(sh('wall', 'rev-parse', '--show-ref-format'), 'files');
    assert.equal(sh('wall', 'config', 'gc.auto'), '0');
    assert.equal(sh('1', 'rev-parse', '--show-ref-format'), 'files');
    assert.equal(sh('1', 'config', 'remote.wall.url'), '../../wall.git');
    assert.equal(sh('1', 'config', 'core.logAllRefUpdates'), 'always');
    assert.equal(sh('1', 'config', 'gc.auto'), '0');
    assert.equal(fs.existsSync(path.join(dir('1'), 'monster.txt')), false, 'labs never use a worktree');
    assert.equal(sh('1', 'fetch', 'wall'), '', 'the relative remote works');
  });

  test('cloneLab reports what it ran; replace starts the lab over from the Wall', async () => {
    const [lab] = await fresh(1);
    await git.createBranch(lab, 'cat-robot');
    await save(lab, 'cat-robot', { face: 'cat' });
    const r = await git.cloneLab('1', { replace: true });
    assert.equal(r.id, await tip('wall'));
    assert.equal(r.porcelain, 'git clone wall.git');
    assert.match(r.commands[0].cmd, /^git clone --no-checkout --ref-format=files -o wall wall\.git labs\/1$/);
    assert.deepEqual(Object.keys((await git.graph('1')).refs).sort(), ['refs/heads/main', 'refs/remotes/wall/main']);
    assert.deepEqual(diary('1'), ['clone: from ' + path.join(DATA, 'wall.git')]);
  });

  test('removeLab deletes the lab repo', async () => {
    await fresh(3);
    await git.removeLab('3');
    assert.equal(fs.existsSync(dir('3')), false);
    assert.equal(fs.existsSync(dir('2')), true);
  });
});

// ---------- Runner ----------

describe('runner', () => {
  test('git() runs with no global or system config and resolves with the exit code', async () => {
    await fresh(1);
    const ok = await git.git('1', ['config', '--list', '--show-scope']);
    assert.equal(ok.code, 0);
    assert.ok(ok.out.trim().split('\n').every((line) => line.startsWith('local\t')), ok.out);
    const missing = await git.git('1', ['rev-parse', '--verify', '-q', 'refs/heads/nope']);
    assert.equal(missing.code, 1);
    await assert.rejects(git.git('../etc', ['status']), /Bad lab id/);
  });

  test('every op returns the plumbing it ran, with output and exit code', async () => {
    const [lab] = await fresh(1);
    const r = await save(lab, 'main', { face: 'cat' });
    const cmds = r.commands.map((c) => c.cmd);
    assert.ok(cmds.some((c) => /^printf 'face: cat\\n---\\nbody: box\\n---\\nlegs: sticks\\n' \| git hash-object -w --stdin$/.test(c)), cmds.join('\n'));
    assert.ok(cmds.some((c) => /\| git mktree$/.test(c)));
    assert.ok(cmds.some((c) => c.startsWith(`git commit-tree `)));
    assert.ok(cmds.some((c) => c.startsWith(`git update-ref -m 'commit: FACE: smiley → cat' refs/heads/main ${r.id} `)));
    for (const c of r.commands) {
      assert.equal(typeof c.out, 'string');
      assert.equal(typeof c.code, 'number');
    }
    assert.equal(r.porcelain, "git commit -am 'FACE: smiley → cat'");
    assert.match(r.explain, new RegExp(`card ${r.id.slice(0, 7)}`));
  });
});

// ---------- Step 1: save ----------

describe('commit', () => {
  let lab;
  beforeEach(async () => {
    [lab] = await fresh(1);
  });

  test('saves the unsaved parts as a card with an automatic message, author and parent', async () => {
    const start = await tip('1');
    const r = await save(lab, 'main', { face: 'cat', legs: 'paws' }, PRIYA);
    assert.equal(r.message, 'FACE: smiley → cat, LEGS: sticks → paws');
    assert.equal(r.parent, start);
    assert.deepEqual(r.monster, { face: 'cat', body: 'box', legs: 'paws' });
    assert.equal(await tip('1'), r.id);
    assert.deepEqual(lab.drafts.main, {});
    assert.equal(sh('1', 'log', '-1', '--format=%an <%ae> %P %s', r.id), `Priya <priya@monster.lab> ${start} ${r.message}`);
    assert.equal(diary('1')[0], `commit: ${r.message}`);
    const c = await card('1', r.id);
    assert.deepEqual(c.parents, [start]);
    assert.equal(c.author, 'Priya');
    assert.ok(Math.abs(c.time - Date.now() / 1000) < 60);
  });

  test('nothing to save: no card, and parts equal to the card are dropped', async () => {
    const before = await tip('1');
    const empty = await git.commit(lab, 'main', PRIYA);
    assert.equal(empty.nothing, true);
    const same = await save(lab, 'main', { face: 'smiley' });
    assert.equal(same.nothing, true);
    assert.deepEqual(lab.drafts.main, {});
    assert.equal(await tip('1'), before);
  });

  test('parts changed during the save stay unsaved', async () => {
    lab.drafts.main = { face: 'cat', body: 'robot' };
    const saving = git.commit(lab, 'main', PRIYA);
    await new Promise((r) => setImmediate(r)); // the save has taken its snapshot
    lab.drafts.main.body = 'coat';
    lab.drafts.main.legs = 'paws';
    const r = await saving;
    assert.deepEqual(r.monster, { face: 'cat', body: 'robot', legs: 'sticks' });
    assert.deepEqual(lab.drafts.main, { body: 'coat', legs: 'paws' });
  });

  test('a chain of saves from different people', async () => {
    const people = [PRIYA, RAJ, ANA];
    const faces = ['frog', 'ghost', 'lion'];
    for (let i = 0; i < 3; i++) await save(lab, 'main', { face: faces[i] }, people[i]);
    const authors = sh('1', 'log', '--format=%an', 'main').split('\n');
    assert.deepEqual(authors, ['Ana', 'Raj', 'Priya', 'Monster Lab']);
  });

  test('a stale lock file makes the save fail with a lock error (the server says "Busy")', async () => {
    const lock = path.join(dir('1'), '.git', 'refs', 'heads', 'main.lock');
    fs.writeFileSync(lock, '');
    lab.drafts.main = { face: 'cat' };
    await assert.rejects(git.commit(lab, 'main', PRIYA), /Unable to create .*main\.lock/);
    assert.deepEqual(lab.drafts.main, { face: 'cat' }, 'the draft is kept');
    fs.rmSync(lock);
    assert.ok((await git.commit(lab, 'main', PRIYA)).id);
  });

  test('a note that disappeared reads as "moved"', async () => {
    lab.drafts.gone = { face: 'cat' };
    assert.equal((await git.commit(lab, 'gone', PRIYA)).moved, true);
  });
});

// ---------- Step 2: sticky notes ----------

describe('createBranch', () => {
  test('a new note on main\'s card, logged in Git\'s words; a second one with the same name exists', async () => {
    const [lab] = await fresh(1);
    await save(lab, 'main', { face: 'frog' });
    const main = await tip('1');
    const r = await git.createBranch(lab, 'cat-robot');
    assert.equal(r.id, main);
    assert.equal(r.porcelain, 'git switch -c cat-robot main');
    assert.equal(await tip('1', 'cat-robot'), main);
    assert.deepEqual(diary('1', 'cat-robot'), ['branch: Created from main']);
    assert.ok(fs.existsSync(path.join(dir('1'), '.git', 'refs', 'heads', 'cat-robot')), 'a sticky note is a tiny file');
    assert.equal((await git.createBranch(lab, 'cat-robot')).exists, true);
    assert.equal(await tip('1', 'cat-robot'), main);
  });

  test('always starts from main, whatever note you are on', async () => {
    const [lab] = await fresh(1);
    await git.createBranch(lab, 'a');
    await save(lab, 'a', { face: 'frog' });
    const r = await git.createBranch(lab, 'b');
    assert.equal(r.id, await tip('1', 'main'));
  });

  test('bad names are refused', async () => {
    const [lab] = await fresh(1);
    for (const name of ['wall', 'Cat', '-x', 'a/b', 'a'.repeat(21), '', 'héllo']) {
      assert.ok((await git.createBranch(lab, name)).refused, name);
    }
  });

  test('five people pressing at once make exactly one note', async () => {
    const [lab] = await fresh(1);
    const results = await Promise.all(Array.from({ length: 5 }, () => git.createBranch(lab, 'superhero')));
    assert.equal(results.filter((r) => r.id).length, 1);
    assert.equal(results.filter((r) => r.exists).length, 4);
  });
});

// ---------- Step 3: merge ----------

describe('merge', () => {
  let lab;
  beforeEach(async () => {
    [lab] = await fresh(1);
    await twoIdeas(lab);
  });

  test('first merge fast-forwards; second conflicts on BODY only, exactly as Git marks it', async () => {
    const catRobot = await tip('1', 'cat-robot');
    const start = await tip('1', 'main');
    const ff = await git.merge(lab, 'main', 'cat-robot', ANA);
    assert.equal(ff.fastForward, true);
    assert.equal(ff.id, catRobot);
    assert.equal(ff.from, start);
    assert.equal(ff.porcelain, 'git merge cat-robot');
    assert.equal(await tip('1'), catRobot, "main's note slid forward");
    assert.equal(diary('1')[0], 'merge cat-robot: Fast-forward');

    const r = await git.merge(lab, 'main', 'superhero', ANA);
    assert.equal(r.conflict, true);
    assert.deepEqual(r.conflicts, ['body']);
    assert.deepEqual(r.auto, { face: 'cat', legs: 'tentacles' });
    assert.equal(r.base, start);
    assert.equal(await tip('1'), catRobot, 'no card yet');
    const open = lab.merging.main;
    assert.equal(open.kind, 'merge');
    assert.equal(open.from, 'superhero');
    assert.equal(open.intoTip, catRobot);
    assert.equal(open.theirs, await tip('1', 'superhero'));
    assert.deepEqual(open.base, M.START);
    assert.deepEqual(open.ours, { face: 'cat', body: 'robot', legs: 'sticks' });
    assert.deepEqual(open.theirsMonster, { face: 'smiley', body: 'superhero', legs: 'tentacles' });
    assert.equal(open.startedBy, 'Ana');
    assert.match(open.conflictedText, /^<<<<<<< main\nbody: robot\n=======\nbody: superhero\n>>>>>>> superhero$/m);
    assert.deepEqual(gitView(open.conflictedText), { auto: open.auto, conflicts: open.conflicts });
    assert.match(r.explain, /BODY changed on both sides/);
  });

  test('anyone on the note finishes the merge: a merge card with two parents', async () => {
    await git.merge(lab, 'main', 'cat-robot', ANA);
    await git.merge(lab, 'main', 'superhero', ANA);
    const { intoTip, theirs } = lab.merging.main;
    const r = await git.resolve(lab, 'main', { face: 'cat', body: 'robot', legs: 'tentacles' }, RAJ);
    assert.deepEqual(r.parents, [intoTip, theirs]);
    assert.equal(await tip('1'), r.id);
    assert.equal(lab.merging.main, undefined);
    assert.equal(sh('1', 'log', '-1', '--format=%P|%an|%s', r.id), `${intoTip} ${theirs}|Raj|Merge branch 'superhero'`);
    assert.deepEqual(await monsterOf('1'), { face: 'cat', body: 'robot', legs: 'tentacles' });
    assert.equal(diary('1')[0], "commit (merge): Merge branch 'superhero'");
    assert.equal(r.porcelain, 'git add monster.txt\ngit commit');
  });

  test('cancel leaves main unchanged; merging again reopens the same conflict', async () => {
    await git.merge(lab, 'main', 'cat-robot', ANA);
    const before = await tip('1');
    await git.merge(lab, 'main', 'superhero', ANA);
    const r = await git.abort(lab, 'main');
    assert.equal(r.porcelain, 'git merge --abort');
    assert.equal(lab.merging.main, undefined);
    assert.equal(await tip('1'), before);
    assert.equal((await git.abort(lab, 'main')).nothing, true);
    assert.deepEqual((await git.merge(lab, 'main', 'superhero', ANA)).conflicts, ['body']);
  });

  test('up to date: nothing to merge', async () => {
    await git.merge(lab, 'main', 'cat-robot', ANA);
    const r = await git.merge(lab, 'main', 'cat-robot', ANA);
    assert.equal(r.nothing, true);
  });

  test('no conflict: Git makes the merge card itself', async () => {
    await git.createBranch(lab, 'legs');
    await save(lab, 'legs', { legs: 'paws' });
    await git.merge(lab, 'main', 'cat-robot', ANA);
    const r = await git.merge(lab, 'main', 'legs', ANA);
    assert.equal(r.merged, true);
    assert.equal((await card('1', r.id)).parents.length, 2);
    assert.deepEqual(await monsterOf('1'), { face: 'cat', body: 'robot', legs: 'paws' });
    assert.equal(diary('1')[0], "merge legs: Merge made by the 'ort' strategy.");
    assert.equal(sh('1', 'log', '-1', '--format=%s'), "Merge branch 'legs'");
  });

  test('merging into another note says so in the message', async () => {
    const r = await git.merge(lab, 'cat-robot', 'superhero', ANA);
    assert.equal(r.conflict, true);
    assert.equal(lab.merging['cat-robot'].message, "Merge branch 'superhero' into cat-robot");
  });

  test('a stale open merge cannot finish once the note moved', async () => {
    await git.merge(lab, 'main', 'cat-robot', ANA);
    await git.merge(lab, 'main', 'superhero', ANA);
    sh('1', 'update-ref', 'refs/heads/main', await tip('1', 'superhero'));
    const r = await git.resolve(lab, 'main', { face: 'cat', body: 'robot', legs: 'tentacles' }, RAJ);
    assert.equal(r.moved, true);
  });

  test('an open merge holds its note: two merges at once open one; save, undo, move back and replace wait', async () => {
    await git.merge(lab, 'main', 'cat-robot', ANA);
    const [first, second] = await Promise.all([git.merge(lab, 'main', 'superhero', ANA), git.merge(lab, 'main', 'superhero', RAJ)]);
    assert.equal(first.conflict, true);
    assert.equal(second.merging, true);
    assert.equal(lab.merging.main.startedBy, 'Ana', 'the open merge is the first one');
    const main = await tip('1');
    lab.drafts.main = { face: 'frog' };
    assert.equal((await git.commit(lab, 'main', RAJ)).merging, true);
    assert.equal((await git.revert(lab, 'main', main, RAJ)).merging, true);
    assert.equal((await git.reset(lab, 'main', await tip('1', 'superhero'), RAJ)).merging, true);
    assert.equal((await git.squashForcePush(lab, RAJ)).merging, true);
    assert.equal((await git.pull(lab, RAJ)).merging, true);
    assert.equal(await tip('1'), main, 'main did not move');
  });

  test('resolve refuses a bad monster and a missing merge', async () => {
    assert.ok((await git.resolve(lab, 'main', M.START, RAJ)).refused);
    await git.merge(lab, 'main', 'cat-robot', ANA);
    await git.merge(lab, 'main', 'superhero', ANA);
    assert.ok((await git.resolve(lab, 'main', { face: 'cat', body: 'unicorn', legs: 'tentacles' }, RAJ)).refused);
    assert.ok(lab.merging.main, 'still open');
  });
});

// ---------- Steps 4–5: the Wall ----------

// Step 4: lab 1's main goes to the Wall, every lab is cloned from it.
async function meetTheWall(count = 3) {
  const labs = await fresh(count);
  await twoIdeas(labs[0]);
  await git.merge(labs[0], 'main', 'cat-robot', ANA);
  await git.merge(labs[0], 'main', 'superhero', ANA);
  await git.resolve(labs[0], 'main', { face: 'cat', body: 'robot', legs: 'tentacles' }, ANA);
  const sent = await git.push(labs[0], { force: true });
  for (const lab of labs) await git.cloneLab(lab.id, { replace: true });
  return { labs, step4: sent.id };
}

const CHANGES = [{ face: 'dragon' }, { legs: 'skates' }, { body: 'cactus' }, { face: 'alien' }];

describe('push and pull', () => {
  test('Step 4: every lab\'s newest card has the identical ID', async () => {
    const { step4 } = await meetTheWall(3);
    assert.equal(await tip('wall'), step4);
    for (const id of ['1', '2', '3']) assert.equal(await tip(id), step4);
  });

  test('Step 5: first send works, the next is refused, Get & combine merges with zero conflicts, then send works', async () => {
    const { labs: [l1, l2, l3], step4 } = await meetTheWall(3);
    for (const [i, lab] of [l1, l2, l3].entries()) await save(lab, 'main', CHANGES[i], PRIYA);

    const sent = await git.push(l1);
    assert.equal(sent.id, await tip('1'));
    assert.equal(sent.forced, false);
    assert.equal(sent.porcelain, 'git push');
    assert.equal(await tip('wall'), sent.id);
    assert.equal((await git.graph('1')).refs['refs/remotes/wall/main'], sent.id);
    assert.equal((await git.push(l1)).already, true);

    const refused = await git.push(l2);
    assert.equal(refused.rejected, true);
    assert.equal(refused.reason, 'fetch first');
    assert.ok(refused.commands.some((c) => c.code === 1 && /\[rejected\] \(fetch first\)/.test(c.out)));
    assert.equal(await tip('wall'), sent.id, 'the Wall did not move');

    const pulled = await git.pull(l2, RAJ);
    assert.equal(pulled.merged, true, 'zero conflicts');
    assert.equal(pulled.porcelain, 'git fetch wall\ngit merge wall/main');
    assert.deepEqual(await monsterOf('2'), { face: 'dragon', body: 'robot', legs: 'skates' });
    assert.equal(diary('2')[0], "pull: Merge made by the 'ort' strategy.");
    assert.equal(sh('2', 'log', '-1', '--format=%s'), "Merge remote-tracking branch 'wall/main'");
    assert.ok((await git.push(l2)).id);

    assert.equal((await git.push(l3)).rejected, true);
    assert.equal((await git.pull(l3, ANA)).merged, true);
    assert.ok((await git.push(l3)).id);
    assert.deepEqual(await monsterOf('wall'), { face: 'dragon', body: 'cactus', legs: 'skates' });

    const ff = await git.pull(l1, PRIYA);
    assert.equal(ff.fastForward, true);
    assert.equal(diary('1')[0], 'pull: Fast-forward');
    assert.equal(await tip('1'), await tip('wall'));
    assert.equal((await git.pull(l1, PRIYA)).nothing, true);
    assert.ok((await git.graph('wall')).commits.some((c) => c.id === step4));
  });

  test('Lab 4 shares a part with Lab 1 and resolves one conflict against the Wall', async () => {
    const { labs } = await meetTheWall(4);
    await save(labs[0], 'main', CHANGES[0]);
    await save(labs[3], 'main', CHANGES[3]);
    await git.push(labs[0]);
    const r = await git.pull(labs[3], RAJ);
    assert.deepEqual(r.conflicts, ['face']);
    const open = labs[3].merging.main;
    assert.equal(open.from, 'wall/main');
    assert.match(open.conflictedText, /^<<<<<<< main\nface: alien\n=======\nface: dragon\n>>>>>>> wall\/main$/m);
    assert.deepEqual(gitView(open.conflictedText).conflicts, open.conflicts);
    const done = await git.resolve(labs[3], 'main', { ...open.ours, face: 'dragon' }, RAJ);
    assert.equal(diary('4')[0], "commit (merge): Merge remote-tracking branch 'wall/main'");
    assert.ok((await git.push(labs[3])).id);
    assert.equal(await tip('wall'), done.id);
  });

  test('8 simultaneous sends never throw: one goes through, the rest are refused or already there', async () => {
    const { labs } = await meetTheWall(4);
    for (const [i, lab] of labs.entries()) await save(lab, 'main', CHANGES[i]);
    const results = await Promise.all([...labs, ...labs].map((lab) => git.push(lab)));
    assert.equal(results.filter((r) => r.id && !r.rejected && !r.already).length, 1);
    assert.equal(results.filter((r) => r.already).length, 1);
    assert.equal(results.filter((r) => r.rejected).length, 6);
  });

  test('three labs pulling and sending at once all end up on the Wall', async () => {
    const { labs } = await meetTheWall(3);
    for (const [i, lab] of labs.entries()) await save(lab, 'main', CHANGES[i]);
    const wallHas = async () => {
      const m = await monsterOf('wall');
      return labs.filter((_, i) => Object.entries(CHANGES[i]).every(([p, v]) => m[p] === v)).length;
    };
    for (let round = 0; round < 5 && (await wallHas()) < 3; round++) {
      await Promise.all(labs.map(async (lab) => {
        if ((await git.push(lab)).rejected) {
          assert.equal((await git.pull(lab, PRIYA)).conflict, undefined);
          await git.push(lab);
        }
      }));
    }
    assert.equal(await wallHas(), 3);
  });
});

// ---------- Step 6: undo ----------

describe('undo', () => {
  test('sabotage puts one mustache card on the Wall, once', async () => {
    const { step4 } = await meetTheWall(2);
    const r = await git.wallSabotage();
    assert.equal(sh('wall', 'log', '-1', '--format=%P|%an|%ae|%s'), `${step4}|The Intern|intern@monster.lab|Tiny style fix`);
    assert.equal((await monsterOf('wall')).face, 'mustache');
    assert.equal(await tip('wall'), r.id);
    assert.equal((await git.wallSabotage()).nothing, true);
    assert.equal(await tip('wall'), r.id);
  });

  test('odd labs: get the mustache, undo it with a fix card, send', async () => {
    const { labs: [l1] } = await meetTheWall(2);
    const { id: mustache } = await git.wallSabotage();
    assert.equal((await git.pull(l1, PRIYA)).fastForward, true);
    const r = await git.revert(l1, 'main', mustache, PRIYA);
    assert.equal(r.porcelain, `git revert ${mustache.slice(0, 7)}`);
    assert.equal(r.reverted, mustache);
    assert.deepEqual((await card('1', r.id)).parents, [mustache]);
    assert.equal((await monsterOf('1')).face, 'cat');
    assert.equal(sh('1', 'log', '-1', '--format=%B', r.id), `Revert "Tiny style fix"\n\nThis reverts commit ${mustache}.`);
    assert.equal(diary('1')[0], 'revert: Revert "Tiny style fix"');
    assert.equal((await git.revert(l1, 'main', mustache, PRIYA)).nothing, true, 'already undone');
    assert.ok((await git.push(l1)).id);
    assert.equal((await monsterOf('wall')).face, 'cat');
  });

  test('even labs: move back, send is refused, Get & combine brings the mustache back', async () => {
    const { labs: [, l2], step4 } = await meetTheWall(2);
    const { id: mustache } = await git.wallSabotage();
    await git.pull(l2, RAJ);
    const r = await git.reset(l2, 'main', step4);
    assert.equal(r.porcelain, `git reset --hard ${step4.slice(0, 7)}`);
    assert.equal(r.from, mustache);
    assert.equal(await tip('2'), step4);
    const g = await git.graph('2');
    assert.equal(g.commits.find((c) => c.id === mustache).reachable, true, 'wall/main still has it');

    const refused = await git.push(l2);
    assert.equal(refused.rejected, true);
    assert.equal(refused.reason, 'non-fast-forward');
    const zombie = await git.pull(l2, RAJ);
    assert.equal(zombie.fastForward, true);
    assert.equal((await monsterOf('2')).face, 'mustache', 'the zombie card is back');

    const { entries } = await git.reflog(l2, 'main');
    assert.deepEqual(entries.map((e) => e.message), [
      'pull: Fast-forward', `reset: moving to ${step4.slice(0, 7)}`, 'pull: Fast-forward', 'clone: from the Wall']);
    assert.deepEqual(entries.map((e) => e.id), [mustache, step4, mustache, step4]);
    for (const e of entries) assert.ok(Math.abs(e.time - Date.now() / 1000) < 60);
    assert.deepEqual(entries.map((e) => e.message.replace('clone: from the Wall', 'clone')),
      diary('2').map((m) => m.replace(/^clone: from .*/, 'clone')), 'the diary matches a real git reflog');
  });

  test('a card moved away from is only in the diary', async () => {
    const [lab] = await fresh(1);
    const start = await tip('1');
    const { id } = await save(lab, 'main', { face: 'frog' });
    await git.reset(lab, 'main', start);
    const c = await card('1', id);
    assert.equal(c.reachable, false);
    assert.equal((await card('1', start)).reachable, true);
  });

  test('undo is refused for the Start card, cards outside the note, and unknown IDs', async () => {
    const [lab] = await fresh(1);
    const start = await tip('1');
    await git.createBranch(lab, 'side');
    const { id: side } = await save(lab, 'side', { face: 'frog' });
    assert.equal((await git.revert(lab, 'main', start, PRIYA)).refused, "The Start card can't be undone.");
    assert.equal((await git.revert(lab, 'main', side, PRIYA)).refused, "This card isn't in main's history.");
    assert.ok((await git.revert(lab, 'main', 'f'.repeat(40), PRIYA)).refused);
    assert.ok((await git.revert(lab, 'main', 'HEAD', PRIYA)).refused);
    assert.ok((await git.reset(lab, 'main', 'main~1', PRIYA)).refused);
    assert.ok((await git.reset(lab, 'main', `${start.slice(0, 39)}g`)).refused);
  });

  test('undo that conflicts opens a merge of kind revert; finishing adds one card with one parent', async () => {
    const [lab] = await fresh(1);
    const { id: cat } = await save(lab, 'main', { face: 'cat' });
    const { id: frog } = await save(lab, 'main', { face: 'frog' });
    const r = await git.revert(lab, 'main', cat, PRIYA);
    assert.deepEqual(r.conflicts, ['face']);
    const open = lab.merging.main;
    assert.equal(open.kind, 'revert');
    assert.equal(open.from, cat);
    assert.equal(open.intoTip, frog);
    assert.deepEqual([open.base.face, open.ours.face, open.theirsMonster.face], ['cat', 'frog', 'smiley']);
    assert.deepEqual(gitView(open.conflictedText).conflicts, ['face']);
    assert.match(open.conflictedText, /^<<<<<<< main$/m);
    const done = await git.resolve(lab, 'main', { ...open.ours, face: 'smiley' }, PRIYA);
    assert.deepEqual(done.parents, [frog]);
    assert.equal(diary('1')[0], 'revert: Revert "FACE: smiley → cat"');
    assert.equal(done.porcelain, 'git add monster.txt\ngit revert --continue');
    await git.revert(lab, 'main', frog, PRIYA);
    assert.equal((await git.abort(lab, 'main')).porcelain, 'git revert --abort');
  });

  test('undoing a merge card reverts against its first parent', async () => {
    const [lab] = await fresh(1);
    await twoIdeas(lab);
    await git.merge(lab, 'main', 'cat-robot', ANA);
    await git.merge(lab, 'main', 'superhero', ANA);
    const { id: mergeCard } = await git.resolve(lab, 'main', { face: 'cat', body: 'superhero', legs: 'tentacles' }, ANA);
    const r = await git.revert(lab, 'main', mergeCard, ANA);
    assert.equal(r.porcelain, `git revert -m 1 ${mergeCard.slice(0, 7)}`);
    assert.deepEqual(await monsterOf('1'), { face: 'cat', body: 'robot', legs: 'sticks' });
  });

  test('the diary of a note that does not exist is empty', async () => {
    const [lab] = await fresh(1);
    assert.deepEqual((await git.reflog(lab, 'nope')).entries, []);
  });
});

// ---------- Step 7: rewrite, audit, gc ----------

describe('rewrite', () => {
  // Tentacles came from Raj (in lab 1's Step 3); every lab got them at Step 4.
  async function beforeTheBoss() {
    const { labs } = await meetTheWall(3);
    for (const [i, lab] of labs.entries()) {
      await save(lab, 'main', CHANGES[i], PRIYA);
      if ((await git.push(lab)).rejected) {
        await git.pull(lab, PRIYA);
        await git.push(lab);
      }
    }
    return labs;
  }

  test('squash: the Wall\'s history becomes Start ← Clean', async () => {
    const labs = await beforeTheBoss();
    const start = sh('wall', 'rev-list', '--max-parents=0', 'main');
    const tree = sh('3', 'rev-parse', 'main^{tree}');
    const r = await git.squashForcePush(labs[2], ANA);
    assert.equal(r.forced, true);
    assert.equal(r.start, start);
    assert.equal(r.porcelain, `git reset --soft ${start.slice(0, 7)}\ngit commit -m "Clean history"\ngit push --force`);
    assert.equal(await tip('wall'), r.id);
    assert.equal(sh('wall', 'log', '--format=%H %P|%an|%s', 'main'), `${r.id} ${start}|Ana|Clean history\n${start} |Monster Lab|Start`);
    assert.equal(sh('wall', 'rev-parse', 'main^{tree}'), tree, "same monster as the boss lab's main");
    assert.deepEqual(diary('3').slice(0, 2), ['commit: Clean history', `reset: moving to ${start.slice(0, 7)}`]);
    const wall = await git.graph('wall');
    assert.deepEqual(wall.commits.map((c) => c.id), [r.id, start], 'the Wall shows only reachable cards');
    const again = await git.squashForcePush(labs[2], RAJ);
    assert.equal(again.already, true, 'pressing again changes nothing');
    assert.equal(await tip('wall'), r.id);
  });

  test('audit: before, the Wall knows Raj; after, only the other labs do; gc empties the bin', async () => {
    const labs = await beforeTheBoss();
    const raj = sh('wall', 'log', '--format=%H', '--author=Raj', 'main');
    const before = await git.audit('legs', 'tentacles');
    assert.deepEqual(before.wall, { id: raj, short: raj.slice(0, 7), author: 'Raj', pid: 'raj', clean: false });
    for (const id of ['1', '2', '3']) assert.equal(before.labs[id].id, raj);
    assert.equal((await git.audit('face', 'monkey')).wall, null, 'not found');

    const clean = await git.squashForcePush(labs[0], ANA);
    const afterSquash = await git.audit('legs', 'tentacles');
    assert.deepEqual(afterSquash.wall, { id: clean.id, short: clean.id.slice(0, 7), author: 'Ana', pid: 'ana', clean: true });
    assert.equal(afterSquash.labs['1'].clean, true, 'the boss lab rewrote its own main too');
    for (const id of ['2', '3']) assert.equal(afterSquash.labs[id].author, 'Raj', 'the other labs still have the old cards');

    assert.equal(sh('wall', 'cat-file', '-t', raj), 'commit', 'still in the bin before gc');
    const insp = await git.inspect('wall', raj);
    assert.equal(insp.id, raj);
    const gc = await git.gcWall();
    assert.ok(gc.before >= 5, `bin had ${gc.before} cards`);
    assert.equal(gc.after, 0);
    assert.equal(gc.porcelain, 'git gc --prune=now');
    assert.equal(fails('wall', 'cat-file', '-e', raj), true, 'gone from the Wall');
    assert.equal(fails('2', 'cat-file', '-e', raj), false, 'still in Lab 2');
    assert.equal((await git.inspect('wall', raj)).refused, "That card isn't on the Wall.");
    assert.equal((await git.gcWall()).before, 0);
  });

  test('a lab still on the old history gets the clean card with Get & combine', async () => {
    const labs = await beforeTheBoss();
    const clean = await git.squashForcePush(labs[0], ANA);
    const r = await git.pull(labs[1], RAJ);
    assert.equal(r.nothing, undefined);
    const g = await git.graph('2');
    assert.equal(g.refs['refs/remotes/wall/main'], clean.id);
  });
});

// ---------- Reading ----------

describe('reading', () => {
  test('graph: refs, cards with monsters, newest first; wall/main in labs', async () => {
    const [lab] = await fresh(1);
    const start = await tip('1');
    const { id } = await save(lab, 'main', { face: 'cat' }, PRIYA);
    await git.createBranch(lab, 'cat-robot');
    const g = await git.graph('1');
    assert.deepEqual(g.refs, { 'refs/heads/cat-robot': id, 'refs/heads/main': id, 'refs/remotes/wall/main': start });
    assert.deepEqual(g.commits.map((c) => c.id), [id, start]);
    assert.deepEqual(g.commits[0], {
      id, parents: [start], author: 'Priya', time: g.commits[0].time, message: 'FACE: smiley → cat',
      monster: { face: 'cat', body: 'box', legs: 'sticks' }, reachable: true,
    });
  });

  test('graph is cached until a git op moves a ref', async () => {
    const [lab] = await fresh(1);
    const a = await git.graph('1');
    assert.equal(await git.graph('1'), a);
    lab.drafts.main = { face: 'cat' };
    assert.equal(await git.graph('1'), a, 'draft clicks never touch git');
    await git.commit(lab, 'main', PRIYA);
    const b = await git.graph('1');
    assert.notEqual(b, a);
    assert.equal(b.commits.length, 2);
    const wall = await git.graph('wall');
    await git.push(lab);
    assert.notEqual(await git.graph('wall'), wall);
  });

  test('inspect shows what Git stored for a card', async () => {
    const [lab] = await fresh(1);
    const start = await tip('1');
    const { id } = await save(lab, 'main', { body: 'coat' }, RAJ);
    const r = await git.inspect('1', id);
    assert.match(r.raw, new RegExp(`^tree [0-9a-f]{40}\nparent ${start}\nauthor Raj <raj@monster.lab> \\d+ \\+0000\ncommitter Raj`));
    assert.equal(r.text, 'face: smiley\n---\nbody: coat\n---\nlegs: sticks\n');
    assert.deepEqual(r.monster, { face: 'smiley', body: 'coat', legs: 'sticks' });
    assert.deepEqual(r.commands.map((c) => c.cmd), [`git cat-file -p ${id}`, `git cat-file -p ${id}:monster.txt`]);
    assert.equal(r.porcelain, `git cat-file -p ${id.slice(0, 7)}`);
    assert.equal((await git.inspect('wall', id)).refused, "That card isn't on the Wall.");
    assert.equal((await git.inspect('1', 'nope')).refused, "That card isn't in your lab's cards.");
    const tree = sh('1', 'rev-parse', `${id}^{tree}`);
    assert.ok((await git.inspect('1', tree)).refused, 'a tree is not a card');
  });
});

// ---------- Locks ----------

describe('locks', () => {
  test('exclusive waits for running ops, and git calls inside it do not deadlock', async () => {
    const [lab] = await fresh(2);
    const order = [];
    lab.drafts.main = { face: 'cat' };
    const saving = git.commit(lab, 'main', PRIYA).then(() => order.push('save'));
    const done = git.exclusive(async () => {
      order.push('exclusive');
      await git.graph('1');
      await git.cloneLab('2', { replace: true });
    });
    await Promise.all([saving, done]);
    assert.deepEqual(order, ['save', 'exclusive']);
  });

  test('ops on one lab run one at a time', async () => {
    const [lab] = await fresh(1);
    const notes = Array.from({ length: 6 }, (_, i) => `n${i}`);
    const results = await Promise.all(notes.map((n) => git.createBranch(lab, n)));
    assert.ok(results.every((r) => r.id));
    lab.drafts.main = { face: 'cat' };
    const saves = await Promise.all([git.commit(lab, 'main', PRIYA), git.commit(lab, 'main', RAJ)]);
    assert.equal(saves.filter((r) => r.id).length, 1, 'the second save finds nothing left to save');
    assert.equal(saves.filter((r) => r.nothing).length, 1);
  });
});
