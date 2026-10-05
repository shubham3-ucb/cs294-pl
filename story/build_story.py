#!/usr/bin/env python3
"""Build STORY.pdf: the Tuesday class in 15 pages, real app screenshots + a few plain lines each.
usage: python3 build_story.py [screenshots_dir]   (default: ../app/e2e/shots, made by `npm run e2e`)
"""
import io, os, re, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import img2pdf

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'app', 'e2e', 'shots')
F = '/usr/share/fonts/opentype/inter/Inter-{}.otf'
MONO = '/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf'
font = lambda w, s: ImageFont.truetype(F.format(w), s)
mono = lambda s: ImageFont.truetype(MONO, s)
INK, MUTED, PURPLE, LAV = (17, 17, 17), (112, 112, 122), (139, 61, 255), (244, 236, 251)
W, H = 1920, 1080
TEXT_W = 520  # the caption column

# (kicker, title, screenshot, [(label, text)]). A `code span` never breaks and draws in mono.
# Captions follow app/server/steps.js; no times or IDs, since a new e2e run changes them.
PAGES = [
    ('Join', "Type a name. That's it.", '00-join-tour-student.png',
     [('LABS', 'The app picks each lab: about 4 people, two pairs. With 1 to 3 people, a practice lab plays along.'),
      ('TOUR', 'A short tour points at the outfit and the change button. The ? replays it.')]),
    ('Step 0 · Chaos', 'Everyone, one outfit', '01-task-0-lab1.png',
     [('PROBLEM', 'Everyone edits one outfit at once. "Who changed the shoes?" Nobody knows.'),
      ('IDEA', 'Save every version, with a name on it.'),
      ('GIT', 'None yet. This is life without it.')]),
    ('Step 1 · Save', 'Save every version', '03-task-1-lab1.png',
     [('PROBLEM', "Step 0's outfit is gone. Nobody can get it back."),
      ('IDEA', 'Every save is a new card: the whole outfit, the card before, your name. Cards never change.'),
      ('GIT', '`git commit`. The ID is a hash of the whole card, so any change gives a new ID. Following the arrows back is `git log`.')]),
    ('How Git does it', 'One technical card per tool', '04-reveal-1-projector.png',
     [('ON SCREEN', 'The command, then three rows: what it is, what it does, how Git does it. The question sits on top.'),
      ('IN THE APP', 'Students see the same card. They answer the question and write a one-line takeaway.'),
      ('STEP 1', 'One more line: Git stores the name and clock your laptop gives it. It checks neither.')]),
    ('Step 2 · Two ideas', 'Try two ideas at once', '05-task-2-lab1.png',
     [('PROBLEM', 'Two ideas, one draft: the pairs overwrite each other.'),
      ('IDEA', 'Each pair gets its own sticky note, fancy or sporty. Saving moves only the note you are on.'),
      ('GIT', "`git switch -c fancy`. A branch is a tiny file holding one card's ID. HEAD, your pin, records which note you are on.")]),
    ('Step 3 · Combine', 'Make one outfit from both', '07-task-3-resolver-lab1.png',
     [('PROBLEM', 'The client wants both ideas.'),
      ('IDEA', 'Compare each side with the card where they split. Changed on one side only: keep it.'),
      ('GIT', "`git merge`. fancy fast-forwards: only main's note moves. `git branch -d` deletes fancy. In sporty, TOP changed on both sides: a person picks."),
      ('ASK', 'Which cards were made on fancy? No way to tell. Git does not record the branch a commit was made on.')]),
    ('Step 4 · Share', 'Put your outfit on the Wall', '10-task-4-replay-lab3.png',
     [('PROBLEM', "The Wall: the class's shared copy, like GitHub. Another lab sent first. Yours was refused."),
      ('IDEA', "Get the Wall's cards first: combine, or replay yours on top."),
      ('GIT', '`git pull` = fetch + merge. `git pull --rebase` replays each card on top. Kept: change, author, author time. New: parent, committer time, ID.'),
      ('ON SCREEN', 'The dashed original is only in the safety diary (reflog).')]),
    ('Step 4 · How Git does it', 'Merge and rebase, side by side', '11-reveal-4-projector.png',
     [('ON THE WALL', 'A merge card with two parents. Next to it, a straight line: a copy with a new ID.'),
      ('PATH', "One change's path to main, in bold, with this class's times: made, then on the Wall. The gap is the paper's code velocity."),
      ('ASK', 'Same change, author and author time: why a new ID? Its parent is new, so its snapshot is too. Its committer time is new. The ID is a hash of all of it.')]),
    ('Step 5 · Undo', 'Oops: undo a shared mistake', '12-task-5-diary-lab2.png',
     [('PROBLEM', 'The Intern\'s "Tiny style fix" put a disguise on the Wall. Every lab has it too.'),
      ('IDEA', "Don't rip out a shared card. Add a card that undoes it."),
      ('GIT', '`git revert` adds a fix card, so history only grows. `git reset` moves your note back: the Wall refuses the send, and the next pull brings the card back. `git reflog` lists where main has been.')]),
    ('Step 6 · Clean up', 'The boss wants it clean', '15-reveal-6-projector.png',
     [('PROBLEM', '"I want one clean card." Before the clean-up, the Wall knows who first added the boots.'),
      ('IDEA', "One new card after Start, with today's outfit, replaces the history."),
      ('GIT', 'Squash writes one new card. `git push --force` moves the Wall onto it. `git gc --prune=now` deletes the cards no note leads to.'),
      ('AFTER', 'Asked again, the Wall has no answer. Labs that kept the old cards still know.')]),
    ('The paper', 'Flat history is data loss.', '16-paper-projector.png',
     [('PAPER', 'Switching to Git: the Good, the Bad, and the Ugly. Just, Herzig, Czerwonka, Murphy. ISSRE 2016.'),
      ('LIVED IT', 'After the fast-forward and the deleted note, no card says "fancy". The rebased original is not on the Wall. The squash dropped the cards and who made them.'),
      ('ASK', 'One rule: the boss gets a clean history, and the auditor still knows who added the boots.')]),
    ('Wrap', 'What you built', '18-wrap-lab1.png',
     [('', 'Cards never change.'), ('', 'Sticky notes move.'), ('', 'The Wall copies cards.'),
      ('TAKE HOME', 'My Git in 7 lines: one takeaway per step, 0 to 6, editable, with Copy.')]),
    ('Teachers', "Press Next. That's the class.", '11-reveal-4-console.png',
     [('NEXT', 'One button walks 19 scenes in 77 minutes. A clicker works. The projector follows: it is the slide deck.'),
      ('SCRIPT', 'Each scene: what to say and do, the one question with its answer folded, and live answers.'),
      ('LABS', 'One tile per lab: goals, outfit and status. In Step 4, its way: merge or rebase.')]),
    ('Rehearse alone', 'A whole class, with bots', 'rehearsal-1-task-4-console.png',
     [('BOTS', 'Details → Rehearse with bots. 2 to 12 bots join like students and follow their own hints.'),
      ('SPEED', 'Real time, 5× or 20× faster. You press only Next.'),
      ('YOU TOO', 'Open the student link in another window and join. Your lab then waits for you.')]),
]


def words(text):
    """The words to wrap, each a list of (text, is_code) runs; punctuation after a code span stays with it."""
    out = []
    for w in re.findall(r'`[^`]+`[^\s`]*|[^\s`]+', text):
        if w.startswith('`'):
            code, tail = w[1:].split('`', 1)
            out.append([(code, True)] + ([(tail, False)] if tail else []))
        else:
            out.append([(w, False)])
    return out


def layout(text, f, m, width):
    """Greedy lines of words."""
    size = lambda w: sum((m if code else f).getlength(t) for t, code in w)
    space, lines, cur, x = f.getlength(' '), [], [], 0
    for w in words(text):
        if cur and x + space + size(w) > width:
            lines.append(cur); cur, x = [], 0
        x += (space if cur else 0) + size(w); cur.append(w)
    return lines + [cur]


def balanced(text, f, width):
    """A title in as few lines as fit; two lines are split where they come out most even."""
    lines = [' '.join(t for w in ln for t, _ in w) for ln in layout(text, f, f, width)]
    if len(lines) != 2:
        return lines
    ws = text.split(' ')
    widest = lambda s: max(f.getlength(s[0]), f.getlength(s[1]))
    splits = [(' '.join(ws[:i]), ' '.join(ws[i:])) for i in range(1, len(ws))]
    return list(min((s for s in splits if widest(s) <= width), key=widest))


def paragraph(d, x, y, text, f, m, lead):
    """Draws text from baseline y; returns the next baseline."""
    for ln in layout(text, f, m, TEXT_W):
        cx = x
        for w in ln:
            for t, code in w:
                d.text((cx, y), t, font=m if code else f, fill=PURPLE if code else INK, anchor='ls')
                cx += (m if code else f).getlength(t)
            cx += f.getlength(' ')
        y += lead
    return y


def page(kicker, title, shot, rows):
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((40, 40, 640, H - 40), 28, fill=LAV)
    x, y = 84, 122
    d.text((x, y), kicker.upper(), font=font('SemiBold', 26), fill=PURPLE, anchor='ls'); y += 66
    for ln in balanced(title, font('Bold', 54), TEXT_W):
        d.text((x, y), ln, font=font('Bold', 54), fill=INK, anchor='ls'); y += 66
    y += 30
    for label, text in rows:
        if label:
            d.text((x, y), label, font=font('SemiBold', 20), fill=MUTED, anchor='ls'); y += 36
            y = paragraph(d, x, y, text, font('Medium', 28), mono(25), 39)
        else:
            y = paragraph(d, x, y + 10, text, font('Bold', 40), mono(36), 54)
        y += 24
    if y > H - 24:  # keeps about 40 px under the last line
        sys.exit(f'{kicker}: the text runs off the page; cut words.')
    # screenshot, scaled to fit, with a soft shadow
    s = Image.open(os.path.join(SHOTS, shot)).convert('RGB')
    bx, by, bw, bh = 690, 40, W - 690 - 40, H - 80
    sc = min(bw / s.width, bh / s.height)
    s = s.resize((int(s.width * sc), int(s.height * sc)), Image.LANCZOS)
    px, py = bx + (bw - s.width) // 2, by + (bh - s.height) // 2
    sh = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sh).rounded_rectangle((px + 6, py + 10, px + s.width + 6, py + s.height + 10), 18, fill=70)
    img.paste((0, 0, 0), mask=sh.filter(ImageFilter.GaussianBlur(14)))
    mask = Image.new('L', s.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s.width, s.height), 14, fill=255)
    img.paste(s, (px, py), mask)
    d.rounded_rectangle((px, py, px + s.width, py + s.height), 14, outline=(228, 228, 233), width=2)
    return img


def cover():
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)
    d.text((140, 330), 'Outfit Lab', font=font('Bold', 110), fill=INK)
    d.text((140, 480), 'The Tuesday story: build Git, one problem at a time.', font=font('Medium', 44), fill=MUTED)
    d.text((140, 600), 'Each lab dresses one character together. Every button runs real Git.', font=font('Regular', 36), fill=INK)
    d.text((140, 655), 'Seven steps. The teacher presses Next. The projector is the slide deck.', font=font('Regular', 36), fill=INK)
    d.rectangle((0, H - 70, W, H), fill=PURPLE)
    d.text((140, H - 55), 'CS294 · Git Week · Tuesday · Shubham & Ananya', font=font('Medium', 28), fill='white')
    return img


def jpeg(img):
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=90, subsampling=0)
    return buf.getvalue()


if __name__ == '__main__':
    pages = [cover()] + [page(*p) for p in PAGES]
    out = os.path.join(HERE, 'STORY.pdf')
    with open(out, 'wb') as fh:
        fh.write(img2pdf.convert([jpeg(p) for p in pages]))
    print(len(pages), 'pages ->', out)
