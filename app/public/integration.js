// The paper's integration path detection (Just et al., ISSRE 2016, §6.2), on one branch of one graph.
// It reads only the arrows (parent links), never a clock; a clock comes in at the very end, for code velocity.
// The server (the scene's data, tests) and the pages (the tier viewer) share it.
//
//   integration(graph, branch = 'main') → {
//     nodes: [id] every card the branch reaches (Tier 0), oldest first
//     kind(id): 'root' | 'edit' | 'merge' (Tier 1)
//     spine: [id] the branch's own line: first parents from its tip, root first (Tiers 2–3)
//     line(id): 0 on the spine; 1, 2, … for each line a switch edge leads to (recovered branch association)
//     branch(child, parent): 'branch' (child's first parent) | 'merge' (another parent) (Tier 2)
//     edge(child, parent): 'forward' (the edge continues parent's line) | 'switch' (it leaves it) (Tier 3)
//     joins(id): the spine card where id first became visible to the branch: its earliest integration (Tiers 4–5)
//     path(id): [id, …, joins(id)], each card the parent of the next: the shortest integration path
//     integrates(child, parent): the edge is on some card's integration path (else a delay edge) (Tier 4)
//     velocity(id): {made, joined, seconds}: author time of id → committer time of joins(id)
//     pulls: [id] spine merges written by `git pull` (Git's message says so): their first parent is the puller's
//       own card, so the rule above follows the puller's line, not the branch's (the paper's rule as written)
//   }
// graph: {refs: {'refs/heads/main': id}, commits: [{id, parents, time, committerTime, message}]}

// `git pull` writes "Merge remote-tracking branch 'wall/main'" (or "Merge branch 'main' of <url>").
const isPull = (message) => /^Merge (remote-tracking branch '[^']+'|branch '[^']+' of )/.test(message ?? '');

export function integration(graph, branch = 'main') {
  const byId = new Map((graph?.commits ?? []).map((c) => [c.id, c]));
  const tip = graph?.refs?.[`refs/heads/${branch}`];
  const parents = (id) => (byId.get(id)?.parents ?? []).filter((p) => byId.has(p));

  // Tier 0: every card the branch can reach.
  const seen = new Set();
  const todo = tip && byId.has(tip) ? [tip] : [];
  while (todo.length) {
    const id = todo.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    todo.push(...parents(id));
  }

  // Tiers 2–3: walk back from the tip through first parents: those edges are forward, every other edge a switch.
  const spine = [];
  for (let id = tip; id && byId.has(id) && !spine.includes(id); id = parents(id)[0]) spine.push(id);
  spine.reverse();

  // Tier 3 (navigation): an edge is forward when it continues its parent's line, else a switch. main's line is the
  // spine. Any other card continues on one child that has it as first parent: the one with the longest such chain
  // ahead (so 2 → 5 → 7 in the paper's Figure 3, and 3 starts no line). Lines are numbered from the root forward.
  const firstKids = new Map();
  for (const id of seen) {
    const p = parents(id)[0];
    if (p) firstKids.set(p, [...(firstKids.get(p) ?? []), id]);
  }
  const reach = new Map(); // id → length of the longest first-parent chain ahead of it
  const chain = (id) => {
    if (!reach.has(id)) reach.set(id, 1 + Math.max(0, ...(firstKids.get(id) ?? []).map(chain)));
    return reach.get(id);
  };
  const onSpine = new Set(spine);
  const continuer = new Map();
  for (const id of seen) {
    const kids = firstKids.get(id) ?? [];
    const next = onSpine.has(id) ? kids.find((k) => onSpine.has(k))
      : kids.reduce((best, k) => (!best || chain(k) > chain(best) ? k : best), null);
    if (next) continuer.set(id, next);
  }
  const lines = new Map(spine.map((id) => [id, 0]));
  let next = 1;
  const queue = [...spine];
  while (queue.length) {
    const id = queue.shift();
    const kids = [...seen].filter((k) => parents(k).includes(id) && continuer.get(id) !== k && !lines.has(k));
    for (const k of kids) {
      const line = next++;
      for (let at = k; at && !lines.has(at); at = continuer.get(at)) { lines.set(at, line); queue.push(at); }
    }
  }

  // Tiers 4–5: slice the spine at each card, root first. A spine card maps itself, and every card it newly
  // makes reachable, found breadth first, so each card's route back to its spine card is the shortest one.
  const joins = new Map();
  const via = new Map(); // card → the next card on its integration path
  for (const s of spine) {
    joins.set(s, s);
    const wave = [s];
    while (wave.length) {
      const at = wave.shift();
      for (const p of parents(at)) {
        if (joins.has(p)) continue;
        joins.set(p, s);
        via.set(p, at);
        wave.push(p);
      }
    }
  }
  const on = new Set([...via].map(([p, child]) => `${child}>${p}`));

  const path = (id) => {
    const out = [];
    for (let at = id; at && !out.includes(at); at = via.get(at)) out.push(at);
    return joins.has(id) ? out : [];
  };
  const velocity = (id) => {
    const c = byId.get(id);
    const j = byId.get(joins.get(id));
    if (!c || !j) return null;
    const joined = j.committerTime ?? j.time;
    return { made: c.time, joined, seconds: joined - c.time };
  };

  const order = new Map(spine.map((id, i) => [id, i]));
  const nodes = [...seen].sort((a, b) => (order.get(joins.get(a)) - order.get(joins.get(b))) || (byId.get(a).time - byId.get(b).time));
  return {
    nodes,
    kind: (id) => (parents(id).length > 1 ? 'merge' : parents(id).length ? 'edit' : 'root'),
    spine,
    line: (id) => lines.get(id) ?? null,
    edge: (child, parent) => (continuer.get(parent) === child ? 'forward' : 'switch'),
    branch: (child, parent) => (parents(child)[0] === parent ? 'branch' : 'merge'), // Tier 2: a first parent, or a merged one
    joins: (id) => joins.get(id) ?? null,
    path,
    integrates: (child, parent) => on.has(`${child}>${parent}`),
    velocity,
    pulls: spine.filter((id) => parents(id).length > 1 && isPull(byId.get(id).message)),
  };
}
