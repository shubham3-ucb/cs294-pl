# Monster Lab — the app (SPEC v2)

A small web app for an 80-minute class (10–40 PhD students in 2–6 "labs").
Each lab co-builds one monster. Every button runs **real Git** on the server.
Students feel a problem, use one new Git tool to fix it, and see what Git did behind the door.

Audience: PhD students. Tone: plain, warm, smart. Never childish, never jargon-first.
The bar: a student who has never used Git can follow every step without asking.

---

## 1. The model (what students see)

Each word has one meaning. "Card" is only a saved version; yellow is only a sticky note.

- **Monster** = 3 parts: FACE, BODY, LEGS. Each part is one choice from a small palette (emoji).
- **Card** = a saved version of the monster (a commit). Cards never change.
- **Sticky note** = a branch. A yellow label on one card. It moves when you save.
- **Your pin** = HEAD. Which sticky note *you* are on (per student).
- **Your draft** = the monster you are editing now (working copy). One per sticky note, shared live by everyone in the lab on that note. Stored as only the changed parts `{part: value}` on top of the note's card; a change that equals the card is dropped. A changed part = "not saved".
- **Your lab's cards** = your lab's own repository (all its cards and sticky notes).
- **The Wall** = the class's shared copy (a bare remote repo, "like GitHub"). Blue note `wall/main` = the Wall, last time you checked.
- **Safety diary** = the reflog. Every place a sticky note has been.

Palette (slug → emoji). Keep exactly these.
- FACE: smiley 🙂, cat 🐱, alien 👽, frog 🐸, dragon 🐲, ghost 👻, lion 🦁, monkey 🐵, (sabotage only) mustache 🥸
- BODY: box 📦, robot 🤖, superhero 🦸, cactus 🌵, pumpkin 🎃, coat 🧥, donut 🍩, shell 🐢
- LEGS: sticks 🦵, tentacles 🐙, wheels 🛞, skates 🛼, rocket 🚀, duck 🦆, paws 🐾

Mission parts appear only from their mission's step: cat, robot, superhero, tentacles from Step 2;
dragon, skates, cactus, alien, rocket, pumpkin from Step 5. Otherwise Step 1 can pre-set one and the
Step 3 conflict or the Step 7 audit quietly disappears. One function: `palette(step)`.

Start monster: smiley / box / sticks.

`monster.txt` (the only file in every commit) — the `---` lines are REQUIRED so changes to
different parts never touch adjacent lines (then Git merges each part independently):
```
face: smiley
---
body: box
---
legs: sticks
```

---

## 2. The steps (progressive disclosure — one Git tool at a time)

The facilitator advances steps for the whole class from the admin page. Each step adds its own
button(s); earlier buttons stay available (§3, action row). Copy below is FINAL wording (UI may
trim, never add jargon), except where lesson/tuesday.md later changed
the wording or the clock: those win, and `server/steps.js` holds the live copy. From Step 3 on, the
mission panel shows one fixed line above the instruction: "One person presses, everyone watches. Swap
each step."

| # | id | Title (UI) | Git | Minutes (work + talk) | Starts |
|---|---|---|---|---|---|
| 0 | chaos | Everyone, one monster | (none) | 1.5 + 2.5 | 0:03 |
| 1 | commit | Save every version | git commit, git log | 3 + 4 | 0:08 |
| 2 | branch | Try two ideas at once | git branch, git switch | 3 + 4 | 0:15 |
| 3 | merge | Make one monster from both | git merge (fast-forward + conflict) | 5 + 5 | 0:22 |
| 4 | remote | Meet the Wall | git clone, card IDs | 2 + 4 | 0:36 |
| 5 | push | Put your monster on the Wall | git push, git pull, refused push | 5 + 4 | 0:42 |
| 6 | undo | Oops: undo a shared mistake | git revert, git reset, git reflog | 4 + 5 | 0:51 |
| 7 | rewrite | The boss wants it clean | squash, git push --force, git gc | 2 + 6 | 1:00 |
| 8 | wrap | What you built | recap | 2 | 1:15 |

Around the steps (the lesson clock): join 0:00 (3 min) · objectives 0:07 (1 min) · break 0:32 (4 min, on
Step 3) · the paper 1:08 (4 min) and the exit question 1:12 (3 min), both on Step 7 · buffer 1:17 (3 min).
The plan clock starts 3 minutes before Step 0.

For each step `server/steps.js` holds: **instruction**, **mission** (per pair or lab, if any),
**unlocks**, **goals** (1–3 live ticks computed from lab state; offline members don't count),
**bonus** (one line shown once all goals tick, so fast labs read instead of spamming saves),
**check** (question the facilitator asks), **behind the door** (plain sentence + command),
**facilitator** (what to say/watch, ending with an "If behind:" line where one is given), `minutes`
(work time) and `at` (planned start).

### 0 · chaos — Everyone, one monster
- instruction: "Your lab shares one monster. Change any part, any time. Go!"
- unlocks: live shared editing of ONE monster per lab. No save, no names, last click wins.
- check: "What did your monster look like a minute ago? Who changed the legs?"
- behind: "No Git yet. Nothing is saved, and nobody knows who did what."
- facilitator: 90 seconds of chaos, then ask the check. Fish for: "save every version, with a name".

### 1 · commit — Save every version
- instruction: "Change one part, then press **Save card**. Take turns — everyone saves at least once."
- unlocks: draft editing, **Save card** (`git commit`), your lab's cards (history), card details.
- goals: "Everyone saved a card (3/4)".
- bonus: "Click the oldest card. Who made it? What is its parent?"
- check: "Which card came 3 saves ago, and who made it?"
- behind: "`git commit` — a card = the monster + the card before it + your name + the time. Git turns all of that into the card's ID."
- facilitator: point at arrows: every card points back to its parent. "Following arrows back = `git log`."

### 2 · branch — Try two ideas at once
- instruction: "Split into Pair A and Pair B. One of you makes your pair's sticky note; your partner switches to it. Build your idea and save."
- the mission panel shows "You're in Pair A (change)" in this step only.
- mission Pair A: "Press **New sticky note**, name it **cat-robot** (partner: **Switch to** cat-robot). FACE → 🐱, BODY → 🤖. **Save card**."
- mission Pair B: "Press **New sticky note**, name it **superhero** (partner: **Switch to** superhero). BODY → 🦸, LEGS → 🐙. **Save card**."
- unlocks: **New sticky note** (`git switch -c <name> main`: always starts from main; the name field is pre-filled with your pair's name), **Switch to [note ▾]** (`git switch`).
- main is read-only in Steps 2–3. Clicking a part on main: "main is the approved monster. Make or switch to a sticky note first." Merges into main still work.
- goals: "cat-robot has 🐱 + 🤖" · "superhero has 🦸 + 🐙".
- check: "Where is the original monster now? Did anything get copied?"
- behind: "`git branch` — a sticky note is a tiny file holding one card's ID. Your pin (HEAD) shows which note you're on."
- facilitator: If behind: at 4:00, Rescue the unfinished labs.

### 3 · merge — Make one monster from both
- instruction: "Together, on **main**: merge **cat-robot**. Then merge **superhero**."
- unlocks: **Merge [note ▾] into main** (`git merge <note>`), the conflict resolver, **Cancel merge**.
- expected: first merge = fast-forward (main's note just slides). Second = real merge: FACE (🐱) and LEGS (🐙) combine automatically, BODY conflicts (🤖 vs 🦸) → students pick one or choose any body.
- goals: "main has cat-robot" · "main has superhero (merge card)".
- bonus: "Open the merge card. Why two parents?"
- check: "Why did the first merge just move the sticky note? Why did BODY need a human?"
- behind: "`git merge` — Git compares each part with the card both ideas started from. Changed on one side: keep it. Changed on both, differently: conflict, you decide."

### 4 · remote — Meet the Wall
- on entering (once; Prev does not undo it): the server sends the chosen lab's main to the Wall (default: the first lab with all Step 3 goals ticked), then re-clones every lab from the Wall (`cloneLab`, as at session start) and moves every pin to main. Other sticky notes, drafts and open merges go. Wrap counts survive (they live in the concept tracker). This is the paper plan's "You were cloned".
- instruction: "The Wall is the class's shared copy, like GitHub. Your lab's cards are now a copy of it (Lab N's monster). Click the newest card in your lab's cards, then on the Wall. Same ID?"
- unlocks: the Wall view, blue `wall/main` note.
- check: "Why is every ID the same in every lab?"
- behind: "`git clone` copies every card. A card's ID is computed from everything on it, so an exact copy has the same ID on every laptop."
- facilitator: If behind: say it in 30 seconds.

### 5 · push — Put your monster on the Wall
- instruction: "Make your lab's change (your mission), **Save card**, then **Send to Wall**. Refused? Press **Get & combine**, then send again."
- mission per lab: Lab 1 "FACE → 🐲", Lab 2 "LEGS → 🛼", Lab 3 "BODY → 🌵", Lab 4 "FACE → 👽", Lab 5 "LEGS → 🚀", Lab 6 "BODY → 🎃".
- unlocks: **Send to Wall** (`git push`), **Get & combine** (`git pull`, shown as two lines: `git fetch` + `git merge`). Both work only on main; on another note the button reads "Switch to main first".
- expected: the first lab's send works; later labs are refused until they Get & combine. With 3 labs every combine is conflict-free (each lab changes a different part of the same Step 4 card). Labs 4–6 share a part with Labs 1–3 and resolve one conflict.
- goals: "Your lab's change is on the Wall" · "Your lab's cards match the Wall".
- check: "Why did the Wall refuse your card instead of just adding it?"
- behind: "`git push` + `git pull` — the Wall only moves forward. If it has cards you don't, pull first: fetch + merge."

### 6 · undo — Oops: undo a shared mistake
- on entering (once): Sabotage runs — "The Intern" adds a card to the Wall that sets FACE → 🥸 (mustache), message "Tiny style fix". The admin button re-runs it and does nothing if the Wall's FACE is already 🥸.
- instruction: "A mustache card reached the Wall. Get it, then remove it without breaking anyone's copy."
- mission odd labs: "Press **Get & combine**. Click the mustache card, press **Undo this card**, then **Send to Wall**."
- mission even labs: "Press **Get & combine**. Click the card before the mustache, press **Move my note back here**, then **Send to Wall**. What happens?"
- unlocks: in card details, **Undo this card** (`git revert`) and **Move my note back here** (`git reset --hard`); **Safety diary** (`git reflog`).
- expected: undo → new fix card → send works. Move back + send → refused; Get & combine brings the mustache card back (the zombie) — say it out loud. The diary shows every place main has been.
- goals: "You got the mustache card" · "Your lab's cards match the Wall, with no mustache".
- bonus: "Open the Safety diary. Find every place main has been."
- check: "Why is 'add a fix card' safe, and 'move the note back' not?"
- behind: "`git revert` adds a new card that undoes an old one. `git reset` moves your sticky note back — only safe if nobody else has the card. `git reflog` remembers every place your note has been."
- facilitator: If behind: skip the even labs' move back and show it yourself from the admin laptop.

### 7 · rewrite — The boss wants it clean
- the admin picks the boss lab (default Lab 1). Only that lab sees **Replace the Wall with one card** (`squash + git push --force`), red, confirm: "This erases the Wall's history for everyone. Sure?"
- instruction, boss lab: "The boss wants one clean card. Press **Replace the Wall with one card**."
- instruction, other labs: "Watch the Wall. Then: who added the tentacles? Where can you still find out?" Their Send to Wall is paused: "The boss is cleaning the Wall. Watch." (Otherwise a lab can send the old history back before the audit.)
- squash = one new card (main's monster, parent = the Start card, author = the presser, message "Clean history"), main moved to it, then `git push --force`.
- facilitator, in this order: **Audit** → (boss lab replaces the Wall) → **Audit** → **Empty the Wall's bin**. Both audit results show large on the projector. Before: "Tentacles first added by Priya (Lab 2), card 3fa9c1e." After: "Wall: not found · Lab 2: Priya, 3fa9c1e · Lab 3: Priya, 3fa9c1e." Point out: every lab still has the old cards.
- goals: "The Wall has one clean card".
- bonus: "Ask another lab who added the tentacles."
- check: "Who added the tentacles? Where does that answer still exist?"
- behind: "Squash makes a brand-new card with a new ID. `git push --force` makes the Wall forget the old ones. After `git gc`, they're gone. This is the Ugly in Tuesday's paper: rewriting erases the route each change took to main."

### 8 · wrap — What you built
- big line: "Cards never change. Sticky notes move. The Wall copies cards. That's Git."
- per-lab summary: cards saved, merges, conflicts solved, pushes, refused pushes, reverts; concept checklist.

---

## 3. Student UI

One page app at `/`. Desktop/laptop first (1280×800 and up), still usable at 390px wide.

**Join screen**: "Monster Lab" · name field · pick your lab (big colored buttons Lab 1..N with member
count) · Join. Names: trimmed, at most 24 characters, at least one letter or digit. Remember
identity in localStorage (pid). Pair auto-assigned A/B alternately; shown and changeable only in Step 2.

**Main screen** (lots of white space):
- **Top bar**: "Monster Lab · Lab 2 · Priya · Step 3 · Make one monster from both" (lab color dot). A small grey dot means "reconnecting".
- **Left — Mission panel** (lavender): step title (big) · the Step 3+ fixed line · instruction · your mission (highlighted) · goals (ticks; the next unticked one is bold — "your next move") · bonus once all tick · "We'll ask:" + check question (small, italic) · **Behind the door · what Git just did** (collapsible): the plain sentence, "You'd type: `git commit`", and a toggle "Show the low-level steps Git ran" (the exact plumbing commands, with output).
- **Center — Your draft**: title "Your draft" with a "You're on: [note]" chip; 3 stacked panels (emoji + part name), no card frame. Click a panel → palette popover. Unsaved parts: dashed purple outline + "not saved" tag. Under it, one muted line: "2 parts not saved yet" / "All saved".
- **Action row** (under the draft): this step's new button(s) big and purple with a small "new" tag (never more than 2 purple); earlier buttons in one quiet grey row underneath, in step order. Each button = plain words + small mono git command (e.g. **Save card** `git commit`). Note buttons read as sentences with a dropdown of the other notes: "Merge [cat-robot ▾] into main" `git merge`, "Switch to [superhero ▾]" `git switch` (hidden when there is no other note). Save card asks for nothing.
- **Your lab's cards** `git log` (graph): cards left→right in time order, arrows point to the parent, yellow sticky notes on tips, pink "YOU" pin on your note, blue `wall/main` from Step 4, faded dashed cards "only in the diary" (reflog-only) from Step 6. Short 7-char ID and the message on each card. One muted legend line that grows as steps unlock: "← points to the card before · yellow = sticky note · YOU = where you are · blue = the Wall, last time you checked · dashed = only in the diary".
- **Card details** (click a card, modal): mini monster, ID, author, message, parent ID(s), "Show what Git stored" (the raw `git cat-file -p` text), and from Step 6 **Undo this card** / **Move my note back here**. Undo is disabled on the Start card and on cards outside your note's history.
- **The Wall** (from Step 4): compact second graph of the Wall.
- **Open merge banner** (red, for everyone on that note): "Merging superhero into main. BODY needs a choice. [Open]".
- **Conflict resolver** (modal; anyone on the note can open it): header "Both sides changed these parts since the start. Pick one for each." Mini cards labeled by name — merge: "At start · main · superhero"; Get & combine: "At start · main · the Wall"; undo: "Now · Before <short>". Auto-merged parts show ✓ and the value; conflicted parts get a red outline and buttons in card order: [🤖 robot (main)] [🦸 superhero (superhero)] [Pick another…]. **Finish merge** (disabled until every conflict is chosen) · **Cancel merge** (`git merge --abort`; the note stays as it was). Behind the door shows Git's conflicted `monster.txt` with markers.
- **Chaos step**: only the shared monster, no buttons, no names, no graph. Edits from others appear instantly.

**Toasts** (all of them):
- "Saved card 3fa9c1e." · "Nothing changed — nothing to save."
- "Save your changes first. Git won't overwrite unsaved work." (merge, Get & combine, undo, move back or replace on a note with unsaved parts)
- "Finish or cancel the merge first." (anything that would move a note with an open merge)
- "main already has cat-robot. Nothing to merge." · "Nothing new on the Wall." · "Already undone. Nothing to change."
- "cat-robot already exists. Press Switch to join it."
- "Sent! The Wall moved to 3fa9c1e." · "The Wall already has this card." · "Refused: the Wall has cards you don't have. Press Get & combine first."
- Send with unsaved parts adds: "Sent your last saved card. Unsaved parts weren't sent."
- "Someone in your lab changed this note meanwhile. Press again." · "Busy, press again."
- "main is the approved monster. Make or switch to a sticky note first." (Steps 2–3) · "The boss is cleaning the Wall. Watch." (Step 7) · "Not yet — this unlocks in Step N."

Copy rules: plain words first, Git term second. ≤ 12 words per line. No "SHA", "ref", "HEAD" in body copy except in Behind the door (where it's explained). Friendly, not cute.

## 4. Admin page `/admin?key=KEY` and projector `/screen?key=KEY`

**Admin** (facilitator laptop):
- Header: join URL + QR (big) + participant count + lab count control (2–6, before Step 1).
- **Stepper**: Prev / Next, current step title, timer "Step 3 · 4:10 / 6:00 · 2 min behind plan" (amber at 75% = call "thirty seconds", red at 100%, restart button), the facilitator notes + check question, **Ask** (puts the check on the projector). Next says what it will do. For Steps 4 and 7 a lab select sits next to Next (Step 4: whose main goes to the Wall; Step 7: the boss lab).
- **Labs grid**, one column per lab, top to bottom:
  1. the step goals;
  2. one status line in plain words, red when the lab needs a teacher: "In a conflict for 2:10" (open merge > 2 min), "Refused twice" (in a row), "No clicks for 2:00", "Not on main: Ana, Raj" (Steps 3, 5, 6);
  3. members: online dot (SSE presence), pair, current note, a small "move to Lab N" menu;
  4. current monster + mini graph; last action;
  5. concept chips, only for steps up to the current one: Save · Branch · Fast-forward · Merge · Conflict solved · Push · Refused push · Pull · Revert · Reset · Diary · Force push;
  6. **Rescue** (confirm).
- **Rescue** moves the lab to the current step's expected end with the normal engine, doing only what's missing; author "Teacher", logged in the feed and the diary. It first cancels open merges and drops unsaved parts on the notes it touches. S2: make cat-robot / superhero from main and save each mission. S3: merge cat-robot (fast-forward), merge superhero, finish with BODY = robot. S5: Get & combine, save the lab's change, send (once more if refused). S6: Get & combine, undo the mustache card, send. S7 (boss lab): replace the Wall.
- **The Wall**: graph.
- **Feed**: newest first, plain words + command: "Lab 2 · Priya — Send to Wall → refused (`git push`: non-fast-forward)". Refused, conflict and error lines are red. Click a lab header to filter.
- **Buttons**, in the order used: Sabotage (re-run), Audit, Empty the Wall's bin (`git gc --prune=now`), Reset session (confirm, wipes everything), Open projector.

**Screen** (projector, read-only, live):
- Step 0: big QR, join URL, each lab's member names (so labs balance themselves), each lab's live chaos monster.
- Steps 1–7: title, the one-line instruction (replaced by the check question while Ask is on), countdown, one tile per lab: current monster, goal ticks, red "needs help" dot (= red status line). The Wall graph large from Step 4. Step 7: both audit results large.
- Step 8: the wrap line + per-lab summary.

---

## 5. Server

Node 22 + Express, no database. Exactly one process: state, mutexes and repos all live in it.

Env: `PORT` (default 3000), `ADMIN_KEY` (default: random, generated once and saved in `DATA_DIR` so open admin/projector URLs survive a restart), `DATA_DIR` (default `./data`), `LABS` (default 3).

Disk layout: `DATA_DIR/session.json`, `DATA_DIR/wall.git` (bare), `DATA_DIR/labs/<labId>/` (non-bare repo, never uses a worktree; `core.logAllRefUpdates=always`, `gc.auto=0`; remote named `wall` → `../../wall.git`).

**Session init** (no template repo):
- `git init --bare -b main --object-format=sha1 --ref-format=files wall.git` (`gc.auto=0`). Write Start with hash-object → mktree → commit-tree, author and committer `Monster Lab <lab@monster.lab>`, both dated `2026-10-01T00:00:00Z` (in the past, so dry runs never make a card older than its parent), then `update-ref refs/heads/main <id> ""`.
- `cloneLab(id)`: `git clone --ref-format=files -o wall wall.git labs/<id>`, `git remote set-url wall ../../wall.git` (clone stores an absolute path), set the two configs. Used at init and on entering Step 4.
- Pinning sha1 + files keeps IDs stable and "a sticky note is a tiny file" true under Git 3.0's planned defaults.

**Git runner**: every call goes through `git(repo, args, {input, env})` (`execFile`) with `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, `LC_ALL=C` and explicit `GIT_AUTHOR_*` / `GIT_COMMITTER_*` name, email (`<pid>@monster.lab`) and date. Full refnames everywhere (`refs/heads/B`, `refs/remotes/wall/main`), except merge-tree's two branch arguments, which get the validated short names so markers read `<<<<<<< main` / `>>>>>>> superhero`. Log and reflog fields are separated by `%x00`. Commit IDs from clients must match `^[0-9a-f]{40}$` and pass `cat-file -e <id>^{commit}`. Note names: lowercased, `^[a-z0-9][a-z0-9-]{0,19}$`, not `wall`, must not exist.

**Locks**: one promise-queue mutex per lab repo + one Wall mutex. Everything that touches `wall.git` (push, pull's fetch, the squash push, sabotage, gc, Wall graph/inspect/audit, the Step 4 send + clones) runs under the Wall mutex. Always take the lab lock first, then the Wall lock. Every op reads tips inside its own lock; every `update-ref` is compare-and-swap (`new old`), and a failed swap returns `{moved:true}`. Any other leftover lock error → "Busy, press again."

**Git engine** (`server/git.js`). Every function returns `{ ...result, commands: [{cmd, out, code}], porcelain, explain }`. Reflog messages are written with `update-ref -m` in Git's own wording, so the diary matches a later real `git reflog`.
- `commit(lab, note, author)`: snapshot the note's unsaved parts inside the lock, write tip + parts (hash-object -w → mktree → commit-tree -p tip → `update-ref -m "commit: <msg>"`), then clear only the parts it saved (edits made during the save survive). Message is automatic: "FACE: smiley → cat" (comma-joined). No unsaved parts → `{nothing: true}`.
- `createBranch(lab, name)`: from main, `update-ref -m "branch: Created from main"`.
- `merge(lab, into, from)`: from = a note or `wall/main`. Up to date → `{nothing}`. Fast-forward → `"merge <from>: Fast-forward"`. Otherwise Git does the merge: `git merge-tree --write-tree <into> <from>`. Exit 0 → commit-tree on its tree `-p intoTip -p fromTip`, reflog `"merge <from>: Merge made by the 'ort' strategy."`. Exit 1 → conflict: `conflictedText` = `cat-file -p <tree>:monster.txt` from merge-tree's output tree; open a merge (below). The resolver's per-part view comes from the base (merge-base) / ours / theirs monsters; a test asserts its conflicted parts equal Git's markers.
- **Open merge** (on the lab, not in a browser; persisted): `lab.merging[note] = {kind: 'merge'|'revert', from, intoTip, theirs, base, auto, conflicts, conflictedText, startedBy, t}`. `intoTip` and `theirs` are the exact IDs at merge time (like `MERGE_HEAD`) and are never looked up again.
- `resolve(lab, note, monster, author)`: merge → commit-tree `-p intoTip -p theirs`, reflog `"commit (merge): <msg>"`; revert → `-p intoTip`. Swap from `intoTip`; clears the open merge.
- `abort(lab, note)`: clears the open merge (`git merge --abort`); the note is unchanged.
- `push(lab, {force})`: main only. `git push --porcelain [--force] wall refs/heads/main:refs/heads/main`; read the flag on the ref's stdout line, not stderr: `' '` moved, `'+'` forced, `'='` already there (exit 0, not "Sent!"), `'!'` with `(fetch first)` or `(non-fast-forward)` → `{rejected: true}`; any other `'!'` or non-zero exit → error. Porcelain shown: `git push` (clone set main's upstream).
- `pull(lab, author)`: main only. `git fetch wall` + `merge(lab, 'main', 'wall/main')`; fast-forward reflog `"pull: Fast-forward"`.
- `revert(lab, note, commit, author)`: `git merge-tree --write-tree --merge-base=C <tip> C^1` (a merge card reverts against parent 1: `git revert -m 1 <id>`). Message `Revert "<msg>"` + blank line + `This reverts commit <id>.`, reflog `revert: Revert "<msg>"`. Same tree as tip → `{nothing}`. Conflict → open merge with kind `revert`. Refused for the Start card and cards outside the note's history (`merge-base --is-ancestor`).
- `reset(lab, note, commit)`: `update-ref -m "reset: moving to <short>"`; porcelain `git reset --hard <short>` (the draft follows the note).
- `reflog(lab, note)`: `git reflog show --date=unix --format=%H%x00%gd%x00%gs refs/heads/B`; the time comes from `%gd` (`main@{1791142244}`), not `%ct`. Show `clone: from /abs/path/wall.git` as "clone: from the Wall".
- `squashForcePush(lab, author)`: commit-tree (main's tree, `-p Start`) → update-ref → push --force.
- Switch runs no git. Behind: "In your own copy this is `git switch superhero`: `.git/HEAD` becomes `ref: refs/heads/superhero`. Here each note keeps its own draft; real Git brings unsaved changes along, or refuses."
- `wallSabotage()`: plumbing commit on the Wall's main: FACE → mustache, author `The Intern`, message "Tiny style fix". No-op if FACE is already mustache.
- `gcWall()`: count `git fsck --unreachable --no-reflogs` before and after `git gc --prune=now` → "The Wall's bin had 9 old cards. Now 0." (The bare Wall keeps no reflog, so there is nothing to expire.)
- `graph(repo)`: refs + `git log --all --reflog --topo-order --format=%H%x00%P%x00%an%x00%at%x00%s` (labs) or `--all` (wall) + each commit's monster via `git cat-file --batch`; mark `reachable` (from any ref) vs diary-only. Cached per repo against a refs counter that only git ops bump (draft and chaos clicks never touch git).
- `inspect(repo, commit)`: `git cat-file -p <id>` and `<id>:monster.txt`.
- `audit(part, value)`: in the Wall and in each lab, walk `git rev-list --reverse --topo-order refs/heads/main` (parent links, never timestamps). The first card with part=value whose parents all lack it → author, lab, short ID; else "not found". If that card is the Clean card: "Only the clean card has it. The real author is gone." Results are kept in the session for the projector.

**Step side effects** (`server/session.js`): entering Step 4 (once) sends the chosen lab's main to the Wall, runs `cloneLab` for every lab, moves pins to main and clears drafts and open merges. Entering Step 6 (once) runs `wallSabotage`.

**API** (JSON). Every mutating call returns `{ok, error?, result, op:{porcelain, explain, commands}}` and bumps the lab/session version.
- `POST /api/join {name, labId, pid?}` → `{pid, labId, pair}` · `POST /api/pair {pid}` (toggle A/B, Step 2)
- `GET /api/state?pid=` → `{session:{boot, step, steps[], labs[], timer, ask}, me:{pid, name, labId, pair, branch, mission}, lab:{id, name, color, members[], branches{}, drafts{note:{part:value}}, merging{}, goals[], chaos, graph, lastOp}, wall?:{graph}}`
- `GET /api/events?pid=` (SSE, below) → `{v, boot}`
- `POST /api/chaos {pid, part, value}` (Step 0 only) · `POST /api/draft {pid, part, value}` (my note's draft)
- `POST /api/commit {pid}` · `POST /api/branch {pid, name}` · `POST /api/switch {pid, branch}`
- `POST /api/merge {pid, from}` · `POST /api/resolve {pid, monster}` · `POST /api/abort {pid}`
- `POST /api/push {pid}` · `POST /api/pull {pid}`
- `POST /api/revert {pid, commit}` · `POST /api/reset {pid, commit}` · `GET /api/reflog?pid=`
- `POST /api/squash-force {pid}` (boss lab only) · `GET /api/inspect?pid=&commit=&repo=lab|wall`
- Step gating: the server rejects actions not unlocked yet (`{ok:false, error:"Not yet — this unlocks in Step N."}`).
- Admin (header `x-admin-key` or `?key=`): `GET /api/admin/state` · `POST /api/admin/step {step, labId?}` · `POST /api/admin/labs {count}` · `POST /api/admin/move {pid, labId}` · `POST /api/admin/rescue {labId}` · `POST /api/admin/ask {on}` · `POST /api/admin/timer` (restart) · `POST /api/admin/sabotage` · `POST /api/admin/audit {part, value}` · `POST /api/admin/gc` · `POST /api/admin/reset` · `GET /api/admin/events` (SSE)
- `GET /api/qr.svg?text=` (QR via the `qrcode` npm package)

**SSE**: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `flushHeaders()`, never compressed. On connect write `retry: 2000` and the current `{v, boot}`; a `: hb` comment every 15 s. Lab events go to that lab + admin/screen; session and Wall events go to everyone. Clients refetch `/api/state` when `v` or `boot` differs (a restart resets `v`), keep one fetch in flight and at most one queued, and always refetch after a reconnect. Open SSE connections = presence.

**Persistence**: state in memory; `session.json` written atomically (temp file, fsync, rename), debounced, flushed on SIGTERM/SIGINT. Never persist ref tips; always read them from git. On boot, delete stale `*.lock` files under `DATA_DIR` (a kill mid-update-ref leaves `refs/heads/main.lock`, and every later save fails). Reset session takes every lab mutex + the Wall mutex, wipes, re-inits, and bumps `boot` so old pids go back to Join.

**Concept tracker** per lab (+ per person counts): save, branch, switch, fastforward, merge, conflict, push, rejected, pull, revert, reset, diary, inspect, force. Each belongs to the step that introduces it.

**Feed** entries: `{t, labId, who, action, outcome, porcelain}`.

---

## 6. Look & feel

- Font: Inter (vendor the woff2 from `/usr/share/fonts` or fonts-inter; fallback system-ui). Mono: ui-monospace, "JetBrains Mono", "Noto Sans Mono", monospace.
- Colors: ink #111111 · muted #70707A · purple accent #8B3DFF (also the dashed "not saved" outline) · lavender #F4ECFB · sticky yellow #FFE066 (sticky notes only) · pin pink #FF4D8D · wall blue #0EA5E9 · green #16A34A · red #DC2626 · lines #E4E4E9 · bg #FFFFFF. Lab colors: #8B3DFF, #0EA5E9, #F97316, #16A34A, #E11D48, #CA8A04.
- Big type (base 17–18px; titles 28–40px), round corners 14–18px, soft shadows only on modals/popovers, generous spacing, no clutter, no gradients, no clip-art. Emoji are the only illustrations.
- Motion: subtle (cards slide in, sticky notes glide on move, 150–250 ms). Respect prefers-reduced-motion.
- No external network at runtime (all JS/CSS/fonts served locally). Vanilla JS ES modules, no build step.

## 7. Files (ownership for parallel build)
- `server/git.js`, `server/monster.js`, `test/git.test.js` — git runner, locks, engine + `monster.txt` helpers + unit tests
- `server/index.js`, `server/session.js`, `server/steps.js` — HTTP API, SSE, session/state, step side effects, goals, rescue, admin; `steps.js` = step copy, missions, goals, bonus, `minutes`, `at`
- `public/index.html`, `public/app.js`, `public/app.css`, `public/graph.js`, `public/monster.js` — student app + shared graph/monster renderers (`graph.js`: `renderGraph(svgEl, graph, {labels, you, onCardClick, compact})`; `monster.js`: palette, `palette(step)`, `renderMonsterCard(el, monster, opts)`; no DOM at import, and the server imports the palette from here so there is one source)
- `public/admin.html`, `public/admin.js`, `public/screen.html`, `public/screen.js`, `public/admin.css` — admin + projector (import graph.js/monster.js; never edit them)
- `e2e/` — Playwright simulation + screenshots
- `Dockerfile`, `host.sh` (local + cloudflared quick tunnel), `deploy_cloudrun.sh`, `README.md` (facilitator guide)
- `package.json` scripts: `start`, `test`, `e2e`

Hosting: exactly one process. Default: one Docker host with `DATA_DIR` on a volume. `deploy_cloudrun.sh` must use `--max-instances=1 --min-instances=1 --concurrency=1000 --timeout=3600 --no-cpu-throttling`; Cloud Run's disk is in memory, so an instance restart loses the session.

## 8. Acceptance (the simulation must prove all of this)
3 labs × 3–4 simulated students + admin walk Steps 0→8 in the browser:
1. Step 0: two students edit the same lab's monster; both see each other's change live; no history exists.
2. Step 1: each student saves ≥1 card with an automatic message; the graph shows a chain with authors; "nothing to save" works; the goal ticks.
3. Step 2: main is read-only; Pair A and Pair B create `cat-robot` and `superhero` from main, partners switch, each pair saves its mission; a second "New sticky note cat-robot" gets the "already exists" toast.
4. Step 3: merging cat-robot into main = fast-forward; merging superhero = conflict on BODY only, FACE + LEGS auto; a second student opens the same open merge from the banner and finishes it; the merge card has 2 parents; Git's markers agree with the JS per-part view; Cancel merge leaves main unchanged.
5. Step 4: one lab's main is on the Wall; every lab's newest card has the identical ID; every pin is on main.
6. Step 5: Lab 1 send OK; Lab 2 refused; Lab 2 Get & combine merges with zero conflicts, then send OK; Lab 3 same. 8 simultaneous sends never show a raw error.
7. Step 6: entering it puts 🥸 on the Wall; a lab gets it, undoes the mustache card, sends OK; another lab moves back + sends → refused, and Get & combine brings the mustache card back; the diary shows the reset.
8. Step 7: only the boss lab sees the button; the Wall's history = Start ← Clean; Audit for tentacles on the Wall → "not found" or "Only the clean card has it", but found in the other labs; gc reports the bin going to 0.
9. Step 8: wrap shows summaries; admin concept chips reflect what each lab did.
10. Refresh/rejoin keeps identity; a late joiner mid-session lands in the right state; a server restart mid-session recovers (clients refetch on new `boot`); no console errors; no unhandled server errors.
