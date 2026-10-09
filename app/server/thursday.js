// Thursday session: people, the scene, the Git tasks, survey answers, sorts, post labels, groupings (pairs,
// teams) and what each one wrote, the class's questions, the teacher's stars, exit lines. One JSON file
// (DATA_DIR/thursday.json); no Git here. Clients poll /api/thu/state; `v` changes on every write.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  SCENES, SURVEY, TASKS, SURE, POSTS, LABELS, CLAIMS, FIELDS, EXAMPLES, ITEMS, SIZES, WHO_LINE, PAPER, PAPER_SURVEY, BUFFER_MINUTES,
} from './thursday_scenes.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const FILE = path.join(DATA_DIR, 'thursday.json');
const FORMAT = 3;
const NAME_MAX = 24;
const TEXT_MAX = 300;
const QUESTION_MAX = 200;
const JOIN_MAX = 80;
const HERE_MS = 90_000; // polled within 90 s = here (hidden tabs poll slowly)
const RECENT_MS = 10 * 60_000; // seen within 10 min = in the room, for forming groups

let S;
let saveTimer = null;
const seen = new Map(); // pid -> last poll (not saved)

const fresh = () => ({
  format: FORMAT, boot: crypto.randomBytes(4).toString('hex'), v: 0, scene: 0, sceneAt: Date.now(),
  people: {}, tasks: {}, survey: {}, labels: {}, sorts: {}, groupings: {}, writes: {}, questions: [], stars: {}, exit: {},
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
const nameOf = (pid) => S.people[pid]?.name ?? '?';

// An activity stays open until the scene after it is over, so a slow student can finish (the survey until its
// reveal is over, since the data slide sits between them).
const OPEN_UNTIL = { survey: 'survey-reveal' };
function isOpen(s) {
  const i = indexOf(s.id);
  if (S.scene === i) return true;
  const until = OPEN_UNTIL[s.kind] ? indexOf(OPEN_UNTIL[s.kind]) : i + 1;
  return ['tasks', 'survey', 'sort', 'label', 'write'].includes(s.kind) && S.scene > i && S.scene <= until;
}

// ---------- Groupings: pairs, teams and larger groups, each formed the first time a scene needs it ----------

const groupName = { pair: 'Pair', team: 'Team' };

function formGrouping(who) {
  const recent = within(RECENT_MS);
  const pids = recent.length ? recent : Object.keys(S.people);
  for (let i = pids.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pids[i], pids[j]] = [pids[j], pids[i]];
  }
  // As many groups as fit the size; an odd one out joins a group rather than working alone.
  const k = Math.max(1, Math.floor(pids.length / SIZES[who]));
  const groups = Array.from({ length: k }, (_, i) => ({ id: `${who}${i + 1}`, name: `${groupName[who]} ${i + 1}`, members: [], assign: i }));
  pids.forEach((pid, i) => groups[i % k].members.push(pid));
  S.groupings[who] = groups;
}

// A late joiner (or someone away when a grouping formed) joins the smallest group; above the size plus half, a new one.
function joinGrouping(who, pid) {
  const groups = S.groupings[who];
  let target = groups.reduce((a, b) => (b.members.length < a.members.length ? b : a));
  if (target.members.length >= SIZES[who] + Math.ceil(SIZES[who] / 2)) {
    const i = groups.length;
    target = { id: `${who}${i + 1}`, name: `${groupName[who]} ${i + 1}`, members: [], assign: i };
    groups.push(target);
  }
  target.members.push(pid);
}

const groupOf = (who, pid) => S.groupings[who]?.find((g) => g.members.includes(pid)) ?? null;
// Who owns an answer in a write scene: the person, or their group.
const ownerOf = (s, pid) => (s.who === 'solo' ? pid : groupOf(s.who, pid)?.id ?? null);
const claimOf = (g) => CLAIMS[g.assign % CLAIMS.length];

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
  S.people[id] = { name: n, joined: Date.now() };
  seen.set(id, Date.now());
  for (const who of Object.keys(S.groupings)) joinGrouping(who, id);
  changed();
  return ok({ pid: id, name: n });
}

const sortItems = (s) => ITEMS[s.items];
// The research-question slide's table comes from RQS: its cells are edited there.
const RQS_PATHS = () => ITEMS.rqs.items.map((q) => [null, `thu/RQS/${q.id}/text`]);
const done = (s, pid) => {
  if (s.kind === 'tasks') return TASKS.every((t) => S.tasks[pid]?.[t.id]?.pick !== undefined && S.tasks[pid]?.[t.id]?.sure !== undefined);
  if (s.kind === 'survey') return !!S.survey[pid];
  if (s.kind === 'sort') return Object.keys(S.sorts[s.id]?.[pid] ?? {}).length === sortItems(s).items.length;
  if (s.kind === 'label') return Object.keys(S.labels[pid] ?? {}).length === POSTS.length;
  if (s.kind === 'exit') return !!S.exit[pid];
  return true;
};

// An earlier activity this student has not finished, while it is still open.
function pending(pid) {
  for (let i = S.scene - 1; i >= 0; i--) {
    const s = SCENES[i];
    if (['tasks', 'survey', 'sort', 'label'].includes(s.kind) && isOpen(s) && !done(s, pid)) return publicScene(s);
  }
  return null;
}

// The group this person is in for a scene, with what it wrote so far.
function myGroup(s, pid) {
  if (!s || s.kind !== 'write' || s.who === 'solo') return null;
  const g = groupOf(s.who, pid);
  if (!g) return null;
  return {
    name: g.name, members: g.members.map(nameOf),
    claim: s.assign === 'claim' ? (({ id, quote, facts }) => ({ id, quote, facts }))(claimOf(g)) : null, // no model answer
  };
}

export function state(pid) {
  const me = S.people[pid];
  if (!me) return ok({ boot: S.boot, v: S.v, joined: false, scene: publicScene(scene()), index: S.scene, total: SCENES.length, paper: PAPER });
  seen.set(pid, Date.now());
  let moved = false;
  for (const who of Object.keys(S.groupings)) {
    if (!groupOf(who, pid)) { joinGrouping(who, pid); moved = true; }
  }
  if (moved) changed();
  const s = scene();
  const work = pending(pid) ? null : s;
  const owner = work?.kind === 'write' ? ownerOf(work, pid) : null;
  return ok({
    boot: S.boot, v: S.v, joined: true, index: S.scene, total: SCENES.length, scene: publicScene(s), paper: PAPER,
    pending: pending(pid),
    claims: s.shows === 'claims' ? CLAIMS : undefined, // model answers only once the verdicts are on
    me: {
      name: me.name,
      survey: S.survey[pid] ?? null,
      tasks: S.tasks[pid] ?? {},
      labels: S.labels[pid] ?? {},
      sorts: Object.fromEntries(Object.entries(S.sorts).map(([id, all]) => [id, all[pid] ?? {}])),
      exit: S.exit[pid] ?? '',
      questions: S.questions.filter((q) => q.pid === pid).map((q) => q.text),
    },
    group: work ? myGroup(work, pid) : null,
    answers: owner ? S.writes[work.id]?.[owner] ?? null : null,
    results: ['reveal', 'discuss', 'end'].includes(s.kind) ? results(s, { forProjector: true }) : null,
  });
}

// What every client may see of a scene (teacher notes and answer keys stay on the console).
function publicScene(s) {
  const { say, hope, ...rest } = s;
  if (s.kind === 'survey') rest.survey = SURVEY;
  if (s.kind === 'tasks') {
    rest.tasks = TASKS.map(({ key, ...t }) => t);
    rest.sure = SURE;
  }
  if (s.kind === 'label') {
    rest.posts = POSTS.map(({ askerNamesIt, ...p }) => p);
    rest.labels = LABELS;
  }
  if (s.kind === 'sort') {
    const { items, categories, root, catRoot } = sortItems(s);
    rest.items = items.map(({ key, ...x }) => ({ ...x, path: `thu/${root}/${x.id}/text` }));
    rest.categories = categories;
    rest.catRoot = catRoot;
  }
  if (s.id === 'rqs') rest.tablePaths = RQS_PATHS();
  if (s.kind === 'write') {
    rest.fields = FIELDS[s.fields];
    rest.fieldsKey = s.fields; // for the edit addresses: thu/FIELDS/<fieldsKey>/… and thu/EXAMPLES/<exampleKey>/…
    rest.example = s.example ? EXAMPLES[s.example] : null;
    rest.exampleKey = s.example ?? null;
    rest.whoLine = WHO_LINE[s.who];
  }
  return rest;
}

// "Other (please specify)": the form's text box beside that option, kept only when the option is picked.
const OTHER = 'Other (please specify)';
const otherOf = (q, picked, input) => (picked.some((i) => q.options[i] === OTHER) ? clean(input[`${q.id}Other`], TEXT_MAX) : '');

function validSurvey(input, questions = SURVEY) {
  const out = {};
  for (const q of questions) {
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

// A question for the class, at any time after joining.
export function ask({ pid, text }) {
  if (!S.people[pid]) return fail('Please join again.');
  const t = clean(text, QUESTION_MAX);
  if (!t) return fail('Type your question.');
  S.questions.push({ id: crypto.randomBytes(4).toString('hex'), pid, text: t, t: Date.now() });
  changed();
  return ok();
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
  } else if (s.kind === 'tasks') {
    const t = TASKS.find((x) => x.id === String(item));
    const i = Number(value);
    const max = field === 'sure' ? SURE.length : t?.options.length;
    if (!t || !['pick', 'sure'].includes(field) || !Number.isInteger(i) || i < 0 || i >= max) return fail('Pick one.');
    ((S.tasks[pid] ??= {})[t.id] ??= {})[field] = i;
  } else if (s.kind === 'sort') {
    const { items, categories } = sortItems(s);
    const x = items.find((i) => i.id === String(item));
    const c = Number(value);
    if (!x || !Number.isInteger(c) || c < 0 || c >= categories.length) return fail('Pick one.');
    ((S.sorts[s.id] ??= {})[pid] ??= {})[x.id] = c;
  } else if (s.kind === 'label') {
    const p = POSTS.find((x) => x.id === String(post));
    if (!p || !LABELS.some((l) => l.id === value)) return fail('Pick one label.');
    (S.labels[pid] ??= {})[p.id] = value;
  } else if (s.kind === 'write') {
    const owner = ownerOf(s, pid);
    if (!owner) return fail('Wait a moment: your group is being formed.');
    const f = FIELDS[s.fields].find((x) => x.id === field);
    if (!f) return fail('No such field.');
    const entry = ((S.writes[s.id] ??= {})[owner] ??= {});
    entry[f.id] = clean(text, TEXT_MAX);
    entry.by = nameOf(pid);
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

// ---------- Results (reveals, discussion, projector, console) ----------

const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
// Agreement on one item: the share of answers that match the most common answer.
const majorityShare = (counts) => {
  const n = counts.reduce((a, b) => a + b, 0);
  return n ? Math.max(...counts) / n : null;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// The entries of a write scene (or the class's questions): one per person or group, with stars.
// The projector shows no names; the console does.
function entries(fromId, { forProjector }) {
  if (fromId === 'questions') {
    const list = S.questions.map((q) => ({ key: `q:${q.id}`, who: nameOf(q.pid), answers: { text: q.text }, t: q.t }));
    return { fields: [{ id: 'text', short: 'Question' }], list };
  }
  const s = sceneById(fromId);
  const fields = FIELDS[s.fields];
  const byOwner = S.writes[fromId] ?? {};
  const owners = s.who === 'solo' ? Object.keys(byOwner) : (S.groupings[s.who] ?? []).map((g) => g.id);
  const list = owners.map((owner) => {
    const g = s.who === 'solo' ? null : S.groupings[s.who].find((x) => x.id === owner);
    return {
      key: `${fromId}:${owner}`,
      who: g ? `${g.name} · ${g.members.map(nameOf).join(', ')}` : nameOf(owner),
      group: g?.name ?? null,
      answers: byOwner[owner] ?? null,
      claim: s.assign === 'claim' && g ? claimOf(g) : null,
      t: byOwner[owner]?.t ?? 0,
    };
  });
  return { fields, list, who: s.who };
}

export function results(s, { forProjector = false } = {}) {
  const what = s.kind === 'discuss' ? `write:${s.from}` : s.shows;
  if (!what) return null;
  if (what.startsWith('write:')) {
    const from = what.slice(6);
    const { fields, list, who } = entries(from, { forProjector });
    const filled = list.filter((e) => e.answers && fields.some((f) => e.answers[f.id]));
    const starred = filled.filter((e) => S.stars[e.key]);
    const strip = (e) => (forProjector ? { key: e.key, group: e.group, answers: e.answers, claim: e.claim, starred: !!S.stars[e.key] } : { ...e, starred: !!S.stars[e.key] });
    return { type: 'entries', from, who, fields, all: filled.map(strip), starred: starred.map(strip), total: list.length };
  }
  if (what === 'tasks') {
    const all = Object.values(S.tasks);
    const rows = TASKS.map((t) => {
      const picks = all.map((a) => a[t.id]).filter((a) => a?.pick !== undefined);
      const right = (xs) => xs.filter((a) => a.pick === t.key).length;
      const bySure = SURE.map((_, k) => { const xs = picks.filter((a) => a.sure === k); return { n: xs.length, right: right(xs) }; });
      return { id: t.id, short: t.short, key: t.key, answer: t.options[t.key], n: picks.length, right: right(picks), bySure };
    });
    const sum = (k) => SURE.map((_, i) => rows.reduce((n, r) => n + r.bySure[i][k], 0));
    return { type: 'tasks', rows, sure: SURE, n: all.length, sureN: sum('n'), sureRight: sum('right') };
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
  if (what.startsWith('sort:')) {
    const src = sceneById(what.slice(5));
    const { items, categories } = sortItems(src);
    const all = Object.values(S.sorts[src.id] ?? {});
    const rows = items.map((x) => {
      const counts = categories.map((_, c) => all.filter((a) => a[x.id] === c).length);
      return { id: x.id, label: x.label ?? null, text: x.text, path: `thu/${sortItems(src).root}/${x.id}/text`, key: x.key, counts, agreement: majorityShare(counts) };
    });
    return {
      type: 'sort', categories, rows,
      n: all.filter((a) => Object.keys(a).length === items.length).length,
      right: mean(rows.map((r) => { const n = r.counts.reduce((a, b) => a + b, 0); return n ? r.counts[r.key] / n : null; }).filter((x) => x !== null)),
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
  if (what === 'claims') {
    const { list, fields } = entries('claims', { forProjector });
    return { type: 'claims', fields, teams: list.map((e) => ({ group: e.group, claim: e.claim, answers: e.answers })) };
  }
  if (what === 'exit') return { type: 'exit', lines: Object.values(S.exit) };
  return null;
}

// How many of the people here (or of the groups) have answered the current scene.
function progress(s) {
  if (s.kind === 'write') {
    const fields = FIELDS[s.fields];
    if (s.who === 'solo') {
      const people = here();
      return { done: people.filter((pid) => fields.every((f) => S.writes[s.id]?.[pid]?.[f.id])).length, of: people.length, unit: 'people' };
    }
    const groups = S.groupings[s.who] ?? [];
    const full = groups.filter((g) => fields.every((f) => S.writes[s.id]?.[g.id]?.[f.id])).length;
    return { done: full, of: groups.length, unit: 'groups' };
  }
  if (!['tasks', 'survey', 'sort', 'label', 'exit'].includes(s.kind)) return null;
  const people = here();
  return { done: people.filter((pid) => done(s, pid)).length, of: people.length, unit: 'people' };
}

// ---------- Teacher ----------

export function adminState(joinUrl) {
  const s = scene();
  const live = s.kind === 'write' ? results({ kind: 'discuss', from: s.id }) : null; // what is coming in
  return ok({
    boot: S.boot, v: S.v, index: S.scene, total: SCENES.length, scene: s, joinUrl, paper: PAPER, claims: CLAIMS,
    elapsed: Date.now() - (S.sceneAt ?? Date.now()), buffer: BUFFER_MINUTES,
    next: SCENES[S.scene + 1] ? { title: SCENES[S.scene + 1].title } : null,
    people: Object.entries(S.people).map(([pid, p]) => ({ name: p.name, here: isHere(pid) })),
    hereCount: here().length,
    groupings: Object.fromEntries(Object.entries(S.groupings).map(([who, gs]) => [who, gs.map((g) => ({ name: g.name, members: g.members.map(nameOf) }))])),
    who: s.kind === 'write' && SIZES[s.who] ? s.who : null,
    progress: progress(s),
    results: ['reveal', 'discuss', 'end'].includes(s.kind) ? results(s) : live,
    // The projector's view of this scene: no names.
    projector: ['reveal', 'discuss', 'end'].includes(s.kind) ? results(s, { forProjector: true }) : null,
    questions: S.questions.map((q) => ({ key: `q:${q.id}`, who: nameOf(q.pid), text: q.text, t: q.t, starred: !!S.stars[`q:${q.id}`] })),
  });
}

export function admin(action, { from, key, who } = {}) {
  if (action === 'reset') {
    S = fresh();
    seen.clear();
    flush();
    return ok({ message: 'New session. Everyone joins again.' });
  }
  if (action === 'star') {
    if (!key || typeof key !== 'string') return fail('Nothing to star.');
    if (S.stars[key]) delete S.stars[key];
    else S.stars[key] = true;
    changed();
    return ok({ starred: !!S.stars[key] });
  }
  if (action === 'regroup') {
    const size = who ?? scene().who;
    if (!SIZES[size]) return fail('This scene has no groups.');
    if (!Object.keys(S.people).length) return fail('Nobody has joined.');
    formGrouping(size);
    for (const s of SCENES.filter((x) => x.kind === 'write' && x.who === size)) delete S.writes[s.id];
    changed();
    return ok({ message: `${S.groupings[size].length} new ${groupName[size].toLowerCase()}s from the people in the room.` });
  }
  if (from !== undefined && from !== null && from !== '' && Number(from) !== S.scene) return ok({ unchanged: true });
  if (action === 'next' && S.scene < SCENES.length - 1) {
    S.scene += 1;
    const s = scene();
    if (s.kind === 'write' && SIZES[s.who] && !S.groupings[s.who] && Object.keys(S.people).length) formGrouping(s.who);
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
  const pct = (x) => (x === null ? '—' : `${Math.round(100 * x)}%`);
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const out = ['# Thursday · Reading a user study · answers', '', `Exported ${stamp} UTC · ${Object.keys(S.people).length} people`, ''];
  for (const s of SCENES) {
    if (s.kind === 'write') {
      const r = results({ kind: 'discuss', from: s.id });
      out.push(`## ${s.title}`, '');
      for (const e of r.all) {
        out.push(`- **${e.who}**${e.starred ? ' ★' : ''}${e.claim ? ` (claim: “${e.claim.quote}”)` : ''}`);
        for (const f of r.fields) out.push(`  - ${f.short}: ${e.answers?.[f.id] || '—'}`);
      }
      out.push('');
    } else if (s.kind === 'sort') {
      const r = results({ shows: `sort:${s.id}` });
      out.push(`## ${s.title}`, '', `Answers matching the key: ${pct(r.right)}`, '');
      for (const row of r.rows) out.push(`- ${row.label ? `${row.label}: ` : ''}${row.text}: ${r.categories.map((c, i) => `${c} ${row.counts[i]}`).join(', ')} (key: ${r.categories[row.key]})`);
      out.push('');
    }
  }
  const tk = results({ shows: 'tasks' });
  out.push('## Seven Git tasks', '', `${tk.n} people.`, '');
  for (const r of tk.rows) out.push(`- ${r.short}: ${r.right} of ${r.n} right (answer: ${r.answer})`);
  out.push('', `Right, by how sure people were: ${tk.sure.map((x, i) => `${x} ${tk.sureRight[i]}/${tk.sureN[i]}`).join(', ')}`, '');
  const sv = results({ shows: 'survey' });
  out.push('## Survey (the paper’s questions)', '', `${sv.n} answered. Median years using Git: ${sv.medianYears ?? '—'} (paper: 8).`, '');
  sv.levels.forEach((l, i) => out.push(`- ${l}: ${sv.level[i]} (paper: ${PAPER_SURVEY.level[i]} of 92)`));
  sv.approaches.forEach((l, i) => out.push(`- ${l}: ${sv.learn[i]} (paper: ${PAPER_SURVEY.learn[i]} of 92)`));
  const lb = results({ shows: 'labels' });
  out.push('', '## Posts: what is each post about?', '', `Agreement (share matching the most common label, averaged): ${pct(lb.agreement)}`, '');
  for (const p of lb.posts) {
    out.push(`- ${p.title} (\`${p.command}\`, asker names it: ${p.askerNamesIt ? 'yes' : 'no'}): ${LABELS.map((l, i) => `${l.label} ${p.counts[i]}`).join(', ')}`);
  }
  out.push('', '## Questions from the class', '', ...S.questions.map((q) => `- ${nameOf(q.pid)}${S.stars[`q:${q.id}`] ? ' ★' : ''}: ${q.text}`));
  out.push('', '## Exit: when you build a tool for people, …', '', ...Object.entries(S.exit).map(([pid, t]) => `- ${nameOf(pid)}: ${t}`), '');
  return out.join('\n');
}

// Rehearsal bots leave with their answers; groups keep the people who are left.
export function removePeople(pids) {
  for (const pid of pids) {
    delete S.people[pid];
    for (const table of [S.tasks, S.survey, S.labels, S.exit, ...Object.values(S.sorts), ...Object.values(S.writes)]) delete table[pid];
    S.questions = S.questions.filter((q) => q.pid !== pid);
    seen.delete(pid);
  }
  for (const [who, groups] of Object.entries(S.groupings)) {
    for (const g of groups) g.members = g.members.filter((m) => S.people[m]);
    const left = groups.filter((g) => g.members.length);
    if (left.length) S.groupings[who] = left;
    else delete S.groupings[who];
  }
  changed();
}

export const version = () => ({ v: S.v, boot: S.boot });
// Text was edited: every page refetches.
export const touch = () => changed();
