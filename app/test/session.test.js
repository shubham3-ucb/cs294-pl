// The class session (server/session.js) with real Git: lab assignment, the practice lab, the scene
// script, answers, takeaways and export. A bot plays whole classes by following only the hints,
// so every step is proven finishable without a teacher.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'outfit-lab-session-'));
process.env.DATA_DIR = DATA;
delete process.env.LABS;
const session = await import('../server/session.js');
const { SCENES, STEPS, DONE_LINE, CARDS, TRUST_LINE } = await import('../server/steps.js');
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
      for (const [action, input] of movesFor(st.me.hint, st)) {
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
const REFUSED_MERGE = "Refused: the Wall has cards your main doesn't. Use Combine (merge): press Get & combine, then send again.";
const REFUSED_REBASE = "Refused: the Wall has cards your main doesn't. Use Replay on top (rebase): press Replay on top, then send again.";
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
    const { session: s } = await adminState();
    assert.equal(s.scene.id, 'join');
    assert.deepEqual(s.scene.next, { n: 1, title: 'Step 0 · Everyone, one outfit', note: null });
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
      const texts = [s.say, s.do, s.ask?.q, s.ask?.a, s.reveal?.sentence, s.reveal?.behind, s.reveal?.note, s.line,
        ...(s.reveal?.cards ?? []).flatMap((c) => [c.is, c.does, c.how])];
      for (const text of texts.filter(Boolean)) {
        assert.doesNotMatch(text, /monster|\bface\b|\bbody\b|\blegs\b|tentacle|mustache/i, `${s.id}: ${text}`);
        assert.doesNotMatch(text, /\b(simply|basically|clearly|obviously|easy|magic|seamless|robust)\b/i, `${s.id}: ${text}`);
      }
    }
    assert.equal(SCENES.find((s) => s.id === 'reveal-1').reveal.note, TRUST_LINE);
    assert.equal(TRUST_LINE, 'Git stores the name and clock your laptop gives it. It checks neither.');
    assert.equal(CARDS.rebase.how, 'for each of your commits, Git applies its change to the new base and writes a new commit. The new parent gives it a new ID. Author and author date are kept. The originals become unreachable and stay in your reflog for a while.');
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
    assert.match(st.me.mission, /^You're both pairs today\./);
    for (let i = 0; i < 5; i++) ok(await session.admin('back', {}));

    const met = await playClass([me]);
    assert.ok(met[4].includes(REFUSED_REBASE), 'Step 4: the practice lab got there first, so the send was refused');
    assert.ok(met[5].some((e) => /still has the 🥸 card/.test(e)), 'Step 5: moving back was refused');
    assert.ok(refusals(met).every((e) => REFUSED.test(e)), `only refused sends: ${refusals(met)}`);

    const a = await adminState();
    assert.ok(a.feed.some((e) => e.who === 'Practice lab' && e.action === 'Send to Wall'));
    assert.equal(a.labs[0].way, 'rebase', 'the one real lab replays on top: merge was felt in Step 3');
    assert.ok(a.feed.some((e) => e.labId === '1' && e.action === 'Replay on top' && /→/.test(e.outcome)));
    assert.ok(a.feed.some((e) => e.labId === '1' && e.action === 'Delete sticky note fancy'));
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
    assert.ok(met[4].includes(REFUSED_MERGE) && met[4].includes(REFUSED_REBASE), 'Step 4: one refused lab merges, the next replays');
    assert.ok(refusals(met).every((e) => REFUSED.test(e)), `only refused sends: ${refusals(met)}`);

    const st = await session.state(pids[0]);
    assert.equal(st.session.scene.kind, 'wrap');
    assert.deepEqual(st.me.gitIn7.map((l) => [l.step, l.text]), [0, 1, 2, 3, 4, 5, 6].map((n) => [n, `takeaway ${n}`]));
    assert.equal(st.me.answers.exit, 'answer exit');

    const a = await adminState();
    assert.deepEqual(a.labs.map((l) => l.way ?? 'first').sort(), ['first', 'merge', 'rebase'], 'the first lab to send just sent');
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
    assert.match(md, /### Step 3 · Make one outfit from both\n\n\*\*Ask:\*\* Which cards were made on fancy\?/);
    assert.match(md, /- Gus \(Lab \d\): takeaway 6/);
    assert.match(md, /### Gus · Lab \d\n\nMy Git in 7 lines:\n0\. takeaway 0\n1\. takeaway 1/);
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
    assert.deepEqual(st.me.gitIn7[0], { step: 0, title: 'Everyone, one outfit', text: 'Save every version.', board: SCENES[2].board });
    assert.deepEqual(st.me.gitIn7[1], { step: 1, title: 'Save every version', text: 'A card never changes.', board: SCENES[4].board });
    assert.equal(st.me.gitIn7[2].text, '');
    assert.deepEqual((await adminState()).session.scene.takeaways, { count: 1, of: 1 });
  });
});

describe('Step 3: delete the fancy note', () => {
  test("only once the note you're on has its cards; never the note you're on; never main", async () => {
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
    assert.equal((await session.act('deleteNote', { pid: ana, note: 'main' })).error, 'main stays. Pick another note.');
    let st = await session.state(ana);
    assert.equal(st.me.mission, null);
    assert.equal(st.me.hint, 'Press **Merge fancy into main**.');

    ok(await session.act('merge', { pid: ana, from: 'fancy' }));
    st = await session.state(ana);
    assert.equal(st.me.mission, 'Delete the fancy note (`git branch -d fancy`).');
    assert.equal(st.me.hint, 'Press **Delete sticky note** and pick **fancy**.');
    const r = ok(await session.act('deleteNote', { pid: ana, note: 'fancy' }));
    assert.equal(r.result.message, 'Deleted the fancy note. Its cards stay.');
    assert.equal(r.op.porcelain, 'git branch -d fancy');
    assert.equal((await session.state(ana)).me.mission, null, 'the mission goes once the note is deleted');
    st = await session.state(ben);
    assert.equal(st.me.branch, 'main', "Ben's pin went back to main");
    assert.equal(st.lab.branches.fancy, undefined);
    assert.deepEqual(st.lab.goals.map((g) => g.done), [true, true, false]);
    assert.equal(st.me.hint, 'Press **Merge sporty into main**.');
    assert.equal((await session.act('deleteNote', { pid: ana, note: 'fancy' })).error, 'That sticky note does not exist.');
  });

  test('Rescue merges fancy, deletes its note, then merges sporty', async () => {
    await reset();
    await joinAll(['Ana', 'Ben']);
    for (let i = 0; i < 7; i++) await next(); // Step 3's task
    ok(await session.admin('rescue', { labId: '1' }));
    const a = await adminState();
    assert.equal(a.labs[0].done, true);
    assert.deepEqual(a.feed.filter((e) => e.labId === '1' && /^(Merge|Delete)/.test(e.action)).map((e) => e.action).reverse(),
      ['Merge fancy into main', 'Delete sticky note fancy', 'Merge sporty into main']);
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
      const says = st.lab.id === wallLab ? "It starts as your lab's outfit" : `It starts as Lab ${wallLab}'s outfit`;
      assert.match(st.session.steps[4].instruction, new RegExp(`${says}, so your lab's cards are now a copy of it\\.`));
    }
    await playStep(pids);
    for (const pid of pids) assert.doesNotMatch((await session.state(pid)).me.mission, /refused/, 'done: no way in the mission');
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
    assert.equal(st.session.steps[5].instruction, "A 🥸 card reached the Wall. Remove it without breaking anyone's copy.");
    assert.match(st.me.mission, /^Your lab has it now\. /);
    // Lab 1 undoes and sends. Labs 2 and 3 take that fix with Get & combine before undoing anything.
    for (let i = 0; i < 10 && (await session.state(one)).me.hint; i++) {
      const now = await session.state(one);
      for (const [action, input] of movesFor(now.me.hint, now)) ok(await session.act(action, { pid: one, ...input }));
    }
    assert.equal((await session.state(one)).lab.done, true);
    for (const pid of [two, three]) ok(await session.act('pull', { pid }));
    let mine = await session.state(three);
    assert.equal(mine.lab.done, false, 'no 🥸 left, but this lab has not undone anything');
    assert.deepEqual(mine.lab.goals.map((g) => g.done), [false, true]);
    assert.equal(mine.me.hint, 'Click the 🥸 card. Press **Undo this card**.');
    // Lab 3 follows its hint: the change is already undone, and that counts as its undo.
    const [[action, input]] = movesFor(mine.me.hint, mine);
    assert.equal(ok(await session.act(action, { pid: three, ...input })).result.message, 'Already undone. Nothing to change.');
    mine = await session.state(three);
    assert.equal(mine.lab.done, true);
    assert.equal(mine.me.mission, null, 'done: the mission goes');
    // Lab 2 (it moves back first) is rescued: Rescue undoes the card for it.
    ok(await session.admin('rescue', { labId: session.labOf(two) }));
    assert.equal((await session.state(two)).lab.done, true);
    await reset();
    ok(await session.admin('labs', { count: 'auto' })); // the next tests count labs from the headcount again
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
    ok(await session.act('merge', { pid: ana, from: 'fancy' }));
    const both = await Promise.all([ana, ben].map((pid) => session.act('merge', { pid, from: 'sporty' })));
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
