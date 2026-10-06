// Unit tests for the git engine (server/git.js) and outfit.txt helpers (server/monster.js).
// Every test runs real git in a private temp DATA_DIR.
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'outfit-lab-test-'));
process.env.DATA_DIR = DATA;
const git = await import('../server/git.js');
const M = await import('../server/monster.js');
const { LAB_CHANGES, PAIR_PARTS, SABOTAGE } = await import('../server/steps.js');

after(() => fs.rmSync(DATA, { recursive: true, force: true }));

// ---------- Helpers ----------

const ENV = { PATH: process.env.PATH, LC_ALL: 'C', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const dir = (repo) => (repo === 'wall' ? path.join(DATA, 'wall.git') : path.join(DATA, 'labs', repo));
// Plain git, outside the engine, to check what the engine left on disk (env: extra variables, e.g. a committer).
const sh = (repo, ...args) => shEnv(repo, {}, ...args);
const shEnv = (repo, env, ...args) => execFileSync('git', args, { cwd: dir(repo), env: { ...ENV, ...env }, encoding: 'utf8' }).trim();
const fails = (repo, ...args) => {
  try {
    execFileSync('git', args, { cwd: dir(repo), env: ENV, stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
};

// A copy of a lab for real porcelain Git: same depth (so the Wall's relative URL works), with a work tree.
function realCopy(id, name = `real${id}`) {
  fs.rmSync(dir(name), { recursive: true, force: true });
  fs.cpSync(dir(id), dir(name), { recursive: true });
  sh(name, 'reset', '-q', '--hard');
  return name;
}

// The committer of a card, as real Git takes it from the environment.
function committerOf(repo, id) {
  const [name, email, date] = sh(repo, 'log', '-1', '--date=raw', '--format=%cn%x00%ce%x00%cd', id).split('\0');
  return { GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_COMMITTER_DATE: date };
}

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

// Git's own view of a conflicted outfit.txt: lines outside markers were combined by Git;
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
      const m = /^(hat|glasses|top|shoes): ([a-z]+)$/.exec(line);
      if (m) (side ? sides[side] : auto)[m[1]] = m[2];
    }
  }
  return { auto, conflicts: M.PARTS.filter((p) => conflicted.has(p)) };
}

// Steps 1–3 for one lab: two branches from main, each with its pair's mission saved.
async function twoIdeas(lab) {
  await git.createBranch(lab, 'fancy');
  await git.createBranch(lab, 'sporty');
  await save(lab, 'fancy', PAIR_PARTS.fancy, PRIYA);
  await save(lab, 'sporty', PAIR_PARTS.sporty, RAJ);
}

// The two missions on top of the Start outfit, and Step 3's merge with TOP picked.
const FANCY = { ...M.START, ...PAIR_PARTS.fancy };
const SPORTY = { ...M.START, ...PAIR_PARTS.sporty };
const MERGED = { ...FANCY, shoes: 'boots' };

// ---------- monster.js ----------

describe('outfit.txt', () => {
  test('serialize writes the four parts with --- lines between them', () => {
    assert.equal(M.FILE, 'outfit.txt');
    assert.equal(M.serialize(M.START), 'hat: cap\n---\nglasses: round\n---\ntop: tshirt\n---\nshoes: sneakers\n');
  });

  test('parse reads what serialize writes', () => {
    const outfit = { hat: 'crown', glasses: 'shades', top: 'labcoat', shoes: 'skates' };
    assert.deepEqual(M.parse(M.serialize(outfit)), outfit);
    assert.deepEqual(M.parse('hat: tophat\n---\nnot a part\nshoes: boots\n'), { hat: 'tophat', shoes: 'boots' });
  });

  test('only palette slugs make an outfit', () => {
    assert.equal(M.isMonster(M.START), true);
    assert.equal(M.isMonster({ ...M.START, glasses: 'disguise' }), true);
    for (const bad of [{ ...M.START, hat: 'unicorn' }, { hat: 'cap', glasses: 'round', top: 'tshirt' }, { ...M.START, top: '__proto__' },
      { ...M.START, top: 'coat\nhat: crown' }, { ...M.START, hat: 'boots' }, null]) {
      assert.equal(M.isMonster(bad), false, JSON.stringify(bad));
      assert.throws(() => M.serialize(bad));
    }
  });

  test('palette(step) shows mission parts only from their mission step, and never the disguise', () => {
    const has = (step, part, slug) => M.palette(step)[part].includes(slug);
    assert.deepEqual(M.palette(1), {
      hat: ['cap', 'sunhat', 'helmet'], glasses: ['round', 'goggles', 'monocle'],
      top: ['tshirt', 'coat', 'blouse', 'vest'], shoes: ['sneakers', 'heels', 'loafers', 'sandals'],
    });
    for (const [part, slug] of [['hat', 'tophat'], ['top', 'tie'], ['top', 'jersey'], ['shoes', 'boots']]) {
      assert.equal(has(1, part, slug), false);
      assert.equal(has(2, part, slug), true);
    }
    for (const { part, value } of Object.values(LAB_CHANGES)) {
      assert.equal(has(3, part, value), false);
      assert.equal(has(4, part, value), true);
    }
    for (let step = 0; step <= 7; step++) assert.equal(has(step, 'glasses', 'disguise'), false);
  });

  test('describeChange names each changed part, old → new', () => {
    assert.equal(M.describeChange(M.START, { ...M.START, hat: 'tophat' }), 'HAT: cap → tophat');
    assert.equal(M.describeChange(M.START, FANCY), 'HAT: cap → tophat, TOP: tshirt → tie');
    assert.equal(M.describeChange(M.START, M.START), '');
  });

  test('merge3 keeps one-sided changes and flags parts changed on both sides differently', () => {
    const base = M.START;
    assert.deepEqual(M.merge3(base, { ...base, hat: 'tophat' }, { ...base, shoes: 'loafers' }),
      { auto: { hat: 'tophat', glasses: 'round', top: 'tshirt', shoes: 'loafers' }, conflicts: [] });
    assert.deepEqual(M.merge3(base, { ...base, top: 'tie' }, { ...base, top: 'tie' }),
      { auto: { ...base, top: 'tie' }, conflicts: [] });
    assert.deepEqual(M.merge3(base, FANCY, SPORTY),
      { auto: { hat: 'tophat', glasses: 'round', shoes: 'boots' }, conflicts: ['top'] });
  });
});

// The resolver's per-part view must say exactly what Git's conflict markers say, in every case.
describe('merge3 agrees with git merge-tree', () => {
  test('all 625 combinations of unchanged / ours / theirs / same on both / different on both', async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'outfit-lab-merge-'));
    try {
      await git.git(repo, ['init', '-q', '-b', 'main']);
      const ids = new Map();
      const cardFor = async (monster, parents = []) => {
        const key = M.serialize(monster);
        if (!ids.has(key)) {
          const blob = (await git.git(repo, ['hash-object', '-w', '--stdin'], { input: key })).out.trim();
          const tree = (await git.git(repo, ['mktree'], { input: `100644 blob ${blob}\t${M.FILE}\n` })).out.trim();
          ids.set(key, (await git.git(repo, ['commit-tree', tree, ...parents.flatMap((p) => ['-p', p]), '-m', key])).out.trim());
        }
        return ids.get(key);
      };
      const base = M.START;
      const baseId = await cardFor(base);
      const other = { hat: ['tophat', 'crown'], glasses: ['shades', 'goggles'], top: ['tie', 'jersey'], shoes: ['boots', 'skates'] };
      // Per part: [ours, theirs] as indexes into [base, A, B].
      const kinds = [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2]];
      const pick = (part, k) => (k === 0 ? base[part] : other[part][k - 1]);
      let conflicted = 0;
      for (const h of kinds) for (const g of kinds) for (const t of kinds) for (const sh of kinds) {
        const k = { hat: h, glasses: g, top: t, shoes: sh };
        const ours = Object.fromEntries(M.PARTS.map((p) => [p, pick(p, k[p][0])]));
        const theirs = Object.fromEntries(M.PARTS.map((p) => [p, pick(p, k[p][1])]));
        const mine = M.merge3(base, ours, theirs);
        const oursId = await cardFor(ours, [baseId]);
        const theirsId = await cardFor(theirs, [baseId]);
        const mt = await git.git(repo, ['merge-tree', '--write-tree', `--merge-base=${baseId}`, oursId, theirsId]);
        const tree = mt.out.split('\n')[0];
        const text = (await git.git(repo, ['cat-file', '-p', `${tree}:${M.FILE}`])).out;
        const label = JSON.stringify({ ours, theirs });
        assert.equal(mt.code, mine.conflicts.length ? 1 : 0, label);
        const view = gitView(text);
        assert.deepEqual(view.conflicts, mine.conflicts, label);
        assert.deepEqual(view.auto, mine.auto, label);
        if (mine.conflicts.length) conflicted++;
      }
      assert.equal(conflicted, 5 ** 4 - 4 ** 4); // a part conflicts only when both sides changed it differently
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
      `Outfit Lab <lab@outfit.lab> ${Date.parse('2026-10-01T00:00:00Z') / 1000} | Outfit Lab <lab@outfit.lab> ${Date.parse('2026-10-01T00:00:00Z') / 1000} | Start`);
    assert.equal(sh('wall', 'cat-file', '-p', `${start}:outfit.txt`), M.serialize(M.START).trim());
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
    assert.equal(fs.existsSync(path.join(dir('1'), 'outfit.txt')), false, 'labs never use a worktree');
    assert.equal(sh('1', 'fetch', 'wall'), '', 'the relative remote works');
  });

  test('cloneLab reports what it ran; replace starts the lab over from the Wall', async () => {
    const [lab] = await fresh(1);
    await git.createBranch(lab, 'fancy');
    await save(lab, 'fancy', { hat: 'tophat' });
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
    const r = await save(lab, 'main', { hat: 'sunhat' });
    const cmds = r.commands.map((c) => c.cmd);
    assert.ok(cmds.some((c) => c === "printf 'hat: sunhat\\n---\\nglasses: round\\n---\\ntop: tshirt\\n---\\nshoes: sneakers\\n' | git hash-object -w --stdin"), cmds.join('\n'));
    assert.ok(cmds.some((c) => /^printf '100644 blob [0-9a-f]{40}\\toutfit\.txt\\n' \| git mktree$/.test(c)), cmds.join('\n'));
    assert.ok(cmds.some((c) => /\| git mktree$/.test(c)));
    assert.ok(cmds.some((c) => c.startsWith(`git commit-tree `)));
    assert.ok(cmds.some((c) => c.startsWith(`git update-ref -m 'commit: HAT: cap → sunhat' refs/heads/main ${r.id} `)));
    for (const c of r.commands) {
      assert.equal(typeof c.out, 'string');
      assert.equal(typeof c.code, 'number');
    }
    assert.equal(r.porcelain, "git commit -am 'HAT: cap → sunhat'");
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
    const r = await save(lab, 'main', { hat: 'sunhat', shoes: 'loafers' }, PRIYA);
    assert.equal(r.message, 'HAT: cap → sunhat, SHOES: sneakers → loafers');
    assert.equal(r.parent, start);
    assert.deepEqual(r.monster, { ...M.START, hat: 'sunhat', shoes: 'loafers' });
    assert.equal(await tip('1'), r.id);
    assert.deepEqual(lab.drafts.main, {});
    assert.equal(sh('1', 'log', '-1', '--format=%an <%ae> %P %s', r.id), `Priya <priya@outfit.lab> ${start} ${r.message}`);
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
    const same = await save(lab, 'main', { hat: 'cap' });
    assert.equal(same.nothing, true);
    assert.deepEqual(lab.drafts.main, {});
    assert.equal(await tip('1'), before);
  });

  test('parts changed during the save stay unsaved', async () => {
    lab.drafts.main = { hat: 'sunhat', top: 'coat' };
    const saving = git.commit(lab, 'main', PRIYA);
    await new Promise((r) => setImmediate(r)); // the save has taken its snapshot
    lab.drafts.main.top = 'vest';
    lab.drafts.main.shoes = 'loafers';
    const r = await saving;
    assert.deepEqual(r.monster, { ...M.START, hat: 'sunhat', top: 'coat' });
    assert.deepEqual(lab.drafts.main, { top: 'vest', shoes: 'loafers' });
  });

  test('a chain of saves from different people', async () => {
    const people = [PRIYA, RAJ, ANA];
    const hats = ['sunhat', 'helmet', 'crown'];
    for (let i = 0; i < 3; i++) await save(lab, 'main', { hat: hats[i] }, people[i]);
    const authors = sh('1', 'log', '--format=%an', 'main').split('\n');
    assert.deepEqual(authors, ['Ana', 'Raj', 'Priya', 'Outfit Lab']);
  });

  test('a stale lock file makes the save fail with a lock error (the server says "Busy")', async () => {
    const lock = path.join(dir('1'), '.git', 'refs', 'heads', 'main.lock');
    fs.writeFileSync(lock, '');
    lab.drafts.main = { hat: 'sunhat' };
    await assert.rejects(git.commit(lab, 'main', PRIYA), /Unable to create .*main\.lock/);
    assert.deepEqual(lab.drafts.main, { hat: 'sunhat' }, 'the draft is kept');
    fs.rmSync(lock);
    assert.ok((await git.commit(lab, 'main', PRIYA)).id);
  });

  test('a note that disappeared reads as "moved"', async () => {
    lab.drafts.gone = { hat: 'sunhat' };
    assert.equal((await git.commit(lab, 'gone', PRIYA)).moved, true);
  });
});

// ---------- Step 2: branches ----------

describe('createBranch', () => {
  test('a new note on main\'s card, logged in Git\'s words; a second one with the same name exists', async () => {
    const [lab] = await fresh(1);
    await save(lab, 'main', { hat: 'sunhat' });
    const main = await tip('1');
    const r = await git.createBranch(lab, 'fancy');
    assert.equal(r.id, main);
    assert.equal(r.porcelain, 'git switch -c fancy main');
    assert.equal(await tip('1', 'fancy'), main);
    assert.deepEqual(diary('1', 'fancy'), ['branch: Created from main']);
    assert.ok(fs.existsSync(path.join(dir('1'), '.git', 'refs', 'heads', 'fancy')), 'a branch is a tiny file');
    assert.equal((await git.createBranch(lab, 'fancy')).exists, true);
    assert.equal(await tip('1', 'fancy'), main);
  });

  test('always starts from main, whatever note you are on', async () => {
    const [lab] = await fresh(1);
    await git.createBranch(lab, 'a');
    await save(lab, 'a', { hat: 'sunhat' });
    const r = await git.createBranch(lab, 'b');
    assert.equal(r.id, await tip('1', 'main'));
  });

  test('bad names are refused', async () => {
    const [lab] = await fresh(1);
    for (const name of ['wall', 'Cat', '-x', 'a/b', 'a'.repeat(21), '', 'héllo']) {
      assert.ok((await git.createBranch(lab, name)).refused, name);
    }
  });

  test('five people pressing at once make exactly one branch', async () => {
    const [lab] = await fresh(1);
    const results = await Promise.all(Array.from({ length: 5 }, () => git.createBranch(lab, 'sporty')));
    assert.equal(results.filter((r) => r.id).length, 1);
    assert.equal(results.filter((r) => r.exists).length, 4);
  });
});

// ---------- Step 3: delete a branch ----------

describe('deleteBranch (git branch -d)', () => {
  test('a merged note is deleted: its file and its reflog go, its cards stay', async () => {
    const [lab] = await fresh(1);
    await twoIdeas(lab);
    await git.merge(lab, 'main', 'fancy', ANA);
    const fancy = await tip('1', 'fancy');
    const r = await git.deleteBranch(lab, 'fancy', 'main');
    assert.equal(r.deleted, 'fancy');
    assert.equal(r.id, fancy);
    assert.equal(r.porcelain, 'git branch -d fancy');
    assert.match(r.explain, new RegExp(`^Deleted branch fancy \\(was ${fancy.slice(0, 7)}\\)\\.`));
    assert.ok(r.commands.some((c) => c.cmd === `git update-ref -d refs/heads/fancy ${fancy}`));
    assert.equal(fs.existsSync(path.join(dir('1'), '.git', 'refs', 'heads', 'fancy')), false);
    assert.equal(fails('1', 'reflog', 'exists', 'refs/heads/fancy'), true, 'its reflog is gone too');
    const g = await git.graph('1');
    assert.equal(g.refs['refs/heads/fancy'], undefined);
    assert.equal(g.commits.find((c) => c.id === fancy).reachable, true, "the card stays: main's history has it");
  });

  test('refuses a note whose cards the current note lacks, exactly when real git branch -d does', async () => {
    const [lab] = await fresh(1);
    await twoIdeas(lab);
    await git.merge(lab, 'main', 'fancy', ANA);
    const real = realCopy('1');
    for (const [note, current] of [['sporty', 'main'], ['fancy', 'sporty'], ['fancy', 'main']]) {
      sh(real, 'switch', '-q', current);
      const gitRefuses = fails(real, 'branch', '-d', note);
      const r = await git.deleteBranch(lab, note, current);
      assert.equal(!!r.unmerged, gitRefuses, `${note} from ${current}`);
      assert.equal(!r.deleted, gitRefuses, `${note} from ${current}`);
    }
    assert.ok(await tip('1', 'sporty'), 'sporty is still there');
  });

  test('never the branch you are on; a missing note reads as "moved"', async () => {
    const [lab] = await fresh(1);
    await git.createBranch(lab, 'fancy');
    assert.equal((await git.deleteBranch(lab, 'fancy', 'fancy')).current, true);
    assert.ok(await tip('1', 'fancy'));
    assert.equal((await git.deleteBranch(lab, 'nope', 'main')).moved, true);
  });
});

// ---------- Step 3: merge ----------

describe('merge', () => {
  let lab;
  beforeEach(async () => {
    [lab] = await fresh(1);
    await twoIdeas(lab);
  });

  test('first merge fast-forwards; second conflicts on TOP only, exactly as Git marks it', async () => {
    const fancy = await tip('1', 'fancy');
    const start = await tip('1', 'main');
    const ff = await git.merge(lab, 'main', 'fancy', ANA);
    assert.equal(ff.fastForward, true);
    assert.equal(ff.id, fancy);
    assert.equal(ff.from, start);
    assert.equal(ff.porcelain, 'git merge fancy');
    assert.equal(await tip('1'), fancy, "main's note slid forward");
    assert.equal(diary('1')[0], 'merge fancy: Fast-forward');

    const r = await git.merge(lab, 'main', 'sporty', ANA);
    assert.equal(r.conflict, true);
    assert.deepEqual(r.conflicts, ['top']);
    assert.deepEqual(r.auto, { hat: 'tophat', glasses: 'round', shoes: 'boots' }, 'HAT and SHOES combine on their own');
    assert.equal(r.base, start);
    assert.equal(await tip('1'), fancy, 'no card yet');
    const open = lab.merging.main;
    assert.equal(open.kind, 'merge');
    assert.equal(open.from, 'sporty');
    assert.equal(open.intoTip, fancy);
    assert.equal(open.theirs, await tip('1', 'sporty'));
    assert.deepEqual(open.base, M.START);
    assert.deepEqual(open.ours, FANCY);
    assert.deepEqual(open.theirsMonster, SPORTY);
    assert.equal(open.startedBy, 'Ana');
    assert.match(open.conflictedText, /^<<<<<<< main\ntop: tie\n=======\ntop: jersey\n>>>>>>> sporty$/m);
    assert.equal(open.conflictedText.match(/^<<<<<<< /gm).length, 1, 'one marker block: TOP');
    assert.deepEqual(gitView(open.conflictedText), { auto: open.auto, conflicts: open.conflicts });
    assert.match(r.explain, /TOP changed on both sides/);
  });

  test('anyone on the branch finishes the merge: a merge card with two parents', async () => {
    await git.merge(lab, 'main', 'fancy', ANA);
    await git.merge(lab, 'main', 'sporty', ANA);
    const { intoTip, theirs } = lab.merging.main;
    const r = await git.resolve(lab, 'main', MERGED, RAJ);
    assert.deepEqual(r.parents, [intoTip, theirs]);
    assert.equal(await tip('1'), r.id);
    assert.equal(lab.merging.main, undefined);
    assert.equal(sh('1', 'log', '-1', '--format=%P|%an|%s', r.id), `${intoTip} ${theirs}|Raj|Merge branch 'sporty'`);
    assert.deepEqual(await monsterOf('1'), MERGED);
    assert.equal(diary('1')[0], "commit (merge): Merge branch 'sporty'");
    assert.equal(r.porcelain, 'git add outfit.txt\ngit commit');
  });

  test('cancel leaves main unchanged; merging again reopens the same conflict', async () => {
    await git.merge(lab, 'main', 'fancy', ANA);
    const before = await tip('1');
    await git.merge(lab, 'main', 'sporty', ANA);
    const r = await git.abort(lab, 'main');
    assert.equal(r.porcelain, 'git merge --abort');
    assert.equal(lab.merging.main, undefined);
    assert.equal(await tip('1'), before);
    assert.equal((await git.abort(lab, 'main')).nothing, true);
    assert.deepEqual((await git.merge(lab, 'main', 'sporty', ANA)).conflicts, ['top']);
  });

  test('up to date: nothing to merge', async () => {
    await git.merge(lab, 'main', 'fancy', ANA);
    const r = await git.merge(lab, 'main', 'fancy', ANA);
    assert.equal(r.nothing, true);
  });

  test('no conflict: Git makes the merge card itself', async () => {
    await git.createBranch(lab, 'comfy');
    await save(lab, 'comfy', { shoes: 'loafers' });
    await git.merge(lab, 'main', 'fancy', ANA);
    const r = await git.merge(lab, 'main', 'comfy', ANA);
    assert.equal(r.merged, true);
    assert.equal((await card('1', r.id)).parents.length, 2);
    assert.deepEqual(await monsterOf('1'), { ...FANCY, shoes: 'loafers' });
    assert.equal(diary('1')[0], "merge comfy: Merge made by the 'ort' strategy.");
    assert.equal(sh('1', 'log', '-1', '--format=%s'), "Merge branch 'comfy'");
  });

  test('merging into another note says so in the message', async () => {
    const r = await git.merge(lab, 'fancy', 'sporty', ANA);
    assert.equal(r.conflict, true);
    assert.equal(lab.merging.fancy.message, "Merge branch 'sporty' into fancy");
  });

  test('a stale open merge cannot finish once the branch moved', async () => {
    await git.merge(lab, 'main', 'fancy', ANA);
    await git.merge(lab, 'main', 'sporty', ANA);
    sh('1', 'update-ref', 'refs/heads/main', await tip('1', 'sporty'));
    const r = await git.resolve(lab, 'main', MERGED, RAJ);
    assert.equal(r.moved, true);
  });

  test('an open merge holds its branch: two merges at once open one; save, undo, move back and replace wait', async () => {
    await git.merge(lab, 'main', 'fancy', ANA);
    const [first, second] = await Promise.all([git.merge(lab, 'main', 'sporty', ANA), git.merge(lab, 'main', 'sporty', RAJ)]);
    assert.equal(first.conflict, true);
    assert.equal(second.merging, true);
    assert.equal(lab.merging.main.startedBy, 'Ana', 'the open merge is the first one');
    const main = await tip('1');
    lab.drafts.main = { hat: 'sunhat' };
    assert.equal((await git.commit(lab, 'main', RAJ)).merging, true);
    assert.equal((await git.revert(lab, 'main', main, RAJ)).merging, true);
    assert.equal((await git.reset(lab, 'main', await tip('1', 'sporty'), RAJ)).merging, true);
    assert.equal((await git.squashForcePush(lab, RAJ)).merging, true);
    assert.equal((await git.pull(lab, RAJ)).merging, true);
    assert.equal(await tip('1'), main, 'main did not move');
  });

  test('resolve refuses a bad monster and a missing merge', async () => {
    assert.ok((await git.resolve(lab, 'main', M.START, RAJ)).refused);
    await git.merge(lab, 'main', 'fancy', ANA);
    await git.merge(lab, 'main', 'sporty', ANA);
    assert.ok((await git.resolve(lab, 'main', { ...MERGED, top: 'unicorn' }, RAJ)).refused);
    assert.ok(lab.merging.main, 'still open');
  });
});

// ---------- Step 4: the Wall ----------

// Step 4: lab 1's main goes to the Wall, every lab is cloned from it. Raj saved sporty, so the boots are his.
async function meetTheWall(count = 3) {
  const labs = await fresh(count);
  await twoIdeas(labs[0]);
  await git.merge(labs[0], 'main', 'fancy', ANA);
  await git.merge(labs[0], 'main', 'sporty', ANA);
  await git.resolve(labs[0], 'main', MERGED, ANA);
  const sent = await git.push(labs[0], { force: true });
  for (const lab of labs) await git.cloneLab(lab.id, { replace: true });
  return { labs, step4: sent.id };
}

// Each lab's Step 4 change, as unsaved parts: [{hat: 'crown'}, {shoes: 'skates'}, ...].
const CHANGES = Object.values(LAB_CHANGES).map(({ part, value }) => ({ [part]: value }));

describe('push and pull', () => {
  test('entering Step 4: every lab\'s newest card has the identical ID', async () => {
    const { step4 } = await meetTheWall(3);
    assert.equal(await tip('wall'), step4);
    for (const id of ['1', '2', '3']) assert.equal(await tip(id), step4);
  });

  test('Step 4: first send works, the next is refused, Get & combine merges with zero conflicts, then send works', async () => {
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
    assert.deepEqual(await monsterOf('2'), { ...MERGED, hat: 'crown', shoes: 'skates' });
    // The card and the diary line are what `git merge wall/main` writes, as the porcelain says.
    assert.equal(diary('2')[0], "merge wall/main: Merge made by the 'ort' strategy.");
    assert.equal(sh('2', 'log', '-1', '--format=%s'), "Merge remote-tracking branch 'wall/main'");
    assert.ok((await git.push(l2)).id);

    assert.equal((await git.push(l3)).rejected, true);
    assert.equal((await git.pull(l3, ANA)).merged, true);
    assert.ok((await git.push(l3)).id);
    assert.deepEqual(await monsterOf('wall'), { hat: 'crown', glasses: 'shades', top: 'tie', shoes: 'skates' });

    const ff = await git.pull(l1, PRIYA);
    assert.equal(ff.fastForward, true);
    assert.equal(diary('1')[0], 'merge wall/main: Fast-forward');
    assert.equal(await tip('1'), await tip('wall'));
    assert.equal((await git.pull(l1, PRIYA)).nothing, true);
    assert.ok((await git.graph('wall')).commits.some((c) => c.id === step4));
  });

  test('Labs 1–4 change different parts; Lab 5 shares HAT with Lab 1 and resolves one conflict against the Wall', async () => {
    assert.equal(new Set(CHANGES.slice(0, 4).map((c) => Object.keys(c)[0])).size, 4);
    const { labs } = await meetTheWall(5);
    await save(labs[0], 'main', CHANGES[0]);
    await save(labs[4], 'main', CHANGES[4]);
    await git.push(labs[0]);
    const r = await git.pull(labs[4], RAJ);
    assert.deepEqual(r.conflicts, ['hat']);
    const open = labs[4].merging.main;
    assert.equal(open.from, 'wall/main');
    assert.match(open.conflictedText, /^<<<<<<< main\nhat: gradcap\n=======\nhat: crown\n>>>>>>> wall\/main$/m);
    assert.deepEqual(gitView(open.conflictedText).conflicts, open.conflicts);
    const done = await git.resolve(labs[4], 'main', { ...open.ours, hat: 'crown' }, RAJ);
    assert.equal(diary('5')[0], "commit (merge): Merge remote-tracking branch 'wall/main'");
    assert.ok((await git.push(labs[4])).id);
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

// ---------- Step 4: replay on top (git pull --rebase) ----------

describe('rebase', () => {
  // Lab 1 sends its change first; lab 2 saved its own change (Raj's card) and is refused.
  async function refused(count = 2) {
    const { labs, step4 } = await meetTheWall(count);
    await save(labs[0], 'main', CHANGES[0], PRIYA);
    const { id: original } = await save(labs[1], 'main', CHANGES[1], RAJ);
    const first = (await git.push(labs[0])).id;
    assert.equal((await git.push(labs[1])).rejected, true);
    return { labs, step4, first, original };
  }
  const aSecond = () => new Promise((res) => setTimeout(res, 1100)); // so a new committer date differs

  test("copies the card onto the Wall's: new parent and ID, same author and author date, new committer date", async () => {
    const { labs: [, l2], step4, first, original } = await refused();
    const real = realCopy('2');
    await aSecond();
    const r = await git.rebase(l2, ANA);
    assert.equal(r.rebased, true);
    assert.equal(r.porcelain, 'git pull --rebase');
    assert.deepEqual(r.replaced, [{ from: original, to: r.id }]);
    assert.deepEqual(r.dropped, []);
    assert.equal(await tip('2'), r.id);
    assert.notEqual(r.id, original);
    const [parent, author, committer, subject] = sh('2', 'log', '-1', '--format=%P|%an <%ae> %at|%cn <%ce>|%s', r.id).split('|');
    assert.equal(parent, first, "its parent is the Wall's newest card");
    assert.equal(author, sh('2', 'log', '-1', '--format=%an <%ae> %at', original), 'author and author date are kept');
    assert.equal(committer, 'Ana <ana@outfit.lab>', 'the committer is who pressed');
    assert.equal(subject, sh('2', 'log', '-1', '--format=%s', original));
    assert.ok(Number(sh('2', 'log', '-1', '--format=%ct', r.id)) > Number(sh('2', 'log', '-1', '--format=%at', r.id)), 'a new committer date');
    assert.deepEqual(await monsterOf('2'), { ...MERGED, ...CHANGES[0], ...CHANGES[1] });
    assert.ok(r.commands.some((c) => c.cmd.startsWith('GIT_AUTHOR_NAME=Raj GIT_AUTHOR_EMAIL=raj@outfit.lab GIT_AUTHOR_DATE=')),
      'the low-level steps show the kept author');

    // The original: unreachable, but still in main's reflog.
    assert.ok(sh('2', 'fsck', '--unreachable', '--no-reflogs').split('\n').includes(`unreachable commit ${original}`));
    assert.ok(sh('2', 'reflog', 'show', '--format=%H', 'refs/heads/main').split('\n').includes(original));
    const g = await git.graph('2');
    const old = g.commits.find((c) => c.id === original);
    const copy = g.commits.find((c) => c.id === r.id);
    assert.equal(old.reachable, false, 'only in the safety diary');
    assert.equal(copy.time, old.time);
    assert.equal(copy.committer, 'Ana');
    assert.ok(copy.committerTime > copy.time);
    assert.deepEqual(diary('2').slice(0, 2), [`pull --rebase (finish): refs/heads/main onto ${first}`, `commit: ${subject}`]);

    // Real git pull --rebase, with the same committer and date, writes the very same card and diary line.
    shEnv(real, committerOf('2', r.id), 'pull', '--rebase');
    assert.equal(sh(real, 'rev-parse', 'main'), r.id, 'the same ID as real Git');
    assert.equal(diary(real)[0], diary('2')[0]);

    assert.equal((await git.push(l2)).id, r.id, 'now the send is a fast-forward');
    assert.equal(sh('wall', 'log', '--format=%H', '-2', 'main'), `${r.id}\n${first}`, 'a straight line on the Wall');
    const wall = await git.graph('wall');
    assert.ok(wall.commits.every((c) => c.id !== original), 'the original never reached the Wall');
    assert.ok(wall.commits.some((c) => c.id === step4));
  });

  test('merge cards are left out, and a change already on the Wall is dropped, as real git rebase does', async () => {
    const { labs: [l1, l2, l3], original } = await refused(3);
    await git.pull(l2, RAJ); // combined once (a merge card), then refused again
    await save(l3, 'main', CHANGES[2], ANA);
    assert.ok((await git.pull(l3, ANA)).merged);
    assert.ok((await git.push(l3)).id);
    assert.equal((await git.push(l2)).rejected, true);
    const real = realCopy('2');
    const r = await git.rebase(l2, RAJ);
    assert.deepEqual(r.replaced.map((x) => x.from), [original], "only the lab's own card, not its merge card");
    assert.equal(sh('2', 'rev-list', '--count', '--merges', `${await tip('wall')}..main`), '0', 'a straight line');
    shEnv(real, committerOf('2', r.id), 'pull', '--rebase');
    assert.equal(sh(real, 'rev-parse', 'main'), r.id, 'the same ID as real Git');
    assert.ok((await git.push(l2)).id);

    // Lab 1 saves a change the Wall already has, then one more: the first is dropped, the second replayed.
    await git.pull(l1, PRIYA);
    await git.reset(l1, 'main', sh('1', 'rev-parse', 'main~1'));
    const { id: twin } = await save(l1, 'main', CHANGES[1], PRIYA);
    await save(l1, 'main', { top: 'vest' }, PRIYA);
    const real1 = realCopy('1');
    const d = await git.rebase(l1, PRIYA);
    assert.equal(d.rebased, true);
    assert.deepEqual(d.dropped, [twin]);
    assert.equal(d.replaced.length, 1);
    assert.match(d.explain, /already on the Wall, so dropped/);
    shEnv(real1, committerOf('1', d.id), 'pull', '--rebase');
    assert.equal(sh(real1, 'rev-parse', 'main'), d.id, 'real Git drops it too');
  });

  test('a card whose change the Wall already has is skipped, even where replaying it would conflict', async () => {
    const { labs: [l1, l2] } = await meetTheWall(2);
    await save(l1, 'main', { glasses: 'goggles' }, PRIYA);
    await git.push(l1);
    const { id: same } = await save(l2, 'main', { glasses: 'goggles' }, RAJ); // the same change, from the same card
    await save(l1, 'main', { glasses: 'monocle' }, PRIYA);
    await git.push(l1);
    assert.equal((await git.push(l2)).rejected, true);
    const real = realCopy('2');
    const r = await git.rebase(l2, RAJ);
    assert.equal(r.rebased, true, 'no conflict');
    assert.deepEqual(r.dropped, [same]);
    assert.deepEqual(r.replaced, []);
    assert.equal(await tip('2'), await tip('wall'));
    shEnv(real, committerOf('2', r.id), 'pull', '--rebase');
    assert.equal(sh(real, 'rev-parse', 'main'), r.id, 'real Git skips it too');
    assert.equal(diary(real)[0], diary('2')[0]);
  });

  test('a conflict waits for a person; the replay then finishes, as real git rebase --continue does', async () => {
    const { labs } = await meetTheWall(5);
    await save(labs[0], 'main', CHANGES[0], PRIYA); // HAT → crown
    const { id: original } = await save(labs[4], 'main', CHANGES[4], RAJ); // HAT → gradcap
    await git.push(labs[0]);
    const real = realCopy('5');
    const before = await tip('5');
    const r = await git.rebase(labs[4], ANA);
    assert.deepEqual(r.conflicts, ['hat']);
    assert.equal(await tip('5'), before, 'main waits');
    const open = labs[4].merging.main;
    assert.equal(open.kind, 'rebase');
    assert.equal(open.theirs, original);
    assert.equal(open.intoTip, before);
    assert.deepEqual([open.base.hat, open.ours.hat, open.theirsMonster.hat], ['tophat', 'crown', 'gradcap']);
    assert.match(open.conflictedText, new RegExp(`^<<<<<<< wall/main\nhat: crown\n=======\nhat: gradcap\n>>>>>>> ${original.slice(0, 7)}$`, 'm'));
    assert.deepEqual(gitView(open.conflictedText), { auto: open.auto, conflicts: open.conflicts });
    labs[4].drafts.main = { top: 'vest' };
    assert.equal((await git.commit(labs[4], 'main', RAJ)).merging, true, 'the replay holds main');
    labs[4].drafts.main = {};

    await aSecond();
    const done = await git.resolve(labs[4], 'main', { ...open.ours, hat: 'gradcap' }, ANA);
    assert.equal(done.rebased, true);
    assert.equal(done.porcelain, 'git add outfit.txt\ngit rebase --continue');
    assert.equal(labs[4].merging.main, undefined);
    assert.equal(sh('5', 'log', '-1', '--format=%an %at', done.id), sh('5', 'log', '-1', '--format=%an %at', original));
    assert.equal(diary('5')[0], `rebase (finish): refs/heads/main onto ${await tip('wall')}`);

    // Real Git: the same conflict, the same pick, then rebase --continue.
    assert.equal(fails(real, 'pull', '--rebase'), true, 'real Git stops too');
    fs.writeFileSync(path.join(dir(real), 'outfit.txt'), M.serialize({ ...open.ours, hat: 'gradcap' }));
    sh(real, 'add', 'outfit.txt');
    shEnv(real, { ...committerOf('5', done.id), GIT_EDITOR: 'true' }, 'rebase', '--continue');
    assert.equal(sh(real, 'rev-parse', 'main'), done.id, 'the same ID as real Git');
    assert.equal(diary(real)[0], diary('5')[0]);
  });

  test('nothing new is nothing; behind is a fast-forward; cancel leaves main where it was', async () => {
    const { labs: [l1, l2] } = await refused();
    await git.rebase(l2, ANA);
    assert.equal((await git.rebase(l2, ANA)).nothing, true);
    assert.ok((await git.push(l2)).id);
    const ff = await git.rebase(l1, PRIYA);
    assert.equal(ff.fastForward, true);
    assert.equal(diary('1')[0], 'pull --rebase: Fast-forward');
    assert.equal(await tip('1'), await tip('wall'));

    const { labs } = await meetTheWall(5);
    await save(labs[0], 'main', CHANGES[0]);
    await save(labs[4], 'main', CHANGES[4]);
    await git.push(labs[0]);
    const before = await tip('5');
    await git.rebase(labs[4], ANA);
    const cancel = await git.abort(labs[4], 'main');
    assert.equal(cancel.porcelain, 'git rebase --abort');
    assert.equal(labs[4].merging.main, undefined);
    assert.equal(await tip('5'), before);
  });

  test("pushes: when each send moved the Wall, from the lab's own reflog", async () => {
    const { labs: [, l2], first } = await refused();
    await git.rebase(l2, ANA);
    const second = (await git.push(l2)).id;
    assert.deepEqual((await git.pushes('1')).map((p) => p.id), [first]);
    const sends = await git.pushes('2');
    assert.deepEqual(sends.map((p) => p.id), [second]);
    assert.ok(Math.abs(sends[0].time - Date.now() / 1000) < 60);
  });
});

// ---------- Step 5: undo ----------

describe('undo', () => {
  test('sabotage puts one disguise card on the Wall, once', async () => {
    const { step4 } = await meetTheWall(2);
    const r = await git.wallSabotage(SABOTAGE);
    assert.equal(sh('wall', 'log', '-1', '--format=%P|%an|%ae|%s'), `${step4}|The Intern|intern@outfit.lab|Tiny style fix`);
    assert.equal((await monsterOf('wall')).glasses, 'disguise');
    assert.equal(await tip('wall'), r.id);
    assert.equal((await git.wallSabotage(SABOTAGE)).nothing, true);
    assert.equal(await tip('wall'), r.id);
  });

  test('odd labs: get the disguise, undo it with a fix card, send', async () => {
    const { labs: [l1] } = await meetTheWall(2);
    const { id: disguise } = await git.wallSabotage(SABOTAGE);
    assert.equal((await git.pull(l1, PRIYA)).fastForward, true);
    const r = await git.revert(l1, 'main', disguise, PRIYA);
    assert.equal(r.porcelain, `git revert ${disguise.slice(0, 7)}`);
    assert.equal(r.reverted, disguise);
    assert.deepEqual((await card('1', r.id)).parents, [disguise]);
    assert.deepEqual(await monsterOf('1'), MERGED);
    assert.equal(sh('1', 'log', '-1', '--format=%B', r.id), `Revert "Tiny style fix"\n\nThis reverts commit ${disguise}.`);
    assert.equal(diary('1')[0], 'revert: Revert "Tiny style fix"');
    assert.equal((await git.revert(l1, 'main', disguise, PRIYA)).nothing, true, 'already undone');
    assert.ok((await git.push(l1)).id);
    assert.equal((await monsterOf('wall')).glasses, 'round');
  });

  test('even labs: move back, send is refused, Get & combine brings the disguise back', async () => {
    const { labs: [, l2], step4 } = await meetTheWall(2);
    const { id: disguise } = await git.wallSabotage(SABOTAGE);
    await git.pull(l2, RAJ);
    const r = await git.reset(l2, 'main', step4);
    assert.equal(r.porcelain, `git reset --hard ${step4.slice(0, 7)}`);
    assert.equal(r.from, disguise);
    assert.equal(await tip('2'), step4);
    const g = await git.graph('2');
    assert.equal(g.commits.find((c) => c.id === disguise).reachable, true, 'wall/main still has it');

    const refused = await git.push(l2);
    assert.equal(refused.rejected, true);
    assert.equal(refused.reason, 'non-fast-forward');
    const zombie = await git.pull(l2, RAJ);
    assert.equal(zombie.fastForward, true);
    assert.equal((await monsterOf('2')).glasses, 'disguise', 'the zombie card is back');

    const { entries } = await git.reflog(l2, 'main');
    assert.deepEqual(entries.map((e) => e.message), [
      'merge wall/main: Fast-forward', `reset: moving to ${step4.slice(0, 7)}`, 'merge wall/main: Fast-forward', 'clone: from the Wall']);
    assert.deepEqual(entries.map((e) => e.id), [disguise, step4, disguise, step4]);
    for (const e of entries) assert.ok(Math.abs(e.time - Date.now() / 1000) < 60);
    assert.deepEqual(entries.map((e) => e.message.replace('clone: from the Wall', 'clone')),
      diary('2').map((m) => m.replace(/^clone: from .*/, 'clone')), 'the diary matches a real git reflog');
  });

  test('a card moved away from is only in the diary', async () => {
    const [lab] = await fresh(1);
    const start = await tip('1');
    const { id } = await save(lab, 'main', { hat: 'sunhat' });
    await git.reset(lab, 'main', start);
    const c = await card('1', id);
    assert.equal(c.reachable, false);
    assert.equal((await card('1', start)).reachable, true);
  });

  test('undo is refused for the Start card, cards outside the branch, and unknown IDs', async () => {
    const [lab] = await fresh(1);
    const start = await tip('1');
    await git.createBranch(lab, 'side');
    const { id: side } = await save(lab, 'side', { hat: 'sunhat' });
    assert.equal((await git.revert(lab, 'main', start, PRIYA)).refused, "The Start card can't be undone.");
    assert.equal((await git.revert(lab, 'main', side, PRIYA)).refused, "This card isn't in main's history.");
    assert.ok((await git.revert(lab, 'main', 'f'.repeat(40), PRIYA)).refused);
    assert.ok((await git.revert(lab, 'main', 'HEAD', PRIYA)).refused);
    assert.ok((await git.reset(lab, 'main', 'main~1', PRIYA)).refused);
    assert.ok((await git.reset(lab, 'main', `${start.slice(0, 39)}g`)).refused);
  });

  test('undo that conflicts opens a merge of kind revert; finishing adds one card with one parent', async () => {
    const [lab] = await fresh(1);
    const { id: sunhat } = await save(lab, 'main', { hat: 'sunhat' });
    const { id: helmet } = await save(lab, 'main', { hat: 'helmet' });
    const r = await git.revert(lab, 'main', sunhat, PRIYA);
    assert.deepEqual(r.conflicts, ['hat']);
    const open = lab.merging.main;
    assert.equal(open.kind, 'revert');
    assert.equal(open.from, sunhat);
    assert.equal(open.intoTip, helmet);
    assert.deepEqual([open.base.hat, open.ours.hat, open.theirsMonster.hat], ['sunhat', 'helmet', 'cap']);
    assert.deepEqual(gitView(open.conflictedText).conflicts, ['hat']);
    assert.match(open.conflictedText, /^<<<<<<< main$/m);
    const done = await git.resolve(lab, 'main', { ...open.ours, hat: 'cap' }, PRIYA);
    assert.deepEqual(done.parents, [helmet]);
    assert.equal(diary('1')[0], 'revert: Revert "HAT: cap → sunhat"');
    assert.equal(done.porcelain, 'git add outfit.txt\ngit revert --continue');
    await git.revert(lab, 'main', helmet, PRIYA);
    assert.equal((await git.abort(lab, 'main')).porcelain, 'git revert --abort');
  });

  test('undoing a merge card reverts against its first parent', async () => {
    const [lab] = await fresh(1);
    await twoIdeas(lab);
    await git.merge(lab, 'main', 'fancy', ANA);
    await git.merge(lab, 'main', 'sporty', ANA);
    const { id: mergeCard } = await git.resolve(lab, 'main', { ...MERGED, top: 'jersey' }, ANA);
    const r = await git.revert(lab, 'main', mergeCard, ANA);
    assert.equal(r.porcelain, `git revert -m 1 ${mergeCard.slice(0, 7)}`);
    assert.deepEqual(await monsterOf('1'), FANCY);
  });

  test('the diary of a note that does not exist is empty', async () => {
    const [lab] = await fresh(1);
    assert.deepEqual((await git.reflog(lab, 'nope')).entries, []);
  });
});

// ---------- Step 6: rewrite, audit, gc ----------

describe('rewrite', () => {
  // The boots came from Raj (in lab 1's Step 3); every lab got them at Step 4. Lab 2 then changed SHOES.
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
    assert.equal(sh('wall', 'log', '--format=%H %P|%an|%s', 'main'), `${r.id} ${start}|Ana|Clean history\n${start} |Outfit Lab|Start`);
    assert.equal(sh('wall', 'rev-parse', 'main^{tree}'), tree, "same outfit as the boss lab's main");
    assert.deepEqual(diary('3').slice(0, 2), ['commit: Clean history', `reset: moving to ${start.slice(0, 7)}`]);
    const wall = await git.graph('wall');
    assert.deepEqual(wall.commits.map((c) => c.id), [r.id, start], 'the Wall shows only reachable cards');
    const again = await git.squashForcePush(labs[2], RAJ);
    assert.equal(again.already, true, 'pressing again changes nothing');
    assert.equal(await tip('wall'), r.id);
  });

  test('audit: before, the Wall knows Raj; after the boss combines and squashes, only the other labs do; gc empties the bin', async () => {
    const labs = await beforeTheBoss();
    const raj = sh('wall', 'log', '--format=%H', '--author=Raj', 'main');
    const before = await git.audit('shoes', 'boots');
    assert.deepEqual(before.wall, { id: raj, short: raj.slice(0, 7), author: 'Raj', pid: 'raj', clean: false });
    for (const id of ['1', '2', '3']) assert.equal(before.labs[id].id, raj);
    assert.equal((await git.audit('hat', 'helmet')).wall, null, 'not found');

    await git.pull(labs[0], ANA); // the boss gets the Wall first, as in class
    await git.squashForcePush(labs[0], ANA);
    const afterSquash = await git.audit('shoes', 'boots');
    assert.equal(afterSquash.wall, null, 'the Wall: not found');
    assert.equal(afterSquash.labs['1'], null, 'the boss lab rewrote its own main too');
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

  test('audit: a clean card that still has the boots takes the credit', async () => {
    const { labs } = await meetTheWall(2);
    const clean = await git.squashForcePush(labs[0], ANA);
    const r = await git.audit('shoes', 'boots');
    assert.deepEqual(r.wall, { id: clean.id, short: clean.id.slice(0, 7), author: 'Ana', pid: 'ana', clean: true });
    assert.equal(r.labs['2'].author, 'Raj');
  });

  // The exit question: rewrite + force push + gc cleans only the Wall. A lab that kept the old history merges it
  // back on its next Get & combine, and its next send puts the old cards on the Wall again.
  test('a lab still on the old history gets the clean card with Get & combine, and merges the old cards back', async () => {
    const labs = await beforeTheBoss();
    const raj = sh('wall', 'log', '--format=%H', '--author=Raj', 'main');
    await git.pull(labs[0], ANA); // the boss gets the Wall first, as in class
    const clean = await git.squashForcePush(labs[0], ANA);
    await git.gcWall();
    assert.equal(fails('wall', 'cat-file', '-e', raj), true, "gc removed Raj's card from the Wall");
    const r = await git.pull(labs[1], RAJ);
    assert.equal(r.merged, true, 'the old history and the clean card share only Start: a merge card');
    const g = await git.graph('2');
    assert.equal(g.refs['refs/remotes/wall/main'], clean.id);
    assert.deepEqual(r.parents.slice(1), [clean.id]);
    assert.equal(fails('2', 'merge-base', '--is-ancestor', raj, 'refs/heads/main'), false, "Raj's card is still in Lab 2's main");
    const sent = await git.push(labs[1]);
    assert.ok(!sent.rejected && !sent.already, 'the send is a fast-forward of the clean card');
    assert.equal(fails('wall', 'merge-base', '--is-ancestor', raj, 'refs/heads/main'), false, "Raj's card is back on the Wall");
  });
});

// ---------- Reading ----------

describe('reading', () => {
  test('graph: refs, cards with outfits, newest first; wall/main in labs', async () => {
    const [lab] = await fresh(1);
    const start = await tip('1');
    const { id } = await save(lab, 'main', { hat: 'sunhat' }, PRIYA);
    await git.createBranch(lab, 'fancy');
    const g = await git.graph('1');
    assert.deepEqual(g.refs, { 'refs/heads/fancy': id, 'refs/heads/main': id, 'refs/remotes/wall/main': start });
    assert.deepEqual(g.commits.map((c) => c.id), [id, start]);
    assert.deepEqual(g.commits[0], {
      id, parents: [start], author: 'Priya', time: g.commits[0].time, committer: 'Priya', committerTime: g.commits[0].time,
      message: 'HAT: cap → sunhat', monster: { ...M.START, hat: 'sunhat' }, reachable: true,
    });
  });

  test('graph is cached until a git op moves a ref', async () => {
    const [lab] = await fresh(1);
    const a = await git.graph('1');
    assert.equal(await git.graph('1'), a);
    lab.drafts.main = { hat: 'sunhat' };
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
    const { id } = await save(lab, 'main', { top: 'coat' }, RAJ);
    const r = await git.inspect('1', id);
    assert.match(r.raw, new RegExp(`^tree [0-9a-f]{40}\nparent ${start}\nauthor Raj <raj@outfit.lab> \\d+ \\+0000\ncommitter Raj`));
    assert.equal(r.text, 'hat: cap\n---\nglasses: round\n---\ntop: coat\n---\nshoes: sneakers\n');
    assert.deepEqual(r.monster, { ...M.START, top: 'coat' });
    assert.deepEqual(r.commands.map((c) => c.cmd), [`git cat-file -p ${id}`, `git cat-file -p ${id}:outfit.txt`]);
    assert.equal(r.porcelain, `git cat-file -p ${id.slice(0, 7)}`);
    assert.equal((await git.inspect('wall', id)).refused, "That card isn't on the Wall.");
    assert.equal((await git.inspect('1', 'nope')).refused, "That card isn't in your lab's cards.");
    const tree = sh('1', 'rev-parse', `${id}^{tree}`);
    assert.ok((await git.inspect('1', tree)).refused, 'a tree is not a card');
  });
});

// ---------- Locks ----------

describe('locks', () => {
  test('ops on one lab run one at a time', async () => {
    const [lab] = await fresh(1);
    const notes = Array.from({ length: 6 }, (_, i) => `n${i}`);
    const results = await Promise.all(notes.map((n) => git.createBranch(lab, n)));
    assert.ok(results.every((r) => r.id));
    lab.drafts.main = { hat: 'sunhat' };
    const saves = await Promise.all([git.commit(lab, 'main', PRIYA), git.commit(lab, 'main', RAJ)]);
    assert.equal(saves.filter((r) => r.id).length, 1, 'the second save finds nothing left to save');
    assert.equal(saves.filter((r) => r.nothing).length, 1);
  });

  test('a lab op and a Wall op wait for each other, lab lock first', async () => {
    const [lab] = await fresh(1);
    lab.drafts.main = { hat: 'sunhat' };
    const [saved, sent] = await Promise.all([git.commit(lab, 'main', PRIYA), git.push(lab)]);
    assert.ok(saved.id);
    assert.equal(sent.id, saved.id, 'the send ran after the save, inside the lab lock');
  });
});
