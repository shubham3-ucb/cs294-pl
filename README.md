# CS294 · Git Week

Teaching materials for Git week in UC Berkeley CS294 *Modern Programming Tools* (Shubham & Ananya).
**Tuesday: Outfit Lab**, a web app where each lab dresses one character and every button runs real Git; the teacher presses only Next. **Thursday: The Humans**, a Stack Overflow study of Git put on trial.

## What's covered

Tuesday, 80 minutes, 7 steps. Each step: the class hits a problem, fixes it with one Git tool, then sees how Git does it on one technical card per tool. The paper is Just et al., *Switching to Git: the Good, the Bad, and the Ugly*, ISSRE 2016. Its message: **flat history is data loss.**

| Step | What happens | Git tools | Paper |
|---|---|---|---|
| 0 Chaos | Everyone edits one shared outfit, live. Nothing is saved. | none yet | |
| 1 Save | Everyone saves a card. Git stores the name and clock your laptop gives it, and checks neither. | `git commit`, `git log`, `git cat-file -p` | §2.1 objects and IDs · §5.6–5.7 clocks and names |
| 2 Two ideas | Pairs build fancy and sporty, each on its own sticky note. | `git switch -c`, `git switch` | §2.1 refs |
| 3 Combine | fancy fast-forwards and its note is deleted. sporty conflicts on TOP; a person picks. | `git merge`, `git branch -d` | §5.1 fast-forward · §3.1 merge commits |
| 4 Share | The Wall is the class's shared copy. The first send wins; refused labs merge or rebase. Each change's path to main, with this class's times. | `git clone`, `git push`, `git pull --no-rebase`, `git pull --rebase` | §5.2 rebase · §6 integration paths, code velocity |
| 5 Undo | The Intern's 🥸 card reaches every lab. A fix card (revert) sends like any card. Moving the note back (reset), then sending, is refused. | `git revert`, `git reset --hard`, `git reflog` | §5.5 revert |
| 6 Clean up | The boss squashes and force-pushes. "Who first added the 🥾 boots?" now fails on the Wall. | squash, `git push --force`, `git gc` | §5.4 squash · §8 loss that cannot be recovered |

## Run it

```bash
cd app
npm install
npm start      # http://localhost:3000; the terminal prints the teacher link
```

Needs Node 22+ and Git 2.45+. Teacher guide: [`app/README.md`](app/README.md). The class on one page: [`lesson/ONE_PAGE.md`](lesson/ONE_PAGE.md).

## Host it for class

`cd app && ./host.sh` starts the app and a Cloudflare quick tunnel (no account, no firewall change; it downloads `cloudflared` itself). It prints three links: **Students**, **Teacher** (with the key) and **Projector**. The link works while the machine runs and changes on restart.

- A stable link: `./deploy_cloudrun.sh PROJECT REGION` (Cloud Run, one instance).
- Docker: `docker build -t outfit-lab . && docker run -p 3000:3000 -v outfit-lab-data:/data outfit-lab`.

## Try it alone

On the teacher page, open **Details → Rehearse with bots**. Pick 2–12 bots and a speed (real time, 5× or 20×). The bots join like students and play every step through the student buttons, following their own hints. You press only Next. To see the student side, open the student link in another window and join.

## Demo

![Outfit Lab demo](docs/demo.gif)

The full class run, 4:50: [`demo/DEMO.mp4`](demo/DEMO.mp4). The teacher console, the projector and two students, with a caption naming each Git tool. Every caption with its frame: [`demo/DEMO_STORYBOARD.pdf`](demo/DEMO_STORYBOARD.pdf).

| Student | Teacher console | Projector |
|---|---|---|
| ![Student page](docs/student.png) | ![Teacher console](docs/console.png) | ![Projector: a technical card](docs/projector.png) |

## Files

| | |
|---|---|
| [`lesson/ONE_PAGE.md`](lesson/ONE_PAGE.md) | Both days, one page each: time, scene, the one question |
| [`lesson/tuesday.md`](lesson/tuesday.md) | Tuesday script: Say, Do and Ask for every scene |
| [`lesson/thursday.md`](lesson/thursday.md) | Thursday script: Claim Court and the design sprint |
| [`lesson/tuesday_paper_notes.md`](lesson/tuesday_paper_notes.md) | The Tuesday paper from the full text, by section |
| [`app/`](app/) | Outfit Lab: students `/`, teacher `/admin`, projector `/screen`; spec in [`app/SPEC.md`](app/SPEC.md) |
| [`slides/tuesday_app.pptx`](slides/tuesday_app.pptx) | Tuesday's technical cards as a deck, built from the app's text (+ preview PDF) |
| [`slides/thursday_simple.pptx`](slides/thursday_simple.pptx) | Thursday's deck (+ preview PDF) |
| [`slides/build/`](slides/build/) | The deck builders |
| [`story/STORY.pdf`](story/STORY.pdf) | Tuesday in 15 pages of real screenshots (built by `story/build_story.py`) |
| [`demo/`](demo/) | The demo video and storyboard; `record_demo.mjs` records both again from a real run |
| [`papers/README.md`](papers/README.md) | Links to the two papers (PDFs not included) |
| [`docs/`](docs/) | Images for this page |
