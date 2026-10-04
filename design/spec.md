# Git Week spec: "Monster Lab" (Tue 10/13) + "The Humans" (Thu 10/15)

CS294 Modern Programming Tools · Shubham & Ananya · 10–12 PhD students · 80 min per session · Mentimeter · 16:9 .pptx built with python-pptx, then imported into Google Slides.

This is the single source of truth. **v2** applies three critiques (PhD student, Sarah's rubric, simplicity). Where they disagreed, we chose the simpler option that still passes Sarah's two-question test (decision log: Appendix B). Every git command and output quoted here was re-run on git 2.34.1 on 2026-10-04. Commit hashes will differ live. Blob hashes depend only on content, so they will be the same on any laptop.

Companion files: `README.md` (file map, Google Slides import, Menti setup, print kit, TODOs), `menti_questions.md` (every Menti question, copy-paste ready) and `design/facilitator_cheatsheet.md` (one page per day).

---

## 1. The idea in plain words

**Tuesday:** we don't explain Git. We cause a mess first, then let students invent the fix, then show the real Git tool that does the same thing. Three teams co-draw one monster on index cards under a single rule: **never erase**. Nine small "ouch, now fix it" moments rebuild:
- commit (and staging) and log
- branch, HEAD (and detached HEAD)
- merge: a clear conflict, and a clean merge that still breaks the program
- clone and `origin/main`
- hashes, trees, and blobs
- fetch, pull, and push
- revert, reset, and reflog
- rebase, squash, and force-push

The class runs the same audit twice: once while history is intact (it works), and once after a force-push (it fails). That failure is the Tuesday paper.

**Thursday:** we put the Stack Overflow study on trial ("Claim Court"). Students learn to separate what was *measured* from what is *claimed*. They also run a tiny experiment on themselves, with a prediction written down first, so they feel how weak self-report is. Then they turn one finding into a tool design plus a way to know it worked. Each student writes their own design insight *before* we show ours.

---

## 2. Learning objectives (Sarah's format)

### Tuesday: Implementation Day
After this session, we should be confident students could:
1. **Explain** a commit as an immutable snapshot (a tree of blobs) plus parent IDs, whose ID is a hash of all of that, and **explain** a branch and HEAD as movable labels, not copies.
2. **Predict** which parts of a merge conflict by comparing each side with the shared ancestor, and **explain** why merging by lines gives both false conflicts and silent misses.
3. **Diagnose** a rejected push as a non-fast-forward and **fix** it (fetch, merge, push).
4. **Choose** between revert, reset, and rebase/force-push for a situation, and **say** what each one destroys and who loses when shared history is rewritten (Just et al.).

On-slide version (T6) is shortened. The exit ticket (T31) tests all four: Q-a → 2, Q-b → 1, Q-c → 3, Q-d → 4. The recap table (T32) comes *after* the ticket, so it can't be copied.

### Thursday: User Study / Implication Day
After this session, we should be confident students could:
1. **Separate** what a user study measured from what it claims, and **rewrite** an over-reaching claim into one the data supports. *(Claim Court)*
2. **Place** a study on Sarah's three axes (research-question type, data-collection rung, analysis method) and **name** its most serious validity threat. *(individual Menti vote on H8; axis checklists in every court packet)*
3. **Turn** a finding into a concrete tool-design change and **write** how they would know it worked, using a measure that is logged or observed, not self-report. *(design sprint; individual exit on H20)*

**How the activities pass Sarah's two-question test** ("Does doing it teach the concept? Can you only finish it if you learned it?"):
- **Tuesday:**
  - Step 1: you can't say whether the horns were added or removed until you invent "came from" and draw the arrows.
  - Step 3: you can't justify the merge without the shared ancestor.
  - Step 5: you can't write an ID without computing it from the card and its parent. The tamper check only makes sense if you did.
  - Step 6: your card only gets onto `main` after you fetch and combine.
- **Thursday:**
  - A Claim Court verdict needs a "weaker version" sentence that the data literally supports.
  - Each student votes on H8's placement *before* the answer is shown.
  - The slip experiment has a written prediction that could fail.
  - Each student writes the exit answer (finding → change → logged/observed measure) *before* our design lessons appear.

---

## 3. Tuesday task: Monster Lab

### 3.1 Setup in one breath
- **Teams:** 3 labs of 3–4 at three tables, called **Lab 1, Lab 2, Lab 3**. Don't name them A/B/C or by colour. Colours are reserved for diagram meanings, and the branch names are `cat-robot` / `superhero`.
- **The Wall:** one flip-chart sheet on the wall labelled **"THE WALL · GitHub"**.
- **What goes on a card:** each panel gets **one word plus a 5-second doodle**. The words make copying fast and make conflicts exact.
- **Panels are FACE / BODY / LEGS**, not HEAD. In this room, HEAD only ever means "you are here".
- **Rhythm of every step:** feel it (task slide) → invent the fix as a team → check question → Git reveal (talk slide, 90 seconds at most).
- **Pens:** pencils in Step 0 only. From Step 1 on it's markers only, because ink can't be erased.
- **Courier:** from the break on, only one person per lab, the **Courier**, walks to the Wall. Same Courier all session.
- **Model Critic:** in Step 0, each lab names one Model Critic. Give the role to whoever already uses Git daily.
  - They keep a sheet titled **"Where does paper ≠ Git?"** for the whole session.
  - At T33 they read out one entry.
  - Ask critics to explain *why* things work, not to name commands.
- **Facilitators:**
  - **Shubham (front):** slides, timer, pain question, reveal, live demo. Plays the **Boss** in Step 8.
  - **Ananya (floor, then Wall):** checks "came from" boxes in Steps 1–3 and plays the **Client** in Steps 2–3. During the break she sets up the Wall and the copy packs. From then on she **is the Wall**: she enforces the GUARD rule, posts the mustache card, and runs the gc bin.

### 3.2 Kit, with counts (US Letter)

| Item | Count | Notes |
|---|---|---|
| Blank Monster cards (template 3.3) | 90 | 4 per Letter cardstock sheet (23 sheets). About 20 per lab plus spares. |
| Step-1 envelopes, shuffled | 3 × 4 cards | Cards W, X, Y, Z. Fronts drawn; author and came-from printed on the **back** (see 3.4). |
| Official set #1–#4, pre-filled | 5 sets × 4 | 1 for the Wall, 3 copy packs, 1 rescue set |
| Copy-pack wrapper | 3 | Label "You were cloned". Yellow `main` and blue `origin/main` stickies already on #4. |
| Mustache card, pre-filled | 1 | FACE: "mustache" (doodle: the dragon with a GIANT mustache 🥸). Ananya fills in the ID, came-from, BODY and LEGS live. |
| 11×17 (A3) sheets | 3 | Step 0 only |
| Pencils with erasers | 12 | Step 0 only |
| Black fine markers / red markers | 12 / 3 | Red is only for the conflict ❓ |
| Yellow sticky-note pads (branch flags) | 3 + 1 | The extra pad is the Wall's `main` flag |
| Blue sticky-note pad (`origin/main`) | 1 | Spares only; the copy packs already carry one |
| Lab envelopes | 3 | Labs store their Part-1 cards here at the break |
| Bin labelled **"unreachable · emptied by gc"** | 1 | Next to the Wall |
| Painter's tape | 1 roll | Wall-safe |
| Mission cards | 28 | 12 Step-0 slips, 6 idea cards, 3 Step-5 missions, 3 ID-rule slips, GUARD, BOSS, AUDIT, KEY |
| Model Critic sheets | 3 | Header "Where does paper ≠ Git?" and 6 blank lines |
| Laptop | — | Repos `monster/`, `monster-files/`, `broken/` (Appendix A); Menti open; phone timer |

No clothespins and no power-up cards. HEAD is taught on T10, and the extra Git commands are on hidden backup slide B3.

### 3.3 Card template (one card type for the whole session)
- **Size:** quarter-Letter, 4.25 × 5.5 in, thin black border.
- **Top strip** (1.0 in tall): **blank**, with no printed ID, author, or came-from boxes. Students invent those fields in Step 1; that invention is the point.
- **Three stacked panels** (about 1.3 in each), with tiny grey labels at the top-left: **FACE / BODY / LEGS**.
- **Rule printed at the bottom (8 pt grey):** "One word + a 5-second doodle per panel."
- **Pre-filled official set** (identical on the Wall and in every copy pack). Card #4 carries the `main` flag.

| Card | Author | Came from | FACE | BODY | LEGS |
|---|---|---|---|---|---|
| #1 | Ada | — | smiley | box | sticks |
| #2 | Linus | #1 | cat | robot | sticks |
| #3 | Grace | #1 | smiley | superhero | tentacles |
| #4 | Junio | #2 + #3 | cat | robot with a cape | tentacles |

- **How paper maps to Git:**
  - card = commit
  - panel = file (blob)
  - the three panels together = tree
  - came-from = parent IDs
  - In the one-file demo (`monster.txt`), each panel is one *line*. That's why T14 asks about lines.
- **Praise-able inventions:**
  - Writing "same" in an unchanged panel is blob reuse (T21 shows it in real Git).
  - Writing a time on the card is a timestamp. It's useful, but it doesn't tell you which card a card was built *from*.

### 3.4 Mission cards (exact text, one per card)

**Step 0, one set per lab.** In a lab of 3, P1 also takes P4's slip.

| Card | Text |
|---|---|
| P1 | Draw a smiley FACE and a box BODY. |
| P2 | Give it horns. Big ones. |
| P3 | At 0:45, ERASE the horns and draw ears. Tell no one. |
| P4 | Add stick LEGS. Then change one thing someone else drew. |

**Step 1 envelope, "another lab's history"** (4 cards, shuffled; metadata on the back only):

| Card | FACE | BODY | LEGS | Back of card |
|---|---|---|---|---|
| W | smiley | box | sticks | by Ken · came from: — |
| X | smiley with horns | box | sticks | by Barbara · came from: W |
| Y | smiley with horns | box | wheels | by Margaret · came from: X |
| Z | smiley | box | wheels | by Dennis · came from: W |

- From the fronts alone, both W→X→Y→Z and Z→Y→X→W fit, so the question can't be answered. That is the pain.
- After the lab invents "came from", they flip the cards over: W ← X ← Y and W ← Z. So the horns were **added**, and there is **no single newest card**: Y and Z are both cards nobody points to. Two lines of work: that's Step 2.
- The names are deliberately not the official set's authors, so the Step-8 audit can't be confused.

**Step 2, idea cards** (one per pair):
- **IDEA: CAT-ROBOT · this is card #2.** Start from your #1. FACE → cat. BODY → robot. Copy LEGS exactly. Draw ONE card.
- **IDEA: SUPERHERO · this is card #3.** Start from your #1. BODY → superhero. LEGS → tentacles. Copy FACE exactly. Draw ONE card.

**Step 5, lab missions** (one per lab). Each lab changes a different panel, so every combine in Step 6 merges automatically. Verified.
- **LAB 1:** Start from #4. FACE → dragon. Copy BODY and LEGS exactly.
- **LAB 2:** Start from #4. BODY → disco suit. Copy FACE and LEGS exactly.
- **LAB 3:** Start from #4. LEGS → roller skates. Copy FACE and BODY exactly.

**Step 5, ID-rule slip** (handed out only after a lab asks "could the name come from the card itself?"):
> **NEW ID RULE.** ID = the first letter of the FACE, BODY and LEGS words + one check digit.
> Check digit: count every letter in the three panel words, add the digit of every card yours came from, and keep the last digit. Old cards #1–#4 count as digits 1–4.
> Example: ghost · box · sticks on #1 → 5 + 3 + 6 = 14, + 1 = 15 → **gbs5**.

Precomputed answers:

| Card | Words (letters) | + parent digits | ID |
|---|---|---|---|
| Lab 1 on #4 | dragon 6 · robot with a cape 14 · tentacles 9 = 29 | + 4 = 33 | **drt3** |
| Lab 2 on #4 | cat 3 · disco suit 9 · tentacles 9 = 21 | + 4 = 25 | **cdt5** |
| Lab 3 on #4 | cat 3 · robot with a cape 14 · roller skates 12 = 29 | + 4 = 33 | **crr3** |
| Check: Lab 1 with LEGS → wheels | 6 + 14 + 6 = 26 | + 4 = 30 | **drw0** (changed, so every later card changes too) |
| Bonus: Lab 1 with dragon → donkey | 6 + 14 + 9 = 29 | + 4 = 33 | **drt3**: a collision |

Step-6 combine cards and Step-7 IDs are in the facilitator cheat sheet. Ananya checks the GUARD rule, not the arithmetic. Model Critics check the arithmetic.

**Step 6, GUARD** (Ananya's card, read aloud once the class invents it):
> Accept a card only if walking back along its came-from arrows reaches the card under `main`. Then take every card it points back to that the wall lacks, and move `main` to it. Otherwise say: **REJECTED, fetch first.**

This is the real fast-forward rule. It accepts an honest 2-card push, it makes the Step-7 zombie legal, and it rejects Step 8's clean card for the right reason.

**Step 8, BOSS** (to Lab 3):
> Make ONE clean card showing today's monster. Replace EVERYTHING on the wall with it. Bin the rest. If the wall refuses, say: FORCE.
> *Why: reviewers can't read 14 combine cards, and bisect needs every card on main to work.*

**AUDIT** (to Lab 1; used twice):
> A security bug was traced to the tentacles. Using ONLY the wall:
> 1. Trace how the tentacles reached `main`: who drew them first, and which card brought them in?
> 2. Who settled BODY?
> 3. Was the mustache ever on `main`?

In Step 6, Lab 1 answers Q1 only (30 s) and succeeds. In Step 8, after FORCE, they try all three and fail.

**KEY** (twist card for the think-pair-share; give it to any pair whose rule is "never rewrite main"):
> The mustache card had the Client's API key written on it. Is a fix card enough?

(No. Revert leaves the key in every clone's history. You must rewrite AND rotate the key.)

### 3.5 Facilitator script (Steps 0–8)

**Format for every step:**
- **Instruction:** what Shubham says.
- **Trigger:** the planted pain.
- **Invent:** the fix we expect.
- **Nudge:** if a lab is stuck.
- **Check:** asked before the reveal; the expected answer is in parentheses.
- **Git reveal.**

**Running rules:**
- **Done signal:** the lab holds up its newest card.
- **At 75% of a step's time:** call "30 seconds". A stuck lab gets a rescue card and jumps to where the others are. Nobody waits.
- **Model Critics** write on their sheet whenever the paper model and real Git disagree. They don't announce it until T33.

**Step 0: Chaos (1:30 drawing, ~2:30 debrief)**
- **Instruction:** "One sheet per lab, pencils, 90 seconds. Draw one monster together. Follow your secret slip." At 0:45, call "Forty-five seconds!" This is P3's cue.
- **Trigger:** "What did the face look like at 0:30? Who added the horns? Get me the 0:30 monster back." Nobody can.
- **Invent:** never erase. Every change becomes a new drawing of the *whole* monster.
- **Nudge:** "What if erasing were illegal?"
- **Check:** "Does a card store the change, or the whole monster?" (the whole monster, a snapshot; unchanged parts can be shared)
- **Git reveal (T5):** `git commit` = a frozen snapshot. Staging is pencil sketch → inked → ID written (working copy → `git add` → `git commit`). The T5 pause asks the staging question.
- **Then:** each lab names its Model Critic. Hand out blank cards, markers, and the critic sheets.

**Step 1: The shuffled pile (3:30)**
- **Instruction:** "Here's another lab's history. Put it in order. Which card is newest? Were the horns added or removed?"
- **Trigger:** the W/X/Y/Z envelope, fronts up. Both orders fit, so it can't be decided.
- **Invent:** every card says its author and "came from __".
- **Nudge:** "What ONE line on each card would survive shuffling?"
- **Wrong answer, "timestamps":** "Laptop clocks disagree. And does a time tell you which card it was built *from*?"
- **After they invent it:** "Flip them. Draw the arrows. Now: newest? Horns added or removed?"
- **Check:** (Horns were added, W→X. There is no single newest: Y and Z are both cards nobody points to. "Two lines of work: that's Step 2.")
- **Then:** each lab draws its own **#1 (smiley / box / sticks)** with its invented strip: "#1 · by __ · came from: —".
- **Git reveal:** `git log`. A commit stores its parents' IDs, and nothing else stores history. Log walks backward from a tip. Arrows point backward because a card never changes, so an old card can't learn about its children.

**Step 2: Risky ideas (4:00)**
- **Instruction:** "Two of you have a risky idea. Split into pairs, open your idea card, and draw one card each. Anyone must be able to find the approved monster in 3 seconds."
- **Trigger:** at 2:30, Ananya (as the Client): "Client's here! Show me the approved monster AND each idea's latest card. Now!"
- **Invent:** sticky flags. `main` sits on #1; `cat-robot` and `superhero` sit on each idea's latest card and move forward with every new card.
- **Nudge:** "Which card is approved? How would the Client know without asking you?"
- **Check:** "If the cat-robot pair draws one more card, what's its came-from, and which flags move?" (the cat-robot card; only `cat-robot` moves, `main` stays)
- **Git reveal (T10):**
  - `git branch`. A branch is a tiny file holding one commit ID.
  - HEAD names the branch you're on. Your next commit's parent is whatever HEAD points to, and committing moves that flag.
  - Live, 60 s, inside `.git`. Create a branch without any branch command.
  - Pause: detached HEAD (pin on a card with no flag). See T10.
  - This answers the hook poll: **D**.

**Step 3: One monster (5:00). The conflict.**
- **Instruction:** "The Client wants ONE monster with both ideas. One new card. Never erase. Which panels are easy? Which need a talk?"
- **Trigger:** the idea cards guarantee cat/robot/sticks vs smiley/superhero/tentacles.
- **Invent:**
  - A card with **two** came-froms.
  - Compare each panel with **#1**, the card both pairs started from:
    - Only one side changed it: take that side. FACE → cat; LEGS → tentacles.
    - Both sides changed it differently: **conflict**. Draw a red ❓ in BODY, mini-sketch both options beside it, and the two authors decide. Expected resolution: **robot with a cape**.
- **Nudge:** "For each panel: who changed it since the card you both started from?"
- **Wrong answers:**
  - "Take the newest card": "Then whose work did you just throw away?"
  - "Everything conflicts": "Did superhero touch FACE?"
- **Check:** "Cover #1 with your hand. Can you still prove FACE isn't a conflict?" (No. Cat vs smiley looks like a disagreement. A 3-way merge needs the ancestor.)
- **Git reveal:**
  - `git merge` is a three-way merge against the merge base. The merge commit has two parents.
  - Live demo (Appendix A): FACE and LEGS merge automatically and BODY conflicts.
  - Menti prediction (T14): delete the blank lines and all three lines conflict, because Git merges lines, not panels. Show B1; don't run it.
  - T15: a merge with no conflict that still breaks the program.
  - Line to say: "Merging by lines is a design choice. It gives you false alarms AND silent misses."

**Break (3 min) + Step 4 happens during it.**
- Labs put their Part-1 cards into their envelope ("that was a different repo").
- Ananya tapes the official #1–#4 on the Wall and puts `main` on #4. She sets up the gc bin.
- She puts a copy pack on each table: the label "You were cloned", #1–#4, and yellow `main` and blue `origin/main` stickies on #4.

**Step 4: You were cloned (talk only, ~1 min)**
- **Instruction (T18):** "While you were out, you were cloned. All three labs now build THE monster on the wall, from your own tables. Only your Courier may visit the wall."
- **Check:** "We gave you all four cards, not just #4. Why?" (The next merge needs the shared ancestor, and log works offline.) Then: "And the blue flag?" (Your table's memory of where the wall's `main` was. It only moves when you go and look.)
- **Git reveal:** `git clone`. Every table holds every card. `origin` is a nickname for the Wall, and `origin/main` is your memory of the Wall's flag. GitHub is special only because we agreed it is.

**Step 5: Number clash (2:00)**
- **Instruction:** "Each lab: add ONE card on top of #4. Follow your lab mission. Move your yellow `main`. Number your card. Read your number out loud."
- **Trigger:** all three labs shout "#5!"
- **Invent:** a name nobody else can pick, without phoning each other.
  - Lab name plus number works: praise it.
  - Then push further: "Could the name come from the card itself?"
  - Hand out the **ID-rule slip** (3.4). Labs compute and write their ID: drt3 / cdt5 / crr3. Old cards keep #1–#4.
- **Wrong answer, "just pick random IDs":** "Could two tables agree on the same card's ID without talking? Could anyone tell if a card was altered?"
- **Nudge:** "Make an ID from only what's on the card."
- **Check:** "Lab 1 secretly changes LEGS to wheels. New ID? What happens to every card built on it?" (drw0; every later card's digit changes, so tampering shows)
- **Bonus (if a Model Critic is ahead):** "Dragon → donkey?" (drt3 again: a collision. "That's why Git uses 160 bits, and why SHAttered (2017) pushed Git toward SHA-256.")
- **Git reveal:**
  - One sentence: "At one table you could just agree on #2 and #3. Across three tables you can't, so the ID has to come from the card."
  - T20: `git cat-file -p HEAD`. A commit is a small text object (tree, parents, author, committer, message). Its ID is the SHA-1 of that text, so no central counter is needed.
  - Live: run the same `git hash-object` on two laptops; both print the same ID.
  - T21: `git ls-tree` on two commits. `legs.txt` has the identical blob ID in both: an unchanged panel is stored once.

**Step 6: Post your card (6:00). One flow, no reset.**
1. **Instruction:** "Courier: put your card on the wall and move `main` to it. First come, first served."
2. **Trigger:**
   - Ananya accepts the first card (call it Lab 1's) and moves `main` to it.
   - She accepts the second card too and moves `main` to it.
   - Freeze the room: "Walk back from `main`. Lab 1, where's your dragon?" It isn't in main's history.
3. **Invent:** the class invents the rule. Ananya moves `main` back to Lab 1's card, hands the second card back ("REJECTED, fetch first"), and reads **GUARD** aloud.
4. **Check (before anyone re-posts):** "Your blue flag says #4. Where is the wall's `main` right now? How would you know?" (You can't know until you go and look. `git status`'s "up to date with origin/main" only compares with your own memory.)
5. **Labs 2 and 3:**
   - The Courier copies the wall's new cards and moves the lab's blue flag to the wall's `main`. That's `git fetch`.
   - The lab draws a **combine card** with two came-froms, computes its ID, and moves yellow `main`. That's the merge.
   - The Courier re-posts. Pull = fetch + merge.
   - If another lab got in first, they get "REJECTED" again and repeat. That's real life; let it happen once.
6. Every combine merges automatically, because the missions changed different panels. Check while they draw: "Which panels need a talk?" (none)
7. **AUDIT, first run (30 s):** Lab 1 opens AUDIT and answers Q1 using only the wall. They succeed: tentacles first on #3 (Grace) → #4 (Junio's merge) → the lab cards and combine cards → `main`.
- **Wrong answers:**
  - A lab redraws its own change on top of the wall's newest card (one came-from) instead of drawing a two-parent card: "You just invented rebase: new card, new ID, and your old card is orphaned. Hold that thought for Step 8." Accept it.
  - A Courier moves `main` anyway: "That's `push --force`. Whose card just fell off?"
- **Nudge:** "Which card do you and the wall both come from?"
- **Git reveal (T23):** `git push` only moves `main` forward (a fast-forward). The real output is `! [rejected] main -> main (fetch first)`. `git fetch` moves only `origin/main`. `git pull` = fetch + merge. Foreshadow: `pull --rebase` redraws your cards instead, which is Part 3.
- **Result:** the final Wall monster is dragon / disco suit / roller skates (ID ddr2 or ddr0, depending on the order; see the cheat sheet).

**Step 7: The mustache (3:00)**
- **Before the slide:**
  - Ananya fills in the mustache card ("by Shubham", came from the current `main`, BODY disco suit, LEGS roller skates, ID computed), posts it, and moves `main` to it.
  - She announces "New card on the wall. Everyone pull." Each Courier copies it.
- **Instruction:** "The Client HATES the mustache. Every lab already copied it. Make it gone. For good. Don't break anyone's table."
- **Trigger:**
  - Most labs ask to rip it off, and Ananya does: `main` goes back to the card before.
  - Then: "Lab 3, add one card on top of your newest card (any one change) and push."
  - Walking back from Lab 3's card passes the mustache and reaches `main`, so GUARD accepts it, *and* takes the cards the wall lacks. The mustache goes back up: a **zombie**. (Real git does the same with a plain fast-forward push; verified.)
- **Invent:** a **fix card** that undoes it (dragon without the mustache). Nobody's table breaks. It must come from the wall's **current** `main`: after the zombie that is Lab 3's card (which sits on the mustache), so the fix card undoes only the mustache and keeps Lab 3's change, and its ID is whatever the rule gives. A fix card drawn straight on the mustache card would be rejected by GUARD at that point. T26 shows the textbook case (fix card directly on the mustache card: ddr8, or ddr6). Either way it has the same picture as an earlier card but a different ID, because its parent is different.
- **Nudge:** "Lab 3 still holds that card. Then what?"
- **Check:** "When is ripping it off OK?" (only if nobody else has copied it yet)
- **Git reveal (T26):**
  - `git revert` adds a new inverse commit. It's safe when the commit is shared.
  - `git reset --hard` moves the flag back. The commit becomes unreachable, not deleted. On a shared branch that also needs `push --force`.
  - `git reflog` is your local diary of where HEAD has been, so you can fish a card out of the bin until gc empties it. (Detached-HEAD cards from T10 end up in the same place.)

**Step 8: The neat boss (3:00)**
- **Instruction:** Shubham, as the Boss (with a straight face; the Boss has a point): "This history is a MESS. Lab 3: open the BOSS card. Lab 1: open the AUDIT card again. Lab 2: watch your newest card."
- **Trigger:**
  - Lab 3 draws one clean card (came from: —) and tries to post it. Walking back never reaches `main`, so GUARD rejects it. Boss: "Tell the wall: FORCE."
  - Ananya obeys: the old Wall cards go into the gc bin, and then she empties the bin, theatrically.
  - **AUDIT, second run:** Lab 1 tries all three questions with the same card and the same wall. They fail.
  - Lab 2's newest card points at cards that are no longer on the Wall, so it no longer fits.
- **Check:** "Does Lab 2's newest card still fit on the wall?" (No. New card, new ID: they must redo their work on top of the clean card.)
- **Git reveal (T28):**
  - `git rebase -i` / squash draws **new** commits with new IDs.
  - `git push --force` makes the remote forget the old ones.
  - Pause: "The wall forgot. Where in this room does the truth still exist?" (Lab 2's stale table still holds every old card; local reflogs do too.) Then: "Lab 1, you may now ask Lab 2's table. 30 seconds." They can answer again.
  - Follow-up: "Which copy does an auditor or a researcher mine? How long do table copies last?" (The server. Table copies last until gc or reflog expiry, and only on that laptop.)
  - The integration paths, the routes changes took to `main`, are gone from the server. This is Just et al.'s "Ugly".
- **Invent:** in the think-pair-share (T29), the class designs one wall rule that serves both the Boss and the auditor, and tests it on three cases.

**If behind** (check at the break; it must start by 0:33), cut in this order:
1. T21 (tree of blobs) becomes one sentence said over T20 (saves 1 min).
2. T15 (clean merge, broken program): say the line, skip the slide (saves 1 min).
3. Model Critic readout (T33): one critic, one entry (saves 1 min).
4. Step 7 becomes discussion only, with Ananya acting out the zombie (saves 2 min).
5. Step 5: Shubham computes Lab 1's ID on the board, and the labs copy the rule for theirs (saves 2 min).

**Never cut:** Step 3 (the conflict), Step 8 with both AUDIT runs (the bridge to the paper), and exit questions Q-c and Q-d.

**If ahead:** show hidden slide B3 (tag · stash · cherry-pick · blame) to fast labs.

### 3.6 Failure modes
| Failure | Fix |
|---|---|
| Students polish their drawings | One word plus a 5-second doodle; keep the timer visible. |
| No conflict happens | It can't: the idea cards force it on BODY, the same pattern as the tested git demo. |
| Empty "came from" box | Ananya bounces the card: "Orphan! Where did it come from?" |
| Crowd at the Wall | Couriers only, one at a time, in a queue. |
| Someone erases or rips a card | Use it: "You just ran `reset --hard`. What did you lose?" |
| A lab miscounts its ID | Any consistent ID is fine. "In Git a machine does the counting." Model Critics catch it. |
| A lab rebases instead of merging in Step 6 | Accept it: "You just invented rebase." Point back to it in Step 8. |
| Model Critic dominates the lab | "Write it down; you get the floor at the end." |

---

## 4. Tuesday run-of-show (80 min)

| Clock | Min | Segment | Slides | Pause / logistics |
|---|---|---|---|---|
| 0:00–0:02 | 2 | Welcome + hook Menti (open as students arrive) | T1–T2 | Students sit in 3 labs |
| 0:02–0:07 | 5 | Step 0 Chaos: 1:30 drawing, debrief, commit + staging | T3–T5 | **PAUSE:** staging question. Name Model Critics; hand out cards + markers |
| 0:07–0:08 | 1 | Goals | T6 | |
| 0:08–0:13 | 5 | Step 1 Shuffled pile (3:30) → `git log` | T7–T8 | Flip the backs only after they invent came-from |
| 0:13–0:20 | 7 | Step 2 Risky ideas (4:00) → branch, HEAD, inside `.git`, detached HEAD | T9–T10 | Client at 2:30; live `cat .git/HEAD` |
| 0:20–0:28 | 8 | Step 3 One monster (5:00) → merge + conflict | T11–T12 | **PAUSE:** why does Git need BASE? |
| 0:28–0:33 | 5 | Real-git merge, Menti prediction, B1, clean-but-broken merge | T13–T15 | Menti; B1 shown, not run |
| 0:33–0:36 | 3 | **Stretch break**; copy packs appear | T16 | Ananya sets up the Wall and the packs |
| 0:36–0:37 | 1 | Step 4 You were cloned → clone, `origin/main` | T17–T18 | 30-s check |
| 0:37–0:42 | 5 | Step 5 Number clash (2:00) → hash IDs, tree of blobs | T19–T21 | ID-rule slips; live `hash-object` on 2 laptops |
| 0:42–0:51 | 9 | Step 6 Post your card (6:00) → fetch / pull / push; AUDIT run 1 | T22–T23 | Ananya is the Wall |
| 0:51–0:57 | 6 | Step 7 Mustache (3:00) → revert vs reset + reflog | T24–T26 | Mustache card posted before T25 |
| 0:57–1:02 | 5 | Step 8 Boss (3:00) → rebase / squash / force-push; AUDIT run 2 | T27–T28 | Shubham plays the Boss |
| 1:02–1:07 | 5 | **Think-pair-share:** one wall rule, three cases | T29 | KEY card for "never rewrite" pairs |
| 1:07–1:09 | 2 | Paper: Good / Bad / Ugly | T30 | |
| 1:09–1:13 | 4 | Exit ticket (4 questions) | T31 | Laptops closed |
| 1:13–1:14 | 1 | Recap | T32 | |
| 1:14–1:16 | 2 | Model Critics: where does paper lie? | T33 | 3 critics × 30 s |
| 1:16–1:17 | 1 | "Remember one thing" + Thursday homework | T34 | |
| 1:17–1:20 | 3 | Buffer / remediation | | Any exit item < 70% correct: redo it on cards now (2 min) |

---

## 5. Tuesday slide outline (34 slides + 3 backups)

Layouts are defined in §9.

**Deck numbering (built file `slides/tuesday_monster_lab.pptx`, 37 slides):** T1–T14 = slides 1–14; **B1 is a normal, visible slide 15** (right after the T14 vote); T15–T34 = slides 16–35; B2 and B3 are hidden slides 36–37. So from T15 on, deck slide = T-number + 1. Every speaker note starts with its label, e.g. "T15 · … · deck slide 16".

**TASK slide conventions:**
- Lavender background, step chip, and a timer chip that shows the duration only.
- Run the actual countdown on a phone or browser. A .pptx can't contain a running timer.
- Progress dots (9, one per Step 0–8) on every TASK and TALK slide from Step 0 on.

**TALK slide conventions:**
- Kicker "You just invented", then the purple mono command, then a one-line meaning, then a diagram, then a 💬 pause bar.

### T1 · TITLE
- **Title:** Monster Lab
- **Subtitle:** Build Git out of paper
- **Footer:** CS294: **Modern Programming Tools** | UC Berkeley | Shubham & Ananya
- **Bar (italic):** Git Week · Implementation Day
- **Visual:** none.
- **Notes:** "No Git lecture today. You'll rebuild Git out of paper, and every Git tool shows up only after you've felt the problem it fixes. Sit with your lab, phones out for Menti."

### T2 · MENTI (hook)
- **Chip:** 📊 Live poll
- **Question:** You type `git branch experiment`. What does Git create?
- **Options:**
  - A: A copy of all your files
  - B: A copy of all your commits
  - C: One new commit
  - D: One tiny file holding one ID
- **Visual:** QR placeholder + code chip.
- **Notes:** "Gut answer. We won't reveal it; you'll discover it with paper." Hide results. The answer, D, is revealed on T10.

### T3 · DIVIDER (pink)
- **Kicker:** PART 1
- **Title:** One table
- **Notes:** (5 seconds) "Part 1: one team, one table."

### T4 · TASK, Step 0 · timer "1:30"
- **Instruction:** Draw one monster. Together. One sheet.
- **Sub-steps:**
  1. Open your secret slip
  2. Pencils only
  3. Go!
- **Notes:**
  - Hand out sheets, pencils, and Step-0 slips. Call "Forty-five seconds!" at 0:45, then stop at 1:30.
  - **PAUSE / debrief (~90 s):** "What did the face look like at 0:30? Who added the horns? Get me the 0:30 monster back." Then: "Invent ONE rule that would make these answerable."
  - Nudge: "What if erasing were illegal?"
  - Check: "Does a card store the change, or the whole monster?"

### T5 · TALK → `git commit`
- **Kicker:** You just invented
- **Command:** git commit
- **Meaning:** Never erase. Every change = a new card of the whole monster.
- **Visual:** three cards, left to right, at scale 0.85:
  - `sketch` state, label "working copy"
  - `staged` state, label `git add`
  - `committed` state with tag "#1", label `git commit`
  - Labels: 18 pt mono purple, under each card.
- **Pause bar:** 💬 You pencilled a new FACE and a new BODY. Only FACE is ready. What goes on the next card?
- **Notes:**
  - "A commit is a snapshot, not a diff. Pencil = working copy, ink = staged, writing the ID = committed."
  - Pause answer: ink only FACE. The next card gets the new FACE and the *old* BODY, because a card is always the whole monster. That's `git add -p` (or `git add face.txt`). The index is the next card, being drafted.
  - `git diff` = pencil vs ink. `git diff --staged` = ink vs the last card.
  - If a Model Critic says "but packfiles store diffs!": "Write it down. You're right, and you get the floor at the end."
  - Each lab names its Model Critic. Hand out cards, markers, critic sheets: "Markers only from now on. One word + a 5-second doodle per panel."

### T6 · CONTENT (goals)
- **Title:** Today's goals
- **Lead:** After today, we should be confident you could:
- **List:**
  1. Explain a commit, a branch, and HEAD
  2. Predict what conflicts in a merge
  3. Fix a rejected push
  4. Choose revert, reset, or rebase, and say what each destroys
- **Notes:** "The exit ticket checks all four. You can't pass it by memorising commands, only with the model."

### T7 · TASK, Step 1 · timer "3:30"
- **Instruction:** Another lab's history. Put it in order.
- **Sub-steps:**
  1. Which card is newest?
  2. Horns added, or removed?
  3. Fix it: what must every card say?
- **Notes:**
  - Envelopes out, fronts up. After about 90 seconds they realise it can't be decided.
  - The invention we want: author + "came from __". Only then: "Flip them. Draw the arrows."
  - Expected: horns added (W→X); Y and Z are both tips, so there's no single newest. "Two lines of work: that's Step 2."
  - Then each lab draws **#1: smiley / box / sticks** with "#1 · by __ · came from: —".
  - Wrong answer, timestamps: "Does a time tell you what it was built *from*?"

### T8 · TALK → `git log`
- **Kicker:** You just invented
- **Command:** git log
- **Meaning:** Each card points to its parent. History = follow the arrows back.
- **Visual:**
  - The flipped envelope, three cards in a row: W ← X ← Y. Tags "W", "X", "Y"; authors "Ken", "Barbara", "Margaret"; came-from lines "—", "← W", "← X". Panels 🙂📦🦵 · 😈📦🦵 · 😈📦🛞.
  - Parent arrows point left. Scale 0.85.
- **Pause bar:** 💬 Why do the arrows point backward, never forward?
- **Notes:** "Git keeps no separate history list. `log` starts at a tip and walks the parent pointers. A card never changes, so an old card can't learn about its future children. The first commit has no parent: that's the root. Card Z also points to W, so there are two tips. Next step."

### T9 · TASK, Step 2 · timer "4:00"
- **Instruction:** Two risky ideas. Keep the good monster safe.
- **Sub-steps:**
  1. Split into two pairs
  2. Open your idea card. Draw ONE card.
  3. Anyone finds the approved monster in 3 seconds
- **Notes:**
  - Ananya plays the Client at 2:30 ("Approved monster AND each idea's latest. Now!").
  - The invention we want: sticky flags (`main`, `cat-robot`, `superhero`).
  - Check: "If the cat-robot pair draws one more card, what's its came-from, and which flags move?"

### T10 · TALK → `git branch`
- **Kicker:** You just invented
- **Command:** git branch
- **Meaning:** A branch is a flag on a card. HEAD = you are here.
- **Visual (fork):**
  - #1 on the left, carrying the `main` flag.
  - Two tip cards stacked on the right: 🐱🤖🦵 with the `cat-robot` flag and the pink HEAD pin; 🙂🦸🐙 with the `superhero` flag.
  - Both tips have arrows back to #1. In fork diagrams, flags sit on the **right edge** of the tip cards (see §9).
  - Caption (16 pt, MUTED): "New idea = new flag. Zero copied cards."
- **Pause bar:** 💬 Pin HEAD on a card with no flag, draw a card, then switch back. Where's your new card?
- **Notes:**
  - **Live, 60 s, inside `.git`** (in `monster/`):
    - `cat .git/HEAD` prints `ref: refs/heads/cat-robot`.
    - `git rev-parse HEAD > .git/refs/heads/hack && git branch` shows a new branch, `hack`, made without any branch command. It's a 41-byte file.
  - "HEAD decides your next commit's parent. Committing moves the flag HEAD points to."
  - **Pause answer:** a pin on a flagless card = **detached HEAD**. The new card has no flag, so nothing leads to it. Git warns you (verified):
    ```
    Warning: you are leaving 1 commit behind, not connected to
    any of your branches:
    ```
    `git switch -c wheels` would have saved it. Otherwise only the reflog remembers it (Step 7).
  - "So the poll answer is **D**." Show the Menti results now.

### T11 · TASK, Step 3 · timer "5:00"
- **Instruction:** The Client wants ONE monster with both ideas.
- **Sub-steps:**
  1. One new card. Never erase.
  2. Which panels are easy? Which need a talk?
  3. Disagree? Red ❓, then decide together.
- **Notes:**
  - The invention we want: two came-froms, plus a panel-by-panel comparison with #1. Expected result: FACE cat, LEGS tentacles, BODY ❓ → robot with a cape.
  - Nudge: "Who changed each panel since the card you both started from?"
  - Check: "Cover #1. Can you still prove FACE isn't a conflict?"
  - If a lab is stuck: put the rescue set's #1, #2 and #3 side by side.

### T12 · CONFLICT → `git merge` (the key visual)
- **Kicker:** You just invented
- **Command:** git merge
- **Visual:** one row, left to right, using the CONFLICT layout (§9). One plain grey caps label above each card: **BASE · CAT-ROBOT · SUPERHERO · MERGED**.
  - Layout: BASE | CAT-ROBOT + SUPERHERO = MERGED
  - **BASE:** 🙂 📦 🦵
  - **CAT-ROBOT:** 🐱 (changed) 🤖 (changed) 🦵
  - **SUPERHERO:** 🙂 🦸 (changed) 🐙 (changed)
  - **MERGED:** 🐱 (auto, green) ❓ (conflict, red dashed) 🐙 (auto, green)
  - A red **CONFLICT** pill next to MERGED's BODY row.
  - Row labels FACE / BODY / LEGS on the left. No legend, no branch flags.
- **Rule line (28 pt Bold), word for word:** One side changed → take it. Both changed differently → you decide.
- **Pause bar:** 💬 Why does Git need BASE? Why not just compare the two?
- **Notes:** "Three-way merge: for each part, Git asks who changed it since the shared ancestor. Without BASE, cat vs smiley looks like a disagreement, and every panel would conflict. We resolved BODY by hand (robot with a cape), on a card with two parents." Keep "differently": exit question Q-a depends on it.

### T13 · TERMINAL (live demo; also the backup)
- **Title:** Same merge, real Git
- **Left panel** (w 5.6):
  ```
  $ git switch cat-robot
  $ git merge superhero
  Auto-merging monster.txt
  CONFLICT (content): Merge
    conflict in monster.txt
  ```
- **Right panel** (w 5.9), titled "monster.txt":
  ```
  face: cat

  <<<<<<< HEAD
  body: robot
  =======
  body: superhero
  >>>>>>> superhero

  legs: tentacles
  ```
  - Green chip "auto" beside `face: cat` and beside `legs: tentacles`.
  - The marker lines are amber; CONFLICT is red.
- **Notes:**
  - Run it live from Appendix A. "In this file each panel is one line, with a blank line between panels."
  - Resolve to `body: robot with a cape`, then `git add`, `git commit`, and `git log --oneline --graph` (the diamond).
  - `git cat-file -p HEAD` shows **two `parent` lines**: "exactly your paper card".

### T14 · MENTI (predict)
- **Chip:** 📊 Live poll
- **Question:** I delete the blank lines and merge again. What conflicts?
- **Options:**
  - A: BODY only
  - B: FACE + BODY
  - C: All three lines
  - D: Nothing
- **Notes:** Vote, then show **B1** (don't run it live). Answer **C**: Git merges *lines*. Changed lines that touch each other form one hunk, so the three edits become one conflict. False alarm: nobody actually disagreed about FACE or LEGS.

### T15 · TERMINAL split → "Clean merge, broken program"
- **Title:** Clean merge, broken program
- **Left terminal** (w 5.6, h 4.4):
  ```
  $ git switch rename
  $ git merge caller
  Auto-merging m.py
  Merge made by the 'ort' strategy.
  $ python3 m.py
  NameError: name 'draw' is not defined
  ```
- **Right panel** (w 5.85, h 4.4), titled "m.py after the merge":
  ```
  def render():
      print("monster")

  def main():
      draw()

  main()
  ```
  - `render` and `draw()` highlighted (`#C792EA`); NameError red.
- **Pause bar:** 💬 Git said no conflict. Who should have caught this?
- **Notes:**
  - Branch `rename` changed `def draw():` to `def render():`. Branch `caller` changed `main()` to call `draw()`. Different lines, so no conflict. Verified on 2.34.1.
  - Answer: tests or CI after the merge; semantic or structure-aware merge tools.
  - **Say:** "Merging by lines is a design choice. It gives you false alarms AND silent misses." (T14 was the false alarm.)

### T16 · BREAK
- **☕** · 3-minute break · Back at __:__
- **Notes:** Labs put their Part-1 cards in their envelope. Ananya tapes the official #1–#4 on the Wall, puts `main` on #4, sets up the gc bin, and puts a "You were cloned" copy pack on each table (yellow `main` + blue `origin/main` on #4). Courier = the person nearest the Wall.

### T17 · DIVIDER (blue)
- **Kicker:** PART 2
- **Title:** Many tables

### T18 · TALK → `git clone` (Step 4, talk only)
- **Kicker:** You were cloned
- **Command:** git clone
- **Meaning:** Every table gets every card. Blue flag = where the wall's main was.
- **Visual:** the verified wall layout (§9):
  - Lab 1 table, THE WALL · GitHub, and Lab 2 table, each holding #1–#4 at scale 0.62.
  - Blue dashed arrows from the Wall to each table.
  - A blue `origin/main` flag on each table's #4; a yellow `main` flag on the Wall's #4.
- **Pause bar:** 💬 We gave you all four cards, not just #4. Why?
- **Notes:**
  - 30-s check. Answer: the next merge needs the shared ancestor; log and history work offline.
  - "Every clone is a full repository. `origin` is a nickname for the Wall. The blue flag is your *memory* of the Wall's `main`: it moves only when you go and look."
  - "From now on only your Courier visits the wall."

### T19 · TASK, Step 5 · timer "2:00"
- **Instruction:** Each lab: add ONE card on top of #4.
- **Sub-steps:**
  1. Follow your lab mission
  2. Number it. Move your yellow `main`.
  3. Read your number out loud
- **Notes:**
  - Everyone shouts "#5". Ask: "How can three tables pick names that never clash, without talking?"
  - Praise lab+number, then push: "Could the name come from the card itself?" Hand out the ID-rule slips.
  - Expected IDs: Lab 1 **drt3**, Lab 2 **cdt5**, Lab 3 **crr3**.
  - Wrong answer, random IDs: "Could two tables agree on the same card's ID without talking? Could anyone tell if a card was altered?"
  - Check: "Lab 1 secretly changes LEGS to wheels. New ID? What happens to every card built on it?" (drw0; every later digit changes)
  - Bonus: "dragon → donkey?" (drt3 again: collision)

### T20 · TERMINAL split → hash IDs
- **Title:** The ID comes from the card itself
- **Left terminal** (w 6.6, h 4.4). As built: Lab 1's dragon commit made on top of the T13 merge in `monster/` (user.name "Lab 1"), so the terminal and the card on the right are the same object:
  ```
  $ git cat-file -p HEAD
  tree 5a5fee2…
  parent 9f5707b…
  author Lab 1 <…> 1791104200 -0700
  committer Lab 1 <…> 1791104200 -0700

  face: dragon
  ```
  The tree ID `5a5fee2…` depends only on the content (face: dragon / body: robot with a cape / legs: tentacles, verified), so it matches on any machine. The parent ID and times differ live. Optional live version (15 s, right after the T13 merge): `sed -i 's/face: cat/face: dragon/' monster.txt && git commit -qam "face: dragon" && git cat-file -p HEAD`.
- **Right:**
  - One card at scale 1.0: Lab 1's card, tag `drt3`, 🐲 🤖🦸 🐙, "← #4".
  - A bracket around the whole card, with the label (20 pt): "ID = hash(everything on the card)".
  - Below it, 16 pt MUTED: "Ours: initials + check digit. Git: SHA-1 of the full commit text."
- **Pause bar:** 💬 Two labs draw identical cards on the same parent. Same ID?
- **Notes:**
  - "A commit is a tiny text object: a tree, its parents' IDs, author, committer, message. Its ID is the hash of that text. No central counter, and history is tamper-evident: a changed card is literally a different card." Use the real hashes from your live repo.
  - **Live, 20 s:** `echo 'face: smiley' | git hash-object --stdin` on Shubham's laptop and on one student's laptop. Both print `946ac5d…` (verified). Same content, same ID, anywhere, with no coordination.
  - Pause answer: in our toy, yes (our rule ignores the author). In Git: same *tree*, different *commit*, because author and time are hashed too. (Model Critics: write that down.)
  - Collision aside: Git uses 160 bits; SHAttered (2017) is why Git is moving toward SHA-256.

### T21 · TERMINAL → tree of blobs
- **Title:** Inside a card: a tree of blobs
- **Terminal** (w 11.833, h 3.9), in `monster-files/` (one file per panel):
  ```
  $ git ls-tree main
  100644 blob d591a27…   body.txt
  100644 blob 875229f…   face.txt
  100644 blob a27e19c…   legs.txt
  $ git ls-tree cat-robot
  100644 blob ba63925…   body.txt
  100644 blob ef07ddc…   face.txt
  100644 blob a27e19c…   legs.txt
  ```
  - Both `a27e19c…` highlighted (`#C792EA`).
- **Line under the terminal** (20 pt MUTED): card = commit · panel = file (blob) · all three panels = tree
- **Pause bar:** 💬 LEGS never changed. How many copies of it does Git store?
- **Notes:**
  - Answer: one. Same content → same blob ID → stored once. That's why "never erase" is cheap, and why writing "same" in Step 0 was blob reuse.
  - Optional: `git cat-file -p cat-robot^{tree}` shows the same three lines: a tree is just a list of names and blob IDs.
  - These blob IDs depend only on the content, so they match on every laptop. Commit IDs don't.
  - Merging this 3-file repo also conflicts only on `body.txt` (verified).

### T22 · TASK, Step 6 · timer "6:00"
- **Instruction:** Courier: put your card on the wall. Move `main` to it.
- **Sub-steps:**
  1. First come, first served
  2. Then walk back from `main`. Is every lab's card there?
- **Notes:**
  - Ananya accepts the first two cards and moves `main` each time. Freeze: "Lab 1, where's your dragon?"
  - The class invents the rule. Ananya moves `main` back to the first card, hands back the second ("REJECTED, fetch first"), and reads GUARD.
  - Check: "Your blue flag says #4. Where is the wall's `main` right now? How would you know?"
  - Rejected Couriers copy the new cards and move the blue flag (= fetch). Labs draw a combine card, compute its ID, move yellow `main` (= merge), and re-post.
  - AUDIT run 1 (30 s): Lab 1 traces how the tentacles reached `main`. They succeed.
  - Wrong answers: one-parent redraw on top → "you invented rebase"; Courier moves `main` anyway → "that's `push --force`".

### T23 · TALK → `git push` / `git pull`
- **Kicker:** You just invented
- **Command:** git push
- **Meaning:** The wall only moves forward. Your card must lead back to its main.
- **Visual:** the wall layout:
  - Lab 1 table: its card, plus a purple push arrow with a red × badge. Red mono 16 pt below it: `! [rejected] main -> main (fetch first)`
  - Lab 2 table: a blue dashed arrow from the Wall labelled `git fetch`, and the table's blue `origin/main` flag moved up. Under it, 16 pt: "pull = fetch + merge".
- **Pause bar:** 💬 Why refuse your card instead of just adding it?
- **Notes:**
  - "Remotes accept only fast-forwards. Otherwise someone's card falls off `main`, which is what you saw."
  - `git status` before fetching says `Your branch is ahead of 'origin/main' by 1 commit.` It only compares with your memory. After `git fetch`: `Your branch and 'origin/main' have diverged, and have 1 and 1 different commits each` (both verified).
  - "`pull --rebase` redraws your cards on top instead. Keep that in mind for Part 3."
  - On git 2.34 (tested) a plain `pull` of diverged branches refuses until you choose, so demo with `--no-rebase` (B2). Thursday comes back to this.

### T24 · DIVIDER (orange)
- **Kicker:** PART 3
- **Title:** Rewriting the past

### T25 · TASK, Step 7 · timer "3:00"
- **Before this slide:** Ananya posts the mustache card and says "Everyone pull."
- **Instruction:** The Client hates the mustache. Make it gone. For good.
- **Sub-steps:**
  1. Every lab already copied it
  2. Don't break anyone's table
- **Notes:**
  - Most labs rip it off. Then: "Lab 3: add one card on your newest card and push." GUARD accepts it, and the mustache comes back as a zombie.
  - The invention we want: a fix card that undoes it.
  - Check: "When is ripping it off OK?" (nobody else has it yet)

### T26 · TALK → `git revert` vs `git reset`
- **Kicker:** You just invented
- **Command:** git revert
- **Meaning:** Shared? Add a fix card. Private? You may move the flag back (reset).
- **Visual:** two halves divided by a hairline. Each half has a 16 pt Bold label on top:
  - **Left, "revert · safe when shared":** card ← 🥸 card ← fix card, with `main` on the fix card.
  - **Right, "reset · only if nobody copied it":** `main` moves back to the card before the 🥸 card. The 🥸 card is in `ghost` state with an orange label "unreachable, not deleted".
  - Cards at scale 0.62.
- **Pause bar:** 💬 Where did the ripped-off card go? Can you get it back?
- **Notes:**
  - "`revert` adds an inverse commit. `reset --hard` moves the branch; the commit still exists. On a shared branch you'd also need `push --force`, and you've just seen what that does to everyone else."
  - "`git reflog` is your local diary of where HEAD has been. It finds that card, and the detached-HEAD card from T10, until gc prunes it. Defaults: unreachable reflog entries expire after 30 days, others after 90."

### T27 · TASK, Step 8 · timer "3:00"
- **Instruction:** Boss: "This history is a mess. One clean card. Bin the rest."
- **Sub-steps:**
  1. Lab 3: open BOSS
  2. Lab 1: open AUDIT again
  3. Lab 2: does your newest card still fit?
- **Notes:**
  - Play the Boss straight: read the reason line aloud ("reviewers can't read 14 combine cards; bisect needs every card on main to work").
  - The Wall rejects the clean card, the Boss says "FORCE", and Ananya bins the old cards, then empties the bin.
  - Lab 1 fails the audit that worked 10 minutes ago. Ask: "Who lost what?"

### T28 · TALK → rebase / squash / force-push
- **Kicker:** You just invented
- **Command:** git push --force
- **Meaning:** Rebase and squash draw NEW cards. --force makes the wall forget the old ones.
- **Visual:**
  - Left: six `ghost` cards (scale 0.62) in two rows, with an orange label "rewritten away".
  - Right: one fresh card carrying the `main` flag. An orange "--force" label on the wall's flag.
- **Pause bar:** 💬 The wall forgot. Where in this room does the truth still exist?
- **Notes:**
  - "`git rebase -i` (squash) can't edit commits, because IDs are hashes. It writes new ones and moves the flag. `--force` moves the remote's flag."
  - Pause answer: Lab 2's stale table still holds every old card; local reflogs too. "Lab 1, you may now ask Lab 2's table. 30 seconds." They can answer again.
  - Then: "Which copy does an auditor or a researcher mine? How long do table copies last?" (The server. Table copies last until gc or reflog expiry, and only on that laptop.)
  - "The route the tentacles took to `main` is gone from the server. That's Tuesday's paper."

### T29 · PAUSE (think-pair-share, contrasting cases)
- **💬**
- **Question (40 pt):** The Boss has a real reason. So does the auditor. Invent ONE wall rule that serves both.
- **Three cases (24 pt, left-aligned under the question):** Does your rule allow…
  - a · squashing your 5 messy cards before anyone copied them?
  - b · force-pushing `main` to drop the mustache after everyone pulled?
  - c · "Squash and merge" of a teammate's 6-card idea via the PR button?
- **Chip:** Think 1 min · Pair 2 min · Share 2 min
- **Notes:**
  - Expected sort: (a) OK, it's private; (b) not OK, it's shared, it causes zombies, and it hides history; (c) the interesting one.
  - **Plan for wrong answers:**
    - A rule that only bans force-push lets (c) through: "No force needed. What did the auditor lose?" (the 6 cards and their route to `main`). (c) matches the squash example in Just et al.'s abstract; no numbers.
    - A pair proposes "never rewrite `main`": hand them the **KEY** card. (A fix card isn't enough: the key is still in every clone. Rewrite AND rotate the key.)
  - Write their rules on the board. Rules to expect or seed: protected `main`; squash only cards nobody else has; keep merge cards; tag or archive the branch before rewriting; `--force-with-lease`; the wall logs every push.
  - This is "inventing with contrasting cases". The next slide is the official answer.

### T30 · PAPER (three columns)
- **Title:** Switching to Git: the Good, the Bad, and the Ugly
- **Sub (20 pt, MUTED):** Just, Herzig, Czerwonka, Murphy · ISSRE 2016 · Microsoft Research
- **Columns** (header 24 Bold, body 24, step tag 16 MUTED):
  - **GOOD** (green header): "Cheap branches. Local commits." · *Steps 2–3*
  - **BAD** (INK header): "Many routes to main. Hard to trace." · *Step 6*
  - **UGLY** (orange header): "Rebase, squash, force-push erase history." · *Step 8*
- **Bottom line (24 pt):** Their algorithm: rebuild integration paths from what's left.
- **Notes:**
  - "The Good/Bad/Ugly split is our reading of the abstract. Don't quote numbers, and don't explain how their algorithm works: we only have the abstract."
  - "An *integration path* is the route a change took to `main`. You traced one in Step 6 and couldn't in Step 8. Auditors (e.g., the history of security or privacy code) and researchers mining history depend on it."
  - "Compare their countermeasures with your wall rules."
  - "Research angle: version history is a dataset that users can silently delete."

### T31 · MENTI (exit ticket)
- **Chip:** 📊 Live poll
- **Question:** Exit ticket · 4 questions · laptops closed
- **Visual:** QR + code chip.
- **Notes:** The questions are in §8 / `menti_questions.md` (Q-a to Q-d). Q-a tests the shared ancestor, Q-b that cards never change, Q-c fixing a rejected push, Q-d revert vs reset. Read the results out. **Any item under 70% correct:** redo it on cards right away (2 min from the buffer), and open Thursday's H4 with it.

### T32 · RECAP (mapping table)
- **Title:** Every Git tool fixes one problem you felt
- **Headers:** WE FELT… / WE INVENTED… / GIT CALLS IT

| We felt… | We invented… | Git calls it |
|---|---|---|
| Can't go back | Never erase: new card | git commit |
| Shuffled pile | "came from __" | git log |
| Risky ideas | flags; you are here | branch · HEAD |
| Two ideas, one monster | card with two parents | git merge |
| Work from my table | copy every card | clone · origin/main |
| Two #5s | ID from the card itself | SHA-1 hash |
| My card fell off | look, combine, post | fetch · pull · push |
| Bad card, already copied | fix card | git revert |
| Boss wants it neat | bin + FORCE | rebase · --force |

- **Notes:** "Almost every Git command makes a card, moves a flag, or copies cards between tables. Now: where does our model lie?"

### T33 · PAUSE (Model Critics)
- **💬**
- **Question:** Name one place our paper model lies.
- **Chip:** Model Critics · 30 s each
- **Notes:**
  - Each critic reads one entry. Seed answers, if needed:
    - In our model a card is a snapshot; `git gc` packs objects as deltas (packfiles). Both are true: snapshots in the model, deltas on disk.
    - The index is a real file (`.git/index`); our cards have no equivalent.
    - Git merges lines, not panels (T14, T15).
    - Our hash is a toy: it ignores author and time, and it collides (donkey).
    - `origin/main` moves only on fetch or push.
    - The reflog is local and never pushed.
    - Two pairs shared one table; in Git each clone or worktree has exactly one HEAD.
  - Bridge: "A model is a claim too. On Thursday we'll check other people's claims."

### T34 · STARRY
- **Kicker:** If you're going to remember one thing…
- **Statement:** Cards never change. / Flags move. / Walls copy cards.
- **Small line** (24 pt, `#CADCFF`): …and Git never erases, until you force it to.
- **Notes:** "Thursday: from how Git works to how humans struggle with it. Read the Stack Overflow study and bring one claim you don't believe, with its page number. You'll write it on a sticky at the door."

### Backups (after T34, hidden)

**B1 · TERMINAL:** "No blank lines: one big conflict" (shown by default after T14)
```
$ git merge superhero
CONFLICT (content): Merge conflict in monster.txt
<<<<<<< HEAD
face: cat
body: robot
legs: sticks
=======
face: smiley
body: superhero
legs: tentacles
>>>>>>> superhero
```

**B2 · TERMINAL:** "Step 6 in real Git"
```
$ git push
 ! [rejected]        main -> main (fetch first)
$ git fetch
$ git status
Your branch and 'origin/main' have diverged,
$ git pull --no-rebase
Merge made by the 'ort' strategy.
$ git push
   …  main -> main
```

**B3 · CONTENT:** "Fast lab? Try one."
- `git tag v1.0`: a flag that never moves.
- `git stash`: park a half-drawn card; take it back later.
- `git cherry-pick`: copy ONE change onto your branch. New card, new ID.
- `git blame`: for each panel, who last changed it? Use only came-from.

---

## 6. Thursday run-of-show (80 min)

**Teams:** reuse Tuesday's labs.
- Lab 1 = **Pink court** (headline claim about the Research Question)
- Lab 2 = **Blue court** (headline claim about Data Collection)
- Lab 3 = **Orange court** (headline claim about Analysis)

These are Sarah's axis colours. Every packet carries all three axis checklists, so every court practises all three axes.

**Roles:**
- **At the door:** Ananya hands each student a sticky: "The claim you don't believe + page number." During H2–H9 she sorts the stickies by axis onto the three court tables.
- **Slip experiment:** Shubham writes the prediction on the board; Ananya tallies.
- **Claim Court:** Shubham runs slides and Menti and floats with Orange. Ananya keeps time and floats between Pink and Blue. Both run the minute-5 board check.
- **Design sprint:** swap.

| Clock | Min | Block | Slides | Mode |
|---|---|---|---|---|
| 0:00 | 2 | Welcome (stickies collected at the door) | H1 | talk |
| 0:02 | 6 | Hook: rank the commands → reveal → link to Tuesday | H2–H4 | Menti + **PAUSE** |
| 0:08 | 1 | Goals | H5 | talk |
| 0:09 | 8 | The paper in 3 slides, then *you* place it (Menti × 2), reveal + pair pause | H6–H9 | talk + Menti + pairs |
| 0:17 | 5 | Slip experiment: deal, answer, predict, tally, discuss | H10–H12 | paper slips |
| 0:22 | 12 | Claim Court: rules (2) + courts work (10); board check at minute 5 | H13 | 3 teams |
| 0:34 | 11 | Court in session: jury vote, 3 courts × 3 min, jury re-vote | H14 | Menti + teams |
| 0:45 | 3 | Claimed vs measured | H15 | talk |
| 0:48 | 4 | **PAUSE:** is the RQ even interesting? | H16 | whole class |
| 0:52 | 4 | **Break** | H17 | Lay out the finding cards |
| 0:56 | 3 | Git listened (sometimes) | H18 | talk + pause |
| 0:59 | 12 | Design sprint: 7 min build, 5 min pitches | H19 | 3 teams |
| 1:11 | 4 | Exit: each student writes their own insight | H20 | Menti |
| 1:15 | 2 | Ours, for comparison | H21 | talk |
| 1:17 | 1 | One thing | H22 | — |
| 1:18 | 2 | Buffer | | |

**If late, cut in this order:**
1. Skip the break (+4 min).
2. Courts present only their starred claim, 2 minutes each (+3 min).
3. H16 discussion becomes 2 minutes (+2 min).
4. Pitches limited to 45 seconds (+1 min).

**Never cut:** H20 (the exit insight) and the H8 vote.

---

## 7. Thursday slide outline (22 slides) + answer key

Page numbers are article pages (111:N → p.N). Thursday slides use **no emoji**, except H4, which reuses Tuesday's Monster cards. Icons are simple shapes.

### H1 · TITLE
- **Title:** Git, Part 2: The Humans
- **Subtitle (20 pt):** Yang et al. "Do Developers Really Know How to Use Git Commands?" TOSEM 2022
- **Footer:** CS294: **Modern Programming Tools** | UC Berkeley | Shubham & Ananya
- **Bar (italic):** Git Week · User Study Day
- **Notes:** "Tuesday you built Git out of cards. Today: what happens when real humans use it, and what should tool designers learn? If you leave without one new design insight, we've failed." Stickies (claim + page) are collected at the door.

### H2 · MENTI (ranking)
- **Question:** Rank by average views per Stack Overflow question. Most viewed first.
- **Items** (as mono chips): `git rebase` · `git merge` · `git push` · `git revert` · `git checkout` · `git commit`
- **Notes:** Menti **Ranking** question, 45 seconds, results hidden. Tuesday primed `revert`, so the surprise is meant to be `merge` and `rebase`.

### H3 · TALK (reveal)
- **Title:** 4 of the top 5 are about going back.
- **Visual:**
  - Left: five chips: 1 `revert` · 2 `reflog` · 3 `stash` · 4 `clean` · 5 `reset`. Recovery chips are purple with a small curved back-arrow; `clean` is grey. Under `revert`: "21.7k avg views".
  - Right, titled "Your six, actual rank" (20 pt): `revert` 1 · `commit` 16 · `checkout` 17 · `push` 21 · `merge` 24 · `rebase` not in top 30.
- **Source (12 pt):** Avg. views per question, commands with ≥200 questions. Yang et al., Table 4, p.14.
- **Notes:**
  - Show the Menti class ranking first, then this slide.
  - The single most-voted question is "How do I undo the most recent local commits in Git?" (p.3).
  - "Hold on to this. In 20 minutes the Orange court will tell us how much to trust it."

### H4 · TALK (link to Tuesday)
- **Title:** You felt this on Tuesday.
- **Visual:** two Monster cards.
  - Left: the 🥸 card torn off, with a red ×, label "reset: move the flag back".
  - Right: a fix card pointing back to it (green), label "revert: add a fix card".
  - Tag below both: "reflog = the safety diary".
- **Pause bar:** 💬 Why was the mustache the hardest call on Tuesday?
- **Notes:** 60 seconds of shout-outs. Expected answer: you had to know who else already had the card. "Because cards never change, 'undo' is two operations with different blast radii. Thousands of developers got stuck exactly where you did." If a Tuesday exit item fell below 70%, re-ask it here.

### H5 · CONTENT (goals)
- **Title:** Today's goals
- **Lead:** After today, we should be confident you could:
- **List** (each line starts with a small dot in the colour shown):
  - (pink) Separate what a study measured from what it claims
  - (blue) Place a study on three axes and name its biggest threat
  - (orange) Turn a finding into a feature, plus how you'd know it worked
- **Notes:** Line 1: Claim Court. Line 2: you place the study yourselves in 5 minutes. Line 3: design sprint and exit.

### H6 · DIAGRAM: the paper, 1 of 3
- **Title:** The study in one picture
- **Visual:**
  - Left, a grey funnel of three stacked bars:
    - "198,626 SO questions tagged git (2008–2020)"
    - "contains an exact Git command string"
    - "**80,370 questions**"
  - The funnel feeds four pills: RQ1 How popular? · RQ2 Who asks? · RQ3 Which commands? · RQ4 Which are hard?
  - Small separate box: "Survey: 508 invited → **92 replied** → RQ5 How do people learn?"
- **Notes:**
  - 136 command names from the Pro Git book. Exact string match on the title, body, or accepted answer (p.5–6).
  - 600 questions hand-checked, Cohen's kappa 0.844 (p.6).
  - Respondents: 74 industry, 18 academia (p.9).
  - "Just what they did. No judging yet."

### H7 · CONTENT: the paper, 2 of 3
- **Title:** What they found
- **Rows**, each led by a small RQ tag:
  - **RQ1:** 0.4% of SO questions, but 1.5% of askers
  - **RQ2:** 2020: 40% of askers on SO 5+ years (all SO: 21%)
  - **RQ3:** Recovery tops views; 83% of questions mix commands
  - **RQ4:** Least answered: rare commands, then credential, submodule
  - **RQ5:** 81.7% of learning picks = self-learning
- **Source (12 pt):** Tables 1–4, 6, 7; Fig. 3.
- **Notes:** The authors' conclusion: Git is hard even for experienced developers, so teach it better and build recommenders. "Write down which of these five you believe least."

### H8 · DIAGRAM: the paper, 3 of 3 (you place it)
- **Title:** Where does it sit? You place it.
- **Left column, three blank prompts with coloured dots:**
  - RQ type: ______
  - Data: which rung? ______
  - Analysis: ______
- **Right:** Sarah's data ladder, four stacked bars with their labels, **no pills**: Observe people / Traces in the wild / Tricks to avoid introspection / Self-report.
- **Chip (top right):** 📊 → Menti
- **Notes:**
  - Two Menti multiple-choice questions, 60 s total (`menti_questions.md`): RQ type, then the rungs.
  - Reveal on H9 only after both votes close.
  - Wrong-answer plan:
    - "evaluative": "Which tool or intervention is being evaluated?"
    - "formative": "Which design is this feeding?"
    - Stack Overflow data on rung 1: "Did anyone watch a developer use git?"

### H9 · DIAGRAM: where it sits (reveal)
- **Title:** Where it sits
- **Left column, three lines with coloured dots:**
  - RQ: reconnaissance ("what goes wrong?")
  - Data: traces in the wild + self-report
  - Analysis: counts, means, rankings, coded comments
- **Right:** the same ladder, now with a blue pill "Stack Overflow" beside rung 2 and a grey pill "Survey" beside rung 4.
- **Pause bar:** 💬 Pairs, 90 s: what would you need to *observe* to know someone "knows how to use" a command?
- **Notes:** Show the vote results next to this. Rung 2 is good, and rung 4 is "consider rejecting". "Predict which half takes more heat."

### H10 · ACTIVITY (lavender) · timer "2 min"
- **Title:** One slip. Face down. Don't compare.
- **Numbered:**
  1. Flip your slip
  2. Answer it in one sentence
  3. Circle your Git level. Fold. Pass it in.
- **Notes:**
  - The slips are shuffled in one stack and dealt at random. Half say **A**: "In one sentence: what does `git rebase --onto main A B` do?" Half say **B**: "In one sentence: what does `git add` do?"
  - Both then show the paper's exact scale: Novice · Advanced beginner · Competent · Proficient · Expert.
  - Say nothing about the two versions yet.

### H11 · STATEMENT (prediction)
- **Title (small kicker):** Our prediction, written before we look
- **Statement (44 Bold):** Hard question first → lower median rating.
- **Sub (24 pt, MUTED):** If the medians tie or flip, we were wrong.
- **Notes:**
  - Shubham reveals the two slip versions and writes the prediction on the board *before* the tally.
  - Ananya tallies on the board: two rows of dots (A: rebase first / B: add first) × five levels. 60 seconds.

### H12 · TALK (result)
- **Title:** Same room, same week, different question first.
- **Lines:**
  - Paper: 92 respondents (median 8 yrs of Git): 14.1% rated Proficient+
  - Us: A median __ · B median __ (n ≈ 6 each)
- **Pause bar:** 💬 n ≈ 6 per group: what would it take for you to believe this?
- **Notes:**
  - Fill in the two medians from the board. Whatever happened, say what we can and can't conclude. Don't explain away a miss.
  - The hypothesis is Sarah's point: preferences and self-ratings can be constructed on the spot (Loftus, "smashed vs hit"). Our room is a weak test of it: tiny n, one question per group, random assignment but no replication.
  - Expected answers: a bigger sample, replication, the analysis fixed in advance (we did write the prediction), and a performance measure. We could score the one-sentence answers; RQ5 has no performance measure at all.
  - Link: the paper uses exactly this rating to conclude that "even experienced developers still have doubts" (p.19). The 14.1% is of all 92 respondents; the median of 8 years also describes all 92.
  - If asked: `git rebase --onto main A B` replays the commits after A, up to B, onto `main` as new commits.
  - "That's one claim. Let's put three more on trial."

### H13 · ACTIVITY (lavender) · timer "10 min"
- **Title:** Claim Court
- **Line:** One headline claim per court. On the claim card:
- **Numbered:**
  1. What did they actually measure?
  2. One other explanation
  3. Verdict: **BELIEVE · WEAKER (write it) · OBJECTION**
- **Small line:** Minute 5: write your "Measured:" line on the board.
- **Visual:** three tags: Pink · Research question | Blue · Data | Orange · Analysis.
- **Notes:**
  - Hand out the packets (7.1): the starred claim, one backup claim from another axis, table excerpts, and all three of Sarah's axis checklists on the back.
  - Each court may swap its backup for the most-shared student sticky in its axis.
  - **Board check, minute 5:** each court writes its starred claim's "Measured:" line on the board. A facilitator corrects it within 30 s against 7.1, before verdicts are built on a misreading.
  - Rule: a "weaker version" must be a sentence the data literally supports.
  - The presentation script on the packet back adds: one thing they did right, with a page.

### H14 · ACTIVITY + MENTI
- **Title:** Court is in session
- **Line:** Jury: how much do you believe it? 1–5 → Menti
- **Three quote cards (pink / blue / orange):**
  - "even developers with years of development experience can have trouble using Git commands" (p.13)
  - "self-learning is the primary way for developers to learn to use Git commands" (p.20)
  - "Git commands … about recovery are among the most popular commands asked on Stack Overflow" (p.15)
- **Notes:**
  - Everyone votes (1 min). Then each court gets 3 minutes: verdict, the measured-vs-claimed gap, the weaker version, and one thing done right. Then re-vote and show the shift.
  - Expected: Pink and Blue drop, Orange mostly survives. "Critique = calibrating belief, not rejecting everything."

### H15 · TALK (two-column table)
- **Title:** Claimed vs measured

| They said | They measured |
|---|---|
| "difficult" | % with no accepted answer (n can be 1) |
| "experienced" | years since joining Stack Overflow |
| "how developers learn" | multi-select picks from 92 recent SO askers |
| "popular" | mean views, credited to every command in the post |

- **Bottom line (28 pt Bold):** 80,370 rows can't fix a weak proxy.
- **Notes:**
  - Credit by name any student whose sticky claim was used in court.
  - Fill in anything the courts missed, especially A2: a question with no accepted answer can only enter a command's pile through its own text, so commands that appear in error reports (clone, push, pull) look hard.
  - Credit what's good: real traces, baselines against all of SO, public data.

### H16 · DIVIDER (pink) used as a question
- **Title:** Is the research question even interesting?
- **Sub (28 pt):** They counted commands. People have goals.
- **Notes:** 4 minutes, whole class. Prompts:
  - "Would a tool designer rather know which strings appear, or what people were trying to do?"
  - Only 17% of questions involve a single command (Fig. 3, p.15).
  - The authors explicitly decline to engage with design: "Rather than changing the design of Git…" (p.26). Yet they cite De Rosso & Jackson.
  - "Re-run this in 2026: where would the traces even be?" (The data ends in 2020; many questions now go to AI assistants.)
  - Facilitator-only claims P2, B3, O3 (7.1) can be raised here.

### H17 · BREAK
- **☕** · 4-minute break · Back at __:__
- **Notes:** While they're out, put one face-down finding card on each table.

### H18 · DIAGRAM (two halves)
- **Title:** Git listened (sometimes).
- **Left half, label "Split the verb · Git 2.23 (2019)":** a grey mono box `git checkout` splits with two arrows into purple boxes `git switch <branch>` and `git restore <file>`.
- **Right half, label "Make you choose · Git 2.34, Tuesday":** a small terminal panel:
  ```
  $ git pull
  hint: You have divergent branches and need
        to specify how to reconcile them.
    git config pull.rebase false  # merge
    git config pull.rebase true   # rebase
    git config pull.ff only       # fast-forward only
  fatal: Need to specify how to reconcile
         divergent branches.
  ```
- **Small line:** Their own quote: "What exactly does git checkout [file] do?" (p.13)
- **Pause bar:** 💬 One fix splits the verb; the other makes you pick a config option. Which is better design, and what study would tell you?
- **Notes:**
  - Left: one verb used to do three jobs. Git split it by *user intent*. (`checkout` still works.)
  - Right: the output is real (verified on 2.34.1; lines lightly trimmed). Tuesday's B2 needed `--no-rebase` because of it.
  - Contrasting case: Jujutsu (`jj`) logs every operation, and `jj undo` reverses the last one: recovery as a first-class feature.
  - Good answers to "what study": a lab task with logged time-to-success or error rate, not "do you like it?".

### H19 · ACTIVITY (lavender) · timer "7 min"
- **Title:** Design sprint: fix one finding
- **Line:** Flip your finding card. One index card. Each person owns one line and initials it:
- **Numbered:**
  1. Sketch what the user sees
  2. It fixes ___ because ___
  3. Does ___ reduce ___ for ___ doing ___?
  4. How you'd measure it (logged or observed)
- **Small line:** 60-second pitch · next team asks one Reviewer-2 question
- **Visual:** three fanned cards with shape icons: curved arrow = RECOVERY · chain = COMBOS · open book = SELF-TAUGHT.
- **Notes:** Line 3 is Sarah's evaluative RQ template, and line 4 forces them up the ladder. Pitch order: Pink, Blue, Orange. Fast teams get the bonus card.

### H20 · MENTI (exit, individual)
- **Question:** On your own: Finding (with evidence) → I'd change the tool so that ___ → I'd know it worked if ___ (logged or observed, not self-report).
- **Notes:**
  - Menti open-ended, 3 minutes, individual, *before* H21. Read 3–4 answers aloud.
  - An answer that is only critique: "…so a tool designer should what?"
  - **Follow-up:** any answer missing a finding or using a self-report measure gets "so a tool designer should what, and how would you know?" in the post-class Ed message.

### H21 · CONTENT
- **Title:** Ours, for comparison
- **Five lines, each with a small shape icon:**
  - Make the way back visible.
  - One verb, one purpose.
  - Show the model, not the commands.
  - The error message is the manual.
  - Make destruction deliberate.
- **Notes (evidence → example):**
  - **Way back:** recovery tops the views; reflog is invisible until disaster → `jj undo`, GitHub Desktop "Undo".
  - **One verb:** the checkout overload → switch/restore.
  - **Model:** respondent #26: "hard to do without understanding the basic concepts" (p.21) → Tuesday's cards, flags, and wall.
  - **Error message:** respondent #42: "Years on, I still constantly have to search the internet" (p.21) → Git's `hint:` lines on a rejected push, `help.autocorrect`.
  - **Destruction:** Tuesday's paper → `--force-with-lease`, protected branches.
  - **For builders:** measure struggle, not popularity.
  - Ask: "Whose exit answer is *not* on our list? That's the new insight."

### H22 · STARRY
- **Kicker:** If you're going to remember one thing…
- **Statement:** Question the proxy. / Design the way back.
- **Notes:** "First half: the reader's lesson. Second half: the builder's lesson. Undo is where humans and Git collide."

### 7.1 Claim Court packets (★ = headline claim for the jury)

**Packet contents:**

| Court | Starred claim | Backup (another axis) |
|---|---|---|
| Pink | P1★ | B2 |
| Blue | B1★ | O2 |
| Orange | O1★ | P3 |

- P2, B3, and O3 are **facilitator-only**; raise them on H15/H16.
- A court may swap its backup for the most-shared student sticky in its axis.
- **Claim card:** the exact quote with its page, and three boxes: *What did they actually measure?* / *One other explanation* / *Verdict: BELIEVE · WEAKER (write the sentence) · OBJECTION*.
- **Back of every packet:** all three of Sarah's axis checklists, plus the presentation script (verdict → gap → weaker version → one thing they did right, with a page).
- **Axis checklists, print text** (from Sarah's "Understanding User Studies" deck):
  - **PINK · Research question.** Reconnaissance, formative, or evaluative? Is the RQ even interesting: would the answer change what a tool builder does? Does the title promise more than the RQ asks?
  - **BLUE · Data collection.** Which rung: 1 observe people · 2 traces in the wild · 3 tricks to avoid introspection · 4 self-report (consider rejecting)? Can this data even answer the RQ? Who is in the sample, and who is missing? Could it miss true things, learn false things (leading questions, preferences constructed on the spot, demand characteristics), or learn true things poorly?
  - **ORANGE · Analysis.** What exactly is the measure (operationalization)? Tiny n, significant-but-tiny effects, ceiling or floor? Means vs medians; self-ratings and Likert scales should make you nervous. Qualitative: is a method named? ("Vibes are not an answer.") Does the prose match the numbers? Internal, external, ecological validity. Do you believe the analyzers' answer?
- **Table excerpts per packet** (photocopy from the PDF; article page numbers):
  - Pink: Table 3 (p.12) + the p.12 "never had the time to learn about version control" quote (P1); Fig. 4 and the expertise paragraph (p.19) (B2).
  - Blue: Table 7 (p.20) + recruitment text and footnote 7 (p.9) (B1); Table 6 (p.17) + the p.18 claim (O2).
  - Orange: Table 4 (p.14) + the multi-credit paragraph (p.13–14) + Table 2 (p.11) (O1); Table 1 (p.10) (P3).
- **Board-check answers** (minute 5), the "Measured:" line for each starred claim:
  - P1: SO registration years of askers.
  - B1: share of 197 checkmarks in a multi-select question, from 92 respondents recruited among SO Git askers.
  - O1: mean views of questions containing the command anywhere (title, body, or accepted answer), for commands with ≥200 questions.

**PINK: Research Question ("Answerable? Interesting?")**

**P1★** "even developers with years of development experience can have trouble using Git commands" (p.13; Table 3)
- **Measured:** SO registration years. In 2020, 40.0% vs 21.2% of askers had been registered 5+ years.
- **Alternatives:**
  - SO tenure ≠ Git experience. Their own example (p.12): "I've been developing for several years now, and I've never had the time to learn about version control."
  - Composition effect: experienced people stop asking language questions.
  - Adoption wave: Git reached people who were already SO users.
- **Weaker version:** "Git-command askers have been on SO longer than typical askers."
- **Did right:** a per-year baseline against all of SO.

**P2** (facilitator-only) The title, "Do Developers Really Know How to Use Git Commands?"
- **Measured:** help-seeking and views, not knowledge.
- **Verdict:** OBJECTION to the framing. Rewrite: "Which Git commands appear in highly viewed SO questions?" Better: "What are developers trying to do when they turn to SO about Git?"

**P3** (Orange's backup) "the ratio of questioners is larger than the ratio of questions. This confirms from another perspective that many developers have faced difficulties" (p.10, Table 1)
- **Measured:** share of askers (~1.5%) vs share of questions (~0.4%).
- **Alternatives:** Git is used from every language, so the asker pool is all of SO; one-off askers; no baseline for another universal tool (shell, package manager).
- **Weaker version:** "Git questions come from an unusually broad set of askers who each ask few."

**BLUE: Data Collection ("Can this data answer the RQ?")**

**B1★** "self-learning is the primary way for developers to learn to use Git commands" with "81.7% … of all the learning approaches" (p.20, Table 7)
- **Measured:** the share of 197 checkmarks in a multi-select question, from 92 people recruited among recent SO Git askers (p.9), recalled years later.
- **Alternatives:**
  - Sampling on the outcome.
  - Per person: 85/92 internet, 76/92 docs, 15/92 peers, 10/92 online course, 8/92 class.
- **Weaker version:** "Nearly all of 92 SO-active respondents report learning from the internet and docs; 8 report a class."
- **Did right:** raw counts published; survey piloted with 5 grad students.

**B2** (Pink's backup) "most respondents considered their expertise level is just advanced beginner or competent … indicating that even experienced developers still have doubts about Git usage" (p.19)
- **Measured:** one self-rating; no task performance.
- **Alternatives:** modesty; a rating constructed on the spot (the hypothesis our slip test probed, weakly); recent confusion is fresh because they had just asked on SO.
- **Weaker version:** "Respondents rate themselves modestly relative to their years of use."

**B3** (facilitator-only) "The actual results of our questions indicate that the respondents understand the intent of the survey questions. Therefore, we think this threat is minimal." (p.24), plus footnote 7 (p.9): emails obtained via GitHub, "discouraged … by GitHub's policy".
- **Measured:** nothing. The argument is circular.
- **Also:** no ethics review or consent is mentioned anywhere. 92/508 = 18.1%, but 18.5% is reported (p.24).
- **Verdict:** OBJECTION. "As a reviewer, what would you ask for?"

**ORANGE: Analysis ("Do you believe the analyzers?")**

**O1★** "Git commands (e.g., git revert and git reflog) about recovery are among the most popular commands asked on Stack Overflow" (p.15; Table 4)
- **Measured:** mean views of questions whose title, body, or accepted answer contains the command. Every command in a post gets full credit (p.7, p.13). Commands with fewer than 200 questions are dropped.
- **Alternatives:**
  - The mega "undo" question (p.3) lifts every command in its answer.
  - Views accumulate over the years (Table 2).
  - Means, no medians.
- **Verdict:** WEAKER, but it mostly survives: the result is consistent across favourites and score.
- **Did right:** the 200-question filter.

**O2** (Blue's backup) "some of the seldom used Git commands (e.g., git pack-redundant and git http-push) are ranked high" (p.18); educators should prioritise them (p.23)
- **Measured:** % with no accepted answer, with n = 1 and n = 3 (Table 6).
- **Problems:** RQ4 has no minimum-n filter (RQ3 had one); no baseline; acceptance depends on the asker; inclusion bias (A2).
- **Verdict:** OBJECTION.

**O3** (facilitator-only) "the median time (3.24 hours) to receive accepted answers … compared to … 21 minutes [32]" (p.18)
- **Measured:** 3.24 h is the *average* of per-command medians over the 30 least-answered commands (Table 6, "Average" row). The 21 minutes is an SO-wide median from a 2011 study.
- **Verdict:** OBJECTION to the comparison: selected on the outcome, a different statistic, a different era.

### 7.2 Design-sprint finding cards
| Card | Finding (evidence) | Prompt |
|---|---|---|
| RECOVERY | 4 of the top 5 commands by views are about going back (Table 4) | Design a way back. |
| COMBOS | Only 17% of questions involve one command; 5-command combinations are the most common (22%) (Fig. 3) | People have goals; Git has commands. Design for the goal. |
| SELF-TAUGHT | 85/92 learned from the internet, 76/92 from docs, 8/92 in a class (Table 7) | The tool is the teacher. Design the teaching moment. |
| BONUS: HISTORY | Rebase, squash, and force-push can destroy history others need (Just et al., abstract; no numbers) | Make destruction deliberate. |

### 7.3 Critique points the class should discover (answer key)
★ = must surface. If no court finds a ★ item, the facilitator raises it on H15 or H16.

| # | Axis | Issue | Evidence |
|---|---|---|---|
| R1★ | RQ | The title asks about *knowing*; the data measures *asking*. Reconnaissance on traces can't measure competence. | Title; p.26 |
| R2★ | RQ | Experience is proxied by SO registration years. Their own example contradicts it. The threshold drifts: "four years" (p.4, p.13) vs "five years" (p.12, p.22). | p.12–13, p.22 |
| R3★ | RQ | The unit is the command string, not the user's goal. 83% of questions mix commands. The authors decline to engage with design. | Fig. 3, p.15; p.26 |
| R4 | RQ | Views measure audience size. Comparing with concurrency, big data, and security pits a universal tool against niche topics. | p.13 |
| R5 | RQ | An untested causal claim is built into the design: "there should be a causal relationship between the difficulties and the developer's approach to learning." | p.8 |
| R6 | RQ | Ecological validity: data ends in 2020; Git 2.23 changed `checkout`; in 2026 many questions go to AI assistants. | p.5 |
| D1★ | Data | The survey samples on the outcome: respondents were recent SO Git askers. | p.9 |
| D2★ | Data | Self-report and recall, plus a self-rated Novice–Expert scale with no performance measure. Sarah: "consider rejecting." | p.8, p.19 |
| D3 | Data | Ethics: emails obtained against GitHub's policy; no ethics review or consent mentioned. Credit: they disclosed it. | fn. 7, p.9 |
| D4 | Data | Validation checked "relevant to Git commands", not *which* command a question is about. An error log containing `git push` counts as push. | p.6 |
| D5 | Data | 92/508 = 18.1% vs the reported 18.5%. Non-response bias is dismissed with a circular argument. | p.9, p.24 |
| A1★ | Analysis | Multi-crediting + means + views accumulating over the years: a few mega-posts dominate. No medians. | p.7, p.13; Table 2; p.3 |
| A2★ | Analysis | Inclusion is coupled to the outcome. Without an accepted answer, only the question's own text counts, so answer-type commands look easy and problem-report commands (clone, pull, push are all in Table 6's top 30) look hard. | p.6, p.8; Table 6 |
| A3★ | Analysis | Inconsistent filtering: RQ3 needs ≥200 questions, but RQ4 ranks n = 1 and n = 3 first and then tells educators to prioritise them. | p.13; Table 6; p.23 |
| A4 | Analysis | No baseline for "% with no accepted answer": 37.2% for clone means nothing alone. | Table 6 |
| A5 | Analysis | 3.24 h is an average of medians over an outcome-selected subset, compared with a 2011 SO-wide median. | p.18; ref [32] |
| A6★ | Analysis | 65 comments "further categorized", with no named method, coders, or agreement. "Vibes are not an answer." | p.9, p.20–21 |
| A7 | Analysis | 81.7% is a share of checkmarks, not of people. | p.20 |
| A8 | Analysis | Prose outruns the data: see list below. | as listed |
| A9 | Analysis | Apriori rules like {add}⇒{commit} are surface-level. | Table 5 |

**A8, the prose-vs-data slips:**
- "documentation … not yet complete" is inferred from 85 vs 76 picks (p.20).
- citool and upload-archive are called "third and fourth-lowest" when they are the highest (p.16).
- The "conservative statement" is unjustified (p.12).
- "Only 16.8% instructional … so provide training" is a non sequitur (p.22).
- "git pull-request" is not a Git command (p.3).

**Each court must also name one thing they did right:**
- rung-2 traces at scale, with public data
- per-year SO baselines
- 600-question validation with kappa
- the 200-question popularity filter
- several difficulty metrics, with an honest "no uniform standard"
- a pilot survey and candid footnote 7
- a recovery signal that holds across views, favourites, and score

### 7.4 Planning for wrong answers (Thursday)

**H8 placement vote:**
- "evaluative": "Which tool or intervention is being evaluated?"
- "formative": "Which design is this feeding?"
- SO data on rung 1: "Did anyone watch a developer use git?"
- Survey on rung 3: "What trick did they use to avoid introspection?"

**Slip experiment:**
- "Average the ratings": "It's an ordinal scale. Why is the median safer?"
- "The groups differ because of who got which slip": "That's exactly why we dealt them at random. What else could still differ?"
- The prediction fails: say so plainly. "We were wrong, or n was too small to tell. Both are honest. Explaining it away is not."

**Claim Court:**
- **A court believes P1:** "Five years of *what*?" Point at p.12.
- **A court rejects everything:** enforce the weaker-version box and the did-right line of the script.
- **Nitpicks:** "Does it change the conclusion?"
- **Orange misses A2:** "Can a question with no accepted answer enter reflog's pile through the answer?"
- **Blue misses D1:** "Who exactly got the email?"
- **Board check shows a misread "Measured" line:** correct it on the spot, in one sentence, before verdicts.

**Design sprint and exit:**
- **"Better docs":** "Where is the user at that moment?" (in the terminal, mid-mistake)
- **A self-report measure:** "That's rung 4. What could you log or observe?" (e.g., time to recover a lost commit in a lab task)
- **"An AI chatbot":** allowed, but show what the user sees and how you'd know it helped.
- **Exit answer with no finding or a self-report measure:** follow up in the post-class Ed message (H20 notes).

### 7.5 Fact guardrails (both days)
- Say "81.7% of *selections*", never "of developers".
- 14.1% Proficient+ is out of all 92 respondents. The median of 8 years of Git also describes all 92, not the 14.1%.
- `rebase` isn't "unpopular". It just isn't in the top 30 by average views.
- Our slip test is a weak study. Never call its result a finding.
- **No numbers from Just et al.:** we only have the abstract. Don't describe how their algorithm works.
- Response rate: the paper says 18.5%, the arithmetic gives 18.1%.
- `switch` and `restore` (Git 2.23) did not remove `checkout`.
- Don't reveal the SO top-5 on Tuesday. It would spoil Thursday's H2 ranking.

---

## 8. Mentimeter questions (summary)

Two presentations, Tuesday and Thursday. Hide results until voting closes. For multiple-choice "quiz" items, mark the correct answer in Menti. **Copy-paste text, timing, and follow-ups are in `menti_questions.md`.**

| Deck | Slide | Type | Exact text | Options | Correct |
|---|---|---|---|---|---|
| Tue | T2 | Multiple choice | You type `git branch experiment`. What does Git create? | A copy of all your files / A copy of all your commits / One new commit / One tiny file holding one ID | **One tiny file holding one ID** (revealed on T10) |
| Tue | T14 | Multiple choice | I delete the blank lines and merge again. What conflicts? | BODY only / FACE + BODY / All three lines / Nothing | **All three lines** |
| Tue | T31 Q-a | Multiple choice | BASE: smiley, box, sticks. Lab 1: cat, box, sticks. Lab 2: cat, box, roller skates. Merge. What conflicts? | FACE / LEGS / FACE and LEGS / Nothing | **Nothing** (same change on both sides; only Lab 2 touched LEGS) |
| Tue | T31 Q-b | Multiple choice | You `git commit --amend` a commit you already pushed. Its ID… | stays the same / changes, and the old commit still exists / changes, and the old commit is deleted | **changes, and the old commit still exists** |
| Tue | T31 Q-c | Multiple choice | Your push says `! [rejected] main -> main (fetch first)`. What do you run? | git push --force / git pull, then git push / delete your commit and redo it / wait, then push again | **git pull, then git push** |
| Tue | T31 Q-d | Multiple choice | A bad commit is on shared main. Two teammates already pulled. Safest undo? | git revert, then push / git reset --hard HEAD~1, then push --force / git commit --amend, then push --force / git rebase -i (drop it), then push --force | **git revert, then push** |
| Thu | H2 | Ranking | Rank by average views per Stack Overflow question. Most viewed first. | git rebase / git merge / git push / git revert / git checkout / git commit | revert > commit > checkout > push > merge > rebase (Table 4: 1, 16, 17, 21, 24, not in top 30) |
| Thu | H8 Q1 | Multiple choice | What type of research question is this study? | Reconnaissance (need-finding) / Formative / Evaluative | **Reconnaissance** |
| Thu | H8 Q2 | Multiple choice | Which rungs of the data ladder? | SO: 1 · Survey: 2 / SO: 2 · Survey: 4 / SO: 2 · Survey: 3 / SO: 4 · Survey: 4 | **SO: 2 · Survey: 4** |
| Thu | H14 (before) | Scales 1–5 (1 = don't believe, 5 = fully believe) | How much do you believe each claim? | 3 statements: Pink P1 quote / Blue B1 quote / Orange O1 quote | — |
| Thu | H14 (after) | Scales 1–5 (duplicate) | Now how much do you believe each claim? | same 3 statements | — (show next to "before") |
| Thu | H20 | Open ended | On your own: Finding (with evidence) → I'd change the tool so that ___ → I'd know it worked if ___ (logged or observed, not self-report). | — | — |

Q-a relies on the rule as written on T12: "Both changed **differently** → you decide." Identical changes merge cleanly (verified in real git). The Thursday self-rating is on paper slips, not Menti (H10).

---

## 9. Visual system

**As built:** the shared style library is `slides/build/style.py` (it supersedes the first prototype `design/vis.py`; the v2 changes FACE/BODY/LEGS rows, the blue `origin/main` flag, the legend-free CONFLICT layout, and toy IDs from Step 5 on are all in it). `slides/build/style_sample.pptx` is its test deck.

**Builders:**
- `python3 slides/build/build_tuesday.py` → `slides/tuesday_monster_lab.pptx` + PNGs in `slides/renders/tuesday/` (`t-NN.png`)
- `python3 slides/build/build_thursday.py` → `slides/thursday_git_user_study.pptx` + PNGs in `slides/renders/thursday/` (`h-NN.png`)
- Add `--no-render` to skip the PNGs. Both scripts audit text overflow before saving.
- Menti: set `MENTI_CODE` and drop the QR PNG at `MENTI_QR` (top of each script: `slides/assets/menti_qr_tue.png`, `slides/assets/menti_qr.png`), then rebuild. Or paste them in Google Slides after import.

**Rendering:**
- Both builders (and `python3 design/render_png.py <deck.pptx> <outdir> <prefix>`) export one PNG per slide at 1280×720 and **keep colour emoji**.
- LibreOffice 7.3's PDF export drops Noto Color Emoji, so soffice→pdf→pdftoppm is only valid for emoji-free checks. The preview PDFs in `slides/renders/tuesday/` and `slides/renders/thursday/` are stitched from the emoji-correct PNGs instead (hidden backups included).
- Always use a private profile: `-env:UserInstallation=file:///tmp/lo_<name>`.
- The old renders in `slides/renders/vis/`, `vis_png/` and `sample/` are obsolete.

### 9.1 Canvas
- **Size:** 13.333 × 7.5 in (`Emu(12192000) × Emu(6858000)`), blank layout 6.
- **Margins:** 0.75 in left and right; content width 11.833 in.
- **Chip and kicker row:** y 0.60.
- **Progress dots:** y 6.92 (task) / 7.12 (talk).
- **Two column splits only:** full width, or a 6.6 in text column plus a visual zone at x 7.75–12.58.
- **Alignment:** text slides are left-aligned. Dividers, statements, pause, break, and starry slides are centred.

### 9.2 Palette (fixed meanings, never reused)
| Token | Hex | Meaning |
|---|---|---|
| BG | `#FFFFFF` | default background |
| INK / INK2 | `#111111` / `#555555` | text; secondary text, arrows |
| MUTED / HAIR | `#919191` / `#E3E3E3` | labels and footer (≥13 pt); table rules |
| PURPLE | `#9437FF` | Sarah's footer bar; **Git vocabulary** (commands); current progress dot |
| PINK | `#FF2F92` | Part-1 / RQ divider; **HEAD pin** |
| BLUE / BLUE_T | `#00A2FF` / `#E8F6FF` | Part-2 / Data divider; **remote / the Wall**, pull/clone/fetch arrows, `origin/main` flag |
| ORANGE | `#FF9300` | Part-3 / Analysis divider; **rewritten / destroyed history**; "Ugly" |
| LAVENDER | `#F6ECF8` | **students are doing something**: task background, pause bar |
| RED / RED_T | `#E02424` / `#FDECEC` | **conflict / rejected / error only** |
| GREEN / GREEN_T | `#1E9E4A` / `#E6F6EC` | **auto-merged / safe only** |
| YELLOW / YELLOW_T (+ edge `#E8C547`) | `#FFE45E` / `#FFF6C7` | branch flags; "changed vs BASE" tint; break background |
| PANEL | `#FAFAFA`, line `#DDDDDD` | card panels, table zones |
| GHOST / GHOST_T | `#BDBDBD` / `#F3F3F3` | ghost (unreachable or rewritten) cards |
| NAVY | `#0A1631` | starry background |
| TERM | `#16181D` | terminal panel |

**Text on colour:** INK on pink, blue, orange, and yellow (Sarah's black-on-colour). White on purple, navy, and terminal.

**Code colours:**

| Element | Hex |
|---|---|
| prompt `$` | `#7C8594` |
| command | `#F5F5F5` |
| output | `#A9B1BD` |
| CONFLICT / error | `#FF6B6B` |
| success | `#5AD17A` |
| `<<<<<<< ======= >>>>>>>` | `#FFB020` |
| highlight | `#C792EA` |

### 9.3 Fonts and type scale
- **Fonts:**
  - **Inter** (Regular, Bold, and Italic only, no weight-named families) for all text.
  - **Noto Sans Mono** for code.
  - Both are Google Fonts, so Slides renders them natively. Avenir is not available in Slides; Inter is the stand-in.

| Role | Size / weight |
|---|---|
| Title-slide and divider title | 60 Regular |
| Big statement, starry statement | 54 Bold (starry kicker 36 Regular) |
| Talk command | 54 Mono Bold, purple |
| Task instruction, Menti question, pause question | 44 Bold (40 when a visual zone or case list is used) |
| Diagram, recap, and paper titles | 40 Bold; terminal title 36 Bold |
| Talk meaning | 32 Regular |
| Task sub-steps | 28 Regular (purple bold numerals); conflict rule line 28 Bold |
| Menti options, footer, subtitle | 26 |
| Kicker, pause-bar text, paper columns, T29 cases | 24 |
| Terminal code | 20 Mono (18 minimum) |
| Chips | 18–20 Bold; table header 15 Bold uppercase MUTED |
| Diagram metadata | 13–14 |

**Minimum sizes:** 20 pt for anything students must read; 13 pt only for card metadata.

### 9.4 Layouts (inches: x, y, w, h)

**TITLE (white)**
- Title: (0.75, 2.30, 11.833, 1.40), 60, centred, anchored bottom.
- Subtitle: (0.75, 3.85, 11.833, 0.70), 26 INK2.
- Footer row: y 6.20, h 0.55, 26 MUTED.
  - Left (0.30, w 6.70): "CS294: **Modern Programming Tools**"
  - Centre (7.05, w 2.60): "UC Berkeley"
  - Right (9.65, w 3.38), right-aligned: "Shubham & Ananya"
- Purple bar: (0, 6.81, 13.333, 0.48).
- Bar text: italic white 26, right-aligned.

**DIVIDER (full-bleed section colour)**
- Kicker: (0.75, 2.45, 11.833, 0.50), 24 Bold, e.g. "PART 2".
- Title: (0.75, 3.00, 11.833, 1.50), 60, centred.

**TASK (lavender)**
- Step chip: (0.75, 0.60, 1.55, 0.50), INK pill, "STEP 3", 18 Bold white.
- Timer chip: (10.833, 0.60, 1.75, 0.50), white pill with a 1.5 pt INK line, "⏱ 5 min", 20 Bold.
- Instruction: (0.75, 1.55, 11.833, 2.25), 44 Bold, ≤2 lines (~60 characters).
- Sub-steps: (0.75, 4.00, 11.833, 2.45), 28, ≤3 lines of ≤8 words.
- Progress: 9 dots, d 0.13, gap 0.11, right edge 12.583, y 6.92. Current dot purple, done INK, future `#D6D6D6`.

**TALK (white)**
- Kicker: (0.75, 0.60, 11.833, 0.50), 24 INK2, "You just invented" (T18: "You were cloned").
- Command: (0.75, 1.12, 11.833, 1.05), 54 Mono Bold purple.
- Meaning: (0.75, 2.30, 11.833, 1.20), 32, ≤15 words.
- Diagram zone: x 0.75–12.58, y 3.75–6.00. Cards at s 0.85, top y 3.85.
- Pause bar: (0.75, 6.20, 11.833, 0.72), lavender, radius 0.14, inset 0.30, 24 pt "💬 question". Pause questions longer than one line at 24 pt (T5, T10) may drop to 22 pt; never wrap to a third line.
- **Fork diagrams** (T10): one-line meaning, diagram zone y 3.10–6.10, cards at s 0.56–0.6. Flags go on the tip card's **right edge** (x = r − 0.15, y = t + 0.15, −4°), so stacked cards never overlap.

**CONFLICT (white; T12 only)**
- Kicker: (0.75, 0.45). Command `git merge`: (0.75, 0.85, 11.833, 0.95), 54 Mono purple.
- Four cards at s 1.0 (1.70 × 2.45), top y 2.25:
  - BASE x 1.85
  - CAT-ROBOT x 4.45
  - SUPERHERO x 6.75
  - MERGED x 9.05
- Glyphs (40 MUTED): "+" centred at x 6.45, "=" centred at x 8.75. A thin HAIR vertical rule at x 4.05 separates BASE from the rest.
- **One label per card**, grey 15 Bold uppercase, centred above each card at y 1.80: BASE · CAT-ROBOT · SUPERHERO · MERGED. No branch flags, no legend.
- Row labels FACE / BODY / LEGS, right-aligned, ending at x 1.70.
- CONFLICT pill (1.25 × 0.34) at x 10.87, centred on the BODY row.
- Rule line: (0.75, 5.10, 11.833, 0.60), 28 Bold.
- Pause bar: y 6.20.

**MENTI (white)**
- Chip: (0.75, 0.60, 2.20, 0.48), purple, "📊 Live poll".
- Question: (0.75, 1.40, 8.10, 3.30), 44 Bold.
- QR box: (9.333, 1.40, 3.25, 3.25), dashed. Replace with `add_picture` in the same box.
- Code chip: (9.333, 4.85, 3.25, 0.60), INK pill, "menti.com · ____".
- Options: (0.75, 4.95, 8.10, 1.90), 26, purple letters A–D (H2 uses 6 mono chips in two rows; H20 has no options and a 36 Bold question).

**TERMINAL**
- Title: (0.75, 0.55, 11.833, 0.80), 36 Bold.
- Panel: (0.75, 1.60, 11.833, 5.10), TERM, radius 0.16, three window dots.
- Capacity: ≤11 lines at 20 pt, ~66 characters per line.
- Split variant: two panels (0.75, w 5.6) and (6.73, w 5.85); or terminal w 6.6 plus a diagram at x 7.75–12.58. With a pause bar, panel h = 4.4 (T21: h 3.9 plus a 20 pt line at y 5.60).

**STATEMENT / CONTENT (white)**
- Title: (0.75, 0.45, 11.833, 0.85), 40 Bold.
- Body: ≤5 short lines at 28–32. The numbered goals list is the only list (B3 is a hidden backup).

**PAPER (white; T30)**
- Title 40 Bold, then the subline at 20.
- Three columns of w 3.78 at x 0.75 / 4.78 / 8.80, from y 2.0 to 5.4. Each column: a colour-coded 24 Bold header, a 24 body, and a 16 MUTED step tag.
- Bottom line: y 5.9, 24 pt.

**RECAP**
- Title 40 Bold.
- Headers: y 1.55, 15 Bold uppercase MUTED.
- Rows: from y 2.00, pitch 0.54, ≤9 rows.
- Columns:
  - x 0.75, w 4.55: 20 INK
  - x 5.50, w 4.00: 20 INK2
  - x 9.70, w 2.88: 20 Mono Bold purple
- Drawn with shapes, not a pptx table.

**PAUSE (white)**
- 💬 at (0.75, 1.00, 11.833, 1.00), 60.
- Question: (1.40, 2.20, 10.533, 2.90), 44 Bold, centred.
- Rhythm chip: (3.567, 5.50, 6.20, 0.56), lavender, 20 Bold.
- **T29 variant (cases):** 💬 at y 0.55 (48 pt); question (1.40, 1.35, 10.533, 1.60), 40 Bold, centred; three case lines (2.00, 3.15, 9.333, 1.95), 24 pt, left-aligned, purple Bold "a ·", "b ·", "c ·"; chip at y 5.50.

**BREAK (yellow)**
- ☕ at 72 pt.
- "N-minute break", 60 Bold.
- "Back at __:__", 28.

**STARRY (navy)**
- Glow ellipse, two hills, and 95 stars (seed 294).
- Kicker: (0.75, 0.60), 36 white.
- Statement: (0.75, 1.85, 11.833, 3.00), 54 Bold white, ≤3 short lines.
- Optional small line: (0.75, 4.95, 11.833, 0.60), 24, `#CADCFF`.

**Thursday extras**
- **Data slides:** a source line, 12 pt MUTED, at (0.75, 6.95).
- **Funnel (H6):** three centred bars, h 0.75, widths 5.5 / 4.5 / 3.5, starting at x 0.75, grey `#EDEDED` with INK text. Four pills on the right at x 7.75.
- **Ladder (H8, H9):** four stacked rounded bars at (7.25, 1.70 + i×0.95, 5.33, 0.80). Labels inside at 20 pt. H8: no marker pills; the left prompts end in a 2 pt HAIR blank line. H9: marker pills to the right of rungs 2 and 4.
- **H3 right column:** "Your six, actual rank" list at x 7.75, 22 pt mono chips with the rank number in INK2.
- **H11 statement:** STATEMENT layout, kicker 24 INK2 at y 1.60, statement 44 Bold centred at y 2.40, sub 24 MUTED at y 4.20.
- **H18 halves:** hairline at x 6.67. Left: the checkout split diagram centred in x 0.75–6.40. Right: a TERM panel (6.95, 1.85, 5.63, 3.70) at 16 pt mono (the one exception to the 18 pt minimum; it's illustrative, and the pause carries the point). Half labels 16 Bold at y 1.40.
- **Quote cards (H14):** three cards of w 3.78, each with a 6 pt top border in the court colour, 22 pt italic quote, and 14 pt page reference.

### 9.5 Diagram primitives (s = scale)

**Commit card**
- Body: 1.70 × 2.45, radius 0.12, white, 1.5 pt `#1F1F1F` line.
- ID tag: (+0.12, +0.12), 0.86 × 0.34, INK fill, Mono Bold 14 white.
  - Step 1: letters ("W").
  - Steps 0–4: "#3".
  - From Step 5 on: toy IDs (`drt3`, `cdt5`, `crr3`, `ddt2`).
  - Real SHA prefixes appear only inside terminal panels.
- Author: right of the tag, 13 INK2.
- Panels FACE / BODY / LEGS: w 1.46, h 0.48, at y +0.56 / +1.10 / +1.64, PANEL fill. One emoji, 26 pt.
- Came-from line: y +2.12, "← drt3", 13 INK2.

**Emoji vocabulary (cards only)**

| Word | Emoji |
|---|---|
| smiley | 🙂 |
| smiley with horns | 😈 |
| cat | 🐱 |
| dragon | 🐲 |
| mustache | 🥸 |
| box | 📦 |
| robot | 🤖 |
| superhero | 🦸 |
| robot with a cape | 🤖🦸 |
| disco suit | 🪩 |
| sticks | 🦵 |
| wheels | 🛞 |
| tentacles | 🐙 |
| roller skates | 🛼 |

**Panel marks**

| Mark | Fill | Line |
|---|---|---|
| changed | YELLOW_T | `#E8C547` 0.75 pt |
| auto | GREEN_T | GREEN 1.5 pt |
| conflict | RED_T | RED 2.25 pt **dashed**, emoji ❓ |

**Card states**

| State | Look |
|---|---|
| `sketch` (working copy) | dashed grey outline, empty dashed tag |
| `staged` | solid outline, empty dashed tag |
| `committed` | filled tag |
| `ghost` (unreachable / rewritten) | grey dashed outline, empty panels, plus an orange label |

**Scales**

| Scale | Use |
|---|---|
| 1.0 | ≤4 cards |
| 0.85 | talk slides; row pitch 2.85 |
| 0.62 | inside the Wall or a table zone |

**Other primitives**
- **Parent arrow:** 2 pt INK2, triangle tail. It always runs **child → parent, pointing left (back in time)**. Time flows left to right. Never draw forward arrows; use "+" and "=" glyphs instead.
- **Branch flag:** 1.20 × 0.50 yellow sticky, rotated −4°, 16 Bold INK. Overlaps the card top (or the right edge in fork diagrams). A second flag on the same card shifts right by 1.30.
- **`origin/main` flag:** same geometry, BLUE_T fill, 1.5 pt BLUE outline, 14 Bold INK "origin/main".
- **HEAD pin:** pink pill 0.86 × 0.34, "HEAD", 13 Bold white, with a downward triangle touching the flag. Used on T10 only.
- **Conflict tag:** red pill "CONFLICT" at card right + 0.12 on the panel's row.
- **Wall and tables:**
  - Wall: rounded rectangle with BLUE_T fill, 2 pt BLUE line, and a label pill "THE WALL · GitHub".
  - Verified positions: Lab 1 table (0.75, 2.0, 3.2, 3.6), Wall (4.55, 1.85, 4.25, 3.3), Lab 2 table (9.4, 2.0, 3.18, 3.6).
  - push = 3 pt purple arrow; pull/clone/fetch = 2.5 pt blue dashed arrow; rejected = red circle (d 0.42) with "×".

### 9.6 Content rules
- One idea per slide. Titles ≤6 words where possible. Body ≤15 words and ≤3 lines.
- No bullets. Numbers appear only on task, goal, and activity slides.
- Outside diagrams, use one accent colour plus INK.
- Emoji only inside cards and the chips (⏱ 📊 💬 ☕). Thursday has none outside H4.
- No photos, clip-art, gradients, shadows, or transparency.
- Every slide has speaker notes.

**Rhythm:**
- Tuesday: TASK (lavender) → TALK (white, purple command), with a Menti or PAUSE every 2–3 steps and the break at the midpoint.
- Thursday: ACTIVITY slides are lavender.

### 9.7 python-pptx → Google Slides pitfalls (handled in vis.py)
1. Strip `<p:style>` and add an empty `<a:effectLst/>` to kill theme shadows and white default text.
2. Set font, size, and colour on every run.
3. Use `auto_size = NONE` and `word_wrap = True`, with 0 margins on text boxes.
4. Keep emoji inside Inter runs. Use × rather than ✓ / ✕.
5. Arrowheads come from `<a:tailEnd type="triangle" w="med" len="med"/>`.
6. Rotation, dashes, corner radii, and notes all survive the Slides import.
7. Timers can't run in a .pptx: the chip shows the duration only.

---

## Appendix A: Demo scripts (all verified on git 2.34.1)

**Before class**, build four repos side by side. One command does it and self-checks every claim below on throwaway clones: `bash demo/setup_demo_repos.sh [dir]` (default `~/git_week_demo`; sets a local `user.name` "Lab 1" in each repo, matching T20).

**1. `monster/` (one file; T10, T13, T20).** Blank lines separate the panels, so non-adjacent changes auto-merge.
```bash
git init -b main monster && cd monster
printf 'face: smiley\n\nbody: box\n\nlegs: sticks\n' > monster.txt
git add monster.txt && git commit -m "base monster"
git branch cat-robot && git branch superhero
git switch cat-robot
printf 'face: cat\n\nbody: robot\n\nlegs: sticks\n' > monster.txt
git commit -am "cat face, robot body"
git switch superhero
printf 'face: smiley\n\nbody: superhero\n\nlegs: tentacles\n' > monster.txt
git commit -am "superhero body, tentacle legs"
git switch cat-robot
```

**2. `monster-noblank/` (backup only; B1 is shown instead).** Same script without the `\n\n` blank lines. The merge gives one conflict block covering all three lines.

**3. `monster-files/` (three files; T21).**
```bash
git init -b main monster-files && cd monster-files
echo smiley > face.txt; echo box > body.txt; echo sticks > legs.txt
git add . && git commit -m "base monster"
git branch cat-robot && git branch superhero
git switch cat-robot;  echo cat > face.txt; echo robot > body.txt; git commit -am "cat face, robot body"
git switch superhero;  echo superhero > body.txt; echo tentacles > legs.txt; git commit -am "superhero body, tentacle legs"
git switch cat-robot
```
`git ls-tree main` and `git ls-tree cat-robot` both show `legs.txt` as blob `a27e19c…` on any machine. Merging `superhero` conflicts only on `body.txt`.

**4. `broken/` (T15).**
```bash
git init -b main broken && cd broken
printf 'def draw():\n    print("monster")\n\ndef main():\n    pass\n\nmain()\n' > m.py
git add m.py && git commit -m base
git branch rename && git branch caller
git switch rename; sed -i 's/def draw():/def render():/' m.py; git commit -am "rename draw -> render"
git switch caller; sed -i 's/    pass/    draw()/' m.py; git commit -am "main calls draw"
git switch rename
```
Live: `git merge caller` → "Auto-merging m.py / Merge made by the 'ort' strategy." Then `python3 m.py` → `NameError: name 'draw' is not defined`.

**Live sequence:**
1. **T10 (60 s, in `monster/`):**
   - `cat .git/HEAD` prints `ref: refs/heads/cat-robot`.
   - `git rev-parse HEAD > .git/refs/heads/hack && git branch` shows `hack`; `wc -c .git/refs/heads/hack` → 41.
   - Optional detached HEAD: `git switch --detach main`, edit, `git commit -am wheels`, `git switch cat-robot` → "Warning: you are leaving 1 commit behind…". Delete `hack` afterwards (`git branch -D hack`).
2. **T13 (about 3 min):**
   - `git log --oneline --graph --all`
   - `git merge superhero`: body-only CONFLICT; `cat monster.txt`
   - Resolve:
     ```bash
     printf 'face: cat\n\nbody: robot with a cape\n\nlegs: tentacles\n' > monster.txt
     git add monster.txt && git commit -m "merge: robot with a cape"
     ```
   - `git log --oneline --graph`: the diamond. `git cat-file -p HEAD`: two `parent` lines plus `author` and `committer`.
3. **T14:** Menti, then show B1.
4. **T15:** `cd ../broken && git merge caller && python3 m.py`.
5. **T20:** `echo 'face: smiley' | git hash-object --stdin` → `946ac5d…` (same on a student's laptop).
6. **T21:** `cd ../monster-files && git ls-tree main && git ls-tree cat-robot`.

**Optional Step-6 rehearsal** (verified; matches B2):
- Create a bare `wall.git`, clone it 3 times, and change a different line in each clone.
- The 2nd and 3rd pushes are rejected with `(fetch first)`.
- `git status` says "ahead of 'origin/main' by 1 commit" until you fetch; then "have diverged".
- `git pull --no-rebase` then auto-merges. Pushing again succeeds.
- Zombie check: force the wall back to before the mustache, then push a commit built on the mustache. It is accepted as a fast-forward and the mustache returns.

## Appendix B: Decision log

**v1 merge (five proposals):**

| Decision | Source | Why |
|---|---|---|
| Blank card strip; students invent ID / author / came-from | task-clarity, tuesday-flow | The invention is the learning |
| One word + a 5-second doodle; Courier-only Wall; rescue set; cut order; failure modes | task-facilitation | Speed and logistics |
| Shuffled-envelope Step 1; Client interrupt; mustache zombie; BOSS / AUDIT split across labs | task-clarity | Guaranteed, planted pain |
| Missions change different panels in Steps 5/6 (no second conflict) | new | Step 3 already owns the conflict |
| No SO stats on Tuesday | new | Keeps Thursday's hook intact |
| Think-pair-share *before* the paper slide | new (Sarah's contrasting cases) | Students invent countermeasures first |
| Thursday structure, Claim Court, critique key | thursday-flow (re-verified against p2.txt) | Strongest and evidence-backed |
| Palette, type, geometry, render pipeline | visual-system (vis.py) | Already rendered and tested |

**v2 (three critiques). Where critics conflicted:**

| Topic | Options | Chosen | Why |
|---|---|---|---|
| Step 5 IDs | random hex (v1) / "pretend you computed it" (simplicity) / initials + parent's first char (PhD) / initials + check digit (rubric) | **Initials + check digit** | Random IDs fail Sarah's second question. The PhD toy hash only reaches one generation (a grandchild's ID ignores the change). A check digit carries every change down the chain, and "donkey" still gives a planted collision. |
| GUARD wording | all three agreed | "walking back reaches main; take the missing cards" | Real fast-forward rule; makes the Step-7 zombie legal |
| Step 4 (clone) | demanding invention (rubric) / fold into break (simplicity, PhD) | **Fold into break**, keep a 30-s check and a blue `origin/main` flag | Copying is the most obvious invention. The flag still lets students *feel* fetch vs pull in Step 6. |
| HEAD and detached HEAD | Client task with a pink pin (rubric) / cut pins (simplicity) / T10 pause + live `.git` (PhD) | **Cut pins; T10 pause + live `.git`** | No props; the most confusing part of HEAD is still confronted |
| Panel names | HEAD/BODY/LEGS / FACE/BODY/LEGS | **FACE** | HEAD means only "you are here" |
| Step 6 | two phases with reset (v1) / single flow (simplicity) | **Single flow** + rebase/force wrong-answer lines + AUDIT run 1 | Fits in 6:00; the audit must be shown to work before it fails |
| Self-rating demo | two random groups on paper (PhD) / Menti prediction + quiz (rubric) / honest before-after (simplicity) | **Two random groups, prediction written first** | Falsifiable, has a control, one prop; the notes add the rubric's "no performance measure" point |
| Claim Court load | 9 claims (v1) / one per axis per court (rubric) / one ★ + backup (simplicity) | **One ★ + a backup from another axis**, all three checklists on every packet, minute-5 board check | 3 boxes per claim instead of 4 × 3; every court touches two axes; individual axis placement is tested on H8 |
| Exit and lessons | "one lesson you'll steal" after our list (v1) | **Individual 3-part exit before "Ours, for comparison"** | Invent first, then compare; can't be copied from our slide |
| Recap vs exit order | recap first (v1) | **Exit first** | Recap would give the answers away |
