// The class session (server/session.js) with real Git: lab assignment, the practice lab, the scene
// script, answers, takeaways and export, predictions, the labs' own choices, the Switch refusal and the
// two-level hints. A bot plays whole classes by following only the hints' clicks, so every step is proven
// finishable without a teacher.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'outfit-lab-session-'));
process.env.DATA_DIR = DATA;
delete process.env.LABS;
const session = await import('../server/session.js');
const {
  SCENES, STEPS, DONE_LINE, CARDS, TRUST_LINE, ONE_REPO_LINE, SWITCH_UNSAVED, PAPER, NOT_CHOSEN, UNDO_NOT_CHOSEN, WAYS,
} = await import('../server/steps.js');
const { movesFor } = await import('../server/bots.js'); // the rehearsal bots' hint reader: each hint names one click

before(() => session.boot());
after(() => {
  session.flush();
  fs.rmSync(DATA, { recursive: true, force: true });
});

const URL = 'http://class.test/';
const adminState = () => session.adminState(URL);
const ok = (r) => {
  assert.equal(r.ok, true, r.error);
  return r;
};
const next = async () => ok(await session.admin('next', {}));
const reset = async () => ok(await session.admin('reset', {}));

// n people join and keep their page open (online).
async function joinAll(names) {
  const pids = [];
  for (const name of names) {
    const r = ok(await session.join({ name }));
    session.connect(r.pid);
    pids.push(r.pid);
  }
  return pids;
}

// Everyone follows their hint until every real lab's goals tick. Returns the refusals students met.
async function playStep(pids) {
  const refusals = [];
  for (let round = 0; round < 25; round++) {
    let acted = false;
    for (const pid of pids) {
      const st = await session.state(pid);
      if (!st.me.hint) continue;
      for (const [action, input] of movesFor(st.me.hint.click, st)) {
        const r = await session.act(action, { pid, ...input });
        if (!r.ok) refusals.push(r.error);
        acted = true;
      }
    }
    const labs = (await adminState()).labs.filter((l) => !l.practice);
    if (labs.every((l) => l.done)) {
      for (const pid of pids) {
        const st = await session.state(pid);
        assert.equal(st.me.hint, null, 'a finished lab gets no hint');
        assert.equal(st.session.steps[st.session.step].doneLine, DONE_LINE);
      }
      return refusals;
    }
    assert.ok(acted, `everyone is waiting, but Step ${(await adminState()).session.step} is not done`);
  }
  throw new Error('a step did not finish in 25 rounds');
}

// The whole class, scene by scene. Every student answers each question and writes each takeaway.
async function playClass(pids) {
  const met = {};
  for (;;) {
    const scene = (await adminState()).session.scene;
    if (scene.kind === 'task' && scene.step === 0) {
      for (const pid of pids) ok(await session.act('chaos', { pid, part: 'hat', value: 'helmet' }));
    } else if (scene.kind === 'task') {
      met[scene.step] = await playStep(pids);
    }
    if (scene.answerable) for (const pid of pids) ok(await session.act('answer', { pid, scene: scene.id, text: `answer ${scene.id}` }));
    if (scene.takeawayStep !== null) for (const pid of pids) ok(await session.act('takeaway', { pid, step: scene.takeawayStep, text: `takeaway ${scene.takeawayStep}` }));
    if (scene.id === 'reveal-4') met.integration = (await session.state(pids[0])).session.integration;
    if (scene.kind === 'wrap') return met;
    await next();
  }
}

const REFUSED = /^Refused: /;
const REFUSED_CHOOSE = "Refused: the Wall has cards your main doesn't. Choose a way to get them: Get & combine (merge) or Replay on top (rebase). Then send again.";
const refusals = (met) => Object.entries(met).filter(([k]) => /^\d$/.test(k)).flatMap(([, list]) => list);

// ---------- Tests ----------

describe('lab assignment', () => {
  test('lab count from the headcount', () => {
    const want = { 1: 1, 3: 1, 4: 2, 5: 2, 8: 2, 9: 3, 12: 3, 13: 4, 16: 4, 17: 5, 21: 6, 40: 6 };
    for (const [people, labs] of Object.entries(want)) assert.equal(session.labsFor(Number(people)), labs, `${people} people`);
  });

  test('1–3 people: one lab plus the practice lab; more people grow the labs, balanced, pairs alternating', async () => {
    await reset();
    const pids = await joinAll(['Ana', 'Ben']);
    let { session: s } = await session.state(pids[0]);
    assert.deepEqual(s.labs.map((l) => [l.id, l.name, l.practice, l.members]), [['1', 'Lab 1', false, 2], ['2', 'Practice lab', true, 0]]);
    pids.push(...await joinAll(['Cat', 'Dan', 'Eve', 'Fay', 'Gus']));
    s = (await session.state(pids[0])).session;
    assert.deepEqual(s.labs.map((l) => l.practice), [false, false], 'seven people: two real labs, no practice lab');
    assert.deepEqual(s.labs.map((l) => l.members).sort(), [3, 4]);
    for (const lab of (await adminState()).labs) {
      assert.deepEqual(lab.members.map((m) => m.pair), ['A', 'B', 'A', 'B'].slice(0, lab.members.length));
    }
  });

  test('twelve people joining at once land in three labs of four', async () => {
    await reset();
    const rs = await Promise.all(Array.from({ length: 12 }, (_, i) => session.join({ name: `P${i}` })));
    assert.ok(rs.every((r) => r.ok));
    assert.deepEqual((await adminState()).labs.map((l) => l.members.length), [4, 4, 4]);
  });

  test('the same name from a new browser gets its place back, but never takes an online person', async () => {
    await reset();
    const first = ok(await session.join({ name: 'Priya' }));
    assert.equal(ok(await session.join({ name: ' priya ' })).pid, first.pid, 'offline: back in her place');
    session.connect(first.pid);
    assert.notEqual(ok(await session.join({ name: 'Priya' })).pid, first.pid, 'online: a second Priya');
  });

  test('the teacher sets the count before Step 1, or goes back to auto; then labs lock', async () => {
    await reset();
    const pids = await joinAll(['A1', 'A2', 'A3', 'A4', 'A5']);
    assert.match(ok(await session.admin('labs', { count: 1 })).result.message, /1 lab, plus the practice lab/);
    assert.equal((await adminState()).labs.filter((l) => !l.practice)[0].members.length, 5);
    ok(await session.admin('labs', { count: 'auto' }));
    assert.deepEqual((await adminState()).labs.map((l) => l.members.length).sort(), [2, 3]);
    assert.equal((await session.admin('labs', { count: 7 })).ok, false);
    await next(); // Step 0
    await next();
    await next(); // Step 1
    assert.equal((await session.admin('labs', { count: 2 })).error, 'Labs lock at Step 1.');
    for (let i = 0; i < 3; i++) await session.admin('back', {}); // back to the join scene
    assert.equal((await session.admin('labs', { count: 2 })).ok, false, 'still locked after Back');
    const before = (await adminState()).labs.map((l) => l.id);
    await joinAll(['B1', 'B2', 'B3', 'B4', 'B5']);
    assert.deepEqual((await adminState()).labs.map((l) => l.id), before, 'joins after Back never change the labs');
    for (let i = 0; i < 3; i++) await next();
    const late = ok(await session.join({ name: 'Late' }));
    assert.ok(['1', '2'].includes(late.labId), 'a late joiner goes to a real lab');
    assert.equal((await session.admin('move', { pid: pids[0], labId: '9' })).ok, false);
  });
});

describe('the scene script', () => {
  test('one Next per scene, in the planned order and clock; a double press never skips', async () => {
    await reset();
    assert.deepEqual(SCENES.map((s) => s.id), ['join', 'task-0', 'reveal-0', 'task-1', 'reveal-1', 'task-2', 'reveal-2',
      'task-3', 'reveal-3', 'break', 'task-4', 'reveal-4', 'task-5', 'reveal-5', 'task-6', 'reveal-6', 'paper', 'exit', 'wrap']);
    const last = SCENES.at(-1);
    assert.equal(last.at + last.minutes, 77, '77 minutes of class + 3 of buffer = 80');
    const at = Object.fromEntries(SCENES.map((s) => [s.id, [s.at, s.minutes]]));
    assert.deepEqual([at['reveal-0'], at['task-1'], at['reveal-1']], [[4.5, 2], [6.5, 3], [9.5, 2.5]], 'Steps 0–1 are 3 minutes shorter');
    assert.deepEqual([at['task-3'][1], at['task-4'][1], at['task-5'][1]], [8, 9, 7], 'the 3 minutes go to predicting and choosing');
    const { session: s } = await adminState();
    assert.equal(s.scene.id, 'join');
    assert.deepEqual(s.scene.next, { n: 1, title: 'Step 0 · Everyone edits the same outfit', note: null });
    ok(await session.admin('next', { from: 0 }));
    assert.equal(ok(await session.admin('next', { from: 0 })).result.unchanged, true, 'a stale second press');
    assert.equal((await adminState()).session.scene.id, 'task-0');
    ok(await session.admin('back', { from: 1 }));
    assert.equal((await adminState()).session.scene.id, 'join');
  });

  test('every scene has what the console and projector need; reveals are the slide content', () => {
    const cards = SCENES.filter((s) => s.kind === 'reveal').map((s) => s.reveal.cards.map((c) => c.command));
    assert.deepEqual(cards, [[], ['git commit'], ['git branch'], ['git merge'], ['git push / git pull', 'git rebase'],
      ['git revert / git reset'], ['Squash + git push --force']], 'one technical card per tool');
    for (const s of SCENES) {
      assert.ok(s.title && s.say && Number.isFinite(s.minutes), s.id);
      if (s.kind === 'reveal') {
        assert.deepEqual(Object.keys(s.reveal).sort(), ['behind', 'cards', 'note', 'sentence'], s.id);
        assert.ok(s.ask.q && s.ask.a, s.id);
        assert.ok(s.step === 0 ? s.reveal.sentence && s.reveal.behind : s.reveal.cards.length, s.id);
        for (const c of s.reveal.cards) assert.deepEqual(Object.keys(c), ['command', 'is', 'does', 'how'], s.id);
        assert.match(s.board, new RegExp(`^${s.step}\\. `), s.id);
        assert.equal(s.takeawayStep, s.step);
      }
      const shown = [s.say, s.do, s.ask?.q, s.reveal?.sentence, s.reveal?.behind, s.reveal?.note, s.line,
        ...(s.reveal?.cards ?? []).flatMap((c) => [c.is, c.does, c.how])];
      for (const text of [...shown, s.ask?.a].filter(Boolean)) {
        assert.doesNotMatch(text, /monster|\bface\b|\bbody\b|\blegs\b|tentacle|mustache/i, `${s.id}: ${text}`);
      }
      // The words the room hears or reads (the folded answer is the teacher's note).
      for (const text of shown.filter(Boolean)) {
        assert.doesNotMatch(text, /\b(simply|basically|clearly|obviously|easy|magic|seamless|robust)\b/i, `${s.id}: ${text}`);
      }
    }
    assert.equal(SCENES.find((s) => s.id === 'reveal-1').reveal.note, TRUST_LINE);
    assert.equal(SCENES.find((s) => s.id === 'reveal-2').reveal.note, ONE_REPO_LINE, 'Step 2 names the one-repo simplification');
    assert.equal(TRUST_LINE, 'Git records the name and clock your laptop gives it, and checks neither.');
    assert.equal(CARDS.rebase.how, 'For each of your commits, Git applies its change to the new base and writes a new commit. The new parent gives it a new ID. The author and author date are kept; the committer date is new. The originals become unreachable and stay in your reflog for a while.');
    for (const step of STEPS) {
      for (const tip of step.tips) assert.ok(tip.text.split(' ').length <= 10, tip.text);
      assert.doesNotMatch(JSON.stringify(step.behind ?? '') + step.instruction + (step.screen ?? ''), /monster|tentacle|mustache/i);
    }
  });
});

describe('a whole class, by hints alone', () => {
  test('one student: a lab of one with the practice lab meets every lesson', async () => {
    await reset();
    const [me] = await joinAll(['Solo']);
    for (let i = 0; i < 5; i++) await next(); // join → Step 2's task
    const st = await session.state(me);
    assert.equal(st.me.both, true);
    assert.match(st.me.mission, /^You do both pairs today\./);
    for (let i = 0; i < 5; i++) ok(await session.admin('back', {}));

    const met = await playClass([me]);
    assert.ok(met[4].includes(REFUSED_CHOOSE), 'Step 4: the practice lab got there first, so the send was refused, and the lab chooses');
    assert.ok(met[5].some((e) => /still has the 🥸 card/.test(e)), 'Step 5: moving back was refused');
    assert.ok(refusals(met).every((e) => REFUSED.test(e)), `only refused sends: ${refusals(met)}`);

    const a = await adminState();
    assert.ok(a.feed.some((e) => e.who === 'Practice lab' && e.action === 'Send to Wall'));
    assert.equal(a.labs[0].way, 'rebase', 'the one real lab chose to replay on top (the bot rule for a lone refusable lab)');
    assert.equal(a.labs[0].undo, 'reset', 'a lab alone moved its branch back first (the bot rule), and met the refusal');
    assert.ok(a.feed.some((e) => e.labId === '1' && e.action === 'Replay on top' && /→/.test(e.outcome)));
    assert.ok(a.feed.some((e) => e.labId === '1' && e.action === 'Delete branch fancy'));
    const paths = met.integration.paths;
    assert.equal(met.integration.live, true);
    assert.deepEqual(paths.map((p) => [p.name, p.copy]), [['Practice lab', false], ['Lab 1', true]]);
    const [practice, mine] = paths;
    assert.ok(mine.original && !mine.cards.includes(mine.original), "the rebased lab's original card is not on the Wall");
    assert.deepEqual(mine.cards, [mine.cards[0]], 'the path is the copy alone: the lab sent it');
    const wallCard = (id) => met.integration.graph.commits.find((c) => c.id === id);
    assert.deepEqual(wallCard(mine.cards[0]).parents, [practice.cards.at(-1)], 'a straight line: the copy sits on the practice card');
    for (const p of paths) assert.ok(p.made <= p.onWall && p.onWall <= Date.now() / 1000, 'real times: made, then on the Wall');
    const before = a.session.audits.before.rows;
    const after = a.session.audits.after.rows;
    assert.match(before[0].text, /^Wall: Solo \(Lab 1\), [0-9a-f]{7}$/);
    assert.equal(after[0].text, 'Wall: not found');
    assert.match(after.find((r) => r.where === 'Practice lab').text, /^Practice lab: Solo \(Lab 1\)/, 'the practice lab still knows');
  });

  test('two students share one lab, one per pair, next to the practice lab', async () => {
    await reset();
    const pids = await joinAll(['Ana', 'Ben']);
    const st = await session.state(pids[1]);
    assert.equal(st.me.pair, 'B');
    assert.equal(st.me.both, false);
    const met = await playClass(pids);
    assert.ok(met[4].some((e) => REFUSED.test(e)));
    assert.ok(refusals(met).every((e) => REFUSED.test(e)), `only refused sends: ${refusals(met)}`);
  });

  test('nine students in three labs; answers, takeaways, the projector and export', async () => {
    await reset();
    const pids = await joinAll(['Ana', 'Ben', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy']);
    const met = await playClass(pids);
    assert.equal(met[4].filter((e) => e === REFUSED_CHOOSE).length, 2, 'Step 4: each refused lab is told to choose a way; the app assigns none');
    assert.ok(refusals(met).every((e) => REFUSED.test(e)), `only refused sends: ${refusals(met)}`);

    const st = await session.state(pids[0]);
    assert.equal(st.session.scene.kind, 'wrap');
    assert.deepEqual(st.me.gitIn7.map((l) => [l.step, l.text]), [0, 1, 2, 3, 4, 5, 6].map((n) => [n, `takeaway ${n}`]));
    assert.equal(st.me.answers.exit, 'answer exit');

    const a = await adminState();
    assert.deepEqual(a.labs.map((l) => l.way ?? 'first').sort(), ['first', 'merge', 'rebase'], 'the first lab to send just sent; the others chose');
    assert.deepEqual(a.labs.map((l) => l.undo), ['revert', 'reset', 'revert'], 'Step 5: each lab chose its own undo');
    const paths = met.integration.paths;
    assert.equal(paths.length, 3);
    assert.equal(paths[0].labId, a.labs.find((l) => !l.way).id, 'in the order they reached the Wall');
    assert.ok(paths.every((p, i) => i === 0 || paths[i - 1].onWall <= p.onWall));
    const copy = paths.find((p) => p.copy);
    assert.equal(copy.labId, a.labs.find((l) => l.way === 'rebase').id, 'only the replayed change starts at a copy');
    assert.equal(paths.filter((p) => p.copy).length, 1);
    for (const p of paths) assert.ok(p.made <= p.onWall, `${p.name}: made, then on the Wall`);
    // The paper shows the same paths after the squash has emptied the Wall.
    await session.admin('back', {});
    await session.admin('back', {}); // the paper
    const paper = (await session.state(pids[0])).session;
    assert.equal(paper.scene.id, 'paper');
    assert.equal(paper.integration.live, false);
    assert.deepEqual(paper.integration.paths, paths);
    assert.ok((await adminState()).wall.graph.commits.length === 2, 'while the Wall itself has only Start and the clean card');
    await next();
    await next();
    assert.equal(a.projector.takeaways.length, 12, 'a sample of the takeaways');
    assert.ok(a.projector.takeaways.every((t) => !('name' in t)), 'names hidden');
    assert.ok(a.session.scene.tools.includes('export'));

    const md = await session.exportMarkdown();
    assert.match(md, /^# Outfit Lab · answers and takeaways/);
    assert.match(md, /### Step 3 · Combine two branches\n\n\*\*Ask:\*\* Which cards were made on fancy\?/);
    assert.match(md, /- Gus \(Lab \d\): takeaway 6/);
    assert.match(md, /### Gus · Lab \d\n\nMy Git in 7 lines:\n0\. takeaway 0\n1\. takeaway 1/);
    assert.match(md, /## Predictions\n\n### Step 3 · Combine two branches\n\nPredicted right: \d+ of \d+ · merge fancy \d+\/\d+ · merge sporty \d+\/\d+/);
    assert.match(md, /- \w+ \(Lab \d\) \(pressed\): You predicted: conflict on TOP\. Git: conflict on TOP\. ✓/);
    assert.match(md, /## Choices\n\n- Lab 1 · Step 4: /);
  });
});

describe('questions and takeaways', () => {
  test('answers open at their scene, show on the projector without names unless asked, and count live', async () => {
    await reset();
    const pids = await joinAll(['Ana', 'Ben', 'Cat']);
    assert.equal((await session.act('answer', { pid: pids[0], scene: 'reveal-0', text: 'early' })).ok, false, 'not reached yet');
    await next();
    await next(); // reveal-0
    ok(await session.act('answer', { pid: pids[0], scene: 'reveal-0', text: '  Save   every version  ' }));
    ok(await session.act('answer', { pid: pids[1], scene: 'reveal-0', text: 'x'.repeat(500) }));
    let a = await adminState();
    assert.equal(a.session.scene.answers.count, 2);
    assert.equal(a.session.scene.answers.of, 3);
    assert.equal(a.session.scene.answers.list[0].text, 'Save every version');
    assert.equal(a.session.scene.answers.list[1].text.length, 280);
    assert.equal(a.projector.answers, null, 'hidden until the teacher shows them');
    ok(await session.admin('answers', { on: true }));
    a = await adminState();
    assert.deepEqual(a.projector.answers[0], { text: 'Save every version' });
    assert.equal(a.projector.question, SCENES[2].ask.q);
    ok(await session.admin('answers', { on: true, names: true }));
    assert.deepEqual((await adminState()).projector.answers[0], { name: 'Ana', text: 'Save every version' });
    ok(await session.act('answer', { pid: pids[0], scene: 'reveal-0', text: '' }));
    assert.equal((await adminState()).session.scene.answers.count, 1, 'an empty answer removes it');
    await next();
    assert.equal((await adminState()).projector.answers, null, 'Next takes the answers down');
    assert.equal((await session.admin('answers', { on: true })).ok, false, 'a task scene has no answers');
  });

  test('takeaways open at each reveal (Steps 0–6), at most 100 characters, editable', async () => {
    await reset();
    const [pid] = await joinAll(['Ana']);
    for (let i = 0; i < 3; i++) await next(); // task-1
    assert.equal((await session.act('takeaway', { pid, step: 1, text: 'too early' })).ok, false);
    await next(); // reveal-1
    ok(await session.act('takeaway', { pid, step: 1, text: 'y'.repeat(150) }));
    ok(await session.act('takeaway', { pid, step: 1, text: 'A card never changes.' }));
    ok(await session.act('takeaway', { pid, step: 0, text: 'Save every version.' }));
    assert.equal((await session.act('takeaway', { pid, step: 7, text: 'no' })).ok, false, 'the wrap has no takeaway');
    const st = await session.state(pid);
    assert.equal(st.session.scene.takeawayStep, 1);
    assert.deepEqual(st.me.gitIn7[0], { step: 0, title: 'Everyone edits the same outfit', text: 'Save every version.', board: SCENES[2].board });
    assert.deepEqual(st.me.gitIn7[1], { step: 1, title: 'Save every version', text: 'A card never changes.', board: SCENES[4].board });
    assert.equal(st.me.gitIn7[2].text, '');
    assert.deepEqual((await adminState()).session.scene.takeaways, { count: 1, of: 1 });
  });
});

describe('Step 3: delete the fancy branch', () => {
  test("only once the branch you're on has its cards; never the branch you're on; never main", async () => {
    await reset();
    const [ana, ben] = await joinAll(['Ana', 'Ben']);
    for (let i = 0; i < 5; i++) await next(); // Step 2's task
    await playStep([ana, ben]);
    for (let i = 0; i < 2; i++) await next(); // Step 3's task
    ok(await session.act('switch', { pid: ana, branch: 'main' }));
    ok(await session.act('switch', { pid: ben, branch: 'fancy' }));
    assert.equal((await session.act('deleteNote', { pid: ana, note: 'fancy' })).error,
      "Refused: fancy has cards main doesn't have. Deleting it could lose them. Merge it first.");
    assert.equal((await session.act('deleteNote', { pid: ben, note: 'fancy' })).error, "You're on fancy. Switch to main first.");
    assert.equal((await session.act('deleteNote', { pid: ana, note: 'main' })).error, 'main stays. Pick another branch.');
    let st = await session.state(ana);
    assert.equal(st.me.mission, null);
    assert.equal(st.me.hint.click, 'Press **Merge fancy into main**.');

    ok(await session.act('merge', { pid: ana, from: 'fancy', guess: 'ff' }));
    st = await session.state(ana);
    assert.equal(st.me.mission, 'Delete the fancy branch (`git branch -d fancy`).');
    assert.equal(st.me.hint.click, 'Press **Delete branch** and pick **fancy**.');
    const r = ok(await session.act('deleteNote', { pid: ana, note: 'fancy' }));
    assert.equal(r.result.message, 'Deleted the fancy branch. Its cards stay.');
    assert.equal(r.op.porcelain, 'git branch -d fancy');
    assert.equal((await session.state(ana)).me.mission, null, 'the mission goes once the branch is deleted');
    st = await session.state(ben);
    assert.equal(st.me.branch, 'main', "Ben's pin went back to main");
    assert.equal(st.lab.branches.fancy, undefined);
    assert.deepEqual(st.lab.goals.map((g) => g.done), [true, true, false]);
    assert.equal(st.me.hint.click, 'Press **Merge sporty into main**.');
    assert.equal((await session.act('deleteNote', { pid: ana, note: 'fancy' })).error, 'That branch does not exist.');
  });

  test('Rescue merges fancy, deletes its branch, then merges sporty', async () => {
    await reset();
    await joinAll(['Ana', 'Ben']);
    for (let i = 0; i < 7; i++) await next(); // Step 3's task
    ok(await session.admin('rescue', { labId: '1' }));
    const a = await adminState();
    assert.equal(a.labs[0].done, true);
    assert.deepEqual(a.feed.filter((e) => e.labId === '1' && /^(Merge|Delete)/.test(e.action)).map((e) => e.action).reverse(),
      ['Merge fancy into main', 'Delete branch fancy', 'Merge sporty into main']);
  });
});

describe('Steps 4 and 5: the Wall', () => {
  test('Step 4 names whose outfit the Wall starts as; the way leaves the mission once the lab is done', async () => {
    await reset();
    const pids = await joinAll(['Ana', 'Ben', 'Cat', 'Dan']);
    for (let i = 0; i < 10; i++) await next(); // Step 4's task
    const wallLab = (await adminState()).session.stepLab[4];
    for (const pid of pids) {
      const st = await session.state(pid);
      const says = st.lab.id === wallLab ? "The Wall started from your lab's outfit" : `The Wall started from Lab ${wallLab}'s outfit`;
      assert.match(st.session.steps[4].instruction, new RegExp(`${says}, so your lab's cards are now a copy of that history\\.`));
    }
    for (const pid of pids) {
      const st = await session.state(pid);
      assert.equal(st.session.steps[4].fresh, st.lab.id === wallLab ? STEPS[4].fresh.wallLab : `Your lab now starts from the Wall, which holds Lab ${wallLab}'s history. The cards your lab made in Steps 1 to 3 are not in this fresh copy.`,
        'Step 4 says plainly what the fresh copy of the Wall holds');
    }
    await playStep(pids);
    for (const pid of pids) assert.doesNotMatch((await session.state(pid)).me.mission, /refused|chose/, 'done: no way in the mission');
  });

  test('entering Step 5 gives every lab the card; a lab that gets the fix from another lab still undoes it itself', async () => {
    await reset();
    const pids = await joinAll(['Ana', 'Ben', 'Cat', 'Dan', 'Eve', 'Fay']);
    ok(await session.admin('labs', { count: 3 }));
    for (let i = 0; i < 10; i++) await next(); // Step 4's task
    await playStep(pids);
    await next(); // reveal-4
    const pulls = Object.fromEntries((await adminState()).labs.map((l) => [l.id, l.concepts.pull ?? 0]));
    await next(); // Step 5's task
    const a = await adminState();
    const wall = a.wall.graph.refs['refs/heads/main'];
    assert.equal(a.wall.graph.commits.find((c) => c.id === wall).author, 'The Intern');
    for (const lab of a.labs) {
      assert.equal(lab.graph.refs['refs/heads/main'], wall, `${lab.name} holds the card: a fast-forward, no new card`);
      assert.ok(a.feed.some((e) => e.labId === lab.id && e.who === 'Teacher' && e.action === 'Get & combine' && e.outcome === 'fast-forward'));
      assert.equal(lab.concepts.pull ?? 0, pulls[lab.id], 'the hand-out is not counted as a student pull');
    }
    const [one, two, three] = a.labs.map((l) => pids.find((pid) => session.labOf(pid) === l.id));
    const st = await session.state(three);
    assert.equal(st.session.steps[5].instruction, "A 🥸 card reached the Wall, and every lab now has it. Remove it without breaking anyone's copy. Your lab chooses how. Predict before each send.");
    assert.match(st.me.mission, /^Your lab has the 🥸 card\. Choose one way to remove it: /);
    assert.match(st.me.hint.click, /press \*\*Undo this card\*\*, or click the card right before it and press \*\*Move my branch back here\*\*\.$/, 'the hint offers both undos');
    // Lab 1 undoes and sends. Labs 2 and 3 take that fix with Get & combine before undoing anything.
    for (let i = 0; i < 10 && (await session.state(one)).me.hint; i++) {
      const now = await session.state(one);
      for (const [action, input] of movesFor(now.me.hint.click, now)) ok(await session.act(action, { pid: one, ...input }));
    }
    assert.equal((await session.state(one)).lab.done, true);
    for (const pid of [two, three]) ok(await session.act('pull', { pid }));
    let mine = await session.state(three);
    assert.equal(mine.lab.done, false, 'no 🥸 left, but this lab has not undone anything');
    assert.deepEqual(mine.lab.goals.map((g) => g.done), [false, true]);
    assert.equal(mine.me.hint.click, 'Click the 🥸 card. Press **Undo this card**.', 'its 🥸 is already fixed: only a fix card makes sense');
    // Lab 3 follows its hint: the change is already undone, and that counts as its undo.
    const [[action, input]] = movesFor(mine.me.hint.click, mine);
    assert.equal(ok(await session.act(action, { pid: three, ...input })).result.message, 'Already undone. Nothing to change.');
    mine = await session.state(three);
    assert.equal(mine.lab.done, true);
    assert.equal(mine.me.mission, null, 'done: the mission goes');
    // Lab 2 is rescued: Rescue undoes the card for it.
    ok(await session.admin('rescue', { labId: session.labOf(two) }));
    assert.equal((await session.state(two)).lab.done, true);
    await reset();
    ok(await session.admin('labs', { count: 'auto' })); // the next tests count labs from the headcount again
  });
});

// ---------- Predict before you act; students choose; Switch keeps unsaved parts; hints give the idea first ----------

const inLab = (pids, id) => pids.filter((pid) => session.labOf(pid) === id);
const verdictOf = async (pid) => (await session.state(pid)).me.verdict?.line;

describe('predict before you act', () => {
  test('Step 3: Merge waits for a prediction; lab-mates may predict; Git scores everyone; the console and reveal count', async () => {
    await reset();
    const [ana, ben, cat] = await joinAll(['Ana', 'Ben', 'Cat']);
    for (let i = 0; i < 5; i++) await next(); // Step 2's task
    await playStep([ana, ben, cat]);
    for (let i = 0; i < 2; i++) await next(); // Step 3's task
    for (const pid of [ana, ben, cat]) ok(await session.act('switch', { pid, branch: 'main' }));
    let st = await session.state(ben);
    assert.deepEqual(st.lab.moments.map((m) => [m.id, m.kind, m.target, m.mine]), [['3:1:merge:fancy', 'merge', 'fancy', null], ['3:1:merge:sporty', 'merge', 'sporty', null]]);
    assert.equal(st.lab.moments[0].q, 'What will Git do?');
    assert.deepEqual(st.lab.moments[0].options.map((o) => o.words),
      ['Fast-forward', 'Merge, no conflict', 'Conflict on HAT', 'Conflict on GLASSES', 'Conflict on TOP', 'Conflict on SHOES']);
    ok(await session.act('predict', { pid: ben, moment: '3:1:merge:fancy', guess: 'ff' }));
    ok(await session.act('predict', { pid: cat, moment: '3:1:merge:fancy', guess: 'clean' }));
    assert.equal((await session.act('predict', { pid: cat, moment: '3:1:merge:fancy', guess: 'maybe' })).ok, false);
    assert.equal((await session.state(cat)).lab.moments[0].mine, 'clean');
    const main = st.lab.branches.main;
    const first = await session.act('merge', { pid: ana, from: 'fancy' });
    assert.deepEqual([first.ok, first.error, first.predict], [false, 'Predict first.', '3:1:merge:fancy'], "Git waits for the presser's prediction");
    assert.equal((await session.state(ana)).lab.branches.main, main, 'nothing ran');
    ok(await session.act('merge', { pid: ana, from: 'fancy', guess: 'conflict:top' }));
    assert.equal(await verdictOf(ana), 'You predicted: conflict on TOP. Git: fast-forward. Why: main had no new card since the split, so Git only slid its branch.');
    assert.equal(await verdictOf(ben), 'You predicted: fast-forward. Git: fast-forward. ✓');
    assert.equal((await session.act('predict', { pid: ben, moment: '3:1:merge:fancy', guess: 'ff' })).error, 'Git already answered this one.');
    assert.deepEqual((await session.state(cat)).lab.moments.map((m) => m.target), ['sporty'], 'next to predict: merge sporty');
    let a = await adminState();
    assert.deepEqual(a.session.predictions, {
      step: 3, right: 1, total: 3, waiting: 0, parts: [{ label: 'merge fancy', right: 1, total: 3 }], line: 'Predicted right: 1 of 3 · merge fancy 1/3',
    });
    ok(await session.act('deleteNote', { pid: ana, note: 'fancy' }));
    ok(await session.act('predict', { pid: cat, moment: '3:1:merge:sporty', guess: 'conflict:top' }));
    assert.equal((await adminState()).session.predictions.waiting, 1, 'the console sees a prediction waiting for Git');
    assert.equal(ok(await session.act('merge', { pid: ben, from: 'sporty', guess: 'clean' })).result.conflict, true);
    assert.equal(await verdictOf(cat), 'You predicted: conflict on TOP. Git: conflict on TOP. ✓');
    assert.match(await verdictOf(ben), /^You predicted: merge, no conflict\. Git: conflict on TOP\. Why: TOP changed on both sides since the split;/);
    // After Cancel, merging again asks nothing: Git already answered.
    ok(await session.act('abort', { pid: ben }));
    const again = ok(await session.act('merge', { pid: ana, from: 'sporty' }));
    assert.equal(again.result.conflict, true);
    const open = (await session.state(ana)).lab.merging.main;
    ok(await session.act('resolve', { pid: ana, monster: { ...open.auto, top: 'tie' } }));
    await next(); // reveal-3
    a = await adminState();
    assert.deepEqual(a.projector.scene.facts, ['Predicted right: 2 of 5 · merge fancy 1/3 · merge sporty 1/2'], 'the projector shows the accuracy');
    assert.deepEqual((await session.state(cat)).session.scene.facts, a.projector.scene.facts, 'and so does the app');
  });

  test('Steps 4–5: Send waits for a prediction; refused labs choose a way and say why; the reveals show choices and the way nobody chose', async () => {
    await reset();
    const pids = await joinAll(['Ana', 'Ben', 'Cat', 'Dan']);
    for (let i = 0; i < 10; i++) await next(); // Step 4's task
    const [one, two] = [inLab(pids, '1'), inLab(pids, '2')];
    ok(await session.act('draft', { pid: one[0], part: 'hat', value: 'crown' }));
    ok(await session.act('commit', { pid: one[0] }));
    assert.equal((await session.act('push', { pid: one[0] })).predict, '4:1:push:1');
    assert.deepEqual((await session.state(one[1])).lab.moments[0].options.map((o) => o.words), ['Yes', "No, the Wall has cards we don't"]);
    ok(await session.act('predict', { pid: one[1], moment: '4:1:push:1', guess: 'refused' }));
    ok(await session.act('push', { pid: one[0], guess: 'accepted' }));
    assert.equal(await verdictOf(one[0]), 'You predicted: accepted. Git: accepted. ✓');
    assert.equal(await verdictOf(one[1]), "You predicted: refused. Git: accepted. Why: the Wall's newest card was already in your main's history, so the Wall only moved forward.");
    assert.equal((await session.state(one[0])).lab.moments[0].id, '4:1:push:2', 'the next send is a new prediction');

    ok(await session.act('draft', { pid: two[0], part: 'shoes', value: 'skates' }));
    ok(await session.act('commit', { pid: two[0] }));
    assert.equal((await session.act('push', { pid: two[0], guess: 'accepted' })).error, REFUSED_CHOOSE);
    let st = await session.state(two[0]);
    assert.equal(st.me.verdict.line, "You predicted: accepted. Git: refused (fetch first). Why: the Wall has cards your main doesn't, so the send is not a fast-forward.");
    assert.match(st.me.mission, /The Wall refused your send\. Choose how to get its cards: \*\*Combine \(merge\)\*\* or \*\*Replay on top \(rebase\)\*\*/);
    assert.equal(st.lab.way, null, 'the app assigns no way');
    assert.equal(st.me.hint.click, 'Pick a way: press **Get & combine** (merge) or **Replay on top** (rebase). Then **Send to Wall** again.');
    assert.deepEqual(st.session.steps[4].choices.ways, WAYS, 'both ways, one plain line each');
    assert.equal((await session.act('why', { pid: two[0], text: 'early' })).ok, false, 'why waits for a choice');
    ok(await session.act('rebase', { pid: two[1] }));
    st = await session.state(two[0]);
    assert.equal(st.lab.way, 'rebase');
    assert.match(st.me.mission, /Your lab chose \*\*Replay on top \(rebase\)\*\*/);
    ok(await session.act('why', { pid: two[0], text: '  A straight line   reads better  ' }));
    assert.equal((await session.state(two[1])).lab.why, 'A straight line reads better');
    ok(await session.act('push', { pid: two[0], guess: 'accepted' }));
    await next(); // reveal-4
    let a = await adminState();
    assert.equal(a.labs.find((l) => l.id === '2').why, 'A straight line reads better');
    assert.deepEqual(a.projector.scene.facts, ['Predicted right: 2 of 4 · refused sends 0/1 · accepted sends 2/3',
      'Chose: Lab 2 Replay on top (rebase) ("A straight line reads better")', NOT_CHOSEN.merge], 'what nobody chose is still explained');

    await next(); // Step 5's task: both labs add a fix card
    for (const pid of [one[0], two[0]]) {
      const intern = (await session.state(pid)).lab.graph.commits.find((c) => c.author === 'The Intern');
      ok(await session.act('revert', { pid, commit: intern.id }));
    }
    await next(); // reveal-5
    a = await adminState();
    assert.deepEqual(a.labs.map((l) => l.undo), ['revert', 'revert']);
    assert.deepEqual(a.projector.scene.facts, ['Chose: Lab 1 Undo this card (revert) · Lab 2 Undo this card (revert)', UNDO_NOT_CHOSEN.reset],
      'no lab moved back: the reveal still says what would have happened');
    const md = await session.exportMarkdown();
    assert.match(md, /- Lab 2 · Step 4: Replay on top \(rebase\), by \w+\. Why: A straight line reads better · Step 5: Undo this card \(revert\), by \w+/);
    assert.match(md, /Lab 2 · send 1, pressed by \w+:\n- \w+ \(Lab 2\) \(pressed\): You predicted: accepted\. Git: refused \(fetch first\)\./);
  });

  test("the paper's Step 4 line says what replaying does when no lab replayed", async () => {
    await reset();
    await joinAll(['Ana', 'Ben']);
    while ((await adminState()).session.scene.id !== 'paper') await next();
    const { paper } = (await adminState()).projector.scene;
    assert.equal(paper.lived.find((l) => l.step === 4).text, PAPER.lived[1].none);
    assert.equal(paper.message, 'For analysts, flat history is data loss.');
    assert.match(paper.tradeoff, /^Flat history helps developers find and revert a bad change \(bisect, revert\)\. It loses where a change came from and who made it\.$/);
  });
});

describe('Step 2: Switch keeps unsaved parts', () => {
  test('Switch refuses to leave unsaved parts behind, as Git does with one working copy', async () => {
    await reset();
    const [ana, ben] = await joinAll(['Ana', 'Ben']);
    for (let i = 0; i < 5; i++) await next(); // Step 2's task
    ok(await session.act('branch', { pid: ana, name: 'fancy' }));
    ok(await session.act('draft', { pid: ana, part: 'hat', value: 'tophat' }));
    assert.equal((await session.act('switch', { pid: ana, branch: 'main' })).error, SWITCH_UNSAVED);
    assert.equal((await session.state(ana)).me.branch, 'fancy');
    ok(await session.act('switch', { pid: ben, branch: 'fancy' }), 'main has nothing unsaved: Ben may come');
    assert.equal((await session.act('switch', { pid: ben, branch: 'main' })).error, SWITCH_UNSAVED, "the draft is shared: Ana's part holds Ben too");
    assert.deepEqual((await session.state(ben)).me.hint, { idea: 'Git keeps one working copy. Save your unsaved parts before you switch to another branch.', click: 'Press **Save card**.' },
      "Ben's note is sporty: his hint saves first");
    ok(await session.act('commit', { pid: ana }));
    ok(await session.act('switch', { pid: ana, branch: 'main' }));
  });
});

describe('hints: the idea first, then the click', () => {
  test('every hint has an idea and a click; "Stuck? Hint" waits 45 s after the step starts, or after a refusal', async () => {
    await reset();
    const [ana] = await joinAll(['Ana']);
    for (let i = 0; i < 3; i++) await next(); // Step 1's task
    const st = await session.state(ana);
    assert.deepEqual(st.me.hint, {
      idea: 'A card records one saved version. Change one part first, then save it.',
      click: 'Click **change** on one part. Pick a new one. Then press **Save card**.',
    });
    assert.ok(Math.abs(st.me.hintAt - 45e3 - st.now) < 2000, 'the button comes 45 s after the step starts');
    for (let i = 0; i < 7; i++) await next(); // Step 4's task: the practice lab sends first
    ok(await session.act('draft', { pid: ana, part: 'hat', value: 'crown' }));
    ok(await session.act('commit', { pid: ana }));
    assert.equal((await session.act('push', { pid: ana, guess: 'accepted' })).error, REFUSED_CHOOSE);
    const refusedAt = (await adminState()).feed.find((e) => e.action === 'Send to Wall' && e.bad).t;
    const after = await session.state(ana);
    assert.equal(after.me.hintAt, refusedAt + 45e3, 'a refusal restarts the wait: think first');
    assert.notEqual(after.me.hint.idea, after.me.hint.click);
    assert.doesNotMatch(after.me.hint.idea, /\*\*(Get & combine|Replay on top|Send to Wall)\*\*/, 'the idea names no button');
  });
});

describe('rehearsal bots', () => {
  test('two people press Merge at once: one opens the conflict, the other is told what to do', async () => {
    await reset();
    const [ana, ben] = await joinAll(['Ana', 'Ben']);
    for (let i = 0; i < 5; i++) await next(); // Step 2's task
    await playStep([ana, ben]);
    for (let i = 0; i < 2; i++) await next(); // Step 3's task
    for (const pid of [ana, ben]) ok(await session.act('switch', { pid, branch: 'main' }));
    ok(await session.act('merge', { pid: ana, from: 'fancy', guess: 'ff' }));
    const both = await Promise.all([ana, ben].map((pid) => session.act('merge', { pid, from: 'sporty', guess: 'conflict:top' })));
    assert.deepEqual(both.map((r) => r.ok).sort(), [false, true]);
    assert.match(both.find((r) => r.ok).result.message, /^TOP changed on both sides\./);
    assert.equal(both.find((r) => !r.ok).error, 'Finish or cancel the merge first.');
  });

  test('bots leave with their answers; real people stay; before Step 1 the labs follow the headcount again', async () => {
    await reset();
    const [ana] = await joinAll(['Ana']);
    const bots = [];
    for (const name of ['Ava (bot)', 'Ben (bot)', 'Cleo (bot)']) {
      const r = ok(await session.join({ name }, { bot: true }));
      session.connect(r.pid);
      bots.push(r.pid);
    }
    assert.equal((await adminState()).labs.length, 2, 'four people: two labs');
    await next();
    await next(); // reveal-0
    for (const pid of [ana, ...bots]) ok(await session.act('answer', { pid, scene: 'reveal-0', text: 'Save every version.' }));
    ok(await session.leave([...bots, ana]));
    const a = await adminState();
    assert.equal(a.session.people, 1, 'leave removes only bots');
    assert.equal(a.session.scene.answers.count, 1, 'their answers left with them');
    assert.deepEqual(a.labs.map((l) => l.practice), [false, true], 'one person: one lab plus the practice lab');
  });
});
