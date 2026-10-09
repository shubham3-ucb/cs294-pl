// Editable text: your own wording for any slide text, kept in text_edits.json (in the repo, so it can be committed).
// Every text has an address: day/ROOT/key/key/…, e.g. "thu/SCENES/tasks/about", "thu/TASKS/soft/options/2",
// "tue/CARDS/commit/how", "tue/STEPS/1/instruction". In an array, an element with an `id` is addressed by its id,
// any other by its index. An edit replaces the string in place in the exported objects, so every page (students,
// console, projector) shows it at once; removing an edit puts the original back.
import fs from 'node:fs';
import * as tue from './steps.js';
import * as thu from './thursday_scenes.js';

// TEXT_EDITS points elsewhere (tests); the default lives next to this file, in the repo.
const FILE = process.env.TEXT_EDITS || new URL('./text_edits.json', import.meta.url);
const TEXT_MAX = 2000;

const ROOTS = {
  tue: { SCENES: tue.SCENES, STEPS: tue.STEPS, CARDS: tue.CARDS, PAPER: tue.PAPER, PATHS: tue.PATHS },
  thu: {
    SCENES: thu.SCENES, TASKS: thu.TASKS, SURE: thu.SURE, RQS: thu.RQS, RQ_KINDS: thu.RQ_KINDS, MEASURES: thu.MEASURES,
    RUNGS: thu.RUNGS, CLAIMS: thu.CLAIMS, FIELDS: thu.FIELDS, EXAMPLES: thu.EXAMPLES, LABELS: thu.LABELS, SURVEY: thu.SURVEY,
    WHO_LINE: thu.WHO_LINE,
  },
};

let edits = {};
const originals = new Map(); // address -> the built-in text

// The object holding the text, and its key there; null when the address does not lead to a string.
function locate(address) {
  const [day, root, ...keys] = String(address).split('/');
  let at = ROOTS[day]?.[root];
  if (!at || !keys.length) return null;
  for (let i = 0; i < keys.length - 1; i++) {
    at = step(at, keys[i]);
    if (!at || typeof at !== 'object') return null;
  }
  const last = keys.at(-1);
  if (Array.isArray(at)) {
    const i = Number(last);
    return Number.isInteger(i) && typeof at[i] === 'string' ? { obj: at, key: i } : null;
  }
  return typeof at[last] === 'string' ? { obj: at, key: last } : null;
}

function step(at, key) {
  if (Array.isArray(at)) {
    const byId = at.find((x) => x && typeof x === 'object' && x.id === key);
    if (byId) return byId;
    const i = Number(key);
    return Number.isInteger(i) ? at[i] : undefined;
  }
  return at[key];
}

function set(address, text) {
  const spot = locate(address);
  if (!spot) return false;
  if (!originals.has(address)) originals.set(address, spot.obj[spot.key]);
  spot.obj[spot.key] = text ?? originals.get(address);
  return true;
}

export function load() {
  try {
    edits = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    edits = {};
  }
  for (const [address, text] of Object.entries(edits)) set(address, text);
}

function save() {
  const sorted = Object.fromEntries(Object.entries(edits).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(FILE, `${JSON.stringify(sorted, null, 2)}\n`);
}

// Change one text. An empty text, or the original one, removes the edit.
export function edit({ path: address, text }) {
  const spot = locate(address);
  if (!spot) return { ok: false, error: 'That text cannot be edited.' };
  const t = String(text ?? '').replace(/\r\n/g, '\n').trim().slice(0, TEXT_MAX);
  const original = originals.get(address) ?? spot.obj[spot.key];
  if (!t || t === original) {
    delete edits[address];
    set(address, null);
  } else {
    edits[address] = t;
    set(address, t);
  }
  save();
  return { ok: true, result: { path: address, text: spot.obj[spot.key], edited: address in edits } };
}

export const list = () => ({ ok: true, result: { edits, originals: Object.fromEntries([...originals].filter(([a]) => a in edits)) } });
