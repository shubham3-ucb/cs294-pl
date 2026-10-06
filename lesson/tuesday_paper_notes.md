# Tuesday paper: notes from the full text

> **THE ONE MESSAGE (use these exact words everywhere: app, slides, projector, lesson):**
> **For analysts, flat history is data loss.** It is the paper's claim for data miners and analysts (§3.1), and the same paragraph gives the other side.
> **The trade-off, always next to it:** flat history helps developers find and revert a bad change (bisect, revert). It loses where a change came from and who made it.
> The habits that make Git history clean (fast-forward, rebase, squash) erase that provenance. Some of it cannot be recovered (§8).

**Just, Herzig, Czerwonka, Murphy. "Switching to Git: the Good, the Bad, and the Ugly." ISSRE 2016.** (Saarland University + Microsoft / Microsoft Research)
Full text read (12 pp.). Everything below is from the paper. Numbers are the paper's own estimates.

## Setting
- Microsoft teams moved from Source Depot and Team Foundation Server to Git.
- Microsoft mines nearly all products (Windows, Office, Bing) with a tool called **CodeMine**. Teams rely on process analytics: code quality, code owners, reviewers, testing, and **code velocity**.
- The point: Git changes behavior *and* storage, so metrics must be re-validated. Unadjusted analytics "may lead to imprecise recommendation tools used to guide multi-million dollar decisions."

## Git internals (§2.1), all true in our app
- 4 object types: **blob** (file content), **tree** (directory: entries → blob/tree IDs), **commit** (tree + all parent IDs + author name/email/time + committer + message), **tag**.
- Every object's ID = **SHA-1 of its header + content**. It is stored at `objects/ab/cdef…`.
- **References** = files holding an ID (or another ref): heads (local branches), remotes, tags.
- History is a **DAG**: start at a branch head and walk back through parents. A new commit only needs its parents' IDs.

## The Good (§3)
- Cheap branches. Commit and revert locally (private restore points). Fine-grained merges.
- Developers prefer **flat histories**: they "provide excellent opportunities to find defect inducing code changes and to revert them", and teams set integration policies for that.
- But "data miners and data analysts should consider flat histories as data loss" (§3.1): integration strategies that flatten history drop provenance, i.e. where a change came from and the path it took to the release branch.
- Analysts want **explicit merge commits** (a merge card with two parents shows exactly what happened).

## The Bad, part I: analytics (§4)
- Example metric: **code velocity**, the time from a change being done to it reaching the release branch. It needs tracing shipped code back to the original commit. Git's very different notion of a branch changes how you compute it.
- Two rules when switching tools: *measure the right thing*, and *measure the same thing as before*.

## The Bad, part II: Git data loss (§5)
Estimated over 9 open-source repos (Table 1: Android, Apache, BuildBot, CoreCLR, CoreFX, Eclipse, Git, Roslyn, Strider). These are lower bounds, because many operations can't be detected.

| Operation | What is lost | Paper's numbers / advice |
|---|---|---|
| **Fast-forward** | Which branch a change was made on (Git doesn't bind commits to branches). Content, authors and times stay. | Undetectable, "common, daily". Use `--no-ff` or put metadata in merge messages. |
| **Rebase** | The patch itself is rewritten (churn changes). A cross-branch rebase looks like a direct edit. | Android ~71k (~28/day), Apache ~78/day. Little can be done except avoiding cross-branch rebases. |
| **Apply** (emailed patch) | Original author and time. | Use `git format-patch` + `git am`. |
| **Squash** | The individual commits. With deleted feature branches (GitFlow), **even author and timing**. Raises "tangled changes". | ~2/day Android, ~15/day Apache, ~19/day Eclipse (final squashes only). No perfect fix. |
| **Revert** (partial) | Tangled changes, hard tracing. | Revert whole commits; keep "This reverts commit …". |
| **Timestamps** | Clocks are local and unsynced, and can be faked via `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE`. | >99k "wrong" timestamps across the 9 repos; most are the constant 1970-01-12 14:46:40; ~40/day in Android. |
| **Identities** | Git never checks name/email (no central authentication). | Use org login in a check-in wizard, or merge aliases heuristically. |

## The Ugly (§6): integration paths
- **Integration path** of change C into branch B = a path through the DAG from C's original commit to the commit that integrated C into B. There can be many.
- **Code velocity** of C into B = the minimum, over all integration paths p, of Δtime(tail(p), head(p)) (§6.1).
- The paper **defines** code velocity and an integration-path algorithm. It reports **no velocity numbers**. Say "Microsoft tracks code velocity", never "the paper measures it".
- Microsoft's old algorithm (Tarvo et al.) assumed a centralized VCS and had to be **completely redesigned** for Git.
- **New algorithm:** peel the DAG into layers ("tiers"). It needs **no timestamps**.
  - Tier 0: the global multi-graph.
  - Tier 1: label edits vs merges.
  - Tier 2: per-branch, label edges branch vs merge.
  - Tier 3: walk first parents from the head, labelling edges *forward*; every other edge is a *switch*. This partially recovers which branch a commit was made on.
  - Tier 4: label edges *integration* vs *delay*, to find the earliest integration.
  - Tier 5: *convergence graph*, mapping every commit to the point where it first becomes visible in the target branch.
- Limits: changes integrated *outside* the DAG (e.g. cherry-picks) still bias results without metadata.

## Conclusion (§8)
- Many patterns can be adjusted to avoid or minimize loss. For some, **"the information loss is so severe, it cannot be recovered."**
- Teams that need exact event timing or must **prove code origin** have to weigh the benefits against the costs of history-altering patterns. They should educate developers, configure tools, or set policy. Git might one day need to store more by default.

## How the app shows each point (true by construction)
- **Step 1:** a card = tree + parent + author + committer + message, and its ID = a SHA-1 (shown with `git cat-file -p`). Git takes your name and your laptop's clock on trust (§5.6–5.7).
- **Step 3:** students predict each merge first. The first merge is a **fast-forward**: main's note slides, and no merge card is made. Then the lab deletes the fancy note (`git branch -d fancy`), and no card says which cards were made on fancy (§5.1). The second merge makes an **explicit merge card** with two parents, which is what analysts want (§3.1).
- **Step 4:** a refused lab chooses: combine (a merge card) or replay on top: **rebase** writes a new card with a new ID, and the original is only in that lab's reflog (§5.2). The reveal marks each change's **integration path**, from its card to the card its lab's send made main, with this class's own times: "how long did it take?" is what the paper calls code velocity (§6.1).
- **Step 5:** a whole-card revert keeps "This reverts commit …" in the message, so analysts can trace it (§5.5).
- **Step 6:** **squash** makes one new card with a new ID, so the individual cards and their authors are gone from the Wall (§5.4: with deleted feature branches, even author and timing). Force push makes the Wall forget them, and gc deletes them. The audit "who first added the 🥾 boots?" fails on the Wall but works in labs that kept their history (§8: some loss cannot be recovered). A lab that kept the old history merges it back on its next Get & combine: rewriting shared history needs every copy to go along.

## Safe one-liners for slides
- "Git made developers faster. It also made history easier to lose."
- "For analysts, flat history is data loss." (§3.1: data miners and analysts "should consider flat histories as data loss".) Always with: "For developers it helps: a bad change is quick to find and revert."
- "Fast-forward forgets the branch. Rebase rewrites the patch. Squash can drop the cards and, once the branch is deleted, even who made them."
- "Some loss cannot be recovered." (§8)
