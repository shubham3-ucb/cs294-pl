// Editable text (server/text.js): an address leads to one string in the scripts; an edit replaces it everywhere and
// is saved; the original wording comes back when the edit is removed. Uses its own edits file, never the repo's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'text-edits-')), 'edits.json');
process.env.TEXT_EDITS = FILE;
const text = await import('../server/text.js');
const thu = await import('../server/thursday_scenes.js');
const tue = await import('../server/steps.js');

test('edit a Thursday scene, a task option and a Tuesday card; then undo', () => {
  text.load();
  const before = thu.SCENES.find((s) => s.id === 'tasks').title;
  const r = text.edit({ path: 'thu/SCENES/tasks/title', text: '  Seven Git tasks  ' });
  assert.equal(r.ok, true);
  assert.equal(thu.SCENES.find((s) => s.id === 'tasks').title, 'Seven Git tasks', 'trimmed, and live in the script');
  assert.ok(text.edit({ path: 'thu/TASKS/soft/options/1', text: '`git reset --hard HEAD~2`' }).ok);
  assert.equal(thu.TASKS.find((t) => t.id === 'soft').options[1], '`git reset --hard HEAD~2`');
  assert.ok(text.edit({ path: 'tue/CARDS/commit/is', text: 'A snapshot.' }).ok);
  assert.equal(tue.CARDS.commit.is, 'A snapshot.');
  assert.ok(text.edit({ path: 'thu/RQS/rq1/text', text: 'How many?' }).ok);
  assert.equal(thu.SCENES.find((s) => s.id === 'rqs').table[0][1], 'How many?', 'the slide table reads the edited question');
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  assert.deepEqual(Object.keys(saved).sort(), ['thu/RQS/rq1/text', 'thu/SCENES/tasks/title', 'thu/TASKS/soft/options/1', 'tue/CARDS/commit/is']);
  // Empty text, or the original wording, removes the edit.
  assert.ok(text.edit({ path: 'thu/SCENES/tasks/title', text: '' }).ok);
  assert.equal(thu.SCENES.find((s) => s.id === 'tasks').title, before);
  assert.equal('thu/SCENES/tasks/title' in JSON.parse(fs.readFileSync(FILE, 'utf8')), false);
});

test('only existing texts can be edited', () => {
  for (const p of ['thu/SCENES/nope/title', 'thu/SCENES/tasks/minutes', 'tue/STEPS/99/title', 'x/SCENES/join/title', 'thu/TASKS', '']) {
    assert.equal(text.edit({ path: p, text: 'x' }).ok, false, p);
  }
});

test('edits come back on a restart', () => {
  fs.writeFileSync(FILE, JSON.stringify({ 'thu/SCENES/exit/title': 'Take this home' }));
  text.load();
  assert.equal(thu.SCENES.find((s) => s.id === 'exit').title, 'Take this home');
});
