// Step copy, missions, goals and the plan clock. Wording follows the lesson script
// (lesson/tuesday.md, lesson/app_copy_proposals.md): every step is Problem → Idea → Git.
//
// Per step:
//   instruction, mission, unlocks, goals(view), bonus  — the student's mission panel
//   check  — the pause question ("We'll ask:"; the projector shows it while Ask is on)
//   hope   — what we hope to hear back (teachers only)
//   behind — Behind the door: {problem, idea, text (how Git does it), cmds ("You'd type")}
//   askFirst — the idea question to ask before pressing Next into this step (teachers only)
//   next   — what pressing Next into this step does (teachers only)
//   facilitator — what to watch for, the board line, then "If behind:" (teachers only)
//   minutes (work time) and at (planned start, minutes from the start of class)
// goals(view) read a small lab view built by session.js (labView there).

export const FIXED_LINE = 'One person presses, everyone watches. Swap each step.';

export const PAIR_NOTES = { A: 'cat-robot', B: 'superhero' };

export const PAIR_PARTS = {
  'cat-robot': { face: 'cat', body: 'robot' },
  superhero: { body: 'superhero', legs: 'tentacles' },
};

// Step 5: each lab changes one part of the same Step 4 card.
export const LAB_CHANGES = {
  1: { part: 'face', value: 'dragon', text: 'FACE → 🐲' },
  2: { part: 'legs', value: 'skates', text: 'LEGS → 🛼' },
  3: { part: 'body', value: 'cactus', text: 'BODY → 🌵' },
  4: { part: 'face', value: 'alien', text: 'FACE → 👽' },
  5: { part: 'legs', value: 'rocket', text: 'LEGS → 🚀' },
  6: { part: 'body', value: 'pumpkin', text: 'BODY → 🎃' },
};

export const WRAP_LINE = "Cards never change. Sticky notes move. The Wall copies cards. That's Git.";

export const STEPS = [
  {
    id: 'chaos',
    title: 'Everyone, one monster',
    instruction: 'Your lab shares one monster. Change any part, any time. Go!',
    unlocks: ['chaos'],
    goals: () => [],
    check: 'What did your monster look like a minute ago? Who changed the legs?',
    hope: 'No idea. Nothing was saved.',
    behind: {
      problem: 'Nothing is saved. Nobody knows who did what.',
      idea: 'Save every version, with a name on it.',
      text: 'None yet. This is life without it.',
      cmds: [],
    },
    askFirst: null,
    next: null,
    facilitator: 'After 90 seconds, say "Hands off." Then **Ask**.',
    minutes: 1.5, at: 3,
  },
  {
    id: 'commit',
    title: 'Save every version',
    instruction: 'The old monster is gone for good. From now on, every save makes a card. Change one part, then press **Save card**. Take turns. Everyone saves at least once.',
    unlocks: ['draft', 'commit', 'inspect'],
    goals: (v) => {
      const { saved, online } = v.savers();
      return [{ text: `Everyone saved a card (${saved}/${online})`, done: online > 0 && saved === online }];
    },
    bonus: 'Click the oldest card. Who made it? What is its parent?',
    check: 'Why do arrows point back, never forward?',
    hope: "The next card doesn't exist yet. Cards never change.",
    behind: {
      problem: "You couldn't get an old monster back.",
      idea: 'Save the whole monster, your name, and the card before.',
      text: '`git commit` stores exactly that. The ID is computed from all of it. So a card never changes.',
      cmds: ['git commit', 'git log'],
    },
    askFirst: 'What should each saved version hold?',
    next: 'Adds Save card. Every lab starts from the Start card.',
    facilitator: 'Watch for: anyone who hasn\'t saved yet. Pause: first ask "Which card came 3 saves ago, and who made it?" Board: "1. Card (commit): a full snapshot + its parent. Never changes." If behind: skip "3 saves ago".',
    minutes: 3, at: 8,
  },
  {
    id: 'branch',
    title: 'Try two ideas at once',
    instruction: 'Try two ideas without losing main. Each pair makes its own sticky note. Build your idea on it and save.',
    unlocks: ['branch', 'switch', 'pair'],
    mission: {
      A: 'Press **New sticky note**, name it **cat-robot** (partner: **Switch to** cat-robot). FACE → 🐱, BODY → 🤖. **Save card**.',
      B: 'Press **New sticky note**, name it **superhero** (partner: **Switch to** superhero). BODY → 🦸, LEGS → 🐙. **Save card**.',
    },
    goals: (v) => [
      { text: 'cat-robot has 🐱 + 🤖', done: v.noteHas('cat-robot', PAIR_PARTS['cat-robot']) },
      { text: 'superhero has 🦸 + 🐙', done: v.noteHas('superhero', PAIR_PARTS.superhero) },
    ],
    check: 'Where is the original monster now? Did anything get copied?',
    hope: "Still on main's card. Nothing was copied.",
    behind: {
      problem: 'Two ideas in one draft overwrite each other.',
      idea: 'Each idea gets its own sticky note. Saving moves only that note.',
      text: "A branch is a tiny file holding one card's ID. Making one copies nothing. Your pin (HEAD) shows which note you're on.",
      cmds: ['git switch -c', 'git switch'],
    },
    askFirst: 'Half your lab tries one idea, half another. Same draft. What goes wrong?',
    next: 'Adds sticky notes. Unsaved parts on main are dropped.',
    facilitator: 'Watch for: both missions change BODY on purpose. Don\'t tell them. Board: "2. Sticky note (branch): a label on one card. Saving moves it." If behind: when time is up, Rescue the unfinished labs.',
    minutes: 3, at: 15,
  },
  {
    id: 'merge',
    title: 'Make one monster from both',
    instruction: 'The client wants one monster with both ideas. On **main**: merge **cat-robot**. Then merge **superhero**.',
    unlocks: ['merge', 'resolve', 'abort'],
    goals: (v) => [
      { text: 'main has cat-robot', done: v.mainHas('cat-robot') },
      { text: 'main has superhero (merge card)', done: v.mainHas('superhero') && v.mainHasMergeCard() },
    ],
    bonus: 'Open the merge card. Why two parents?',
    check: 'Why did the first merge only move the note? Why did BODY need you?',
    hope: 'Main had nothing new, so its note slid. Only BODY changed on both sides.',
    behind: {
      problem: "Two newest cards can't tell you who changed what.",
      idea: 'Compare each part with the card where you split.',
      text: '`git merge` finds that card. Changed on one side: keep it. Changed on both: conflict, you pick.',
      cmds: ['git merge'],
    },
    askFirst: 'FACE differs on the two newest cards. Which side changed it?',
    next: 'Adds merging.',
    facilitator: 'Watch for: a lab says "take the newest". Ask: "Whose work did you throw away?" Board: "3. Merge: compare both sides with the card they share." Then press **Break** (4 minutes). Stay on Step 3. Rescue any lab without a merge card.',
    minutes: 5, at: 22,
  },
  {
    id: 'remote',
    title: 'Meet the Wall',
    instruction: "Each lab's cards lived only in that lab. The Wall is the class's shared copy, like GitHub. Your lab's cards are now a full copy of it ({wallLab}'s monster). Compare your newest card's ID with the Wall's.",
    unlocks: ['wall'],
    goals: () => [],
    check: 'Only one lab made that card. Why is the ID the same everywhere?',
    hope: 'The ID is computed from the card. Same card, same ID.',
    behind: {
      problem: "Each lab's cards lived only in that lab.",
      idea: 'One shared copy. Every lab keeps a full copy of it.',
      text: '`git clone` copies every card. Same card, same ID, on every laptop. Blue `wall/main` = the Wall, when you last checked.',
      cmds: ['git clone'],
    },
    askFirst: 'How do labs share, without one lab holding the only copy?',
    next: "Sends the picked lab's main to the Wall. Every lab becomes a copy of it.",
    facilitator: 'Say: "Your counts are kept for the wrap." Watch for: every lab reads out the same ID. Board: "4. The Wall (remote): a full copy. Same card, same ID everywhere." If behind: say it in 30 seconds.',
    minutes: 2, at: 36,
  },
  {
    id: 'push',
    title: 'Put your monster on the Wall',
    instruction: "Make your lab's change, **Save card**, then **Send to Wall**. Refused? Press **Get & combine**, then send again.",
    unlocks: ['push', 'pull'],
    goals: (v) => {
      const change = LAB_CHANGES[v.labId];
      return [
        { text: "Your lab's change is on the Wall", done: !!change && v.wallHasPart(change.part, change.value) },
        { text: "Your lab's cards match the Wall", done: v.matchesWall() },
      ];
    },
    check: 'Why did the Wall refuse your card instead of adding it?',
    hope: "It would drop the first lab's card. The Wall only moves forward.",
    behind: {
      problem: 'The Wall refused your card.',
      idea: 'The Wall never drops a card. Combine its new cards first.',
      text: '`git push` only moves the Wall forward. `git pull` = `git fetch` + `git merge`.',
      cmds: ['git push', 'git pull'],
    },
    askFirst: null,
    next: 'Adds Send to Wall and Get & combine. Students hit the problem first.',
    facilitator: 'Watch for: the first lab gets in. The others are refused, then combine with no red. "Refused twice"? Check they pressed Get & combine. Board: "5. Send (push) only moves the Wall forward. Behind? Get & combine (pull) first."',
    minutes: 5, at: 42,
  },
  {
    id: 'undo',
    title: 'Oops: undo a shared mistake',
    instruction: "A mustache card reached the Wall. Every lab has a copy. Remove it without breaking anyone's copy.",
    unlocks: ['revert', 'reset', 'reflog'],
    mission: {
      odd: 'Press **Get & combine**. Click the mustache card, press **Undo this card**, then **Send to Wall**.',
      even: 'Press **Get & combine**. Click the card before the mustache, press **Move my note back here**, then **Send to Wall**. What happens? Refused? Open the **Safety diary**.',
    },
    goals: (v) => [
      { text: 'You got the mustache card', done: v.gotSabotage() },
      { text: "Your lab's cards match the Wall, with no mustache", done: v.matchesWall() && v.wallMonster()?.face !== 'mustache' },
    ],
    bonus: 'Open the Safety diary. Find every place main has been.',
    check: 'Why is adding a fix card safe, but moving back is not?',
    hope: 'A fix card only adds. Moving back drops a shared card.',
    behind: {
      problem: 'A bad card is on the Wall, and every lab has it.',
      idea: "Don't rip out a shared card. Add a card that undoes it.",
      text: '`git revert` adds that card. `git reset` moves your note back. Safe only if nobody has the card. `git reflog` lists every place your note has been.',
      cmds: ['git revert', 'git reset --hard', 'git reflog'],
    },
    askFirst: 'After Sabotage and Get & combine: "How do you get rid of it?"',
    next: "Adds Undo, Move back and the Safety diary. Press Sabotage first, on Step 5. If you didn't, Next does.",
    facilitator: 'Watch for: the even labs are refused. That is the lesson. Then the Safety diary, then Get & combine brings 🥸 back. Board: "6. Shared mistake: add a fix card (revert). Move back (reset) only if nobody has the card." If behind: skip the even labs\' move back. Show it yourself from the admin laptop.',
    minutes: 4, at: 51,
  },
  {
    id: 'rewrite',
    title: 'The boss wants it clean',
    instruction: "Watch the Wall. Who added the tentacles? Find out in your lab's cards.",
    bossInstruction: 'The boss wants one clean card. Press **Get & combine**. Then **Replace the Wall with one card**.',
    unlocks: ['squash'],
    goals: (v) => [{ text: 'The Wall has one clean card', done: v.wallIsClean() }],
    bonus: 'Ask another lab who added the tentacles.',
    check: 'Who added the tentacles? Where does that answer still exist?',
    hope: "Not on the Wall. Only on the labs' laptops.",
    behind: {
      problem: 'The boss wants one clean card. Cards never change.',
      idea: 'Make one new card after Start. Force the Wall onto it.',
      text: 'Squash writes a new card with a new ID. `git push --force` points the Wall at it. `git gc` deletes the old cards. Who did what is gone.',
      cmds: ['git push --force', 'git gc'],
    },
    askFirst: 'Cards never change. How do you give me one clean card?',
    next: "Only the boss lab can replace the Wall. The other labs' sends pause.",
    facilitator: 'In order: **Audit** → the boss lab replaces the Wall → **Audit** → **Empty the Wall\'s bin**. Point out: every lab still has the old cards. Board: "7. Rewrite (squash, rebase): new cards. Force push + gc: the old ones are gone." Then the paper and the exit question.',
    minutes: 2, at: 60,
  },
  {
    id: 'wrap',
    title: 'What you built',
    instruction: WRAP_LINE,
    unlocks: [],
    goals: () => [],
    check: null,
    hope: null,
    behind: null,
    askFirst: null,
    next: "Shows the wrap line and each lab's counts.",
    facilitator: "Read one lab's counts aloud. Point at the seven board lines. Then the homework.",
    minutes: 2, at: 75,
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
  { id: 'push', label: 'Push', step: 5 },
  { id: 'rejected', label: 'Refused push', step: 5 },
  { id: 'pull', label: 'Pull', step: 5 },
  { id: 'revert', label: 'Revert', step: 6 },
  { id: 'reset', label: 'Reset', step: 6 },
  { id: 'diary', label: 'Diary', step: 6 },
  { id: 'force', label: 'Force push', step: 7 },
];

export function missionFor(step, labId, pair) {
  const s = STEPS[step];
  if (step === 2) return s.mission[pair];
  if (step === 5) return LAB_CHANGES[labId]?.text ?? null;
  if (step === 6) return s.mission[labId % 2 ? 'odd' : 'even'];
  return null;
}
