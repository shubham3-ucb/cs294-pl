# Teacher brief · Git week in 10 minutes

Two 80-minute classes, one app. You press **Next**; the class runs. Students use their laptops; the projector is the slide deck; your laptop shows a private console with what to **Say**, what to **Ask**, and the answer you hope to hear.

| | Tuesday · Outfit Lab | Thursday · The Humans |
|---|---|---|
| Paper | Just et al., *Switching to Git*, ISSRE 2016 | Yang et al., *Do Developers Really Know How to Use Git Commands?*, TOSEM 2022 |
| Students do | Dress one character in groups of 4; every save, merge, send and undo is real Git; they **predict** before Git acts and **choose** how to fix | Take the paper's survey, label its real posts, code its comments, put its claims on trial, design a fix |
| The one message | **For analysts, flat history is data loss** (developers gain easy bisect and revert) | **Asking is not using** (check what your data actually records) |
| Links | `…/` · `…/admin?key=…` · `…/screen?key=…` | `…/thu` · `…/thu/admin?key=…` · `…/thu/screen?key=…` |

Day of: [`DAY_OF.md`](DAY_OF.md) (tmux, Extend displays, test join, Reset, post the link). Full scripts: [`tuesday.md`](tuesday.md), [`thursday.md`](thursday.md).

## The loop, both days

Next → read **Say** → students work (watch "done" on the console, or the clock) → Next → ask **Ask** → hear answers → Next.

---

## Tuesday · step by step

| Time | Step | Students do | You land |
|---|---|---|---|
| 0:00 | Join | Type a name; the app picks the lab | — |
| 0:03 | **0 Chaos** | Everyone edits one outfit, 90 s | Nothing was saved. *Ask:* what rule would fix it? → save every version, with a name |
| 0:06 | **1 Save** · `git commit` | Each saves one card | A commit = a snapshot + parent + name + time. Git trusts your laptop's name and clock |
| 0:12 | **2 Two ideas** · `git switch -c` | Pairs build fancy and sporty on sticky notes | A branch is a sticky note pointing at a card. Nothing is copied |
| 0:19 | **3 Combine** · `git merge` | **Predict**, merge fancy (fast-forward), delete it; predict, merge sporty (conflict on TOP, a person picks) | After a fast-forward and delete, no card says it was made on fancy |
| 0:31 | Break | | |
| 0:35 | **4 Share** · `push`, `pull`, `rebase` | Predict each send. First lab gets in; refused labs **choose** merge or rebase | Push only moves forward. Rebase replays a card: same change and author, new parent → new ID |
| 0:49 | **5 Undo** · `revert`, `reset` | The Intern's 🥸 card arrives. Each lab **chooses** Undo (revert) or Move back (reset) | Revert adds a fix card: safe to share. Reset drops a shared card: the Wall refuses it |
| 0:59 | **6 Clean up** · squash, `push --force`, `gc` | The boss squashes the Wall into one card | "Who added the 🥾?" — the Wall no longer knows |
| 1:07 | **The paper** | Pairs: squash-merge, gains vs losses | Gain: one revertable card per feature. Lose: who wrote what, and when |
| 1:12 | Exit | Password reached the Wall: does revert remove it? | No. Change the password; then rewrite, force push, gc, and everyone re-clones |
| 1:15 | Wrap | My Git in 7 lines | — |

**Git you must know cold (Tuesday)**
- A **commit** stores a snapshot, its parent(s), author + time, committer + time. Its ID is a hash of all of it: change anything, new ID.
- A **branch** is a name pointing at one commit. HEAD is "the branch you're on".
- **Fast-forward**: if your branch has nothing new, merge just moves the pointer. No merge commit, so no record of the branch.
- **Conflict**: both sides changed the same or neighbouring lines. A person decides.
- **Push** is refused if the remote has commits you don't (fetch first). **Pull** = fetch + merge (or rebase).
- **Rebase** replays your commits on top: same change, author and author time; new parent, committer time and ID. The old commit stays only in your **reflog**.
- **Revert** adds an opposite commit (history grows; safe when shared). **Reset** moves your branch back (history rewritten; refused on push).
- **Squash + force push + gc**: one new commit replaces history; the old commits become unreachable and gc deletes them. Copies elsewhere still have them.

**Hard questions (Tuesday)**
- *"Isn't flat history better?"* For developers, often: easy to bisect and revert. For analysts, it erases where changes came from (the paper's point).
- *"Why did my rebased card get a new ID if nothing changed?"* Its parent changed, so its snapshot and committer time changed; the ID hashes all of it.
- *"Does gc remove the password everywhere?"* No: only on the Wall. Every clone still has it; on GitHub, old commits can stay fetchable by ID. Change the secret.
- *"Real Git: one working copy per clone?"* Yes. Here the lab shares one repo, so Switch refuses unsaved parts, as Git protects them.

---

## Thursday · step by step

| Time | Scene | Students do | You land |
|---|---|---|---|
| 0:00 | Join | Name | — |
| 0:03 | **Be the data** | The paper's real survey (Q2–Q7) | You are respondent 93 |
| 0:07 | The paper in one slide | Listen | 5 RQs: 4 from Stack Overflow posts, 1 from a survey |
| 0:09 | **1 The question** | Vote: kind of study | Need-finding. Stack Overflow only records getting stuck |
| 0:13 | **2 The data** | Vote: what are posts | Traces — of *asking*, not using. Nobody was watched |
| 0:17 | You vs the paper's 92 | Compare | A self-rating is a judgment, "how I learned" a memory; the 92 were found via Stack Overflow |
| 0:20 | **3 The analysis**: 8 posts | Label: stuck on it / needs it, can't name it / not about it | The rule counts all three the same; in 5 of 8 only the answer names the command |
| 0:32 | Code 7 comments | Put the paper's Table 8 comments in its categories | The paper names no method, no second coder, no agreement |
| 0:40 | Break | Back on /thu; groups form on Next | Check "here" = the room |
| 0:45 | **4 Do you believe it?** | Groups: one claim each — what was measured, what it supports | Experience survives (it's weak); difficulty, learning, self-rating shrink |
| 0:57 | **5 Design** | Why must people *ask* how to undo? One change + study + measure/threat + data | Asking finds needs; only an evaluative study shows a fix works |
| 1:09 | What Git and Jujutsu did | — | `git switch`/`restore` (2019); `jj undo`. Did they help? Nobody measured |
| 1:11 | **What holds, what doesn't** | — | Holds: many steady questions; undo is a real need; experienced devs can struggle; public data. Doesn't: "hardest commands", the ranking, "self-learning", Table 8 and "doubts", the title |
| 1:13 | Exit + **Asking is not using.** | One line each | — |

**The paper in five lines (Thursday)**
- 80,370 Stack Overflow questions (2008–2020) that mention a Git command, plus a survey of 92 developers.
- Most viewed: revert, reflog, stash, clean, reset (recovery). Hardest (no accepted answer): rare commands, then credential, submodule.
- Many askers have old accounts (in 2020, 40% had registered more than 5 years earlier). 81.7% of ticked learning approaches are self-learning.
- **The rule:** a post counts for every command in its question *or accepted answer* — so fixes get counted as problems.
- Their data is public; we re-ran their rule (matches 73 of 136 command counts exactly): one 9.1M-view undo question moves `git reflog` from #8 to #2.

**Hard questions (Thursday)**
- *"Isn't a question body self-report?"* Partly. It's still a trace: written during real work, not for the study. But it records asking, not using.
- *"So is the paper useless?"* No. Need-finding works: undo is heavily viewed; the experience claim holds as written; they published their data so we could check.
- *"What would a better study do?"* Watch people do Git tasks, or log real use (recoveries, time to recover), with an evaluative question for a fix.
- *"Is 81.7% wrong?"* No — it's ticks, and by people 85/92 chose the internet. The issue is who was asked (found via Stack Overflow) and memory.

---

## If something goes wrong

- **Stuck lab (Tue):** Stuck? Hint (after 45 s), then **Rescue** on its tile.
- **Groups wrong (Thu):** **Re-form groups** under People (before groups start typing).
- **Pressed Next too early:** **Back**.
- **Link died:** in tmux, `./host.sh` again; post the new link; students type the same name and get their place back.
- **App dead:** teach from the deck PDFs (`slides/*_preview.pdf`); votes by hand.
