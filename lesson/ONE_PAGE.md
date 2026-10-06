# Tuesday · Outfit Lab · one page

80 min · 3 labs · S presses only **Next** (→ / Space; ← = Back). A walks the labs. Each step is two scenes: a task, then a reveal with the question. Ask before the reveal. Read Say and Ask from the teacher page.

| Time | Scene | The one question | Hope to hear |
|---|---|---|---|
| 0:00 | Join. Name only; the app picks the lab. | — | — |
| 0:03 | Step 0 · Everyone edits the same outfit. 90 s, then "Hands off." | Who changed the shoes? What did it look like a minute ago? | No idea. Nothing was saved. |
| 0:04:30 | Step 0 reveal. | What rule would fix this? | Save every version, with a name on it. |
| 0:06:30 | Step 1 · Save card. Reveal: `git commit` + "Git stores the name and clock your laptop gives it. It checks neither." | Why do arrows point back, never forward? | The next card doesn't exist yet. Cards never change. |
| 0:12 | Step 2 · fancy and sporty. Switch refuses unsaved parts. Reveal: `git branch`. | Where is the original outfit now? Did anything get copied? | Still on main's card. Nothing was copied. |
| 0:19 | Step 3 · **Predict**, then merge fancy (fast-forward) and delete it; predict, then merge sporty (TOP conflict). Reveal: `git merge` + who predicted right. | Which cards were made on fancy? | No way to tell. Git does not record the branch a commit was made on. |
| 0:31 | **Break, 4 min.** | — | — |
| 0:35 | Step 4 · Predict each send. The first lab gets in; a refused lab **chooses** merge or rebase and says why. Reveal: `push / pull`, `rebase`, paths with this class's times, choices, accuracy. | The replayed card has the same change, author and author time. Why a new ID? | Its parent is new, so its snapshot is too; its committer time is new. The ID is a hash of all of it. |
| 0:49 | Step 5 · The 🥸 card arrives. Each lab **chooses** Undo (revert) or Move back (reset); predict each send. Reveal: `revert / reset`. | Why is adding a fix card safe, but moving back is not? | A fix card only adds. Moving back drops a shared card. |
| 0:59 | Step 6 · The 🥾 audit; the boss lab squashes and force-pushes. Reveal: the audit again, then Empty the Wall's bin. | Who added the boots? Where does that answer still exist? | Not on the Wall. Only in labs that kept the old cards. |
| 1:07 | The paper: **for analysts, flat history is data loss.** Pairs, 2 min. | Your team squash-merges every feature branch and deletes it. What do you gain, and what can an auditor no longer answer? | Gain: one revertable card per feature, easy bisect. Lose: who wrote which part and when. |
| 1:12 | Exit question, on your own. | A password reached the Wall. Two labs pulled. Does Undo this card (revert) remove it? If not, what would? | No. Change the password first. Then rewrite, force push and gc the Wall, and every lab re-clones. |
| 1:15 | What you did today: My Git in 7 lines. | — | — |
| 1:17 | **Buffer, 3 min.** | — | — |

**Never cut:** the Step 3 conflict · the refused sends in Steps 4 and 5 · both Step 6 scenes · the exit question.

**Stuck lab:** after 45 s students get **Need a hint?** (the idea first, then the exact click). Still stuck: **Rescue** on its tile.

**Homework:** Yang et al., §3.2–3.5. For one finding, write down what they measured.

<div style="page-break-after: always"></div>

# Thursday · Git, Part 2: The Humans · one page

80 min (74 + 6 buffer) · the app at `/thu` · press only **Next** (→ / Space; ← = Back) · groups of about 4 form at the break. How the study was done, check it yourself, judge it, design. Read Say and Ask from the teacher page; the clock turns red when a scene runs over.

| Time | Scene | The one question | Hope to hear |
|---|---|---|---|
| 0:00 | Join. First name only. | — | — |
| 0:03 | Take the paper's survey. | — | — |
| 0:07 | How the study was done. Tell it; no quiz. | — | — |
| 0:11 | What the paper found. | — | — |
| 0:14 | Your answers next to the paper's 92. | Would you trust your own answers? | Not fully: a rating is a judgment, "how I learned" a memory. |
| 0:17 | Read 8 real posts, 8 min. | — | — |
| 0:25 | Your labels for the 8 posts. | Did the paper measure which commands are hard? | No. It measured where a command's name appears. |
| 0:29 | Sort 7 survey comments, 5 min. | — | — |
| 0:34 | Your sorting next to the paper's. | Would another team get the same categories? | Maybe not: name a method, report agreement. |
| 0:37 | **Break, 5 min.** Everyone back on /thu; groups form on Next. | — | — |
| 0:42 | Check one claim from the paper, 8 min. | — | — |
| 0:50 | The four claims, and what the data supports. | Which claim holds up best? | Experience, because it is weak. Three shrink. |
| 0:55 | Design a better undo, 10 min. | — | — |
| 1:05 | Your designs. | Which could you test by watching people? | A visible measure: time to recover. |
| 1:08 | What holds in the paper, and what does not. | — | — |
| 1:11 | One idea to take home. | — | — |
| 1:13 | Thank you. | — | — |
| 1:14 | **Buffer, 6 min.** | — | — |

**Never cut:** the 8 labels · the coding · the verdicts · the design · the exit.

**Say it right:** "81.7% of ticked boxes", never "of developers". "Accounts registered more than 5 years earlier", never "5 years of Git". "Our re-run of their rule on their data" for every number the paper does not print.
