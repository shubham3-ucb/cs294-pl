# Outfit Lab — the app (SPEC v3)

"Dress one character together. Every save, merge, send and undo runs real Git."

A small web app for an 80-minute class (1–40 PhD students, in 1–6 labs). Each lab dresses one character.
Every save, merge, send and undo runs **real Git** on the server (Switch, part edits and Cancel merge run none).
Students feel a problem, predict what Git will do, choose a tool to fix it, and see what Git did behind the
door. The teacher only presses **Next**: the class is one fixed script of scenes, and the projector is the slide deck.

**The rule:** an activity is good if completing it teaches the concept AND students can only complete it if they
actually learned it. So the app never does the thinking: Merge and Send are predicted first (Steps 3–5), labs
choose merge or rebase (Step 4) and revert or reset (Step 5) themselves, and a hint gives the idea before the click.

Audience: PhD students. Tone: plain, calm, exact. Plain words first, Git term second. Simplify by saying
less, never by saying something false. Never childish, no confetti.
The bar: a student who has never used Git can follow every step without asking, and a teacher can run
the class by pressing Next.

`server/steps.js` holds every word the class reads (steps, missions, goals, hints, tips, technical cards,
the paper, the scene script). lesson/tuesday.md wins on wording and timing; steps.js follows it.

**Precision.** Every card, Behind the door line, paper statement and teacher note must be technically exact
(Git 2.45+), and every time or ID shown is the class's own, never made up:
- Commit: an object holding the tree ID, parent IDs, author + committer (name, email, timestamp) and the message; its ID is the SHA-1 of a header (`commit <size>\0`) + that content. Blobs and trees are content-addressed the same way. Git stores the name and clock the laptop gives it and checks neither.
- Branch: a ref, a file holding one commit ID. HEAD: a symbolic ref to the current branch. `git branch -d` deletes only a branch already merged into the current one; no commit records the branch it was made on.
- Merge: a 3-way merge against the merge base, per hunk. A fast-forward only moves the ref; no merge commit.
- fetch copies missing objects and updates remote-tracking refs; pull = fetch + merge (by default), `pull --rebase` = fetch + rebase; a push is rejected unless it fast-forwards the remote ref, and `--force` skips that check.
- Rebase: each commit's change is applied to the new base and written as a new commit; the new parent gives a new ID; author and author date are kept, the committer date is new; the originals become unreachable and stay in the reflog.
- revert: a new commit with the inverse change. reset: moves the branch ref (`--hard`: also the working tree). The reflog is local and per ref. gc prunes unreachable objects once their reflog entries expire.
- Squash: new commit(s) with new IDs; the old ones become unreachable.
- Paper claims: only what lesson/tuesday_paper_notes.md supports, phrased as the paper's findings.
- Name the app's simplifications where they matter (the lab shares one repo; a shared draft per sticky note, section 1).

---

## 1. The model (what students see)

Each word has one meaning. "Card" is only a saved version; yellow is only a sticky note.

- **Outfit** = 4 parts, top to bottom: HAT, GLASSES, TOP, SHOES. Each part is one choice from the palette, drawn as a vertical stack of emoji; the same mini stack is on every card.
- **Card** = a saved version of the outfit (a commit). Cards never change.
- **Sticky note** = a branch: a yellow label on one card. It moves when you save.
- **Your pin** = HEAD: which sticky note *you* are on (per student).
- **Shared draft** = the outfit being edited (working copy). One per sticky note, shared live by everyone in the lab on that note, stored as the changed parts on top of the note's card. **Switch** refuses while the note you're on has unsaved parts, as Git would protect them: "Save card first: Git keeps one working copy and won't drop your unsaved parts." The simplification is said once, plainly, under the Step 2 card (`ONE_REPO_LINE`): "In real Git, each of you would have your own clone with one working directory. Here your lab shares one repo."
- **Your lab's cards** = the lab's own repository.
- **The Wall** = the class's shared copy (a bare remote, "like GitHub"). Blue `wall/main` = the Wall, last time you checked.
- **Safety diary** = the reflog: every place a sticky note has been. Cards only in the diary are drawn dashed, under the caption "only in your safety diary (reflog)".

Palette (`public/monster.js`, one source; the server imports it): HAT cap 🧢 tophat 🎩 sunhat 👒 crown 👑
gradcap 🎓 helmet ⛑️ · GLASSES round 👓 shades 🕶️ goggles 🥽 monocle 🧐 (sabotage only: disguise 🥸) · TOP
tshirt 👕 tie 👔 jersey 🎽 coat 🧥 blouse 👚 labcoat 🥼 vest 🦺 · SHOES sneakers 👟 boots 🥾 heels 👠 loafers 👞
sandals 🩴 skates 🛼 ballet 🩰. Start: cap · round · tshirt · sneakers.
Mission parts appear only from their mission's step (Step 2: tophat, tie, jersey, boots; Step 4: crown, skates,
shades, labcoat, gradcap, ballet), so nobody pre-sets them and the Step 3 conflict and Step 6 audit always happen.

`outfit.txt` is the only file in every card. The `---` lines keep parts off adjacent lines, so Git merges each
part on its own:
```
hat: cap
---
glasses: round
---
top: tshirt
---
shoes: sneakers
```

---

## 2. Labs and people (any class size; nobody loses out)

- **Join = name only.** Trimmed, at most 24 characters, at least one letter or digit. Identity is kept in localStorage; the same name rejoins as the same person (while that person is offline).
- **Sizing:** about 4 per lab (two pairs of 2): 1–3 people → 1 lab + the practice lab, 4–8 → 2, 9–12 → 3, 13+ → `ceil(n/4)`, at most 6. So 4 → 2 + 2, 5 → 3 + 2, 7 → 4 + 3. Assignment is balanced; with 2 or more labs no lab starts with 1 person. Labs rebalance on each join until Step 1, then lock; later joiners go to the smallest lab. A lab left with 1 person online gets "You're both pairs today".
- The teacher can set the count (1–6 or Auto) before Step 1 and move a person any time (Details). A forced count that makes a lab bigger than 6, or a lab of 1, is allowed with a warning. `LABS` fixes the count.
- **Pairs** A/B alternate by join order inside a lab. A pair of one gets a solo mission.
- **Practice lab** (when there is one real lab): a grey, labelled ghost lab. Entering Step 4 it saves its change and sends first, so the real lab is refused (and replays on top). It never needs attention.

---

## 3. The scene script (one Next = one scene)

Join → **0 Chaos** → **1 Save** (commit) → **2 Two ideas** (branch) → **3 Combine** (merge) → Break →
**4 Share** (clone, push, pull: merge or rebase) → **5 Undo** (revert, reset, reflog) → **6 Clean up** (squash,
force push, gc) → The paper → Exit question → Wrap. Every step is a **task** scene, then a **reveal** ("How Git
does it"). 19 scenes, 77 planned minutes, 3 minutes of buffer.

| Clock | Min | Scene | What students do |
|---|---|---|---|
| 0:00 | 3 | Join | Type a name; the app picks the lab |
| 0:03 | 1.5 | Step 0 task | Change the shared outfit, no saves |
| 0:04:30 | 2 | Step 0 reveal | One rule that would fix it |
| 0:06:30 | 3 | Step 1 task | Everyone saves one card |
| 0:09:30 | 2.5 | Step 1 reveal | `git commit` card + the trust line |
| 0:12 | 4 | Step 2 task | fancy / sporty notes; Switch keeps unsaved parts |
| 0:16 | 3 | Step 2 reveal | `git branch` card + the one-repo line |
| 0:19 | 8 | Step 3 task | Predict, merge fancy (fast-forward), delete it; predict, merge sporty (TOP conflict) |
| 0:27 | 4 | Step 3 reveal | `git merge` card + the class's prediction accuracy |
| 0:31 | 4 | Break | Labs may finish Step 3 |
| 0:35 | 9 | Step 4 task | Predict each send; a refused lab chooses merge or rebase (and why) |
| 0:44 | 5 | Step 4 reveal | push/pull + rebase cards, paths, accuracy, each lab's choice |
| 0:49 | 7 | Step 5 task | Each lab chooses Undo this card or Move my note back; predict each send |
| 0:56 | 3 | Step 5 reveal | revert/reset card, accuracy, each lab's choice (and what nobody chose) |
| 0:59 | 4 | Step 6 task | The boss lab squashes + force-pushes; others find who added 🥾 |
| 1:03 | 4 | Step 6 reveal | squash card, the audit after, the bin count |
| 1:07 | 5 | The paper | Pairs: what squash-merge gains, what an auditor loses |
| 1:12 | 3 | Exit question | The password question, on your own |
| 1:15 | 2 | Wrap | My Git in 7 lines |
| 1:17 | 3 | Buffer | |

Each scene has: id, kind (`join | task | reveal | break | paper | exit | wrap`), the step whose buttons are on,
title, minutes (and `at`), **say**, **do**, **ask** `{q, a}`, reveal `{cards, sentence, behind, note}`,
**board**, **tools**, and **next** (what pressing Next into it does). Students and the projector move together;
nothing private reaches the projector.

- **Join:** big QR + link + each lab's member names.
- **Task:** step title, one line, timer; from Step 4 the live Wall; one tile per lab (outfit, goal ticks). Step 6: the audit, large.
- **Reveal:** one technical card per tool (section 5), as big as the slide allows, and the pause question. Step 0 has no tool yet: one sentence and Behind the door. Step 1 adds the trust line, Step 2 the one-repo line. Steps 3–5 add the class's prediction accuracy ("Predicted right: 7 of 10 · merge fancy 3/5 · merge sporty 4/5"; sends split into refused / accepted); Steps 4–5 add what each lab chose ("Chose: Lab 2 Combine (merge) ("why") · Lab 3 Replay on top (rebase)") and, for a way no lab chose, one line on what it would have done (`NOT_CHOSEN`, `UNDO_NOT_CHOSEN`). Step 4 shows the Wall with one change's integration path marked, every lab's times beside it, the facts under the times. Step 6 shows the audit after the clean-up and the bin count. Students see the same cards and lines in the app, with an answer box and a "My takeaway" box (Steps 0–6).
- **Break:** a 4-minute countdown. Labs can still finish Step 3.
- **Paper:** Good / Bad / Ugly (Bad: "Squash can drop the cards — and, once the branch is deleted, even who made them.", §5.4) · this class's code velocity (the Step 4 paths, as they were when Step 4 ended; after the squash the Wall has none of those cards) · what they lived: Step 3, after the fast-forward the fancy note was deleted and no card says which cards were made on it; Step 4, "Replay on top made a copy with a new ID; the original card is not on the Wall." (when no lab replayed: what replaying does); Step 6, the squash dropped the cards and who made them, and the 🥾 audit failed · the message as the paper's claim for analysts, **"For analysts, flat history is data loss."**, with the trade-off next to it: "Flat history helps developers find and revert a bad change (bisect, revert). It loses where a change came from and who made it." (§3.1). The Say: "Microsoft tracks code velocity: how long a change takes to reach main, along its integration path." (the paper defines it, §6.1, and reports no velocity numbers). The pairs question: "Your team squash-merges every feature branch and deletes it. What do you gain, and what can an auditor no longer answer?"
- **Exit:** the exit question, answered in the app. Hope to hear: "No. Revert adds a card; the old one still holds the password, in every copy. Change the password first. Then rewrite, force push and gc the Wall, and have every lab re-clone. (On GitHub, force-pushed commits can stay fetchable by ID.)" A lab that kept the old history merges it back on its next Get & combine (git.test.js checks it).
- **Wrap:** "Cards never change. Sticky notes move. The Wall copies cards." **My Git in 7 lines** (one takeaway per reveal, Steps 0–6, editable, Copy). The projector shows a takeaway wall (a sample, names hidden). **Export** (Markdown, per question and per person).

**What Next does by itself** (once; Back never undoes it):
- Into Step 1: labs lock. Into Steps 2–3: main's unsaved parts are dropped (main is read-only there).
- Into Step 4: the chosen lab's main goes to the Wall (default: the first lab with all Step 3 goals ticked; pickable in the Next panel), every lab is re-cloned from it (a fresh `git clone`: other labs' Steps 1–3 cards are not in it, and the step says so in one line, `STEPS[4].fresh`), pins move to main. Then the practice lab plays its turn.
- Into Step 5: the Step 4 integration paths are kept for the paper; the Intern's 🥸 card goes to the Wall, unless the teacher pressed **Sabotage** on the Step 4 reveal; then every real lab whose main is behind the Wall (nothing unsaved, no open merge) gets it by a fast-forward, logged as the Teacher's Get & combine. Every lab holds 🥸 at the same moment.
- Into Step 6: the boss lab is set (default: the first lab with someone online; pickable) and the Wall is audited ("Who first added the 🥾 boots?").
- Into the Step 6 reveal: the boss lab's clean-up is finished if needed (Rescue), then the Wall is audited again.

Keyboard, from the console or the projector window: → / Space / PageDown = Next, ← / PageUp = Back. A press
whose `from` is not the current scene changes nothing, so a clicker's double tap never skips a scene.

---

## 4. The steps (one Git tool at a time)

Each step adds its own button(s); earlier ones stay. From Step 3 on, where the lab presses something: "One
person presses, everyone watches. Swap each step." For each step steps.js holds: title, instruction, the
projector line, mission, unlocks, **tips** (one bubble per new button, ≤ 10 words), **goals** (live ticks;
offline members don't count), **hint** `{idea, click}` (the idea first: what to look at, which concept; then the
next concrete click for this person), bonus, behind the door.

| # | Title | Git | Mission / what happens |
|---|---|---|---|
| 0 | Everyone, one outfit | (none) | One shared outfit per lab, live, no save, no names. |
| 1 | Save every version | git commit, git log | Everyone saves one card. |
| 2 | Try two ideas at once | git switch -c, git switch | Pair A: sticky note **fancy**, HAT → 🎩, TOP → 👔. Pair B: **sporty**, TOP → 🎽, SHOES → 🥾. main is read-only. |
| 3 | Make one outfit from both | git merge, git branch -d | On main: predict, merge fancy (a fast-forward), then **Delete sticky note** fancy (allowed only once main has its card), then predict, merge sporty: HAT and SHOES combine, **TOP conflicts** (👔 vs 🎽), a person picks. |
| 4 | Put your outfit on the Wall | git clone, git push, git pull --no-rebase, git pull --rebase | "The Wall is the class's shared copy, like GitHub. Your lab already has a full copy of it (that is git clone). It starts as Lab N's outfit, so your lab's cards are now a copy of it." Lab 1 HAT → 👑 · Lab 2 SHOES → 🛼 · Lab 3 GLASSES → 🕶️ · Lab 4 TOP → 🥼 · Lab 5 HAT → 🎓 · Lab 6 SHOES → 🩰. Every send is predicted. The first lab to send just sends. A refused lab **chooses** its way: **Combine (merge)** (Get & combine: a merge card) or **Replay on top (rebase)**, both offered with one plain line each (`WAYS`), plus "Why this way? (optional)". The way is the lab's first Get & combine / Replay on top that had to combine two lines (not a fast-forward); kept once chosen. Then send again. |
| 5 | Oops: undo a shared mistake | git revert, git reset --hard, git reflog main | "The Intern" pushed GLASSES → 🥸, "Tiny style fix"; every lab has it. Each lab **chooses**: Undo this card (then send; refused? Get & combine: two equal fix cards merge cleanly; send), or Move my note back (send → refused, for real; Get & combine brings 🥸 back; then Undo). Every send is predicted. Goals: the lab undid it itself (Undo, or Move back), and no 🥸 on the Wall or in the lab. |
| 6 | The boss wants it clean | squash, git push --force, git gc --prune=now | Only the boss lab sees **Replace the Wall with one card** (red, confirm). Others press nothing, watch, then find who first added the 🥾. |

**Predict before you act (Steps 3–5).** A *moment* is one lab action the class predicts: Step 3's merges of fancy
and sporty (`3:<lab>:merge:<note>`), and each send in Steps 4–5 (`<step>:<lab>:push:<n>`). Merge and Send open a
one-tap dialog for the student who pressed ("What will Git do?" Fast-forward · Merge, no conflict · Conflict on HAT /
GLASSES / TOP / SHOES; "Will the Wall accept it?" Yes · No, the Wall has cards we don't); the guess travels with the
action, and the server refuses an unpredicted Merge/Send with `{predict: id}` ("Predict first."). Everyone else in the
lab may predict the lab's next moment in the panel's **Predict** box (optional, changeable until Git answers). Git's
answer closes the moment and scores every guess; each predictor's panel (and the resolver, for a merge) shows one line:
"You predicted: conflict on TOP. Git: conflict on TOP. ✓" or "You predicted: accepted. Git: refused (fetch first). Why:
the Wall has cards your main doesn't, so the send is not a fast-forward." A merge after Cancel, or a send that changes
nothing, asks nothing. Rescue closes moments too. Accuracy (real labs only) is live on the console, on the Step 3–5
reveals, and in Export.

**Hints.** "Stuck? Hint" appears `HINT_DELAY` (45 s) after the step starts for a student (or the student joined), and
again 45 s after the lab's latest refusal or conflict (a bad feed entry): think first. The first press shows the idea,
the second ("Show the exact click") the click; only then do the named buttons get a ring and the "your mission" tag. A
new situation goes back to its idea. Rescue stays for the teacher. Bots read the click.

**Replay on top, for real:** for each of main's cards not on wall/main (merge cards and changes already there
are left out), Git applies its change on top of wall/main and writes a new card with the same author, author
date and message; the committer is whoever pressed, now. main moves to the last copy; the originals become
unreachable and show dashed. Card details say "Author Priya at 10:21 · committed at 10:24" whenever the two
differ (with seconds inside one minute), and link a copy and its original ("Replay of", "Replayed as").

**Integration path** (Step 4 reveal, the paper): for each lab's change on the Wall's main, the run of cards from
the change's card up to the card the lab's own send made main, when it was made (its author date) and when that send put it on the Wall
(the "update by push" line in that lab's `wall/main` reflog): "made 10:21 → on the Wall 10:24 · 3 min". A replayed
change: "Its original card is not on the Wall. The path starts at a copy."

Step 6 audit: before the clean-up the Wall names the author of the first 🥾 card (from sporty); after the squash
+ force push the Wall says "not found" while labs that kept the old cards still know. Other labs' sends are
paused in Step 6 ("The boss is cleaning the Wall. Watch."), so nobody pushes the old history back.

---

## 5. The technical cards (reveals, the app, the slides)

The command, big, then three rows. The text lives in `CARDS` (steps.js); simplify only by cutting words.

| Command | What it is | What it does | How Git does it |
|---|---|---|---|
| `git commit` | a saved snapshot of the whole project. | records the exact state, who saved it, when, and the commit before it. | each file is stored as a blob, the folder as a tree. A commit object = tree ID + parent ID(s) + author + committer + message. Its ID is the SHA-1 of that object, so any change gives a new ID. Nothing is edited in place. |
| `git branch` | a movable label on one commit. | lets you try an idea without touching main. | a branch is a tiny file (`.git/refs/heads/<name>`) holding one commit ID. Committing moves it forward. HEAD records which branch you are on. Creating a branch copies nothing. |
| `git merge` | combining two lines of work. | keeps a change made on one side. It stops for a person when both sides changed the same or neighbouring lines. | Git finds the merge base (the last common commit) and compares each side with it (a 3-way merge), then writes a merge commit with two parents. If your branch has nothing new (the other side already contains it), Git fast-forwards: only the label moves, and no merge commit is made. |
| `git push / git pull` | sharing commits with a copy elsewhere (the Wall). | push sends your new commits and moves the remote branch. pull brings theirs in. | copies exchange only the objects the other side lacks; IDs come from content, so copies agree without coordination. A push is accepted only if it is a fast-forward of the remote branch. Otherwise fetch first, then merge or rebase. |
| `git rebase` | replaying your commits on top of another branch. | gives a straight history with no merge commit. | for each of your commits, Git applies its change to the new base and writes a new commit. The new parent gives it a new ID. Author and author date are kept. The originals become unreachable and stay in your reflog for a while. |
| `git revert / git reset` | two kinds of undo. | revert adds a commit that undoes an old one, and is safe on shared history. reset moves your branch label back, and is only safe if nobody else has those commits. | revert applies the opposite of the commit's change and commits it on top, so history only grows. reset rewrites the branch file. The commits left behind are still listed in the reflog (a local log of where each label pointed) until they expire and gc removes them. |
| Squash + `git push --force` | cleaning up history. | squash turns several commits into one. Force push makes the Wall accept it anyway. | squash writes one new commit whose tree is the final state. The originals, with their authors and times, become unreachable. `--force` skips the fast-forward check and moves the remote branch. `git gc` later deletes unreachable objects. |

Reveals: Step 1 commit (+ "Git stores the name and clock your laptop gives it. It checks neither.") · Step 2
branch (+ the one-repo line) · Step 3 merge · Step 4 push/pull and rebase · Step 5 revert/reset · Step 6 squash.

---

## 6. Student page `/`

Desktop first (1280×800+), usable at 390px. Lots of white space. Nothing can dead-end: every refusal says
exactly what to press next. The join card ends with a quiet link: "Thursday's class? Open /thu".

- **Top bar:** "Outfit Lab · Lab 2 · Priya · Step 3 · Make one outfit from both" (lab color dot), a grey dot while reconnecting, a small **?** that replays the tour.
- **Tour** (first join): spotlight + bubble with Next / Skip (the outfit, a **change ›** control, Save card, the cards row; before Step 1 only the first two). **Tips:** one bubble on each new button, gone on the next click. Never blocks the class. Respects prefers-reduced-motion.
- **Step panel:** step title · fixed line · instruction · (Step 4) the fresh-copy line · **Your mission** · my last prediction against Git's answer · **Predict** (the lab's next merge or send; optional) · goals (live ticks) · **Stuck? Hint** (after the delay; idea, then click) · when all goals tick: "Done ✓. Wait for the class." + bonus · **Behind the door · what Git did** (the rule, the commands this lab just ran, "Show the low-level steps Git ran" with the exact plumbing and output). At a reveal the panel holds the question and takeaway; the technical cards are on the stage.
- **Shared draft:** "You're on: [note]"; four rows (emoji, part, name, **change ›** → palette). Unsaved parts: dashed purple outline + "not saved".
- **Action row:** this step's new buttons big and purple with a "new" tag; earlier ones quiet grey, in step order. Each = plain words + small mono command. Note buttons read as sentences with a dropdown: "Merge [fancy ▾] into main", "Delete sticky note [fancy ▾]". Once the student opened the hint's exact click, the button it names joins the purple row, tagged "your mission". Merge (Step 3) and Send to Wall (Steps 4–5) open the **prediction dialog** first. In Step 4, **Get & combine** `git pull --no-rebase` and **Replay on top** `git pull --rebase` sit side by side as one choice ("Get the Wall's cards: choose a way."), each with its plain line; the lab's choice is marked "your lab's choice", with "Why this way? (optional)" under it (one line, Enter saves, anyone in the lab can edit). Delete sticky note offers only notes whose card the current note already has.
- **Your lab's cards** `git log`: left→right, arrows to the parent, yellow notes, pink YOU pin, blue `wall/main` from Step 4, dashed diary-only cards from Step 4. Short ID + author + message. Long histories fold into "← N older cards" (never a card with a note, or on the marked path).
- **Card details:** mini outfit, ID, message, author (and committer time when it differs), parents, replay links, where (on the Wall / only in your safety diary (reflog)), "Show what Git stored" (`git cat-file -p`, each header line explained), and from Step 5 **Undo this card** / **Move my note back here**.
- **The Wall** (from Step 4): second graph. At the Step 4 reveal it marks the lab's own integration path in bold ink (purple is Lab 1's colour) and labels the merge card ("merge · 2 parents") and the copy ("copy · new ID"); the list of paths lets a student mark another.
- **Open merge banner** → **Conflict resolver** (merge, undo or replay): mini cards for each side, conflicted parts with "Keep main's 👔 shirt & tie" · "Keep sporty's 🎽 jersey" · "Pick another…", **Finish** · **Cancel** (`git merge --abort`, `git revert --abort`, `git rebase --abort`), and Git's conflicted `outfit.txt` with markers behind the door.
- **Toasts:** one line each, naming the next move. No "SHA", "ref" or "HEAD" in body copy outside Behind the door and the technical cards.

## 7. Teacher console `/admin?key=KEY` and projector `/screen?key=KEY`

Both pages read `?key=` once, keep it in sessionStorage and drop it from the address bar (`history.replaceState`), so
a reload works and the key is not on screen; the projector window the console opens gets the key the same way.
Without any key the page says to open the Teacher link. The pages hold no secret; every `/api/admin` call checks the key.

**Console** (a presenter view on the teacher's laptop):
- **Top:** people count, **Join QR** (also on the projector while open), **Start presenting** (opens /screen in a named window; F = full screen).
- **Main card:** "Scene N of 19 · plan 0:42", title, timer ("0:12 / 5:00 · 2 min behind"). **Say** · **Do** · **Ask** (**Show on projector**, the answer folded) · live answers ("4/9 answered", **Show answers on projector**, names only **with names**) · takeaway count · **Board** · **Predict** (Steps 3–5, live: "Predicted right: 7 of 10 · merge fancy 3/5 · merge sporty 4/5", and during a task "· 3 waiting for Git") · **Paths** (Step 4 reveal and the paper: each lab's times, "starts at a copy") · only this scene's tools (Sabotage on the Step 4 reveal and Step 5 task; Audit in Step 6; **Empty the Wall's bin** on the Step 6 reveal; Export at the wrap) · "Labs done: 2/3 · Lab 3: Merging: TOP to pick" · a big **Next: <scene>** and a small **Back**.
- **Presenter column:** "On the projector now" (a live preview, the same renderer) and "Next" (title, line, what Next will do, the lab picker for Step 4 / Step 6).
- **Lab tiles:** name, people, mini outfit, goal checks, status ("Working", "Done", "Merging: TOP to pick", red for "Refused twice in a row", "In a conflict for 2:10", "No clicks for 2:00"; practice lab: "Plays by itself"), the lab's choice ("Chose: Replay on top (rebase) · "why"" in Step 4; "Chose: Move my note back (reset)" in Step 5), counts at the wrap, **Rescue** (confirm).
- **Details** (collapsed): lab count, Export, Reset (confirm), **Rehearse with bots** (2–12 bots, real time / 5× / 20×), rosters with move-to-lab, the Wall graph, each lab's graph, the feed.

**Rescue** moves one lab to the step's expected end with the normal engine, doing only what's missing, as
"Teacher", logged in the feed; it first cancels open merges and drops unsaved parts on the notes it touches.
S2: make fancy / sporty and save each mission. S3: also merge fancy, delete its note, merge sporty (TOP = fancy's).
S4: get the Wall's cards the lab's way (Get & combine if it had not chosen; logged as its choice), save the lab's change, send (again if refused). S5: Get & combine, undo
the 🥸 card (logged even when another lab's fix already undid it), send. S6 (boss lab): replace the Wall.

**Rehearse with bots** (`server/bots.js`): bots join by name ("(bot)"), are placed like people, and follow the click
of their own Stuck? Hint through the same student actions, with human-like pauses; they answer and write takeaways
from sample text. They predict: in the panel for the lab's next action, and with every Merge and Send they press;
one bot in three guesses naively (no conflict; the Wall accepts), so the reveals show a mix. Where a hint offers two
ways, they choose a mix: Step 4 by the order the Wall refused their labs (first combines, next replays; a lone
refusable lab replays), Step 5 by lab number (even labs and a lone lab move back). Stop rehearsal, Reset or a restart
removes them, with their predictions; a choice or press they made stays, without their name.

**Projector** (read-only, live, nothing private): the current scene as a slide readable from the back of the
room, the question while Ask is on, answers while shown, the takeaway wall at the wrap. The static deck
(slides/tuesday_app.pptx) is a record, regenerated from the same scene text.

---

## 8. Server

Node 22 + Express 5, no database. Exactly one process: state, mutexes and repos all live in it.
Env: `PORT` (3000), `ADMIN_KEY` (default: random, saved once in `DATA_DIR/admin.key`), `DATA_DIR` (`./data`),
`LABS` (fixed count), `HINT_DELAY` (seconds before "Stuck? Hint", default 45; the browser tests use 1). Disk: `session.json`, `wall.git` (bare), `labs/<id>/` (no worktree is used;
`core.logAllRefUpdates=always`, `gc.auto=0`; remote `wall` → `../../wall.git`).

**Init:** `git init --bare -b main --object-format=sha1 --ref-format=files wall.git`; Start written with
hash-object → mktree → commit-tree (`Outfit Lab`, dated `2026-10-01T00:00:00Z`) → update-ref. Labs:
`git clone --no-checkout --ref-format=files -o wall`. Pinning sha1 + files keeps "a branch is a tiny file" true
under Git 3.0 defaults.

**Git runner:** `execFile` with `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, `LC_ALL=C`,
`GIT_CEILING_DIRECTORIES=DATA_DIR`, explicit `GIT_AUTHOR_*` / `GIT_COMMITTER_*` (name, `<pid>@outfit.lab`, date).
Full refnames everywhere, except merge-tree's branch arguments (validated short names, so markers read
`<<<<<<< main` / `>>>>>>> sporty`). Client commit IDs must match `^[0-9a-f]{40}$` and be commits in that repo.
Note names: `^[a-z0-9][a-z0-9-]{0,19}$`, not `wall`.

**Locks:** one promise queue per lab + one for the Wall; lab first, then Wall. Tips are read inside the lock;
every `update-ref` is compare-and-swap, and a lost swap says "Someone in your lab changed this note meanwhile.
Press again." Next / Back / lab count / joins / Reset run alone.

**Engine** (`server/git.js`). Every op returns `{...result, commands: [{cmd, out, code}], porcelain, explain}`;
reflog messages use Git's own wording, so the diary matches a real `git reflog`.
- `commit` (the note's unsaved parts → a card; message "HAT: cap → tophat"), `createBranch` (from main), `deleteBranch` (`git branch -d`: refused unless the note's card is in the current note's history; never the note you are on).
- `merge`: up to date → nothing; fast-forward → only the ref moves; else `git merge-tree --write-tree`: clean → a commit with two parents; conflict → an **open merge** `merging[note] = {kind: 'merge'|'revert'|'rebase', …, conflicts, conflictedText}` (persisted, shared by the lab) that `resolve` finishes and `abort` drops.
- `push` (`git push --porcelain [--force]`, refused unless a fast-forward), `pull` (fetch + merge `wall/main`; the diary line is `merge wall/main: …`, as `git merge wall/main` writes), `rebase` (`git pull --rebase`: fetch; behind → fast-forward; else replay `rev-list --cherry-pick --right-only --no-merges` onto `wall/main`, each change by `merge-tree --merge-base=<parent>`, committed with the kept author; a conflict opens a replay that `resolve` continues).
- `revert` (`merge-tree --merge-base=C <tip> C^1`, message `Revert "…"`), `reset` (`update-ref -m "reset: moving to <short>"`), `reflog`.
- `squashForcePush` (main's tree, parent Start, "Clean history", push --force), `wallSabotage` (the Intern's card), `gcWall` (`fsck --unreachable --no-reflogs` before and after `gc --prune=now`), `audit` (walk parent links on each main, never timestamps), `graph` (refs + reflog-reachable cards, each with author, author time, committer, committer time, outfit, reachable), `pushes` (a lab's sends, from its `wall/main` reflog), `inspect` (`cat-file -p`).

**API** (JSON; mutations return `{ok, error?, result, op}` and bump the version):
- `POST /api/join {name, pid?}` · `GET /api/state?pid=` · `GET /api/events?pid=` (SSE)
- `POST /api/{pair, chaos, draft, commit, branch, switch, merge, resolve, abort, push, pull, rebase, revert, reset, answer, takeaway, predict, why}` · `POST /api/delete-note` · `POST /api/squash-force` · `GET /api/reflog` · `GET /api/inspect`. Actions not unlocked yet: "Not yet — this unlocks in Step N." `merge` and `push` take `guess` (Steps 3–5; refused with `{predict: id}` until the presser has one); `predict {moment, guess}` is a lab-mate's guess; `why {text}` is Step 4's one line. The state carries `now`, `me.hint {idea, click}`, `me.hintAt`, `me.verdict`, `lab.moments` (open moments with their options and my guess), `lab.way`/`why`/`undo`, `session.scene.facts` (the Step 3–5 reveal lines); the admin state adds `session.predictions` and each lab's choice.
- `GET /admin` and `GET /screen` serve the page without a key (it holds no secret; the API checks the key).
- Admin (`x-admin-key` or `?key=`): `GET /api/admin/state` (with `projector`, the public view) · `POST /api/admin/{next, back, labs, move, rescue, ask, answers, timer, sabotage, audit, gc, reset, rehearse}` · `GET /api/admin/export` · `GET /api/admin/events` (SSE) · `GET /api/qr.svg?text=`

**Live updates (tunnel-proof):** SSE with `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`;
`retry: 2000`, then a ~2 KB comment line that pushes the stream through buffering proxies, then `{v, boot}`, and
`: hb` every 15 s. Every page (student, console, projector) loads its state at once, never waiting for SSE, and
polls every 2 s whenever no SSE message arrived for 4 s; SSE stays the fast path. One fetch in flight + one
queued. Open streams = presence.

**Persistence:** state in memory; `session.json` written atomically, debounced, flushed on SIGTERM/SIGINT; another
format starts fresh. Ref tips are never stored. On boot, stale `*.lock` files are removed and a half-cloned lab
is cloned again. Reset takes every lock, wipes, re-inits and bumps `boot`, so old pages go back to Join.

## 9. Look & feel

- Inter (vendored); mono ui-monospace / JetBrains Mono / Noto Sans Mono. Emoji are the only illustrations.
- Ink #111111 · muted #70707A · purple #8B3DFF (also "not saved") · lavender #F4ECFB · sticky yellow #FFE066 (notes only) · pin pink #FF4D8D · wall blue #0EA5E9 · green #16A34A · red #DC2626 · lines #E4E4E9. Labs: #8B3DFF, #0EA5E9, #F97316, #16A34A, #E11D48, #CA8A04; practice lab #9CA3AF.
- Big type, round corners, soft shadows only on modals and bubbles, no gradients. Motion 150–250 ms; respects prefers-reduced-motion. No external network at runtime. Vanilla JS modules, no build step.

## 10. Hosting

Exactly one process. `host.sh` (this laptop + a Cloudflare quick tunnel; prints the Students, Teacher and
Projector links; downloads cloudflared itself; the link changes on restart), Docker (`DATA_DIR` on a volume), or
`deploy_cloudrun.sh PROJECT REGION` (one always-on instance; Cloud Run's disk is in memory, so a restart loses
the session).

## 11. Acceptance (`npm test` + `npm run e2e`)

- A 9-student class (3 labs × 3) walks all 19 scenes in a real browser in the 7-step order, joining by name only; the teacher uses only Next (and Back once).
- Step 0: shared live edits, no history. Step 1: everyone saves. Step 2: main read-only; fancy and sporty; "already exists"; Switch with unsaved parts is refused. Step 3: lab-mates predict in the panel, the presser in the dialog; fancy = fast-forward; deleting sporty is refused, deleting fancy works and its card stays in main; sporty = conflict on TOP only, HAT + SHOES automatic; markers = resolver; a second student finishes; Cancel leaves main unchanged, and merging again asks nothing. Each predictor sees Git's answer against the guess; the console and the reveal count right of total.
- Step 4: every lab is a fresh copy of the Wall, and says so. Every send is predicted. Lab 1 sends; Lab 2 (by hints) is refused and chooses to combine (a merge card with two parents); Lab 3 predicts the refusal, is refused, chooses Replay on top and says why: a new ID, the same author and author date, a later committer date, the original dashed and only in the diary. The app marks no way before a choice. The reveal shows the accuracy and each lab's choice; it and the paper show each path with the class's real times, from Git.
- The technical cards show word for word in the app, on the projector and in its preview at every reveal; Step 1 shows the trust line.
- Step 5: 🥸 on the Wall and in every lab at once; each lab chooses; Undo + send works; Move back + send is refused and Get & combine brings 🥸 back; the diary shows the reset; 8 predicted sends at once: exactly one goes in; a restart with a stale lock recovers. The reveal shows each lab's choice (and, if no lab moved back, what would have happened).
- Step 6: only the boss lab sees Replace; squash + force push leaves Start ← Clean; the 🥾 audit names the author before and is "not found" on the Wall after, but found in the other labs; gc empties the bin.
- Answers and takeaways save and show; My Git in 7 lines (edit, reload, Copy) and Export work.
- A 2-student class (1 lab + the practice lab): the practice lab sends first, the real lab is refused and replays on top. With SSE blocked, a student page and the projector still reach the next scene within 5 s.
- Lab sizes for 1, 2, 4, 5, 7, 10, 12 and 13 people; a late joiner goes to the smallest lab; one big lab only when forced, with a warning.
- The rehearsal: 9 bots play every scene, predicting (a mix of right and wrong) and choosing (both ways in Step 4, both undos in Step 5); the teacher presses only Next.
- Hints: every hint has an idea and a click; the button waits `HINT_DELAY` after the step starts and after a refusal. The console and projector drop `?key=` from the address bar and still reload.
- Refresh/rejoin keeps identity; a late joiner lands correctly; no console errors; no user-facing text says monster/face/body/legs/tentacles/mustache.

**Demo** (made after the app): a real run driven by Playwright through every scene. `demo/DEMO.mp4` (H.264,
≤ 25 MB): console, projector and students with a plain caption bar naming what happens and the Git tool.
`demo/DEMO_STORYBOARD.pdf`: every caption with its frame. `docs/demo.gif` (≤ 20 s) heads the root README.

## Thursday: The Humans (`/thu`)

The same server, a separate session (`DATA_DIR/thursday.json`), no Git. User Study Day for Yang et al., TOSEM 2022,
in the order of the course's User Studies lecture: the research question, the data, the analysis, do we believe it,
a design insight. One message: "Asking is not using."
Every word is in `server/thursday_scenes.js`; the projector, the student page and `slides/build/build_thursday.py`
all read it. Paper numbers are the paper's; every other number comes from `analysis/thursday_numbers.py` on the
authors' published data, and the 8 posts are its seeded sample (`server/thursday_posts.json`, CC BY-SA).
Students: the paper's survey word for word, two votes, 8 post labels, one group answer per group (claims, design),
one exit line. Groups of about 4 form on the first group scene from who is here; returning or late students join the
smallest group. Pages poll every 1.5–2 s (no stream), so they work through any proxy. Students never receive teacher
notes or answer keys before the reveal. Done when `npm test` and `npm run e2e:thursday` (also with `THU_STUDENTS=24`) pass.
