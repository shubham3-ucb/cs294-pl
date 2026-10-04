# App copy proposals · Monster Lab

For the app team. Proposed text for `server/steps.js`, matching the lesson voice.
Each step's Behind the door follows the lesson: **Problem → Idea → Git**.
Show it as three short lines, in that order. Then "You'd type:" as now.
Every line is 12 words or fewer. No "SHA" or "ref". "HEAD" only next to "your pin".
"Keep" means the current text already fits.

---

## 0 · chaos

- **Title:** Everyone, one monster (keep)
- **Instruction:** Your lab shares one monster. Change any part, any time. Go! (keep)
- **Behind the door:**
  - Problem: Nothing is saved. Nobody knows who did what.
  - Idea: Save every version, with a name on it.
  - Git: None yet. This is life without it.

## 1 · commit

- **Title:** Save every version (keep)
- **Instruction:** The old monster is gone for good. From now on, every save makes a card. Change one part, then press **Save card**. Everyone saves at least once.
- **Behind the door:**
  - Problem: You couldn't get an old monster back.
  - Idea: Save the whole monster, your name, and the card before.
  - Git: `git commit` stores exactly that. The ID is computed from all of it. So a card never changes.
- **Check:** Why do arrows point back, never forward?

## 2 · branch

- **Title:** Try two ideas at once (keep)
- **Instruction:** Try two ideas without losing main. Each pair makes its own sticky note. Build your idea on it and save.
- **Missions:** keep.
- **Behind the door:**
  - Problem: Two ideas in one draft overwrite each other.
  - Idea: Each idea gets its own sticky note. Saving moves only that note.
  - Git: A branch is a tiny file holding one card's ID. Making one copies nothing. Your pin (HEAD) shows which note you're on.

## 3 · merge

- **Title:** Make one monster from both (keep)
- **Instruction:** The client wants one monster with both ideas. On **main**: merge **cat-robot**. Then merge **superhero**.
- **Behind the door:**
  - Problem: Two newest cards can't tell you who changed what.
  - Idea: Compare each part with the card where you split.
  - Git: `git merge` finds that card. Changed on one side: keep it. Changed on both: conflict, you pick.
- **Check:** Why did the first merge only move the note? Why did BODY need you? (The current text has "just", a banned word.)

## 4 · remote

- **Title:** Meet the Wall (keep)
- **Instruction:** Each lab's cards lived only in that lab. The Wall is the class's shared copy, like GitHub. Your lab's cards are now a full copy of it ({wallLab}'s monster). Compare your newest card's ID with the Wall's.
- **Behind the door:**
  - Problem: Each lab's cards lived only in that lab.
  - Idea: One shared copy. Every lab keeps a full copy of it.
  - Git: `git clone` copies every card. Same card, same ID, on every laptop. Blue `wall/main` = the Wall, when you last checked.
- **Check:** Your lab never made that card. Why is its ID the same?

## 5 · push

- **Title:** Put your monster on the Wall (keep)
- **Instruction:** Make your lab's change, **Save card**, then **Send to Wall**. Refused? Press **Get & combine**, then send again. (keep: students hit the problem first)
- **Behind the door:**
  - Problem: The Wall refused your card.
  - Idea: The Wall never drops a card. Combine its new cards first.
  - Git: `git push` only moves the Wall forward. `git pull` = `git fetch` + `git merge`.
- **Check:** Why did the Wall refuse your card instead of adding it? (The current text has "just".)

## 6 · undo

- **Title:** Oops: undo a shared mistake (keep)
- **Instruction:** A mustache card reached the Wall. Every lab has a copy. Remove it without breaking anyone's copy.
- **Missions:** odd labs keep. Even labs add one line at the end: "Refused? Open the **Safety diary**."
- **Behind the door:**
  - Problem: A bad card is on the Wall, and every lab has it.
  - Idea: Don't rip out a shared card. Add a card that undoes it.
  - Git: `git revert` adds that card. `git reset` moves your note back: safe only if nobody has the card. `git reflog` lists every place your note has been.
- **Check:** Why is adding a fix card safe, but moving back is not?

## 7 · rewrite

- **Title:** The boss wants it clean (keep)
- **Instruction, boss lab:** The boss wants one clean card. Press **Get & combine**. Then **Replace the Wall with one card**.
- **Instruction, other labs:** Watch the Wall. Who added the tentacles? Find out in your lab's cards.
- **Behind the door:**
  - Problem: The boss wants one clean card. Cards never change.
  - Idea: Make one new card after Start. Force the Wall onto it.
  - Git: Squash writes a new card with a new ID. `git push --force` points the Wall at it. `git gc` deletes the old cards. Who did what is gone.
- **Check:** keep.

## 8 · wrap

- **Title:** What you built (keep)
- **Big line:** Cards never change. Sticky notes move. The Wall copies cards. That's Git. (keep)
- **Behind the door:** none.

---

## Two things to keep or change

**1. Sabotage on Step 5.** The lesson presses **Sabotage** while still on Step 5. Then the class asks "How do you get rid of it?" before the Step 6 buttons appear. Keep the admin Sabotage button working on any step.

**2. Plan clock.** `at` in `steps.js` follows the SPEC plan, not the lesson. The admin timer will say "8 min behind plan" all class. Proposed values, from the lesson clock:

| Step | `at` now | `at` proposed | `minutes` (work) proposed |
|---|---|---|---|
| 0 chaos | 3 | 3 | 1.5 |
| 1 commit | 6 | 8 | 3 |
| 2 branch | 12 | 15 | 3 |
| 3 merge | 18 | 22 | 5 |
| 4 remote | 28 | 36 | 2 |
| 5 push | 34 | 42 | 5 |
| 6 undo | 43 | 51 | 4 |
| 7 rewrite | 52 | 60 | 2 |
| 8 wrap | 60 | 75 | 2 |

The break runs 0:32 to 0:36. The paper and exit question run on Step 7, 1:08 to 1:15.
