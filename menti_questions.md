# Mentimeter questions: Git Week (copy-paste ready)

Make two Menti presentations: **"Git Tue · Monster Lab"** (7 slides) and **"Git Thu · The Humans"** (6 slides). Source of truth: `design/spec.md` §8.

**Settings for every slide:**
- Hide results until you reveal them.
- Anonymous; one vote per person.
- For multiple choice, select "Mark correct answer(s)" where a correct answer is listed. Use plain multiple choice, not "Quiz competition" (no leaderboard, no countdown).

Menti doesn't render backticks, so the copy blocks below are plain text. Paste each line into its own option field.

**Put the access code + QR on the slides** (each presentation has one code; the deck shows "menti.com · ____" and a dashed "QR" box until you do):
- Tuesday code/QR go on deck slides 2 (T2), 14 (T14) and 32 (T31). Thursday code/QR go on slides 2 (H2) and 20 (H20). H8 and H14 point to the same Thursday presentation.
- Either edit them in Google Slides after import (type the code into the black chip; Insert → Image over the dashed box), or set `MENTI_CODE` and save the QR PNG at `MENTI_QR` at the top of `slides/build/build_tuesday.py` / `build_thursday.py`, then rebuild and re-import.
- Menti codes can expire; generate them close to class and test them from a phone.

---

## TUESDAY (7 Menti slides)

### Tue-1 · T2 · Hook
- **When:** open as students arrive (0:00). Close at 0:02. **Don't reveal.** Show results on T10 (~0:19).
- **Type:** Multiple choice · single answer · correct marked · results hidden
- **Question:**
```
You type: git branch experiment
What does Git create?
```
- **Options:**
```
A copy of all your files
A copy of all your commits
One new commit
One tiny file holding one ID
```
- **Correct:** One tiny file holding one ID
- **Say on T10:** "A branch is a 41-byte file holding one commit ID. You just watched me make one with a shell redirect."

### Tue-2 · T14 · Predict the merge
- **When:** right after the live merge on T13 (~0:30). 30 s vote, then reveal and show B1.
- **Type:** Multiple choice · single answer · correct marked
- **Question:**
```
I delete the blank lines between the panels and merge again. What conflicts?
```
- **Options:**
```
BODY only
FACE + BODY
All three lines
Nothing
```
- **Correct:** All three lines
- **Say:** "Git merges lines. Changed lines that touch form one hunk. That's a false alarm: nobody disagreed about FACE or LEGS."

### Tue-3 to Tue-6 · T31 · Exit ticket (4 questions, laptops closed)
- **When:** 1:09–1:13, right after the paper slide and **before** the recap. About 50 s per question. Reveal each one after it closes.
- **Type:** Multiple choice · single answer · correct marked
- **Remediation:** any item under 70% correct → redo it on cards right away (2 min from the buffer), and re-ask it on Thursday's H4.

**Tue-3 · Q-a (objective 2: shared ancestor)**
```
BASE: smiley, box, sticks.
Lab 1: cat, box, sticks.
Lab 2: cat, box, roller skates.
Merge. What conflicts?
```
```
FACE
LEGS
FACE and LEGS
Nothing
```
- **Correct:** Nothing. Both labs made the *same* change to FACE, and only Lab 2 touched LEGS. (T12's rule: "Both changed **differently** → you decide." Verified in real git.)

**Tue-4 · Q-b (objective 1: cards never change)**
```
You run git commit --amend on a commit you already pushed. Its ID…
```
```
stays the same
changes, and the old commit still exists
changes, and the old commit is deleted
```
- **Correct:** changes, and the old commit still exists. (Amend writes a new card; the old one is still on the wall and in everyone's clone.)

**Tue-5 · Q-c (objective 3: rejected push)**
```
Your push says: ! [rejected] main -> main (fetch first)
What do you run?
```
```
git push --force
git pull, then git push
delete your commit and redo it
wait, then push again
```
- **Correct:** git pull, then git push. (Fetch the wall's new cards, combine, post. Force would knock a teammate's card off main.)

**Tue-6 · Q-d (objective 4: revert vs reset)**
```
A bad commit is on shared main. Two teammates already pulled. Safest undo?
```
```
git revert, then push
git reset --hard HEAD~1, then push --force
git commit --amend, then push --force
git rebase -i (drop it), then push --force
```
- **Correct:** git revert, then push. (Fix card. The other three rewrite shared history and bring back the zombie.)

### Tue-7 · spare
Keep one blank Open-ended slide at the end ("Questions for Thursday?"). Use it only if the buffer survives.

---

## THURSDAY (6 Menti slides)

### Thu-1 · H2 · Rank the commands
- **When:** 0:02, right after the welcome. 45 s. **Results hidden** until H3.
- **Type:** Ranking (6 items)
- **Question:**
```
Rank by average views per Stack Overflow question. Most viewed first.
```
- **Items:**
```
git rebase
git merge
git push
git revert
git checkout
git commit
```
- **Truth** (Yang et al., Table 4, avg views, commands with ≥200 questions): revert #1 · commit #16 · checkout #17 · push #21 · merge #24 · rebase not in the top 30. Menti ranking has no "correct" setting; show the class ranking, then H3.
- **Say:** "Tuesday primed you on revert. The surprise is merge and rebase."

### Thu-2 · H8 · Q1 · Research-question type
- **When:** ~0:14, on H8 (blank prompts, unlabelled ladder). 30 s. Reveal on H9.
- **Type:** Multiple choice · single answer · correct marked
- **Question:**
```
What type of research question is this study?
```
- **Options:**
```
Reconnaissance (need-finding)
Formative
Evaluative
```
- **Correct:** Reconnaissance (need-finding)
- **If many pick Evaluative:** "Which tool or intervention is being evaluated?" **If Formative:** "Which design is this feeding?"

### Thu-3 · H8 · Q2 · Data ladder rungs
- **When:** right after Thu-2. 30 s. Reveal on H9.
- **Type:** Multiple choice · single answer · correct marked
- **Question:**
```
Which rungs of Sarah's data ladder? (1 observe people · 2 traces in the wild · 3 tricks to avoid introspection · 4 self-report)
```
- **Options:**
```
SO: 1 · Survey: 2
SO: 2 · Survey: 4
SO: 2 · Survey: 3
SO: 4 · Survey: 4
```
- **Correct:** SO: 2 · Survey: 4
- **If SO on rung 1:** "Did anyone watch a developer use git?" **If survey on rung 3:** "What trick did they use to avoid introspection?"

### Thu-4 · H14 · Jury vote (before)
- **When:** 0:34, start of "Court is in session". 60 s. Hide results until after the re-vote.
- **Type:** Scales · range 1–5 · left label "don't believe" · right label "fully believe"
- **Question:**
```
Jury: how much do you believe each claim?
```
- **Statements:**
```
Pink: "even developers with years of development experience can have trouble using Git commands" (p.13)
Blue: "self-learning is the primary way for developers to learn to use Git commands" (p.20)
Orange: "Git commands … about recovery are among the most popular commands asked on Stack Overflow" (p.15)
```

### Thu-5 · H14 · Jury vote (after)
- **When:** after the three 3-minute court presentations (~0:44). 45 s. Then show before and after side by side.
- **Type:** Scales (duplicate Thu-4: same range, labels, statements)
- **Question:**
```
Now how much do you believe each claim?
```
- **Expected:** Pink and Blue drop; Orange mostly survives. **Say:** "Critique means calibrating belief, not rejecting everything."

### Thu-6 · H20 · Exit (individual)
- **When:** 1:11, right after the design-sprint pitches and **before** H21 ("Ours, for comparison"). 3 min of writing. Read 3–4 aloud.
- **Type:** Open ended · results shown only after writing time
- **Question:**
```
On your own: Finding (with evidence) → I'd change the tool so that ___ → I'd know it worked if ___ (logged or observed, not self-report).
```
- **No correct answer.** A good answer names a finding with evidence, makes a concrete change, and gives a measure you could log or observe.
- **Follow-up:** any answer that is only critique, or uses a self-report measure, gets "so a tool designer should what, and how would you know?" in the post-class Ed message.

---

**Not on Menti (on purpose):**
- The Thursday self-rating uses **paper slips** dealt at random (H10). It's a two-group test with a prediction written before the tally, so paper is simpler and keeps the two groups hidden.
- Tuesday's think-pair-share (T29) and the Model Critic readout (T33) are spoken, not polled.
