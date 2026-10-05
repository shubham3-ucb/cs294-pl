#!/usr/bin/env python3
"""Build STORY.pdf: the Tuesday class, one page per step, real app screenshots + 3 plain lines.
usage: python3 build_story.py <screenshots_dir>
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import img2pdf

SHOTS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'e2e', 'shots')
OUT = os.path.dirname(os.path.abspath(__file__))
F = '/usr/share/fonts/opentype/inter/Inter-{}.otf'
font = lambda w, s: ImageFont.truetype(F.format(w), s)
INK, MUTED, PURPLE, LAV = (17, 17, 17), (112, 112, 122), (139, 61, 255), (244, 236, 251)
W, H = 1920, 1080

STEPS = [
    ('Step 0', 'Everyone, one monster', 's00-chaos-lab1-student.png',
     [('PROBLEM', 'Everyone edits one monster at once. "Who changed the legs?" Nobody knows.'),
      ('IDEA', 'Save every version, with a name on it.'),
      ('GIT', 'None yet. This is life without it.')]),
    ('Step 1', 'Save every version', 's01-commit-lab1-student.png',
     [('PROBLEM', 'You could not get an old monster back.'),
      ('IDEA', 'Never erase. Every save is a new card: the whole monster, your name, the card before.'),
      ('GIT', 'git commit. The card\'s ID is a hash of all that. Following the arrows back is git log.')]),
    ('Step 2', 'Try two ideas at once', 's02-branch-lab1-student.png',
     [('PROBLEM', 'Two risky ideas could wreck the good monster.'),
      ('IDEA', 'Each pair gets its own sticky note. Saving moves only theirs.'),
      ('GIT', 'git branch: a tiny file holding one card\'s ID. Your pin (HEAD) is the note you are on.')]),
    ('Step 3', 'Make one monster from both', 's03-merge-resolver-lab1-student.png',
     [('PROBLEM', 'The client wants one monster with both ideas.'),
      ('IDEA', 'Compare each part with where both ideas started. Changed on one side: keep it.'),
      ('GIT', 'git merge. FACE and LEGS combine alone. BODY changed on both sides: a person decides.')]),
    ('Step 4', 'Meet the Wall', 's04-remote-lab2-student.png',
     [('PROBLEM', 'Each lab\'s cards live only in that lab.'),
      ('IDEA', 'One shared copy for the class, like GitHub. Every lab gets a full copy.'),
      ('GIT', 'git clone. The same card has the same ID on every laptop: the ID is computed from it.')]),
    ('Step 5', 'Put your monster on the Wall', 's05-push-behind-lab2-student.png',
     [('PROBLEM', 'The Wall refused your card.'),
      ('IDEA', 'The Wall never drops a card. Get its new cards, combine, then send.'),
      ('GIT', 'git push only moves the Wall forward. git pull = git fetch + git merge.')]),
    ('Step 6', 'Oops: undo a shared mistake', 's06-undo-card-lab1-student.png',
     [('PROBLEM', 'A mustache card reached the Wall, and every lab has it.'),
      ('IDEA', 'Don\'t rip out a shared card. Add a card that undoes it.'),
      ('GIT', 'git revert adds a fix card. git reset moves your note back. git reflog remembers every move.')]),
    ('Step 7', 'The boss wants it clean', 's07-rewrite-screen.png',
     [('PROBLEM', '"Who added the tentacles?" Before the clean-up: Tom, Lab 2. After: not found.'),
      ('IDEA', 'Rewriting history makes new cards and forgets the old ones.'),
      ('GIT', 'Squash = one new card, new ID. git push --force makes the Wall forget. The paper: flat history is data loss.')]),
    ('Step 8', 'What you built', 's08-wrap-screen.png',
     [('', 'Cards never change.'), ('', 'Sticky notes move.'), ('', 'The Wall copies cards. That\'s Git.')]),
    ('Teachers', 'What you see while it runs', 's05-push-admin.png',
     [('SCRIPT', 'Each step\'s problem, the one question, and the answer you hope to hear.'),
      ('LIVE', 'Every lab\'s cards, goals and alerts like "Refused twice in a row".'),
      ('FEED', 'Who did what, with the real Git command.')]),
]


def wrap(draw, text, fnt, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=fnt) <= width:
            cur = t
        else:
            lines.append(cur); cur = w
    return lines + [cur]


def page(kicker, title, shot, rows):
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((40, 40, 640, H - 40), 28, fill=LAV)
    x, y, tw = 84, 96, 520
    d.text((x, y), kicker.upper(), font=font('SemiBold', 26), fill=PURPLE); y += 52
    for ln in wrap(d, title, font('Bold', 54), tw):
        d.text((x, y), ln, font=font('Bold', 54), fill=INK); y += 66
    y += 34
    for label, text in rows:
        if label:
            d.text((x, y), label, font=font('SemiBold', 20), fill=MUTED); y += 32
        f = font('Medium' if label else 'Bold', 30 if label else 40)
        for ln in wrap(d, text, f, tw):
            d.text((x, y), ln, font=f, fill=INK); y += 42 if label else 54
        y += 26
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
    d.text((140, 330), 'Monster Lab', font=font('Bold', 110), fill=INK)
    d.text((140, 480), 'The Tuesday story: build Git, one problem at a time.', font=font('Medium', 44), fill=MUTED)
    d.text((140, 600), 'Each lab builds one monster. Every button runs real Git.', font=font('Regular', 36), fill=INK)
    d.text((140, 655), 'Feel the problem. Invent the fix. See what Git does behind the door.', font=font('Regular', 36), fill=INK)
    d.rectangle((0, H - 70, W, H), fill=PURPLE)
    d.text((140, H - 55), 'CS294 · Git Week · Tuesday · Shubham & Ananya', font=font('Medium', 28), fill='white')
    return img


if __name__ == '__main__':
    pages = [cover()] + [page(*s) for s in STEPS]
    files = []
    for i, p in enumerate(pages):
        f = os.path.join(OUT, f'page-{i:02d}.png'); p.save(f); files.append(f)
    with open(os.path.join(OUT, 'STORY.pdf'), 'wb') as fh:
        fh.write(img2pdf.convert(files))
    print(len(files), 'pages ->', os.path.join(OUT, 'STORY.pdf'))
