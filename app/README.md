# Outfit Lab · teacher guide

Each lab dresses one character together (HAT, GLASSES, TOP, SHOES). Every button runs real Git on the server.
You press **Next**. The class walks one fixed script of 19 scenes, and the projector is the slide deck.

Lesson script: [tuesday.md](../lesson/tuesday.md) · one page: [ONE_PAGE.md](../lesson/ONE_PAGE.md) · what the app does: [SPEC.md](SPEC.md)

## Run it

Needs Node 22+ and Git 2.45+.

```
npm install && npm start
```

Open http://localhost:3000/. The terminal prints the teacher link (`/admin?key=KEY`).

- **For class:** `./host.sh` runs the app behind a temporary public link (a Cloudflare quick tunnel; it downloads `cloudflared` itself). It prints three links: **Students**, **Teacher** and **Projector**. The link works while the laptop runs, and changes on restart.
- **A stable link:** `./deploy_cloudrun.sh PROJECT REGION` (Cloud Run, one instance; the script prints how to delete it after class).
- **Docker:** `docker build -t outfit-lab .`, then `docker run -d -p 3000:3000 -v outfit-lab-data:/data outfit-lab`. The teacher link is in `docker logs`.
- **Settings:** `PORT` (3000) · `DATA_DIR` (`./data`, the whole session) · `ADMIN_KEY` (else made on first start, saved in `DATA_DIR/admin.key`) · `LABS` (a fixed lab count for a new session, 1–6).

## Before class

1. The day before, rehearse once with bots (below).
2. Plug in the laptop. Turn sleep off. Run `./host.sh`.
3. Open the **Teacher** link it prints. The join QR uses that address, so do not use localhost.
4. Press **Start presenting**. Drag the new window onto the projector. Press **F** for full screen.
5. Join from a phone and check the name shows up. Then **Details → Reset session**. The class clock starts at the next join.
6. Leave the Join scene up. **Join QR** shows the QR on the console and in the projector window.

## Presenter mode

- **Next and Back:** the buttons, → or Space or PageDown, ← or PageUp, from either window. A clicker works. A double tap never skips a scene.
- **The console** shows the scene's **Say**, **Do** and **Ask** (with **Show on projector**; the answer is folded), the board line, the timer, and "Labs done: 2/3". On the right: what the projector shows now, and the next scene.
- **One tile per lab:** its people, goals, outfit and status. Step 4 adds its way: Combine (merge) or Replay on top (rebase).
- **Answers:** at each reveal, the paper and the exit question, students answer in the app. The console counts them live. **Show answers on projector** hides names unless you tick **with names**. Nothing private reaches the projector.

## In class: press Next, and only Next

Join → **0 Chaos** → **1 Save** (commit) → **2 Two ideas** (branch) → **3 Combine** (merge) → Break → **4 Share** (clone, push, pull: merge or rebase) → **5 Undo** (revert, reset, reflog) → **6 Clean up** (squash, force push, gc) → the paper → the exit question → the wrap. 77 minutes, plus 3 of buffer.

Each step is a task scene, then **How Git does it**: one technical card per tool (**What it is · What it does · How Git does it**), the same in the app and on the projector. Students work through each task in the app: their mission, goals that tick live, and **Stuck? Hint**, which names the next click.

Some Next presses also act:

| Next into | The app does | You do |
|---|---|---|
| Join | Labs fill as people type a name, about 4 per lab. | Wait until the count matches the room. |
| Step 1 | Labs lock. | |
| Step 4 | The first lab, in lab order, that finished Step 3 goes to the Wall (else Lab 1). Every lab becomes a copy of it. With a practice lab, it sends its card first. | To send another lab, pick it in the Next panel first. Back does not undo this. |
| Step 5 | The Intern's 🥸 card goes to the Wall. Every lab that is behind the Wall gets it at once: a fast-forward. A lab with unsent or unsaved work gets it with Get & combine. | Or press **Sabotage** earlier, on the Step 4 reveal. |
| Step 6 | The Wall is asked who first added the 🥾 boots. Only the boss lab gets **Replace the Wall with one card**. | Read the name aloud. The boss is the first lab with someone online; pick another in the Next panel. |
| Step 6 reveal | It finishes the boss lab's clean-up if needed, then asks the Wall again. | Press **Empty the Wall's bin**. Read the count aloud. |

What happens in the steps:

- **Step 3.** After the fast-forward of fancy, each lab deletes the fancy note (`git branch -d`). The reveal asks which cards were made on fancy. No card records it.
- **Step 4.** The first lab to send gets in. Refused labs get their way in the app, in the order the Wall refuses them: Combine (merge), then Replay on top (rebase), alternating. When only one lab can be refused, it replays. A replayed card keeps its author and author time. It gets a new parent, so a new snapshot, a new committer time and a new ID. The original shows dashed: "only in your safety diary (reflog)". The reveal marks one change's path to main, with this class's own times ("made 10:21 → on the Wall 10:24 · 3 min").
- **Step 5.** Labs 2, 4 and 6 try **Move my note back** first, and the Wall refuses their send. A class of one lab tries both, back first.
- **The paper** shows Step 4's paths as they were. After the squash, the Wall has none of those cards.
- **The wrap.** Each student sees **My Git in 7 lines**: one takeaway per step, 0–6, editable, with Copy. The projector shows the takeaway wall without names. **Export answers** (under Details) downloads every answer and takeaway as Markdown.

**Labs.** About 4 per lab (two pairs of 2): 1–3 people make 1 lab plus a practice lab, 4–8 make 2, 9–12 make 3, 13 or more make 4 to 6. With 2 or more labs, no lab starts with 1 person. Labs stay even until Step 1, then lock. A late joiner goes to the smallest lab. A student with nobody else online in the lab sees "You're both pairs today". Under **Details** you can set the count before Step 1 (it warns about a lab of 1 or a lab over 6) and move a person.

## Rehearse with bots

**Details → Rehearse with bots.** Pick 2–12 bots and a speed (real time, 5× or 20× faster), then press **Start rehearsal**. Bots join like students; their names end in "(bot)". They follow their own Stuck? Hint through the student buttons: saves, sticky notes, deleting fancy, the TOP conflict, the refused send and their lab's way back, Undo, the boss's clean-up, answers and takeaways. You press Next.

To see the student side, open the student link in another window and join. Your lab then waits for you too. **Stop rehearsal**, **Reset session** or a restart removes the bots.

## If something goes wrong

- **A page looks stuck.** Reload it; the name and lab come back. A grey dot means it is reconnecting by itself. When live updates go quiet, each page asks the server every 2 seconds.
- **A lab is stuck.** Its status line turns red: "In a conflict for 2:10" or "No clicks for 2:00" (after 2 minutes), or "Refused twice in a row". First point the students at **Stuck? Hint**. Then press **Rescue** on the tile: it finishes the step for that lab with real Git (Steps 2–5, and the boss lab in Step 6). It drops open merges and unsaved parts on the notes it touches.
- **You pressed Next too early.** Press **Back**. Done things stay done: the Wall and the copies, the practice lab's card, the 🥸 card, the clean-up.
- **Start over.** **Details → Reset session** wipes the session. Everyone joins again.
- **The app or the link stopped.** Run `./host.sh` again. The session and key are kept; the link changes. Open the new Teacher link (it has the new QR). Students open the new link and type the same name.

## Thursday: The Humans

The same server runs Thursday at `/thu`: students `/thu`, teacher `/thu/admin?key=KEY`, projector `/thu/screen?key=KEY` (`./host.sh` prints all three). Same key, same presenter mode: **Start presenting**, then only **Next**. Lesson script: [thursday.md](../lesson/thursday.md).

19 scenes, 78 minutes plus 2 of buffer, in the order of Sarah's User Studies lecture: the research question, the data, the analysis, do we believe it, a design insight.

- **Take the paper's survey.** The authors' published form, Q2–Q7 word for word. The reveal puts the class beside the paper's 92 respondents.
- **Two votes.** What kind of study (need-finding, formative, evaluative), and what Stack Overflow posts are (observation, traces, self-report). The reveal shows the class's votes and the answer.
- **Check the rule on 8 real posts.** Each post shows the command the paper counted it for, the question and the accepted answer. Students answer: is it really about that command? The 8 are a seeded random sample from the paper's data ([`analysis/thursday_numbers.py`](../analysis/thursday_numbers.py), which also computes every number the paper does not print).
- **Groups of about 4** form when you press Next after the break (never a group of 1 when 2 or more are here). Each group puts one of the paper's claims on trial, then designs one change to Git with a study that would show it works. One shared answer per group; anyone in it can type. A late joiner goes to the smallest group.
- **Exit:** one line each. The last slide shows them without names. **Details → Export answers** downloads everything as Markdown. **Reset** empties Thursday only.

Thursday has no Git and no bots. To try it alone, open `/thu` in two or three private windows.

## Tests

- `npm test`: the Git engine and the session, including whole classes played by hints alone.
- `npm run e2e`: a real browser. 9 students join by name; then 2 students with the practice lab, with live updates blocked at the end; then lab sizes for 1 to 13 people; then the rehearsal. First run `npx playwright install --only-shell chromium`. Screenshots go to `e2e/shots/`. `E2E_PORT` moves its servers off 3102 and 3104.
- `npm run rehearsal`: only the rehearsal. 9 bots; the teacher presses only Next until every scene completes.
- `npm run e2e:thursday`: Thursday in a real browser: a console, the projector and 6 students through all 19 scenes, checking that no slide overflows. `THU_STUDENTS=24` runs a bigger class.

## Files

```
server/index.js       HTTP API, live updates (SSE), pages
server/session.js     the session: labs, scenes, goals, hints, answers, integration paths, Rescue, the practice lab
server/steps.js       every word the class reads: steps, missions, hints, technical cards, the paper, the scene script
server/git.js         the real Git behind every button
server/bots.js        Rehearse with bots
server/monster.js     outfit.txt, the one file in every card
server/thursday*.js   Thursday: the session, every word of its 19 scenes, and the 8 posts (thursday_posts.json)
public/               student app (index.html, app.js), console (admin.*), projector (screen.*), graph.js, monster.js;
                      Thursday: thu.* (students), thu-admin.*, thu-screen.*, thu-common.js (the shared slide renderer)
test/  e2e/           npm test · npm run e2e
host.sh               class on your laptop, with a temporary public link
deploy_cloudrun.sh    class on Cloud Run
Dockerfile            one container; the session lives in /data
```
