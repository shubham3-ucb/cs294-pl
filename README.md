# CS294 · Git Week

Teaching materials for Git week in UC Berkeley CS294 *Modern Programming Tools*. Taught by Shubham & Ananya.

- **Tuesday 10/13: Monster Lab.** Labs build one monster together in a web app where every button runs real Git. Each step starts with a problem, then the class meets the Git tool that fixes it.
- **Thursday 10/15: The Humans.** Put a Stack Overflow study of Git on trial, then turn one finding into a tool design.

## Run the app

```bash
cd app
npm install
npm start          # http://localhost:3000, prints the teacher link with its key
```

Needs Node 22+ and Git 2.38+. For class, `./host.sh` gives a public link (see `app/README.md`).

## What's here

| Folder | What |
|---|---|
| `app/` | The Monster Lab web app: student page, teacher page `/admin`, projector page `/screen` |
| `lesson/` | Teacher scripts. Start with `ONE_PAGE.md`. Also `tuesday.md`, `thursday.md`, `STYLE.md` |
| `slides/` | Minimal decks (`.pptx`; upload to Drive and choose *Open with Google Slides*) |
| `story/STORY.pdf` | The Tuesday class in 11 pages, with real screenshots |
| `papers/` | The two papers (links only) |

## How Tuesday flows

Chaos, then **commit**, then **branch**, then **merge** (one real conflict), then the shared Wall (**clone**), then **push/pull** (one lab gets refused), then **revert vs reset**, then **squash + force push** (the audit fails: the paper's point), then wrap-up.

*Cards never change. Sticky notes move. The Wall copies cards. That's Git.*
