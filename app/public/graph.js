// The table graph: cards left→right in time order, each arrow points to the card before,
// sticky notes on the cards they point at.
//   renderGraph(svgEl, {commits, refs}, {labels, you, onCardClick, compact})
// commits: [{id, parents, author, time, message, monster, reachable}] · refs: {name: id}
import { PARTS, emoji, EMOJI_FONT } from './monster.js';

const NS = 'http://www.w3.org/2000/svg';
const C = { ink: '#111111', muted: '#70707A', line: '#E4E4E9', arrow: '#B4B4BE', yellow: '#FFE066', pink: '#FF4D8D', blue: '#0EA5E9', purple: '#8B3DFF' };
const FONT = 'Inter, system-ui, sans-serif';
const MONO = 'ui-monospace, "JetBrains Mono", "Noto Sans Mono", monospace';

const SIZES = {
  full: { w: 164, h: 84, gap: 40, pad: 12, label: 23, laneGap: 18, note: 12, radius: 14 },
  compact: { w: 58, h: 80, gap: 20, pad: 10, label: 21, laneGap: 14, note: 10, radius: 11, maxCols: 7 },
};

let svgCount = 0;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const shortRef = (name) => name.replace(/^refs\/(heads|remotes)\//, '');
const short = (id) => id.slice(0, 7);

export function renderGraph(svg, graph, { labels = false, you = null, onCardClick = null, compact = false } = {}) {
  const S = compact ? SIZES.compact : SIZES.full;
  const refs = Object.fromEntries(Object.entries(graph?.refs ?? {}).map(([name, id]) => [shortRef(name), id]));
  const order = timeOrder(graph?.commits ?? []);
  const lanes = assignLanes(order, refs);

  // A compact graph shows only the newest columns.
  const cut = compact ? Math.max(0, order.length - S.maxCols) : 0;
  const shown = order.slice(cut);
  const rows = [...new Set(shown.map((c) => lanes.get(c.id)))].sort((a, b) => a - b);
  const rowOf = new Map(rows.map((lane, row) => [lane, row]));

  const notesOn = new Map();
  if (labels) {
    for (const [name, id] of Object.entries(refs).sort(([a], [b]) => refRank(a) - refRank(b) || a.localeCompare(b))) {
      if (!notesOn.has(id)) notesOn.set(id, []);
      notesOn.get(id).push(name);
    }
  }

  // Each row is tall enough for the most sticky notes stacked on one of its cards.
  const stack = rows.map(() => 0);
  for (const c of shown) {
    const row = rowOf.get(lanes.get(c.id));
    stack[row] = Math.max(stack[row], notesOn.get(c.id)?.length ?? 0);
  }
  const rowTop = [];
  let y = S.pad;
  rows.forEach((_, row) => { rowTop[row] = y + stack[row] * S.label; y = rowTop[row] + S.h + S.laneGap; });
  const left = S.pad + (cut ? 30 : 0);
  const width = left + shown.length * (S.w + S.gap) - S.gap + S.pad;
  const height = shown.length ? y - S.laneGap + S.pad : 0;

  const pos = new Map(shown.map((c, i) => {
    const row = rowOf.get(lanes.get(c.id));
    return [c.id, { x: left + i * (S.w + S.gap), y: rowTop[row], row }];
  }));

  svg.setAttribute('viewBox', `0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`);
  svg.setAttribute('width', Math.max(width, 1));
  svg.setAttribute('height', Math.max(height, 1));
  svg.setAttribute('font-family', FONT);

  if (!svg.dataset.uid) {
    svg.dataset.uid = String(++svgCount);
    svg.innerHTML = `<defs><marker id="arrow-${svg.dataset.uid}" viewBox="0 0 10 10" refX="8" refY="5"
        markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0,1 L9,5 L0,9 z" fill="${C.arrow}"/></marker>
        <style>.clickable .g-card { cursor: pointer; } .g-card g:focus { outline: none; }
          .clickable .g-card:hover rect, .g-card g:focus-visible rect { stroke: ${C.purple}; stroke-width: 2; }</style></defs>
      <g class="g-edges"></g><g class="g-cards"></g><g class="g-labels"></g>`;
  }
  const [edges, cards, notes] = ['.g-edges', '.g-cards', '.g-labels'].map((sel) => svg.querySelector(sel));
  const animate = svg.dataset.drawn === '1' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const moved = sync(cards, shown.map((c) => {
    const p = pos.get(c.id);
    return { key: c.id, x: p.x, y: p.y, sig: `${c.reachable !== false} ${compact}`, html: cardHtml(c, S, compact) };
  }), animate);

  sync(notes, shown.flatMap((c) => (notesOn.get(c.id) ?? []).map((name, k) => {
    const p = pos.get(c.id);
    const isYou = name === you;
    return { key: name, x: p.x, y: p.y - (k + 1) * S.label + 3, sig: `${isYou} ${compact}`, html: noteHtml(name, isYou, S) };
  })), animate);

  const marker = `url(#arrow-${svg.dataset.uid})`;
  edges.innerHTML = shown.flatMap((c) => c.parents.filter((id) => lanes.has(id)).map((id) => {
    const d = pos.has(id) ? edgePath(pos.get(c.id), pos.get(id), S) : stubPath(pos.get(c.id), S);
    return `<path d="${d}" fill="none" stroke="${C.arrow}" stroke-width="1.75" marker-end="${marker}"/>`;
  })).join('') + (cut ? `<text x="${S.pad}" y="${rowTop[0] + S.h / 2}" dominant-baseline="central"
      font-size="11" fill="${C.muted}">+${cut}</text>` : '');
  if (moved && animate) edges.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], 380);

  const byId = new Map(order.map((c) => [c.id, c]));
  const cardAt = (target) => byId.get(target.closest?.('.g-card')?.dataset.key);
  svg.onclick = (e) => { const c = cardAt(e.target); if (c && onCardClick) onCardClick(c); };
  svg.onkeydown = (e) => {
    const c = cardAt(e.target);
    if (c && onCardClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onCardClick(c); }
  };
  cards.classList.toggle('clickable', Boolean(onCardClick));
  svg.dataset.drawn = '1';
}

// main first, other sticky notes by name, the Wall's copy last.
const refRank = (name) => (name === 'main' ? 0 : name.includes('/') ? 2 : 1);

// Parents before children; among the cards that are ready, the oldest goes first.
// Ties keep the server's order (git log --topo-order lists newest first).
function timeOrder(commits) {
  const ids = new Set(commits.map((c) => c.id));
  const rank = new Map(commits.map((c, i) => [c.id, -i]));
  const placed = new Set();
  const out = [];
  let rest = commits;
  while (rest.length) {
    const ready = rest.filter((c) => c.parents.every((p) => placed.has(p) || !ids.has(p)));
    const next = (ready.length ? ready : rest).reduce((a, b) =>
      (b.time < a.time || (b.time === a.time && rank.get(b.id) < rank.get(a.id)) ? b : a));
    out.push(next);
    placed.add(next.id);
    rest = rest.filter((c) => c !== next);
  }
  return out;
}

// Rows: a card continues its first parent's row; main's own history keeps the top row.
// A row is reused once nothing on it still needs the space (cards or arrows).
function assignLanes(order, refs) {
  const byId = new Map(order.map((c) => [c.id, c]));
  const col = new Map(order.map((c, i) => [c.id, i]));
  const mainline = new Set();
  for (let id = refs.main; byId.has(id) && !mainline.has(id); id = byId.get(id).parents[0]) mainline.add(id);

  const continuer = new Map();
  const lastChild = new Map();
  for (const c of order) {
    c.parents.forEach((p, i) => {
      if (!byId.has(p)) return;
      lastChild.set(p, col.get(c.id));
      if (i === 0 && (!continuer.has(p) || (mainline.has(c.id) && !mainline.has(continuer.get(p))))) continuer.set(p, c.id);
    });
  }

  const lanes = new Map();
  const busyUntil = [];
  for (const c of order) {
    const parent = byId.has(c.parents[0]) ? c.parents[0] : null;
    let lane;
    if (parent && continuer.get(parent) === c.id) lane = lanes.get(parent);
    else {
      const from = parent ? col.get(parent) : col.get(c.id) - 1;
      lane = busyUntil.findIndex((until) => until <= from);
      if (lane < 0) lane = busyUntil.length;
    }
    lanes.set(c.id, lane);
    busyUntil[lane] = continuer.has(c.id) ? Infinity : Math.max(col.get(c.id), lastChild.get(c.id) ?? 0);
  }
  return lanes;
}

// From a card's left edge to its parent's right edge. The bend sits next to the card on the top row.
function edgePath(child, parent, S) {
  const x1 = child.x, y1 = child.y + S.h / 2;
  const x2 = parent.x + S.w + 2, y2 = parent.y + S.h / 2;
  if (y1 === y2) return `M${x1},${y1} H${x2}`;
  const k = S.gap / 2;
  const bendAt = child.row > parent.row ? x2 + S.gap : x1 - S.gap;
  if (x1 - x2 <= S.gap + 1) return `M${x1},${y1} C${x1 - k},${y1} ${x2 + k},${y2} ${x2},${y2}`;
  return child.row > parent.row
    ? `M${x1},${y1} H${bendAt} C${bendAt - k},${y1} ${x2 + k},${y2} ${x2},${y2}`
    : `M${x1},${y1} C${x1 - k},${y1} ${bendAt + k},${y2} ${bendAt},${y2} H${x2}`;
}

// The parent is off the left edge of a compact graph.
const stubPath = (child, S) => `M${child.x},${child.y + S.h / 2} h${-S.gap * 0.7}`;

function cardHtml(c, S, compact) {
  const diary = c.reachable === false;
  const title = `${short(c.id)} · ${c.author} · ${c.message}${diary ? ' · only in the diary' : ''}`;
  const frame = `<title>${esc(title)}</title>
    <rect width="${S.w}" height="${S.h}" rx="${S.radius}" fill="#fff" stroke="${diary ? C.muted : C.line}"
      stroke-width="1.5" ${diary ? 'stroke-dasharray="5 4"' : ''}/>`;
  const parts = (x, size, ys) => PARTS.map((part, i) =>
    `<text x="${x}" y="${ys[i]}" font-size="${size}" font-family='${EMOJI_FONT}' text-anchor="middle"
      dominant-baseline="central">${emoji(part, c.monster?.[part])}</text>`).join('');
  const body = compact
    ? `${parts(S.w / 2, 16, [16, 34, 52])}
       <text x="${S.w / 2}" y="${S.h - 11}" text-anchor="middle" font-family='${MONO}' font-size="10"
         fill="${C.ink}">${short(c.id)}</text>`
    : `${parts(26, 19, [20, 42, 64])}
       <text x="50" y="22" font-family='${MONO}' font-size="12.5" font-weight="600" fill="${C.ink}">${short(c.id)}</text>
       <text x="50" y="40" font-size="13" font-weight="600" fill="${C.ink}">${esc(clip(c.author, 14))}</text>
       ${wrap(c.message, 16).map((line, i) =>
         `<text x="50" y="${57 + i * 14}" font-size="11.5" fill="${C.muted}">${esc(line)}</text>`).join('')}`;
  return `<g opacity="${diary ? 0.5 : 1}" tabindex="0" role="button"
    aria-label="Card ${short(c.id)} by ${esc(c.author)}: ${esc(c.message)}">${frame}${body}</g>`;
}

function noteHtml(name, isYou, S) {
  const wall = name.includes('/');
  const h = S.label - 7;
  const w = Math.round(name.length * S.note * 0.6 + S.note * 1.4);
  const pin = isYou
    ? `<rect x="${w + 5}" width="${S.note * 3.3}" height="${h}" rx="${h / 2}" fill="${C.pink}"/>
       <text x="${w + 5 + S.note * 1.65}" y="${h / 2}" dominant-baseline="central" text-anchor="middle"
         font-size="${S.note - 1}" font-weight="700" fill="#fff" letter-spacing="0.06em">YOU</text>`
    : '';
  return `<rect width="${w}" height="${h}" rx="5" fill="${wall ? C.blue : C.yellow}"/>
    <text x="${S.note * 0.7}" y="${h / 2}" dominant-baseline="central" font-family='${MONO}' font-size="${S.note}"
      font-weight="600" fill="${wall ? '#fff' : C.ink}">${esc(name)}</text>${pin}`;
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Two lines at most, broken at spaces; the rest is cut with an ellipsis.
function wrap(text, n) {
  const lines = [''];
  for (const word of String(text).split(' ')) {
    const line = lines.at(-1);
    if (!line || line.length + 1 + word.length <= n) lines[lines.length - 1] = line ? `${line} ${word}` : word;
    else if (lines.length < 2) lines.push(word);
    else { lines[1] = `${lines[1]} ${word}`; break; }
  }
  return lines.map((line) => clip(line, n));
}

// Keyed update: existing cards and notes keep their element and glide to the new place.
// Returns whether anything moved.
function sync(group, items, animate) {
  const old = new Map([...group.children].map((el) => [el.dataset.key, el]));
  let moved = false;
  for (const item of items) {
    let el = old.get(item.key);
    old.delete(item.key);
    const transform = `translate(${item.x}px, ${item.y}px)`;
    if (!el) {
      el = document.createElementNS(NS, 'g');
      el.dataset.key = item.key;
      el.setAttribute('class', group.classList.contains('g-cards') ? 'g-card' : 'g-note');
      el.style.transform = transform;
      group.append(el);
      if (animate) {
        el.animate([{ opacity: 0, transform: `translate(${item.x + 18}px, ${item.y}px)` }, { opacity: 1, transform }],
          { duration: 240, easing: 'cubic-bezier(.2,.7,.3,1)' });
      }
    } else if (el.style.transform !== transform) {
      moved = true;
      el.style.transition = animate ? 'transform 240ms cubic-bezier(.2,.7,.3,1)' : '';
      el.style.transform = transform;
    }
    if (el.dataset.sig !== item.sig || !el.firstChild) { el.innerHTML = item.html; el.dataset.sig = item.sig; }
    el.dataset.x = item.x;
  }
  for (const el of old.values()) el.remove();
  return moved;
}
