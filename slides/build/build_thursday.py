"""Thursday deck: "Git, Part 2: The Humans" (CS294, Thu 10/15/2026).

Implements design/spec.md section 7 (slides H1-H22) with the visual system in style.py
(section 9). style.py is not modified; Thursday-only helpers (shape icons, rotated fan
cards, a few custom layouts) live in this file.

    python3 build_thursday.py            # build + audit + render PNGs
    python3 build_thursday.py --no-render
"""
import glob
import math
import os
import sys

sys.path.insert(0, '/home/shagarw_google_com/shubham/git_course/slides/build')
from style import *                       # noqa: F401,F403
from style import _no_shadow              # private helper, used for freeform icons

ROOT = '/home/shagarw_google_com/shubham/git_course'
OUT = f'{ROOT}/slides/thursday_git_user_study.pptx'
REN = f'{ROOT}/slides/renders/thursday'

SRC_YANG = 'Yang et al., “Do Developers Really Know How to Use Git Commands?”, TOSEM 2022'

# BEFORE CLASS: set the real Mentimeter access code and save the QR PNG at MENTI_QR, then
# rebuild. Slides H2 and H20 pick both up automatically (H8 and H14 must use the same
# Menti presentation). Until then the slides show a dashed 'QR' box and '____ ____'.
MENTI_CODE = '____ ____'                         # e.g. '1234 5678'
MENTI_QR = f'{ROOT}/slides/assets/menti_qr.png'


# =============================================================== small helpers
def title(sl, t, y=0.45, size=40, w=CW, sizes=None):
    """40 Bold slide title on one line (shrinks to 36/32 if needed)."""
    sz = fit_size(t, w, 0.85, sizes or (size, 36, 32), bold=True, max_lines=1) \
        if sizes is not False else size
    return text(sl, M, y, w, 0.85, t, size=sz, bold=True, anchor='m')


def flip_h(shp):
    shp._element.spPr.find(qn('a:xfrm')).set('flipH', '1')
    return shp


def rot_pt(dx, dy, th):
    """Rotate an offset clockwise by th degrees (screen coordinates, y down)."""
    a = math.radians(th)
    return dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)


def _poly(sl, pts, line_c=INK, lw=2.0, fill=None, closed=True):
    fb = sl.shapes.build_freeform(Inches(pts[0][0]), Inches(pts[0][1]), scale=1.0)
    fb.add_line_segments([(Inches(x), Inches(y)) for x, y in pts[1:]], close=closed)
    shp = fb.convert_to_shape()
    if fill:
        shp.fill.solid()
        shp.fill.fore_color.rgb = rgb(fill)
    else:
        shp.fill.background()
    shp.line.color.rgb = rgb(line_c)
    shp.line.width = Pt(lw)
    _no_shadow(shp)
    return shp


def draw_icon(sl, kind, cx, cy, size=0.5, color=INK, th=0.0, lw=None):
    """Simple native-shape icons (no emoji, spec 7: 'Icons are simple shapes').
    kind: undo | chain | book | card | term | split | stop.  size = nominal width (in).
    th rotates the whole icon about (cx, cy) so it can sit on a rotated card."""
    s = size
    lw = lw or max(1.5, min(3.0, 4.2 * s))

    def at(dx, dy):
        ox, oy = rot_pt(dx * s, dy * s, th)
        return cx + ox, cy + oy

    def bx(dx, dy, w, h, rot=0.0, **kw):
        x, y = at(dx, dy)
        return box(sl, x - w * s / 2, y - h * s / 2, w * s, h * s, rot=(rot + th) % 360, **kw)

    if kind == 'undo':        # circular arrow, flipped: the classic 'undo' curve
        shp = bx(0, 0.24, 1.0, 1.0, fill=color, shape=MSO_SHAPE.CIRCULAR_ARROW)
        shp.adjustments[0] = 0.13          # arc thickness
        shp.adjustments[1] = 18.0          # arrowhead angle (bigger head reads at small sizes)
        shp.adjustments[4] = 0.20          # arrowhead size
        flip_h(shp)
    elif kind == 'chain':
        for dx, dy in ((-0.17, 0.13), (0.17, -0.13)):
            bx(dx, dy, 0.64, 0.33, rot=-38, line=color, lw=lw, radius='pill')
    elif kind == 'book':
        for sgn in (-1, 1):
            pts = [(0.03 * sgn, -0.22), (0.50 * sgn, -0.32), (0.50 * sgn, 0.24),
                   (0.03 * sgn, 0.34)]
            _poly(sl, [at(x, y) for x, y in pts], line_c=color, lw=lw)
        for sgn in (-1, 1):           # two 'text lines' per page
            for k, yy in enumerate((-0.08, 0.08)):
                x1, y1 = at(0.13 * sgn, yy - 0.04 + 0.0)
                x2, y2 = at(0.38 * sgn, yy - 0.08)
                line(sl, x1, y1, x2, y2, color=color, w=max(1.0, lw * 0.6))
    elif kind == 'card':      # mini monster card: the model
        bx(0, 0, 0.66, 0.92, line=color, lw=lw, radius=0.06 * s, fill=WHITE)
        for dy in (-0.22, 0.0, 0.22):
            bx(0, dy + 0.06, 0.46, 0.15, fill=HAIR)
        bx(-0.12, -0.33, 0.22, 0.08, fill=color)
    elif kind == 'term':      # mini terminal: the error message
        b = bx(0, 0, 0.98, 0.72, fill=color, radius=0.08 * s)
        label(b, '>_', size=max(9, round(26 * s)), bold=True, color=WHITE, font=MONO)
    elif kind == 'split':     # one verb -> two purposes
        x0, y0 = at(-0.50, 0)
        x1, y1 = at(-0.12, 0)
        line(sl, x0, y0, x1, y1, color=color, w=lw)
        for sy in (-0.36, 0.36):
            x2, y2 = at(0.50, sy)
            arrow(sl, x1, y1, x2, y2, color=color, w=lw)
    elif kind == 'stop':      # deliberate: a stop sign
        bx(0, 0, 0.86, 0.86, line=color, lw=lw, shape=MSO_SHAPE.OCTAGON)
        bx(0, 0, 0.44, 0.11, fill=color)


def tag_pill(sl, x, y, txt, fill=INK, color=WHITE, size=15, h=0.36, w=None):
    w = w or chip_w(txt, size)
    chip(sl, x, y, w, h, txt, fill=fill, color=color, size=size)
    return w


def lav_header(sl, chip_label=None, minutes=None, menti_label=None):
    """Chip row of a lavender ACTIVITY slide."""
    if menti_label:
        menti_chip(sl, label=menti_label)
    elif chip_label:
        step_chip(sl, chip_label)
    if minutes is not None:
        timer_chip(sl, minutes)


def cmd_chip(sl, x, y, w, h, txt, kind='plain', size=22):
    """Command chip for H3. kind: recovery (purple + undo icon) | plain (grey) | ghost."""
    if kind == 'recovery':
        box(sl, x, y, w, h, fill=PURPLE, radius=0.10)
        draw_icon(sl, 'undo', x + 0.36, y + h / 2, size=h * 0.74, color=WHITE)
        text(sl, x + 0.70, y, w - 0.80, h, txt, size=size, bold=True, color=WHITE, font=MONO,
             anchor='m', markup=False)
    elif kind == 'ghost':
        box(sl, x, y, w, h, fill=WHITE, line=GHOST, lw=1.25, radius=0.10, dash=True)
        text(sl, x + 0.70, y, w - 0.80, h, txt, size=size, bold=True, color=MUTED, font=MONO,
             anchor='m', markup=False)
    else:
        box(sl, x, y, w, h, fill=BAR_GREY, radius=0.10)
        text(sl, x + 0.70, y, w - 0.80, h, txt, size=size, bold=True, color=INK2, font=MONO,
             anchor='m', markup=False)


def fan_card(sl, cx, cy, th, icon, lab, w=1.42, h=2.05, icon_size=0.66, size=13):
    """A finding card rotated by th degrees about its centre, with icon + caps label."""
    box(sl, cx - w / 2, cy - h / 2, w, h, fill=WHITE, line=CARD_LINE, lw=1.5, radius=0.12,
        rot=th % 360)
    ix, iy = rot_pt(0, -0.24, th)
    draw_icon(sl, icon, cx + ix, cy + iy, size=icon_size, th=th)
    lx, ly = rot_pt(0, 0.60, th)
    tb = text(sl, cx + lx - w / 2, cy + ly - 0.18, w, 0.36, lab, size=size, bold=True,
              color=INK, align='c', anchor='m', markup=False)
    tb.rotation = th % 360


def quote_card2(sl, x, y, w, h, court, quote, ref, color, size=22):
    """Quote card with the court name above the quote (H14)."""
    box(sl, x, y, w, h, fill=WHITE, line=PANEL_LINE, lw=1)
    box(sl, x, y, w, 0.08, fill=color)
    text(sl, x + 0.25, y + 0.28, w - 0.5, 0.30, court, size=13, bold=True, color=INK2,
         anchor='m', markup=False)
    text(sl, x + 0.25, y + 0.74, w - 0.5, h - 1.30, quote, size=size, italic=True, ls=1.12)
    text(sl, x + 0.25, y + h - 0.50, w - 0.5, 0.30, ref, size=14, color=MUTED, anchor='m')


_PAUSE_EMO = '💬'


def pause_bar(sl, question, y_bottom=6.92, x=M, w=CW):
    """Thursday override of style.pause_bar (same look on one line). The emoji sits in its
    own box and the question starts where its first word would, so if a line ever wraps
    (e.g. Google Slides measures Inter a little wider) it lines up under the first word,
    not under the emoji. No forced line breaks. Returns the bar's top y."""
    ew = text_width(_PAUSE_EMO + '  ', 24)
    inner = w - 0.60 - ew
    size, n = 24, lines_needed(question, inner, 24)
    if n > 1:
        size = 22
        n = lines_needed(question, inner, 22)
        if n > 2:
            size = fit_size(question, inner, 0.80, (20, 18), max_lines=2)
            n = 2
    h = 0.72 if n == 1 else 1.02
    top = y_bottom - h
    box(sl, x, top, w, h, fill=LAVENDER, radius=0.14)
    lh = size * 1.21 * 1.05 / 72
    ecy = top + h / 2 - (n - 1) * lh / 2          # centre of the first text line
    text(sl, x + 0.30, ecy - 0.25, ew, 0.50, _PAUSE_EMO, size=size, anchor='m',
         markup=False)
    text(sl, x + 0.30 + ew, top, inner, h, question, size=size, anchor='m', ls=1.05)
    return top


def card_big(sl, x, y, cid, panels, id_size=14, cf_size=13, **kw):
    """style.card() with projector-readable metadata. card() scales the ID tag and the
    '← parent' line with s (11/10 pt at s=0.8); this keeps them at id_size / cf_size pt
    (spec floor for card metadata: 13 pt) whatever the card scale."""
    n0 = len(sl.shapes)
    g = card(sl, x, y, cid, panels, **kw)
    new = list(sl.shapes)[n0:]
    s = g['s']
    tag = new[1]                                   # card body, then the ID tag chip
    tag.width = Inches(text_width(cid, id_size, True, MONO) + 0.16)
    tag.height = Inches(0.33)
    tf = tag.text_frame
    tf.margin_top = tf.margin_bottom = Inches(0)
    for r in tf.paragraphs[0].runs:
        r.font.size = Pt(id_size)
    if kw.get('parent') is not None:
        cf = new[-1]                               # last shape = the came-from line
        for r in cf.text_frame.paragraphs[0].runs:
            r.font.size = Pt(cf_size)
        chh = cf_size * 1.45 / 72
        cy = y + (2.12 + 2.45) / 2 * s             # middle of the strip under the panels
        cf.top, cf.height = Inches(cy - chh / 2), Inches(chh)
    return g


# =============================================================== deck
prs = new_deck()

# ---------------------------------------------------------------- H1 TITLE
title_slide(
    prs, 'Git, Part 2: The Humans',
    'Yang et al. "Do Developers Really Know How to Use Git Commands?" TOSEM 2022',
    topic='Git Week · User Study Day', subtitle_size=20,
    notes=[
        'H1 · TITLE · 0:00–0:02 (2 min)',
        '',
        'SAY: "Tuesday you built Git out of cards. Today: what happens when real humans use it, '
        'and what should tool designers learn? If you leave without one new design insight, '
        'we\'ve failed."',
        '',
        'AT THE DOOR (Ananya): every student gets a sticky: "The claim you don\'t believe + page '
        'number." Collect them as people sit down. During H2–H9 Ananya sorts them by axis onto '
        'the three court tables (Pink = research question, Blue = data, Orange = analysis).',
        'Teams = Tuesday\'s labs. Lab 1 = Pink court, Lab 2 = Blue court, Lab 3 = Orange court.',
    ])

# ---------------------------------------------------------------- H2 MENTI ranking
menti(
    prs, 'Rank by average views per Stack Overflow question. Most viewed first.',
    chips=['git rebase', 'git merge', 'git push', 'git revert', 'git checkout', 'git commit'],
    code=MENTI_CODE, qr=MENTI_QR,
    notes=[
        'H2 · MENTI (ranking) · 0:02 (part of the 6-min hook, H2–H4)',
        '',
        'BEFORE CLASS: paste the real Menti QR and access code here and on H20 (or set MENTI_CODE '
        '/ MENTI_QR in build_thursday.py and rebuild). H8 and H14 use the same Menti presentation.',
        '',
        'Menti RANKING question, 45 seconds, results HIDDEN until voting closes.',
        'Exact text: "Rank by average views per Stack Overflow question. Most viewed first."',
        'Items: git rebase / git merge / git push / git revert / git checkout / git commit',
        '',
        'Answer (Table 4, p.14): revert (1) > commit (16) > checkout (17) > push (21) > '
        'merge (24) > rebase (not in the top 30).',
        'Tuesday primed revert, so the surprise is meant to be merge and rebase.',
        'Guardrail: never say rebase is "unpopular". It just isn\'t in the top 30 by average views.',
    ])

# ---------------------------------------------------------------- H3 TALK reveal
sl = blank(prs)
title(sl, '4 of the top 5 are about going back.')
hairline(sl, 6.67, 1.60, 6.67, 6.10)
# left: the real top 5
text(sl, M, 1.55, 5.6, 0.45, 'The real top 5', size=20, bold=True, color=INK, anchor='m')
top5 = [('revert', 'recovery'), ('reflog', 'recovery'), ('stash', 'recovery'),
        ('clean', 'plain'), ('reset', 'recovery')]
y0, pitch, ch_h = 2.25, 0.80, 0.62
for i, (cmd, kind) in enumerate(top5):
    yy = y0 + i * pitch
    text(sl, M, yy, 0.45, ch_h, str(i + 1), size=26, bold=True, color=INK, anchor='m',
         markup=False)
    cmd_chip(sl, 1.30, yy, 2.45, ch_h, cmd, kind=kind, size=24)
text(sl, 3.95, y0, 2.5, ch_h, '21.7k avg views', size=18, color=MUTED, anchor='m')
# right: the class's six, actual rank
text(sl, SPLIT_X - 0.55, 1.55, 5.4, 0.45, 'Your six, actual rank', size=20, bold=True,
     anchor='m')
six = [('1', 'revert', 'recovery'), ('16', 'commit', 'plain'), ('17', 'checkout', 'plain'),
       ('21', 'push', 'plain'), ('24', 'merge', 'plain'), ('—', 'rebase', 'ghost')]
ry0, rp, rh = 2.30, 0.66, 0.52
for i, (rk, cmd, kind) in enumerate(six):
    yy = ry0 + i * rp
    text(sl, 7.20, yy, 0.55, rh, rk, size=22, bold=True, color=INK2, align='r', anchor='m',
         markup=False)
    cmd_chip(sl, 7.95, yy, 2.45, rh, cmd, kind=kind, size=22)
text(sl, 10.60, ry0 + 5 * rp, 2.0, rh, 'not in top 30', size=18, color=MUTED, anchor='m')
source_line(sl, 'Avg. views per question, commands with ≥200 questions. Yang et al., '
                'Table 4, p.14.')
notes(sl, [
    'H3 · TALK (reveal) · ~0:04',
    '',
    'Show the Menti class ranking FIRST, then this slide.',
    'Purple chips = recovery ("going back"): revert, reflog, stash, reset. clean is grey.',
    'revert is #1 with 21.7k average views per question (Table 4: 21,726).',
    'Right column: where the six commands you ranked actually land (Table 4, p.14). rebase is '
    'not in the top 30 by average views; that is NOT the same as unpopular.',
    '',
    'The single most-voted question is "How do I undo the most recent local commits in Git?" '
    '(p.3).',
    '',
    'SAY: "Hold on to this. In 20 minutes the Orange court will tell us how much to trust it."',
    '(Means of views, every command in a post gets full credit, views pile up over the years.)',
])

# ---------------------------------------------------------------- H4 TALK link to Tuesday
sl = blank(prs)
title(sl, 'You felt this on Tuesday.')
hairline(sl, 6.67, 1.60, 6.67, 5.00)
s = 0.88                                    # cards ~10% larger; IDs 14 pt, back-pointers 13 pt
cy_top = 2.55
text(sl, M, 1.55, 5.65, 0.50, '`reset`: move the flag back', size=26, bold=True, anchor='m')
text(sl, 6.95, 1.55, 5.63, 0.50, '`revert`: add a fix card', size=26, bold=True, anchor='m')
# left half: main moved back, the mustache card torn off
a = card_big(sl, 1.35, cy_top, 'ddr2', ('dragon', 'disco', 'skates'), parent='cdr2', s=s)
flag(sl, a, 'main')
b = card_big(sl, 4.15, cy_top + 0.22, 'mdr1', ('mustache', 'disco', 'skates'), parent='ddr2',
             s=s, marks={0: 'changed'})
link(sl, b, a, color=GHOST, dash=True)
badge(sl, b['r'] - 0.05, b['t'] + 0.05, d=0.46, size=20)
# right half: card <- mustache <- fix card (green)
a2 = card_big(sl, 7.05, cy_top, 'ddr2', ('dragon', 'disco', 'skates'), parent='cdr2', s=s)
b2 = card_big(sl, 9.02, cy_top, 'mdr1', ('mustache', 'disco', 'skates'), parent='ddr2', s=s,
              marks={0: 'changed'})
c2 = card_big(sl, 10.99, cy_top, 'ddr8', ('dragon', 'disco', 'skates'), parent='mdr1', s=s,
              marks={0: 'auto'})
link(sl, b2, a2)
link(sl, c2, b2, color=GREEN)
flag(sl, c2, 'main')
# reflog tag under both halves
rt = '`reflog` = the safety diary'
rw = chip_w('reflog = the safety diary', 22, bold=False) + 0.5
b_ = box(sl, (W - rw) / 2, 5.24, rw, 0.62, fill=PANEL, line=PANEL_LINE, lw=1, radius='pill')
label(b_, rt, size=22, bold=False, color=INK, code_color=PURPLE)
pause_bar(sl, 'Why was the mustache the hardest call on Tuesday?')
notes(sl, [
    'H4 · TALK (link to Tuesday) · ~0:05–0:08',
    '',
    'Left: reset moves main back to ddr2; the mustache card mdr1 is torn off the wall (red ×). '
    'It still exists and still points back to ddr2, it is just unreachable.',
    'Right: revert adds a fix card ddr8 (same picture as ddr2, different ID because its parent is '
    'different). Nobody\'s table breaks.',
    'reflog = your local diary of where HEAD has been. It finds the torn-off card until gc.',
    '',
    'PAUSE: 60 seconds of shout-outs. "Why was the mustache the hardest call on Tuesday?"',
    'Expected answer: you had to know who else already had the card.',
    'SAY: "Because cards never change, \'undo\' is two operations with different blast radii. '
    'Thousands of developers got stuck exactly where you did."',
    '',
    'If any Tuesday exit-ticket item fell below 70%, re-ask it here.',
])

# ---------------------------------------------------------------- H5 CONTENT goals
content(
    prs, "Today's goals", lead='After today, we should be confident you could:',
    items=['Separate what a study measured from what it claims',
           'Place a study on three axes; name its biggest threat',
           "Turn a finding into a feature, plus how you'd know it worked"],
    marks=[PINK, BLUE, ORANGE], size=30,
    notes=[
        'H5 · CONTENT (goals) · 0:08 (1 min)',
        '',
        'Line 1 (pink): Claim Court.',
        'Line 2 (blue): you place the study yourselves in 5 minutes (H8), before we show it.',
        'Line 3 (orange): design sprint and the individual exit question (H19–H20).',
        '',
        'Full objectives (spec 2): separate measured vs claimed and rewrite an over-reaching '
        'claim; place a study on Sarah\'s three axes and name its most serious validity threat; '
        'turn a finding into a concrete tool change plus a logged/observed measure (not '
        'self-report).',
    ])

# ---------------------------------------------------------------- H6 DIAGRAM funnel
sl = blank(prs)
title(sl, 'The study in one picture')
fx, fws = M, (5.90, 5.30, 4.00)
fcx = fx + fws[0] / 2
bars = [(1.65, 0.95), (2.78, 0.75), (3.71, 0.75)]
b0 = box(sl, fcx - fws[0] / 2, bars[0][0], fws[0], bars[0][1], fill=BAR_GREY, radius=0.10)
label(b0, [[('198,626 SO questions tagged git', {})],
           [('2008–2020', {'size': 16, 'color': INK2})]], size=20, bold=False, ls=1.05)
b1 = box(sl, fcx - fws[1] / 2, bars[1][0], fws[1], bars[1][1], fill=BAR_GREY, radius=0.10)
label(b1, 'contains an exact Git command string', size=20, bold=False)
b2_ = box(sl, fcx - fws[2] / 2, bars[2][0], fws[2], bars[2][1], fill=BAR_GREY, radius=0.10)
label(b2_, '80,370 questions', size=22, bold=True)
fr, fcy = fcx + fws[2] / 2, bars[2][0] + bars[2][1] / 2
rqs = [('RQ1', 'How popular?'), ('RQ2', 'Who asks?'), ('RQ3', 'Which commands?'),
       ('RQ4', 'Which are hard?')]
ph, pp = 0.62, 0.14
ptop = (bars[0][0] + bars[2][0] + bars[2][1]) / 2 - (4 * ph + 3 * pp) / 2


def rq_pill(sl, y, tag, q):
    box(sl, SPLIT_X, y, R - SPLIT_X, ph, fill=WHITE, line=PANEL_LINE, lw=1.25, radius=0.12)
    tag_pill(sl, SPLIT_X + 0.18, y + (ph - 0.36) / 2, tag, w=0.78)
    text(sl, SPLIT_X + 1.15, y, R - SPLIT_X - 1.3, ph, q, size=22, anchor='m')


for i, (tg, q) in enumerate(rqs):
    yy = ptop + i * (ph + pp)
    line(sl, fr + 0.08, fcy, SPLIT_X - 0.06, yy + ph / 2, color='BBBBBB', w=1.5)
    rq_pill(sl, yy, tg, q)
# survey row
sy = 5.20
bs = box(sl, fcx - fws[0] / 2, sy, fws[0], 0.75, fill=BAR_GREY, radius=0.10)
label(bs, 'Survey: 508 invited → **92 replied**', size=20, bold=False)
line(sl, fcx + fws[0] / 2 + 0.08, sy + 0.375, SPLIT_X - 0.06, sy + 0.375, color='BBBBBB',
     w=1.5)
rq_pill(sl, sy + (0.75 - ph) / 2, 'RQ5', 'How do people learn?')
source_line(sl, 'Yang et al., TOSEM 2022, p.5–9.')
notes(sl, [
    'H6 · DIAGRAM: the paper, 1 of 3 · 0:09 (H6–H9 = 8 min)',
    '',
    'Just what they did. No judging yet.',
    '- 136 command names from the Pro Git book. Exact string match on the title, body, or '
    'accepted answer (p.5–6).',
    '- 600 questions hand-checked, Cohen\'s kappa 0.844 (p.6).',
    '- Four RQs on the Stack Overflow data (popularity, who asks, which commands, which are '
    'hard).',
    '- Survey: 508 invited, 92 replied (74 industry, 18 academia; p.9) -> RQ5, how people learn.',
    '',
    'SAY: "Just what they did. No judging yet."',
])

# ---------------------------------------------------------------- H7 CONTENT findings
sl = content(
    prs, 'What they found',
    items=['0.4% of SO questions, but 1.5% of askers',
           '2020: 40% of askers on SO 5+ years (all SO: 21%)',
           'Recovery tops views; 83% of questions mix commands',
           'Least answered: rare commands, credential, submodule',
           '81.7% of learning picks = self-learning'],
    marks=['RQ1', 'RQ2', 'RQ3', 'RQ4', 'RQ5'], size=26,
    notes=[
        'H7 · CONTENT: the paper, 2 of 3 · ~0:11',
        '',
        'RQ1: Git questions ~0.4% of SO questions but ~1.5% of askers (Table 1).',
        'RQ2: by 2020, 40.0% of Git-command askers had been registered on SO 5+ years, vs 21.2% of '
        'all askers (Table 3). Registration years = their experience proxy.',
        'RQ3: recovery commands top average views (Table 4); only 17% of questions involve a single '
        'command (Fig. 3).',
        'RQ4: least answered (% without accepted answer) = rare commands with tiny n '
        '(pack-redundant n=1, http-push n=3), then credential, submodule (Table 6).',
        'RQ5: 81.7% of learning-approach SELECTIONS (multi-select) were self-learning (Table 7). '
        'Say "of selections", never "of developers".',
        '',
        'The authors\' conclusion: Git is hard even for experienced developers, so teach it better '
        'and build recommenders.',
        'SAY: "Write down which of these five you believe least."',
    ])
source_line(sl, 'Yang et al., TOSEM 2022. Tables 1–4, 6, 7; Fig. 3.')

# ---------------------------------------------------------------- H8 / H9 placement
RUNGS = ['Observe people', 'Traces in the wild', 'Tricks to avoid introspection',
         'Self-report']
AXES = [('RQ TYPE', PINK), ('DATA: WHICH RUNG?', BLUE), ('ANALYSIS', ORANGE)]
AX_Y = (1.75, 3.05, 4.35)
COL_W = 6.40
LAD_X, LAD_W = 7.40, R - 7.40


def axis_items(sl, answers=None):
    for i, ((lab, col), yy) in enumerate(zip(AXES, AX_Y)):
        dot(sl, M + 0.09, yy + 0.17, col, d=0.18)
        text(sl, M + 0.32, yy, COL_W - 0.32, 0.34, lab, size=15, bold=True, color=INK2,
             anchor='m', markup=False)
        if answers:
            text(sl, M + 0.32, yy + 0.42, COL_W - 0.32, 0.90, answers[i], size=24, ls=1.05,
                 balance='widow')
        else:
            hairline(sl, M + 0.32, yy + 0.95, M + COL_W, yy + 0.95, color='C8C8C8', w=2.0)


sl = blank(prs)
title(sl, 'Where does it sit? You place it.', w=8.5)
menti_chip(sl, x=R - chip_w('📊  Vote on Menti', 18), label='📊  Vote on Menti')
axis_items(sl)
text(sl, LAD_X, 1.25, LAD_W, 0.36, "SARAH'S DATA LADDER  ·  BEST EVIDENCE FIRST", size=13,
     bold=True, color=MUTED, anchor='m', markup=False)
ladder(sl, RUNGS, x=LAD_X, w=LAD_W)
notes(sl, [
    'H8 · DIAGRAM: the paper, 3 of 3 (you place it) · ~0:13',
    '',
    'Two Menti multiple-choice questions, 60 s total (menti_questions.md, Thu-2 and Thu-3):',
    '  Q1 "What type of research question is this study?" Reconnaissance (need-finding) / '
    'Formative / Evaluative. Correct: Reconnaissance.',
    '  Q2 "Which rungs of Sarah\'s data ladder?" SO: 1 · Survey: 2 / SO: 2 · Survey: 4 / '
    'SO: 2 · Survey: 3 / SO: 4 · Survey: 4. Correct: SO: 2 · Survey: 4.',
    'Everyone votes individually. Reveal on H9 only after BOTH votes close. NEVER CUT this vote.',
    '',
    'WRONG-ANSWER PLAN:',
    '- "evaluative": "Which tool or intervention is being evaluated?"',
    '- "formative": "Which design is this feeding?"',
    '- Stack Overflow data on rung 1: "Did anyone watch a developer use git?"',
    '- Survey on rung 3: "What trick did they use to avoid introspection?"',
])

sl = blank(prs)
title(sl, 'Where it sits')
axis_items(sl, ['Reconnaissance: what goes wrong?', 'Traces in the wild + self-report',
                'Counts, means, rankings, coded comments'])
text(sl, LAD_X, 1.25, LAD_W, 0.36, "SARAH'S DATA LADDER  ·  BEST EVIDENCE FIRST", size=13,
     bold=True, color=MUTED, anchor='m', markup=False)
lad = ladder(sl, RUNGS, x=LAD_X, w=LAD_W)
for ri, (pt, pf, pc, pl) in {1: ('Stack Overflow', BLUE, INK, None),
                             3: ('Survey', WHITE, INK2, 'BBBBBB')}.items():
    pw = chip_w(pt, 14)
    chip(sl, R - pw - 0.16, lad[ri]['cy'] - 0.20, pw, 0.40, pt, fill=pf, color=pc, size=14,
         line=pl, lw=1.25)
pause_bar(sl, 'Pairs, 90 s: how would you **observe** “knows how to use Git”?')
notes(sl, [
    'H9 · DIAGRAM: where it sits (reveal) · ~0:15',
    '',
    'Show the two vote results next to this slide.',
    'RQ: reconnaissance (need-finding: "what goes wrong?"). Data: Stack Overflow = traces in the '
    'wild (rung 2, good); survey = self-report (rung 4, Sarah: "consider rejecting"). '
    'Analysis: counts, means, rankings, and 65 comments "further categorized" with no named '
    'method.',
    '',
    'SAY: "Rung 2 is good, rung 4 is consider-rejecting. Predict which half takes more heat."',
    '',
    'PAUSE (pairs, 90 s), on screen: "How would you observe \'knows how to use Git\'?" Say it in '
    'full: what would you need to OBSERVE to know someone "knows how to use" a command? '
    'Good answers: a task with a goal (e.g., recover a lost commit), success rate, '
    'time to success, errors, recordings of real sessions. None of that is in this paper.',
])

# ---------------------------------------------------------------- H10 ACTIVITY slip
# Same skeleton as H13/H19 (title at 1.30, steps right under it) instead of task(), whose
# fixed 2.25 in title box left a 1.3 in hole under a one-line title.
sl = blank(prs, LAVENDER)
lav_header(sl, 'SOLO', 2)
text(sl, M, 1.30, CW, 0.80, "One slip. Face down. Don't compare.", size=44, bold=True,
     anchor='m')
yb = numbered(sl, M, 2.45, CW, ['Flip your slip', 'Answer it in one sentence',
                                'Circle your Git level. Fold. Pass it in.'], size=28, gap=0.10)
# the paper's 5-level scale, printed on both slip versions
LEVELS = ['Novice', 'Advanced beginner', 'Competent', 'Proficient', 'Expert']
sy_ = yb + 0.70
text(sl, M, sy_, CW, 0.34, 'THE SCALE ON EVERY SLIP  ·  FROM THE PAPER', size=13, bold=True,
     color=MUTED, anchor='m', markup=False)
xx = M
for lv in LEVELS:
    cw = chip_w(lv, 20, bold=False, pad=0.26)
    chip(sl, xx, sy_ + 0.48, cw, 0.56, lv, fill=WHITE, color=INK2, size=20, bold=False,
         line='C8C8C8', lw=1.25)
    xx += cw + 0.20
notes(sl, [
    'H10 · ACTIVITY (slip experiment) · 0:17 (H10–H12 = 5 min)',
    '',
    'SETUP: 16 slips, shuffled into ONE stack and dealt at random.',
    'Half say A: "In one sentence: what does `git rebase --onto main A B` do?"',
    'Half say B: "In one sentence: what does `git add` do?"',
    'Both then show the paper\'s exact scale: Novice · Advanced beginner · Competent · '
    'Proficient · Expert.',
    '',
    'Say NOTHING about the two versions yet. Face down, no comparing.',
    'Collect the folded slips into two piles (A / B) without reading them aloud.',
])

# ---------------------------------------------------------------- H11 STATEMENT prediction
sl = blank(prs)
text(sl, M, 1.60, CW, 0.50, 'Our prediction, written before we look', size=24, color=INK2,
     align='c', anchor='m')
text(sl, M, 2.40, CW, 1.75, 'Hard question first → lower median rating.', size=44, bold=True,
     align='c', anchor='m', ls=1.08, balance=True)
text(sl, M, 4.40, CW, 0.55, 'If the medians tie or flip, we were wrong.', size=24, color=MUTED,
     align='c', anchor='m')
notes(sl, [
    'H11 · STATEMENT (prediction) · ~0:19',
    '',
    'Shubham reveals the two slip versions (A = rebase --onto first, B = git add first) and '
    'writes the prediction on the board BEFORE the tally.',
    'Ananya tallies on the board: two rows of dots (A: rebase first / B: add first) × the five '
    'levels. 60 seconds.',
    '',
    'The prediction is falsifiable on purpose: if the medians tie or flip, we were wrong, and '
    'we will say so.',
])

# ---------------------------------------------------------------- H12 TALK result
sl = blank(prs)
title(sl, 'Same room, same week, different question first.')
tag_pill(sl, M, 1.62, 'PAPER', fill=BAR_GREY, color=INK2, w=1.15)
text(sl, M + 1.40, 1.50, CW - 1.40, 0.60,
     '92 respondents (median 8 yrs of Git): **14.1%** rated Proficient+', size=24, anchor='m')
tag_pill(sl, M, 2.62, 'US', fill=INK, color=WHITE, w=1.15)
tiles = [('A', 'rebase', 'question first'), ('B', 'add', 'question first')]
tx0, tw_, tgap, ty, th_ = M + 1.40, 4.97, 0.30, 2.50, 3.05
for i, (lt, cmd, rest) in enumerate(tiles):
    x = tx0 + i * (tw_ + tgap)
    box(sl, x, ty, tw_, th_, fill=WHITE, line=PANEL_LINE, lw=1.25, radius=0.14)
    text(sl, x + 0.30, ty + 0.22, tw_ - 0.6, 0.45,
         [[(f'{lt}  ·  ', {'bold': True}), (cmd, {'font': MONO, 'color': PURPLE, 'bold': True}),
           (f' {rest}', {})]], size=22, anchor='m', markup=False)
    text(sl, x + 0.30, ty + 0.85, tw_ - 0.6, 0.40, 'MEDIAN SELF-RATING', size=13, bold=True,
         color=MUTED, align='c', anchor='m', markup=False)
    text(sl, x + 0.30, ty + 1.30, tw_ - 0.6, 0.95, '__', size=48, bold=True, align='c',
         anchor='m', markup=False)
    text(sl, x + 0.30, ty + th_ - 0.62, tw_ - 0.6, 0.40, 'n ≈ 6', size=18, color=MUTED,
         align='c', anchor='m', markup=False)
pause_bar(sl, 'n ≈ 6 per group: what would it take for you to believe this?')
notes(sl, [
    'H12 · TALK (result) · ~0:20–0:22',
    '',
    'Type the two medians from the board into the "__" boxes (A = rebase first, B = add first). '
    'Use the median, not the mean: it is an ordinal scale.',
    'Whatever happened, say what we can and can\'t conclude. Don\'t explain away a miss.',
    'Guardrail: our slip test is a weak study. Never call its result a finding.',
    '',
    'The hypothesis is Sarah\'s point: preferences and self-ratings can be constructed on the '
    'spot (Loftus, "smashed vs hit"). Our room is a weak test of it: tiny n, one question per '
    'group, random assignment but no replication.',
    '',
    'PAUSE: n ≈ 6 per group, what would it take for you to believe this?',
    'Expected answers: a bigger sample, replication, the analysis fixed in advance (we did write '
    'the prediction), and a performance measure. We could score the one-sentence answers; RQ5 '
    'has no performance measure at all.',
    '',
    'LINK: the paper uses exactly this rating to conclude that "even experienced developers still '
    'have doubts" (p.19). The 14.1% is of all 92 respondents; the median of 8 years also '
    'describes all 92 (not the 14.1%).',
    'If asked: `git rebase --onto main A B` replays the commits after A, up to B, onto main as '
    'new commits.',
    '',
    'SAY: "That\'s one claim. Let\'s put three more on trial."',
    '',
    'Wrong-answer plan: "Average the ratings" -> "It\'s ordinal. Why is the median safer?" '
    '"The groups differ because of who got which slip" -> "That\'s why we dealt at random. What '
    'else could still differ?" Prediction failed -> "We were wrong, or n was too small to tell. '
    'Both are honest. Explaining it away is not."',
])

# ---------------------------------------------------------------- H13 ACTIVITY Claim Court
sl = blank(prs, LAVENDER)
lav_header(sl, 'TEAMS', 10)
text(sl, M, 1.30, CW, 0.80, 'Claim Court', size=44, bold=True, anchor='m')
text(sl, M, 2.12, CW, 0.50, 'One headline claim per court. On the claim card:', size=26,
     color=INK2, anchor='m')
numbered(sl, M, 2.90, CW, ['What did they actually measure?', 'One other explanation',
                           'Verdict: **BELIEVE · WEAKER (write it) · OBJECTION**'],
         size=28, gap=0.10)
text(sl, M, 4.85, CW, 0.45, 'Minute 5: write your “Measured:” line on the board.', size=20,
     color=INK2, anchor='m')
for i, (nm, ax, col) in enumerate([('Pink', 'Research question', PINK), ('Blue', 'Data', BLUE),
                                   ('Orange', 'Analysis', ORANGE)]):
    x = (0.75, 4.78, 8.80)[i]
    chip(sl, x, 5.72, 3.78, 0.62, f'{nm}  ·  {ax}', fill=col, color=INK, size=18, radius=0.12)
notes(sl, [
    'H13 · ACTIVITY (Claim Court) · 0:22 (2 min rules + 10 min work)',
    '',
    'Hand out the packets (spec 7.1): the starred claim, one backup claim from another axis, '
    'table excerpts, and all three of Sarah\'s axis checklists on the back.',
    '  Pink (Lab 1): P1★ + backup B2.  Blue (Lab 2): B1★ + backup O2.  Orange (Lab 3): O1★ + '
    'backup P3.',
    'Each court may swap its backup for the most-shared student sticky in its axis.',
    '',
    'BOARD CHECK, MINUTE 5: each court writes its starred claim\'s "Measured:" line on the '
    'board. A facilitator corrects it within 30 s, before verdicts are built on a misreading:',
    '  P1: SO registration years of askers.',
    '  B1: share of 197 checkmarks in a multi-select question, from 92 respondents recruited '
    'among SO Git askers.',
    '  O1: mean views of questions containing the command anywhere (title, body, or accepted '
    'answer), for commands with ≥200 questions.',
    '',
    'RULE: a "weaker version" must be a sentence the data literally supports.',
    'The presentation script on the packet back adds: one thing they did right, with a page.',
    '',
    'Roles: Shubham floats with Orange; Ananya keeps time and floats between Pink and Blue.',
    'Wrong-answer plan: court believes P1 -> "Five years of WHAT?" (p.12). Court rejects '
    'everything -> enforce the weaker-version box and the did-right line. Nitpicks -> "Does it '
    'change the conclusion?" Orange misses A2 -> "Can a question with no accepted answer enter '
    'reflog\'s pile through the answer?" Blue misses D1 -> "Who exactly got the email?"',
])

# ---------------------------------------------------------------- H14 ACTIVITY + MENTI
sl = blank(prs, LAVENDER)
lav_header(sl, menti_label='📊  Live poll')
text(sl, M, 1.22, CW, 0.75, 'Court is in session', size=44, bold=True, anchor='m')
text(sl, M, 2.02, CW, 0.50, 'Jury: how much do you believe it? 1–5 → Menti', size=24,
     color=INK2, anchor='m')
quotes = [
    ('PINK COURT', PINK, '“even developers with years of development experience can have '
                         'trouble using Git commands”', 'p.13'),
    ('BLUE COURT', BLUE, '“self-learning is the primary way for developers to learn to use Git '
                         'commands”', 'p.20'),
    ('ORANGE COURT', ORANGE, '“Git commands … about recovery are among the most popular '
                             'commands asked on Stack Overflow”', 'p.15'),
]
for i, (court, col, q, pg) in enumerate(quotes):
    x = (0.75, 4.78, 8.80)[i]
    quote_card2(sl, x, 2.70, 3.78, 3.95, court, q, pg, col, size=22)
notes(sl, [
    'H14 · ACTIVITY + MENTI (court in session) · 0:34 (11 min)',
    '',
    'Menti "Scales" question, 1 = don\'t believe, 5 = fully believe, one statement per court '
    '(the three quotes on the slide). Everyone votes: 1 minute.',
    'Then each court gets 3 minutes: verdict -> the measured-vs-claimed gap -> the weaker '
    'version -> one thing done right (with a page).',
    'Then the duplicate "after" scales question: re-vote and show the shift next to "before".',
    '',
    'Expected: Pink and Blue drop, Orange mostly survives (the recovery signal holds across views, '
    'favourites and score).',
    'SAY: "Critique = calibrating belief, not rejecting everything."',
    '',
    'If late: courts present only their starred claim, 2 minutes each.',
])

# ---------------------------------------------------------------- H15 TALK claimed vs measured
compare(
    prs, 'Claimed vs measured', ('They said', 'They measured'), [
        ('"difficult"', '% with no accepted answer (n can be 1)'),
        ('"experienced"', 'years since joining Stack Overflow'),
        ('"how developers learn"', 'multi-select picks from 92 recent SO askers'),
        ('"popular"', 'mean views, credited to every command in the post')],
    bottom="80,370 rows can't fix a weak proxy.", pitch=0.84,
    notes=[
        'H15 · TALK (claimed vs measured) · 0:45 (3 min)',
        '',
        'Credit BY NAME any student whose sticky claim was used in court.',
        '',
        'Fill in anything the courts missed, especially A2: a question with no accepted answer can '
        'only enter a command\'s pile through its own text, so commands that appear in error '
        'reports (clone, push, pull) look hard.',
        'Also available: R2 (the experience threshold drifts between "four years" and "five '
        'years"), A3 (RQ3 filters ≥200 questions, RQ4 ranks n = 1 and n = 3 first), A6 (65 '
        'comments "further categorized", no named method: "vibes are not an answer"), D1 (survey '
        'samples on the outcome: recent SO Git askers).',
        'Facilitator-only claims to raise here or on H16: P2 (the title asks about knowing; the '
        'data measures asking), B3 (circular non-response argument; emails obtained against '
        'GitHub policy, no ethics review mentioned; 92/508 = 18.1% vs the reported 18.5%), O3 '
        '(3.24 h is an average of per-command medians over the 30 least-answered commands, '
        'compared with a 2011 SO-wide 21-minute median).',
        '',
        'Credit what\'s good: real traces at scale, baselines against all of SO, public data, '
        'the 600-question validation with kappa.',
    ])

# ---------------------------------------------------------------- H16 DIVIDER question
divider(prs, 'Is the research question even interesting?', PINK,
        sub='They counted commands. People have goals.',
        notes=[
            'H16 · DIVIDER used as a question · 0:48 (4 min, whole class)',
            '',
            'Prompts:',
            '- "Would a tool designer rather know which strings appear, or what people were '
            'trying to do?"',
            '- Only 17% of questions involve a single command (Fig. 3, p.15).',
            '- The authors explicitly decline to engage with design: "Rather than changing the '
            'design of Git…" (p.26). Yet they cite De Rosso & Jackson.',
            '- "Re-run this in 2026: where would the traces even be?" (The data ends in 2020; many '
            'questions now go to AI assistants.)',
            '',
            'Facilitator-only claims P2, B3, O3 (spec 7.1) can be raised here.',
            'If late: cut this discussion to 2 minutes.',
        ])

# ---------------------------------------------------------------- H17 BREAK
break_slide(prs, 4, notes=[
    'H17 · BREAK · 0:52 (4 min)',
    '',
    'Fill in "Back at" before class or live.',
    'While they\'re out: put one face-down finding card on each table (RECOVERY, COMBOS, '
    'SELF-TAUGHT; keep the BONUS: HISTORY card for a fast team).',
    'If running late, skip the break first (+4 min).',
])

# ---------------------------------------------------------------- H18 DIAGRAM two halves
sl = blank(prs)
title(sl, 'Git listened (sometimes).')
HX = 5.70                                   # hairline (moved left so the real output fits)
LZ = (M, HX - 0.30)
lcx = (LZ[0] + LZ[1]) / 2
TX = HX + 0.24
hairline(sl, HX, 1.45, HX, 5.62)
text(sl, M, 1.40, LZ[1] - M, 0.40, 'Split the verb  ·  Git 2.23 (2019)', size=20, bold=True,
     anchor='m')
text(sl, TX, 1.40, R - TX, 0.40, 'Make you choose  ·  Git 2.34, Tuesday', size=20, bold=True,
     anchor='m')
cb = box(sl, lcx - 1.45, 2.05, 2.90, 0.74, fill=BAR_GREY, line=PANEL_LINE, lw=1, radius=0.10)
label(cb, 'git checkout', size=24, bold=True, color=INK2, font=MONO, markup=False)
bw_, bh_, by_ = 2.20, 1.00, 3.40
for k, (verb, arg) in enumerate((('git switch', '<branch>'), ('git restore', '<file>'))):
    bx_ = LZ[0] + k * (LZ[1] - LZ[0] - bw_)
    arrow(sl, lcx + (-0.35 if k == 0 else 0.35), 2.84, bx_ + bw_ / 2, by_ - 0.06, color=INK2,
          w=2.0)
    pb = box(sl, bx_, by_, bw_, bh_, fill=PURPLE, radius=0.10)
    # 20 pt + thin side insets: 'git restore' = 1.83 in in a 2.12 in frame (was 2.02 in 2.00)
    pb.text_frame.margin_left = pb.text_frame.margin_right = Inches(0.04)
    label(pb, [[(verb, {'size': 20, 'bold': True})], [(arg, {'size': 18, 'bold': False})]],
          size=20, color=WHITE, font=MONO, markup=False, ls=1.05)
text(sl, M, 4.68, LZ[1] - M, 0.90,
     [[('Their own quote: ', {'italic': False, 'color': INK2}),
       ('“What exactly does git checkout [file] do?”', {}), (' (p.13)', {'color': MUTED,
                                                                         'italic': False})]],
     size=20, italic=True, ls=1.08, markup=False, balance='widow')
term_panel(sl, TX, 1.95, R - TX, 3.40, [        # 18 pt mono: <= 40 columns per line
    ('cmd', 'git pull'),
    'hint: You have divergent branches and',
    'need to specify how to reconcile them.',
    ('hi', 'git config pull.rebase false  # merge'),
    ('hi', 'git config pull.rebase true   # rebase'),
    ('hi', 'git config pull.ff only       # ff only'),
    ('err', 'fatal: Need to specify how to'),
    ('err', 'reconcile divergent branches.'),
], size=18)
pause_bar(sl, 'Which fix is better design, and what study would tell you?')
notes(sl, [
    'H18 · DIAGRAM (two halves) · 0:56 (3 min, talk + pause)',
    '',
    'LEFT: one verb used to do three jobs (switch branches, restore files, detach HEAD). Git 2.23 '
    '(2019) split it by USER INTENT: git switch <branch>, git restore <file>. checkout still '
    'works (it was not removed). The paper\'s own example question: "What exactly does git '
    'checkout [file] do?" (p.13).',
    '',
    'RIGHT: real output of git pull on divergent branches (verified on git 2.34.1; hint lines '
    'trimmed and re-wrapped at 40 columns, comment "fast-forward only" shortened to "ff only"). '
    'Tuesday\'s Step-6 rehearsal needed '
    '--no-rebase because of it. Git now refuses to guess and makes you pick a policy.',
    '',
    'Contrasting case: Jujutsu (jj) logs every operation, and `jj undo` reverses the last one: '
    'recovery as a first-class feature.',
    '',
    'PAUSE (on screen): "Which fix is better design, and what study would tell you?" Frame it: '
    'one fix splits the verb, the other makes you pick a config option.',
    'Good answers to "what study": a lab task with logged time-to-success or error rate, '
    'not "do you like it?".',
])

# ---------------------------------------------------------------- H19 ACTIVITY design sprint
sl = blank(prs, LAVENDER)
lav_header(sl, 'TEAMS', 7)
text(sl, M, 1.30, CW, 0.80, 'Design sprint: fix one finding', size=44, bold=True, anchor='m')
COLW = 6.85
text(sl, M, 2.18, COLW, 0.82, 'Flip your finding card. One index card. Each person owns one '
     'line and initials it:', size=22, color=INK2, ls=1.08, balance='widow')
yb = numbered(sl, M, 3.15, COLW, ['Sketch what the user sees', 'It fixes ___ because ___',
                                  'Does ___ reduce ___ for ___ doing ___?',
                                  "How you'd measure it (logged or observed)"],
              size=24, gap=0.09)
text(sl, M, max(yb + 0.18, 5.95), CW, 0.42,
     '60-second pitch  ·  next team asks one Reviewer-2 question', size=20, color=INK2,
     anchor='m')
fcx0, fcy0, fdx = 10.24, 4.00, 1.52
fan_card(sl, fcx0 - fdx, fcy0 + 0.10, -6, 'undo', 'RECOVERY')
fan_card(sl, fcx0, fcy0, 0, 'chain', 'COMBOS')
fan_card(sl, fcx0 + fdx, fcy0 + 0.10, 6, 'book', 'SELF-TAUGHT')
notes(sl, [
    'H19 · ACTIVITY (design sprint) · 0:59 (7 min build + 5 min pitches)',
    '',
    'Finding cards (spec 7.2), one face-down per table:',
    '  RECOVERY: 4 of the top 5 commands by views are about going back (Table 4). Prompt: '
    '"Design a way back."',
    '  COMBOS: only 17% of questions involve one command; 5-command combinations are the most '
    'common (22%) (Fig. 3). Prompt: "People have goals; Git has commands. Design for the goal."',
    '  SELF-TAUGHT: 85/92 learned from the internet, 76/92 from docs, 8/92 in a class (Table 7). '
    'Prompt: "The tool is the teacher. Design the teaching moment."',
    '  BONUS (fast teams): HISTORY: rebase, squash, and force-push can destroy history others '
    'need (Just et al., abstract; no numbers). Prompt: "Make destruction deliberate."',
    '',
    'Line 3 is Sarah\'s evaluative-RQ template; line 4 forces them up the data ladder.',
    'Pitch order: Pink, Blue, Orange. 60 s each; the next team asks one Reviewer-2 question.',
    '',
    'Wrong-answer plan: "Better docs" -> "Where is the user at that moment?" (in the terminal, '
    'mid-mistake). A self-report measure -> "That\'s rung 4. What could you log or observe?" '
    '(e.g., time to recover a lost commit in a lab task). "An AI chatbot" -> allowed, but show '
    'what the user sees and how you\'d know it helped.',
    'If late: pitches limited to 45 seconds.',
])

# ---------------------------------------------------------------- H20 MENTI exit
sl = blank(prs)
menti_chip(sl)
timer_chip(sl, 3)
q = [[('On your own:', {'size': 26, 'bold': False, 'color': INK2})],
     [('Finding (with evidence) →', {})],
     [('I’d change the tool so that ___ →', {})],
     [('I’d know it worked if ___', {})],
     [('(logged or observed, not self-report)', {'size': 24, 'bold': False, 'color': INK2})]]
text(sl, M, 1.40, 8.30, 4.20, q, size=36, bold=True, anchor='m', ls=1.10, gap=6,
     markup=False)
if os.path.exists(MENTI_QR):
    sl.shapes.add_picture(MENTI_QR, Inches(9.333), Inches(1.40), Inches(3.25), Inches(3.25))
else:
    bq = box(sl, 9.333, 1.40, 3.25, 3.25, fill=WHITE, line='BBBBBB', lw=2, dash=True,
             radius=0.12)
    label(bq, 'QR', size=24, bold=True, color=MUTED)
chip(sl, 9.333, 4.85, 3.25, 0.60, f'menti.com  ·  {MENTI_CODE}', size=18)
notes(sl, [
    'H20 · MENTI (exit, individual) · 1:11 (4 min) · NEVER CUT',
    '',
    'BEFORE CLASS: same Menti QR and access code as H2 (MENTI_CODE / MENTI_QR in '
    'build_thursday.py).',
    '',
    'Menti OPEN-ENDED, 3 minutes, individual, BEFORE H21 (results shown only after writing time).',
    'Exact text: "On your own: Finding (with evidence) → I\'d change the tool so that ___ → I\'d '
    'know it worked if ___ (logged or observed, not self-report)."',
    'Read 3–4 answers aloud.',
    '',
    'A good answer names a finding with evidence, makes a concrete change, and gives a measure '
    'you could log or observe.',
    'An answer that is only critique: "…so a tool designer should what?"',
    'FOLLOW-UP: any answer missing a finding or using a self-report measure gets "so a tool '
    'designer should what, and how would you know?" in the post-class Ed message.',
])

# ---------------------------------------------------------------- H21 CONTENT ours
sl = blank(prs)
title(sl, 'Ours, for comparison')
lessons = [('undo', 'Make the way back visible.'), ('split', 'One verb, one purpose.'),
           ('card', 'Show the model, not the commands.'),
           ('term', 'The error message is the manual.'),
           ('stop', 'Make destruction deliberate.')]
ly0, lp = 1.80, 0.96
for i, (ic, t) in enumerate(lessons):
    yy = ly0 + i * lp
    draw_icon(sl, ic, M + 0.32, yy + 0.33 + (0.03 if ic == 'undo' else 0), size=0.56,
              color=INK)
    text(sl, M + 1.05, yy, CW - 1.05, 0.66, t, size=32, anchor='m')
notes(sl, [
    'H21 · CONTENT (ours, for comparison) · 1:15 (2 min)',
    '',
    'Evidence -> example for each line:',
    '- WAY BACK: recovery tops the views; reflog is invisible until disaster -> jj undo, GitHub '
    'Desktop "Undo".',
    '- ONE VERB: the checkout overload -> switch / restore.',
    '- MODEL: respondent #26: "hard to do without understanding the basic concepts" (p.21) -> '
    'Tuesday\'s cards, flags, and wall.',
    '- ERROR MESSAGE: respondent #42: "Years on, I still constantly have to search the internet" '
    '(p.21) -> Git\'s hint: lines on a rejected push, help.autocorrect.',
    '- DESTRUCTION: Tuesday\'s paper (Just et al.) -> --force-with-lease, protected branches.',
    '',
    'For builders: measure struggle, not popularity.',
    'ASK: "Whose exit answer is NOT on our list? That\'s the new insight."',
])

# ---------------------------------------------------------------- H22 STARRY
starry(prs, 'Question the proxy.\nDesign the way back.', notes=[
    'H22 · STARRY · 1:17 (1 min)',
    '',
    'SAY: "First half: the reader\'s lesson. Second half: the builder\'s lesson. Undo is where '
    'humans and Git collide."',
    '',
    '1:18–1:20 buffer.',
])


# =============================================================== save + render
if __name__ == '__main__':
    save(prs, OUT)
    print(len(prs.slides), 'slides ->', OUT)
    if '_' in MENTI_CODE or not os.path.exists(MENTI_QR):
        print('REMINDER: Menti QR / access code still placeholders on H2 and H20 '
              f'(set MENTI_CODE, save the QR to {MENTI_QR}, rebuild).')
    if '--no-render' not in sys.argv:
        os.makedirs(REN, exist_ok=True)
        for f in glob.glob(os.path.join(REN, '*.png')):
            os.remove(f)
        pngs = render(OUT, REN, 'h', profile='lo_thursday')
        print(len(pngs), 'PNGs ->', REN)
