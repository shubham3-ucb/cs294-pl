// Thursday (server/thursday.js): joining and rejoining, writing alone and in pairs, teams and larger groups, sorts,
// the paper's survey, post labels, the class's questions and the teacher's stars, what students and the projector
// may see, late answers, the scene guard, export and Reset. No Git here.
import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'thursday-'));
process.env.DATA_DIR = DATA;
const thu = await import('../server/thursday.js');
const { SCENES, SURVEY, POSTS, CLAIMS, RQS, MEASURES, TASKS, SURE, FIELDS, SIZES, PAPER_SURVEY, TOTAL_MINUTES, BUFFER_MINUTES } =
  await import('../server/thursday_scenes.js');

before(() => thu.boot());
after(() => {
  thu.flush();
  fs.rmSync(DATA, { recursive: true, force: true });
});

const ok = (r) => {
  assert.equal(r.ok, true, r.error);
  return r;
};
const reset = () => ok(thu.admin('reset'));
const join = (name) => ok(thu.join({ name })).pid;
const goTo = (id) => {
  const want = SCENES.findIndex((s) => s.id === id);
  assert.ok(want >= 0, id);
  while (thu.adminState('').index !== want) ok(thu.admin(thu.adminState('').index < want ? 'next' : 'back'));
};
const SURVEY_OK = { area: 0, degree: 1, years: 6, level: 2, why: 'daily use', learn: [3, 4], learnOther: '', tip: '' };
const survey = (pid, a = SURVEY_OK) => thu.answer({ pid, scene: 'survey', value: JSON.stringify(a) });

describe('the script', () => {
  test('77 minutes + 3 of buffer in the 80-minute slot, no break, every scene well formed, the survey word for word', () => {
    for (const s of SCENES) assert.ok(!('part' in s), `${s.id}: no section label`);
    assert.equal(TOTAL_MINUTES + BUFFER_MINUTES, 80);
    assert.equal(new Set(SCENES.map((s) => s.id)).size, SCENES.length);
    assert.ok(!SCENES.some((s) => s.kind === 'break'), 'no break');
    for (const s of SCENES) {
      assert.ok(s.title && s.say && s.minutes > 0, s.id);
      if (s.kind === 'reveal') assert.ok(s.shows, `${s.id} shows something`);
      if (s.kind === 'write') assert.ok(FIELDS[s.fields] && (s.who === 'solo' || SIZES[s.who]), s.id);
      if (s.kind === 'discuss') assert.ok(s.from === 'questions' || SCENES.find((x) => x.id === s.from)?.kind === 'write', s.id);
      if (s.ask) assert.ok(s.hope || s.kind === 'discuss', `${s.id}: a question has an answer to hope for`);
    }
    assert.deepEqual(['solo', 'pair', 'team'].map((w) => SCENES.some((s) => s.who === w)), [true, true, true], 'alone, in pairs and in teams');
    assert.deepEqual(SCENES.slice(1, 3).map((s) => s.id), ['tasks', 'tasks-reveal'], 'Thursday opens with Git tasks, then how the class did');
    for (const t of TASKS) assert.ok(t.situation && t.options.length === 4 && t.key >= 0 && t.key < 4, t.id);
    assert.deepEqual(new Set(TASKS.map((t) => t.key)).size > 1, true, 'the right answer is not always in the same place');
    assert.deepEqual(SURVEY.map((q) => q.id), ['area', 'degree', 'years', 'level', 'learn', 'tip']);
    assert.equal(SURVEY.find((q) => q.id === 'level').q, 'Which of the following levels do you consider your ability to use Git to be?');
    const ticks = PAPER_SURVEY.learn.reduce((a, b) => a + b, 0);
    assert.equal(ticks, 197);
    assert.equal(((PAPER_SURVEY.learn[3] + PAPER_SURVEY.learn[4]) / ticks * 100).toFixed(1), '81.7');
    assert.equal(PAPER_SURVEY.level.reduce((a, b) => a + b, 0), 92);
    assert.ok(RQS.every((q) => q.key === 0), 'all five research questions are need-finding');
    assert.deepEqual(MEASURES.map((m) => m.key).sort(), [1, 1, 1, 1, 2, 2], 'four traces, two self-report, nothing watched');
    assert.ok(CLAIMS.every((c) => c.quote && c.facts.length && c.measured && c.supports && c.why));
  });

  test('the posts: real, sampled, some named by the asker and some only in the answer', () => {
    assert.equal(POSTS.length, 8);
    for (const p of POSTS) {
      assert.match(p.url, /^https:\/\/stackoverflow\.com\/q\/\d+$/);
      assert.ok(p.question.length && p.answer.length, p.id);
      const shown = [...(p.askerNamesIt ? [{ text: p.title }, ...p.question] : p.answer)].map((b) => b.text).join(' ').toLowerCase();
      assert.ok(shown.includes(p.command), `${p.id}: ${p.command} is visible where the rule found it`);
    }
    const answerOnly = POSTS.filter((p) => !p.askerNamesIt).length;
    assert.ok(answerOnly > 0 && answerOnly < POSTS.length, 'both kinds');
  });
});

describe('a class', () => {
  test('Git tasks: a pick and how sure, per task; the reveal splits right answers by how sure people were', () => {
    reset();
    const [a, b] = ['Ana', 'Raj'].map(join);
    goTo('tasks');
    const task = (pid, t, pick, sure) => {
      ok(thu.answer({ pid, scene: 'tasks', item: t.id, field: 'pick', value: pick }));
      ok(thu.answer({ pid, scene: 'tasks', item: t.id, field: 'sure', value: sure }));
    };
    assert.equal(thu.answer({ pid: a, scene: 'tasks', item: TASKS[0].id, field: 'pick', value: 4 }).ok, false, 'four commands per task');
    assert.equal(thu.answer({ pid: a, scene: 'tasks', item: TASKS[0].id, field: 'sure', value: SURE.length }).ok, false);
    assert.ok(thu.state(a).scene.tasks.every((t) => !('key' in t)), 'no answer key before the reveal');
    for (const t of TASKS) task(a, t, t.key, 2); // certain, and right
    task(b, TASKS[0], (TASKS[0].key + 1) % 4, 2); // certain, and wrong
    assert.deepEqual(thu.adminState('').progress, { done: 1, of: 2, unit: 'people' });
    goTo('tasks-reveal');
    assert.equal(thu.state(b).pending.id, 'tasks', 'Raj can still finish during the reveal');
    const r = thu.adminState('').results;
    assert.deepEqual([r.rows[0].n, r.rows[0].right, r.rows[1].n], [2, 1, 1]);
    assert.deepEqual([r.sureN[2], r.sureRight[2]], [TASKS.length + 1, TASKS.length]);
  });

  test('alone: a design, a sort, the survey, labels, an exit line', () => {
    reset();
    assert.equal(thu.join({ name: '  ' }).ok, false);
    const a = join('Ana'), b = join('Raj');
    assert.equal(ok(thu.join({ pid: a })).name, 'Ana', 'rejoin with the saved id keeps the person');
    goTo('you-first');
    ok(thu.answer({ pid: a, scene: 'you-first', field: 'plan', text: 'Watch 20 people do Git tasks.' }));
    assert.equal(thu.answer({ pid: a, scene: 'you-first', field: 'nope', text: 'x' }).ok, false);
    assert.equal(thu.state(a).answers.plan, 'Watch 20 people do Git tasks.');
    assert.equal(thu.state(b).answers, null, 'alone: each person has their own answer');
    goTo('rq-sort');
    assert.equal(thu.answer({ pid: a, scene: 'you-first', field: 'plan', text: 'late' }).ok, false, 'a write closes when the next scene is over');
    for (const q of RQS) ok(thu.answer({ pid: a, scene: 'rq-sort', item: q.id, value: 0 }));
    for (const q of RQS) ok(thu.answer({ pid: b, scene: 'rq-sort', item: q.id, value: 2 }));
    assert.equal(thu.answer({ pid: a, scene: 'rq-sort', item: RQS[0].id, value: 3 }).ok, false, 'only the three kinds');
    goTo('rq-reveal');
    const sr = thu.adminState('').results;
    assert.deepEqual([sr.n, sr.right], [2, 0.5]);
    goTo('survey');
    assert.equal(survey(a, { ...SURVEY_OK, level: 9 }).ok, false);
    assert.equal(survey(a, { ...SURVEY_OK, learn: [] }).ok, false);
    ok(survey(a, { ...SURVEY_OK, degree: 3, degreeOther: 'Diploma' }));
    goTo('data');
    ok(survey(b, { ...SURVEY_OK, level: 1, years: 3, learn: [0, 4] })); // late: the survey is open until its reveal ends
    goTo('survey-reveal');
    const sv = thu.adminState('').results;
    assert.deepEqual([sv.n, sv.medianYears, sv.learn[4], sv.learn[0], sv.ticks], [2, 4.5, 2, 1, 4]);
    goTo('label');
    assert.equal(survey(a).ok, false, 'the survey closed with its reveal');
    for (const p of POSTS) ok(thu.answer({ pid: a, scene: 'label', post: p.id, value: p.askerNamesIt ? 'stuck' : 'needs' }));
    assert.equal(thu.answer({ pid: a, scene: 'label', post: POSTS[0].id, value: 'yes' }).ok, false, 'only the three labels');
    assert.deepEqual(thu.adminState('').progress, { done: 1, of: 2, unit: 'people' });
    goTo('label-reveal');
    assert.equal(thu.state(b).pending.id, 'label', 'Raj still has posts to label, during the reveal');
    for (const p of POSTS) ok(thu.answer({ pid: b, scene: 'label', post: p.id, value: 'unrelated' }));
    assert.equal(thu.state(b).pending, null);
    assert.ok(thu.adminState('').results.posts.every((p) => p.agreement === 0.5), 'two people, two different labels');
    goTo('exit');
    ok(thu.answer({ pid: a, scene: 'exit', text: 'Watch, do not ask.' }));
    goTo('end');
    assert.deepEqual(thu.state(a).results.lines, ['Watch, do not ask.']);
  });

  test('students never see notes or answer keys early', () => {
    reset();
    const a = join('Ana');
    goTo('rq-sort');
    const s = thu.state(a);
    assert.equal(s.scene.say, undefined);
    assert.ok(s.scene.items.every((x) => !('key' in x)), 'no key before the reveal');
    goTo('label');
    assert.ok(thu.state(a).scene.posts.every((p) => !('askerNamesIt' in p)));
    goTo('survey-reveal');
    assert.equal(thu.state(a).scene.hope, undefined);
    goTo('claims');
    const g = thu.state(a).group;
    assert.ok(g.claim.quote && g.claim.facts.length && !('supports' in g.claim) && !('measured' in g.claim) && !('why' in g.claim));
    assert.equal(thu.state(a).claims, undefined);
    goTo('claims-reveal');
    assert.equal(thu.state(a).claims.length, CLAIMS.length);
  });

  test('the same name again: the same person when away, a second person when here', () => {
    mock.timers.enable({ apis: ['Date'], now: Date.now() });
    try {
      reset();
      const a = join('Ana');
      const twin = ok(thu.join({ name: 'ana' }));
      assert.notEqual(twin.pid, a);
      assert.equal(twin.name, 'ana 2');
      mock.timers.tick(120_000);
      assert.equal(ok(thu.join({ name: 'Ana' })).pid, a, 'back as the same person');
    } finally {
      mock.timers.reset();
    }
  });
});

describe('pairs, teams and larger groups', () => {
  test('each size for any class: never a group of one, sizes even', () => {
    for (const [scene, who] of [['rq-pair', 'pair'], ['claims', 'team']]) {
      for (const n of [2, 3, 5, 7, 9, 12, 13, 24]) {
        reset();
        for (let i = 0; i < n; i++) thu.state(join(`P${i}`));
        goTo(scene);
        const sizes = thu.adminState('').groupings[who].map((g) => g.members.length);
        assert.equal(sizes.length, Math.max(1, Math.floor(n / SIZES[who])), `${who} n=${n}`);
        assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${who} n=${n}: ${sizes}`);
        assert.ok(Math.min(...sizes) >= Math.min(n, 2), `${who} n=${n}: ${sizes}`);
      }
    }
  });

  test('one shared answer per group, late joiners, going back, re-forming', () => {
    mock.timers.enable({ apis: ['Date'], now: Date.now() });
    try {
      reset();
      const away = join('Lea');
      mock.timers.tick(11 * 60_000); // Lea's laptop sleeps longer than 10 minutes
      const pids = ['Ana', 'Raj', 'Mei', 'Tom'].map(join);
      goTo('rq-pair');
      assert.equal(thu.adminState('').groupings.pair.length, 2, 'pairs are made of who is in the room');
      assert.ok(thu.state(away).group, 'Lea gets a pair on coming back');
      const late = join('Kim');
      const mate = pids.find((p) => thu.state(p).group.name === thu.state(late).group.name);
      ok(thu.answer({ pid: late, scene: 'rq-pair', field: 'rq', text: 'Where do people look first?' }));
      ok(thu.answer({ pid: mate, scene: 'rq-pair', field: 'use', text: 'Put help there.' }));
      assert.deepEqual([thu.state(mate).answers.rq, thu.state(late).answers.use], ['Where do people look first?', 'Put help there.']);
      ok(thu.admin('back'));
      ok(thu.admin('next'));
      assert.equal(thu.adminState('').groupings.pair.length, 2, 'pairs stay when going back and forth');
      goTo('claims');
      assert.ok(thu.adminState('').groupings.team, 'teams form separately from pairs');
      assert.equal(thu.adminState('').groupings.pair.length, 2, 'and the pairs are kept');
      goTo('rq-pair');
      ok(thu.admin('regroup'));
      assert.equal(thu.state(mate).answers, null, 'answers start again in the new pairs');
    } finally {
      mock.timers.reset();
    }
  });
});

describe('discussion', () => {
  test('the projector shows answers without names, starred ones first; questions any time', () => {
    reset();
    const [a, b] = ['Ana', 'Raj'].map(join);
    goTo('you-first');
    ok(thu.answer({ pid: a, scene: 'you-first', field: 'plan', text: 'Watch people.' }));
    ok(thu.answer({ pid: b, scene: 'you-first', field: 'plan', text: 'Ask people.' }));
    goTo('you-first-discuss');
    let p = thu.adminState('').projector;
    assert.equal(p.all.length, 2);
    assert.ok(p.all.every((e) => !('who' in e)), 'no names on the projector');
    assert.equal(thu.adminState('').results.all[0].who, 'Ana', 'names on the console');
    ok(thu.admin('star', { key: p.all[1].key }));
    p = thu.adminState('').projector;
    assert.deepEqual(p.starred.map((e) => e.answers.plan), ['Ask people.']);
    assert.deepEqual(thu.state(a).results.starred.map((e) => e.answers.plan), ['Ask people.'], 'students see the same board');
    ok(thu.admin('star', { key: p.all[1].key }));
    assert.equal(thu.adminState('').projector.starred.length, 0, 'a second press unstars');
    assert.equal(thu.ask({ pid: a, text: '   ' }).ok, false);
    ok(thu.ask({ pid: a, text: 'Why not test anyone?' }));
    assert.deepEqual(thu.state(a).me.questions, ['Why not test anyone?']);
    const q = thu.adminState('').questions[0];
    assert.equal(q.who, 'Ana');
    ok(thu.admin('star', { key: q.key }));
    goTo('questions');
    assert.deepEqual(thu.adminState('').projector.starred.map((e) => e.answers.text), ['Why not test anyone?']);
  });
});

describe('teacher', () => {
  test('a double tap moves one scene; the timer restarts; export; Reset empties the class', () => {
    reset();
    const a = join('Ana');
    ok(thu.admin('next', { from: 0 }));
    assert.equal(thu.admin('next', { from: 0 }).unchanged, true);
    assert.equal(thu.adminState('').index, 1);
    assert.ok(thu.adminState('').elapsed < 1000);
    goTo('you-first');
    ok(thu.answer({ pid: a, scene: 'you-first', field: 'plan', text: 'Log commands.' }));
    ok(thu.ask({ pid: a, text: 'Is account age a proxy?' }));
    const md = thu.exportMarkdown();
    assert.match(md, /## How would you study this\?/);
    assert.match(md, /\*\*Ana\*\*\n  - Plan: Log commands\./);
    assert.match(md, /## Questions from the class\n\n- Ana: Is account age a proxy\?/);
    reset();
    assert.deepEqual([thu.adminState('').index, thu.adminState('').people.length], [0, 0]);
    assert.equal(thu.state(a).joined, false, 'old students join again');
  });

  test('the session survives a restart', () => {
    reset();
    join('Ana');
    ok(thu.admin('next'));
    thu.flush();
    thu.boot();
    assert.deepEqual([thu.adminState('').index, thu.adminState('').people.length], [1, 1]);
  });
});
