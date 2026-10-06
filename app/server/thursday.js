// Thursday session: people, the scene, survey answers, votes, post labels, comment codes, groups and their
// answers, exit lines. One JSON file (DATA_DIR/thursday.json); no Git here. Clients poll /api/thu/state; `v`
// changes on every write.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  SCENES, SURVEY, POSTS, LABELS, COMMENTS, CATEGORIES, CLAIMS, CLAIM_FIELDS, DESIGN_FIELDS, PAPER, PAPER_SURVEY, BUFFER_MINUTES,
} from './thursday_scenes.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const FILE = path.join(DATA_DIR, 'thursday.json');
const FORMAT = 2;
const NAME_MAX = 24;
const TEXT_MAX = 300;
const JOIN_MAX = 80;
const HERE_MS = 90_000; // polled within 90 s = here (hidden tabs poll slowly)
const RECENT_MS = 10 * 60_000; // seen within 10 min = in the room, for forming groups
const GROUP_SIZE = 4;
const GROUP_MAX = 6; // a late joiner opens a new group when every group has 6

let S;
let saveTimer = null;
const seen = new Map(); // pid -> last poll (not saved)

const fresh = () => ({
  format: FORMAT, boot: crypto.randomBytes(4).toString('hex'), v: 0, scene: 0, sceneAt: Date.now(),
  people: {}, survey: {}, votes: {}, labels: {}, codes: {}, groups: null, groupAnswers: {}, exit: {},
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
const indexOf = (id) => SCENES.findIndex((s) => s.id === id);
const within = (ms) => Object.keys(S.people).filter((pid) => Date.now() - (seen.get(pid) ?? 0) < ms);
const here = () => within(HERE_MS);
const isHere = (pid) => Date.now() - (seen.get(pid) ?? 0) < HERE_MS;

// Survey, labels and codes stay open until their reveal is over, so a slow student can finish.
const OPEN_UNTIL = { survey: 'survey-reveal', label: 'label-reveal', code: 'code-reveal' };
const isOpen = (s) => s === scene() || (OPEN_UNTIL[s.kind] && S.scene > indexOf(s.id) && S.scene <= indexOf(OPEN_UNTIL[s.kind]));

// ---------- Groups: formed when the class first reaches a group scene; the teacher can re-form them ----------

function formGroups() {
  const recent = within(RECENT_MS);
  const pids = recent.length ? recent : Object.keys(S.people);
  for (let i = pids.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pids[i], pids[j]] = [pids[j], pids[i]];
  }
  for (const p of Object.values(S.people)) p.group = null;
  const k = Math.max(1, Math.round(pids.length / GROUP_SIZE));
  S.groups = Array.from({ length: k }, (_, i) => ({ id: `g${i + 1}`, name: `Group ${i + 1}`, claim: i % CLAIMS.length, members: [] }));
  pids.forEach((pid, i) => S.groups[i % k].members.push(pid));
  for (const g of S.groups) for (const pid of g.members) S.people[pid].group = g.id;
}

function joinGroup(pid) {
  let target = S.groups.reduce((a, b) => (b.members.length < a.members.length ? b : a));
  if (target.members.length >= GROUP_MAX) {
    const i = S.groups.length;
    target = { id: `g${i + 1}`, name: `Group ${i + 1}`, claim: i % CLAIMS.length, members: [] };
    S.groups.push(target);
  }
  target.members.push(pid);
  S.people[pid].group = target.id;
}

const groupOf = (pid) => S.groups?.find((g) => g.id === S.people[pid]?.group) ?? null;
const fieldsFor = (s) => (s.fields === 'claim' ? CLAIM_FIELDS : DESIGN_FIELDS);

// ---------- Students ----------

// The same name again, from someone who is not here (a new link after a restart, another laptop): the same
// person. The same name while that person is here: a second person, "Ana 2".
export function join({ name, pid }) {
  if (pid && S.people[pid]) {
    seen.set(pid, Date.now());
    return ok({ pid, name: S.people[pid].name });
  }
  let n = clean(name, NAME_MAX);
  if (!n) return fail('Type your first name.');
  const same = Object.entries(S.people).filter(([, p]) => p.name.toLowerCase() === n.toLowerCase());
  const back = same.find(([id]) => !isHere(id));
  if (back) {
    seen.set(back[0], Date.now());
    changed();
    return ok({ pid: back[0], name: back[1].name });
  }
  if (Object.keys(S.people).length >= JOIN_MAX) return fail('The class is full.');
  if (same.length) {
    const taken = new Set(Object.values(S.people).map((p) => p.name.toLowerCase()));
    let k = 2;
    while (taken.has(`${n} ${k}`.toLowerCase())) k += 1;
    n = `${n} ${k}`;
  }
  const id = crypto.randomBytes(6).toString('hex');
  S.people[id] = { name: n, joined: Date.now(), group: null };
  seen.set(id, Date.now());
  if (S.groups) joinGroup(id);
  changed();
  return ok({ pid: id, name: n });
}

// What a student still has to finish from an earlier scene that is still open (survey, labels, codes).
function pending(pid) {
  for (const [kind, until] of Object.entries(OPEN_UNTIL)) {
    const s = SCENES.find((x) => x.kind === kind);
    if (S.scene <= indexOf(s.id) || S.scene > indexOf(until)) continue;
    const done = kind === 'survey' ? !!S.survey[pid]
      : kind === 'label' ? Object.keys(S.labels[pid] ?? {}).length === POSTS.length
        : Object.keys(S.codes[pid] ?? {}).length === COMMENTS.length;
    if (!done) return publicScene(s);
  }
  return null;
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
    pending: pending(pid),
    claims: s.shows === 'claims' ? CLAIMS : undefined, // model answers only once the verdicts are on
    me: {
      name: me.name,
      survey: S.survey[pid] ?? null,
      vote: s.kind === 'vote' ? S.votes[s.id]?.[pid] ?? null : null,
      labels: S.labels[pid] ?? {},
      codes: S.codes[pid] ?? {},
      exit: S.exit[pid] ?? '',
    },
    group: g && {
      name: g.name,
      members: g.members.map((m) => S.people[m]?.name).filter(Boolean),
      claim: (({ id, quote, where, facts }) => ({ id, quote, where, facts }))(CLAIMS[g.claim]), // no model answer
      answers: s.kind === 'group' ? S.groupAnswers[s.id]?.[g.id] ?? null : null,
    },
    results: s.kind === 'reveal' || s.kind === 'end' ? results(s.shows) : null,
  });
}

// What every client may see of a scene (teacher notes and answer keys stay on the console).
function publicScene(s) {
  const { say, hope, ...rest } = s;
  if (s.kind === 'survey') rest.survey = SURVEY;
  if (s.kind === 'label') {
    rest.posts = POSTS.map(({ askerNamesIt, ...p }) => p);
    rest.labels = LABELS;
  }
  if (s.kind === 'code') {
    rest.comments = COMMENTS.map(({ category, ...c }) => c);
    rest.categories = CATEGORIES;
  }
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
export function answer({ pid, scene: sceneId, value, post, item, field, text }) {
  if (!S.people[pid]) return fail('Please join again.');
  seen.set(pid, Date.now());
  const s = sceneById(sceneId);
  if (!s || !isOpen(s)) return fail('The class has moved on. Look up.');
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
    if (!p || !LABELS.some((l) => l.id === value)) return fail('Pick one label.');
    (S.labels[pid] ??= {})[p.id] = value;
  } else if (s.kind === 'code') {
    const c = COMMENTS.find((x) => x.id === String(item));
    const i = Number(value);
    if (!c || !Number.isInteger(i) || i < 0 || i >= CATEGORIES.length) return fail('Pick one category.');
    (S.codes[pid] ??= {})[c.id] = i;
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
// Agreement on one item: the share of labels that match the most common label.
const majorityShare = (counts) => {
  const n = counts.reduce((a, b) => a + b, 0);
  return n ? Math.max(...counts) / n : null;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

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
    const posts = POSTS.map((p) => {
      const counts = LABELS.map((l) => all.filter((x) => x[p.id] === l.id).length);
      return { id: p.id, title: p.title, command: p.command, views: p.views, askerNamesIt: p.askerNamesIt, counts, agreement: majorityShare(counts) };
    });
    return {
      type: 'labels', labels: LABELS, posts,
      n: all.filter((l) => Object.keys(l).length === POSTS.length).length,
      agreement: mean(posts.map((p) => p.agreement).filter((x) => x !== null)),
    };
  }
  if (what === 'codes') {
    const all = Object.values(S.codes);
    const items = COMMENTS.map((c) => {
      const counts = CATEGORIES.map((_, i) => all.filter((x) => x[c.id] === i).length);
      const n = counts.reduce((a, b) => a + b, 0);
      return { id: c.id, text: c.text, category: c.category, counts, n, withPaper: n ? counts[c.category] / n : null, agreement: majorityShare(counts) };
    });
    const labels = items.reduce((n, i) => n + i.n, 0);
    return {
      type: 'codes', categories: CATEGORIES, items,
      n: all.filter((x) => Object.keys(x).length === COMMENTS.length).length,
      withPaper: labels ? items.reduce((n, i) => n + i.counts[i.category], 0) / labels : null,
      agreement: mean(items.map((i) => i.agreement).filter((x) => x !== null)),
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

// How many of the people here have answered the current scene.
function progress(s) {
  const done = (pid) => {
    if (s.kind === 'survey') return !!S.survey[pid];
    if (s.kind === 'vote') return S.votes[s.id]?.[pid] !== undefined;
    if (s.kind === 'label') return Object.keys(S.labels[pid] ?? {}).length === POSTS.length;
    if (s.kind === 'code') return Object.keys(S.codes[pid] ?? {}).length === COMMENTS.length;
    if (s.kind === 'exit') return !!S.exit[pid];
    return false;
  };
  if (s.kind === 'group') {
    const groups = S.groups ?? [];
    const fields = fieldsFor(s);
    const full = groups.filter((g) => fields.every((f) => S.groupAnswers[s.id]?.[g.id]?.[f.id])).length;
    return { done: full, of: groups.length, unit: 'groups' };
  }
  if (!['survey', 'vote', 'label', 'code', 'exit'].includes(s.kind)) return null;
  const people = here();
  return { done: people.filter(done).length, of: people.length, unit: 'people' };
}

// ---------- Teacher ----------

export function adminState(joinUrl) {
  const s = scene();
  return ok({
    boot: S.boot, v: S.v, index: S.scene, total: SCENES.length, scene: s, joinUrl, paper: PAPER, claims: CLAIMS,
    elapsed: Date.now() - (S.sceneAt ?? Date.now()), buffer: BUFFER_MINUTES,
    next: SCENES[S.scene + 1] ? { title: SCENES[S.scene + 1].title, part: SCENES[S.scene + 1].part } : null,
    people: Object.entries(S.people).map(([pid, p]) => ({ name: p.name, here: isHere(pid), group: groupOf(pid)?.name ?? null })),
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
  if (action === 'regroup') {
    if (!Object.keys(S.people).length) return fail('Nobody has joined.');
    formGroups();
    S.groupAnswers = {};
    changed();
    return ok({ message: `${S.groups.length} new groups from the people in the room.` });
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
  S.sceneAt = Date.now();
  changed();
  return ok({ index: S.scene });
}

export function exportMarkdown() {
  const who = (pid) => S.people[pid]?.name ?? '?';
  const pct = (x) => (x === null ? '—' : `${Math.round(100 * x)}%`);
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
  for (const { id, title } of SCENES.filter((s) => s.kind === 'vote')) {
    const r = results(id);
    out.push('', `## Vote: ${title}`, '', ...r.options.map((o, i) => `- ${o}: ${r.counts[i]}`));
  }
  const lb = results('labels');
  out.push('', '## Posts: what is each post about?', '', `Agreement (share matching the most common label, averaged): ${pct(lb.agreement)}`, '');
  for (const p of lb.posts) {
    out.push(`- ${p.title} (\`${p.command}\`, asker names it: ${p.askerNamesIt ? 'yes' : 'no'}): ${LABELS.map((l, i) => `${l.label} ${p.counts[i]}`).join(', ')}`);
  }
  const cd = results('codes');
  out.push('', '## Coding the paper’s Table 8 comments', '', `Agreed with the paper: ${pct(cd.withPaper)} · with each other: ${pct(cd.agreement)}`, '');
  for (const i of cd.items) out.push(`- #${i.id} (paper: ${CATEGORIES[i.category]}): with the paper ${pct(i.withPaper)}, with each other ${pct(i.agreement)}`);
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

// Rehearsal bots leave with their answers; groups keep the people who are left.
export function removePeople(pids) {
  for (const pid of pids) {
    delete S.people[pid];
    for (const table of [S.survey, S.labels, S.codes, S.exit, ...Object.values(S.votes)]) delete table[pid];
    seen.delete(pid);
  }
  if (S.groups) {
    for (const g of S.groups) g.members = g.members.filter((m) => S.people[m]);
    S.groups = S.groups.some((g) => g.members.length) ? S.groups.filter((g) => g.members.length) : null;
  }
  changed();
}

export const version = () => ({ v: S.v, boot: S.boot });
