// The outfit: parts, palette, plain names and a small display renderer.
// Pure at import (the server imports the palette from here); DOM work happens only inside functions.

export const PARTS = ['hat', 'glasses', 'top', 'shoes'];

export const PALETTE = {
  hat: { cap: '🧢', tophat: '🎩', sunhat: '👒', crown: '👑', gradcap: '🎓', helmet: '⛑️' },
  glasses: { round: '👓', shades: '🕶️', goggles: '🥽', monocle: '🧐', disguise: '🥸' },
  top: { tshirt: '👕', tie: '👔', jersey: '🎽', coat: '🧥', blouse: '👚', labcoat: '🥼', vest: '🦺' },
  shoes: { sneakers: '👟', boots: '🥾', heels: '👠', loafers: '👞', sandals: '🩴', skates: '🛼', ballet: '🩰' },
};

// Plain names for the pickers and hints. A slug missing here reads as itself.
const NAMES = {
  tophat: 'top hat', sunhat: 'sun hat', gradcap: 'grad cap',
  round: 'round glasses', disguise: 'disguise glasses',
  tshirt: 'T-shirt', tie: 'shirt & tie', labcoat: 'lab coat', vest: 'safety vest',
  ballet: 'ballet shoes',
};

export const START = { hat: 'cap', glasses: 'round', top: 'tshirt', shoes: 'sneakers' };

// Mission parts appear from their mission's step, so nobody can pre-set them.
// The disguise belongs to the sabotage only and is never offered.
const FROM_STEP = {
  tophat: 2, tie: 2, jersey: 2, boots: 2,
  crown: 4, skates: 4, shades: 4, labcoat: 4, gradcap: 4, ballet: 4,
  disguise: Infinity,
};

// The choices a student may pick at this step: {hat: [slug], glasses: [slug], top: [slug], shoes: [slug]}.
export function palette(step) {
  return Object.fromEntries(PARTS.map((part) => [
    part,
    Object.keys(PALETTE[part]).filter((slug) => (FROM_STEP[slug] ?? 0) <= step),
  ]));
}

export const emoji = (part, slug) => PALETTE[part]?.[slug] ?? '❔';
export const nameOf = (slug) => NAMES[slug] ?? slug;

export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const SIZES = { tiny: 16, small: 26, medium: 40, large: 60 };
// Hat on top, then glasses, top and shoes, drawn tight so the stack reads as one dressed figure.
const SCALE = { hat: 1, glasses: 0.8, top: 1.2, shoes: 0.85 };

// An outfit as four stacked emoji. Styled inline so any page can use it.
export function renderMonsterCard(el, monster = START, { size = 'medium' } = {}) {
  const px = SIZES[size] ?? SIZES.medium;
  el.replaceChildren(...PARTS.map((part) => {
    const span = document.createElement('span');
    span.textContent = emoji(part, monster[part]);
    span.title = `${part.toUpperCase()}: ${nameOf(monster[part])}`;
    span.style.fontSize = `${Math.round(px * SCALE[part])}px`;
    return span;
  }));
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', PARTS.map((part) => nameOf(monster[part])).join(', '));
  Object.assign(el.style, {
    display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
    lineHeight: '1', fontFamily: EMOJI_FONT,
  });
}
