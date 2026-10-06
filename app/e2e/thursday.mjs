// Thursday end to end: a teacher console, the projector and six students on laptops run all 18 scenes
// through the real pages. Every projector slide is checked for overflow and saved to e2e/shots/thu-*.png.
//   npm run e2e:thursday        (npx playwright install --only-shell chromium, once)
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SCENES, POSTS, COMMENTS, CLAIMS, SURVEY } from '../server/thursday_scenes.js';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(APP, 'e2e', 'shots');
const PORT = Number(process.env.E2E_PORT) || 3103;
const BASE = `http://127.0.0.1:${PORT}`;
const KEY = 'test';
const LAPTOP = { width: 1280, height: 800 };
const PROJECTOR = { width: 1280, height: 720 };
const WAIT = 10_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

// Six students, answering like a PhD class might.
const CLASS = [
  { name: 'Ana', area: 0, degree: 1, years: 7, level: 2, learn: [3, 4], why: 'I use it daily but rebase still scares me.' },
  { name: 'Raj', area: 0, degree: 0, years: 4, level: 1, learn: [2, 4], why: '' },
  { name: 'Mei', area: 0, degree: 1, years: 9, level: 3, learn: [0, 3, 4], why: 'Taught it as a TA.' },
  { name: 'Priya', area: 0, degree: 0, years: 5, level: 2, learn: [4], why: '' },
  { name: 'Tom', area: 1, degree: 1, years: 10, level: 2, learn: [2, 3, 4], why: 'Years in industry, still google reflog.' },
  { name: 'Lea', area: 0, degree: 0, years: 3, level: 1, learn: [0, 4], why: '' },
];
const CLAIM_TEXT = {
  experience: ['Years since the Stack Overflow account was made.', 'Some long-registered askers had trouble.'],
  difficulty: ['How often the asker never accepted an answer.', 'Credential questions go unaccepted a bit more often.'],
  learning: ['Ticked boxes from 92 people found on Stack Overflow.', 'These 92 mostly say they learned Git online.'],
  selfrating: ['A self-rated level, novice to expert.', 'Most rate themselves competent or below.'],
};
const DESIGN_TEXT = [
  ['`git undo`: reverses the last command, and says what it did.', 'Does git undo decrease time to recover for grad students who just broke a branch?', 'Time to recover; threat: a learning effect.', 'Watch 20 people recover from a staged mistake.'],
  ['Show the reflog after every risky command: "to go back, run …".', 'Does the hint increase successful recoveries for new Git users?', 'Recoveries that succeed; threat: a ceiling effect.', 'Telemetry: how often people recover after reset --hard.'],
];
const EXITS = [
  'Watch people use the tool; what they ask is not what they do.',
  'A safety net nobody can find is not a safety net.',
  'Check what the trace really records before counting it.',
  'Design undo first: it is what people need most.',
  'A ranking from a mean of views is a few famous posts.',
  'Ask what the measure would look like if the claim were false.',
];

// THU_STUDENTS=12 (or any number) repeats the six answer patterns under new names.
const MORE = ['Sam', 'Kim', 'Ola', 'Ben', 'Zoe', 'Ivy', 'Max', 'Noa', 'Eli', 'Ada', 'Leo', 'Uma', 'Kai', 'Rio', 'Ian', 'Joy', 'Ned', 'Sia', 'Ted', 'Vic', 'Wes', 'Yan', 'Bo', 'Cy'];
const COUNT = Number(process.env.THU_STUDENTS) || CLASS.length;
while (CLASS.length < COUNT) CLASS.push({ ...CLASS[CLASS.length % 6], name: MORE[CLASS.length - 6] });
CLASS.length = COUNT;
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

let server = null, serverErr = '', browser = null;
const problems = [];

async function startServer(dataDir) {
  server = spawn(process.execPath, ['server/index.js'], { cwd: APP, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, ADMIN_KEY: KEY } });
  server.stderr.on('data', (d) => { serverErr += d; });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${BASE}/thu`).then((r) => r.ok, () => false)) return;
    await sleep(100);
  }
  throw new Error(`The server did not start:\n${serverErr}`);
}

const adminState = () => fetch(`${BASE}/api/thu/admin/state?key=${KEY}`).then((r) => r.json());

async function open(viewport, url, who) {
  const page = await (await browser.newContext({ viewport })).newPage();
  page.on('pageerror', (e) => problems.push(`${who}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${who}: ${m.text()}`); });
  await page.goto(url);
  return page;
}

async function until(fn, what) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > WAIT) throw new Error(`Timed out: ${what}`);
    await sleep(150);
  }
}

// The projector shows scene `id`, and nothing on it overflows the 16:9 box.
async function checkSlide(projector, id, n) {
  await until(async () => (await adminState()).scene.id === id, `scene ${id}`);
  await sleep(1800); // one poll
  const over = await projector.evaluate(() => {
    const box = document.querySelector('.ts');
    if (!box) return 'no slide';
    // The content box: the slide minus its padding (the margins every slide keeps).
    const r = box.getBoundingClientRect();
    const cs = getComputedStyle(box);
    const bottom = r.bottom - parseFloat(cs.paddingBottom), right = r.right - parseFloat(cs.paddingRight);
    const bad = [...box.querySelectorAll('*')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width && (b.bottom > bottom + 1 || b.right > right + 1);
    }).map((el) => `${el.className || el.tagName}: ${el.textContent.slice(0, 40)}`);
    return bad.slice(0, 3).join(' | ');
  });
  await projector.screenshot({ path: path.join(SHOTS, `thu-${String(n).padStart(2, '0')}-${id}.png`) });
  assert.equal(over, '', `Slide ${id} overflows: ${over}`);
}

async function next(console_, byKey = false) {
  const before = (await adminState()).index;
  if (byKey) await console_.keyboard.press('ArrowRight'); // a clicker, right after mouse clicks on Next
  else await console_.click('#next');
  await until(async () => (await adminState()).index === before + 1, 'Next');
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thu-e2e-'));
  await startServer(dataDir);
  browser = await chromium.launch();
  try {
    const teacher = await open({ width: 1440, height: 900 }, `${BASE}/thu/admin?key=${KEY}`, 'console');
    const projector = await open(PROJECTOR, `${BASE}/thu/screen?key=${KEY}`, 'projector');
    const students = [];
    for (const s of CLASS) {
      const page = await open(LAPTOP, `${BASE}/thu`, s.name);
      await page.fill('#name', s.name);
      await page.click('button[type=submit]');
      await page.waitForSelector('.s-in');
      students.push({ ...s, page });
    }
    assert.equal((await adminState()).people.length, CLASS.length);
    const order = SCENES.map((s) => s.id);
    let n = 0;
    for (const id of order) {
      n += 1;
      const scene = SCENES.find((s) => s.id === id);
      await until(async () => (await adminState()).scene.id === id, `scene ${id}`);
      await sleep(2300); // students' poll
      if (scene.kind === 'survey') {
        for (const s of students) {
          const p = s.page;
          await p.check(`input[name=area][value="${s.area}"]`);
          await p.check(`input[name=degree][value="${s.degree}"]`);
          await p.fill('input[name=years]', String(s.years));
          await p.check(`input[name=level][value="${s.level}"]`);
          if (s.why) await p.fill('input[name=why]', s.why);
          for (const i of s.learn) await p.check(`input[name=learn][value="${i}"]`);
          await p.click('#f button[type=submit]');
          await p.waitForSelector('.s-msg.ok');
        }
        if (n === 2) await students[0].page.screenshot({ path: path.join(SHOTS, 'thu-student-survey.png'), fullPage: false });
        const st = await adminState();
        assert.deepEqual([st.progress.done, st.progress.of], [CLASS.length, CLASS.length]);
      } else if (scene.kind === 'vote') {
        for (const [i, s] of students.entries()) {
          const j = i % 6;
          const pick = id === 'who' ? (j < 4 ? 1 : 0) : (j < 3 ? 1 : j < 5 ? 2 : 0);
          await s.page.click(`.s-vote button[data-i="${pick}"]`);
          await s.page.waitForSelector('.s-vote button.on');
        }
      } else if (scene.kind === 'label') {
        for (const [i, s] of students.entries()) {
          for (const post of POSTS) {
            // Most see it: in answer-only posts the asker is not stuck on the command.
            const label = post.askerNamesIt ? (i % 6 === 5 ? 'unrelated' : 'stuck') : (i % 3 === 0 ? 'needs' : 'unrelated');
            await s.page.click(`.s-post[data-id="${post.id}"] button[data-v="${label}"]`);
          }
          await s.page.waitForFunction((k) => document.getElementById('prog')?.textContent.startsWith(`${k} of ${k}`), POSTS.length);
        }
        await students[1].page.screenshot({ path: path.join(SHOTS, 'thu-student-posts.png') });
      } else if (scene.kind === 'code') {
        for (const [i, s] of students.entries()) {
          for (const c of COMMENTS) {
            const pick = i % 4 === 3 ? (c.category + 1) % 6 : c.category; // most agree with the paper
            await s.page.click(`.s-post[data-id="${c.id}"] button[data-v="${pick}"]`);
          }
          await s.page.waitForFunction((k) => document.getElementById('prog')?.textContent.startsWith(`${k} of ${k}`), COMMENTS.length);
        }
        await students[0].page.screenshot({ path: path.join(SHOTS, 'thu-student-codes.png') });
      } else if (scene.kind === 'group') {
        const st = await adminState();
        assert.equal(st.groups.length, Math.max(1, Math.round(CLASS.length / 4)), 'groups of about four');
        await sleep(2300);
        const firstOf = new Map();
        for (const s of students) {
          const g = await s.page.evaluate(() => document.querySelector('.who')?.textContent.split('· ')[1]);
          if (!firstOf.has(g)) firstOf.set(g, s);
        }
        let gi = 0;
        for (const s of firstOf.values()) {
          const fields = await s.page.$$eval('textarea[data-f]', (ts) => ts.map((t) => t.dataset.f));
          let texts;
          if (id === 'claims') {
            const claimId = st.groups.find((g) => g.members.includes(s.name)).claim;
            texts = CLAIM_TEXT[claimId];
          } else {
            texts = DESIGN_TEXT[gi % DESIGN_TEXT.length];
          }
          for (const [k, f] of fields.entries()) await s.page.fill(`textarea[data-f="${f}"]`, texts[k]);
          await s.page.click('.s-title'); // blur: save
          gi += 1;
        }
        await until(async () => { const a = await adminState(); return a.progress.done === a.progress.of; }, 'groups done');
        if (id === 'claims') await [...firstOf.values()][0].page.screenshot({ path: path.join(SHOTS, 'thu-student-claim.png') });
      } else if (scene.kind === 'exit') {
        for (const [i, s] of students.entries()) {
          await s.page.fill('#t', EXITS[i % EXITS.length]);
          await s.page.click('#b');
          await s.page.waitForSelector('.s-msg.ok');
        }
      }
      await checkSlide(projector, id, n);
      if (id === 'paper') await teacher.screenshot({ path: path.join(SHOTS, 'thu-console.png') });
      if (id === 'label-reveal') {
        const r = (await adminState()).results;
        const answerOnly = r.posts.filter((p) => !p.askerNamesIt);
        assert.ok(answerOnly.every((p) => p.counts[0] < p.counts[1] + p.counts[2]), 'answer-only posts: mostly not "stuck on it"');
      }
      if (id === 'survey-reveal') {
        const r = (await adminState()).results;
        assert.equal(r.n, CLASS.length);
        assert.equal(r.learn[4], CLASS.filter((s) => s.learn.includes(4)).length);
        assert.equal(r.medianYears, median(CLASS.map((c) => c.years)));
      }
      if (n < order.length) await next(teacher, id === 'paper');
    }
    // Export, then Reset empties the class.
    const md = await fetch(`${BASE}/api/thu/admin/export?key=${KEY}`).then((r) => r.text());
    assert.match(md, /## Survey/);
    assert.match(md, new RegExp(EXITS[0].slice(0, 20)));
    for (const c of CLAIMS.slice(0, 2)) assert.ok(md.includes(c.quote), `export has claim ${c.id}`);
    await fetch(`${BASE}/api/thu/admin/reset`, { method: 'POST', headers: { 'x-admin-key': KEY, 'content-type': 'application/json' }, body: '{}' });
    const after = await adminState();
    assert.deepEqual([after.index, after.people.length], [0, 0]);
    await until(async () => (await students[0].page.$('#join')) !== null, 'students see the join form after Reset');
    assert.deepEqual(problems, [], `Page errors:\n${problems.join('\n')}`);
    assert.equal(SURVEY.length, 6);
    log(`Thursday e2e passed: ${order.length} scenes, ${CLASS.length} students, shots in e2e/shots/thu-*.png`);
  } finally {
    await browser?.close();
    server?.kill('SIGTERM');
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
