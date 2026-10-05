# CS294 · Git Week

Teaching materials for Git week in UC Berkeley CS294 *Modern Programming Tools*. Taught by Shubham & Ananya.

- **Tuesday 10/13: Monster Lab.** Labs build one monster together in a web app where every button runs real Git. Each step starts with a problem, then the class meets the Git tool that fixes it.
- **Thursday 10/15: The Humans.** Put a Stack Overflow study of Git on trial, then turn one finding into a tool design.

## Run the app

```bash
cd app
npm install
npm start          # http://localhost:3000, prints the teacher link
```

Needs Node 22+ and Git 2.45+. For class, run `./host.sh` (public link). Full teacher guide: [`app/README.md`](app/README.md).

## What's here

| | |
|---|---|
| [`lesson/ONE_PAGE.md`](lesson/ONE_PAGE.md) | **Start here.** Both days on one page each: time, step, the one question to ask |
| [`lesson/tuesday.md`](lesson/tuesday.md) · [`thursday.md`](lesson/thursday.md) | Full teacher scripts: problem → idea → how Git does it, pauses, break |
| [`app/`](app/) | The Monster Lab app: students `/`, teacher `/admin`, projector `/screen` |
| [`slides/tuesday_app.pptx`](slides/tuesday_app.pptx) · [`thursday_simple.pptx`](slides/thursday_simple.pptx) | Minimal decks. Upload to Drive, then *Open with Google Slides* |
| [`story/STORY.pdf`](story/STORY.pdf) | The Tuesday class in 11 pages, with real screenshots |
| [`papers/`](papers/) | The two papers (links) + our notes on the Tuesday paper |

## Tuesday in one line per step

0 Chaos · 1 **commit** · 2 **branch** · 3 **merge** (one real conflict) · 4 the Wall (**clone**) · 5 **push/pull** (a lab gets refused) · 6 **revert** vs reset · 7 **squash + force push** (the audit fails) · 8 wrap-up

The paper's one message: **flat history is data loss.**
*Cards never change. Sticky notes move. The Wall copies cards. That's Git.*
