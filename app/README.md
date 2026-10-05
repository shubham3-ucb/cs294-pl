# Monster Lab

A web app for Tuesday's Git class. Each lab builds one emoji monster together, one Git idea per step, and every button runs real Git on the server.
The teacher page moves the class from step to step and shows what each lab did. The projector page shows the Wall.

Lesson script: [tuesday.md](../lesson/tuesday.md) · one page: [ONE_PAGE.md](../lesson/ONE_PAGE.md) · slides: [tuesday_app.pptx](../slides/tuesday_app.pptx) · what the app must do: [SPEC.md](SPEC.md)

## Run it

Needs Node 22+ and Git 2.45+.

**On your computer, to try it:**

```
npm install && npm start
```

Open http://localhost:3000/. The terminal prints the teacher link.

**For class, pick one:**

- `./host.sh` runs the app on your laptop and opens a temporary public link (a Cloudflare quick tunnel, no account needed; it downloads `cloudflared` into `bin/` the first time). It prints three links: Students, Teacher, Projector. Keep the window open and the laptop awake. Ctrl-C stops it. Run it again and the session is still there; the link changes, the key does not.
- `./deploy_cloudrun.sh PROJECT REGION` puts it on Cloud Run as one always-on instance and prints the same three links. A redeploy or restart starts a fresh session, with a new key unless you pass `ADMIN_KEY=...`. It costs money while it runs, so delete it after class (the script prints the command).
- Docker: `docker build -t monster-lab .`, then `docker run -d -p 3000:3000 -v monster-lab-data:/data monster-lab`. The teacher link is in `docker logs`.

**The teacher key** is made on first start and saved in `data/admin.key` (`DATA_DIR/admin.key`). Set your own with `ADMIN_KEY=...`. On Cloud Run it is the key the script printed.
Teacher page: `/admin?key=KEY`. Projector: `/screen?key=KEY`.
The join QR uses the address you opened the teacher page with. So open the Teacher link that `host.sh` prints, not localhost.

Settings: `PORT` (3000), `DATA_DIR` (`./data`, where the whole session lives), `ADMIN_KEY`, `LABS` (3).
Tests: `npm test` (the Git engine) · `npm run e2e` (a whole class in a browser; first run `npx playwright install --only-shell chromium`) · `npm run stress`.

## Before class

- Start the app with `./host.sh`. Plug in the laptop and turn sleep off. Open the **Teacher** link on S's laptop.
- Press **Open projector** and put that page (`/screen`) on the projector. Keep the slides open behind it.
- Labs = 3 (the **Labs** menu on the teacher page; it locks at Step 1).
- Test the join from one phone. Then press **Reset session**. That removes the test name, and the class clock starts at the first real join.
- Write "Git in 7 lines" on the board, with room for seven lines. Put one index card and a pen at each seat.

## Class runbook

Every step runs the same way: name the **problem** → **ask** for the idea, before Next → wait for a student to say it → **Start Step N** → students do it → **pause**: ask, then wait 10 seconds → say **how Git does it** → write the board line.
Steps 5 and 6 flip the order: students hit the problem first, and the idea comes out of the pause. Never say a Git name before a student says the idea.
From Step 3 on, one student per lab presses. Swap who presses each step.

The teacher page shows the current step's notes, pause question, hope to hear, idea, and how Git does it. Next to **Start Step N** it shows the question to ask first.
At a pause, **Ask on the projector** puts the question up. Pressing Next takes it down.
Below is the short version. The full wording is in [tuesday.md](../lesson/tuesday.md).

### Opening + Step 0 · Everyone, one monster — 0:00 · 3 + 4 min · Slides 1–2

- **Click:** nothing. Step 0 is already on. The projector shows the QR and who is in each lab.
- **Say:** "No Git lecture today. You'll hit seven problems. Your lab invents a fix for each one. Then we show how Git does the same thing. Every button runs real Git."
- **Students:** scan the QR, type a name, pick Lab 1, 2 or 3.
- **Watch:** Labs can only change before Step 1. Wait until the count matches the room.
- **Say:** "Your lab shares one monster. Change any part, any time. Go." After 90 seconds: "Hands off."
- **Check:** "What did your monster look like a minute ago? Who changed the legs?" Then: "What rule would fix this?" (Idea: save every version, with a name on it.)
- **Then:** learning objectives, 1 min (0:07).

### Step 1 · Save every version — 0:08 · 7 min · Slide 3

- **Ask first:** "What should each saved version hold?" (Idea: the whole monster, who saved it, and the version it came from.)
- **Click:** Start Step 1. Say: "From now on, every save makes a card."
- **Students:** change one part (a dashed purple outline means "not saved"), then **Save card**. Take turns until everyone has saved once. Then click any card, press **Show what Git stored**, and find the parent, the author and the message.
- **Watch:** the goal "Everyone saved a card (n/n)". A lab done early? "Open Behind the door. Press **Show the low-level steps Git ran**. One save is four commands."
- **Check:** "Which card came 3 saves ago, and who made it?" Then: "Why do arrows point back, never forward?"
- **Board:** "1. Card (commit): a full snapshot + its parent. Never changes."

### Step 2 · Try two ideas at once — 0:15 · 7 min · Slide 4

- **Ask first:** "The client wants two ideas tried at once. Half your lab tries one idea. Half tries the other. Same draft. What goes wrong?" Then: "How does each half find its own newest card?" (Idea: each idea puts its own sticky note on its newest card.)
- **Click:** Start Step 2. Unsaved parts on main are dropped. Say: "Your lab already has one sticky note: main. It marks the monster you have now."
- **Students:** Pair A: one partner presses **New sticky note** `cat-robot`, the other presses **Switch to** `cat-robot`. FACE → 🐱, BODY → 🤖, **Save card**. Pair B does the same with `superhero`: BODY → 🦸, LEGS → 🐙. Then **Switch to** `main` and back. Look, don't edit.
- **Watch:** both missions change BODY on purpose. That sets up Step 3, so don't tell them. Before a pair edits, the "You're on:" chip should show their own note. Out of time? **Rescue** the unfinished labs.
- **Check:** "Where is the original monster now? Did anything get copied?"
- **Board:** "2. Sticky note (branch): a label on one card. Saving moves it."

### Step 3 · Make one monster from both — 0:22 · 10 min, then break · Slide 5

- **Ask first:** "The client wants one monster with both ideas. Look at FACE on the two newest cards. They differ. Which side changed it?" (Idea: compare each part with the card where you split.)
- **Click:** Start Step 3.
- **Students** (one driver per lab): **Switch to** `main`. **Merge [cat-robot] into main**: main's note slides forward, and no new card appears. **Merge [superhero] into main**: FACE ✓ and LEGS ✓ are done, BODY is red. Agree on one body, pick it, then **Finish merge**.
- **Watch:** the chips **Fast-forward**, **Merge** and **Conflict solved** in every lab. A lab says "take the newest"? Ask: "Whose work did you throw away?"
- **Check:** "Why did the first merge only move the note?" Then: "Why did FACE and LEGS combine alone, but BODY needed you?"
- **Board:** "3. Merge: compare both sides with the card they share."
- **Break (0:32, 4 min):** press **Break · 4 min** and the projector counts down. Write the real return time on the board. Stay on Step 3. A finishes the merge with any lab missing **Merge** or **Conflict solved** (or press **Rescue**).

### Step 4 · Meet the Wall — 0:36 · 6 min · Slide 6

- **Ask first:** "The client wants one monster from the whole class. Each lab's cards live only in that lab. How do three labs share, without one lab holding the only copy?" (Idea: one shared copy, and each lab keeps a full copy.)
- **Click:** leave **Send to the Wall:** on its default, the first lab done with Step 3. **Start Step 4**, then confirm. That lab's main goes on the Wall, and every lab's cards are replaced by a copy of the Wall. Prev does not undo this.
- **Say:** "This is the Wall, like GitHub. Lab N's monster is on it. Every lab's cards were replaced by a full copy of the Wall. Your counts are kept for the wrap."
- **Students:** click the newest card in your lab's cards, then the newest card on the Wall. Read its ID out to the next lab.
- **Watch:** all three labs read out the same ID.
- **Check:** "Two labs never made that card. Why does their copy have the same ID?" Follow-up: "Change one emoji on an old card. What happens to its ID? And to every card after it?" Then: "Remember this for Step 7."
- **Board:** "4. The Wall (remote): a full copy. Same card, same ID everywhere."

### Step 5 · Put your monster on the Wall — 0:42 · 9 min · Slide 7

- **Click:** Start Step 5. Don't ask first: students hit the problem themselves. Say: "Put your monster on the Wall. The first lab there wins."
- **Students:** make your lab's change (Lab 1: FACE → 🐲, Lab 2: LEGS → 🛼, Lab 3: BODY → 🌵). **Save card**, then **Send to Wall**. Refused? **Get & combine**, then **Send to Wall** again.
- **Watch:** the first lab gets in and the other two are refused. Their combine has no red. "Refused twice in a row" on the teacher page means they skipped **Get & combine**. Done when the Wall shows 🐲 🌵 🛼.
- **Check:** "Why did the Wall refuse your card instead of adding it?" Follow-up: "Git combined three labs with no red. Is the monster right?"
- **Board:** "5. Send (push) only moves the Wall forward. Behind? Get & combine (pull) first."

### Step 6 · Oops: undo a shared mistake — 0:51 · 9 min · Slide 8

- **Click, still on Step 5:** **Sabotage 🥸**. Say: "The intern pushed a 'tiny style fix' to the Wall. Everyone: Get & combine."
- **Ask first:** "How do you get rid of it?" Sort the answers into "go back to before it" and "save a new card that removes it". Say: "We'll try both."
- **Click:** Start Step 6.
- **Students:** Lab 2: open the card right before 🥸, press **Move my note back here**, then **Send to Wall**. Labs 1 and 3: open the 🥸 card, press **Undo this card**, then **Send to Wall**.
- **Watch:** Lab 2 is refused. That is the lesson. At Lab 2, A asks: "Suppose nobody else had the 🥸 card. How would you find it again?" Then Lab 2 opens **Safety diary** and presses **Get & combine**. If 🥸 is back with no fix card after it, they press **Undo this card** on it and send. Of Labs 1 and 3, the second to send is refused. Its combine has no red. Done when the Wall shows 🐲 🌵 🛼 again.
- **Check:** "Why is adding a fix card safe, but moving back is not?" Follow-up: "When is moving the note back fine?"
- **Board:** "6. Shared mistake: add a fix card (revert). Move back (reset) only if nobody has the card."

### Step 7 · The boss wants it clean — 1:00 · 8 min · Slide 9

- **Click, still on Step 6:** **Audit: who added 🐙?** Say: "Who gave our monster tentacles? The Wall knows." Read the name aloud.
- **Ask first** (as the boss): "This history is a mess. I want one clean card." Then: "Cards never change. How do you give me one clean card?" Then: "Will the Wall accept it?" (Idea: one new card right after Start. Force the Wall onto it.)
- **Click:** leave **Boss lab:** on Lab 1. **Start Step 7**.
- **Students:** Lab 1 presses **Get & combine**, then **Replace the Wall with one card**, and confirms. Labs 2 and 3 press nothing (their sends are paused) and watch the Wall. Then they find the first 🐙 card in their lab's cards and write down its author.
- **Watch:** the Wall shows two cards, Start ← Clean history. Lab 1's old cards turn dashed.
- **Click:** **Audit** again. The Wall says "not found", and Labs 2 and 3 still show the name. Say: "No note leads to the old cards now. The Wall still stores them, in a bin." Press **Empty the Wall's bin** and read the count aloud.
- **Check:** "Who added the tentacles? Where does that answer still exist?" Follow-up: "Was the boss wrong to want a clean history?"
- **Board:** "7. Rewrite (squash, rebase): new cards. Force push + gc: the old ones are gone."
- **Then, still on Step 7:** the paper (1:08, 4 min, Slide 10; the projector shows "flat history is data loss"), then the exit question (1:12, 3 min, laptops closed, answers on index cards). A collects the cards at the door.

### Step 8 · What you built — 1:15 · 2 min · Slide 11

- **Click:** Start Step 8. The projector shows the wrap line and each lab's counts.
- **Say:** read one lab's counts aloud and point at the seven board lines. "Cards never change. Sticky notes move. The Wall copies cards. That's Git." Then the homework: "Read Yang et al., Sections 3.2 to 3.5. For one finding, write down what they measured."
- **Then:** 3 min of buffer (1:17).

**Running late?** Cut in the order listed under Buffer in [tuesday.md](../lesson/tuesday.md). Never cut the Step 3 conflict, the refused sends in Steps 5 and 6, either Audit, or the exit question.

## If something goes wrong

- **A student's page looks stuck.** Reload it. Their name and lab come back. A grey lab dot in the top bar means the page is reconnecting by itself.
- **Someone is in the wrong lab.** On the teacher page, find their name and use **Move** to put them in the right lab.
- **A lab is stuck.** Its status line on the teacher page turns red. "In a conflict for 2:10": open the red banner, pick a body, press **Finish merge** (or **Cancel merge**). "Refused twice in a row": press **Get & combine** first. "Not on main": press **Switch to main first**. Still stuck? **Rescue** finishes the step for that lab with real Git (Steps 2, 3, 5 and 6; in Step 7, only the boss lab). On the sticky notes it touches, it drops open merges and unsaved parts.
- **You pressed Next too early.** Prev goes back, but two things stay done: Step 4's Wall and copies, and the Sabotage card. To start completely over, press **Reset session**. It wipes everything and everyone joins again.
- **The app or the link stopped.** Run `./host.sh` again. The session and key are kept, but the link changes. Open the new Teacher link (it has the new QR). Students open the new link and join again with the same name and lab.

## Files

```
server/index.js       HTTP API, live updates (SSE), pages
server/session.js     the class session: step changes, goals, Rescue, teacher buttons
server/steps.js       every step's words: instruction, missions, goals, questions, teacher notes, timings
server/git.js         the real Git behind every button
server/monster.js     monster.txt, the one file in every card
public/               student app (index.html, app.js), teacher page (admin.*), projector (screen.*),
                      shared graph.js and monster.js
test/                 npm test
e2e/                  npm run e2e (screenshots in e2e/shots/), npm run stress
host.sh               class on your laptop, with a temporary public link
deploy_cloudrun.sh    class on Cloud Run
Dockerfile            one container; the session lives in /data
SPEC.md               what the app must do
data/                 the session: session.json, wall.git, labs/<id>/, admin.key (made on first start)
```

Next to `app/`: `lesson/tuesday.md` (the script), `lesson/ONE_PAGE.md` (the script on one page), `slides/tuesday_app.pptx` (11 slides: title, join, Steps 1–7, the paper, wrap).
