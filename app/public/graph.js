// The table graph: cards left→right in time order, each arrow points to the card before,
// sticky notes on the cards they point at.
//   renderGraph(svgEl, {commits, refs}, {labels, you, onCardClick, compact, width, maxCols, all, onOlder, pillFont})
// commits: [{id, parents, author, time, message, monster, reachable}] · refs: {name: id}
// compact: true for small cards, 'auto' for small cards only when the full ones don't all fit in `width` px.
// Cards that don't fit in `width` (or past maxCols) fold into pills "← 8 older cards", so no card is ever
// cut in half; cards with a sticky note are never folded. all: draw every card, to scroll.
// onOlder makes the pills buttons.
import { PARTS, emoji, EMOJI_FONT } from './monster.js';

const NS = 'http://www.w3.org/2000/svg';
const C = { ink: '#111111', muted: '#70707A', text: '#5F5F69', line: '#E4E4E9', arrow: '#B4B4BE', yellow: '#FFE066', pink: '#FF4D8D', blue: '#0EA5E9', purple: '#8B3DFF', pill: '#F0F0F3' };
const FONT = 'Inter, system-ui, sans-serif';
const MONO = 'ui-monospace, "JetBrains Mono", "Noto Sans Mono", monospace';

const SIZES = {
  full: { w: 180, h: 92, gap: 36, pad: 12, label: 25, laneGap: 18, note: 13, radius: 14, pill: 13 },
  compact: { w: 66, h: 80, gap: 16, pad: 10, label: 21, laneGap: 14, note: 10, radius: 11, pill: 12 },
};

let svgCount = 0;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const shortRef = (name) => name.replace(/^refs\/(heads|remotes)\//, '');
const short = (id) => id.slice(0, 7);
const pillText = (n) => `← ${n} older ${n === 1 ? 'card' : 'cards'}`;

export function renderGraph(svg, graph, {
  labels = false, you = null, onCardClick = null, compact = false, width = Infinity, maxCols = Infinity, all = false,
  onOlder = null, pillFont,
} = {}) {
  const refs = Object.fromEntries(Object.entries(graph?.refs ?? {}).map(([name, id]) => [shortRef(name), id]));
  const order = timeOrder(graph?.commits ?? []);
  const lanes = assignLanes(order, refs);
  const fontOf = (size) => pillFont ?? size.pill;
  let S = compact === true ? SIZES.compact : SIZES.full;
  if (compact === 'auto' && arrange(order, refs, S, Infinity, maxCols, fontOf(S)).width > width) S = SIZES.compact;
  const small = S === SIZES.compact;
  const font = fontOf(S);
  const { history: live, diary } = arrange(order, refs, S, all ? Infinity : width, maxCols, font);

  const shown = [...live.shown, ...diary.shown];
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
  const height = shown.length ? y - S.laneGap + S.pad : 0;
  const pos = new Map([live, diary].flatMap(({ shown: cards, xs }) => cards.map((c, i) => {
    const row = rowOf.get(lanes.get(c.id));
    return [c.id, { x: xs[i], y: rowTop[row], row }];
  })));
  // The history's pills sit on the top row, the diary's on the diary row.
  const diaryRow = rowOf.get(lanes.get(diary.shown[0]?.id));
  const pills = [...live.pills.map((p) => ({ ...p, row: 0 })), ...diary.pills.map((p) => ({ ...p, row: diaryRow }))]
    .map((p) => ({ ...p, y: rowTop[p.row] }));
  const drawnWidth = Math.max(1, ...[...pos.values()].map((p) => p.x + S.w), ...pills.map((p) => p.x + p.w)) + S.pad;

  svg.setAttribute('viewBox', `0 0 ${drawnWidth} ${Math.max(height, 1)}`);
  svg.setAttribute('width', drawnWidth);
  svg.setAttribute('height', Math.max(height, 1));
  svg.setAttribute('font-family', FONT);

  if (!svg.dataset.uid) {
    svg.dataset.uid = String(++svgCount);
    svg.innerHTML = `<defs><marker id="arrow-${svg.dataset.uid}" viewBox="0 0 10 10" refX="8" refY="5"
        markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0,1 L9,5 L0,9 z" fill="${C.arrow}"/></marker>
        <style>.clickable .g-card { cursor: pointer; } .g-card g:focus { outline: none; }
          .clickable .g-card:hover rect, .g-card g:focus-visible rect { stroke: ${C.purple}; stroke-width: 2; }</style></defs>
      <g class="g-edges"></g><g class="g-older"></g><g class="g-cards"></g><g class="g-labels"></g>`;
  }
  const [edges, older, cards, notes] = ['.g-edges', '.g-older', '.g-cards', '.g-labels'].map((sel) => svg.querySelector(sel));
  const animate = svg.dataset.drawn === '1' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const moved = sync(cards, shown.map((c) => {
    const p = pos.get(c.id);
    return { key: c.id, x: p.x, y: p.y, sig: `${c.reachable !== false} ${small}`, html: cardHtml(c, S, small) };
  }), animate);

  sync(notes, shown.flatMap((c) => (notesOn.get(c.id) ?? []).map((name, k) => {
    const p = pos.get(c.id);
    const isYou = name === you;
    return { key: name, x: p.x, y: p.y - (k + 1) * S.label + 3, sig: `${isYou} ${small}`, html: noteHtml(name, isYou, S) };
  })), animate);

  // An arrow to a card that isn't drawn ends at its pill, as if the pill were that card;
  // a pill points on to where its hidden cards came from.
  const marker = `url(#arrow-${svg.dataset.uid})`;
  const arrow = (child, parent) =>
    `<path d="${edgePath(child, parent, S)}" fill="none" stroke="${C.arrow}" stroke-width="1.75" marker-end="${marker}"/>`;
  const pillOf = new Map(pills.flatMap((p) => p.hidden.map((c) => [c.id, p])));
  const asCard = (p) => ({ ...p, x: p.x + p.w - S.w });
  const targets = (ids, self) => [...new Set(ids.map((id) => (pos.has(id) ? id : pillOf.get(id))).filter((t) => t && t !== self))]
    .map((t) => (typeof t === 'string' ? pos.get(t) : asCard(t)));
  edges.innerHTML = [
    ...shown.flatMap((c) => targets(c.parents).map((parent) => arrow(pos.get(c.id), parent))),
    ...pills.flatMap((p) => targets(p.hidden.flatMap((c) => c.parents), p).map((parent) => arrow(p, parent))),
  ].join('');
  if (moved && animate) edges.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], 380);

  const pillH = Math.round(font * 2.1);
  older.innerHTML = pills.map((p) => `<g${onOlder ? ' tabindex="0" role="button" style="cursor:pointer"' : ''} aria-label="${pillText(p.hidden.length)}">
      ${onOlder ? '<title>Show all cards</title>' : ''}
      <rect x="${p.x}" y="${p.y + (S.h - pillH) / 2}" width="${p.w}" height="${pillH}" rx="${pillH / 2}" fill="${C.pill}"/>
      <text x="${p.x + p.w / 2}" y="${p.y + S.h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${font}"
        fill="${C.muted}">${pillText(p.hidden.length)}</text></g>`).join('');

  const byId = new Map(order.map((c) => [c.id, c]));
  const cardAt = (target) => byId.get(target.closest?.('.g-card')?.dataset.key);
  const press = (target) => {
    const c = cardAt(target);
    if (c && onCardClick) onCardClick(c);
    else if (onOlder && target.closest?.('.g-older')) onOlder();
    else return false;
    return true;
  };
  svg.onclick = (e) => press(e.target);
  svg.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && press(e.target)) e.preventDefault(); };
  cards.classList.toggle('clickable', Boolean(onCardClick));
  svg.dataset.drawn = '1';
}

// Where each drawn card and pill goes, left to right, for cards of size S in `width` px.
// The history: Start, the newest card and every card with a sticky note are always drawn; then the cards
// right before them, then the newest of the rest, while they fit. Each run of cards left out becomes one
// pill. Cards only in the diary get their own row, starting right after the card they came from: a
// replaced history (Start ← Clean history) stays side by side above the old cards.
function arrange(order, refs, S, width, maxCols, font) {
  const step = S.w + S.gap;
  const pillW = (n) => Math.round(pillText(n).length * font * 0.52 + font * 1.4);
  const runs = (cards, show) => cards.reduce((out, c) => {
    if (show.has(c.id)) out.push({ card: c });
    else if (out.at(-1)?.hidden) out.at(-1).hidden.push(c);
    else out.push({ hidden: [c] });
    return out;
  }, []);
  const runW = (run) => (run.card ? S.w : pillW(run.hidden.length));
  const place = (cards, x0, room, cols, must, rank) => {
    const ids = new Set(cards.map((c) => c.id));
    const fits = (show) => show.size <= cols && runs(cards, show).reduce((w, run) => w + runW(run) + S.gap, -S.gap) <= room;
    let show = ids;
    if (!fits(show)) {
      show = new Set(must.filter((id) => ids.has(id)));
      for (const id of rank) if (ids.has(id) && !show.has(id) && fits(new Set([...show, id]))) show.add(id);
    }
    const out = { shown: [], xs: [], pills: [] };
    let x = x0;
    for (const run of runs(cards, show)) {
      if (run.card) { out.shown.push(run.card); out.xs.push(x); } else out.pills.push({ x, w: runW(run), hidden: run.hidden });
      x += runW(run) + S.gap;
    }
    return out;
  };

  const byId = new Map(order.map((c) => [c.id, c]));
  const live = order.filter((c) => c.reachable !== false);
  const noted = new Set(Object.values(refs));
  const must = [live[0], live.at(-1), ...live.filter((c) => noted.has(c.id))].filter(Boolean).map((c) => c.id);
  const rank = [...must.flatMap((id) => byId.get(id).parents), ...live.map((c) => c.id).reverse()];
  const history = place(live, S.pad, width - 2 * S.pad, maxCols, must, rank);

  const at = new Map(history.shown.map((c, i) => [c.id, history.xs[i]]));
  for (const p of history.pills) for (const c of p.hidden) at.set(c.id, p.x + p.w - S.w); // a pill stands where its last card would
  const diaryCards = order.filter((c) => c.reachable === false);
  const newestFirst = diaryCards.map((c) => c.id).reverse();
  const x0 = (at.get(diaryCards[0]?.parents[0]) ?? S.pad - step) + step;
  const diary = place(diaryCards, x0, width - S.pad - x0, Math.max(1, maxCols - 1), newestFirst.slice(0, 1), newestFirst);
  diary.shown.forEach((c, i) => { // never left of the card it came from
    diary.xs[i] = Math.max(diary.xs[i], (at.get(c.parents[0]) ?? -Infinity) + step, i ? diary.xs[i - 1] + step : -Infinity);
  });
  const right = Math.max(1, ...[history, diary].flatMap((r) => [...r.xs.map((x) => x + S.w), ...r.pills.map((p) => p.x + p.w)]));
  return { history, diary, width: right + S.pad };
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
// Cards only in the diary share one row under all the others: one dashed chain under where they were.
function assignLanes(order, refs) {
  const diary = order.filter((c) => c.reachable === false);
  order = order.filter((c) => c.reachable !== false);
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
  for (const c of diary) lanes.set(c.id, busyUntil.length);
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

function cardHtml(c, S, small) {
  const diary = c.reachable === false;
  const title = `${short(c.id)} · ${c.author} · ${c.message}${diary ? ' · only in the diary' : ''}`;
  const frame = `<title>${esc(title)}</title>
    <rect width="${S.w}" height="${S.h}" rx="${S.radius}" fill="#fff" stroke="${diary ? C.muted : C.line}"
      stroke-width="1.5" ${diary ? 'stroke-dasharray="5 4"' : ''}/>`;
  const parts = (x, size, ys) => PARTS.map((part, i) =>
    `<text x="${x}" y="${ys[i]}" font-size="${size}" font-family='${EMOJI_FONT}' text-anchor="middle"
      dominant-baseline="central">${emoji(part, c.monster?.[part])}</text>`).join('');
  const body = small
    ? `${parts(S.w / 2, 16, [14, 31, 48])}
       <text x="${S.w / 2}" y="${S.h - 9}" text-anchor="middle" font-family='${MONO}' font-size="14"
         fill="${C.ink}">${short(c.id)}</text>`
    : `${parts(27, 20, [22, 46, 70])}
       <text x="52" y="25" font-family='${MONO}' font-size="14" font-weight="600" fill="${C.ink}">${short(c.id)}</text>
       <text x="52" y="45" font-size="14" font-weight="600" fill="${C.ink}">${esc(clip(c.author, 14))}</text>
       ${wrap(plainMessage(c.message), 17).map((line, i) =>
         `<text x="52" y="${64 + i * 15}" font-size="12.5" fill="${C.text}">${esc(line)}</text>`).join('')}`;
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

// Git's merge messages, shorter: "Merge remote-tracking branch 'wall/main'" → "Merge wall/main".
export const plainMessage = (message) => String(message)
  .replace(/^Merge remote-tracking branch '(.+)'$/, 'Merge $1')
  .replace(/^Merge branch '(.+?)'/, 'Merge $1');

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
