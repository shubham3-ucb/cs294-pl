# Tuesday · Outfit Lab · lesson script

80 min · 10–12 students in 3 labs · every button runs real Git.

**S** = Shubham, at the front. He presses **Next** and writes on the board.

**A** = Ananya. She walks between the labs.

The class is one fixed list of scenes. S presses only **Next**. Each Next moves the students and the projector one scene.
Every Say, Do, Ask, Hope to hear and Board line below, and every technical card, is the text in the app (`app/server/steps.js`). Read it as written. [that lab] and [the boss lab] are filled in on the teacher page.

**Before class**
- Start the app. Open the Teacher link on S's laptop.
- Press **Start presenting**. Drag the new window onto the projector. Press F for full screen.
- Test the join from one phone. Then open **Details** and press **Reset session**.
- To rehearse alone: **Details** → **Rehearse with bots**. **Reset session** removes the bots.
- The board says "Git in 7 lines". Leave room for seven lines (Steps 0–6).

**How every scene runs**
- **Next:** → or Space. **Back:** ←. A clicker works in either window.
- **Task scene.** Students do the step in the app: what to do, their mission, goals that tick, **Stuck? Hint**. The projector shows the step, one line, a timer and each lab's outfit. From Step 4, it shows the Wall too.
- **Reveal scene.** The projector shows one technical card per tool: the command, then What it is · What it does · How Git does it. Students see the same card in the app. Each card's text is under its reveal below.
- **Ask before the reveal.** Never say a Git name before a student says the idea.
- Someone says the Git name first? Say: "Right. Now say what it does, without Git words."
- **Show on projector** puts the question up. The answer stays folded on S's laptop.
- At each reveal, students can type an answer and a one-line takeaway. The console shows "7/10 answered". **Show answers on projector** shows them, without names.
- **When to press Next:** the readiness line, e.g. "Labs done: 2/3 · Lab 3: Merging: TOP to pick".
- **A lab is stuck?** Students have **Stuck? Hint**. Still stuck? Press **Rescue** on its tile. The app finishes the step for that lab with real Git.
- From Step 3 on, one student per lab presses. The app says to swap each step.

**Learning objectives** (for us; the Step 0 reveal says them in plain words)

After this session, we should be confident students could:
1. **Explain** why "changing" history always makes new commits.
   - A commit never changes. Its ID is a hash of everything in it, parent IDs included.
   - A branch is only a label on one commit. Making one copies nothing.
   - A remote holds the same commits, with the same IDs. A rebase writes new ones.
2. **Predict** when a merge conflicts and when a push is refused. Then **fix** both.
3. **Choose** revert, reset, or squash + force push for a shared mistake. **Say** what each one keeps or destroys.

Checked in: #1, the reveals of Steps 1, 2 and 4. #2, the reveals of Steps 3 and 4. #3, the reveals of Steps 5 and 6, and the exit question.

| Clock | Scene | Min |
|---|---|---|
| 0:00 | Join | 3 |
| 0:03 | Step 0 · Everyone, one outfit | 1.5 |
| 0:04:30 | Step 0 · What would fix it? | 3.5 |
| 0:08 | Step 1 · Save every version | 4 |
| 0:12 | Step 1 · How Git does it | 3 |
| 0:15 | Step 2 · Try two ideas at once | 4 |
| 0:19 | Step 2 · How Git does it | 3 |
| 0:22 | Step 3 · Make one outfit from both | 7 |
| 0:29 | Step 3 · How Git does it | 4 |
| 0:33 | **Break** | 4 |
| 0:37 | Step 4 · Put your outfit on the Wall | 8 |
| 0:45 | Step 4 · How Git does it | 5 |
| 0:50 | Step 5 · Oops: undo a shared mistake | 6 |
| 0:56 | Step 5 · How Git does it | 3 |
| 0:59 | Step 6 · The boss wants it clean | 4 |
| 1:03 | Step 6 · How Git does it | 4 |
| 1:07 | The paper | 5 |
| 1:12 | Exit question | 3 |
| 1:15 | What you built | 2 |
| 1:17 | **Buffer** | 3 |

---

## 0:00 · Join

**Time:** 3 min.

**Projector:** the QR, the link and the labs. "Open the link and type your name. The app picks your lab."

**Say:** No Git lecture today. You'll hit seven problems, and your lab invents a fix for each. Every button runs real Git.

**Do:** Wait until the count matches the room. The app balances the labs. Labs lock at Step 1.

**Watch for:** About 4 per lab. 1–3 people: one lab plus a practice lab that plays by itself. 4–8: 2 labs. 9–12: 3. 13 or more: 4 to 6. With 2 or more labs, no lab starts with 1 person. To change the count, use **Details** before Step 1. After Step 1, a late joiner goes to the smallest lab.

**Watch for:** Each student gets a short tour on joining. The **?** in their top bar replays it.

---

## 0:03 · Step 0 · Everyone, one outfit · no Git yet

**Time:** 1.5 min.

**Say:** Your lab shares one outfit. Change any part, any time. Go.

**Do:** After 90 seconds, say "Hands off." Then ask.

**Ask:** What did your outfit look like a minute ago? Who changed the shoes?

**Hope to hear:** No idea. Nothing was saved.

## 0:04:30 · Step 0 · What would fix it?

**Time:** 3.5 min.

**Projector:** "Nothing was saved. Nobody knows who changed what." Behind the door: "No Git yet. Git saves every version, with who made it."

**Say:** Today you'll explain how Git saves, splits, combines and shares work. You'll predict when Git says no, and pick the right undo.

**Ask:** What rule would fix this?

**Hope to hear:** Save every version, with a name on it.

**If silent:** Three coauthors share one paper draft with no history. What do you want?

**Board:** 0. Save every version, with a name on it.

---

## 0:08 · Step 1 · Save every version

**Time:** 4 min.

**Say:** From now on, every save makes a card.

**Do:** Ask first. Then say "Go."

**Ask:** What should each saved version hold?

**Hope to hear:** The whole outfit, who saved it, and the version it came from.

**If silent:** To get the old shoes back, what do you need?

**Students:** Change one part, then press **Save card**. Everyone saves once.

**Watch for (A):** Anyone who hasn't saved yet. Their lab-mates' Stuck? Hint names them.

## 0:12 · Step 1 · How Git does it · `git commit`

**Time:** 3 min.

**Projector:** the `git commit` card, then the trust line: "Git stores the name and clock your laptop gives it. It checks neither."

**Card:** `git commit`
- **What it is:** a saved snapshot of the whole project.
- **What it does:** records the exact state, who saved it, when, and the commit before it.
- **How Git does it:** each file is stored as a blob, the folder as a tree. A commit object = tree ID + parent ID(s) + author + committer + message. Its ID is the SHA-1 of that object, so any change gives a new ID. Nothing is edited in place.

**Say:** `git commit` stores the whole outfit, the card before, your name, the time and a message. The ID is computed from all of it, so any change makes a new card. The name and the time are whatever your laptop says.

**Ask:** Why do arrows point back, never forward?

**Hope to hear:** The next card doesn't exist yet. Cards never change.

**If silent:** Add an arrow forward. Which card must change?

**If asked:** A commit points to a full snapshot (a tree), not a diff. Unchanged files are stored once and reused. In a terminal, `git add` first picks what goes in.

**If asked:** Anyone can set both by hand: `git config user.name`, `GIT_AUTHOR_DATE`, `GIT_COMMITTER_DATE`. A signed commit (`git commit -S`) shows which key signed it, not when. The paper estimates over 99,000 "wrong" timestamps in 9 open-source projects (§5.6–5.7).

**Board:** 1. Card (commit): a full snapshot + its parent. Never changes.

---

## 0:15 · Step 2 · Try two ideas at once

**Time:** 4 min.

**Say:** The client wants two ideas tried at once. In one draft, you overwrite each other, like Step 0.

**Do:** Ask first. Both missions change TOP on purpose. Don't tell them.

**Ask:** Cards never change. How does each half of your lab find its own newest card?

**Hope to hear:** Each idea puts its own sticky note on its newest card.

**If silent:** You have cards and arrows. How do you mark 'this is my latest'?

**Students:** Pair A makes sticky note **fancy**: HAT → 🎩, TOP → 👔. Pair B makes **sporty**: TOP → 🎽, SHOES → 🥾. Each saves a card.

**Watch for (A):** Before a pair edits, the "You're on:" chip shows their own note.

## 0:19 · Step 2 · How Git does it · `git branch`

**Time:** 3 min.

**Projector:** the `git branch` card.

**Card:** `git branch`
- **What it is:** a movable label on one commit.
- **What it does:** lets you try an idea without touching main.
- **How Git does it:** a branch is a tiny file (`.git/refs/heads/<name>`) holding one commit ID. Committing moves it forward. HEAD records which branch you are on. Creating a branch copies nothing.

**Say:** A branch is a tiny file holding one card's ID. Your pin (HEAD) says which note you're on. Saving moves only that note.

**Do:** If asked: here each sticky note keeps its own shared draft, a teaching choice. In real Git, branches share one working tree (unless you add one with `git worktree`).

**Ask:** Where is the original outfit now? Did anything get copied?

**Hope to hear:** Still on main's card. Nothing was copied.

**If silent:** Count the cards before and after you made the note.

**Board:** 2. Sticky note (branch): a label on one card. Saving moves it.

---

## 0:22 · Step 3 · Make one outfit from both

**Time:** 7 min.

**Say:** The client wants one outfit with both ideas. One person presses, everyone watches.

**Do:** Ask first. A lab says "take the newest"? Ask: "Whose work did you throw away?"

**Ask:** HAT differs on the two newest cards. Which side changed it?

**Hope to hear:** Two cards can't tell you. Compare with the card where you split.

**If silent:** What did HAT look like before you split?

**Students:** On main, merge **fancy**: main's note slides forward, no new card. The mission then says: "Delete the fancy note (`git branch -d fancy`)." They press **Delete sticky note**. Then merge **sporty**. HAT 🎩 and SHOES 🥾 combine alone. TOP is red: the lab agrees on one, picks it, and presses **Finish merge**.

**Watch for:** Delete fancy before merging it? Refused, like `git branch -d`: fancy has cards main doesn't.

**Watch for:** A lab still in a conflict after a few minutes. Its tile says so.

## 0:29 · Step 3 · How Git does it · `git merge`

**Time:** 4 min.

**Projector:** the `git merge` card.

**Card:** `git merge`
- **What it is:** combining two lines of work.
- **What it does:** keeps a change made on one side. It stops for a person when both sides changed the same lines.
- **How Git does it:** Git finds the merge base (the last common commit) and compares each side with it (a 3-way merge). Then it writes a merge commit with two parents. If one side is ahead, it fast-forwards: only the label moves, and no merge commit is made.

**Say:** The first merge only slid the note: a fast-forward, no new card. Then Git compared each side with the card where you split. Only TOP changed on both sides, so only TOP needed you.

**Do:** If asked: main's own safety diary still says "merge fancy: Fast-forward". It is local, it expires, and it never reaches the Wall.

**Ask:** Which cards were made on fancy?

**Hope to hear:** No way to tell. Git does not record the branch a commit was made on.

**If silent:** Open any card. Press **Show what Git stored**. Which line names a sticky note?

**If asked:** Edits on neighboring lines also conflict. That's why `outfit.txt` has a `---` line between parts. A conflict stops the merge; you fix the file, then `git add` and `git commit`. The merge card has two parents.

**Board:** 3. Merge: compare both sides with the card they share.

---

## 0:33 · Break

**Time:** 4 min. Starts the 4-minute break. Labs can still finish Step 3.

**Say:** Break. Back in 4 minutes.

**Do:** Write the return time on the board. Help any lab that is not done.

**Watch for (A):** Any lab whose Step 3 goals do not all tick. Finish the merge with them, or press **Rescue**.

---

## 0:37 · Step 4 · Put your outfit on the Wall

**Time:** 8 min. Students hit the problem first.

**Next does:** Sends [that lab]'s outfit to the Wall. Every lab becomes a copy of it. Back does not undo this. The practice lab, if there is one, sends its card to the Wall first. [that lab] is the first lab done with Step 3. To pick another, use "Whose outfit goes to the Wall:" under **Next**, before pressing.

**Say:** The Wall is the class's shared copy, like GitHub. Your lab already has a full copy of it (that is git clone). It starts as [that lab]'s outfit. Put your outfit on the Wall. The first lab there wins.

**Do:** Don't ask first: students hit the refusal themselves. Each refused lab gets its way in the app: Combine (merge) or Replay on top (rebase).

**Students:** Lab 1: HAT → 👑. Lab 2: SHOES → 🛼. Lab 3: GLASSES → 🕶️. **Save card**, then **Send to Wall**. The first lab's send goes through. The first lab refused is told **Combine (merge)**: **Get & combine**, then send again. The next lab refused is told **Replay on top (rebase)**: **Replay on top**, then send again. More labs alternate.

**Watch for:** Only one lab can be refused (two labs, or one lab and the practice lab)? It replays on top. Merge was already felt in Step 3.

**Watch for:** Combining has no red: Labs 1–4 each change a different part. With 5 or 6 labs, HAT and SHOES repeat, so a later lab picks, like Step 3.

**Watch for:** "Refused twice in a row" on a tile. A checks the lab used its way before sending again.

**Watch for:** Done when the Wall shows every lab's change: 👑 🛼 🕶️ with 3 labs.

## 0:45 · Step 4 · How Git does it · `git push / git pull`, `git rebase`

**Time:** 5 min.

**Projector:** the two cards. Under them, the Wall with one lab's path to main in bold, and one line per lab, in the order they reached the Wall: "made 10:21 → on the Wall 10:24 · 3 min". Under a replayed change: "Its original card is not on the Wall. The path starts at a copy." Under a combined one: "The path ends at its own merge card, with two parents."

**Students:** the same cards. On their Wall, the merge card says "merge · 2 parents" and the copy says "copy · new ID".

**Card:** `git push / git pull`
- **What it is:** sharing commits with a copy elsewhere (the Wall).
- **What it does:** push sends your new commits and moves the remote branch. pull brings theirs in.
- **How Git does it:** copies exchange only the objects the other side lacks; IDs come from content, so copies agree without coordination. A push is accepted only if it is a fast-forward of the remote branch. Otherwise fetch first, then merge or rebase.

**Card:** `git rebase`
- **What it is:** replaying your commits on top of another branch.
- **What it does:** gives a straight history with no merge commit.
- **How Git does it:** for each of your commits, Git applies its change to the new base and writes a new commit. The new parent gives it a new ID. Author and author date are kept. The originals become unreachable and stay in your reflog for a while.

**Say:** The Wall only moves forward, so a refused lab gets the Wall's cards first. Combine makes a merge card with two parents (Step 3 made one too). Replay on top makes a straight line: a copy of the card with the same change, author and author time, but a new parent, snapshot, committer time and ID.

**Do:** Point at the marked path on the Wall: when the card was made, and when it reached the Wall. These are this class's times.

**Ask:** The replayed card has the same change, author and author time. Why does it have a new ID?

**Hope to hear:** Its parent is new, so its snapshot is too: it now includes the Wall's change. Its committer time is new. The ID is a hash of all of it.

**If silent:** Open the replayed card and its original. Press **Show what Git stored**. Which lines differ?

**If asked:** "Made" is the card's author time, which a replay keeps. "On the Wall" is when the lab's push succeeded; its reflog records it.

**If asked:** With no `pull.rebase` or `pull.ff` setting, a plain `git pull` on diverged branches stops and asks you to choose. `git pull --no-rebase` merges; `git pull --rebase` replays.

**If asked:** Git combined the labs with no red, but it compares lines, not meaning. A person or a test still checks the result.

**Watch for:** The Sabotage button puts the 🥸 card on the Wall early, if you want. Otherwise the next Next does it.

**Board:** 4. The Wall only moves forward. Behind? Combine (merge), or replay on top (rebase: new IDs).

---

## 0:50 · Step 5 · Oops: undo a shared mistake

**Time:** 6 min.

**Next does:** Puts the Intern's 🥸 card on the Wall, if you haven't yet. Each lab with nothing unsent gets it (a fast-forward). Message: "Tiny style fix".

**Say:** The Intern pushed a "tiny style fix" to the Wall. Your lab has it too.

**Do:** Ask first. Sort the answers into "go back to before it" and "add a card that removes it". Say: "We'll try both."

**Ask:** How do you get rid of it?

**Hope to hear:** Go back to before it, or save a new card that removes it.

**Students:** The app splits the labs. Lab 2 tries **Move my note back here**, then **Send to Wall**. Labs 1 and 3 press **Undo this card** on 🥸, then send. (With more labs, even-numbered labs move back. With one real lab, it tries moving back first.)

**Watch for:** Lab 2 is refused. That is the lesson. Of Labs 1 and 3, the second to send is refused. Its Get & combine has no red: both made the same fix.

**Do (A, at Lab 2, after the refusal):** Ask: "Suppose nobody else had the 🥸 card. Your note left it. How would you find it again?" Then point them to **Safety diary**: it still lists 🥸. Moving the note deleted nothing.

**Watch for:** Done when each lab undid 🥸 itself and the Wall shows no 🥸.

## 0:56 · Step 5 · How Git does it · `git revert / git reset`

**Time:** 3 min.

**Projector:** the `git revert / git reset` card.

**Card:** `git revert / git reset`
- **What it is:** two kinds of undo.
- **What it does:** revert adds a commit that undoes an old one, and is safe on shared history. reset moves your branch label back, and is only safe if nobody else has those commits.
- **How Git does it:** revert applies the opposite of the commit's change and commits it on top, so history only grows. reset rewrites the branch file. The commits left behind are still listed in the reflog (a local log of where each label pointed) until they expire and gc removes them.

**Say:** `git revert` adds a card that undoes the old one, so it sends like any card. `git reset` moves your note back, but the Wall still has the card.

**Ask:** Why is adding a fix card safe, but moving back is not?

**Hope to hear:** A fix card only adds. Moving back drops a shared card.

**If silent:** Lab 1's send worked. Lab 2's was refused. What did each do to the history?

**If asked:** "Why not force-send?" Labs 1 and 3 still have 🥸 under their fix; their next Get & combine and send bring it back. Reflog entries for unreachable commits last 30 days by default.

**Board:** 5. Shared mistake: add a fix card (revert). Move back (reset) only if nobody has the card.

---

## 0:59 · Step 6 · The boss wants it clean

**Time:** 4 min.

**Next does:** Asks the Wall who added the 🥾 boots. Only [the boss lab] can replace the Wall. [the boss lab] is the first lab with someone online. To pick another, use "Boss lab:" under **Next**, before pressing.

**Say:** Who gave our outfit boots? The Wall knows. Now, as the boss: "This history is a mess. I want one clean card."

**Do:** Read the audit name aloud. Then ask.

**Ask:** Cards never change. How do you give me one clean card?

**Hope to hear:** Make one new card after Start. Force the Wall onto it.

**If silent:** Step 1: change anything in a card and its ID changes. Is the clean card old or new?

**Students:** The boss lab presses **Get & combine**, then **Replace the Wall with one card**. Other labs press nothing. They find the first 🥾 card in their own cards and its author.

**Watch for:** The Wall now shows two cards: Start ← Clean history.

## 1:03 · Step 6 · How Git does it · Squash + `git push --force`

**Time:** 4 min.

**Next does:** Finishes [the boss lab]'s clean-up if needed. Then asks the Wall about the boots again. The Wall no longer names the author. The other labs still do.

**Projector:** the "Squash + git push --force" card, the audit after the clean-up, then the bin count.

**Card:** Squash + `git push --force`
- **What it is:** cleaning up history.
- **What it does:** squash turns several commits into one. Force push makes the Wall accept it anyway.
- **How Git does it:** squash writes one new commit whose tree is the final state. The originals, with their authors and times, become unreachable. `--force` skips the fast-forward check and moves the remote branch. `git gc` later deletes unreachable objects.

**Say:** The Wall no longer knows who added the boots. The other labs still do. The old cards wait in the Wall's bin.

**Do:** Press Empty the Wall's bin. Read the count aloud.

**Ask:** Who added the boots? Where does that answer still exist?

**Hope to hear:** Not on the Wall. Only in the labs that kept the old cards.

**If silent:** Ten minutes ago the Wall knew. Now it doesn't. What changed?

**If asked:** In real Git, another lab could Get & combine, then send, and the old cards would return. A force push lasts only if everyone goes along. Daily habit: `--force-with-lease`, which refuses if the Wall moved since your last fetch.

**Board:** 6. Rewrite (squash, rebase): new cards. Force push + gc: the Wall loses the old ones.

---

## 1:07 · The paper

**Time:** 5 min.

**Projector (students see the same card):** Just, Herzig, Czerwonka, Murphy · ISSRE 2016.
- **Good:** Cheap branches. Local commits and reverts. Developers prefer a flat history.
- **Bad:** Fast-forward forgets which branch a change came from. Rebase rewrites the commit; the patch can change too. Squash drops the cards, even who made them.
- **Ugly:** Microsoft traces each change's route to main: its integration path. For Git, that tracing had to be redesigned from scratch. Some loss cannot be recovered.
- **Flat history is data loss.**
- What you lived:
  - Step 3: after the fast-forward, you deleted fancy. No card says which cards were made on it.
  - Step 4: Rebase rewrites the change and gives it a new ID. The original card is not on the Wall.
  - Step 6: the squash dropped the cards, and who made them.
  - Step 6: the 🥾 audit failed. The Wall no longer knows who added the boots.
- Code velocity in this class: each lab's Step 4 line, as it was at the end of Step 4. Under it: "After the squash, the Wall has none of these cards."

**Say:** You just lived this paper. Teams at Microsoft moved to Git. It measures code velocity: how long a change takes to reach main, along its integration path. After the squash, the Wall has no path left. The paper says: flat history is data loss.

**Do:** Pairs, 2 minutes. One answer per pair in the app. Then show two.

**Ask:** You run your company's Wall. Give one rule: the boss gets a clean history, and the auditor still knows who added the boots.

**Hope to hear:** No force push to main. Or: squash only your own branch, before you share it.

**Watch for:** Use only facts from `tuesday_paper_notes.md`. Say "the paper estimates", never "proved".

**If asked:** A server can refuse force pushes: `git config receive.denyNonFastForwards true`. GitHub's branch protection does the same.

---

## 1:12 · Exit question

**Time:** 3 min.

**Projector:** "On your own: two sentences in the app."

**Say:** On your own. Two sentences, in the app.

**Do:** After a minute, show the answers. Read two aloud. Then give the answer.

**Ask:** A password reached the Wall. Two labs pulled. Does Undo this card (revert) remove it? If not, what would?

**Hope to hear:** No. Revert adds a card; the old one still holds the password, in every copy. Change the password. Then rewrite, force push and gc.

**If silent:** Open your lab's cards. Is the 🥸 card still there, under its fix card? (Yes.)

**If asked:** On GitHub you can't run gc. Old commits can stay viewable by ID until GitHub Support removes them.

---

## 1:15 · What you built

**Time:** 2 min.

**Projector:** "Cards never change. Sticky notes move. The Wall copies cards." Then a wall of takeaways, without names. Each student sees "My Git in 7 lines" and their lab's counts, with a Copy button.

**Say:** Cards never change. Sticky notes move. The Wall copies cards. That's Git. Homework: Yang et al., Sections 3.2 to 3.5. For one finding, write down what they measured.

**Do:** Read one lab's counts aloud. Point at the takeaway wall.

**Watch for:** After class, **Export answers** (under Details) saves every answer and takeaway as Markdown.

---

## 1:17 · Buffer

**Time:** 3 min. Spend it wherever you ran over.

**If behind, cut in this order:**
1. "If asked" lines. Answer after class.
2. Step 0 reveal: read the Say, skip the question.
3. Step 2 reveal: say the answer yourself.
4. Paper: whole class, one answer, instead of pairs.
5. Exit: show the answers, read none aloud.

**Never cut:**
- the Step 3 conflict
- the refused sends in Steps 4 and 5
- the two Step 6 scenes (both audits)
- the exit question
