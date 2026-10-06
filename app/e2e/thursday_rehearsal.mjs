// Thursday rehearsal: 8 bots at 20× play the whole class; the teacher presses Next only when the console says
// everyone (or every group) is done. Checks that every activity filled in, then Stop removes the bots.
//   node e2e/thursday_rehearsal.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'thu-rehearsal-'));
const thu = await import('../server/thursday.js');
const bots = await import('../server/thursday_bots.js');
const { SCENES, POSTS, COMMENTS } = await import('../server/thursday_scenes.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () => thu.adminState('');
thu.boot();
thu.admin('reset');
assert.equal(bots.rehearse({ on: true, count: 8, speed: 20 }).ok, true);
const t0 = Date.now();
for (let i = 0; i < SCENES.length; i++) {
  const s = state();
  if (s.progress) {
    const start = Date.now();
    while (state().progress.done < state().progress.of) {
      assert.ok(Date.now() - start < 90_000, `scene ${s.scene.id} did not finish: ${JSON.stringify(state().progress)}`);
      await sleep(250);
    }
    console.log(`  ${s.scene.id.padEnd(14)} done ${state().progress.done}/${state().progress.of} ${state().progress.unit} in ${((Date.now() - start) / 1000).toFixed(1)} s`);
  }
  if (i < SCENES.length - 1) thu.admin('next');
}
const r = (id) => thu.results(id);
assert.equal(r('survey').n, 8);
for (const v of SCENES.filter((s) => s.kind === 'vote')) assert.equal(r(v.id).counts.reduce((a, b) => a + b), 8, `every bot voted in ${v.id}`);
assert.equal(r('labels').n, 8);
assert.ok(r('labels').posts.every((p) => p.counts.reduce((a, b) => a + b) === 8), 'every post labelled by all 8');
assert.equal(r('codes').n, 8);
assert.ok(r('codes').withPaper > 0.3 && r('codes').withPaper < 1, 'some agree with the paper, not all');
assert.ok(r('claims').groups.length === 2 && r('claims').groups.every((g) => g.answers?.measured && g.answers?.supports));
assert.ok(r('design').groups.every((g) => ['change', 'rq', 'measure', 'data'].every((f) => g.answers?.[f])));
assert.equal(r('exit').lines.length, 8);
assert.equal(new Set(r('exit').lines).size, 8, 'every bot writes its own exit line');
const agree = `labels agreement ${Math.round(100 * r('labels').agreement)}% · codes with the paper ${Math.round(100 * r('codes').withPaper)}%`;
bots.rehearse({ on: false });
assert.equal(state().people.length, 0, 'Stop removes the bots');
assert.equal(bots.status(), null);
console.log(`Thursday rehearsal OK: 8 bots played all ${SCENES.length} scenes in ${((Date.now() - t0) / 1000).toFixed(0)} s at 20×; the teacher pressed only Next.`);
console.log(`  ${agree}`);
thu.flush();
process.exit(0);
