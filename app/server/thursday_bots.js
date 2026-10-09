// Thursday's Rehearse with bots: 2–12 bot students, so one person can run the class alone.
// Bots join by name and act only through the session's student calls (join, state, answer), at a human pace:
// each answers a scene at its own moment within the scene's planned minutes (divided by the speed), and does
// posts and sorted items one at a time. Answers are plausible and varied, with some wrong or contrary ones, so every
// reveal shows a real spread. In each group, one bot types (as the page asks). Names end in "(bot)".
// Stop rehearsal or Reset removes them.
import crypto from 'node:crypto';
import * as thu from './thursday.js';
import { SCENES, POSTS, LABELS, ITEMS, TASKS } from './thursday_scenes.js';

const NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kai', 'Noor'];
export const SPEEDS = [1, 5, 20]; // real time, 5× and 20× faster
const TICK_MS = 400;

// ---------- What bots say ----------

const WHY = ['I use it every day, but I still look up rebase.', 'Fine with the basics; rewriting history scares me.',
  'I taught it as a TA and I still search for reflog.', 'I can get out of trouble, slowly.', '', '', ''];
const TIPS = ['Learn the model first: commits, branches, HEAD.', 'Make a scratch repo and break it on purpose.',
  'Run git status after every command.', 'Draw the graph before you rebase.', '', '', ''];
// What bots write, per write scene: one entry per person (solo) or per group, in the order of the scene's fields.
const WRITES = {
  'you-first': [['Screen-record 20 developers doing a set of Git tasks and count who finishes each one.'],
    ['Survey developers about which commands they find confusing.'], ['Mine GitHub repos for force pushes and reverts that undo mistakes.'],
    ['Give students a Git quiz and compare scores with years of experience.'], ['Log every Git command people type for a week and look for retries.'],
    ['Interview a few senior engineers about their worst Git moments.']],
  'rq-pair': [['When a merge conflict appears, what do people try before asking for help?', 'Show the step people miss right in the conflict message.'],
    ['Which undo do people pick when they made a bad commit, and does it work?', 'Make the safe undo the default, and warn before the unsafe one.'],
    ['How long do people stay stuck in detached HEAD before they recover?', 'If it is long, print the way back immediately.'],
    ['Do GUI users run into the same problems as command-line users?', 'Decide whether the fix belongs in Git or in the GUI.']],
  claims: {
    experience: ['Years since joining Stack Overflow.', 'Internal: account age is not Git experience.', 'Believe a smaller claim: some long-time users ask Git questions.'],
    difficulty: ['Share of a command’s questions with no accepted answer.', 'Internal: a missing click is not difficulty, and the fix counts as the problem.', 'Not as written.'],
    learning: ['Ticked boxes from 92 people about how they remember learning.', 'External: they were found through Stack Overflow.', 'Believe a smaller claim: these 92 say they learned online.'],
    selfrating: ['Self-rated level on a five-step scale.', 'Internal: modesty and wording, not skill.', 'Not as written: nobody was tested.'],
    coding: ['Comments sorted by the authors, with no stated method.', 'Internal: another team could sort them differently.', 'Believe that the comments mention these topics; not the counts.'],
  },
};
const QUESTIONS = ['Is account age ever a good proxy for experience?', 'Would watching people change which commands look hard?',
  'Why did the authors not test anyone’s Git skill?', 'Could the comment categories be redone with two coders?',
  'Is Stack Overflow even where people ask about Git today?', 'What would an evaluative follow-up study look like?'];
const EXITS = ['Watch people use the tool; what they ask is not what they do.', 'A safety net nobody can find does not help anyone.',
  'Check what a trace records before you count it.', 'Design undo first: it is what people search for most.',
  'A ranking built on a mean is a few famous posts.', 'Code qualitative data with two people, and report agreement.',
  'Ask what the data would look like if the claim were false.', 'Make recovery visible in the tool, not in a man page.',
  'Asking can find a need; only watching shows a fix works.', 'Self-ratings measure modesty as much as skill.',
  'Count the problem, not the command in the answer.', 'Show people where they have been before they need it.'];

// ---------- Choices, with some noise ----------

const rand = () => crypto.randomInt(1_000_000) / 1_000_000;
const pick = (xs) => xs[crypto.randomInt(xs.length)];
const weighted = (weights) => {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
};
const chance = (p) => rand() < p;

function survey() {
  const learn = [0.25, 0.15, 0.35, 0.7, 0.9, 0.03].map((p, i) => (chance(p) ? i : -1)).filter((i) => i >= 0);
  return {
    area: chance(0.85) ? 0 : 1, degree: weighted([0.45, 0.45, 0.05, 0.05]), years: 2 + crypto.randomInt(11),
    level: weighted([0.05, 0.3, 0.45, 0.17, 0.03]), why: pick(WHY), learn: learn.length ? learn : [4], learnOther: '', degreeOther: '',
    tip: pick(TIPS),
  };
}
// Most sort an item as the key does; some don't.
const sortOne = (s, item) => (chance(0.72) ? ITEMS[SCENES.find((x) => x.id === s.id).items].items.find((x) => x.id === item.id).key : crypto.randomInt(s.categories.length));
// Most read the post as the reveal expects; some disagree.
const label = (post) => LABELS[post.askerNamesIt ? weighted([0.7, 0.1, 0.2]) : weighted([0.12, 0.44, 0.44])].id;

// ---------- The loop ----------

let R = null; // { bots: [{ pid, name, plan: Map(sceneId -> { at, done }) }], speed, boot }

export function status() {
  return R ? { count: R.bots.length, speed: R.speed } : null;
}

const minutesOf = (id) => SCENES.find((s) => s.id === id)?.minutes ?? 2;
// A moment within the scene: between 8% and 45% of its planned time, at this speed (at least 1.5 s).
const momentIn = (sceneId) => Date.now() + Math.max(1500, (minutesOf(sceneId) * 60_000 * (0.08 + 0.37 * rand())) / R.speed);
// The gap between two posts or comments: the scene's time spread over the items, give or take.
const gapIn = (sceneId, items) => Math.max(600, (minutesOf(sceneId) * 60_000 * 0.55 / items) * (0.6 + 0.8 * rand()) / R.speed);

function step(bot) {
  const st = thu.state(bot.pid); // also keeps the bot "here"
  if (!st.ok || !st.joined) return 'gone';
  const s = st.pending ?? st.scene;
  // Now and then, a question for the class.
  if (!bot.asked && chance(0.004 * R.speed)) {
    bot.asked = true;
    thu.ask({ pid: bot.pid, text: QUESTIONS[bot.index % QUESTIONS.length] });
  }
  if (!['tasks', 'survey', 'sort', 'label', 'write', 'exit'].includes(s.kind)) return null;
  let plan = bot.plan.get(s.id);
  if (!plan) bot.plan.set(s.id, (plan = { at: momentIn(s.id), done: 0 }));
  if (Date.now() < plan.at) return null;
  const answer = (body) => thu.answer({ pid: bot.pid, scene: s.id, ...body });
  if (s.kind === 'survey' && !st.me.survey) answer({ value: JSON.stringify(survey()) });
  else if (s.kind === 'tasks') {
    // One task at a time: a pick (right about 60% of the time, more when sure), then how sure.
    const next = TASKS.find((t) => st.me.tasks?.[t.id]?.sure === undefined);
    if (!next) return null;
    const sure = weighted([0.3, 0.45, 0.25]);
    const pick = chance([0.4, 0.6, 0.8][sure]) ? next.key : crypto.randomInt(next.options.length);
    answer({ item: next.id, field: 'pick', value: pick });
    answer({ item: next.id, field: 'sure', value: sure });
    plan.at = Date.now() + gapIn(s.id, TASKS.length);
  }
  else if (s.kind === 'exit' && !st.me.exit) answer({ text: EXITS[bot.index % EXITS.length] });
  else if (s.kind === 'label' || s.kind === 'sort') {
    const items = s.kind === 'label' ? POSTS : s.items;
    const mine = s.kind === 'label' ? st.me.labels : st.me.sorts?.[s.id] ?? {};
    const next = items.find((x) => mine[x.id] === undefined);
    if (!next) return null;
    if (s.kind === 'label') answer({ post: next.id, value: label(next) });
    else answer({ item: next.id, value: sortOne(s, next) });
    plan.at = Date.now() + gapIn(s.id, items.length);
  } else if (s.kind === 'write') {
    // Alone: every bot writes. In a pair or group: one typist, the first bot in it, one field at a time.
    if (s.who !== 'solo') {
      if (!st.group) return null;
      const typist = R.bots.find((b) => st.group.members.includes(b.name));
      if (typist !== bot) return null;
    }
    const pool = s.id === 'claims' ? [WRITES.claims[st.group?.claim?.id] ?? WRITES.claims.experience] : WRITES[s.id] ?? [];
    if (!pool.length) return null;
    const texts = pool[bot.index % pool.length];
    const field = s.fields.find((f) => !st.answers?.[f.id]);
    if (!field) return null;
    answer({ field: field.id, text: texts[s.fields.indexOf(field)] ?? texts[0] });
    plan.at = Date.now() + gapIn(s.id, s.fields.length + 1);
  }
  return null;
}

let timer = null;
function loop() {
  if (!R) return;
  for (const bot of R.bots) {
    if (step(bot) === 'gone') { stop(); return; } // Reset: the bots are gone with the class
  }
}

function stop() {
  clearInterval(timer);
  timer = null;
  if (R) thu.removePeople(R.bots.map((b) => b.pid));
  R = null;
}

export function rehearse({ on, count, speed }) {
  const sp = SPEEDS.includes(Number(speed)) ? Number(speed) : 1;
  if (!on || on === 'false') {
    stop();
    return { ok: true, result: { message: 'Rehearsal stopped. The bots left.' } };
  }
  if (R) {
    R.speed = sp; // a running rehearsal only changes speed
    return { ok: true, result: { message: `Bots now at ${sp}×.` } };
  }
  const n = Math.min(12, Math.max(2, Number(count) || 6));
  const bots = [];
  for (let i = 0; i < n; i++) {
    const r = thu.join({ name: `${NAMES[i]} (bot)` });
    if (!r.ok) break;
    bots.push({ pid: r.pid, name: r.name, index: i, plan: new Map() });
  }
  R = { bots, speed: sp };
  timer = setInterval(loop, TICK_MS);
  return { ok: true, result: { message: `${bots.length} bots joined.` } };
}
