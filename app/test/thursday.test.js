// Thursday (server/thursday.js): joining, the paper's survey, votes, post labels, groups for any class size,
// what students may see, the scene guard, export and Reset. No Git here.
import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'thursday-'));
process.env.DATA_DIR = DATA;
const thu = await import('../server/thursday.js');
const { SCENES, SURVEY, POSTS, CLAIMS, PAPER_SURVEY, TOTAL_MINUTES } = await import('../server/thursday_scenes.js');

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
  test('78 minutes + 2 of buffer, every scene well formed, the survey word for word from the form', () => {
    assert.equal(TOTAL_MINUTES, 78); // + 2 minutes of buffer
    assert.equal(new Set(SCENES.map((s) => s.id)).size, SCENES.length);
    for (const s of SCENES) {
      assert.ok(s.title && s.part && s.say && s.minutes > 0, s.id);
      if (s.kind === 'reveal') assert.ok(s.shows, `${s.id} shows something`);
    }
    assert.deepEqual(SURVEY.map((q) => q.id), ['area', 'degree', 'years', 'level', 'learn', 'tip']);
    assert.equal(SURVEY.find((q) => q.id === 'level').q, 'Which of the following levels do you consider your ability to use Git to be?');
    // The paper's Table 7: 197 ticks, 161 of them self-learning (81.7%).
    const ticks = PAPER_SURVEY.learn.reduce((a, b) => a + b, 0);
    assert.equal(ticks, 197);
    assert.equal(((PAPER_SURVEY.learn[3] + PAPER_SURVEY.learn[4]) / ticks * 100).toFixed(1), '81.7');
    assert.equal(PAPER_SURVEY.level.reduce((a, b) => a + b, 0), 92);
  });

  test('the posts: real, sampled, some named by the asker and some only in the answer', () => {
    assert.equal(POSTS.length, 8);
    for (const p of POSTS) {
      assert.match(p.url, /^https:\/\/stackoverflow\.com\/q\/\d+$/);
      assert.ok(p.question.length && p.answer.length, p.id);
      const shown = [...(p.askerNamesIt ? p.question : p.answer)].map((b) => b.text).join(' ').toLowerCase();
      assert.ok(shown.includes(p.command), `${p.id}: ${p.command} is visible where the rule found it`);
    }
    const answerOnly = POSTS.filter((p) => !p.askerNamesIt).length;
    assert.ok(answerOnly > 0 && answerOnly < POSTS.length, 'both kinds: the asker names the command, or only the answer does');
  });
});

describe('a class', () => {
  test('join, survey, votes, labels, exit', () => {
    reset();
    assert.equal(thu.join({ name: '  ' }).ok, false);
    const a = join('Ana'), b = join('Raj');
    assert.equal(ok(thu.join({ pid: a })).name, 'Ana', 'rejoin keeps the person');
    goTo('survey');
    assert.equal(survey(a, { ...SURVEY_OK, level: 9 }).ok, false);
    assert.equal(survey(a, { ...SURVEY_OK, learn: [] }).ok, false);
    assert.equal(survey(a, { ...SURVEY_OK, years: 99 }).ok, false);
    ok(survey(a));
    ok(survey(b, { ...SURVEY_OK, level: 1, years: 3, learn: [0, 4] }));
    assert.equal(thu.answer({ pid: a, scene: 'kind', value: 0 }).ok, false, 'only the current scene takes answers');
    goTo('kind');
    ok(thu.answer({ pid: a, scene: 'kind', value: 0 }));
    ok(thu.answer({ pid: b, scene: 'kind', value: 2 }));
    ok(thu.answer({ pid: b, scene: 'kind', value: 0 })); // a changed mind
    goTo('kind-reveal');
    assert.deepEqual(thu.adminState('').results.counts, [2, 0, 0]);
    goTo('survey-reveal');
    const sv = thu.adminState('').results;
    assert.deepEqual([sv.n, sv.medianYears, sv.learn[4], sv.learn[0], sv.ticks], [2, 4.5, 2, 1, 4]);
    goTo('label');
    for (const p of POSTS) ok(thu.answer({ pid: a, scene: 'label', post: p.id, value: p.askerNamesIt ? 'yes' : 'no' }));
    assert.equal(thu.answer({ pid: a, scene: 'label', post: 'nope', value: 'yes' }).ok, false);
    assert.deepEqual(thu.adminState('').progress, { done: 1, of: 2, unit: 'people' });
    goTo('exit');
    ok(thu.answer({ pid: a, scene: 'exit', text: 'Watch, do not ask.' }));
    goTo('end');
    assert.deepEqual(thu.state(a).results.lines, ['Watch, do not ask.']);
  });

  test('students never see notes or answer keys early', () => {
    reset();
    const a = join('Ana');
    goTo('label');
    const s = thu.state(a);
    assert.equal(s.scene.say, undefined);
    assert.ok(s.scene.posts.every((p) => !('askerNamesIt' in p)));
    goTo('kind-reveal');
    assert.equal(thu.state(a).scene.hope, undefined);
    goTo('claims');
    const g = thu.state(a).group;
    assert.ok(g.claim.quote && !('supports' in g.claim) && !('measured' in g.claim));
    assert.equal(thu.state(a).claims, undefined);
    goTo('claims-reveal');
    assert.equal(thu.state(a).claims.length, CLAIMS.length);
  });
});

describe('groups', () => {
  test('about four per group for any class size; never a group of one', () => {
    for (const n of [1, 2, 3, 5, 6, 7, 9, 10, 12, 13, 17, 24]) {
      reset();
      for (let i = 0; i < n; i++) thu.state(join(`P${i}`)); // polled: here
      goTo('claims');
      const sizes = thu.adminState('').groups.map((g) => g.members.length);
      assert.equal(sizes.length, Math.max(1, Math.round(n / 4)), `n=${n}`);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `n=${n}: ${sizes}`);
      if (n > 1) assert.ok(Math.min(...sizes) >= 2, `n=${n}: ${sizes}`);
    }
  });

  test('late joiners go to the smallest group; one shared answer per group', () => {
    reset();
    const pids = ['Ana', 'Raj', 'Mei', 'Tom', 'Lea'].map(join);
    pids.forEach((p) => thu.state(p));
    goTo('claims');
    const late = join('Kim');
    const st = thu.adminState('');
    assert.ok(st.groups.some((g) => g.members.includes('Kim')));
    const mate = pids.find((p) => thu.state(p).group.name === thu.state(late).group.name);
    ok(thu.answer({ pid: late, scene: 'claims', field: 'measured', text: 'Registration years.' }));
    ok(thu.answer({ pid: mate, scene: 'claims', field: 'supports', text: 'Old accounts ask.' }));
    assert.equal(thu.answer({ pid: late, scene: 'claims', field: 'nope', text: 'x' }).ok, false);
    const mine = thu.state(mate).group.answers;
    assert.deepEqual([mine.measured, mine.supports], ['Registration years.', 'Old accounts ask.']);
    assert.equal(thu.adminState('').progress.done, 1);
    // Someone who joined but was away when groups formed gets a group when they come back.
    mock.timers.enable({ apis: ['Date'], now: Date.now() });
    try {
      reset();
      const away = join('Lea');
      mock.timers.tick(60_000); // Lea's laptop sleeps
      const here = ['Ana', 'Raj', 'Mei', 'Tom'].map(join);
      goTo('claims');
      assert.equal(thu.adminState('').groups.reduce((n, g) => n + g.members.length, 0), 4, 'groups are made of who is here');
      assert.ok(thu.state(away).group, 'Lea gets a group on coming back');
      assert.equal(thu.adminState('').groups.reduce((n, g) => n + g.members.length, 0), 5);
      assert.ok(here.length === 4);
    } finally {
      mock.timers.reset();
    }
    // Groups stay when the teacher goes back and forth.
    const formed = thu.adminState('').groups.length;
    ok(thu.admin('back'));
    ok(thu.admin('next'));
    assert.equal(thu.adminState('').groups.length, formed);
  });
});

describe('teacher', () => {
  test('a double tap moves one scene; export; Reset empties the class', () => {
    reset();
    const a = join('Ana');
    ok(thu.admin('next', { from: 0 }));
    assert.equal(thu.admin('next', { from: 0 }).unchanged, true);
    assert.equal(thu.adminState('').index, 1);
    ok(survey(a));
    const md = thu.exportMarkdown();
    assert.match(md, /## Survey/);
    assert.match(md, /Competent: 1 \(paper: 52 of 92\)/);
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
