# Tuesday · Outfit Lab · one page

80 min · 3 labs · S presses only **Next** (→ / Space; ← = Back). A walks the labs. Each step is two scenes: a task, then a reveal with the question. Ask before the reveal. Read Say and Ask from the teacher page.

| Time | Scene | The one question | Hope to hear |
|---|---|---|---|
| 0:00 | Join. Name only; the app picks the lab. | — | — |
| 0:03 | Step 0 · Everyone, one outfit. 90 s, then "Hands off." | What did your outfit look like a minute ago? Who changed the shoes? | No idea. Nothing was saved. |
| 0:04:30 | Step 0 reveal. Learning objectives, in plain words. | What rule would fix this? | Save every version, with a name on it. |
| 0:08 | Step 1 · Save card. Reveal: `git commit` + "Git stores the name and clock your laptop gives it. It checks neither." | Why do arrows point back, never forward? | The next card doesn't exist yet. Cards never change. |
| 0:15 | Step 2 · fancy and sporty. Reveal: `git branch`. | Where is the original outfit now? Did anything get copied? | Still on main's card. Nothing was copied. |
| 0:22 | Step 3 · Fast-forward fancy, delete the fancy note, then the TOP conflict. Reveal: `git merge`. | Which cards were made on fancy? | No way to tell. Git does not record the branch a commit was made on. |
| 0:33 | **Break, 4 min.** "Break. Back in 4 minutes." Write the return time. | — | — |
| 0:37 | Step 4 · Next puts one lab's outfit on the Wall. First lab wins; refused labs combine (merge) or replay on top (rebase). Reveal: `git push / git pull`, `git rebase`, and each change's path to main with this class's times. | The replayed card has the same change, author and author time. Why does it have a new ID? | Its parent is new, so its snapshot is too: it now includes the Wall's change. Its committer time is new. The ID is a hash of all of it. |
| 0:50 | Step 5 · Next puts the 🥸 card on the Wall and in the labs. Undo it, or move back and be refused. Reveal: `git revert / git reset`. | Why is adding a fix card safe, but moving back is not? | A fix card only adds. Moving back drops a shared card. |
| 0:59 | Step 6 · Next runs the 🥾 audit; the boss lab replaces the Wall. Reveal: Squash + `git push --force`, the audit again, then Empty the Wall's bin. | Who added the boots? Where does that answer still exist? | Not on the Wall. Only in the labs that kept the old cards. |
| 1:07 | The paper: **flat history is data loss.** Code velocity: this class's Step 4 paths. Pairs, 2 min, in the app. | You run your company's Wall. Give one rule: the boss gets a clean history, and the auditor still knows who added the boots. | No force push to main. Or: squash only your own branch, before you share it. |
| 1:12 | Exit question. On your own, in the app. | A password reached the Wall. Two labs pulled. Does Undo this card (revert) remove it? If not, what would? | No. Revert adds a card; the old one still holds the password, in every copy. Change the password. Then rewrite, force push and gc. |
| 1:15 | What you built. Read the homework. | — | — |
| 1:17 | **Buffer, 3 min.** | — | — |

**Never cut:** the Step 3 conflict · the refused sends in Steps 4 and 5 · both Step 6 scenes · the exit question.

**Stuck lab:** students press **Stuck? Hint**. Still stuck: **Rescue** on its tile.

**Homework:** Yang et al., §3.2–3.5. For one finding, write down what they measured.

<div style="page-break-after: always"></div>

# Thursday · Git, Part 2: The Humans · one page

80 min · 3 teams (Tuesday's labs) · Shubham before the break, Ananya after. Critique with three questions: Interesting? Can the data answer it? Do we believe the analysis?

| Time | Step | The one question | Hope to hear |
|---|---|---|---|
| 0:00 | Slide 1 · Welcome. Sit with your Tuesday lab. | — | — |
| 0:02 | Slides 2–3 · Hook. Menti vote, then: revert wins. | Think of Tuesday's 🥸 disguise. Why would "undo" confuse people? | The right undo depends on where the card is. |
| 0:07 | Slide 4 · The study. No judging yet. | — | — |
| 0:10 | Slide 5 · What they found. | Which of these three do you believe least? (One word, private.) | — |
| 0:14 | Slide 6 · Three questions, the ladder. | This paper has two data sources. Where does each sit? | Questions: traces of asking for help. Survey: self-report. |
| 0:19 | Slide 7 · Claim Court, 12 min. Minute-5 check at 0:24. | What did they measure? | The card's "Measured" line. |
| 0:31 | Slide 8 · Pitches, jury vote. | Why did one claim survive and two shrink? | Team 3's measure matches its words. |
| 0:42 | Slide 9 · Claimed ≠ measured. | They counted command names. What would a tool designer rather know? | What people tried to do, and where they got stuck. |
| 0:48 | **Break, 4 min.** "Back in 4 minutes." Deal finding cards. | — | — |
| 0:52 | Slide 11 · Design sprint. 7 min build, 1 min pitches. | How would you know it worked, without asking anyone? | Something logged or watched. |
| 1:04 | Slide 12 · Git listened (2019). | Did switch and restore help? How would you find out? | Two groups, same task. Log time, errors, lost work. |
| 1:09 | Slide 12 · Design question, 1 min. | Each sticky note kept its own draft. Real Git doesn't. Which do you want? | The app's. (Gitless made that choice.) |
| 1:10 | Slide 13 · Exit, Menti, alone. | Which lesson up there did no slide say? Whose is it? | A student names theirs. |
| 1:16 | Slide 14 · Close. | — | — |
| 1:18 | **Buffer, 2 min.** | — | — |

**Never cut:** the minute-5 check · the break · the exit.

**Say it right:** "81.7% of survey ticks", never "of developers". "Accounts over 5 years old", never "5 years of Git".
