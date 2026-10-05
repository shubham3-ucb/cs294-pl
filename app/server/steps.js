// Step copy, missions, goals and the plan clock. Wording follows the lesson script
// (lesson/tuesday.md): every step is Problem → Idea → Git.
//
// Per step:
//   instruction, mission, unlocks, goals(view), bonus  — the student's mission panel
//   bossInstruction, screenInstruction — Step 7's line for the boss lab, and for the projector
//   check  — the pause question ("We'll ask:"; the projector shows it while Ask is on)
//   hope   — what we hope to hear back (teachers only)
//   behind — {problem, idea (teachers only), text (how Git does it), cmds}; students see text + cmds
//   mainLocked — while set, main changes only by merging; clicking a part on main says this
//   paper  — one quiet line tying the step to Tuesday's paper (teachers only)
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
      text: null, // no Git yet: students see no Behind the door
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
    instruction: 'The chaos monster is gone. From now on, every save makes a card. One at a time: change one part, then press **Save card**. Everyone saves at least once.',
    unlocks: ['draft', 'commit', 'inspect'],
    goals: (v) => {
      const { saved, online } = v.savers();
      return [{ text: `Everyone saved a card (${saved}/${online})`, done: online > 0 && saved === online }];
    },
    bonus: 'Click any card. Press **Show what Git stored**. Find the parent, the author and the message.',
    check: 'Why do arrows point back, never forward?',
    hope: "The next card doesn't exist yet. Cards never change.",
    behind: {
      problem: "You couldn't get an old monster back.",
      idea: 'Save the whole monster, your name, and the card before.',
      text: '`git commit` saves the monster, the card before, your name and time. Its ID is computed from all of it. Change anything, and you get a new card.',
      cmds: ['git commit', 'git log'],
    },
    paper: "Git takes your name and your laptop's clock on trust. The paper found 99k+ wrong timestamps in 9 projects.",
    askFirst: 'What should each saved version hold?',
    next: 'Adds Save card. Every lab starts from the Start card.',
    facilitator: 'Watch for: anyone who hasn\'t saved yet. Pause: first ask "Which card came 3 saves ago, and who made it?" Board: "1. Card (commit): a full snapshot + its parent. Never changes." If behind: skip "3 saves ago".',
    minutes: 3, at: 8,
  },
  {
    id: 'branch',
    title: 'Try two ideas at once',
    instruction: 'Your lab already has one sticky note: main. Each pair makes its own note for its idea. Build on it and save.',
    unlocks: ['branch', 'switch', 'pair'],
    mainLocked: 'main keeps the monster you have. Make or switch to a sticky note to edit.',
    // A pair of one (a lab of 3 has one) gets the solo mission, so nobody waits for a partner.
    mission: {
      A: 'One of you: press **New sticky note**, keep the name **cat-robot**. The other: wait for it, then **Switch to** **cat-robot**. Then FACE → 🐱, BODY → 🤖. **Save card**.',
      B: 'One of you: press **New sticky note**, keep the name **superhero**. The other: wait for it, then **Switch to** **superhero**. Then BODY → 🦸, LEGS → 🐙. **Save card**.',
      soloA: 'Press **New sticky note**, keep the name **cat-robot**. Then FACE → 🐱, BODY → 🤖. **Save card**.',
      soloB: 'Press **New sticky note**, keep the name **superhero**. Then BODY → 🦸, LEGS → 🐙. **Save card**.',
    },
    goals: (v) => [
      { text: 'cat-robot has 🐱 + 🤖', done: v.noteHas('cat-robot', PAIR_PARTS['cat-robot']) },
      { text: 'superhero has 🦸 + 🐙', done: v.noteHas('superhero', PAIR_PARTS.superhero) },
    ],
    bonus: "**Switch to** main and back. Watch the draft change. Look, don't edit.",
    check: 'Where is the original monster now? Did anything get copied?',
    hope: "Still on main's card. Nothing was copied.",
    behind: {
      problem: 'Two ideas in one draft overwrite each other.',
      idea: 'Each idea gets its own sticky note. Saving moves only that note.',
      text: "A sticky note (branch) is a tiny file holding one card's ID. Making one copies nothing. Your pin (HEAD) shows which note you're on.",
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
    mainLocked: 'In this step, main changes only by merging.',
    goals: (v) => [
      { text: 'main has cat-robot', done: v.mainHas('cat-robot') },
      { text: 'main has superhero (merge card)', done: v.mainHas('superhero') && v.mainHasMergeCard() },
    ],
    bonus: 'Open the merge card. Why two parents?',
    check: 'Why did FACE and LEGS combine alone, but BODY needed you?',
    hope: 'Compared with the split card, only BODY changed on both sides.',
    behind: {
      problem: "Two newest cards can't tell you who changed what.",
      idea: 'Compare each part with the card where you split.',
      text: '`git merge` finds the card where you split. Changed on one side: keep it. Changed on both, differently: a conflict, you pick.',
      cmds: ['git merge'],
    },
    paper: 'No merge card says these cards came from cat-robot. The paper: fast-forward forgets the branch.',
    askFirst: 'FACE differs on the two newest cards. Which side changed it?',
    next: 'Adds merging.',
    facilitator: 'Watch for: a lab says "take the newest". Ask: "Whose work did you throw away?" Pause: first ask "Why did the first merge only move the note?" Board: "3. Merge: compare both sides with the card they share." Then press **Break** (4 minutes). Stay on Step 3. Rescue any lab without a merge card.',
    minutes: 5, at: 22,
  },
  {
    id: 'remote',
    title: 'Meet the Wall',
    instruction: "The Wall is the class's shared copy, like GitHub. It got {wallCards}. Is your newest card's ID the same as the Wall's?",
    unlocks: ['wall'],
    mainLocked: 'Look only in this step. You change main in Step 5.',
    goals: () => [],
    check: 'Two labs never made that card. Why does their copy have the same ID?',
    hope: 'The ID is computed from the card. Same card, same ID.',
    behind: {
      problem: "Each lab's cards lived only in that lab.",
      idea: 'One shared copy. Every lab keeps a full copy of it.',
      text: '`git clone` copies every card. Same card, same ID, on every laptop. Blue `wall/main` = the Wall, last time you checked.',
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
        // Ticks only once the change is in: at the step's start every lab already matches the Wall.
        { text: "Your lab's cards match the Wall (Get & combine)", done: !!change && v.wallHasPart(change.part, change.value) && v.matchesWall() },
      ];
    },
    check: 'Why did the Wall refuse your card instead of adding it?',
    hope: "It would drop the first lab's card. The Wall only moves forward.",
    behind: {
      problem: 'The Wall refused your card.',
      idea: 'The Wall never drops a card. Combine its new cards first.',
      text: "`git push` is refused unless you already have the Wall's newest card. `git pull` = `git fetch` + `git merge`.",
      cmds: ['git push', 'git pull'],
    },
    paper: "Each card's trip to the Wall is an integration path. How long the trip took is code velocity. Microsoft had to rebuild that metric for Git.",
    askFirst: null,
    next: 'Adds Send to Wall and Get & combine. Students hit the problem first.',
    facilitator: 'Watch for: the first lab gets in. The others are refused, then combine with no red. "Refused twice"? Check they pressed Get & combine. Board: "5. Send (push) only moves the Wall forward. Behind? Get & combine (pull) first."',
    minutes: 5, at: 42,
  },
  {
    id: 'undo',
    title: 'Oops: undo a shared mistake',
    instruction: "A mustache card reached the Wall. Get it, then remove it without breaking anyone's copy.",
    unlocks: ['revert', 'reset', 'reflog'],
    mission: {
      odd: "Press **Get & combine**. In your lab's cards, click the 🥸 card. Press **Undo this card**, then **Send to Wall**.",
      even: 'Press **Get & combine**. Click the card right before 🥸. Press **Move my note back here**, then **Send to Wall**. What happens?',
      evenRefused: 'Refused. Open the **Safety diary**, then press **Get & combine**. 🥸 back? Click it, press **Undo this card**, then send.',
    },
    goals: (v) => [
      { text: 'You got the mustache card', done: v.gotSabotage() },
      { text: 'No mustache on the Wall or in your lab (Undo, then Send)', done: v.matchesWall() && v.wallMonster()?.face !== 'mustache' },
    ],
    bonus: 'Open the Safety diary. Find every place main has been.',
    check: 'Why is adding a fix card safe, but moving back is not?',
    hope: 'A fix card only adds. Moving back drops a shared card.',
    behind: {
      problem: 'A bad card is on the Wall, and every lab has it.',
      idea: "Don't rip out a shared card. Add a card that undoes it.",
      text: '`git revert` adds a card that undoes the old one. `git reset` moves your note back. Safe only if nobody else has the card. `git reflog` lists every place your note has been.',
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
    instruction: "Press nothing; watch the Wall. Then press **← older cards** in your lab's cards. Who made the first 🐙 card?",
    bossInstruction: 'The boss wants one clean card. Press **Get & combine**. Then **Replace the Wall with one card**.',
    screenInstruction: '{boss} replaces the Wall. Everyone else: press nothing and watch.',
    unlocks: ['squash'],
    goals: (v) => [{ text: 'The Wall has one clean card', done: v.wallIsClean() }],
    bonus: 'Ask another lab who added the tentacles.',
    check: 'Who added the tentacles? Where does that answer still exist?',
    hope: "Not on the Wall. Only on the labs' laptops.",
    behind: {
      problem: 'The boss wants one clean card. Cards never change.',
      idea: 'Make one new card after Start. Force the Wall onto it.',
      text: 'Squash (many cards into one) writes a new card with a new ID. `git push --force` points the Wall at it. `git gc` deletes the old cards from the Wall. The Wall no longer knows who did what.',
      cmds: ['git push --force', 'git gc'],
    },
    paper: 'Squash dropped the cards, and who made them. The paper: some loss cannot be recovered.',
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

// solo: nobody else in my pair is online (Step 2). refused: the lab's send was refused in this step
// (Step 6: the even labs see their next move only after they hit the refusal).
export function missionFor(step, labId, pair, { solo = false, refused = false } = {}) {
  const s = STEPS[step];
  if (step === 2) return s.mission[solo ? `solo${pair}` : pair];
  if (step === 5) return LAB_CHANGES[labId] ? `${LAB_CHANGES[labId].text}. Change nothing else.` : null;
  if (step === 6) return s.mission[labId % 2 ? 'odd' : refused ? 'evenRefused' : 'even'];
  return null;
}
