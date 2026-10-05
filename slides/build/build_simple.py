#!/usr/bin/env python3
"""Thursday deck + shared minimal slide helpers (used by build_app_slides.py): one idea per slide, huge type, lots of white space.

Builds:
  slides/thursday_simple.pptx  (The Humans, User Study Day)
Run:  python3 build_simple.py
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

FONT, MONO = 'Inter', 'Noto Sans Mono'
INK = RGBColor(0x11, 0x11, 0x11)
MUTED = RGBColor(0x70, 0x70, 0x78)
PURPLE = RGBColor(0x8B, 0x3D, 0xFF)
LAVENDER = RGBColor(0xF4, 0xEC, 0xFB)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x16, 0xA3, 0x4A)
RED = RGBColor(0xDC, 0x26, 0x26)
LINE = RGBColor(0xD9, 0xD9, 0xDE)
NAVY = RGBColor(0x0B, 0x16, 0x30)
YELLOW = RGBColor(0xFF, 0xE0, 0x66)

W, H = Inches(13.333), Inches(7.5)
M = Inches(0.9)  # side margin


def new_deck():
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H
    return prs


def blank(prs, bg=WHITE, notes=''):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = bg
    if notes:
        s.notes_slide.notes_text_frame.text = notes
    return s


def text(s, x, y, w, h, lines, size=32, color=INK, bold=False, font=FONT,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=1.1):
    """lines: str or list of str | (str, dict-of-overrides)."""
    tb = s.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.vertical_anchor = anchor
    for side in ('margin_left', 'margin_right', 'margin_top', 'margin_bottom'):
        setattr(tf, side, 0)
    if isinstance(lines, str):
        lines = [lines]
    for i, ln in enumerate(lines):
        opts = {}
        if isinstance(ln, tuple):
            ln, opts = ln
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        r = p.add_run()
        r.text = ln
        f = r.font
        f.name = opts.get('font', font)
        f.size = Pt(opts.get('size', size))
        f.bold = opts.get('bold', bold)
        f.color.rgb = opts.get('color', color)
    return tb


def box(s, x, y, w, h, fill=WHITE, line=None, radius=0.12, dash=False, lw=1.5):
    shp = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    shp.adjustments[0] = radius
    shp.shadow.inherit = False
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(lw)
        if dash:
            from pptx.enum.dml import MSO_LINE_DASH_STYLE
            shp.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    shp.text_frame.text = ''
    return shp


def chip(s, x, y, label, fill=INK, color=WHITE, size=18, w=None):
    w = w or Inches(0.45 + 0.17 * len(label))
    c = box(s, x, y, w, Inches(0.5), fill=fill, radius=0.5)
    tf = c.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label
    r.font.name, r.font.size, r.font.bold = FONT, Pt(size), True
    r.font.color.rgb = color
    return c


# ---------------------------------------------------------------- layouts
def title_slide(prs, title, sub, foot, notes):
    s = blank(prs, notes=notes)
    text(s, M, Inches(2.2), W - 2 * M, Inches(1.4), title, size=64, bold=True,
         anchor=MSO_ANCHOR.BOTTOM)
    text(s, M, Inches(3.85), W - 2 * M, Inches(1.2), sub, size=26 if len(sub) > 40 else 32,
         color=MUTED)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, H - Inches(0.6), W, Inches(0.6))
    bar.fill.solid(); bar.fill.fore_color.rgb = PURPLE; bar.line.fill.background()
    text(s, M, H - Inches(0.6), W - 2 * M, Inches(0.6), foot, size=18, color=WHITE,
         anchor=MSO_ANCHOR.MIDDLE)
    return s


def task_slide(prs, step, timer, line1, line2, notes):
    """Lavender: what to do. One big line + one small line."""
    s = blank(prs, LAVENDER, notes)
    chip(s, M, Inches(0.7), step)
    chip(s, W - M - Inches(1.6), Inches(0.7), '⏱ ' + timer, fill=WHITE, color=INK,
         w=Inches(1.6))
    text(s, M, Inches(2.4), W - 2 * M, Inches(2.2), line1, size=60, bold=True,
         anchor=MSO_ANCHOR.BOTTOM)
    if line2:
        text(s, M, Inches(4.8), W - 2 * M, Inches(1.2), line2, size=32, color=MUTED)
    return s


def big_slide(prs, lines, notes, bg=WHITE, color=INK, size=60, kicker=None,
              kcolor=MUTED):
    s = blank(prs, bg, notes)
    if kicker:
        text(s, M, Inches(1.6), W - 2 * M, Inches(0.6), kicker, size=30, color=kcolor)
    text(s, M, Inches(2.3), W - 2 * M, Inches(3.6), lines, size=size, bold=True,
         color=color, spacing=1.15)
    return s


def list_slide(prs, title, items, notes, num=True):
    s = blank(prs, notes=notes)
    text(s, M, Inches(0.9), W - 2 * M, Inches(1.0), title, size=48, bold=True)
    y = Inches(2.5)
    for i, it in enumerate(items, 1):
        if num:
            text(s, M, y, Inches(0.8), Inches(0.8), str(i), size=40, bold=True,
                 color=PURPLE)
        text(s, M + (Inches(0.8) if num else 0), y, W - 2 * M - Inches(0.8),
             Inches(0.9), it, size=40)
        y += Inches(1.25)
    return s


def menti_slide(prs, question, options, notes, kicker='Live poll', sub=None):
    s = blank(prs, notes=notes)
    chip(s, M, Inches(0.7), '📊 ' + kicker, fill=PURPLE)
    text(s, M, Inches(1.8), Inches(8.6), Inches(2.4), question, size=52, bold=True,
         anchor=MSO_ANCHOR.TOP)
    if sub:
        text(s, M, Inches(4.4), Inches(8.6), Inches(0.8), sub, size=30, color=MUTED)
    if options:
        x, y = M, Inches(5.0)
        for o in options:
            wch = Inches(0.6 + 0.2 * len(o))
            c = box(s, x, y, wch, Inches(0.75), fill=WHITE, line=LINE, radius=0.3)
            tf = c.text_frame
            tf.vertical_anchor = MSO_ANCHOR.MIDDLE
            p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
            r = p.add_run(); r.text = o
            r.font.name, r.font.size, r.font.color.rgb = MONO, Pt(26), INK
            x += wch + Inches(0.25)
    # code + QR placeholder
    qx = W - M - Inches(2.6)
    box(s, qx, Inches(1.8), Inches(2.6), Inches(2.6), fill=WHITE, line=LINE, dash=True)
    text(s, qx, Inches(1.8), Inches(2.6), Inches(2.6), 'QR', size=24, color=MUTED,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    chip(s, qx, Inches(4.6), 'menti.com · ____', fill=INK, w=Inches(2.6))
    return s


def break_slide(prs, minutes, notes):
    s = blank(prs, YELLOW, notes)
    text(s, M, Inches(2.4), W - 2 * M, Inches(1.4), f'☕  {minutes}-minute break',
         size=66, bold=True, align=PP_ALIGN.CENTER)
    text(s, M, Inches(4.0), W - 2 * M, Inches(0.8), 'Back at __:__', size=32,
         color=INK, align=PP_ALIGN.CENTER)
    return s


def final_slide(prs, lines, notes):
    s = blank(prs, NAVY, notes)
    # a few quiet stars
    for (x, y, d) in [(1.2, 0.8, .05), (3.4, 1.6, .04), (5.9, .6, .06), (8.3, 1.3, .04),
                      (10.6, .7, .05), (12.1, 1.9, .04), (2.2, 6.4, .04), (11.4, 6.1, .05),
                      (7.2, 6.7, .04), (0.7, 3.9, .03), (12.6, 4.2, .03)]:
        st = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
        st.fill.solid(); st.fill.fore_color.rgb = WHITE; st.line.fill.background()
    text(s, M, Inches(1.5), W - 2 * M, Inches(0.7), "If you remember one thing…", size=30,
         color=RGBColor(0xB8, 0xC0, 0xD8), align=PP_ALIGN.CENTER)
    text(s, M, Inches(2.5), W - 2 * M, Inches(3.5), lines, size=60, bold=True,
         color=WHITE, align=PP_ALIGN.CENTER, spacing=1.2)
    return s


# ================================================================= THURSDAY
def thursday():
    prs = new_deck()
    title_slide(prs, 'Git, Part 2: The Humans',
                'Yang et al., "Do Developers Really Know How to Use Git Commands?" TOSEM 2022',
                'CS294 · Git Week · Thursday · Shubham & Ananya',
                'Welcome. Same 3 teams as Tuesday.')

    menti_slide(prs, 'Guess: the #1 Git question on Stack Overflow?',
                ['merge', 'rebase', 'revert', 'push'],
                'Let everyone vote, then reveal.')
    big_slide(prs, ['#1 is git revert.', '4 of the top 5 are about going back.'],
              'Top 5 by average views: revert, reflog, stash, clean, reset. You felt this on '
              "Tuesday with the Intern's 🥸 card.", kicker='The answer')

    big_slide(prs, ['80,370 Stack Overflow questions.', '+ a survey of 92 developers.'],
              'They kept every git-tagged question that contains a real Git command. Then they '
              'surveyed 92 developers on how they learned Git.', kicker='The study')

    list_slide(prs, 'What they found',
               ['Going back is the #1 pain.', 'Even 5-year veterans ask.',
                'Most people learn Git alone.'],
               'Recovery commands get the most views. By 2020, 40% of askers had been on '
               'Stack Overflow 5+ years. 81.7% of survey picks were self-learning.')

    list_slide(prs, 'Three questions for any study',
               ['Is the question interesting?', 'Can the data answer it?',
                'Do we believe the answer?'],
               "Sarah's three axes: research question, data collection, analysis. Traces from "
               'real use (like Stack Overflow) beat self-report (like surveys).')

    task_slide(prs, 'TEAMS', '12 min', 'Claim Court.',
               'One claim per team. What did they really measure? Believe it?',
               'Team 1: "even experienced developers struggle". Team 2: "most developers learn '
               'Git alone". Team 3: "recovery commands are the most popular". Each team: '
               'what was actually measured, one other explanation, verdict.')
    menti_slide(prs, 'Do you believe it?  1–5', ['1', '2', '3', '4', '5'],
                'Each team presents in 2 minutes, then the room votes.',
                kicker='Jury vote')

    big_slide(prs, ['"Experienced" = years on Stack Overflow.',
                    '"Difficult" = no accepted answer.'],
              'The claims are bigger than the measurements. Experience was measured as account '
              'age. Difficulty rankings were topped by commands with 1 to 3 questions.',
              kicker='Claimed ≠ measured', size=48)

    break_slide(prs, 4, 'Lay out one finding card per team.')

    task_slide(prs, 'TEAMS', '7 min', 'Design sprint.',
               'Fix one finding. How would you know it worked?',
               'Each team picks one finding and sketches one tool change on a single card, '
               'plus how they would measure it (logged or observed, not a survey). '
               '1-minute pitch each.')
    big_slide(prs, ['git checkout', '→  git switch  +  git restore'],
              'Real example: in 2019 (Git 2.23) Git split checkout into two clearer commands, '
              'because one verb did too many things.', kicker='Git listened (2019)', size=56)

    menti_slide(prs, 'One lesson for designing programming tools?', [],
                'Everyone writes one sentence. Read a few aloud.', kicker='Exit')

    final_slide(prs, ['Question the proxy.', 'Design the way back.'],
                'Thanks. That is Git week.')
    return prs


if __name__ == '__main__':
    for name, fn in [('thursday_simple.pptx', thursday)]:
        p = os.path.join(OUT, name)
        fn().save(p)
        print('saved', p)
