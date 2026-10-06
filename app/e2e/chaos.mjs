// Chaos: students press random buttons with random inputs in every step, many classes over. Then they follow
// their hints; if a lab is still not done, the teacher presses Rescue. Fails on any crash, or a lab that not even
// Rescue can finish. Prints how each lab finished each step.
//   node e2e/chaos.mjs [classes=20]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'outfit-chaos-'));
process.env.DATA_DIR = DATA;
delete process.env.LABS;
const session = await import('../server/session.js');
const { SCENES } = await import('../server/steps.js');
const { movesFor } = await import('../server/bots.js');
const { PARTS, palette } = await import('../public/monster.js');

const CLASSES = Number(process.argv[2]) || 20;
const NAMES = ['Ana', 'Raj', 'Mei', 'Priya', 'Tom', 'Lea', 'Sam', 'Kim', 'Ola'];
const NOTES = ['main', 'fancy', 'sporty', 'wild', ''];
const GUESSES = ['ff', 'clean', 'conflict:hat', 'conflict:glasses', 'conflict:top', 'conflict:shoes', 'yes', 'no', 'maybe'];
const ACTIONS = ['draft', 'draft', 'draft', 'commit', 'commit', 'branch', 'switch', 'switch', 'merge', 'merge', 'resolve',
  'abort', 'deleteNote', 'push', 'push', 'pull', 'rebase', 'revert', 'reset', 'predict', 'why', 'answer'];

let seed = 1;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

function input(action, st, step) {
  const ids = (st.lab?.graph?.cards ?? st.graph?.cards ?? []).map((c) => c.id).filter(Boolean);
  const part = pick([...PARTS, 'tail']);
  const value = pick([...(palette(step)[part] ?? ['x']), 'nonsense']);
  switch (action) {
    case 'draft': return { part, value };
    case 'branch': return { name: pick(NOTES) };
    case 'switch': return { branch: pick(NOTES) };
    case 'merge': return { from: pick(NOTES), guess: pick(GUESSES) };
    case 'resolve': return { part, value };
    case 'deleteNote': return { note: pick(NOTES) };
    case 'push': return { guess: pick(GUESSES) };
    case 'revert': case 'reset': return { commit: pick([...ids, 'deadbeef', '']) };
    case 'predict': return { moment: `${step}:1:${pick(['merge', 'push'])}:${pick(NOTES)}`, guess: pick(GUESSES) };
    case 'why': return { text: 'because' };
    case 'answer': return { scene: 'reveal-1', text: 'x' };
    default: return {};
  }
}

const tally = {}; // step -> { hints, rescue, failed }
const crashes = [];
const chaosOk = {}; // action -> [accepted, refused] during the random presses

async function act(action, pid, extra, count = false) {
  try {
    const r = await session.act(action, { pid, ...extra });
    if (!r || typeof r.ok !== 'boolean') crashes.push(`${action}: no ok field`);
    if (count) (chaosOk[action] ??= [0, 0])[r.ok ? 0 : 1] += 1;
  } catch (err) {
    crashes.push(`${action} ${JSON.stringify(extra)}: ${err.message}`);
  }
}

async function playClass(n) {
  await session.admin('reset', {});
  const pids = [];
  for (const name of NAMES.slice(0, n)) {
    const r = await session.join({ name });
    session.connect(r.pid);
    pids.push(r.pid);
  }
  for (const scene of SCENES.slice(1)) {
    await session.admin('next', {});
    if (scene.kind !== 'task') continue;
    const step = scene.step;
    // Chaos: every student presses 6 random buttons.
    for (let round = 0; round < 6; round++) {
      for (const pid of pids) {
        const st = await session.state(pid);
        const action = pick(ACTIONS);
        await act(action, pid, input(action, st, step), true);
      }
    }
    if (step === 0) continue;
    // Then everyone follows their hint (the exact click), up to 25 rounds.
    const labsDone = async () => (await session.adminState('http://x/')).labs.filter((l) => !l.practice);
    for (let round = 0; round < 25 && !(await labsDone()).every((l) => l.done); round++) {
      for (const pid of pids) {
        const st = await session.state(pid);
        if (!st.me.hint?.click) continue;
        for (const [action, extra] of movesFor(st.me.hint.click, st)) await act(action, pid, extra);
      }
    }
    const t = (tally[step] ??= { hints: 0, rescue: 0, failed: 0 });
    for (const lab of await labsDone()) {
      if (lab.done) { t.hints += 1; continue; }
      const r = await session.admin('rescue', { labId: lab.id });
      const after = (await labsDone()).find((l) => l.id === lab.id);
      if (after?.done || /already done/.test(r.result?.message ?? '')) t.rescue += 1;
      else { t.failed += 1; crashes.push(`Step ${step}: ${lab.name} not done after Rescue (${r.error ?? r.result?.message})`); }
    }
  }
}

await session.boot();
for (let c = 0; c < CLASSES; c++) {
  seed = 1000 + c;
  await playClass([4, 5, 7, 8, 9][c % 5]);
}
session.flush();
fs.rmSync(DATA, { recursive: true, force: true });

console.log(`${CLASSES} chaotic classes (4–9 students each, 6 random presses per student per step):`);
for (const [step, t] of Object.entries(tally)) {
  console.log(`  Step ${step}: back on track by hints ${t.hints} labs · needed Rescue ${t.rescue} · failed ${t.failed}`);
}
console.log('  Random presses accepted / refused:', Object.entries(chaosOk).map(([a, [y, n]]) => `${a} ${y}/${n}`).join(' · '));
if (crashes.length) {
  console.log(`PROBLEMS (${crashes.length}):`, [...new Set(crashes)].slice(0, 15));
  process.exitCode = 1;
} else {
  console.log('No crash, and every lab finished every step.');
}
