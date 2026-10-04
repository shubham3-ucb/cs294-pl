# Tuesday · Monster Lab · lesson script

80 min · 10–12 students in 3 labs · every button runs real Git.
**S** = Shubham, at the front. He talks, clicks the admin page, and writes on the board.
**A** = Ananya. She walks between the labs.

**Before class**
- The app is running. The admin page is open on S's laptop.
- The projector shows `/screen`. Labs = 3. Test the join from one phone.
- The board says "Git in 7 lines". Leave room for seven lines.
- Put one index card and a pen at each seat.

**How every step runs**
1. **Problem.** S names the moment the students lived.
2. **Ask** for the idea. Ask *before* you click Next. The new buttons show Git names.
3. **Idea.** Wait for a student to say it. Silence? Use the hint.
4. **Do.** Click Next. Students do it in the app.
5. **Pause.** Ask. Wait 10 seconds. Listen for "Hope to hear".
6. **How Git does it.** Say it. Then write one line on the board.

In Steps 5 and 6, students hit the problem first. The idea comes last, out of the pause.
Never say a Git name before a student says the idea.
Someone says the Git name first? Say: "Right. Now say what it does, without Git words."
From Step 3 on, one student per lab drives. The lab decides together.

| Clock | Block | Min |
|---|---|---|
| 0:00 | Opening | 3 |
| 0:03 | Step 0 · Chaos | 4 |
| 0:07 | Learning objectives | 1 |
| 0:08 | Step 1 · Commit | 7 |
| 0:15 | Step 2 · Branch | 7 |
| 0:22 | Step 3 · Merge | 10 |
| 0:32 | **Break** | 4 |
| 0:36 | Step 4 · Meet the Wall | 6 |
| 0:42 | Step 5 · Push and pull | 9 |
| 0:51 | Step 6 · Revert, reset, reflog | 9 |
| 1:00 | Step 7 · Squash, force push, gc | 8 |
| 1:08 | The paper | 4 |
| 1:12 | Exit question | 3 |
| 1:15 | Step 8 · Wrap and closing line | 2 |
| 1:17 | **Buffer** | 3 |

---

## 0:00 · Opening

**Time:** 3 min.

**Do:** Show the join QR on the projector. Stay on Step 0.
**Do (students):** Scan the QR. Type your name. Pick Lab 1, 2 or 3.
**Watch for:** Labs can only change before Step 1. Wait until the count matches the room.

**Say:** "No Git lecture today. You'll hit seven problems. Your lab invents a fix for each one. Then we show how Git does the same thing. Every button runs real Git."

---

## 0:03 · Step 0 · Everyone, one monster · no Git yet

**Time:** 4 min (chaos 90 s · talk 2.5 min).

**Do:** Nothing to click. Step 0 is already on.
**Say:** "Your lab shares one monster. Change any part, any time. Go."
**Time:** After 90 seconds, say "Hands off."

**Problem.**
**Ask:** "What did your monster look like a minute ago? Who changed the legs?"
**Hope to hear:** "No idea. Nothing was saved."

**Ask:** "What rule would fix this?"
**Idea:** Save every version, with a name on it. Never overwrite.
**If silent, ask:** "Three coauthors share one paper draft with no history. What do you want?"

**How Git does it.** Not yet. Git is the tool programmers use for this. It saves every version, with who made it.

---

## 0:07 · Learning objectives

**Time:** 1 min.

After this session, we should be confident students could:
1. **Explain** why "changing" history always makes new commits.
   - A commit never changes. Its ID is a hash of everything in it, parent included.
   - A branch is only a label on one commit. Making one copies nothing.
   - A remote holds the same commits, with the same IDs.
2. **Predict** when a merge conflicts and when a push is refused. Then **fix** both.
3. **Choose** revert, reset, or squash + force push for a shared mistake. **Say** what each one keeps or destroys.

Checked in: #1, the pauses in Steps 1, 2 and 4. #2, the pauses in Steps 3 and 5. #3, the pauses in Steps 6 and 7, and the exit question.

**Say (no Git names yet):** "You'll explain how Git saves, splits, combines and shares work. You'll predict when Git says no. You'll pick the right undo when others have your mistake."

---

## 0:08 · Step 1 · Save every version · `git commit`, `git log`

**Time:** 7 min (ask 1 · do 3 · pause 2 · reveal 1).

**Problem.** In Step 0 the old monster vanished. Nobody knew who did what.
**Ask:** "What should each saved version hold?"
**Idea:** The whole monster, who saved it, and the version it came from.
**If silent, ask:** "To get the old legs back, what do you need?"
**If nobody says "the version it came from", ask:** "You find 20 saved monsters in a pile. How do you know which one each grew from?" (Each one names the one before it.)

**Do:** Next → Step 1.
**Say:** "From now on, every save makes a card."
**Do (students):**
- Change one part. A dashed purple outline means "not saved".
- Press **Save card**. Take turns. Everyone saves at least once.
- Click any card. Press **Show what Git stored**. Find the parent, the author and the message.

**Watch for (A):** Anyone who hasn't saved yet.
**Watch for (A):** A lab done early? Say: "Open Behind the door. Press **Show the low-level steps Git ran**. One save is four commands."

**Pause.**
**Ask:** "Which card came 3 saves ago, and who made it?"
**Hope to hear:** "Follow the arrows back three cards. The name is on the card."
**Ask:** "Why do arrows point back, never forward?"
**Hope to hear:** "When you save, the card before exists. The next one doesn't. A saved card never changes, so no arrow gets added later."
**If silent, ask:** "Add an arrow forward. Which card must change?"

**How Git does it.**
- `git commit` saves a snapshot of all your files, not only the changes. Unchanged files are stored once and reused. It also stores the parent (the card before), author, time and message.
- Git computes the commit's ID from all of that (a hash). Change one emoji and the ID changes. So you can't edit a commit. A change makes a new one.
- `git log` starts at the newest commit and follows the parents back. (In a terminal, `git add` first picks what goes in.)

**Do:** Write on the board: "1. Card (commit): a full snapshot + its parent. Never changes."

---

## 0:15 · Step 2 · Try two ideas at once · `git branch`, `git switch`

**Time:** 7 min (ask 1 · do 3 · pause 2 · reveal 1).

**Problem.**
**Say:** "The client wants two ideas tried at once. Don't lose the monster you have."
**Ask:** "Half your lab tries one idea. Half tries the other. Same draft. What goes wrong?"
**Hope to hear:** "Step 0 again. We overwrite each other."

**Ask:** "Cards never change. So both ideas can grow from the same card. How does each half find its own newest card?"
**Idea:** Each idea puts its own sticky note on its newest card. Saving moves only that note.
**If silent, ask:** "You have cards and arrows. How do you mark 'this is my latest'?"

**Do:** Next → Step 2. The app splits each lab into Pair A and Pair B.
**Say:** "Your lab already has one sticky note: main. It marks the monster you have now."
**Do (students):**
- Pair A: one partner presses **New sticky note** `cat-robot`. The other presses **Switch to** `cat-robot`. FACE → 🐱, BODY → 🤖. **Save card**.
- Pair B: the same with `superhero`. BODY → 🦸, LEGS → 🐙. **Save card**.
- Then **Switch to** `main` and back. Watch the draft change. Look, don't edit.

**Watch for:** Both missions change BODY on purpose. That sets up Step 3. Don't tell them.
**Watch for (A):** Before a pair edits, the "You're on:" chip shows their own note.

**Pause.**
**Ask:** "Where is the original monster now? Did anything get copied?"
**Hope to hear:** "It's still on main's card. Nothing was copied. We only added a sticky note."
**If silent, ask:** "Count the cards before and after you made the note."

**How Git does it.**
- A branch is a tiny file that holds one commit ID. Making one copies nothing.
- HEAD (the pink YOU pin) says which branch you're on. A new commit moves that branch forward.
- `git switch -c cat-robot` creates the branch and moves HEAD to it. `git switch main` moves HEAD back. Your files change to main's snapshot.

**Do:** Write on the board: "2. Sticky note (branch): a label on one card. Saving moves it."

---

## 0:22 · Step 3 · Make one monster from both · `git merge`

**Time:** 10 min (ask 1 · do 5 · pause 3 · reveal 1).

**Problem.**
**Say:** "The client wants one monster with both ideas."
**Ask:** "Look at FACE on the two newest cards. They differ. Which side changed it?"
**Hope to hear:** "Can't tell from two cards. We need the card where we split."
**Idea:** Compare each part with the card where you split. One side changed it: keep that. Both changed it: a person decides.
**If silent, ask:** "What did FACE look like before you split?"

**Do:** Next → Step 3.
**Do (students):** One driver per lab. Everyone watches.
1. **Switch to** `main`.
2. **Merge [cat-robot ▾] into main**. Main's note slides forward. No new card appears.
3. **Merge [superhero ▾] into main**. A window opens. FACE ✓ and LEGS ✓ are done. BODY is red.
4. Agree on one body. Pick it. Press **Finish merge**.

**Watch for:** Chips **Fast-forward**, **Merge** and **Conflict solved** in every lab.
**Watch for (A):** A lab says "take the newest". Ask: "Whose work did you throw away?"

**Pause.**
**Ask:** "Why did the first merge only move the note?"
**Hope to hear:** "Main had nothing new since cat-robot split off. There was nothing to combine."
**Ask:** "Why did FACE and LEGS combine alone, but BODY needed you?"
**Hope to hear:** "Compared with the card where we split, FACE and LEGS changed on one side. BODY changed on both."
**If silent, ask:** "In the merge window, what does the At start card show for BODY?"

**How Git does it.**
- Main has no new commits since the branch split off? Then `git merge cat-robot` moves main's label forward. That is a fast-forward. No new commit.
- Otherwise Git finds the merge base: the newest commit both sides share. It compares each side with it. Changed on one side: keep it. Changed on both, differently: CONFLICT.
- On a conflict, Git stops. It writes both versions between `<<<<<<<` and `>>>>>>>`. You fix the file, then `git add` and `git commit`. The merge commit has two parents.

**Say (to labs that finish early):** "Edits on neighboring lines also conflict. That's why `monster.txt` has a `---` line between parts."

**Do:** Write on the board: "3. Merge: compare both sides with the card they share."

---

## 0:32 · Break

**Time:** 4 min.

**Say:** "Break. Back in 4 minutes."
**Do:** Write the real return time on the board. Start the timer. Stay on Step 3.
**Watch for (A):** Any lab without **Merge** and **Conflict solved**. Finish the merge with them now.

---

## 0:36 · Step 4 · Meet the Wall · `git clone`

**Time:** 6 min (ask 1 · do 2 · pause 2 · reveal 1).

**Problem.**
**Say:** "The client wants one monster from the whole class. Each lab's cards live only in that lab."
**Ask:** "How do three labs share, without one lab holding the only copy?"
**Idea:** One shared copy on the wall. Each lab keeps a full copy and copies new cards from it.
**If silent, ask:** "The shared copy burns down. What should still exist?" (Every lab's full copy.)

**Do:** Lab select (by Next): leave the default. That's the first lab done with Step 3. Next → Step 4.
**Say:** "This is the Wall, like GitHub. Lab N's monster is on it. Every lab's cards were replaced by a full copy of the Wall. Your counts are kept for the wrap."
**Do (students):** Click the newest card in your lab's cards. Then the newest card on the Wall. Read its ID out to the next lab.

**Watch for:** All three labs read out the same ID.

**Pause.**
**Ask:** "Two labs never made that card. Why does their copy have the same ID?"
**Hope to hear:** "The ID is computed from what's on the card. Same card, same ID, anywhere."
**If silent, ask:** "Open it. Press **Show what Git stored**. What goes into the ID?"
**Ask (follow-up):** "Suppose you could edit an old card. Change one emoji. What happens to its ID? And to every card after it?"
**Hope to hear:** "It gets a new ID. So does every later card, because each holds its parent's ID."
**Say:** "Remember this for Step 7."

**How Git does it.**
- `git clone` copies every commit on the Wall. Your copy is full, not a link.
- The blue `wall/main` (usually `origin/main`) is the Wall's main at your last check. It moves only when you fetch, pull or push.
- A commit's ID is a hash of everything in it, parent ID included. Same commit, same ID on every laptop.

**Do:** Write on the board: "4. The Wall (remote): a full copy. Same card, same ID everywhere."

---

## 0:42 · Step 5 · Put your monster on the Wall · `git push`, `git pull`

**Time:** 9 min (do 5 · pause 3 · reveal 1). Students hit the problem first.

**Do:** Next → Step 5.
**Say:** "Put your monster on the Wall. The first lab there wins."
**Do (students):**
- Add your lab's signature. Lab 1: FACE → 🐲. Lab 2: LEGS → 🛼. Lab 3: BODY → 🌵.
- **Save card**, then **Send to Wall**.
- Refused? Press **Get & combine**. Then **Send to Wall** again.

**Watch for:** The first lab gets in. The other two are refused.
**Watch for:** Their combine has no red. Each lab changed a different part of the same card. Git combines them alone and makes a merge card.
**Watch for (A):** "Refused twice" on the admin page. Check the lab pressed **Get & combine** before sending again.
**Watch for:** Done when the Wall shows 🐲 🌵 🛼.

**Problem.** We sent our monster, and the Wall said no.

**Pause.**
**Ask:** "Why did the Wall refuse your card instead of adding it?"
**Hope to hear:** "Moving the Wall to our card would drop the first lab's card. The Wall only moves forward."
**If silent, ask:** "Follow your card's arrows back. Do you ever reach the first lab's card?"
**Idea:** The Wall never drops a card. It only takes cards built on its newest card.
**Ask (follow-up):** "Git combined three labs with no red. Is the monster right?"
**Hope to hear:** "Git can't tell. It compares lines, not meaning. A person or a test still checks."

**How Git does it.**
- `git push` uploads your commits. It asks the Wall to move its main to yours. Git allows only a fast-forward. The Wall's newest commit must already be in your history. Otherwise: `! [rejected]`.
- `git pull` = `git fetch` + `git merge wall/main`. Fetch copies the Wall's new commits and moves `wall/main`. Merge combines them into your main.
- A push never merges. You combine on your laptop, then push again.

**Do:** Write on the board: "5. Send (push) only moves the Wall forward. Behind? Get & combine (pull) first."

---

## 0:51 · Step 6 · Oops: undo a shared mistake · `git revert`, `git reset`, `git reflog`

**Time:** 9 min (setup 2 · do 4 · pause 2 · reveal 1).

**Do:** Press **Sabotage**. Stay on Step 5. The Intern's 🥸 card lands on the Wall.
**Say:** "The intern pushed a 'tiny style fix' to the Wall. Everyone: **Get & combine**."

**Problem.** A bad card is on the Wall. Now every lab has a copy.
**Ask:** "How do you get rid of it?" Sort the answers into two kinds. "Go back to before it." "Save a new card that removes it."
**Say:** "We'll try both."

**Do:** Next → Step 6.
**Say:**
- "Lab 2: open the card right before 🥸. Press **Move my note back here**. Then **Send to Wall**."
- "Labs 1 and 3: open the 🥸 card. Press **Undo this card**. Then **Send to Wall**."

**Watch for:**
- Lab 2 is refused. That is the lesson.
- Of Labs 1 and 3, the second to send is refused. Its combine has no red. Both labs made the same fix.
- Done when the Wall shows 🐲 🌵 🛼 again.

**Do (A, at Lab 2, after the refusal):**
**Ask:** "Suppose nobody else had the 🥸 card. Your note left it. How would you find it again?"
**Hope to hear:** "Keep a list of every card our note was on."
**Say:** "Open **Safety diary**. It lists every card main was on, 🥸 included. Moving your note deleted nothing." Then Lab 2 presses **Get & combine**.
**Watch for:** The 🥸 card is not faded. The blue `wall/main` note still sits on it.
**Watch for:** 🥸 back in Lab 2's cards with no fix card after it? Press **Undo this card** on it, then send.

**Pause.**
**Ask:** "Why is adding a fix card safe, but moving back is not?"
**Hope to hear:** "A fix card only adds, so every copy still fits. Moving back drops a card others already have."
**If silent, ask:** "Lab 1's send worked. Lab 2's was refused. What did each do to the history?" (Lab 1 added a card. Lab 2 took one away.)
**If they say "Lab 2 should force-send", ask:** "Labs 1 and 3 still have the 🥸 card. What happens at their next send?" **Hope to hear:** "The Wall takes it. The 🥸 card is back."
**Ask (follow-up):** "When is moving the note back fine?"
**Hope to hear:** "When the card never left your laptop."
**Idea:** Don't rip out a shared card. Add a new card that undoes it.

**How Git does it.**
- `git revert <id>` makes a new commit that undoes that commit's change. History only grows. It pushes like any new commit.
- `git reset --hard <id>` moves your branch back, and your files with it. The Wall's newest commit is no longer in your history. So the push is refused.
- `git reflog` logs where your branch has pointed. It stays on your laptop. Entries last at least 30 days by default. Pick an ID, `git reset --hard` to it, and you're back.

**Do:** Write on the board: "6. Shared mistake: add a fix card (revert). Move back (reset) only if nobody has the card."

---

## 1:00 · Step 7 · The boss wants it clean · squash, `git push --force`, `git gc`

**Time:** 8 min (setup 2 · do 2 · pause 3 · reveal 1).

**Do:** Press **Audit**. The projector names who first set LEGS → 🐙 on the Wall.
**Say:** "Who gave our monster tentacles? The Wall knows." Read the name aloud.

**Problem.**
**Say (as the boss, straight face):** "This history is a mess. Merges, conflicts, a mustache, an undo. I want one clean card."
**Ask:** "Cards never change. How do you give me one clean card?"
**Idea:** Make one new card with today's monster, right after Start. Point the Wall at it.
**If silent, ask:** "Step 4: edit a card and its ID changes. Is the clean card old or new?"
**Ask:** "Will the Wall accept it?"
**Hope to hear:** "No. It isn't built on the Wall's newest card. You'd have to force it."

**Do:** Next → Step 7. Leave the boss lab select on Lab 1.
**Do (students):**
- Lab 1 only: press **Get & combine**. Then **Replace the Wall with one card**. Confirm.
- Labs 2 and 3: press nothing. The app pauses your sends. Watch the Wall.
- Then Labs 2 and 3: find the first 🐙 card in your lab's cards. Write down its author.

**Watch for:** The Wall now shows two cards: Start ← Clean history.
**Watch for:** Lab 1's old cards turn dashed. Only its Safety diary reaches them.

**Do:** Press **Audit** again. The Wall says "not found". Labs 2 and 3 still show the name.
**Say:** "No note leads to the old cards now. The Wall still stores them, in a bin."
**Do:** Press **Empty the Wall's bin**.
**Say:** Read the bin count aloud. "Now they're deleted from the Wall."
**Say:** "In real Git, Lab 2 could Get & combine, then send. The old cards would return. A force push lasts only if everyone goes along."
**Watch for:** The clean monster still has 🐙 legs? Then Audit says "Only the clean card has it. The real author is gone." Say: "Now the clean card takes the credit."

**Pause.**
**Ask:** "Who added the tentacles? Where does that answer still exist?"
**Hope to hear:** "Not on the Wall anymore. Only on the labs' own laptops, until they clean up too."
**If silent, ask:** "Ten minutes ago the Wall knew. Now it doesn't. What changed?"
**Ask (follow-up):** "Was the boss wrong to want a clean history?"
**Hope to hear:** "No. It reads better. The cost is the record of who did what."

**How Git does it.**
- Squash writes one new commit: today's snapshot, with Start as its parent. Same snapshot, new parent, so a new ID. (Terminal: `git reset --soft <start-id>`, then `git commit`.) `git rebase` replays your commits on top of a newer one. It too writes new commits, with new IDs.
- That push is not a fast-forward, so Git refuses it. `git push --force` skips the check. Daily habit: `--force-with-lease`, which refuses if the Wall moved since your last fetch.
- After the force push, nothing on the Wall reaches the old commits. `git gc --prune=now` deletes them. Until then, they sat in the Wall's bin.

**Do:** Write on the board: "7. Rewrite (squash, rebase): new cards. Force push + gc: the old ones are gone."

---

## 1:08 · The paper · "Switching to Git: the Good, the Bad, and the Ugly"

**Time:** 4 min (say 1 · pairs 2 · close 1).

**The one message:** **Flat history is data loss.** (The paper's own words, §3.1.)

**Say:**
- "You just lived this paper. Microsoft Research moved its teams to Git, ISSRE 2016."
- "The good: cheap branches and local saves made developers faster."
- "The bad: developers love a clean, flat history. The paper says: flat history is data loss."
- "Fast-forward forgets which branch a change came from. Rebase rewrites the change. Squash drops the cards, even who made them."
- "The ugly: Microsoft measures how fast a change reaches main. They had to rebuild that tracing from scratch for Git. Some losses could not be recovered."

**Board line:** Flat history is data loss.

**Watch for:** Use only facts from `tuesday_paper_notes.md`. Say "the paper estimates", never "proved".

**Problem.** One person writes the history. A different person reads it later. They want different things.

**Ask (pairs, 2 min):** "You run your company's Wall. Give one rule. The boss still gets a clean history. The auditor can still say who added the tentacles."
**Hope to hear (any one):**
- "No force push to main."
- "Squash only your own branch, before you share it."
- "Log every push somewhere nobody can rewrite."

**Close (1 min), say:** "The paper's advice: choose which habits your team allows, on purpose. Keep merge cards (`--no-ff`). Revert whole cards, never parts."
- "Keep the old cards on a hidden branch."

**Ask:** "Who pays for your rule?"
**Hope to hear:** "The developers. Less freedom, or a messier history."

**How Git does it.** A server can refuse force pushes: `git config receive.denyNonFastForwards true`. GitHub's branch protection does the same.

**Say:** "A tool must serve the writer and the reader. Bring that to Thursday."

---

## 1:12 · Exit question

**Time:** 3 min (write 1 · discuss 2).

**Do:** Write on the board: "A password reached the Wall. Two labs pulled. Does Undo this card (revert) remove it? If not, what would?"
**Say:** Read it aloud. "Laptops closed. Two sentences on your index card."

**Hope to hear:** "No. Revert adds a card. The old card still holds the password. Every clone has it. So change the password first. Then rewrite, force push, and gc the Wall."

**Time:** After 1 minute, two students read theirs aloud. Then S gives the answer.
**If most miss it, ask:** "Open your lab's cards. Is the 🥸 card still there, under its fix card?" (Yes.)
**Watch for:** Someone asks about GitHub. Say: "You can't run gc there. Old commits stay viewable by ID until GitHub Support purges them."
**Do (A):** Collect the cards at the door.

---

## 1:15 · Step 8 · What you built · closing line

**Time:** 2 min.

**Do:** Next → Step 8. The projector shows the wrap line and each lab's counts.
**Say:** Read one lab's counts aloud. Point at the seven board lines. "That's the whole model."
**Say:** "Cards never change. Sticky notes move. The Wall copies cards. That's Git."
**Say:** "Thursday: how real developers use Git. Read Yang et al., Sections 3.2 to 3.5. For one finding, write down what they measured."

---

## 1:17 · Buffer

**Time:** 3 min. Spend it wherever you ran over.

**If behind, cut in this order:**
1. Step 1: skip "3 saves ago". Ask only why arrows point back.
2. Step 4 follow-up. Say the answer yourself.
3. Step 5 follow-up (is the monster right?).
4. Step 7 follow-up (was the boss wrong?).
5. Paper: whole class, one answer, instead of pairs.
6. Step 3 early-finisher line.

**Never cut:**
- the Step 3 conflict
- the refused sends in Steps 5 and 6
- both Audits in Step 7
- the exit question
