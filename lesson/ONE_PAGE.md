# Tuesday · Outfit Lab · one page

80 min · 3 labs · S presses only **Next** (→ / Space; ← = Back). A walks the labs. Each step is two scenes: a task, then a reveal with the question. Ask before the reveal. Read Say and Ask from the teacher page.

| Time | Scene | The one question | Hope to hear |
|---|---|---|---|
| 0:00 | Join. Name only; the app picks the lab. | — | — |
| 0:03 | Step 0 · Everyone, one outfit. 90 s, then "Hands off." | Who changed the shoes? What did it look like a minute ago? | No idea. Nothing was saved. |
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
| 1:15 | What you built: My Git in 7 lines. | — | — |
| 1:17 | **Buffer, 3 min.** | — | — |

**Never cut:** the Step 3 conflict · the refused sends in Steps 4 and 5 · both Step 6 scenes · the exit question.

**Stuck lab:** after 45 s students get **Stuck? Hint** (the idea first, then the exact click). Still stuck: **Rescue** on its tile.

**Homework:** Yang et al., §3.2–3.5. For one finding, write down what they measured.

<div style="page-break-after: always"></div>

# Thursday · Git, Part 2: The Humans · one page

80 min (76 + 4 buffer) · the app at `/thu` · press only **Next** (→ / Space; ← = Back) · groups of about 4 form at the break. Sarah's order: the question, the data, the analysis, do we believe it, a design insight. Read Say and Ask from the teacher page; the clock turns red when a scene runs over.

| Time | Scene | The one question | Hope to hear |
|---|---|---|---|
| 0:00 | Join. First name only. | — | — |
| 0:03 | Take the paper's survey: the form's real questions. | — | — |
| 0:07 | The paper in one slide: five RQs. | — | — |
| 0:09 | Vote, then reveal: need-finding. | Is the question interesting? | Yes, if it tells designers which needs to design for. |
| 0:13 | Vote, then reveal: traces, of asking. | Can this data answer "do developers know how to use Git commands?" | No. It shows what people asked, not what they can do. |
| 0:17 | You and the paper's 92. | Your level, and how you learned: which would you trust? | Neither fully: a judgment and a memory; the sample came from Stack Overflow. |
| 0:20 | Label 8 real posts, 8 min. | — | — |
| 0:28 | The rule and you. | Did they measure "developers find this command hard"? | They measured "appears near a question": stuck, needs it, and not about it, all the same. |
| 0:32 | Code 7 of the paper's comments, 5 min. | — | — |
| 0:37 | Coding without a method. | What would make Table 8 trustworthy? | A named method, a codebook, two coders and their agreement. |
| 0:40 | **Break, 5 min.** Everyone back on /thu; groups form on Next. | — | — |
| 0:45 | Put one claim on trial, 7 min. | — | — |
| 0:52 | The verdicts. | Which claim survives best, and why? | Experience survives as written, because it is weak. Three shrink. |
| 0:57 | Design for the need that survived, 9 min. | — | — |
| 1:06 | Your designs. | Which could you test by watching people? Which threat is hardest? | A visible measure, like time to recover. A learning effect. |
| 1:09 | What Git and Jujutsu did. | Which data would convince Git's maintainers? | Observation or traces of real use. Not a survey. |
| 1:11 | The paper: what holds, what doesn't. | Fair to the authors? | Need-finding from public data is useful; counts of asking are not difficulty or skill. |
| 1:13 | Exit, alone: one new idea for building tools for people. | — | — |
| 1:15 | **Asking is not using.** | — | — |
| 1:16 | **Buffer, 4 min.** | — | — |

**Never cut:** the 8 labels · the coding · the verdicts · the design · the exit.

**Say it right:** "81.7% of ticked boxes", never "of developers". "Accounts registered more than 5 years earlier", never "5 years of Git". "Our re-run of their rule on their data" for every number the paper does not print.
