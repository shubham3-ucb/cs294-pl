// Thursday session: people, the scene, survey answers, votes, post labels, groups and their answers, exit lines.
// One JSON file (DATA_DIR/thursday.json); no Git here. Clients poll /api/thu/state; `v` changes on every write.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SCENES, SURVEY, POSTS, CLAIMS, CLAIM_FIELDS, DESIGN_FIELDS, PAPER, PAPER_SURVEY } from './thursday_scenes.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const FILE = path.join(DATA_DIR, 'thursday.json');
const FORMAT = 1;
const NAME_MAX = 24;
const TEXT_MAX = 300;
const HERE_MS = 10_000; // polled within 10 s = here
const GROUP_SIZE = 4;

let S;
let saveTimer = null;
const seen = new Map(); // pid -> last poll (not saved)

const fresh = () => ({
  format: FORMAT, boot: crypto.randomBytes(4).toString('hex'), v: 0, scene: 0,
  people: {}, survey: {}, votes: {}, labels: {}, groups: null, groupAnswers: {}, exit: {},
});

export function boot() {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    S = saved.format === FORMAT ? saved : fresh();
  } catch {
    S = fresh();
  }
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

export function flush() {
  clearTimeout(saveTimer);
  if (!S) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(S));
  fs.renameSync(`${FILE}.tmp`, FILE);
}

function changed() {
  S.v += 1;
  save();
}

const ok = (result = {}) => ({ ok: true, ...result });
const fail = (error) => ({ ok: false, error });
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const scene = () => SCENES[S.scene];
const sceneById = (id) => SCENES.find((s) => s.id === id);
const here = () => Object.keys(S.people).filter((pid) => Date.now() - (seen.get(pid) ?? 0) < HERE_MS);

// ---------- Groups: formed once, when the class first reaches a group scene ----------

function formGroups() {
  const pids = here().length ? here() : Object.keys(S.people);
  for (let i = pids.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pids[i], pids[j]] = [pids[j], pids[i]];
  }
  const k = Math.max(1, Math.round(pids.length / GROUP_SIZE));
  S.groups = Array.from({ length: k }, (_, i) => ({ id: `g${i + 1}`, name: `Group ${i + 1}`, claim: i % CLAIMS.length, members: [] }));
  pids.forEach((pid, i) => S.groups[i % k].members.push(pid));
  for (const g of S.groups) for (const pid of g.members) S.people[pid].group = g.id;
}

function joinGroup(pid) {
  const smallest = S.groups.reduce((a, b) => (b.members.length < a.members.length ? b : a));
  smallest.members.push(pid);
  S.people[pid].group = smallest.id;
}

const groupOf = (pid) => S.groups?.find((g) => g.id === S.people[pid]?.group) ?? null;
const fieldsFor = (s) => (s.fields === 'claim' ? CLAIM_FIELDS : DESIGN_FIELDS);

// ---------- Students ----------

export function join({ name, pid }) {
  if (pid && S.people[pid]) {
    seen.set(pid, Date.now());
    return ok({ pid, name: S.people[pid].name });
  }
  const n = clean(name, NAME_MAX);
  if (!n) return fail('Type your first name.');
  const id = crypto.randomBytes(6).toString('hex');
  S.people[id] = { name: n, joined: Date.now(), group: null };
  seen.set(id, Date.now());
  if (S.groups) joinGroup(id);
  changed();
  return ok({ pid: id, name: n });
}

export function state(pid) {
  const me = S.people[pid];
  if (!me) return ok({ boot: S.boot, v: S.v, joined: false, scene: publicScene(scene()), index: S.scene, total: SCENES.length, paper: PAPER });
  seen.set(pid, Date.now());
  if (S.groups && !groupOf(pid)) { // away when the groups formed: join the smallest now
    joinGroup(pid);
    changed();
  }
  const s = scene();
  const g = groupOf(pid);
  return ok({
    boot: S.boot, v: S.v, joined: true, index: S.scene, total: SCENES.length, scene: publicScene(s), paper: PAPER,
    claims: s.shows === 'claims' ? CLAIMS : undefined, // model answers only once the verdicts are on
    me: {
      name: me.name,
      survey: S.survey[pid] ?? null,
      vote: s.kind === 'vote' ? S.votes[s.id]?.[pid] ?? null : null,
      labels: S.labels[pid] ?? {},
      exit: S.exit[pid] ?? '',
    },
    group: g && {
      name: g.name,
      members: g.members.map((m) => S.people[m]?.name).filter(Boolean),
      claim: (({ id, quote, where, look }) => ({ id, quote, where, look }))(CLAIMS[g.claim]), // no model answer
      answers: s.kind === 'group' ? S.groupAnswers[s.id]?.[g.id] ?? null : null,
    },
    results: s.kind === 'reveal' || s.kind === 'end' ? results(s.shows) : null,
  });
}

// What every client may see of a scene (teacher notes stay on the console).
function publicScene(s) {
  const { say, hope, ...rest } = s;
  if (s.kind === 'survey') rest.survey = SURVEY;
  if (s.kind === 'label') rest.posts = POSTS.map(({ askerNamesIt, ...p }) => p); // no answer key
  if (s.kind === 'group') rest[s.fields === 'claim' ? 'claimFields' : 'designFields'] = fieldsFor(s);
  return rest;
}

// "Other (please specify)": the form's text box beside that option, kept only when the option is picked.
const OTHER = 'Other (please specify)';
const otherOf = (q, picked, input) => (picked.some((i) => q.options[i] === OTHER) ? clean(input[`${q.id}Other`], TEXT_MAX) : '');

function validSurvey(input) {
  const out = {};
  for (const q of SURVEY) {
    const val = input?.[q.id];
    if (q.type === 'one') {
      const i = Number(val);
      if (!Number.isInteger(i) || i < 0 || i >= q.options.length) return fail(`Answer: ${q.q}`);
      out[q.id] = i;
      if (q.why) out.why = clean(input.why, TEXT_MAX);
      if (q.options.includes(OTHER)) out[`${q.id}Other`] = otherOf(q, [i], input);
    } else if (q.type === 'many') {
      const picks = [...new Set((Array.isArray(val) ? val : []).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < q.options.length);
      if (!picks.length) return fail(`Answer: ${q.q}`);
      out[q.id] = picks.sort((a, b) => a - b);
      out[`${q.id}Other`] = otherOf(q, picks, input);
    } else if (q.type === 'number') {
      const n = Number(val);
      if (val === '' || val === null || !Number.isFinite(n) || n < q.min || n > q.max) return fail(`Answer: ${q.q} (${q.min}–${q.max})`);
      out[q.id] = Math.round(n * 2) / 2;
    } else {
      out[q.id] = clean(val, TEXT_MAX);
    }
  }
  return ok({ survey: out });
}

// One endpoint for every student input; the scene decides what is accepted.
export function answer({ pid, scene: sceneId, value, post, field, text }) {
  if (!S.people[pid]) return fail('Please join again.');
  seen.set(pid, Date.now());
  const s = sceneById(sceneId);
  if (!s || s !== scene()) return fail('The class has moved on. Look up.');
  if (s.kind === 'survey') {
    let input = value;
    if (typeof value === 'string') {
      try { input = JSON.parse(value); } catch { input = null; }
    }
    const r = validSurvey(input);
    if (!r.ok) return r;
    S.survey[pid] = r.survey;
  } else if (s.kind === 'vote') {
    const i = Number(value);
    if (!Number.isInteger(i) || i < 0 || i >= s.options.length) return fail('Pick one.');
    (S.votes[s.id] ??= {})[pid] = i;
  } else if (s.kind === 'label') {
    const p = POSTS.find((x) => x.id === String(post));
    if (!p || !['yes', 'no'].includes(value)) return fail('Pick yes or no.');
    (S.labels[pid] ??= {})[p.id] = value;
  } else if (s.kind === 'group') {
    const g = groupOf(pid);
    if (!g) return fail('Wait a moment: your group is being formed.');
    const f = fieldsFor(s).find((x) => x.id === field);
    if (!f) return fail('No such field.');
    const entry = ((S.groupAnswers[s.id] ??= {})[g.id] ??= {});
    entry[f.id] = clean(text, TEXT_MAX);
    entry.by = S.people[pid].name;
    entry.t = Date.now();
  } else if (s.kind === 'exit') {
    const t = clean(text, TEXT_MAX);
    if (!t) return fail('Write one line.');
    S.exit[pid] = t;
  } else {
    return fail('Nothing to answer right now.');
  }
  changed();
  return ok();
}

// ---------- Results (reveals, projector, console) ----------

const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export function results(what) {
  if (!what) return null;
  const vote = sceneById(what);
  if (vote?.kind === 'vote') {
    const counts = vote.options.map(() => 0);
    for (const i of Object.values(S.votes[what] ?? {})) counts[i] += 1;
    return { type: 'vote', options: vote.options, counts, n: counts.reduce((a, b) => a + b, 0) };
  }
  if (what === 'survey') {
    const all = Object.values(S.survey);
    const count = (id, k) => SURVEY.find((q) => q.id === id).options.map((_, i) => all.filter((a) => (k ? a[id].includes(i) : a[id] === i)).length);
    return {
      type: 'survey', n: all.length, paper: PAPER_SURVEY,
      level: count('level'), learn: count('learn', true), academia: count('area')[0],
      medianYears: median(all.map((a) => a.years)), ticks: all.reduce((n, a) => n + a.learn.length, 0),
      levels: SURVEY.find((q) => q.id === 'level').options, approaches: SURVEY.find((q) => q.id === 'learn').options,
    };
  }
  if (what === 'labels') {
    const all = Object.values(S.labels);
    return {
      type: 'labels',
      n: all.filter((l) => Object.keys(l).length === POSTS.length).length,
      posts: POSTS.map((p) => ({
        id: p.id, title: p.title, command: p.command, views: p.views, askerNamesIt: p.askerNamesIt,
        yes: all.filter((l) => l[p.id] === 'yes').length, no: all.filter((l) => l[p.id] === 'no').length,
      })),
    };
  }
  if (what === 'claims' || what === 'design') {
    const s = sceneById(what);
    return {
      type: what,
      fields: fieldsFor(s),
      groups: (S.groups ?? []).map((g) => ({
        name: g.name, members: g.members.map((m) => S.people[m]?.name).filter(Boolean),
        claim: what === 'claims' ? CLAIMS[g.claim] : null, answers: S.groupAnswers[what]?.[g.id] ?? null,
      })),
    };
  }
  if (what === 'exit') return { type: 'exit', lines: Object.values(S.exit) };
  return null;
}

// How many have answered the current scene, out of who is here.
function progress(s) {
  const people = Object.keys(S.people);
  const done = (pid) => {
    if (s.kind === 'survey') return !!S.survey[pid];
    if (s.kind === 'vote') return S.votes[s.id]?.[pid] !== undefined;
    if (s.kind === 'label') return Object.keys(S.labels[pid] ?? {}).length === POSTS.length;
    if (s.kind === 'exit') return !!S.exit[pid];
    return false;
  };
  if (s.kind === 'group') {
    const groups = S.groups ?? [];
    const fields = fieldsFor(s);
    const full = groups.filter((g) => fields.every((f) => S.groupAnswers[s.id]?.[g.id]?.[f.id])).length;
    return { done: full, of: groups.length, unit: 'groups' };
  }
  if (!['survey', 'vote', 'label', 'exit'].includes(s.kind)) return null;
  return { done: people.filter(done).length, of: people.length, unit: 'people' };
}

// ---------- Teacher ----------

export function adminState(joinUrl) {
  const s = scene();
  return ok({
    boot: S.boot, v: S.v, index: S.scene, total: SCENES.length, scene: s, joinUrl, paper: PAPER, claims: CLAIMS,
    next: SCENES[S.scene + 1] ? { title: SCENES[S.scene + 1].title, part: SCENES[S.scene + 1].part } : null,
    people: Object.entries(S.people).map(([pid, p]) => ({ name: p.name, here: Date.now() - (seen.get(pid) ?? 0) < HERE_MS, group: groupOf(pid)?.name ?? null })),
    hereCount: here().length,
    groups: (S.groups ?? []).map((g) => ({ name: g.name, members: g.members.map((m) => S.people[m]?.name), claim: CLAIMS[g.claim].id })),
    progress: progress(s),
    results: results(s.kind === 'reveal' || s.kind === 'end' ? s.shows : s.kind === 'group' ? s.id : null),
  });
}

export function admin(action, { from } = {}) {
  if (action === 'reset') {
    S = fresh();
    seen.clear();
    flush();
    return ok({ message: 'New session. Everyone joins again.' });
  }
  if (from !== undefined && from !== null && from !== '' && Number(from) !== S.scene) return ok({ unchanged: true });
  if (action === 'next' && S.scene < SCENES.length - 1) {
    S.scene += 1;
    if (scene().kind === 'group' && !S.groups && Object.keys(S.people).length) formGroups();
  } else if (action === 'back' && S.scene > 0) {
    S.scene -= 1;
  } else {
    return ok({ unchanged: true });
  }
  changed();
  return ok({ index: S.scene });
}

export function exportMarkdown() {
  const who = (pid) => S.people[pid]?.name ?? '?';
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const out = [`# Thursday · The Humans · answers`, '', `Exported ${stamp} UTC · ${Object.keys(S.people).length} people`, ''];
  const sv = results('survey');
  out.push('## Survey (the paper’s questions)', '', `${sv.n} answered. Median years using Git: ${sv.medianYears ?? '—'} (paper: 8).`, '');
  sv.levels.forEach((l, i) => out.push(`- ${l}: ${sv.level[i]} (paper: ${PAPER_SURVEY.level[i]} of 92)`));
  out.push('');
  sv.approaches.forEach((l, i) => out.push(`- ${l}: ${sv.learn[i]} (paper: ${PAPER_SURVEY.learn[i]} of 92)`));
  out.push('', 'Why (level), other, and suggestions:');
  for (const [pid, a] of Object.entries(S.survey)) {
    if (a.why) out.push(`- ${who(pid)} (why): ${a.why}`);
    if (a.degreeOther) out.push(`- ${who(pid)} (degree, other): ${a.degreeOther}`);
    if (a.learnOther) out.push(`- ${who(pid)} (learned, other): ${a.learnOther}`);
    if (a.tip) out.push(`- ${who(pid)} (tip): ${a.tip}`);
  }
  for (const id of ['kind', 'data']) {
    const r = results(id);
    out.push('', `## Vote: ${sceneById(id).title}`, '', ...r.options.map((o, i) => `- ${o}: ${r.counts[i]}`));
  }
  const lb = results('labels');
  out.push('', '## Posts: is it really about the command?', '');
  for (const p of lb.posts) out.push(`- ${p.title} (\`${p.command}\`, asker names it: ${p.askerNamesIt ? 'yes' : 'no'}): yes ${p.yes}, no ${p.no}`);
  for (const id of ['claims', 'design']) {
    const r = results(id);
    out.push('', `## ${sceneById(id).title}`, '');
    for (const g of r.groups) {
      out.push(`### ${g.name} (${g.members.join(', ')})`, '');
      if (g.claim) out.push(`Claim: “${g.claim.quote}”`, '');
      for (const f of r.fields) out.push(`- ${f.label}: ${g.answers?.[f.id] || '—'}`);
      out.push('');
    }
  }
  out.push('## Exit: one new idea for building tools for people', '', ...Object.entries(S.exit).map(([pid, t]) => `- ${who(pid)}: ${t}`), '');
  return out.join('\n');
}

export const version = () => ({ v: S.v, boot: S.boot });
