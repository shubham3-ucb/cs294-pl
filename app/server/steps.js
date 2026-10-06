// Everything the class reads: each step's copy, missions, goals and hints, the predictions and choices, the
// technical cards, and the scene script the teacher's Next button walks. Wording follows lesson/tuesday.md.
//
// STEPS[n] (students, in the app):
//   title, instruction, screen (the projector's one line), mission (where pairs or labs differ),
//   unlocks, tips [{action, text}] (one bubble per new button, at most 10 words), goals(v), hint(v, me),
//   bonus, behind {text, cmds} ("Behind the door" in the step panel)
//   mainLocked — while set, main changes only by merging; clicking a part on main says this
//   bossInstruction — Step 6's line for the boss lab
//   fresh — Step 4's line on what the copy of the Wall holds (wallLab: the lab whose main went to the Wall)
//
// goals(v) and hint(v, me) read a lab view built by session.js (labView there):
//   v.labId · v.isBoss
//   v.way() — Step 4: the way this lab chose to get the Wall's cards, 'merge' | 'rebase', or null
//   v.card(note) — the outfit on the note's card, or null when the note does not exist
//   v.draft(note) — the note's unsaved parts {part: value} · v.merging(note) — its open merge, or null
//   v.mainHasIdea(note) — main's history has a card with that pair's mission parts (true after the note is deleted)
//   v.wall() — main against the Wall's main: 'same' | 'ahead' | 'behind' | 'diverged'
//   v.wallHas(part, value) — some card on the Wall's main has it · v.wallOutfit() · v.wallIsClean()
//   v.gotSabotage() — the lab has the Intern's card · v.mainHasSabotage() — main's history has it
//   v.undidSabotage() — in this step the lab pressed Undo on the Intern's card, or moved its note back
//   v.savers() — {saved, online, waiting: [names of online people who haven't saved]}
//   v.did('refused' | 'reset') — the lab did it in this step
//   me = {pair, branch, saved, both} (both: nobody else in the lab is online, so you do both pairs' work)
// A hint has two levels: {idea, click}. "Stuck? Hint" shows the idea first (what to look at, which concept);
// a second press shows the click (the next concrete move). null when the lab is done. Bots read the click.
//
// SCENES (one Next = one scene; the projector shows it, students see it in the app):
//   id, kind ('join' | 'task' | 'reveal' | 'break' | 'paper' | 'exit' | 'wrap'), step (whose buttons are on),
//   title, minutes (planned length; `at` = planned start, added below), say, do, ask {q, a},
//   reveal {cards: [{command, is, does, how}], sentence, behind, note}, board, tools,
//   next (what pressing Next into this scene does), practiceNext (added to `next` when the practice lab plays).
//   {wallLab} and {boss} are filled in by session.js (also in STEPS[4].instruction and STEPS[6].screen).
import { emoji, nameOf, PARTS } from '../public/monster.js';

export const FIXED_LINE = 'One person presses, everyone watches. Swap each step.';
export const DONE_LINE = 'Done ✓. Wait for the class.';
export const TAGLINE = 'Dress one character together. Every save, merge, send and undo runs real Git.';

export const PAIR_NOTES = { A: 'fancy', B: 'sporty' };

export const PAIR_PARTS = {
  fancy: { hat: 'tophat', top: 'tie' },
  sporty: { top: 'jersey', shoes: 'boots' },
};

// Step 4: each lab changes one part of the same card. Labs 1–4 change different parts.
export const LAB_CHANGES = {
  1: { part: 'hat', value: 'crown' },
  2: { part: 'shoes', value: 'skates' },
  3: { part: 'glasses', value: 'shades' },
  4: { part: 'top', value: 'labcoat' },
  5: { part: 'hat', value: 'gradcap' },
  6: { part: 'shoes', value: 'ballet' },
};

export const SABOTAGE = { part: 'glasses', value: 'disguise' }; // the Intern's card, "Tiny style fix"
export const AUDIT = { part: 'shoes', value: 'boots' }; // "Who first added the 🥾 boots?"

export const WRAP_LINE = 'Cards never change. Sticky notes move. The Wall copies cards.';

// Step 1's reveal: Git takes identity and time on trust (the paper, §5.6–5.7).
export const TRUST_LINE = 'Git stores the name and clock your laptop gives it. It checks neither.';

// Step 2's reveal: the app's one simplification, said once, plainly.
export const ONE_REPO_LINE = 'In real Git, each of you would have your own clone with one working directory. Here your lab shares one repo.';

// Step 2: Switch with unsaved parts on the note you're on (session.js refuses it, as Git would).
export const SWITCH_UNSAVED = "Save card first: Git keeps one working copy and won't drop your unsaved parts.";

// Step 4's reveal and the paper: a replayed change's integration path (the paper, §6), and a combined one's.
export const COPY_LINE = 'Its original card is not on the Wall. The path starts at a copy.';
export const MERGE_LINE = 'The path ends at its own merge card, with two parents.';

// One technical card per tool, on the reveals, in the app and on the slides.
export const CARDS = {
  commit: {
    command: 'git commit',
    is: 'a saved snapshot of the whole project.',
    does: 'records the exact state, who saved it, when, and the commit before it.',
    how: 'each file is stored as a blob, the folder as a tree. A commit object = tree ID + parent ID(s) + author + committer + message. Its ID is the SHA-1 of that object, so any change gives a new ID. Nothing is edited in place.',
  },
  branch: {
    command: 'git branch',
    is: 'a movable label on one commit.',
    does: 'lets you try an idea without touching main.',
    how: 'a branch is a tiny file (`.git/refs/heads/<name>`) holding one commit ID. Committing moves it forward. HEAD records which branch you are on. Creating a branch copies nothing.',
  },
  merge: {
    command: 'git merge',
    is: 'combining two lines of work.',
    does: 'keeps a change made on one side. It stops for a person when both sides changed the same or neighbouring lines.',
    how: 'Git finds the merge base (the last common commit) and compares each side with it (a 3-way merge), then writes a merge commit with two parents. If your branch has nothing new (the other side already contains it), Git fast-forwards: only the label moves, and no merge commit is made.',
  },
  push: {
    command: 'git push / git pull',
    is: 'sharing commits with a copy elsewhere (the Wall).',
    does: 'push sends your new commits and moves the remote branch. pull brings theirs in.',
    how: 'copies exchange only the objects the other side lacks; IDs come from content, so copies agree without coordination. A push is accepted only if it is a fast-forward of the remote branch. Otherwise fetch first, then merge or rebase.',
  },
  rebase: {
    command: 'git rebase',
    is: 'replaying your commits on top of another branch.',
    does: 'gives a straight history with no merge commit.',
    how: 'for each of your commits, Git applies its change to the new base and writes a new commit. The new parent gives it a new ID. Author and author date are kept. The originals become unreachable and stay in your reflog for a while.',
  },
  undo: {
    command: 'git revert / git reset',
    is: 'two kinds of undo.',
    does: 'revert adds a commit that undoes an old one, and is safe on shared history. reset moves your branch label back, and is only safe if nobody else has those commits.',
    how: "revert applies the opposite of the commit's change and commits it on top, so history only grows. reset rewrites the branch file. The commits left behind are still listed in the reflog (a local log of where each label pointed) until they expire and gc removes them.",
  },
  squash: {
    command: 'Squash + git push --force',
    is: 'cleaning up history.',
    does: 'squash turns several commits into one. Force push makes the Wall accept it anyway.',
    how: 'squash writes one new commit whose tree is the final state. The originals, with their authors and times, become unreachable. `--force` skips the fast-forward check and moves the remote branch. `git gc` later deletes unreachable objects.',
  },
};

// "HAT → 🎩"
export const change = (part, value) => `${part.toUpperCase()} → ${emoji(part, value)}`;
const changes = (parts) => Object.entries(parts).map(([part, value]) => change(part, value)).join(', ');
const list = (words) => new Intl.ListFormat('en', { type: 'conjunction' }).format(words);
const has = (outfit, parts) => !!outfit && Object.entries(parts).every(([part, value]) => outfit[part] === value);
const unsaved = (v, note) => Object.keys(v.draft(note)).length > 0;
const DISGUISE = emoji(SABOTAGE.part, SABOTAGE.value);
const BOOTS = emoji(AUDIT.part, AUDIT.value);

// ---------- Predict before you act (Steps 3–5) ----------
// The student who presses Merge (Step 3: fancy, sporty) or Send to Wall (Steps 4–5) first predicts what Git
// will do, in one tap. Everyone else in the lab may predict too, while the action is pending. When Git answers,
// each of them sees one line: the guess, Git's answer, and why when the guess was wrong.

export const PREDICT = {
  merge: {
    q: 'What will Git do?',
    tip: 'Compare both sides with the card where they split.',
    options: [['ff', 'Fast-forward'], ['clean', 'Merge, no conflict'], ...PARTS.map((p) => [`conflict:${p}`, `Conflict on ${p.toUpperCase()}`])],
  },
  push: {
    q: 'Will the Wall accept it?',
    tip: "Compare your lab's cards with the Wall's.",
    options: [['accepted', 'Yes'], ['refused', "No, the Wall has cards we don't"]],
  },
  first: 'Predict first.',
  waiting: 'Saved. You can change it until your lab presses.',
};

// The dialog and the panel box: {title, q, tip, options: [{id, words}]}. target: the note merged (Step 3).
export function predictCopy(kind, target) {
  const { q, tip, options } = PREDICT[kind];
  return {
    title: kind === 'merge' ? `Merge ${target} into main` : 'Send to Wall',
    before: kind === 'merge' ? `Before your lab merges ${target} into main:` : "Before your lab's next send:",
    q, tip, options: options.map(([id, words]) => ({ id, words })), saved: PREDICT.waiting,
  };
}

export const validGuess = (kind, guess) => PREDICT[kind].options.some(([id]) => id === guess);

const partsWord = (parts) => list(parts.map((p) => p.toUpperCase()));
const guessWords = (guess) => ({ ff: 'fast-forward', clean: 'merge, no conflict', accepted: 'accepted', refused: 'refused' }[guess]
  ?? `conflict on ${guess.replace('conflict:', '').toUpperCase()}`);
const outcomeWords = (o) => ({ ff: 'fast-forward', clean: 'merge, no conflict', accepted: 'accepted' }[o.result]
  ?? (o.result === 'refused' ? `refused (${o.reason})` : `conflict on ${partsWord(o.parts)}`));
const WHY = {
  ff: () => 'main had no new card since the split, so Git only slid its note.',
  clean: () => 'both sides had new cards, but no part changed on both, so Git made the merge card itself.',
  conflict: (o) => `${partsWord(o.parts)} changed on both sides since the split; a part changed on one side only merges by itself.`,
  refused: () => "the Wall has cards your main doesn't, so the send is not a fast-forward.",
  accepted: () => "the Wall's newest card was already in your main's history, so the Wall only moved forward.",
};

// outcome: {result: 'ff' | 'clean' | 'conflict' | 'accepted' | 'refused', parts?, reason?}
export const isRight = (guess, o) => (o.result === 'conflict' ? guess.startsWith('conflict:') && o.parts.includes(guess.slice(9)) : guess === o.result);

// "You predicted: conflict on TOP. Git: conflict on TOP. ✓"
export function verdict(guess, o) {
  const line = `You predicted: ${guessWords(guess)}. Git: ${outcomeWords(o)}.`;
  return isRight(guess, o) ? `${line} ✓` : `${line} Why: ${WHY[o.result](o)}`;
}

// The class's accuracy, per step: "Predicted right: 7 of 10 · merge sporty 5/6 · merge fancy 2/4"
export function accuracyLine({ right, total, parts }) {
  return [`Predicted right: ${right} of ${total}`, ...parts.map((p) => `${p.label} ${p.right}/${p.total}`)].join(' · ');
}
export const ACCURACY_PART = { fancy: 'merge fancy', sporty: 'merge sporty', refused: 'refused sends', accepted: 'accepted sends' };

// ---------- Students choose (Steps 4 and 5) ----------

// Step 4: a refused lab chooses how to get the Wall's cards, and may say why in one line.
export const WAYS = {
  merge: { name: 'Combine (merge)', line: 'Adds a merge card with two parents. Your card keeps its ID.' },
  rebase: { name: 'Replay on top (rebase)', line: "Copies your card onto the Wall's newest card: a straight line, a new ID." },
};
export const WHY_Q = 'Why this way? (optional)';
export const WHY_MAX = 100;
export const NOT_CHOSEN = {
  merge: 'No lab combined. Combine would add a merge card with two parents; every card would keep its ID.',
  rebase: "No lab replayed. Replay on top would copy the card onto the Wall's newest: same change and author, a new ID.",
};

// Step 5: each lab chooses how to undo the Intern's card.
export const UNDO_WAYS = {
  revert: { name: 'Undo this card (revert)' },
  reset: { name: 'Move my note back (reset)' },
};
export const UNDO_NOT_CHOSEN = {
  reset: `No lab moved its note back. It would have been refused: the Wall still has the ${DISGUISE} card, and Get & combine brings it back.`,
  revert: `No lab chose a fix card first. Undo this card adds a card that reverses ${DISGUISE}; it sends like any card.`,
};

// "Chose: Lab 2 Combine (merge) · Lab 3 Replay on top (rebase)"
export const choiceLine = (rows) => `Chose: ${rows.map((r) => `${r.name} ${r.way}${r.why ? ` ("${r.why}")` : ''}`).join(' · ')}`;

// ---------- Hints: the idea first, then the click ----------

const H = (idea, click = idea) => ({ idea, click });
const pick = (part, value) => `Click **change** on ${part.toUpperCase()}. Pick ${emoji(part, value)} ${nameOf(value)}.`;
const finish = (open) => H(
  'Git stopped for a person: a part changed on both sides. Open the red bar and choose one.',
  `Finish the merge: pick one ${list(open.conflicts.map((p) => p.toUpperCase()))}. Then press **Finish merge**.`,
);
const SAVE = 'Press **Save card**.';
const SEND = 'Press **Send to Wall**.';
const GET = 'Press **Get & combine**.';
const AGAIN = { merge: 'Press **Get & combine**. Then **Send to Wall** again.', rebase: 'Press **Replay on top**. Then **Send to Wall** again.' };
const CHOOSE_WAY = 'Pick a way: press **Get & combine** (merge) or **Replay on top** (rebase). Then **Send to Wall** again.';
const UNDO = `Click the ${DISGUISE} card. Press **Undo this card**.`;
const CHOOSE_UNDO = `Click the ${DISGUISE} card and press **Undo this card**, or click the card right before it and press **Move my note back here**.`;
const SAVE_FIRST = H('Git keeps one working copy. Save your unsaved parts before you move your pin.', SAVE);

// Steps 3–6 work on main: be on it, with no open merge.
function onMain(v, me) {
  if (me.branch !== 'main') {
    if (unsaved(v, me.branch)) return SAVE_FIRST;
    return H('This step works on main. Look at "You\'re on": where is your pin?', 'Press **Switch to** and pick **main**.');
  }
  const open = v.merging('main');
  return open ? finish(open) : null;
}

// Make a pair's sticky note and save its mission on it (Step 2, or a Step 3 lab that is behind).
function buildNote(v, me, note) {
  if (me.branch !== note && unsaved(v, me.branch)) return SAVE_FIRST;
  if (!v.card(note)) return H(`Your pair's idea needs its own sticky note, so main stays as it is.`, `Press **New sticky note**. Name it **${note}**.`);
  if (me.branch !== note) return H(`Your pin is on another note. Your pair's work lives on **${note}**.`, `Press **Switch to** and pick **${note}**.`);
  const open = v.merging(note);
  if (open) return finish(open);
  const now = { ...v.card(note), ...v.draft(note) };
  const missing = Object.entries(PAIR_PARTS[note]).find(([part, value]) => now[part] !== value);
  if (missing) return H(`Your mission lists the parts for **${note}**. One is not in the outfit yet.`, pick(...missing));
  return H('Your parts are in the draft (dashed), not on a card yet.', SAVE);
}

// The sticky notes this person builds in Step 2: their pair's, or both when nobody else is here.
const notesFor = (me) => (me.both ? Object.values(PAIR_NOTES) : [PAIR_NOTES[me.pair]]);

// Get main level with the Wall, then send. Students meet the refusal before the hint names a way to get
// the Wall's cards. again: Step 4, the lab's way (or both ways, before it chose); Step 5, Get & combine.
function syncWall(v, again) {
  const where = v.wall();
  if (where === 'ahead') return H("Your main has a card the Wall doesn't. Share it.", SEND);
  if (where === 'behind') return H("The Wall has cards your main doesn't, and you have nothing new. Get them.", GET);
  if (where === 'diverged') return v.did('refused') ? again : H('Your card is not on the Wall yet. Share it.', SEND);
  return null;
}

// ---------- The steps ----------

export const STEPS = [
  {
    id: 'chaos',
    title: 'Everyone, one outfit',
    instruction: 'Your lab shares one outfit. Change any part, any time. Go!',
    screen: 'Your lab shares one outfit. Change any part, any time.',
    unlocks: ['chaos'],
    tips: [],
    goals: () => [],
    hint: () => H('Your lab shares one outfit. Change any part you like.', 'Click **change** on any part. Pick a new one.'),
    behind: null, // no Git yet
  },
  {
    id: 'commit',
    title: 'Save every version',
    instruction: "Step 0's outfit is gone. From now on, every save makes a card. One at a time: change one part, then press **Save card**. Everyone saves once.",
    screen: 'Change one part, then press Save card. Everyone saves once.',
    unlocks: ['draft', 'commit', 'inspect'],
    tips: [
      { action: 'commit', text: 'New: Save card keeps this outfit, with your name.' },
      { action: 'inspect', text: 'Click any card to see what Git stored.' },
    ],
    goals: (v) => {
      const { saved, online } = v.savers();
      return [{ text: `Everyone saved a card (${saved}/${online})`, done: online > 0 && saved === online }];
    },
    hint(v, me) {
      if (!me.saved) {
        return unsaved(v, me.branch)
          ? H('Your change is only in the draft (the dashed part). A card is made only when someone saves.', SAVE)
          : H('A card records one saved version. Change one part first, then save it.', 'Click **change** on one part. Pick a new one. Then press **Save card**.');
      }
      const { waiting } = v.savers();
      return waiting.length ? H(`You saved. Waiting for ${list(waiting)}.`) : null;
    },
    bonus: 'Click any card. Press **Show what Git stored**. Find the parent, the author and the message.',
    behind: {
      text: '`git commit` stores the whole outfit, the card before, your name, the time and a message. The ID is computed from all of it. Change anything, and you get a new card.',
      cmds: ['git commit', 'git log'],
    },
  },
  {
    id: 'branch',
    title: 'Try two ideas at once',
    instruction: 'Your lab already has one sticky note: main. Each pair makes its own note for its idea. Build on it and save.',
    screen: 'Pair A builds fancy. Pair B builds sporty. Each on its own sticky note.',
    unlocks: ['branch', 'switch', 'pair'],
    tips: [
      { action: 'branch', text: 'New: sticky notes. Try an idea without touching main.' },
      { action: 'switch', text: 'Switch moves you to another sticky note.' },
    ],
    mainLocked: 'main keeps the outfit you have. Make or switch to a sticky note to edit.',
    mission: {
      A: `One of you: press **New sticky note**, keep the name **fancy**. The other: wait for it, then **Switch to** **fancy**. Then ${changes(PAIR_PARTS.fancy)}. **Save card**.`,
      B: `One of you: press **New sticky note**, keep the name **sporty**. The other: wait for it, then **Switch to** **sporty**. Then ${changes(PAIR_PARTS.sporty)}. **Save card**.`,
      // A pair of one (a lab of 3 has one) needs no partner.
      soloA: `Press **New sticky note**, keep the name **fancy**. Then ${changes(PAIR_PARTS.fancy)}. **Save card**.`,
      soloB: `Press **New sticky note**, keep the name **sporty**. Then ${changes(PAIR_PARTS.sporty)}. **Save card**.`,
      // Nobody else in the lab: both missions, one after the other.
      both: `You're both pairs today. First press **New sticky note** **fancy**: ${changes(PAIR_PARTS.fancy)}, **Save card**. Then **New sticky note** **sporty**: ${changes(PAIR_PARTS.sporty)}, **Save card**.`,
    },
    goals: (v) => Object.entries(PAIR_PARTS).map(([note, parts]) => ({
      text: `${note} has ${Object.entries(parts).map(([p, value]) => emoji(p, value)).join(' + ')}`,
      done: has(v.card(note), parts),
    })),
    hint(v, me) {
      const mine = notesFor(me);
      const todo = mine.find((note) => !has(v.card(note), PAIR_PARTS[note]));
      if (todo) return buildNote(v, me, todo);
      return H(`**${mine[0]}** is done. The other pair is still on **${PAIR_NOTES[me.pair === 'A' ? 'B' : 'A']}**.`);
    },
    bonus: "**Switch to** main and back. Watch the outfit change. Look, don't edit.",
    behind: {
      text: "A sticky note (branch) is a tiny file holding one card's ID. Making one copies nothing. Your pin (HEAD) shows which note you're on. Switch waits until your parts are saved: Git keeps one working copy.",
      cmds: ['git switch -c', 'git switch'],
    },
  },
  {
    id: 'merge',
    title: 'Make one outfit from both',
    instruction: 'The client wants one outfit with both ideas. On **main**: merge **fancy**. Then merge **sporty**. Before each merge, predict what Git will do.',
    screen: 'On main: predict, merge fancy, delete its note, merge sporty.',
    unlocks: ['merge', 'resolve', 'abort', 'deleteNote'],
    tips: [
      { action: 'merge', text: "New: Merge brings a sticky note's cards into main." },
      { action: 'deleteNote', text: 'New: Delete sticky note. Its cards stay.' },
    ],
    mainLocked: 'In this step, main changes only by merging. Press Merge.',
    // Shown once main has fancy's card (the fast-forward).
    mission: { deleteFancy: 'Delete the fancy note (`git branch -d fancy`).' },
    goals: (v) => [
      { text: 'main has fancy', done: v.mainHasIdea('fancy') },
      { text: 'The fancy note is deleted', done: v.mainHasIdea('fancy') && !v.card('fancy') },
      { text: 'main has sporty', done: v.mainHasIdea('sporty') },
    ],
    hint(v, me) {
      for (const note of Object.values(PAIR_NOTES)) {
        if (!v.mainHasIdea(note) && !has(v.card(note), PAIR_PARTS[note])) {
          const h = buildNote(v, me, note);
          return H(`First finish **${note}**. ${h.idea}`, `First finish **${note}**. ${h.click}`);
        }
      }
      const stop = onMain(v, me);
      if (stop) return stop;
      if (!v.mainHasIdea('fancy')) return H("main needs fancy's cards. Before you press: has main changed since fancy split off?", 'Press **Merge fancy into main**.');
      if (v.card('fancy')) return H("main has fancy's card now. The fancy note is only a label; its cards stay without it.", 'Press **Delete sticky note** and pick **fancy**.');
      return v.mainHasIdea('sporty') ? null
        : H("main needs sporty's cards too. Compare each side with the card where you split: which parts changed on both?", 'Press **Merge sporty into main**.');
    },
    bonus: 'Open the merge card. Why two parents?',
    behind: {
      text: "If main has nothing new, `git merge` only slides main's note: a fast-forward. Otherwise it compares both sides with the card where you split. Changed on both, differently: a conflict, you pick. `git branch -d` deletes a note only if the note you're on already has its cards.",
      cmds: ['git merge', 'git branch -d'],
    },
  },
  {
    id: 'share',
    title: 'Put your outfit on the Wall',
    instruction: "The Wall is the class's shared copy, like GitHub. Your lab already has a full copy of it (that is `git clone`). It starts as {wallLab}'s outfit, so your lab's cards are now a copy of it. Make your lab's change, **Save card**, then **Send to Wall**. Predict before each send.",
    screen: 'Make your change, Save card, then predict and Send to Wall.',
    // What the fresh copy holds (true: entering Step 4 clones every lab again from the Wall).
    fresh: {
      wallLab: "Your lab's main went to the Wall. Your lab is now a fresh copy of the Wall: the same cards, the same IDs.",
      other: "Your lab now starts from {wallLab}'s Wall. Your own Steps 1–3 cards are not in this fresh copy.",
    },
    unlocks: ['wall', 'push', 'pull', 'rebase'],
    tips: [
      { action: 'wall', text: "New: the Wall. The class's shared copy, like GitHub." },
      { action: 'push', text: 'New: Send to Wall shares your cards with the class.' },
      { action: 'pull', text: "New: Get & combine brings the Wall's cards to you." },
      { action: 'rebase', text: "New: Replay on top copies your cards onto the Wall's." },
    ],
    // After a refusal the lab chooses its way; once chosen, the mission names it.
    mission: {
      choose: "The Wall refused your send. Choose how to get its cards: **Combine (merge)** or **Replay on top (rebase)**. Then **Send to Wall** again.",
      merge: 'Your lab chose **Combine (merge)**. Then **Send to Wall** again.',
      rebase: 'Your lab chose **Replay on top (rebase)**. Then **Send to Wall** again.',
    },
    goals: (v) => {
      const c = LAB_CHANGES[v.labId];
      const sent = !!c && v.wallHas(c.part, c.value);
      return [
        { text: 'Your change is on the Wall', done: sent },
        // Ticks only once the change is in: at the step's start every lab already matches the Wall.
        { text: 'Your cards match the Wall', done: sent && v.wall() === 'same' },
      ];
    },
    hint(v, me) {
      const c = LAB_CHANGES[v.labId];
      const stop = onMain(v, me);
      if (!c || stop) return stop;
      if (unsaved(v, 'main')) return H('Your change is in the draft. Only cards can be sent.', SAVE);
      if (!v.wallHas(c.part, c.value) && v.card('main')[c.part] !== c.value) {
        return H("Your mission names your lab's one change. Make it on main.", pick(c.part, c.value));
      }
      const way = v.way();
      const again = way
        ? H("The Wall still has cards your main doesn't. Get them your lab's way, then send again.", AGAIN[way])
        : H("The Wall accepts a send only if it already includes the Wall's newest card. Compare your cards with the Wall's: what is missing, and how do you want to get it?", CHOOSE_WAY);
      return syncWall(v, again);
    },
    bonus: "Open your lab's card on the Wall. Is its ID the one you saved?",
    behind: {
      text: "`git push` is refused unless the Wall's newest card is already in your history. `git pull --no-rebase` = `git fetch` + `git merge`. `git pull --rebase` = `git fetch` + `git rebase`: your cards are copied on top, with new IDs.",
      cmds: ['git clone', 'git push', 'git pull --no-rebase', 'git pull --rebase'],
    },
  },
  {
    id: 'undo',
    title: 'Oops: undo a shared mistake',
    instruction: `A ${DISGUISE} card reached the Wall. Remove it without breaking anyone's copy. Your lab chooses how. Predict before each send.`,
    screen: `A ${DISGUISE} card reached the Wall. Remove it without breaking anyone's copy.`,
    unlocks: ['revert', 'reset', 'reflog'],
    tips: [
      { action: 'revert', text: 'New: Undo this card adds a card that reverses it.' },
      { action: 'reset', text: 'New: Move my note back here, to an older card.' },
      { action: 'reflog', text: 'New: Safety diary lists every card main has been on.' },
    ],
    // Entering the step gives every lab the card. A lab that had unsent work gets it with Get & combine.
    mission: {
      get: `Your lab doesn't have the ${DISGUISE} card yet. Press **Get & combine**.`,
      choose: `Your lab has it now. Choose: click the ${DISGUISE} card and press **Undo this card** (adds a fix card), or click the card right before it and press **Move my note back here** (moves main back). Then **Send to Wall**.`,
      undone: 'You added a fix card. Now **Send to Wall**. Refused? **Get & combine**, then send again.',
      movedBack: 'You moved main back. Now **Send to Wall**. What happens?',
      refused: `Refused. Open the **Safety diary**, then press **Get & combine**. ${DISGUISE} back? Click it, press **Undo this card**, then send.`,
    },
    goals: (v) => [
      { text: `You undid the ${DISGUISE} card yourselves`, done: v.undidSabotage() },
      { text: `No ${DISGUISE} on the Wall or in your lab (Send to Wall)`, done: v.wall() === 'same' && v.wallOutfit()?.[SABOTAGE.part] !== SABOTAGE.value },
    ],
    hint(v, me) {
      const stop = onMain(v, me);
      if (stop) return stop;
      if (unsaved(v, 'main')) return H('Your parts are in the draft. Save them first.', SAVE);
      if (!v.gotSabotage()) return H("The Intern's card is on the Wall, but not in your lab yet.", GET);
      if (!v.mainHasSabotage()) {
        return v.did('refused')
          ? H(`The Wall still has the ${DISGUISE} card. Your safety diary shows where your note was. Then get the Wall's cards.`, 'Open the **Safety diary**. Then press **Get & combine**.')
          : H(`Your main no longer has the ${DISGUISE} card, but the Wall does. Predict, then try sending.`, SEND);
      }
      // Still showing the card, or its fix came from another lab (Get & combine): this lab undoes it once itself.
      const showing = v.card('main')[SABOTAGE.part] === SABOTAGE.value;
      if (showing || !v.undidSabotage()) {
        if (showing && !v.did('reset')) {
          return H(`Everyone has the ${DISGUISE} card. Two ways: add a card that reverses it, or move your note back to before it. Which is safe when others have the card?`, CHOOSE_UNDO);
        }
        return H(`The ${DISGUISE} card is still in main's history. Add a card that reverses it.`, UNDO);
      }
      return syncWall(v, H("The Wall has cards your main doesn't. Get them, then send again.", AGAIN.merge));
    },
    bonus: 'Open the Safety diary. Find every place main has been.',
    behind: {
      text: '`git revert` adds a card that undoes the old one. `git reset` moves your note back. Safe only if nobody else has the card. `git reflog main` lists every place main has been.',
      cmds: ['git revert', 'git reset --hard', 'git reflog main'],
    },
  },
  {
    id: 'rewrite',
    title: 'The boss wants it clean',
    instruction: `Press nothing; watch the Wall. Then find the first ${BOOTS} card in your lab's cards. Who made it?`,
    bossInstruction: 'The boss wants one clean card. Press **Get & combine**. Then **Replace the Wall with one card**.',
    screen: '{boss} replaces the Wall with one clean card. Everyone else: watch.',
    unlocks: ['squash'],
    tips: [{ action: 'squash', text: "New: replace the Wall's whole history with one card." }],
    goals: (v) => [{ text: 'The Wall has one clean card', done: v.wallIsClean() }],
    hint(v, me) {
      if (!v.isBoss) return v.wallIsClean() ? null : H('Press nothing. Watch the Wall.');
      const stop = onMain(v, me);
      if (stop) return stop;
      if (unsaved(v, 'main')) return H('Your parts are in the draft. Save them first.', SAVE);
      if (['behind', 'diverged'].includes(v.wall())) return H("The Wall has cards your main doesn't. Get them first, so the clean card keeps everyone's work.", GET);
      return H('A card never changes. One clean card means a new card after Start, and the Wall forced onto it.', 'Press **Replace the Wall with one card**.');
    },
    bonus: `Who made the first ${BOOTS} card? Ask another lab what they found.`,
    behind: {
      text: 'Squash (many cards into one) writes a new card with a new ID. `git push --force` points the Wall at it. `git gc --prune=now` deletes the cards no note leads to (plain `git gc` keeps them two weeks). The Wall no longer knows who did what.',
      cmds: ['git push --force', 'git gc --prune=now'],
    },
  },
  {
    id: 'wrap',
    title: 'What you built',
    instruction: WRAP_LINE,
    screen: WRAP_LINE,
    unlocks: [],
    tips: [],
    goals: () => [],
    hint: () => null,
    behind: null,
  },
];

// Action → the step that unlocks it. 'pair' is the Step 2 pair toggle; 'wall' opens the Wall's cards.
export const UNLOCK = Object.fromEntries(STEPS.flatMap((s, n) => s.unlocks.map((a) => [a, n])));

// Concept tracker: id, admin chip label (null = counted, no chip), the step that introduces it.
export const CONCEPTS = [
  { id: 'save', label: 'Save', step: 1 },
  { id: 'inspect', label: null, step: 1 },
  { id: 'branch', label: 'Branch', step: 2 },
  { id: 'switch', label: null, step: 2 },
  { id: 'fastforward', label: 'Fast-forward', step: 3 },
  { id: 'merge', label: 'Merge', step: 3 },
  { id: 'conflict', label: 'Conflict solved', step: 3 },
  { id: 'push', label: 'Push', step: 4 },
  { id: 'rejected', label: 'Refused push', step: 4 },
  { id: 'pull', label: 'Pull', step: 4 },
  { id: 'rebase', label: 'Rebase', step: 4 },
  { id: 'revert', label: 'Revert', step: 5 },
  { id: 'reset', label: 'Reset', step: 5 },
  { id: 'diary', label: 'Diary', step: 5 },
  { id: 'force', label: 'Force push', step: 6 },
];

// Who does what in a step.
//   Step 2: solo = nobody else in my pair is online; both = nobody else in my lab is online.
//   Step 3: fancyMerged = main has fancy's card; fancyLeft = the fancy note still exists.
//   Step 4: way = the way the lab chose ('merge' | 'rebase'), or null; refused = its send was refused in this step.
//   Step 5: got = the lab has the Intern's card; undo = the lab's first undo this step ('revert' | 'reset'), or null;
//   refused = its send was refused in this step.
//   done = the lab's goals all tick: Step 4 then drops the way, Step 5 the whole mission.
export function missionFor(step, labId, pair, {
  solo = false, both = false, fancyMerged = false, fancyLeft = false, way = null, done = false, got = true, undo = null, refused = false,
} = {}) {
  const s = STEPS[step];
  if (step === 2) return s.mission[both ? 'both' : solo ? `solo${pair}` : pair];
  if (step === 3) return fancyMerged && fancyLeft ? s.mission.deleteFancy : null;
  if (step === 4) {
    const c = LAB_CHANGES[labId];
    const after = done ? null : way ? s.mission[way] : refused ? s.mission.choose : null;
    return c ? [`${change(c.part, c.value)}. Change nothing else.`, after].filter(Boolean).join(' ') : null;
  }
  if (step === 5) {
    if (done) return null;
    if (!got) return s.mission.get;
    if (undo === 'reset') return s.mission[refused ? 'refused' : 'movedBack'];
    return s.mission[undo === 'revert' ? 'undone' : 'choose'];
  }
  return null;
}

// ---------- The paper (only facts from lesson/tuesday_paper_notes.md) ----------

export const PAPER = {
  title: 'Switching to Git: the Good, the Bad, and the Ugly',
  source: 'Just, Herzig, Czerwonka, Murphy · ISSRE 2016',
  good: ['Cheap branches.', 'Local commits and reverts.', 'Developers prefer a flat history.'],
  bad: ['Fast-forward forgets which branch a change came from.', 'Rebase rewrites the commit; the patch can change too.', 'Squash can drop the cards — and, once the branch is deleted, even who made them.'],
  ugly: [
    "Microsoft traces each change's route to main: its integration path.",
    'For Git, that tracing had to be redesigned from scratch.',
    'Some loss cannot be recovered.',
  ],
  // The paper's claim is for analysts (§3.1); the same paragraph gives developers' side.
  message: 'For analysts, flat history is data loss.',
  tradeoff: 'Flat history helps developers find and revert a bad change (bisect, revert). It loses where a change came from and who made it.',
  // What they lived, linked to the paper. none: Step 4's line when no lab replayed on top.
  lived: [
    { step: 3, text: 'Step 3: after the fast-forward, you deleted fancy. No card says which cards were made on it.' },
    {
      step: 4,
      text: 'Step 4: Replay on top made a copy with a new ID; the original card is not on the Wall.',
      none: 'Step 4: no lab replayed. Replay on top makes a copy with a new ID; the original stays off the Wall.',
    },
    { step: 6, text: 'Step 6: the squash dropped the cards, and who made them.' },
    { step: 6, text: `Step 6: the ${BOOTS} audit failed. The Wall no longer knows who added the boots.` },
  ],
};

// ---------- The scene script: one Next = one scene ----------

const task = (step, minutes, more) => ({
  id: `task-${step}`, kind: 'task', step, minutes, title: `Step ${step} · ${STEPS[step].title}`, ask: null, tools: [], ...more,
});
const reveal = (step, minutes, more) => ({
  id: `reveal-${step}`, kind: 'reveal', step, minutes, title: `Step ${step} · How Git does it`, tools: [], ...more,
});

const SCRIPT = [
  {
    id: 'join', kind: 'join', step: 0, minutes: 3, title: 'Join', tools: [],
    line: 'Open the link and type your name. The app picks your lab.',
    say: "No Git lecture today. You'll hit seven problems, and your lab invents a fix for each. Every save, merge, send and undo runs real Git.",
    do: 'Wait until the count matches the room. The app balances the labs. Labs lock at Step 1.',
    ask: null,
  },
  task(0, 1.5, {
    say: 'Your lab shares one outfit. Change any part, any time. Go.',
    do: 'After 90 seconds, say "Hands off." Then ask.',
    ask: { q: 'What did your outfit look like a minute ago? Who changed the shoes?', a: 'No idea. Nothing was saved.' },
  }),
  reveal(0, 2, {
    title: 'Step 0 · What would fix it?',
    reveal: { sentence: 'Nothing was saved. Nobody knows who changed what.', behind: 'No Git yet. Git saves every version, with who made it.' },
    say: "Today you'll explain how Git saves, splits, combines and shares work. Before Git acts, you'll predict what it does, and you'll choose your own undo.",
    do: 'Take one or two answers, then Next.',
    ask: { q: 'What rule would fix this?', a: 'Save every version, with a name on it.' },
    board: '0. Save every version, with a name on it.',
  }),
  task(1, 3, {
    say: 'From now on, every save makes a card.',
    do: 'Ask, take one answer, then say "Go."',
    ask: { q: 'What should each saved version hold?', a: 'The whole outfit, who saved it, and the version it came from.' },
  }),
  reveal(1, 2.5, {
    reveal: { cards: [CARDS.commit], note: TRUST_LINE },
    say: '`git commit` stores the whole outfit, the card before, your name, the time and a message. The ID is computed from all of it, so any change makes a new card. The name and the time are whatever your laptop says.',
    ask: { q: 'Why do arrows point back, never forward?', a: "The next card doesn't exist yet. Cards never change." },
    board: '1. Card (commit): a full snapshot + its parent. Never changes.',
  }),
  task(2, 4, {
    say: 'The client wants two ideas tried at once. In one draft, you overwrite each other, like Step 0.',
    do: 'Ask first. Both missions change TOP on purpose. Don\'t tell them.',
    ask: { q: 'Cards never change. How does each half of your lab find its own newest card?', a: 'Each idea puts its own sticky note on its newest card.' },
  }),
  reveal(2, 3, {
    reveal: { cards: [CARDS.branch], note: ONE_REPO_LINE },
    say: "A branch is a tiny file holding one card's ID. Your pin (HEAD) says which note you're on. Saving moves only that note.",
    do: 'Read the line under the card once: it is the app\'s one simplification. Switch refuses unsaved parts, as Git does with one working copy.',
    ask: { q: 'Where is the original outfit now? Did anything get copied?', a: "Still on main's card. Nothing was copied." },
    board: '2. Sticky note (branch): a label on one card. Saving moves it.',
  }),
  task(3, 8, {
    say: 'The client wants one outfit with both ideas. One person presses, everyone watches. Before Merge runs, the app asks what Git will do. Everyone in your lab can predict.',
    do: 'Ask first. A lab says "take the newest"? Ask: "Whose work did you throw away?" Watch the console\'s prediction line.',
    ask: { q: 'HAT differs on the two newest cards. Which side changed it?', a: "Two cards can't tell you. Compare with the card where you split." },
  }),
  reveal(3, 4, {
    reveal: { cards: [CARDS.merge] },
    say: 'The first merge only slid the note: a fast-forward, no new card. Then Git compared each side with the card where you split. Only TOP changed on both sides, so only TOP needed you.',
    do: 'Read the prediction line aloud: who expected the fast-forward, who expected TOP? If asked: main\'s own safety diary still says "merge fancy: Fast-forward". It is local, it expires, and it never reaches the Wall.',
    ask: { q: 'Which cards were made on fancy?', a: 'No way to tell. Git does not record the branch a commit was made on.' },
    board: '3. Merge: compare both sides with the card they share.',
  }),
  {
    id: 'break', kind: 'break', step: 3, minutes: 4, title: 'Break', tools: ['timer'],
    line: 'Break. Back in 4 minutes.',
    next: 'Starts the 4-minute break. Labs can still finish Step 3.',
    say: 'Break. Back in 4 minutes.',
    do: 'Write the return time on the board. Help any lab that is not done.',
    ask: null,
  },
  task(4, 9, {
    next: "Sends {wallLab}'s outfit to the Wall. Every lab becomes a fresh copy of it. Back does not undo this.",
    practiceNext: 'The practice lab sends its card to the Wall first.',
    say: "The Wall is the class's shared copy, like GitHub. Your lab already has a full copy of it (that is git clone). It starts as {wallLab}'s outfit. Put your outfit on the Wall. Before each send, predict: will the Wall accept it?",
    do: "Don't ask first: students hit the refusal themselves. A refused lab chooses Combine (merge) or Replay on top (rebase), and may say why in one line. The app assigns nothing.",
  }),
  reveal(4, 5, {
    reveal: { cards: [CARDS.push, CARDS.rebase] },
    say: "The Wall only moves forward, so a refused lab gets the Wall's cards first. Combine makes a merge card with two parents (Step 3 made one too). Replay on top makes a straight line: a copy of the card with the same change, author and author time, but a new parent, snapshot, committer time and ID.",
    do: "Read the prediction line and each lab's choice. If a way was not chosen, read the line that says what it would have done. Point at the marked path: when the card was made, and when it reached the Wall. These are this class's times.",
    ask: { q: 'The replayed card has the same change, author and author time. Why does it have a new ID?', a: "Its parent is new, so its snapshot is too: it now includes the Wall's change. Its committer time is new. The ID is a hash of all of it." },
    board: '4. The Wall only moves forward. Behind? Combine (merge), or replay on top (rebase: new IDs).',
    tools: ['sabotage'],
  }),
  task(5, 7, {
    next: `Puts the Intern's ${DISGUISE} card on the Wall, if you haven't yet. Each lab with nothing unsent gets it (a fast-forward).`,
    say: 'The Intern pushed a "tiny style fix" to the Wall. Your lab has it too.',
    do: 'Ask first. Sort the answers into "go back to before it" and "add a card that removes it". Say: "Your lab picks one. Predict before you send."',
    ask: { q: 'How do you get rid of it?', a: 'Go back to before it, or save a new card that removes it.' },
    tools: ['sabotage'],
  }),
  reveal(5, 3, {
    reveal: { cards: [CARDS.undo] },
    say: '`git revert` adds a card that undoes the old one, so it sends like any card. `git reset` moves your note back, but the Wall still has the card.',
    do: 'Read which labs moved back and which added a fix card. If no lab moved back, read the line that says what would have happened.',
    ask: { q: 'Why is adding a fix card safe, but moving back is not?', a: 'A fix card only adds. Moving back drops a shared card.' },
    board: '5. Shared mistake: add a fix card (revert). Move back (reset) only if nobody has the card.',
  }),
  task(6, 4, {
    next: `Asks the Wall who added the ${BOOTS} boots. Only {boss} can replace the Wall.`,
    say: 'Who gave our outfit boots? The Wall knows. Now, as the boss: "This history is a mess. I want one clean card."',
    do: 'Read the audit name aloud. Then ask.',
    ask: { q: 'Cards never change. How do you give me one clean card?', a: 'Make one new card after Start. Force the Wall onto it.' },
    tools: ['audit'],
  }),
  reveal(6, 4, {
    next: "Finishes {boss}'s clean-up if needed. Then asks the Wall about the boots again.",
    reveal: { cards: [CARDS.squash] },
    say: "The Wall no longer knows who added the boots. The other labs still do. The old cards wait in the Wall's bin.",
    do: "Press Empty the Wall's bin. Read the count aloud.",
    ask: { q: 'Who added the boots? Where does that answer still exist?', a: 'Not on the Wall. Only in the labs that kept the old cards.' },
    board: '6. Rewrite (squash, rebase): new cards. Force push + gc: the Wall loses the old ones.',
    tools: ['audit', 'gc'],
  }),
  {
    id: 'paper', kind: 'paper', step: 6, minutes: 5, title: 'The paper', tools: [],
    line: PAPER.message,
    say: 'You just lived this paper. Teams at Microsoft moved to Git. Microsoft tracks code velocity: how long a change takes to reach main, along its integration path. After the squash, the Wall has no path left. The paper: for analysts, flat history is data loss. For developers it helps: a bad change is quick to find and revert.',
    do: 'Pairs, 2 minutes. One answer per pair in the app. Then show two.',
    ask: {
      q: 'Your team squash-merges every feature branch and deletes it. What do you gain, and what can an auditor no longer answer?',
      a: 'Gain: one revertable card per feature, easy bisect. Lose: who wrote which part and when, once the branch is deleted.',
    },
  },
  {
    id: 'exit', kind: 'exit', step: 6, minutes: 3, title: 'Exit question', tools: [],
    line: 'On your own: two sentences in the app.',
    say: 'On your own. Two sentences, in the app.',
    do: 'After a minute, show the answers. Read two aloud. Then give the answer.',
    ask: {
      q: 'A password reached the Wall. Two labs pulled. Does Undo this card (revert) remove it? If not, what would?',
      a: 'No. Revert adds a card; the old one still holds the password, in every copy. Change the password first. Then rewrite, force push and gc the Wall, and have every lab re-clone. (On GitHub, force-pushed commits can stay fetchable by ID.)',
    },
  },
  {
    id: 'wrap', kind: 'wrap', step: 7, minutes: 2, title: 'What you built', tools: ['export'],
    line: WRAP_LINE,
    say: "Cards never change. Sticky notes move. The Wall copies cards. That's Git. Homework: Yang et al., Sections 3.2 to 3.5. For one finding, write down what they measured.",
    do: "Read one lab's counts aloud. Point at the takeaway wall.",
    ask: null,
  },
];

// Students answer the pause question in the app at reveals, the paper and the exit question.
const ANSWERED = new Set(['reveal', 'paper', 'exit']);

// The planned start of each scene, in minutes from the start of class. Every reveal has the same shape.
export const SCENES = SCRIPT.reduce((out, scene) => {
  const prev = out.at(-1);
  const answerable = ANSWERED.has(scene.kind) && !!scene.ask;
  // A takeaway after each step's reveal, Steps 0–6: "My Git in 7 lines".
  const takeawayStep = scene.kind === 'reveal' ? scene.step : null;
  const shaped = scene.reveal ? { reveal: { cards: [], sentence: null, behind: null, note: null, ...scene.reveal } } : {};
  return [...out, { ...scene, ...shaped, answerable, takeawayStep, at: prev ? prev.at + prev.minutes : 0 }];
}, []);

export const TAKEAWAY_STEPS = SCENES.filter((s) => s.takeawayStep !== null).map((s) => s.takeawayStep);
export const ANSWER_MAX = 280;
export const TAKEAWAY_MAX = 100;

// Steps whose actions are predicted, and whose reveals show the class's accuracy.
export const PREDICT_STEPS = [3, 4, 5];
