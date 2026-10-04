// monster.txt: the only file in every card. The palette lives in public/monster.js (one source).
import { PARTS, PALETTE, START, palette } from '../public/monster.js';

export { PARTS, START, palette };

// A monster is valid when every part is a slug from the palette.
export const isMonster = (m) => PARTS.every((part) => Object.hasOwn(PALETTE[part], m?.[part] ?? ''));

// The `---` lines keep parts apart, so Git merges each part on its own.
export function serialize(monster) {
  if (!isMonster(monster)) throw new Error(`Not a monster: ${JSON.stringify(monster)}`);
  return `${PARTS.map((part) => `${part}: ${monster[part]}`).join('\n---\n')}\n`;
}

export function parse(text) {
  const monster = {};
  for (const line of String(text).split('\n')) {
    const m = /^(face|body|legs): ([a-z]+)$/.exec(line);
    if (m) monster[m[1]] = m[2];
  }
  return monster;
}

// Commit message for a save: "FACE: smiley → cat, BODY: box → robot".
export function describeChange(before, after) {
  return PARTS.filter((part) => before[part] !== after[part])
    .map((part) => `${part.toUpperCase()}: ${before[part]} → ${after[part]}`)
    .join(', ');
}

// Part-wise 3-way merge against the card both sides started from.
// auto = parts Git combines by itself; conflicts = parts changed on both sides, differently.
export function merge3(base, ours, theirs) {
  const auto = {};
  const conflicts = [];
  for (const part of PARTS) {
    if (ours[part] === theirs[part] || theirs[part] === base[part]) auto[part] = ours[part];
    else if (ours[part] === base[part]) auto[part] = theirs[part];
    else conflicts.push(part);
  }
  return { auto, conflicts };
}
