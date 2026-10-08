// The paper's integration path detection (public/integration.js): arrows only, a clock only for velocity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integration } from '../public/integration.js';

// S ← A ← M1 ← C ← P (main), where M1 merges side card B (made on A), and P is a `git pull` merge of the Wall's W.
//   B: made at 100, merged by M1 (committed at 400) · W: on the Wall's line, pulled into P (committed at 900).
const card = (id, parents, time, committerTime = time, message = id) => ({ id, parents, time, committerTime, message });
const graph = {
  refs: { 'refs/heads/main': 'P' },
  commits: [
    card('P', ['C', 'W'], 900, 900, "Merge remote-tracking branch 'wall/main'"),
    card('W', ['M1'], 700),
    card('C', ['M1'], 600, 650),
    card('M1', ['A', 'B'], 400, 400, "Merge branch 'sporty'"),
    card('B', ['A'], 100),
    card('A', ['S'], 50),
    card('S', [], 0),
    card('X', ['S'], 30), // not reachable from main
  ],
};

test('tiers: every card main reaches, edits and merges, forward and switch edges', () => {
  const r = integration(graph);
  assert.deepEqual(new Set(r.nodes), new Set(['S', 'A', 'B', 'M1', 'C', 'W', 'P']));
  assert.equal(r.kind('S'), 'root');
  assert.equal(r.kind('A'), 'edit');
  assert.equal(r.kind('M1'), 'merge');
  assert.deepEqual(r.spine, ['S', 'A', 'M1', 'C', 'P']);
  assert.equal(r.edge('M1', 'A'), 'forward');
  assert.equal(r.edge('M1', 'B'), 'switch');
  assert.equal(r.line('A'), 0);
  assert.notEqual(r.line('B'), 0);
  assert.notEqual(r.line('W'), r.line('B'));
});

test('each card joins main at the first spine card that reaches it, by the shortest path', () => {
  const r = integration(graph);
  assert.equal(r.joins('B'), 'M1');
  assert.deepEqual(r.path('B'), ['B', 'M1']);
  assert.equal(r.joins('A'), 'A');
  assert.deepEqual(r.path('A'), ['A']);
  assert.ok(r.integrates('M1', 'B'));
  assert.ok(!r.integrates('M1', 'A'));
  assert.equal(r.joins('X'), null);
  assert.deepEqual(r.path('X'), []);
});

test('velocity: author time of the card to committer time of the card where it joined', () => {
  const r = integration(graph);
  assert.deepEqual(r.velocity('B'), { made: 100, joined: 400, seconds: 300 });
  assert.deepEqual(r.velocity('C'), { made: 600, joined: 650, seconds: 50 }); // a direct edit: only its two times differ
});

test('a git pull merge is flagged: the rule follows the puller, so the Wall card seems to join there', () => {
  const r = integration(graph);
  assert.deepEqual(r.pulls, ['P']);
  assert.equal(r.joins('W'), 'P');
  assert.ok(!r.pulls.includes('M1'));
});

test('a squashed main (Start ← Clean) has no paths left to find', () => {
  const r = integration({ refs: { 'refs/heads/main': 'K' }, commits: [card('K', ['S'], 10), card('S', [], 0)] });
  assert.deepEqual(r.spine, ['S', 'K']);
  assert.ok(r.nodes.every((id) => r.joins(id) === id));
});

// The paper's Figure 3, branch A (head 8): every label as the figure draws it.
test("the paper's Figure 3: branch, forward/switch, integration/delay and visibility, edge by edge", () => {
  const P = { 1: [], 2: ['1'], 3: ['2'], 4: ['1', '3'], 5: ['2', '3'], 6: ['4', '5'], 7: ['5'], 8: ['6', '7'] };
  const fig = { refs: { 'refs/heads/main': '8' }, commits: Object.entries(P).map(([id, parents]) => card(id, parents, Number(id))) };
  const r = integration(fig);
  const edges = Object.entries(P).flatMap(([c, ps]) => ps.map((p) => [p, c]));
  const by = (fn, label) => edges.filter(([p, c]) => fn(c, p) === label).map(([p, c]) => `${p}→${c}`).sort();
  assert.deepEqual(['4', '5', '6', '8'].map(r.kind), ['merge', 'merge', 'merge', 'merge']);
  assert.deepEqual(['1', '2', '3', '7'].map(r.kind), ['root', 'edit', 'edit', 'edit']);
  assert.deepEqual(by(r.branch, 'merge'), ['3→4', '3→5', '5→6', '7→8'], 'Tier 2: merge edges');
  assert.deepEqual(by(r.edge, 'forward'), ['1→4', '2→5', '4→6', '5→7', '6→8'], 'Tier 3: forward edges');
  assert.deepEqual(by(r.edge, 'switch'), ['1→2', '2→3', '3→4', '3→5', '5→6', '7→8'], 'Tier 3: switch edges');
  assert.deepEqual(by((c, p) => (r.integrates(c, p) || (r.spine.includes(c) && r.edge(c, p) === 'forward') ? 'i' : 'd'), 'i'),
    ['1→4', '2→3', '3→4', '4→6', '5→6', '6→8', '7→8'], 'Tier 4: integration edges');
  assert.deepEqual(r.spine, ['1', '4', '6', '8']);
  assert.deepEqual(['2', '3', '5', '7'].map(r.joins), ['4', '4', '6', '8'], 'Tier 5: visibility');
  assert.deepEqual(r.path('2'), ['2', '3', '4']);
});
