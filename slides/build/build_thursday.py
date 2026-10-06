#!/usr/bin/env python3
"""Thursday deck: the record of The Humans (User Study Day), one slide per scene of the app.

Builds slides/thursday_app.pptx (16:9, Google Slides ready). All text comes from the app
(app/server/thursday_scenes.js, read through node), so the deck and the projector cannot drift apart.
Where the app shows the class's live results, the deck shows the paper's numbers and the model answers.
Activity slides are lavender, as in the course decks. Speaker notes: Say, Ask, Hope to hear.
Text is measured with the real fonts; the build stops if a slide would overflow.
Run:  python3 build_thursday.py
"""
import json
import os
import re
import subprocess

from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from build_simple import (FONT, MONO, INK, MUTED, PURPLE, LAVENDER, WHITE, GREEN, RED, LINE, NAVY,
                          W, H, M, OUT, new_deck, blank, text, box, chip, title_slide)
from build_app_slides import line_count, rule, flatten, SPACING, LEADING, WJ

APP = os.path.join(os.path.dirname(OUT), 'app')
CONTENT_W = W - 2 * M
LINE_W = int(CONTENT_W * 0.82)
BOTTOM = H - Inches(0.5)
GREY = RGBColor(0xB9, 0xB9, 0xC2)
SOFT = RGBColor(0xF6, 0xF6, 0xF8)

READ_APP = """
const t = await import('./server/thursday_scenes.js');
process.stdout.write(JSON.stringify({ scenes: t.SCENES, paper: t.PAPER, message: t.MESSAGE, survey: t.SURVEY,
  paperSurvey: t.PAPER_SURVEY, posts: t.POSTS, claims: t.CLAIMS, claimFields: t.CLAIM_FIELDS,
  designFields: t.DESIGN_FIELDS, minutes: t.TOTAL_MINUTES, buffer: t.BUFFER_MINUTES, labels: t.LABELS,
  comments: t.COMMENTS, categories: t.CATEGORIES, categoryCounts: t.CATEGORY_COUNTS }));
"""
LEARN_SHORT = ['In class', 'Online courses', 'Peers or seniors', 'Documentation', 'Internet', 'Other']


def read_app():
    out = subprocess.run(['node', '--input-type=module', '-e', READ_APP], cwd=APP, check=True,
                         capture_output=True, text=True).stdout
    return json.loads(out)


def plain(s):
    return re.sub(r'\*\*|`', '', s)


def runs(s):
    """(text, font, bold) runs: `code` in the mono font, **bold** bold."""
    out = []
    for i, chunk in enumerate(s.split('`')):
        if i % 2:
            out.append((chunk.replace('-', '-' + WJ), MONO, False))
            continue
        for j, part in enumerate(chunk.split('**')):
            if part:
                out.append((part, FONT, bool(j % 2)))
    return out


def height(s, size, width, bold=False):
    return Pt(line_count(s, size, width, bold) * size * LEADING)


def para(s, x, y, w, lines, size, color=INK, gap=Pt(8), bold=False, italic=False, align=PP_ALIGN.LEFT):
    """One text box, one paragraph per line, measured. Returns its height."""
    lines = [lines] if isinstance(lines, str) else lines
    h = sum(height(l, size, w, bold) for l in lines) + gap * (len(lines) - 1)
    tf = text(s, x, y, w, h, [''] * len(lines), size=size, spacing=SPACING).text_frame
    for k, (p, line) in enumerate(zip(tf.paragraphs, lines)):
        p.clear()
        p.alignment = align
        p.space_before = Pt(0) if k == 0 else gap
        for part, family, b in runs(line):
            r = p.add_run()
            r.text = part
            r.font.name, r.font.size, r.font.bold, r.font.italic = family, Pt(size), b or bold, italic
            r.font.color.rgb = color
    return h


def notes(scene, extra=''):
    lines = [f'Say: {plain(scene["say"])}']
    if scene.get('ask'):
        lines.append(f'Ask: {plain(scene["ask"])}')
    if scene.get('hope'):
        lines.append(f'Hope to hear: {plain(scene["hope"])}')
    if extra:
        lines.append(extra)
    return '\n\n'.join(lines)


def head(s, scene, activity=False):
    """The kicker (part), the title; on activity slides a minutes chip. Returns y below the title."""
    text(s, M, Inches(0.55), CONTENT_W, Inches(0.35), scene['part'].upper(), size=16, bold=True, color=PURPLE)
    if activity:
        chip(s, W - M - Inches(1.5), Inches(0.5), f'{scene["minutes"]} min', fill=WHITE, color=INK, size=16, w=Inches(1.5))
    title_w = CONTENT_W - (Inches(1.8) if activity else 0)
    h = para(s, M, Inches(0.95), title_w, scene['title'], 40, bold=True, gap=Pt(0))
    return Inches(0.95) + h + Inches(0.3)


def ask(s, scene, y):
    if not scene.get('ask'):
        return
    h = height(scene['ask'], 22, CONTENT_W)
    top = BOTTOM - h
    if top < y + Inches(0.15):
        raise SystemExit(f'Slide {scene["id"]} overflows: shorten it in app/server/thursday_scenes.js.')
    para(s, M, top, CONTENT_W, scene['ask'], 22, color=MUTED, italic=True)


def check(scene, y):
    if y > BOTTOM:
        raise SystemExit(f'Slide {scene["id"]} overflows: shorten it in app/server/thursday_scenes.js.')


def lines_block(s, scene, y, size=22, width=LINE_W):
    if not scene.get('lines'):
        return y
    return y + para(s, M, y, width, scene['lines'], size, gap=Pt(10)) + Inches(0.25)


def table(s, y, rows, widths, size=17, header=False, first_bold=True, center=False, pad=Inches(0.1)):
    """Rows of cells with a hairline above each row (the projector's .t-table)."""
    for k, row in enumerate(rows):
        is_head = header and k == 0
        cs = 12 if is_head else size
        hs = [height(c or ' ', cs, w - 2 * pad, bold=is_head or (first_bold and i == 0)) for i, (c, w) in enumerate(zip(row, widths))]
        rh = max(hs) + 2 * pad
        if not is_head:
            rule(s, M, y, sum(widths), Pt(0.75), LINE)
        x = M
        for i, (c, w) in enumerate(zip(row, widths)):
            bold = is_head or (first_bold and i == 0)
            color = MUTED if is_head else (PURPLE if center and i == 1 and not is_head else INK)
            align = PP_ALIGN.CENTER if center and i > 0 else PP_ALIGN.LEFT
            para(s, x + pad, y + pad, w - 2 * pad, c.upper() if is_head else c, cs, color=color, bold=bold or (center and i == 1), align=align)
            x += w
        y += rh
    return y


def options(s, y, opts, correct=None, compact=False):
    bh, size, top = (Inches(0.46), 17, Inches(0.09)) if compact else (Inches(0.62), 20, Inches(0.13))
    for i, o in enumerate(opts):
        right = i == correct
        box(s, M, y, CONTENT_W, bh, fill=WHITE, line=GREEN if right else LINE, lw=2 if right else 1)
        para(s, M + Inches(0.25), y + top, CONTENT_W - Inches(0.5), o + ('  ✓' if right else ''), size,
             color=GREEN if right else INK, bold=right)
        y += bh + Inches(0.1)
    return y


def card(s, x, y, w, h, parts, fill=WHITE, line=LINE):
    """A rounded card: parts = [(label or None, text, style)], style in {'quote', 'model', 'body'}."""
    box(s, x, y, w, h, fill=fill, line=line, radius=0.06)
    iy = y + Inches(0.15)
    iw = w - Inches(0.4)
    for label, body, style in parts:
        if style == 'model':
            bh = height(body, 14, iw - Inches(0.2)) + Inches(0.42)
            box(s, x + Inches(0.2), iy, iw, bh, fill=LAVENDER, radius=0.1)
            text(s, x + Inches(0.3), iy + Inches(0.06), iw, Inches(0.25), label.upper(), size=11, bold=True, color=PURPLE)
            para(s, x + Inches(0.3), iy + Inches(0.3), iw - Inches(0.2), body, 14)
            iy += bh + Inches(0.1)
            continue
        if label:
            text(s, x + Inches(0.2), iy, iw, Inches(0.22), label.upper(), size=11, bold=True, color=MUTED)
            iy += Inches(0.24)
        iy += para(s, x + Inches(0.2), iy, iw, body, 15 if style == 'quote' else 14, italic=style == 'quote') + Inches(0.1)
    return iy - y


def card_h(parts, w):
    iw = w - Inches(0.4)
    h = Inches(0.15)
    for label, body, style in parts:
        if style == 'model':
            h += height(body, 14, iw - Inches(0.2)) + Inches(0.52)
            continue
        h += (Inches(0.24) if label else 0) + height(body, 15 if style == 'quote' else 14, iw) + Inches(0.1)
    return h + Inches(0.1)


def cards(s, scene, y, all_parts, cols):
    gap = Inches(0.2)
    w = int((CONTENT_W - gap * (cols - 1)) / cols)
    rows = [all_parts[i:i + cols] for i in range(0, len(all_parts), cols)]
    for k, row in enumerate(rows):
        h = max(card_h(p, w) for p in row)
        for i, parts in enumerate(row):
            card(s, M + i * (w + gap), y, w, h, parts)
        y += h + (gap if k < len(rows) - 1 else 0)
    check(scene, y)
    return y


def bars(s, x, y, w, labels, values, total, title):
    text(s, x, y, w, Inches(0.3), title.upper(), size=12, bold=True, color=MUTED)
    y += Inches(0.4)
    lw, nw = Inches(2.1), Inches(0.7)
    bw = w - lw - nw - Inches(0.2)
    for label, v in zip(labels, values):
        para(s, x, y - Inches(0.02), lw, label, 15)
        box(s, x + lw, y + Inches(0.06), bw, Inches(0.2), fill=SOFT, radius=0.5)
        if v:
            box(s, x + lw, y + Inches(0.06), max(Inches(0.2), int(bw * v / total)), Inches(0.2), fill=GREY, radius=0.5)
        para(s, x + lw + bw + Inches(0.1), y - Inches(0.02), nw, f'{round(100 * v / total)}%', 15, align=PP_ALIGN.RIGHT)
        y += Inches(0.36)
    return y


# ---------------------------------------------------------------- one slide per scene
def scene_slide(prs, app, sc):
    kind, sid = sc['kind'], sc['id']
    activity = kind in ('survey', 'vote', 'label', 'code', 'group', 'exit')
    extra = ''
    if sid == 'claims-reveal':
        extra = 'Each claim: what they measured, and why it shrinks.\n' + '\n'.join(
            f'- "{c["quote"]}" Measured: {c["measured"]} {c["why"]}' for c in app['claims'])
    if sid == 'label-reveal':
        extra = 'On screen in the app, not on this slide: ' + plain(sc['lines'][2])
    if sid == 'claims':
        extra = 'The hint each group sees:\n' + '\n'.join(f'- "{c["quote"]}" Look at: {c["look"]}' for c in app['claims'])
    if sid == 'claims-reveal':
        # Two slides of two claims: the deck has no class answers to show beside them.
        for k, half in enumerate([app['claims'][:2], app['claims'][2:]]):
            s = blank(prs, WHITE, notes(sc, extra))
            y = head(s, {**sc, 'title': f'{sc["title"]} ({k + 1}/2)'})
            y = lines_block(s, sc, y, 18, CONTENT_W)
            parts = [[(None, f'“{c["quote"]}”', 'quote'), ('The data supports', c['supports'], 'model')] for c in half]
            y = cards(s, sc, y, parts, 2)
            ask(s, sc, y)
        return
    s = blank(prs, LAVENDER if activity else WHITE, notes(sc, extra))

    if kind == 'join':
        text(s, M, Inches(0.55), CONTENT_W, Inches(0.35), 'THURSDAY · GIT, PART 2', size=16, bold=True, color=PURPLE)
        text(s, M, Inches(1.2), CONTENT_W, Inches(1.6), sc['title'], size=80, bold=True)
        y = para(s, M, Inches(3.3), LINE_W, 'Open the class link (it ends in /thu) and type your first name.', 30) + Inches(3.6)
        para(s, M, y, LINE_W, [app['paper']['title'], f'{app["paper"]["authors"]} · {app["paper"]["venue"]}'], 18, color=MUTED, gap=Pt(4))
        return
    if kind in ('break', 'end'):
        bg_dark = kind == 'end'
        if bg_dark:
            s.background.fill.fore_color.rgb = NAVY
        color = WHITE if bg_dark else INK
        text(s, M, Inches(0.55), CONTENT_W, Inches(0.35), sc['part'].upper(), size=16, bold=True, color=PURPLE)
        th = height(sc['title'], 66, CONTENT_W, True)
        para(s, M, Inches(2.3), CONTENT_W, sc['title'], 66, color=color, bold=True)
        para(s, M, Inches(2.3) + th + Inches(0.35), LINE_W, sc['lines'], 26, color=WHITE if bg_dark else MUTED, gap=Pt(10))
        return

    y = head(s, sc, activity)
    if sid == 'survey':
        y = lines_block(s, sc, y)
        qs = [f'{n}. {q["q"]}' for n, q in zip(range(2, 8), app['survey'])]
        y += para(s, M, y, LINE_W, qs, 16, color=INK, gap=Pt(5))
        para(s, M, y + Inches(0.15), LINE_W, 'Q1 of the form, the donation choice, is left out.', 13, color=MUTED)
        return
    if kind == 'vote':
        options(s, y + Inches(0.1), sc['options'])
        return
    if kind == 'reveal' and sc['shows'] in ('kind', 'data'):
        vote = next(x for x in app['scenes'] if x['id'] == sc['shows'])
        y = options(s, y + Inches(0.05), vote['options'], sc['correct'], compact=True) + Inches(0.1)
        y = lines_block(s, sc, y, 19)
        ask(s, sc, y)
        return
    if sid == 'paper':
        table(s, y, sc['table'], [Inches(3.6), CONTENT_W - Inches(3.6)], size=17)
        return
    if sid == 'survey-reveal':
        y = lines_block(s, sc, y, 18)
        p = app['paperSurvey']
        levels = app['survey'][3]['options']
        half = int((CONTENT_W - Inches(0.6)) / 2)
        y1 = bars(s, M, y, half, LEARN_SHORT, p['learn'], p['n'], 'The paper’s 92: how they learned (share of people)')
        y2 = bars(s, M + half + Inches(0.6), y, half, levels, p['level'], p['n'], 'The paper’s 92: Git level, self-rated')
        y = max(y1, y2) + Inches(0.05)
        para(s, M, y, CONTENT_W, f'Median years using Git: {p["medianYears"]}. In class, the app shows your answers next to these.', 13, color=MUTED)
        ask(s, sc, y + Inches(0.3))
        return
    if sid == 'label':
        y = lines_block(s, sc, y)
        parts = [[(l['label'], l['hint'], 'body')] for l in app['labels']]
        y = cards(s, sc, y, parts, 3) + Inches(0.25)
        para(s, M, y, LINE_W, [f'On your laptop: {len(app["posts"])} posts, each with the question, the accepted answer, and the command the paper counted it for.',
                               'Drawn at random from short, answered posts credited to the top-5 commands (analysis/thursday_numbers.py, seed 294).'], 16, color=MUTED, gap=Pt(4))
        return
    if sid == 'label-reveal':
        y = lines_block(s, {**sc, 'lines': sc['lines'][:2]}, y, 15, CONTENT_W) - Inches(0.12)
        rows = [['Post', 'Counted for', 'Asker names it']] + [
            [f'{p["title"]} ({p["views"]:,} views)', f'`{p["command"]}`', 'Yes' if p['askerNamesIt'] else 'Answer only'] for p in app['posts']]
        y = table(s, y, rows, [CONTENT_W - Inches(4.2), Inches(2.2), Inches(2.0)], size=12, header=True, first_bold=False, pad=Inches(0.05))
        check(sc, y)
        ask(s, sc, y)
        return
    if sid == 'views':
        y = lines_block(s, sc, y, 20, CONTENT_W)
        y = table(s, y, sc['table'], [Inches(3.0)] + [int((CONTENT_W - Inches(3.0)) / 3)] * 3, size=17, header=True, center=True)
        y += Inches(0.05)
        y += para(s, M, y, CONTENT_W, sc['foot'], 13, color=MUTED)
        ask(s, sc, y + Inches(0.1))
        return
    if sid == 'claims':
        y = lines_block(s, sc, y, 20)
        parts = [[(c['where'], f'“{c["quote"]}”', 'quote')] for c in app['claims']]
        cards(s, sc, y, parts, 2)
        return
    if sid == 'code':
        y = lines_block(s, sc, y)
        y += para(s, M, y, LINE_W, 'The paper’s six categories:', 16, color=MUTED) + Inches(0.08)
        para(s, M, y, LINE_W, [f'{c} ({n})' for c, n in zip(app['categories'], app['categoryCounts'])], 16, gap=Pt(3))
        return
    if sid == 'code-reveal':
        y = lines_block(s, sc, y, 17, CONTENT_W) - Inches(0.08)
        rows = [['Comment', 'The paper’s category']] + [[f'#{c["id"]} “{c["text"][:70].rsplit(" ", 1)[0]} …”', app['categories'][c['category']]] for c in app['comments']]
        y = table(s, y, rows, [CONTENT_W - Inches(4.6), Inches(4.6)], size=12, header=True, first_bold=False, pad=Inches(0.05))
        check(sc, y)
        ask(s, sc, y)
        return
    if sid == 'design':
        y = lines_block(s, sc, y, 18)
        parts = [[(f['label'], f['placeholder'], 'body')] for f in app['designFields']]
        cards(s, sc, y, parts, 4)
        return
    if sid == 'design-reveal':
        y = lines_block(s, sc, y)
        para(s, M, y, LINE_W, 'Each group reads its change, its study, its measure and threat, and its data. The app shows all of them.', 22, color=MUTED)
        ask(s, sc, y + Inches(1))
        return
    # git-did, exit, anything plain
    y = lines_block(s, sc, y)
    ask(s, sc, y)


def build():
    app = read_app()
    prs = new_deck()
    title_slide(prs, 'Git, Part 2: The Humans', 'User Study Day · ' + app['paper']['title'],
                f'CS294 Modern Programming Tools · Thursday · 80 minutes ({app["minutes"]} + {app["buffer"]} of buffer)',
                f'{app["paper"]["authors"]}. {app["paper"]["venue"]}. Data: {app["paper"]["data"]}.')
    for sc in app['scenes']:
        scene_slide(prs, app, sc)
    flatten(prs)
    return prs


if __name__ == '__main__':
    path = os.path.join(OUT, 'thursday_app.pptx')
    prs = build()
    prs.save(path)
    print('saved', path, f'({len(prs.slides)} slides)')
