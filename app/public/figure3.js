// "Find the path back": the paper's Figure 3 (Just et al., ISSRE 2016, §6.2), interactive.
// The paper's own example, branch A with eight commits, drawn as the figure draws it: arrows go forward in time
// (parent → child), white circles are edits, grey ones merges, and each tier adds its own edge labels in the
// figure's colours. The labels come from running the algorithm (public/integration.js) on this graph, never from
// a table, so the drawing and the algorithm cannot disagree.
//   events(tier) → the tier's labelling, one event at a time, in the order the algorithm makes it: {edge | node, label, say}
//   renderFigure(svg, {tier, upto, pick, mini}) draws tier 0..5 with the first `upto` events (Infinity: all of them).
//   pickLines(id) → words about one commit: what it is, its line, where it joins branch A and by which path.
import { integration } from './integration.js';

// Figure 3's graph: each commit's parents, first parent first, and where the figure puts it (column, row).
const PARENTS = { 1: [], 2: ['1'], 3: ['2'], 4: ['1', '3'], 5: ['2', '3'], 6: ['4', '5'], 7: ['5'], 8: ['6', '7'] };
const AT = { 1: [0, 0], 4: [3.4, 0], 6: [5, 0], 8: [8, 0], 2: [1, 1], 5: [4, 1], 7: [7, 1], 3: [2, 2] };
// Tier 0's references: branch A ends at 8; a second branch, B, ends at 7.
export const REFS = { A: '8', B: '7' };
export const IDS = Object.keys(PARENTS);

const graph = { refs: { 'refs/heads/main': REFS.A }, commits: IDS.map((id) => ({ id, parents: PARENTS[id], time: Number(id) })) };
export const ALGO = integration(graph);
const EDGES = IDS.flatMap((c) => PARENTS[c].map((p) => ({ p, c, key: `${p}>${c}` }))); // parent → child, as drawn

// The figure's colours.
export const COLOR = {
  grey: '#9AA0A6', ink: '#1F2328', edit: '#FFFFFF', merge: '#6E777D', A: '#8B3DFF', B: '#0EA5E9',
  branch: '#F28C28', mergeEdge: '#5B2A86', forward: '#2E9BD6', switch: '#F0628F', integration: '#7DBA2F', delay: '#B05CC6', visibility: '#D7262E',
};
export const LEGEND = [
  [],
  [],
  [['merge', COLOR.mergeEdge, false], ['branch', COLOR.branch, true]],
  [['forward', COLOR.forward, false], ['switch', COLOR.switch, true]],
  [['integration', COLOR.integration, false], ['delay', COLOR.delay, true]],
  [['visibility', COLOR.visibility, false]],
];

const reach = (head) => {
  const out = new Set();
  const todo = [head];
  while (todo.length) { const id = todo.pop(); if (!out.has(id)) { out.add(id); todo.push(...PARENTS[id]); } }
  return out;
};
const ON = { A: reach(REFS.A), B: reach(REFS.B) };
const spine = ALGO.spine;
const onSpine = new Set(spine);
// Tier 4's label for an edge: on the way to the earliest integration (or main's own forward line), or a delay.
const tier4 = (c, p) => (ALGO.integrates(c, p) || (onSpine.has(c) && ALGO.edge(c, p) === 'forward') ? 'integration' : 'delay');

// Each tier's labelling, as the algorithm makes it.
export function events(tier) {
  if (tier === 0) {
    return [
      { node: 'A', label: 'A', say: `Branch A ends at ${REFS.A}. Every commit it reaches: ${[...ON.A].sort().join(', ')}.` },
      { node: 'B', label: 'B', say: `Branch B ends at ${REFS.B}. It reaches ${[...ON.B].sort().join(', ')}: a commit can belong to several branches.` },
    ];
  }
  if (tier === 1) {
    return IDS.map((id) => ({ node: id, label: ALGO.kind(id) === 'merge' ? 'merge' : 'edit',
      say: `${id} has ${PARENTS[id].length || 'no'} parent${PARENTS[id].length === 1 ? '' : 's'}: ${ALGO.kind(id) === 'merge' ? 'a merge' : 'an edit'}.` }));
  }
  if (tier === 2) {
    return EDGES.map(({ p, c, key }) => ({ edge: key, label: ALGO.branch(c, p),
      say: ALGO.branch(c, p) === 'branch' ? `${p} → ${c}: ${p} is ${c}'s first parent, a branch edge.` : `${p} → ${c}: ${p} is merged into ${c}, a merge edge.` }));
  }
  if (tier === 3) {
    // Back from A's head along first parents (forward), then from the root forward: each line, then each switch.
    const back = [...spine].reverse().slice(0, -1).map((c, i) => ({ edge: `${spine[spine.length - 2 - i]}>${c}`, label: 'forward',
      say: `${spine[spine.length - 2 - i]} → ${c}: back from A's head along first parents. Forward.` }));
    const rest = EDGES.filter(({ p, c }) => !(onSpine.has(c) && onSpine.has(p) && ALGO.edge(c, p) === 'forward'))
      .sort((x, y) => Number(x.p) - Number(y.p) || Number(x.c) - Number(y.c))
      .map(({ p, c, key }) => ({ edge: key, label: ALGO.edge(c, p),
        say: ALGO.edge(c, p) === 'forward' ? `${p} → ${c}: continues ${p}'s own line. Forward.` : `${p} → ${c}: leaves ${p}'s line. A switch.` }));
    return [...back, ...rest];
  }
  if (tier === 4) {
    return [...EDGES].sort((x, y) => (spine.indexOf(ALGO.joins(x.c)) - spine.indexOf(ALGO.joins(y.c))) || Number(x.c) - Number(y.c))
      .map(({ p, c, key }) => ({ edge: key, label: tier4(c, p),
        say: tier4(c, p) === 'integration' ? `${p} → ${c}: on the shortest way to where ${p} first reaches A.` : `${p} → ${c}: a longer way to the same place. A delay.` }));
  }
  // Tier 5: walk A's line from the root; each commit maps everything it first makes visible.
  return spine.flatMap((s) => [s, ...IDS.filter((id) => id !== s && ALGO.joins(id) === s)].map((id) => ({ node: id, label: s,
    say: id === s ? `${s} is on A's own line: it is visible to A at once.` : `${id} first becomes visible to A at ${s}.` })));
}

const NS = 'http://www.w3.org/2000/svg';
const U = 74; // one column, in px
const PAD = 34;
const R = 15;
const xy = (id) => [PAD + AT[id][0] * U, PAD + AT[id][1] * U * 0.72];
export const SIZE = { w: PAD * 2 + 8 * U, h: PAD * 2 + 2 * U * 0.72 + 8 };

// Draw one tier. upto: how many of its events show (Infinity: all). pick: a commit whose path is marked (Tiers 4–5).
export function renderFigure(svg, { tier, upto = Infinity, pick = null, mini = false, onPick = null } = {}) {
  const shown = events(tier).slice(0, upto);
  const edgeLabel = new Map(shown.filter((e) => e.edge).map((e) => [e.edge, e.label]));
  const nodeLabel = new Map(shown.filter((e) => e.node).map((e) => [e.node, e.label]));
  const path = pick && tier >= 4 ? ALGO.path(pick) : [];
  const onPath = new Set(path.slice(1).map((c, i) => `${c}>${path[i]}`).map((k) => k.split('>').reverse().join('>')));
  const uid = svg.dataset.uid ?? (svg.dataset.uid = String(Math.random()).slice(2, 8));
  const marker = (name, color) => `<marker id="m-${name}-${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11"
    markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="${color}"/></marker>`;
  const style = (key, c, p) => {
    const label = tier === 0 || tier === 1 ? null : edgeLabel.get(key);
    const bold = onPath.has(key);
    if (tier === 5) return { color: COLOR.grey, dash: '2 5', width: 1.2, hide: true };
    if (!label) return { color: tier >= 2 ? '#D5D8DC' : COLOR.grey, width: 1.6, dash: null, name: 'grey' };
    const name = label === 'merge' ? 'mergeEdge' : label;
    const dashed = ['branch', 'switch', 'delay'].includes(label);
    return { color: COLOR[name], width: bold ? 4 : 2.2, dash: dashed && !bold ? '6 5' : null, name };
  };
  const line = ([x1, y1], [x2, y2], s, key) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
    return `<path data-edge="${key}" d="M${x1 + ux * R},${y1 + uy * R} L${x2 - ux * (R + 2)},${y2 - uy * (R + 2)}" stroke="${s.color}"
      stroke-width="${s.width}" fill="none"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''} marker-end="url(#m-${s.name ?? 'grey'}-${uid})"/>`;
  };
  const parts = [];
  // Tier 5: A's own line as a dotted guide, then each commit's visibility arrow to where it joins A.
  if (tier === 5) {
    parts.push(`<path d="M${xy(spine[0]).join(',')} L${xy(spine.at(-1)).join(',')}" stroke="${COLOR.grey}" stroke-width="1.5" stroke-dasharray="2 6" fill="none"/>`);
    for (const id of IDS) {
      if (!nodeLabel.has(id)) continue;
      const to = nodeLabel.get(id);
      const bold = pick === id;
      if (to === id) {
        const [x, y] = xy(id);
        parts.push(`<path d="M${x - 9},${y - R + 2} C${x - 22},${y - R - 26} ${x + 22},${y - R - 26} ${x + 9},${y - R + 1}" stroke="${COLOR.visibility}"
          stroke-width="${bold ? 3.5 : 2.2}" fill="none" marker-end="url(#m-visibility-${uid})"/>`);
      } else {
        parts.push(line(xy(id), xy(to), { color: COLOR.visibility, width: bold ? 4 : 2.2, name: 'visibility' }, `${id}~${to}`));
      }
    }
  } else {
    for (const { p, c, key } of [...EDGES].sort((a, b) => onPath.has(a.key) - onPath.has(b.key))) parts.push(line(xy(p), xy(c), style(key, c, p), key));
  }
  // Commits: Tier 0 shows which branches reach each one; from Tier 1 on, edit (white) or merge (grey).
  for (const id of IDS) {
    const [x, y] = xy(id);
    const merge = tier >= 1 && (tier > 1 || nodeLabel.has(id)) && ALGO.kind(id) === 'merge';
    const both = tier === 0 && nodeLabel.has('B') && ON.B.has(id);
    const inA = tier === 0 && nodeLabel.has('A') && ON.A.has(id);
    let fill = merge ? COLOR.merge : COLOR.edit;
    if (tier === 0) fill = inA ? COLOR.A : '#FFFFFF';
    const half = both ? `<path d="M${x},${y - R} A${R},${R} 0 0 1 ${x},${y + R} Z" fill="${COLOR.B}"/>` : '';
    const picked = pick === id;
    parts.push(`<g data-node="${id}" class="${onPick ? 'pickable' : ''}"${onPick ? ' tabindex="0" role="button"' : ''} aria-label="Commit ${id}">
      <circle cx="${x}" cy="${y}" r="${R}" fill="${fill}" stroke="${picked ? COLOR.ink : '#8A9095'}" stroke-width="${picked ? 3 : 1.5}"/>${half}
      ${mini ? '' : `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700"
        fill="${fill === COLOR.edit ? COLOR.ink : '#fff'}" font-family="Inter, system-ui, sans-serif">${id}</text>`}</g>`);
  }
  // The head arrow into the root, as in the figure.
  const [rx, ry] = xy(spine[0]);
  parts.unshift(`<path d="M${rx - 30},${ry} L${rx - R - 2},${ry}" stroke="${COLOR.grey}" stroke-width="1.6" marker-end="url(#m-grey-${uid})"/>
    <circle cx="${rx - 32}" cy="${ry}" r="3" fill="#fff" stroke="${COLOR.grey}"/>`);
  svg.setAttribute('viewBox', `0 0 ${SIZE.w} ${SIZE.h}`);
  svg.innerHTML = `<defs>${['grey', 'mergeEdge', 'branch', 'forward', 'switch', 'integration', 'delay', 'visibility']
    .map((n) => marker(n, n === 'grey' ? COLOR.grey : COLOR[n])).join('')}</defs>${parts.join('')}`;
  svg.onclick = (e) => { const g = e.target.closest?.('[data-node]'); if (g && onPick) onPick(g.dataset.node); };
  svg.onkeydown = (e) => { const g = e.target.closest?.('[data-node]'); if (g && onPick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(g.dataset.node); } };
}

// One commit, in words, for the panel under the figure.
export function pickLines(id) {
  if (!PARENTS[id]) return null;
  const kind = ALGO.kind(id) === 'merge' ? 'a merge' : ALGO.kind(id) === 'root' ? 'the root' : 'an edit';
  const line = ALGO.line(id);
  const joins = ALGO.joins(id);
  const path = ALGO.path(id);
  return {
    what: `Commit ${id}: ${kind}, with ${PARENTS[id].length ? `parent${PARENTS[id].length > 1 ? 's' : ''} ${PARENTS[id].join(' and ')}` : 'no parent'}.`,
    line: line === 0 ? "Tier 3: on branch A's own line." : `Tier 3: on side line ${String.fromCharCode(65 + line)}, a switch away from A.`,
    joins: joins === id ? 'Tier 5: visible to A at once (it is on A\'s line).' : `Tier 5: first visible to branch A at ${joins}.`,
    path: joins === id ? null : `Tier 4: integration path ${path.join(' → ')}. Code velocity = time(${joins}) − time(${id}).`,
  };
}
