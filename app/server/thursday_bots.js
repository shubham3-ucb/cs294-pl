// Thursday's Rehearse with bots: 2–12 bot students, so one person can run The Humans alone.
// Bots join by name and act only through the session's student calls (join, state, answer), at a human pace:
// each answers a scene at its own moment within the scene's planned minutes (divided by the speed), and does
// posts and comments one at a time. Answers are plausible and varied, with some wrong or contrary ones, so every
// reveal shows a real spread. In each group, one bot types (as the page asks). Names end in "(bot)".
// Stop rehearsal or Reset removes them.
import crypto from 'node:crypto';
import * as thu from './thursday.js';
import { SCENES, POSTS, LABELS, COMMENTS, CATEGORIES } from './thursday_scenes.js';

const NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kai', 'Noor'];
export const SPEEDS = [1, 5, 20]; // real time, 5× and 20× faster
const TICK_MS = 400;

// ---------- What bots say ----------

const WHY = ['I use it every day, but I still look up rebase.', 'Fine with the basics; rewriting history scares me.',
  'I taught it as a TA and I still search for reflog.', 'I can get out of trouble, slowly.', '', '', ''];
const TIPS = ['Learn the model first: commits, branches, HEAD.', 'Make a scratch repo and break it on purpose.',
  'Run git status after every command.', 'Draw the graph before you rebase.', '', '', ''];
// Per claim: [what the facts show, what you would need], as the two boxes ask.
const CLAIM_TEXT = {
  experience: [['Some people with old Stack Overflow accounts asked for help with Git.', 'Years of Git use for each asker, not account age; and watch some of them use Git.'],
    ['People with old accounts ask Git questions too.', 'How many experienced developers get stuck, out of all of them, not only the ones who asked.']],
  difficulty: [['Credential questions go without an accepted answer a bit more often than average.', 'Watch people use credential and submodule and count who gets stuck.'],
    ['Some commands get fewer accepted answers; that is not the same as hard.', 'A measure of difficulty that does not depend on one click by the asker.']],
  learning: [['These 92 people mostly say they learned online.', 'The same question put to developers not found through Stack Overflow.'],
    ['Most respondents report learning from the internet.', 'A record of how people learned, not a memory; and a sample that is not from Stack Overflow.']],
  selfrating: [['Most of the 92 rate themselves competent or below.', 'A test of Git skill, next to the self-rating.'],
    ['People are modest about their Git skill.', 'Watch the self-rated experts and see whether they have doubts.']],
};
// Per design: [the change, who tries it doing what, measure and what could fool you, how the data is got].
const DESIGN_TEXT = [
  ['`git undo`: reverses the last command and says what it did.', '20 grad students who just made a bad commit; half get git undo, half do not.',
    'Time to recover. What could fool you: a learning effect if the same people try both.', 'Watch them fix the mistake; screen recordings.'],
  ['After every reset, print the reflog line that brings you back.', 'New Git users in the course, after their first reset.',
    'Share of recoveries that succeed. What could fool you: a ceiling effect on easy tasks.', 'Course telemetry: recoveries within 5 minutes of a reset.'],
  ['A timeline of every place HEAD has been, with an Undo button.', 'Students doing their first rebase, with and without the timeline.',
    'Commits lost. What could fool you: people in a study are more careful than usual.', 'Lab study with a scripted rebase task; screen recordings.'],
];
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
// Most pick the answer the reveal marks right; some don't.
const vote = (s) => (chance(0.7) ? SCENES.find((x) => x.shows === s.id).correct : crypto.randomInt(s.options.length));
// Most read the post as the reveal expects; some disagree.
const label = (post) => LABELS[post.askerNamesIt ? weighted([0.7, 0.1, 0.2]) : weighted([0.12, 0.44, 0.44])].id;
const code = (comment) => (chance(0.65) ? comment.category : crypto.randomInt(CATEGORIES.length));

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
  if (!['survey', 'vote', 'label', 'code', 'group', 'exit'].includes(s.kind)) return null;
  let plan = bot.plan.get(s.id);
  if (!plan) bot.plan.set(s.id, (plan = { at: momentIn(s.id), done: 0 }));
  if (Date.now() < plan.at) return null;
  const answer = (body) => thu.answer({ pid: bot.pid, scene: s.id, ...body });
  if (s.kind === 'survey' && !st.me.survey) answer({ value: JSON.stringify(survey()) });
  else if (s.kind === 'vote' && st.me.vote === null) answer({ value: vote(s) });
  else if (s.kind === 'exit' && !st.me.exit) answer({ text: EXITS[bot.index % EXITS.length] });
  else if (s.kind === 'label' || s.kind === 'code') {
    const items = s.kind === 'label' ? POSTS : COMMENTS;
    const mine = s.kind === 'label' ? st.me.labels : st.me.codes;
    const next = items.find((x) => mine[x.id] === undefined);
    if (!next) return null;
    if (s.kind === 'label') answer({ post: next.id, value: label(next) });
    else answer({ item: next.id, value: code(next) });
    plan.at = Date.now() + gapIn(s.id, items.length);
  } else if (s.kind === 'group' && st.group) {
    // One typist per group: the first bot in it. It fills one field at a time.
    const typist = R.bots.find((b) => st.group.members.includes(b.name));
    if (typist !== bot) return null;
    const fields = s.fields === 'claim' ? s.claimFields : s.designFields;
    const texts = s.fields === 'claim' ? pick(CLAIM_TEXT[st.group.claim.id]) : DESIGN_TEXT[bot.index % DESIGN_TEXT.length];
    const field = fields.find((f) => !st.group.answers?.[f.id]);
    if (!field) return null;
    answer({ field: field.id, text: texts[fields.indexOf(field)] });
    plan.at = Date.now() + gapIn(s.id, fields.length + 1);
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
