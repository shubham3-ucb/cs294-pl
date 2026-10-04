// The monster: parts, palette and a small display renderer.
// Pure at import (the server imports the palette from here); DOM work happens only inside functions.

export const PARTS = ['face', 'body', 'legs'];

export const PALETTE = {
  face: { smiley: '🙂', cat: '🐱', alien: '👽', frog: '🐸', dragon: '🐲', ghost: '👻', lion: '🦁', monkey: '🐵', mustache: '🥸' },
  body: { box: '📦', robot: '🤖', superhero: '🦸', cactus: '🌵', pumpkin: '🎃', coat: '🧥', donut: '🍩', shell: '🐢' },
  legs: { sticks: '🦵', tentacles: '🐙', wheels: '🛞', skates: '🛼', rocket: '🚀', duck: '🦆', paws: '🐾' },
};

export const START = { face: 'smiley', body: 'box', legs: 'sticks' };

// Mission parts appear from their mission's step, so nobody can pre-set them.
// The mustache belongs to the sabotage only and is never offered.
const FROM_STEP = {
  cat: 2, robot: 2, superhero: 2, tentacles: 2,
  dragon: 5, skates: 5, cactus: 5, alien: 5, rocket: 5, pumpkin: 5,
  mustache: Infinity,
};

// The choices a student may pick at this step: {face: [slug], body: [slug], legs: [slug]}.
export function palette(step) {
  return Object.fromEntries(PARTS.map((part) => [
    part,
    Object.keys(PALETTE[part]).filter((slug) => (FROM_STEP[slug] ?? 0) <= step),
  ]));
}

export const emoji = (part, slug) => PALETTE[part]?.[slug] ?? '❔';

export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const SIZES = { tiny: 16, small: 26, medium: 40, large: 60 };

// A monster as three stacked emoji (face over body over legs). Styled inline so any page can use it.
export function renderMonsterCard(el, monster = START, { size = 'medium' } = {}) {
  const px = SIZES[size] ?? SIZES.medium;
  el.replaceChildren(...PARTS.map((part) => {
    const span = document.createElement('span');
    span.textContent = emoji(part, monster[part]);
    span.title = `${part.toUpperCase()}: ${monster[part]}`;
    return span;
  }));
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', PARTS.map((part) => monster[part]).join(', '));
  Object.assign(el.style, {
    display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
    fontSize: `${px}px`, lineHeight: '1.08', fontFamily: EMOJI_FONT,
  });
}
