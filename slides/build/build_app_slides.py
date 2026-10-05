#!/usr/bin/env python3
"""Monster Lab deck for teaching with the app: one slide per Git step, huge type.

Builds slides/tuesday_app.pptx (16:9, Google Slides ready, speaker notes on every slide).
Follows lesson/tuesday.md. Step titles and pause questions are the app's (server/steps.js).
The paper slide uses only facts from lesson/tuesday_paper_notes.md.
Run:  python3 build_app_slides.py
"""
import os
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

from build_simple import (FONT, MONO, INK, MUTED, PURPLE, LAVENDER, WHITE, GREEN, RED, LINE,
                          NAVY, W, H, M, OUT, new_deck, blank, text, box, chip, title_slide)

ORANGE = RGBColor(0xE0, 0x8A, 0x00)
PANEL = RGBColor(0xF6, 0xF6, 0xF8)
LABS = [('Lab 1', PURPLE), ('Lab 2', RGBColor(0x0E, 0xA5, 0xE9)),
        ('Lab 3', RGBColor(0xF9, 0x73, 0x16))]
CONTENT_W = W - 2 * M

# (app title, pause question, command, one plain sentence, behind the door, speaker notes)
STEPS = [
    ('Save every version',
     'Why do arrows point back, never forward?',
     'git commit',
     'Each save makes a new card that never changes.',
     'commit = tree + parent + author + time + message -> SHA-1 ID',
     'Ask, then wait 10 seconds. Say: git commit saves the whole monster, the card before, '
     'your name and the time; the ID is a hash of all of it, so any change makes a new card, '
     'and git log follows the parents back. '
     'Board: "1. Card (commit): a full snapshot + its parent. Never changes."'),
    ('Try two ideas at once',
     'Where is the original monster now? Did anything get copied?',
     'git switch -c cat-robot',
     'A sticky note is a label, not a copy.',
     '.git/refs/heads/cat-robot holds one commit ID · HEAD points to it',
     "Ask, then wait 10 seconds. Say: a branch is a tiny file holding one card's ID; your pin "
     "(HEAD) says which note you're on, and saving moves only that note. "
     'Board: "2. Sticky note (branch): a label on one card. Saving moves it."'),
    ('Make one monster from both',
     'Why did FACE and LEGS combine alone, but BODY needed you?',
     'git merge superhero',
     'Compare both sides with the card they share.',
     '3-way merge vs merge-base · both changed, differently -> CONFLICT',
     'First ask why the first merge only moved the note: main had nothing new, so it was a '
     'fast-forward, no new card. Say: otherwise Git compares each side with the newest card both '
     'share; changed on both, differently, is a conflict, and the merge card has two parents. '
     'Board: "3. Merge: compare both sides with the card they share."'),
    ('Meet the Wall',
     'Two labs never made that card. Why does their copy have the same ID?',
     'git clone',
     'Every lab has a full copy with the same IDs.',
     "ID = SHA-1 of the commit's bytes · same bytes -> same ID everywhere",
     "Say: git clone copies every card, and a card's ID is a hash of everything on it, parent "
     "included, so the same card has the same ID on every laptop. Blue wall/main is the Wall's "
     'main at your last check. Board: "4. The Wall (remote): a full copy. Same card, same ID '
     'everywhere."'),
    ('Put your monster on the Wall',
     'Why did the Wall refuse your card instead of adding it?',
     'git push · git pull',
     'The Wall only moves forward, so combine first.',
     'push: fast-forward only, else ! [rejected] · pull = fetch + merge',
     "Say: git push asks the Wall to move its main to yours, and it allows only a fast-forward: "
     "the Wall's newest card must already be in your history. git pull is git fetch + git merge; "
     'a push never merges, so you combine on your laptop and send again. '
     'Board: "5. Send (push) only moves the Wall forward. Behind? Get & combine (pull) first."'),
    ('Oops: undo a shared mistake',
     'Why is adding a fix card safe, but moving back is not?',
     'git revert',
     "Don't rip out a shared card; add a fix card.",
     'revert adds an inverse commit · reset moves the branch · reflog logs it',
     "Say: git revert adds a card that undoes the old one, so history only grows and it sends "
     "like any card. git reset --hard moves your note back, so the Wall's newest card leaves "
     'your history and the send is refused; git reflog lists every card your note was on. '
     'Board: "6. Shared mistake: add a fix card (revert). Move back (reset) only if nobody has '
     'the card."'),
    ('The boss wants it clean',
     'Who added the tentacles? Where does that answer still exist?',
     'git push --force',
     'Force the Wall, and it forgets who did what.',
     'squash: new ID · --force: no fast-forward check · gc: old commits gone',
     'Say: squash writes one new card with Start as its parent, so it gets a new ID; '
     'git push --force skips the fast-forward check, and git gc --prune=now deletes the old cards '
     'from the Wall. The labs kept theirs, so they can still name who added the tentacles. '
     'Board: "7. Rewrite (squash, rebase): new cards. Force push + gc: the old ones are gone."'),
]

# The paper, only from tuesday_paper_notes.md: (heading, color, [(lead, rest)]).
PAPER = [
    ('GOOD', GREEN, [('', 'Cheap branches.'),
                     ('', 'Local commits and reverts.'),
                     ('', 'Developers prefer flat history.')]),
    ('BAD', ORANGE, [('Fast-forward: ', 'no merge commit, branch forgotten.'),
                     ('Rebase: ', 'the change itself is rewritten.'),
                     ('Squash: ', 'commits gone, even who made them.')]),
    ('UGLY', RED, [('Integration path: ', "a change's route to main."),
                   ('', 'Microsoft rebuilt its tracing for Git.'),
                   ('', "Some loss can't be recovered.")]),
]


def italic(tb):
    for p in tb.text_frame.paragraphs:
        for r in p.runs:
            r.font.italic = True
    return tb


def bullets(s, x, y, w, h, items, size):
    """items: [(bold lead, rest)], one paragraph each, a gap between them."""
    tf = text(s, x, y, w, h, '', size=size).text_frame
    tf.paragraphs[0].clear()
    for i, (lead, rest) in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.line_spacing = 1.1
        p.space_before = Pt(0 if i == 0 else 12)
        for t, bold in ((lead, True), (rest, False)):
            if t:
                r = p.add_run()
                r.text = t
                r.font.name, r.font.size, r.font.bold, r.font.color.rgb = FONT, Pt(size), bold, INK


def emoji_panel(s, x, y, w, h, emoji, size):
    box(s, x, y, w, h, fill=PANEL, radius=0.14)
    text(s, x, y, w, h, emoji, size=size, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------- slides
def cover(prs):
    s = title_slide(prs, 'Monster Lab', 'Build Git, one problem at a time',
                    'CS294 · Git Week · Tuesday · Shubham & Ananya',
                    "No Git lecture today. You'll hit seven problems; your lab invents a fix for "
                    'each, then we show how Git does the same thing. Every button runs real Git.')
    # the start monster, as the app draws it: FACE, BODY, LEGS
    pw, ph, x = Inches(1.9), Inches(1.0), W - M - Inches(1.9)
    for i, e in enumerate(['🙂', '📦', '🦵']):
        emoji_panel(s, x, Inches(1.75) + i * (ph + Inches(0.14)), pw, ph, e, 48)


def join(prs):
    s = blank(prs, notes='Scan the QR or type the address, then your name, then Lab 1, 2 or 3. '
                         'Labs can change only before Step 1, so wait until the count matches '
                         'the room. Then Step 0: 90 seconds of chaos, then "Hands off."')
    q = Inches(4.4)
    qx, qy = W - M - q, (H - q) / 2
    box(s, qx, qy, q, q, fill=WHITE, line=LINE, dash=True, radius=0.06)
    text(s, qx, qy, q, q, 'QR', size=32, color=MUTED, align=PP_ALIGN.CENTER,
         anchor=MSO_ANCHOR.MIDDLE)
    left = qx - M - Inches(0.4)
    text(s, M, Inches(2.1), left, Inches(0.9), 'Open: ________', size=48, bold=True)
    text(s, M, Inches(3.25), left, Inches(1.4), ['Type your name.', 'Pick your lab.'], size=36,
         color=MUTED, spacing=1.25)
    for i, (label, color) in enumerate(LABS):
        chip(s, M + i * Inches(1.75), Inches(5.1), label, fill=color, size=22, w=Inches(1.5))


def step(prs, n, title, question, command, line, behind, notes):
    s = blank(prs, notes=notes)
    chip(s, M, Inches(0.65), f'STEP {n}')
    text(s, M + Inches(1.75), Inches(0.65), Inches(9), Inches(0.5), title, size=24, bold=True,
         anchor=MSO_ANCHOR.MIDDLE)
    italic(text(s, M, Inches(1.4), CONTENT_W, Inches(0.9), question, size=24, color=MUTED))
    size = min(96, int(CONTENT_W / Inches(1) * 72 / (0.62 * len(command))))
    text(s, M, Inches(2.2), CONTENT_W, Inches(1.5), command, size=size, bold=True,
         color=PURPLE, font=MONO, anchor=MSO_ANCHOR.MIDDLE)
    text(s, M, Inches(4.2), CONTENT_W, Inches(0.7), line, size=34)
    box(s, M, Inches(5.5), CONTENT_W, Inches(1.1), fill=LAVENDER, radius=0.2)
    pad = Inches(0.4)
    text(s, M + pad, Inches(5.68), CONTENT_W - 2 * pad, Inches(0.3), 'BEHIND THE DOOR', size=13,
         bold=True, color=PURPLE)
    text(s, M + pad, Inches(6.0), CONTENT_W - 2 * pad, Inches(0.4), behind, size=17, font=MONO)


def paper(prs):
    s = blank(prs, notes="Say: you just lived this paper. Microsoft moved its teams to Git, and "
                         'the paper says flat history is data loss: fast-forward forgets the '
                         'branch, rebase rewrites the change, squash drops the cards, even who made '
                         "them, so Microsoft had to rebuild how it traces a change's path to main. "
                         'Pairs, 2 min: one rule so the boss gets a clean history and the auditor '
                         'can still say who added the tentacles.')
    text(s, M, Inches(0.55), CONTENT_W, Inches(0.4),
         "Tuesday's paper · Just, Herzig, Czerwonka, Murphy · ISSRE 2016", size=20, color=MUTED)
    text(s, M, Inches(0.95), CONTENT_W, Inches(0.8), 'Switching to Git: Good, Bad, Ugly', size=40,
         bold=True)
    gap = Inches(0.4)
    cw = (CONTENT_W - 2 * gap) / 3
    for i, (head, color, items) in enumerate(PAPER):
        x = M + i * (cw + gap)
        bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, Inches(2.0), cw, Inches(0.07))
        bar.fill.solid()
        bar.fill.fore_color.rgb = color
        bar.line.fill.background()
        text(s, x, Inches(2.2), cw, Inches(0.45), head, size=22, bold=True, color=color)
        bullets(s, x, Inches(2.8), cw, Inches(2.4), items, size=20)
    text(s, M, Inches(5.75), CONTENT_W, Inches(0.7), 'Flat history is data loss.', size=40,
         bold=True, color=PURPLE)
    text(s, M, Inches(6.5), CONTENT_W, Inches(0.4),
         'You saw it in Step 7: squash, then force push. The Wall forgot who added 🐙.', size=20,
         color=MUTED)


def finale(prs):
    s = blank(prs, NAVY, notes="Read one lab's counts. Point at the seven board lines and say: "
                               "Cards never change. Sticky notes move. The Wall copies cards. "
                               "That's Git. Homework: Yang et al., Sections 3.2 to 3.5; for one "
                               'finding, write down what they measured.')
    for x, y, d in [(1.2, 0.8, .05), (3.4, 1.6, .04), (5.9, .6, .06), (8.3, 1.3, .04),
                    (10.6, .7, .05), (12.1, 1.9, .04), (2.2, 6.4, .04), (11.4, 6.1, .05),
                    (7.2, 6.7, .04), (0.7, 3.9, .03), (12.6, 4.2, .03)]:
        star = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
        star.fill.solid()
        star.fill.fore_color.rgb = WHITE
        star.line.fill.background()
    text(s, M, Inches(2.1), CONTENT_W, Inches(3.3),
         ['Cards never change.', 'Sticky notes move.', 'The Wall copies cards.'], size=60,
         bold=True, color=WHITE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, spacing=1.2)


def flatten(prs):
    """Drop each shape's theme style: LibreOffice draws its shadow despite an empty effectLst."""
    for slide in prs.slides:
        for shp in slide.shapes:
            style = shp._element.find(qn('p:style'))
            if style is not None:
                shp._element.remove(style)


def build():
    prs = new_deck()
    cover(prs)
    join(prs)
    for n, spec in enumerate(STEPS, 1):
        step(prs, n, *spec)
    paper(prs)
    finale(prs)
    flatten(prs)
    return prs


if __name__ == '__main__':
    path = os.path.join(OUT, 'tuesday_app.pptx')
    build().save(path)
    print('saved', path)
