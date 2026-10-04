"""CS294 Git Week -- slide style library (python-pptx 1.0.x  ->  Google Slides).

Implements design/spec.md section 9 (visual system, v2).  All geometry is in inches on a
13.333 x 7.5 in (16:9) canvas.  Every text box has auto-size OFF, word-wrap ON, zero
margins and an explicit font/size/colour on every run, so Google Slides renders exactly
what LibreOffice renders.  Native shapes only; no shadows, gradients or transparency.

    import sys; sys.path.insert(0, '/home/shagarw_google_com/shubham/git_course/slides/build')
    from style import *
    prs = new_deck()
    sl = task(prs, 3, 'The Client wants ONE monster with both ideas.',
              ['One new card. Never erase.', 'Which panels are easy?'], minutes=5,
              notes='...')
    save(prs, '/path/deck.pptx')          # runs audit() and prints overflow warnings
    render('/path/deck.pptx', '/path/renders/x', 'x')   # PNGs that keep colour emoji

Inline markup in any text string:  **bold**   `git code` (mono, purple)   [[accent]] (purple)
Rich runs are also accepted:  [('plain ', {}), ('red', {'color': RED, 'bold': True})]
"""
import os
import re
import random
import shutil
import subprocess
import tempfile

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

# =============================================================== tokens (spec 9.1-9.3)
W, H = 13.333, 7.5          # canvas
M = 0.75                    # side margin
CW = W - 2 * M              # 11.833 content width
R = W - M                   # 12.583 right content edge
TOP = 0.60                  # chip / kicker row
SPLIT_X = 7.75              # visual zone starts here when a 6.6 in text column is used
TEXT_COL = 6.6
VISUAL_ZONE = (7.75, 1.55, 4.833, 4.90)   # x, y, w, h of a TASK slide's visual zone

WHITE = 'FFFFFF'
INK, INK2 = '111111', '555555'
MUTED, HAIR = '919191', 'E3E3E3'
PURPLE = '9437FF'
PINK = 'FF2F92'
BLUE, BLUE_T = '00A2FF', 'E8F6FF'
ORANGE = 'FF9300'
LAVENDER = 'F6ECF8'
RED, RED_T = 'E02424', 'FDECEC'
GREEN, GREEN_T = '1E9E4A', 'E6F6EC'
YELLOW, YELLOW_T, YELLOW_EDGE = 'FFE45E', 'FFF6C7', 'E8C547'
PANEL, PANEL_LINE = 'FAFAFA', 'DDDDDD'
GHOST, GHOST_T = 'BDBDBD', 'F3F3F3'
NAVY = '0A1631'
TERM = '16181D'
CARD_LINE = '1F1F1F'
SKETCH_LINE = '9A9A9A'
FUTURE_DOT = 'D6D6D6'
BAR_GREY = 'EDEDED'
STAR_TEXT = 'CADCFF'

C = dict(BG=WHITE, INK=INK, INK2=INK2, MUTED=MUTED, HAIR=HAIR, PURPLE=PURPLE, PINK=PINK,
         BLUE=BLUE, BLUE_T=BLUE_T, ORANGE=ORANGE, LAV=LAVENDER, LAVENDER=LAVENDER, RED=RED,
         RED_T=RED_T, GREEN=GREEN, GREEN_T=GREEN_T, YELLOW=YELLOW, YELLOW_T=YELLOW_T,
         PANEL=PANEL, GHOST=GHOST, GHOST_T=GHOST_T, NAVY=NAVY, TERM=TERM)

# terminal / code colours
CODE = dict(prompt='7C8594', cmd='F5F5F5', out='A9B1BD', err='FF6B6B', ok='5AD17A',
            mark='FFB020', hi='C792EA', dim='7C8594')

FONT = 'Inter'               # all prose (Google Font -> native in Slides)
MONO = 'Noto Sans Mono'      # code only (Google Font -> native in Slides), spec 9.3

ROWS = ('FACE', 'BODY', 'LEGS')
EMOJI = {  # spec 9.5 card vocabulary (cards only)
    'smiley': '🙂', 'horns': '😈', 'cat': '🐱', 'dragon': '🐲', 'mustache': '🥸',
    'box': '📦', 'robot': '🤖', 'superhero': '🦸', 'cape': '🤖🦸', 'robot with a cape': '🤖🦸',
    'disco': '🪩', 'disco suit': '🪩', 'sticks': '🦵', 'wheels': '🛞', 'tentacles': '🐙',
    'skates': '🛼', 'roller skates': '🛼', 'conflict': '❓', '?': '❓',
}
DIVIDER_ON_DARK = {PURPLE, NAVY, TERM, INK}

_ALIGN = dict(l=PP_ALIGN.LEFT, c=PP_ALIGN.CENTER, r=PP_ALIGN.RIGHT)
_ANCH = dict(t=MSO_ANCHOR.TOP, m=MSO_ANCHOR.MIDDLE, b=MSO_ANCHOR.BOTTOM)

# line-height factors (ascent+descent / em) used for fitting and the audit
_LH = {FONT: 1.21, MONO: 1.362}
_EMOJI_LH = 1.17


def rgb(h):
    return RGBColor.from_string(h)


# =============================================================== text measurement
_FONT_FILES = {
    (FONT, False, False): '/usr/share/fonts/opentype/inter/Inter-Regular.otf',
    (FONT, True, False): '/usr/share/fonts/opentype/inter/Inter-Bold.otf',
    (FONT, False, True): '/usr/share/fonts/opentype/inter/Inter-Italic.otf',
    (FONT, True, True): '/usr/share/fonts/opentype/inter/Inter-BoldItalic.otf',
    (MONO, False, False): '/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf',
    (MONO, True, False): '/usr/share/fonts/truetype/noto/NotoSansMono-Bold.ttf',
    (MONO, False, True): '/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf',
    (MONO, True, True): '/usr/share/fonts/truetype/noto/NotoSansMono-Bold.ttf',
}
_PIL = {}


def _pil(font, bold, italic):
    key = (font if font in (FONT, MONO) else FONT, bool(bold), bool(italic))
    if key not in _PIL:
        try:
            from PIL import ImageFont
            _PIL[key] = ImageFont.truetype(_FONT_FILES[key], 100)
        except Exception:      # no PIL / font file: fall back to an average advance
            _PIL[key] = None
    return _PIL[key]


def _is_emoji(ch):
    o = ord(ch)
    return o >= 0x1F000 or 0x2600 <= o <= 0x27BF or o in (0x23F1, 0x23F0, 0x231A, 0x2B50)


def text_width(s, size, bold=False, font=FONT, italic=False):
    """Rendered width of a single line in inches (PIL + the real font files)."""
    f = _pil(font, bold, italic)
    total, buf = 0.0, ''

    def flush(b):
        if not b:
            return 0.0
        if f is None:
            return len(b) * (60 if font == MONO else 55)
        return f.getlength(b)
    for ch in s:
        if ch in '‍️︎':
            continue
        if _is_emoji(ch):
            total += flush(buf) + 125
            buf = ''
        else:
            buf += ch
    total += flush(buf)
    return total / 100.0 * size / 72.0


def _wrap_count(runs, width):
    """runs: [(text, size, bold, font, italic)] -> number of wrapped lines in `width` in."""
    if width <= 0:
        return 99
    lines, cur, pending = 1, 0.0, 0.0
    for t, size, bold, font, italic in runs:
        for tok in re.split(r'(\s+)', t):
            if not tok:
                continue
            if tok.isspace() and '\x0b' in tok:      # explicit line break (<a:br/>)
                lines += tok.count('\x0b')
                cur, pending = 0.0, 0.0
                continue
            tw = text_width(tok, size, bold, font, italic)
            if tok.isspace():
                pending += tw
                continue
            if cur > 0 and cur + pending + tw > width + 1e-3:
                lines += 1
                cur, pending = 0.0, 0.0
            cur += pending + tw
            pending = 0.0
            while cur > width + 1e-3:          # a single word longer than the line
                lines += 1
                cur -= width
    return lines


def _line_h(runs, ls=None, pitch=None):
    if pitch:
        return pitch / 72.0
    size = max(r[1] for r in runs) if runs else 18
    lh = max(_LH.get(r[3], 1.21) for r in runs) if runs else 1.21
    if any(_is_emoji(ch) for r in runs for ch in r[0]):
        lh = max(lh, _EMOJI_LH * 1.05)
    return size * lh * (ls or 1.0) / 72.0


# =============================================================== rich text
_MD = re.compile(r'(\*\*.+?\*\*|`[^`]+`|\[\[.+?\]\])')


def _parse(s, code_color, accent):
    out = []
    for part in _MD.split(s):
        if not part:
            continue
        if part.startswith('**') and part.endswith('**') and len(part) > 4:
            out.append((part[2:-2], {'bold': True}))
        elif part.startswith('`') and part.endswith('`') and len(part) > 2:
            o = {'font': MONO}
            if code_color:
                o['color'] = code_color
            out.append((part[1:-1], o))
        elif part.startswith('[[') and part.endswith(']]') and len(part) > 4:
            out.append((part[2:-2], {'color': accent}))
        else:
            out.append((part, {}))
    return out


def _paragraphs(content, markup=True, code_color=PURPLE, accent=PURPLE):
    """Normalise content -> list of paragraphs, each a list of (text, opts)."""
    if isinstance(content, str):
        content = content.split('\n')
    elif isinstance(content, tuple):
        content = [content]
    paras = []
    for para in content:
        if isinstance(para, (str, tuple)):
            para = [para]
        runs = []
        for run in para:
            if isinstance(run, str):
                runs.extend(_parse(run, code_color, accent) if markup else [(run, {})])
            else:
                runs.append((run[0], dict(run[1])))
        paras.append(runs)
    return paras


def _resolved(paras, size, bold, font, italic):
    return [[(t, o.get('size', size), o.get('bold', bold), o.get('font', font),
              o.get('italic', italic)) for t, o in p] for p in paras]


BR = '\x0b'   # soft line break inside a paragraph (written as <a:br/>)


def _smart(t):
    """Typographic quotes for prose runs (never applied to mono/code runs)."""
    t = re.sub(r'(^|[\s(\[{—–-])"', '\\1“', t)
    t = t.replace('"', '”')
    t = re.sub(r"(^|[\s(\[{—–-])'", '\\1‘', t)
    return t.replace("'", '’')


def _balance_para(runs, w, size, bold, font, italic, max_lines=4, mode='always'):
    """Re-break a 2..max_lines-line paragraph with soft breaks (BR).
    mode 'always': even line lengths (centred headlines).
    mode 'widow' : only when the last line would be < 45 % of the width (left-aligned text).
    Two-line paragraphs prefer breaking after a sentence (. ? !) or a clause (, ; : —)."""
    def res(r):
        t, o = r
        return (t, o.get('size', size), o.get('bold', bold), o.get('font', font),
                o.get('italic', italic))
    rr = [res(r) for r in runs]
    if not rr or any(BR in r[0] for r in rr):
        return runs
    n = _wrap_count(rr, w)
    if n < 2 or n > max_lines:
        return runs
    toks = []                     # (text, opts, width, is_space)
    for (t, o), r in zip(runs, rr):
        for tok in re.split(r'(\s+)', t):
            if tok:
                toks.append((tok, o, text_width(tok, r[1], r[2], r[3], r[4]), tok.isspace()))

    def greedy(width):
        brk, widths, cur, pend, last_sp = set(), [], 0.0, 0.0, None
        for i, (tok, o, tw, sp) in enumerate(toks):
            if sp:
                pend += tw; last_sp = i
                continue
            if cur > 0 and cur + pend + tw > width + 1e-3:
                brk.add(last_sp); widths.append(cur); cur, pend = 0.0, 0.0
            cur += pend + tw; pend = 0.0
        widths.append(cur)
        return brk, widths

    if mode == 'widow':
        _, widths = greedy(w)
        if widths[-1] >= 0.45 * w:
            return runs
    if n == 2:
        best = None
        words = [i for i, t in enumerate(toks) if not t[3]]
        for k, tk in enumerate(toks):
            if not tk[3]:
                continue
            left = [t for t in toks[:k]]
            right = [t for t in toks[k + 1:]]
            while left and left[-1][3]:
                left.pop()
            while right and right[0][3]:
                right.pop(0)
            if not left or not right:
                continue
            w1, w2 = sum(t[2] for t in left), sum(t[2] for t in right)
            if w1 > w + 1e-3 or w2 > w + 1e-3:
                continue
            ch = left[-1][0][-1]
            bonus = 0.45 if ch in '.?!' else (0.15 if ch in ',;:—–' else 0.0)
            if len([t for t in right if not t[3]]) == 1 or len([t for t in left if not t[3]]) == 1:
                bonus -= 0.30          # never leave a single word alone
            score = max(w1, w2) / w - bonus
            if best is None or score < best[0]:
                best = (score, k)
        if best is None or not words:
            return runs
        brk = {best[1]}
    else:
        lo, hi = 0.25 * w, w
        for _ in range(18):
            mid = (lo + hi) / 2
            if _wrap_count(rr, mid) <= n:
                hi = mid
            else:
                lo = mid
        brk, _ = greedy(hi)
    new = []
    for i, (tok, o, tw, sp) in enumerate(toks):
        if i in brk:
            new.append((BR, {}))
            continue
        if new and new[-1][0] != BR and new[-1][1] is o:
            new[-1] = (new[-1][0] + tok, o)
        else:
            new.append((tok, o))
    # drop spaces that now touch a break
    out = []
    for j, (t, o) in enumerate(new):
        if t != BR:
            if j + 1 < len(new) and new[j + 1][0] == BR:
                t = t.rstrip(' ')
            if j > 0 and new[j - 1][0] == BR:
                t = t.lstrip(' ')
            if not t:
                continue
        out.append((t, o))
    return out


def balanced(content, w, size, bold=False, font=FONT, italic=False, markup=True,
             code_color=PURPLE, accent=PURPLE, mode='always'):
    """Paragraph list with even line breaks (see _balance_para)."""
    return [_balance_para(p, w, size, bold, font, italic, mode=mode)
            for p in _paragraphs(content, markup, code_color, accent)]


def line_width(content, size, bold=False, font=FONT, markup=True):
    """Width in inches of the widest paragraph if it were set on one line."""
    paras = _resolved(_paragraphs(content, markup), size, bold, font, False)
    return max((sum(text_width(t, s_, b, f, i) for t, s_, b, f, i in p) for p in paras),
               default=0.0)


def measure(content, w, size, bold=False, font=FONT, italic=False, ls=None, pitch=None,
            gap=0.0, markup=True):
    """Height in inches that `content` needs inside a box of width w."""
    paras = _resolved(_paragraphs(content, markup), size, bold, font, italic)
    total = 0.0
    for i, runs in enumerate(paras):
        if not runs or not ''.join(r[0] for r in runs).strip():
            runs = [(' ', size, bold, font, italic)]
        n = _wrap_count(runs, w)
        total += n * _line_h(runs, ls, pitch) + (gap / 72.0 if i else 0)
    return total


def lines_needed(content, w, size, bold=False, font=FONT, italic=False, markup=True):
    paras = _resolved(_paragraphs(content, markup), size, bold, font, italic)
    return sum(_wrap_count(r or [(' ', size, bold, font, italic)], w) for r in paras)


def fit_size(content, w, h, sizes, bold=False, font=FONT, ls=None, max_lines=None,
             markup=True, warn=True):
    """Largest size in `sizes` whose text fits w x h (and <= max_lines)."""
    for sz in sizes:
        if measure(content, w, sz, bold, font, ls=ls, markup=markup) <= h + 0.02 and (
                not max_lines or lines_needed(content, w, sz, bold, font, markup=markup)
                <= max_lines):
            return sz
    if warn:
        flat = content if isinstance(content, str) else str(content)
        print(f'  [style] WARNING: text does not fit even at {sizes[-1]} pt: {flat[:60]!r}')
    return sizes[-1]


# =============================================================== deck / slide
def _patch_theme(prs):
    """Theme fonts -> Inter, so text a presenter adds in Google Slides is Inter too."""
    try:
        tp = prs.slide_masters[0].part.part_related_by(RT.THEME)
        root = etree.fromstring(tp.blob)
        for tag in ('a:majorFont', 'a:minorFont'):
            for el in root.iter(qn(tag)):
                lat = el.find(qn('a:latin'))
                if lat is not None:
                    lat.set('typeface', FONT)
        tp._blob = etree.tostring(root, xml_declaration=True, encoding='UTF-8',
                                  standalone=True)
    except Exception as e:     # cosmetic only
        print('  [style] theme patch skipped:', e)


def new_deck():
    """Empty 16:9 deck (13.333 x 7.5 in) with Inter theme fonts."""
    prs = Presentation()
    prs.slide_width = Emu(12192000)
    prs.slide_height = Emu(6858000)
    _patch_theme(prs)
    return prs


def blank(prs, bg=WHITE):
    """New slide on the blank layout with a solid background colour."""
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    f = sl.background.fill
    f.solid()
    f.fore_color.rgb = rgb(bg)
    return sl


def notes(slide, txt):
    """Speaker notes (survive the Google Slides import). Lists are joined by newlines."""
    if txt is None:
        return slide
    if isinstance(txt, (list, tuple)):
        txt = '\n'.join(txt)
    slide.notes_slide.notes_text_frame.text = txt
    return slide


_set_notes = notes


def save(prs, path, check=True):
    """Save the deck; with check=True run audit() first and print any problems."""
    if check:
        issues = audit(prs)
        for i in issues:
            print('  [audit]', i)
        if not issues:
            print('  [audit] clean: no text overflow, everything on canvas')
    prs.save(path)
    return path


# =============================================================== low-level shapes
def _no_shadow(shp):
    """Drop theme <p:style> (shadow + white default text) and add an empty effectLst."""
    el = shp._element
    st = el.find(qn('p:style'))
    if st is not None:
        el.remove(st)
    spPr = el.spPr
    if spPr.find(qn('a:effectLst')) is None:
        ef = etree.SubElement(spPr, qn('a:effectLst'))
        for tag in ('a:scene3d', 'a:sp3d', 'a:extLst'):
            nxt = spPr.find(qn(tag))
            if nxt is not None:
                nxt.addprevious(ef)
                break


def box(sl, x, y, w, h, fill=None, line=None, lw=1.5, shape=MSO_SHAPE.RECTANGLE,
        radius=None, dash=False, rot=0):
    """Native autoshape. radius: inches (rounded rect) or 'pill'. fill/line: hex or None."""
    if radius is not None and shape == MSO_SHAPE.RECTANGLE:
        shape = MSO_SHAPE.ROUNDED_RECTANGLE
    shp = sl.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        shp.adjustments[0] = 0.5 if radius == 'pill' else min(0.5, (radius or 0.1) / min(w, h))
    if fill:
        shp.fill.solid()
        shp.fill.fore_color.rgb = rgb(fill)
    else:
        shp.fill.background()
    if line:
        shp.line.color.rgb = rgb(line)
        shp.line.width = Pt(lw)
        if dash:
            shp.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    else:
        shp.line.fill.background()
    if rot:
        shp.rotation = rot
    _no_shadow(shp)
    tf = shp.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = tf.margin_right = Inches(0.04)
    tf.margin_top = tf.margin_bottom = Inches(0)
    return shp


def _fill_tf(tf, content, size, bold, color, align, font, italic, ls, pitch, gap, markup,
             code_color, accent, balance_w=None, smart=True, balance_mode='always'):
    paras = _paragraphs(content, markup, code_color, accent)
    if balance_w:
        paras = [_balance_para(p, balance_w, size, bold, font, italic, mode=balance_mode)
                 for p in paras]
    tf.clear()
    for i, runs in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = _ALIGN[align]
        if pitch:
            p.line_spacing = Pt(pitch)
        elif ls:
            p.line_spacing = ls
        if gap and i:
            p.space_before = Pt(gap)
        if not runs or not ''.join(t for t, _ in runs):
            runs = [(' ', {})]
        for t, o in runs:
            if t == BR:
                br = p._p.add_br()
                br.get_or_add_rPr().set('sz', str(int(o.get('size', size) * 100)))
                continue
            fnt = o.get('font', font)
            r = p.add_run()
            r.text = _smart(t) if (smart and fnt != MONO) else t
            f = r.font
            f.name = fnt
            f.size = Pt(o.get('size', size))
            f.bold = o.get('bold', bold)
            f.italic = o.get('italic', italic)
            f.color.rgb = rgb(o.get('color', color))


def text(sl, x, y, w, h, content, size=28, bold=False, color=INK, align='l', anchor='t',
         font=FONT, italic=False, ls=None, pitch=None, gap=0, markup=True,
         code_color=PURPLE, accent=PURPLE, margin=0.0, balance=False):
    """Text box: auto-size off, wrap on, zero margins. ls = line multiple, pitch = exact pt,
    gap = pt before each paragraph after the first. balance=True evens out the line
    breaks of 2-4 line paragraphs (no widows) using soft breaks."""
    tb = sl.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.vertical_anchor = _ANCH[anchor]
    for side in ('left', 'right', 'top', 'bottom'):
        setattr(tf, f'margin_{side}', Inches(margin))
    _fill_tf(tf, content, size, bold, color, align, font, italic, ls, pitch, gap, markup,
             code_color, accent, balance_w=(w - 2 * margin) if balance else None,
             balance_mode=('widow' if balance == 'widow' else 'always'))
    return tb


def label(shp, content, size=16, bold=True, color=INK, align='c', anchor='m', font=FONT,
          italic=False, ls=None, markup=True, code_color=None):
    """Put text inside an existing autoshape."""
    tf = shp.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.vertical_anchor = _ANCH[anchor]
    _fill_tf(tf, content, size, bold, color, align, font, italic, ls, None, 0, markup,
             code_color, PURPLE)
    return shp


def chip(sl, x, y, w, h, content, fill=INK, color=WHITE, size=18, bold=True, line=None,
         lw=1.5, font=FONT, radius='pill', rot=0, dash=False, markup=False):
    """Pill / tag with centred text."""
    shp = box(sl, x, y, w, h, fill=fill, line=line, lw=lw, radius=radius, rot=rot, dash=dash)
    return label(shp, content, size=size, bold=bold, color=color, font=font, markup=markup)


def chip_w(content, size, bold=True, font=FONT, pad=0.22):
    """Width a chip needs for one line of `content`."""
    return text_width(content, size, bold, font) + 2 * pad + 0.08


def line(sl, x1, y1, x2, y2, color=INK2, w=2.0, dash=False, head=False, tail=False):
    """Straight connector. head=True puts a triangle at (x2, y2); tail=True at (x1, y1)."""
    c = sl.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1),
                                Inches(x2), Inches(y2))
    c.line.color.rgb = rgb(color)
    c.line.width = Pt(w)
    if dash:
        c.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    ln = c.line._get_or_add_ln()
    if tail:
        he = etree.SubElement(ln, qn('a:headEnd'))
        he.set('type', 'triangle'); he.set('w', 'med'); he.set('len', 'med')
    if head:
        te = etree.SubElement(ln, qn('a:tailEnd'))
        te.set('type', 'triangle'); te.set('w', 'med'); te.set('len', 'med')
    _no_shadow(c)
    return c


def arrow(sl, x1, y1, x2, y2, color=INK2, w=2.0, dash=False):
    """Arrow from (x1,y1) to (x2,y2), triangle head at (x2,y2)."""
    return line(sl, x1, y1, x2, y2, color=color, w=w, dash=dash, head=True)


def hairline(sl, x1, y1, x2, y2, color=HAIR, w=1.0):
    return line(sl, x1, y1, x2, y2, color=color, w=w)


def dot(sl, cx, cy, color=PURPLE, d=0.16):
    return box(sl, cx - d / 2, cy - d / 2, d, d, fill=color, shape=MSO_SHAPE.OVAL)


# =============================================================== small UI primitives
def step_chip(sl, step, x=M, y=TOP):
    """INK pill 'STEP 3' (or any label)."""
    lab = step if isinstance(step, str) else f'STEP {step}'
    w = max(1.55, chip_w(lab, 18))
    return chip(sl, x, y, w, 0.50, lab, size=18)


def timer_chip(sl, minutes, x=None, y=TOP):
    """White pill with 1.5 pt INK line: '⏱  5 min' (or '⏱  1:30'). Shows duration only."""
    t = str(minutes)
    lab = f'⏱  {t}' if (':' in t or 'min' in t) else f'⏱  {t} min'
    w = max(1.75, chip_w(lab, 20))
    x = R - w if x is None else x
    return chip(sl, x, y, w, 0.50, lab, fill=WHITE, color=INK, line=INK, lw=1.5, size=20)


def menti_chip(sl, x=M, y=TOP, label='📊  Live poll'):
    return chip(sl, x, y, max(2.20, chip_w(label, 18)), 0.48, label, fill=PURPLE, size=18)


def progress(sl, step, total=9, y=6.92, on_dark=False):
    """Step dots, right edge 12.583: current purple, done INK, future light grey."""
    d, gap = 0.13, 0.11
    x0 = R - (total * d + (total - 1) * gap)
    for i in range(total):
        col = PURPLE if i == step else ((WHITE if on_dark else INK) if i < step else FUTURE_DOT)
        box(sl, x0 + i * (d + gap), y, d, d, fill=col, shape=MSO_SHAPE.OVAL)


def pause_bar(sl, question, y_bottom=6.92, x=M, w=CW):
    """Lavender bar '💬  question'. 24 pt on one line; else 22 pt on <=2 lines (bar grows
    upward so its bottom stays at y_bottom). Returns the bar's top y."""
    content = '💬  ' + question
    inner = w - 0.60
    size, n = 24, lines_needed(content, inner, 24)
    if n > 1:
        size = 22
        n = lines_needed(content, inner, 22)
        if n > 2:
            size = fit_size(content, inner, 0.80, (20, 18), max_lines=2)
            n = 2
    h = 0.72 if n == 1 else 1.02
    top = y_bottom - h
    box(sl, x, top, w, h, fill=LAVENDER, radius=0.14)
    text(sl, x + 0.30, top, inner, h, content, size=size, anchor='m', ls=1.05,
         balance=('widow' if n > 1 else False))
    return top


def source_line(sl, txt, y=6.95):
    """Thursday data-slide source line, 12 pt MUTED."""
    return text(sl, M, y, CW, 0.30, txt, size=12, color=MUTED, anchor='m')


def glyph(sl, ch, cx, cy, size=40, color=MUTED):
    """Centred '+' / '=' / 'vs' glyph between cards."""
    return text(sl, cx - 0.5, cy - 0.45, 1.0, 0.9, ch, size=size, color=color, align='c',
                anchor='m', markup=False)


def badge(sl, cx, cy, mark='×', fill=RED, d=0.42, size=18):
    """Round badge (rejected = red '×'; use '✓'-free glyphs, spec 9.7)."""
    return chip(sl, cx - d / 2, cy - d / 2, d, d, mark, fill=fill, size=size,
                radius='pill')


reject_badge = badge


def mono_chip(sl, x, y, txt, size=20, fill=PANEL, color=PURPLE, line=PANEL_LINE, h=None,
              w=None, bold=True):
    """Command chip, e.g. `git revert`. Returns the shape (width adapts to text)."""
    w = w or chip_w(txt, size, bold, MONO, pad=0.18)
    h = h or size / 72 * 1.9
    return chip(sl, x, y, w, h, txt, fill=fill, color=color, line=line, lw=1, size=size,
                font=MONO, bold=bold, radius=0.08)


def numbered(sl, x, y, w, items, size=28, marks=None, mark_color=PURPLE, color=INK,
             gap=0.12, bold=False, font=FONT, mark_w=None, ls=1.08):
    """Rows of (mark, text) in two boxes per row, so wrapped lines align. marks default
    1, 2, 3...; pass 'ABCD' for poll options, or a list of hex colours to draw dots.
    Returns the bottom y."""
    mark_w = mark_w or size / 72 * 1.2
    yy = y
    for i, it in enumerate(items):
        th = measure(it, w - mark_w, size, bold, font, ls=ls)
        lh = _line_h([(' ', size, bold, font, False)], ls)
        mk = (marks[i] if marks else str(i + 1))
        if isinstance(mk, str) and len(mk) == 6 and re.fullmatch(r'[0-9A-Fa-f]{6}', mk):
            dot(sl, x + 0.10, yy + lh * 0.55, mk, d=min(0.2, size / 72 * 0.42))
        else:
            text(sl, x, yy, mark_w, lh, mk, size=size, bold=True, color=mark_color,
                 ls=ls, markup=False)
        text(sl, x + mark_w, yy, w - mark_w, th + 0.02, it, size=size, bold=bold,
             color=color, font=font, ls=ls, balance='widow')
        yy += th + gap
    return yy


# =============================================================== cards (spec 9.5)
CARD_W, CARD_H = 1.70, 2.45
_PANEL_MARK = {
    'changed': (YELLOW_T, YELLOW_EDGE, 0.75, False),
    'auto': (GREEN_T, GREEN, 1.5, False),
    'conflict': (RED_T, RED, 2.25, True),
}


def _emo(p):
    return EMOJI.get(p, p) if isinstance(p, str) else ''


def card(sl, x, y, cid='#1', panels=('smiley', 'box', 'sticks'), parent=None, author=None,
         s=1.0, state='committed', marks=None):
    """Commit card (1.70 x 2.45 at s=1): ID tag, author, three emoji panels, came-from line.

    panels  : 3 emoji or vocabulary words ('cat', 'robot', 'cape' ...). None -> empty.
    parent  : 'drt3' -> '← drt3';  '—' -> root card;  None -> no line.
    state   : 'committed' (filled tag) | 'staged' (solid card, empty dashed tag) |
              'sketch' (dashed grey card, empty dashed tag) | 'ghost' (grey, empty panels)
    marks   : {row: 'changed' | 'auto' | 'conflict'}  (row 0 = FACE)
    Returns geometry dict: x y w h l r t b cx cy s row_y[3] id."""
    marks = marks or {}
    w, h = CARD_W * s, CARD_H * s
    pad = 0.12 * s
    ghost = state == 'ghost'
    body_line = {'committed': CARD_LINE, 'staged': CARD_LINE, 'sketch': SKETCH_LINE,
                 'ghost': GHOST}[state]
    box(sl, x, y, w, h, fill=(GHOST_T if ghost else WHITE), line=body_line, lw=1.5,
        radius=0.12 * s, dash=state in ('sketch', 'ghost'))
    # --- ID tag: width adapts to the ID ('W', '#3', 'drt3'), 0.86 max
    tsize = max(9, 14 * s)
    th = 0.34 * s
    tw = min(w - 2 * pad, max(0.50 * s, text_width(cid or 'drt3', tsize, True, MONO)
                              + 0.12 + 0.14 * s))
    if state in ('committed', 'ghost'):
        tg = chip(sl, x + pad, y + pad, tw, th, cid, fill=(None if ghost else INK),
                  line=(GHOST if ghost else None), lw=1, color=(GHOST if ghost else WHITE),
                  size=tsize, font=MONO, radius=0.06 * s)
        tg.text_frame.margin_left = tg.text_frame.margin_right = Inches(0.02)
    else:
        tw = 0.70 * s
        box(sl, x + pad, y + pad, tw, th, line=SKETCH_LINE, lw=1, radius=0.06 * s, dash=True)
    # --- author, right of the tag (shrinks to fit)
    if author:
        aw = w - 2 * pad - tw - 0.05 * s
        asz = fit_size(author, aw, th, [max(9, round(13 * s * k)) for k in (1, .92, .85, .77)],
                       max_lines=1, warn=False)
        text(sl, x + pad + tw + 0.05 * s, y + pad, aw, th, author, size=asz,
             color=(GHOST if ghost else INK2), align='r', anchor='m', markup=False)
    # --- panels
    ph, pitch, py0 = 0.48 * s, 0.54 * s, y + 0.56 * s
    for i in range(3):
        emo = _emo(panels[i]) if panels and i < len(panels) else ''
        mk = marks.get(i)
        fill, ln, lw, dash = PANEL, PANEL_LINE, 0.75, False
        if mk in _PANEL_MARK:
            fill, ln, lw, dash = _PANEL_MARK[mk]
            if mk == 'conflict' and not emo:
                emo = '❓'
        if ghost:
            fill, ln, lw, dash, emo = GHOST_T, PANEL_LINE, 0.75, False, ''
        p = box(sl, x + pad, py0 + i * pitch, w - 2 * pad, ph, fill=fill, line=ln, lw=lw,
                dash=dash, radius=0.05 * s)
        if emo:
            esz = 26 * s if len([c for c in emo if _is_emoji(c)]) < 2 else 22 * s
            label(p, emo, size=round(esz, 1), bold=False, markup=False)
    # --- came-from line
    if parent is not None:
        cf = [['—']] if parent in ('—', '-', '') else [[('← ', {'font': FONT}), (parent, {})]]
        cw_ = w - 2 * pad
        csz = fit_size(cf, cw_, 1.0, [max(8, round(13 * s * k)) for k in (1, .9, .8, .7)],
                       font=MONO, max_lines=1, warn=False)
        chh = max(0.26 * s, csz * 1.40 / 72)
        text(sl, x + pad, y + 2.25 * s - chh / 2, cw_, chh, cf, size=csz,
             color=(GHOST if ghost else INK2), font=MONO, align='c', anchor='m',
             markup=False)
    return dict(x=x, y=y, w=w, h=h, l=x, r=x + w, t=y, b=y + h, cx=x + w / 2, cy=y + h / 2,
                row_y=[py0 + i * pitch + ph / 2 for i in range(3)], s=s, id=cid)


def card_stack(sl, x, y, cards, s=0.62, dx=0.10, dy=0.50):
    """Cascade of cards (oldest at the back, newest in front), each shifted (dx, dy*s) so
    every ID tag stays visible: 'this table has ALL the cards'. cards: list of kwargs for
    card(). Size: w = 1.70*s + dx*(n-1), h = 2.45*s + dy*s*(n-1).
    Returns the front card's geometry (+ 'stack_l', 'stack_t')."""
    g = None
    for i, kw in enumerate(cards):
        g = card(sl, x + i * dx, y + i * dy * s, s=s, **dict(kw))
    g['stack_t'] = y
    g['stack_l'] = x
    return g


def row_labels(sl, g, size=14, names=ROWS, gap=0.15, w=0.90):
    """FACE / BODY / LEGS right-aligned, ending `gap` left of card g."""
    for i, nm in enumerate(names):
        text(sl, g['l'] - gap - w, g['row_y'][i] - 0.17, w, 0.34, nm, size=size, bold=True,
             color=MUTED, align='r', anchor='m', markup=False)


def caption(sl, g, txt, where='below', size=18, color=PURPLE, font=MONO, bold=True,
            gap=0.12, w=None):
    """Label centred under (or above) a card/shape geometry g."""
    w = w or max(g['w'] + 1.0, text_width(txt, size, bold, font) + 0.2)
    hh = size / 72 * 1.45
    yy = g['b'] + gap if where == 'below' else g['t'] - gap - hh
    return text(sl, g['cx'] - w / 2, yy, w, hh, txt, size=size, bold=bold, color=color,
                font=font, align='c', anchor='m', markup=False)


def link(sl, child, parent, color=INK2, w=2.0, dash=False, gap=0.06):
    """Parent pointer: child's left edge -> parent's right edge (points back in time)."""
    return arrow(sl, child['l'] - gap, child['cy'], parent['r'] + gap, parent['cy'],
                 color=color, w=w, dash=dash)


def flag(sl, g, name, slot=0, kind='branch', edge='top', size=None):
    """Sticky-note flag on card g, rotated -4°.
    kind: 'branch' (yellow, 16 Bold) | 'origin' (BLUE_T + 1.5 pt BLUE line, 14 Bold).
    edge: 'top' (overlaps the card top; slot shifts right by 1.30*s) |
          'right' (fork diagrams: x = r - 0.15, y = t + 0.15; slot shifts down).
    Returns geometry dict (x y w h cx t b)."""
    s = g['s']
    origin = kind == 'origin'
    base_sz = 14 if origin else 16
    sz = size or max(11, round(base_sz * min(1.0, s + 0.15)))
    fh = max(0.36, 0.50 * s)
    fw = max(1.20 * s, chip_w(name, sz, True, pad=0.12))
    if edge == 'right':
        fx = g['r'] - 0.15
        fy = g['t'] + 0.15 + slot * (fh + 0.10)
    else:
        fx = g['cx'] - fw / 2 + slot * (fw + 0.10)
        fy = g['t'] - fh + 0.08 * s
    chip(sl, fx, fy, fw, fh, name, fill=(BLUE_T if origin else YELLOW), color=INK,
         line=(BLUE if origin else None), lw=1.5, size=sz, radius=0.04, rot=-4)
    return dict(x=fx, y=fy, w=fw, h=fh, cx=fx + fw / 2, cy=fy + fh / 2, t=fy, b=fy + fh, l=fx,
                r=fx + fw)


def origin_flag(sl, g, name='origin/main', **kw):
    return flag(sl, g, name, kind='origin', **kw)


def head_pin(sl, x, y, s=1.0, side='above'):
    """Pink 'HEAD' pill with a triangle pointer.
    side='above': pin above the point, x = centre, triangle tip touches y.
    side='right': pin to the right of the point, y = centre, triangle tip touches x
                  (use in fork diagrams where there is no room above).
    Returns the pin's top y ('above') or right x ('right')."""
    pw, ph, tw, th = 0.86 * s, 0.34 * s, 0.20 * s, 0.13 * s
    sz = max(10, round(13 * s))
    if side == 'right':
        cxt = x + th / 2 + 0.01
        box(sl, cxt - tw / 2, y - th / 2, tw, th, fill=PINK,
            shape=MSO_SHAPE.ISOSCELES_TRIANGLE, rot=270)
        chip(sl, x + th - 0.01, y - ph / 2, pw, ph, 'HEAD', fill=PINK, size=sz)
        return x + th + pw
    box(sl, x - tw / 2, y - th - 0.01, tw, th, fill=PINK, shape=MSO_SHAPE.FLOWCHART_MERGE)
    top = y - th - ph + 0.01
    chip(sl, x - pw / 2, top, pw, ph, 'HEAD', fill=PINK, size=sz)
    return top


def head_pin_on(sl, f, side='above'):
    """HEAD pin on a flag geometry returned by flag(): above it, or to its right."""
    if side == 'right':
        return head_pin(sl, f['r'] + 0.06, f['cy'] - 0.03, side='right')
    return head_pin(sl, f['cx'], f['t'] - 0.02)


def conflict_tag(sl, g, row=1, txt='CONFLICT'):
    """Red pill at card right + 0.12, centred on panel `row`."""
    s = max(g['s'], 0.75)
    w, h = 1.25 * s, 0.34 * s
    return chip(sl, g['r'] + 0.12, g['row_y'][row] - h / 2, w, h, txt, fill=RED,
                size=max(10, round(13 * s)))


def wall(sl, x, y, w, h, title='THE WALL  ·  GitHub'):
    """Remote: BLUE_T rounded zone, 2 pt BLUE line, label pill on the top edge."""
    box(sl, x, y, w, h, fill=BLUE_T, line=BLUE, lw=2, radius=0.18)
    pw = chip_w(title, 14)
    chip(sl, x + (w - pw) / 2, y - 0.19, pw, 0.38, title, fill=BLUE, color=INK, size=14)
    return dict(x=x, y=y, w=w, h=h, l=x, r=x + w, t=y, b=y + h, cx=x + w / 2, cy=y + h / 2)


def table_zone(sl, x, y, w, h, title):
    """A lab's table: PANEL zone with a small caps label."""
    box(sl, x, y, w, h, fill=PANEL, line='CCCCCC', lw=1.25, radius=0.14)
    text(sl, x + 0.18, y + 0.10, w - 0.36, 0.32, title.upper(), size=13, bold=True,
         color=INK2, anchor='m', markup=False)
    return dict(x=x, y=y, w=w, h=h, l=x, r=x + w, t=y, b=y + h, cx=x + w / 2, cy=y + h / 2)


def push_arrow(sl, x1, y1, x2, y2):
    """push = 3 pt purple arrow."""
    return arrow(sl, x1, y1, x2, y2, color=PURPLE, w=3)


def fetch_arrow(sl, x1, y1, x2, y2):
    """pull / clone / fetch = 2.5 pt blue dashed arrow."""
    return arrow(sl, x1, y1, x2, y2, color=BLUE, w=2.5, dash=True)


def bracket(sl, x, y1, y2, side='right', color=INK2, w=1.5, arm=0.14):
    """Square bracket spanning y1..y2 at x (opens toward the content)."""
    d = arm if side == 'left' else -arm
    line(sl, x, y1, x, y2, color=color, w=w)
    line(sl, x, y1, x + d, y1, color=color, w=w)
    line(sl, x, y2, x + d, y2, color=color, w=w)


def merge3(base, a, b):
    """Panel-by-panel three-way merge -> (merged, marks_a, marks_b, marks_merged)."""
    out, ma, mb, mm = [], {}, {}, {}
    for i, (x, y, z) in enumerate(zip(base, a, b)):
        if y != x:
            ma[i] = 'changed'
        if z != x:
            mb[i] = 'changed'
        if y == z:
            out.append(y)
            if y != x:
                mm[i] = 'auto'
        elif y == x:
            out.append(z); mm[i] = 'auto'
        elif z == x:
            out.append(y); mm[i] = 'auto'
        else:
            out.append('❓'); mm[i] = 'conflict'
    return out, ma, mb, mm


# =============================================================== terminal
def term_panel(sl, x, y, w, h, lines, size=20, title=None, pitch=None):
    """Dark terminal panel with window dots. lines: each item is
       'text' (output) | (kind, text) | [(kind, text), ...] segments.
       kinds: cmd (gets a '$ ' prompt) | out | err | ok | mark | hi | dim | prompt.
    Exact line pitch (1.3 x size) so callers can align chips: returns geometry with
    line_y(i) -> vertical centre of line i and 'text_x', 'pitch'."""
    box(sl, x, y, w, h, fill=TERM, radius=0.16)
    for i, col in enumerate(('FF5F57', 'FEBC2E', '28C840')):
        box(sl, x + 0.25 + i * 0.25, y + 0.20, 0.15, 0.15, fill=col, shape=MSO_SHAPE.OVAL)
    if title:
        text(sl, x + 1.15, y + 0.12, w - 1.4, 0.32, title, size=14, color=CODE['prompt'],
             font=MONO, anchor='m', markup=False)
    pitch = pitch or round(size * 1.3, 1)
    paras = []
    for ln in lines:
        segs = [('out', ln)] if isinstance(ln, str) else ([ln] if isinstance(ln, tuple) else ln)
        runs = []
        for j, (kind, t) in enumerate(segs):
            if kind == 'cmd' and j == 0:
                runs.append(('$ ', {'color': CODE['prompt']}))
            runs.append((t if t else ' ', {'color': CODE[kind]}))
        paras.append(runs)
    tx, ty = x + 0.30, y + 0.58
    text(sl, tx, ty, w - 0.55, h - 0.70, paras, size=size, font=MONO, pitch=pitch,
         color=CODE['out'], markup=False)
    p_in = pitch / 72.0
    return dict(x=x, y=y, w=w, h=h, r=x + w, b=y + h, text_x=tx, text_y=ty, pitch=p_in,
                line_y=lambda i: ty + (i + 0.5) * p_in,
                char_w=text_width('M', size, False, MONO))


def term_chip(sl, g, i, col, txt='auto', fill=GREEN, color=WHITE):
    """Small chip on terminal line i, starting at character column `col`."""
    cy = g['line_y'](i)
    return chip(sl, g['text_x'] + col * g['char_w'], cy - 0.15, chip_w(txt, 13, pad=0.12),
                0.30, txt, fill=fill, color=color, size=13)


# =============================================================== layouts (spec 9.4)
def title_slide(prs, title, subtitle=None, who='Shubham & Ananya',
                topic='Git Week · Implementation Day', notes=None, subtitle_size=26):
    """White title slide with Sarah's footer row and purple bar (italic topic)."""
    sl = blank(prs)
    text(sl, M, 2.30, CW, 1.40, title, size=60, align='c', anchor='b', ls=1.0)
    if subtitle:
        text(sl, M, 3.85, CW, 0.70, subtitle, size=subtitle_size, color=INK2, align='c')
    text(sl, 0.30, 6.20, 6.70, 0.55, [[('CS294: ', {}), ('Modern Programming Tools',
                                                         {'bold': True})]],
         size=26, color=MUTED, anchor='m')
    text(sl, 7.05, 6.20, 2.60, 0.55, 'UC Berkeley', size=26, color=MUTED, align='c',
         anchor='m')
    text(sl, 9.65, 6.20, 3.38, 0.55, who, size=26, color=MUTED, align='r', anchor='m')
    box(sl, 0, 6.81, W, 0.48, fill=PURPLE)
    text(sl, 0.30, 6.81, W - 0.60, 0.48, topic, size=26, italic=True, color=WHITE,
         align='r', anchor='m')
    return _set_notes(sl, notes)


def divider(prs, title, color=PINK, kicker=None, sub=None, notes=None, center=3.60):
    """Full-bleed section colour; INK text (white on purple/navy). The kicker + title + sub
    group is centred on y=`center` (slightly above the middle); long titles balance onto
    two lines."""
    sl = blank(prs, color)
    fg = WHITE if color in DIVIDER_ON_DARK else INK
    paras = balanced(title, CW, 60, code_color=fg)
    n = lines_needed(paras, CW, 60)
    lh = 60 * 1.21 / 72
    kh = 0.62 if kicker else 0.0
    sh = 0.85 if sub else 0.0
    top = center - (kh + n * lh + sh) / 2
    if kicker:
        text(sl, M, top, CW, 0.50, kicker, size=24, bold=True, color=fg, align='c',
             anchor='b')
    text(sl, M, top + kh - 0.05, CW, n * lh + 0.10, paras, size=60, color=fg, align='c',
         anchor='m', ls=1.0, code_color=fg)
    if sub:
        text(sl, M, top + kh + n * lh + 0.25, CW, 0.60, sub, size=28, color=fg, align='c',
             anchor='t', code_color=fg, balance=True)
    return _set_notes(sl, notes)


def task(prs, step, instruction, lines=(), minutes=None, visual=False, step_label=None,
         total=9, notes=None):
    """Lavender TASK slide: step chip, timer chip, 44 pt instruction (balanced, <= 2-3
    lines), up to 3 numbered sub-steps (28 pt), progress dots. visual=True -> 6.6 in text
    column, 40 pt instruction, visual zone VISUAL_ZONE = x 7.75-12.58, y 1.55-6.45."""
    sl = blank(prs, LAVENDER)
    step_chip(sl, step_label or f'STEP {step}')
    if minutes is not None:
        timer_chip(sl, minutes)
    tw = TEXT_COL if visual else CW
    sizes = (40, 36, 32) if visual else (44, 40, 36)
    isz = fit_size(instruction, tw, 2.25, sizes, bold=True, ls=1.05)
    text(sl, M, 1.55, tw, 2.25, instruction, size=isz, bold=True, ls=1.05, balance='widow')
    if lines:
        numbered(sl, M, 4.00, tw, list(lines), size=28, gap=0.10)
    vx, vy, vw, vh = VISUAL_ZONE
    sl.zone = _zone(vx, vy, vx + vw, vy + vh) if visual else None
    if isinstance(step, int):
        progress(sl, step, total)
    return _set_notes(sl, notes)


def talk(prs, command, meaning, kicker='You just invented', pause=None, step=None,
         total=9, notes=None):
    """White TALK slide: kicker, purple mono command, meaning (balanced), diagram zone,
    pause bar, progress dots. Diagram zone: x 0.75-12.58, y 3.75-6.00 (cards s=0.85, top
    3.85); with a one-line meaning a fork diagram may start at y 3.10. A two-line pause
    bar starts at y 5.90 instead of 6.20 (pause_bar returns its top)."""
    sl = blank(prs)
    text(sl, M, TOP, CW, 0.50, kicker, size=24, color=INK2, anchor='m')
    csz = fit_size(command, CW, 1.05, (54, 48, 44), bold=True, font=MONO, max_lines=1,
                   markup=False)
    text(sl, M, 1.12, CW, 1.05, command, size=csz, bold=True, color=PURPLE, font=MONO,
         anchor='m', markup=False)
    msz = fit_size(meaning, CW, 1.20, (32, 30, 28), ls=1.12)
    text(sl, M, 2.30, CW, 1.20, meaning, size=msz, ls=1.12, balance='widow')
    mlines = lines_needed(balanced(meaning, CW, msz, mode='widow'), CW, msz)
    zt = 2.30 + mlines * msz * 1.21 * 1.12 / 72 + 0.25
    zb = (pause_bar(sl, pause) - 0.20) if pause else 6.90
    sl.zone = _zone(M, zt, R, zb)
    if isinstance(step, int):
        progress(sl, step, total, y=7.12)
    return _set_notes(sl, notes)


def _zone(l, t, r, b):
    return dict(l=l, t=t, r=r, b=b, w=r - l, h=b - t, cx=(l + r) / 2, cy=(t + b) / 2)


def fit_scale(zone, rows=1, extra=0.0, max_s=0.85, gap=0.14):
    """Largest card scale (<= max_s) so `rows` stacked cards plus `extra` inches (flags,
    captions) fit the zone's height."""
    return round(min(max_s, (zone['h'] - extra - (rows - 1) * gap) / (rows * CARD_H)), 3)


def card_top(zone, s, extra_top=0.0, extra_bottom=0.0):
    """y that vertically centres a card of scale s (plus extras above/below) in zone."""
    hh = CARD_H * s + extra_top + extra_bottom
    return zone['t'] + (zone['h'] - hh) / 2 + extra_top


def conflict(prs, base=('smiley', 'box', 'sticks'), left=('cat', 'robot', 'sticks'),
             right=('smiley', 'superhero', 'tentacles'),
             labels=('BASE', 'CAT-ROBOT', 'SUPERHERO', 'MERGED'),
             ids=('#1', '#2', '#3', '#4'), command='git merge', kicker='You just invented',
             rule=None, pause=None, step=None, total=9, notes=None):
    """The T12 CONFLICT layout: BASE | LEFT + RIGHT = MERGED. The merged card is computed
    panel by panel against BASE (green = auto-merged, red dashed ❓ + CONFLICT pill)."""
    sl = blank(prs)
    text(sl, M, 0.42, CW, 0.40, kicker, size=24, color=INK2, anchor='m')
    text(sl, M, 0.80, CW, 1.05, command, size=54, bold=True, color=PURPLE, font=MONO,
         anchor='m', markup=False)
    merged, ma, mb, mm = merge3([_emo(p) for p in base], [_emo(p) for p in left],
                                [_emo(p) for p in right])
    y0 = 2.25
    xs = (1.85, 4.45, 6.75, 9.05)
    par = ('—', ids[0], ids[0], f'{ids[1]} + {ids[2]}')
    gb = card(sl, xs[0], y0, ids[0], base, parent=par[0])
    ga = card(sl, xs[1], y0, ids[1], left, parent=par[1], marks=ma)
    gr = card(sl, xs[2], y0, ids[2], right, parent=par[2], marks=mb)
    gm = card(sl, xs[3], y0, ids[3], merged, parent=par[3], marks=mm)
    for g, lab in zip((gb, ga, gr, gm), labels):
        text(sl, g['cx'] - 1.1, 1.80, 2.2, 0.34, lab.upper(), size=15, bold=True,
             color=MUTED, align='c', anchor='m', markup=False)
    row_labels(sl, gb)
    hairline(sl, 4.05, 1.85, 4.05, y0 + CARD_H)
    glyph(sl, '+', 6.45, gb['cy'])
    glyph(sl, '=', 8.75, gb['cy'])
    for row, mk in mm.items():
        if mk == 'conflict':
            conflict_tag(sl, gm, row)
    if rule is None:
        rule = [[('One side changed → ', {}), ('take it.', {'color': GREEN})],
                [('Both changed differently → ', {}), ('you decide.', {'color': RED})]]
    text(sl, M, 4.98, CW, 1.00, rule, size=28, bold=True, ls=1.0)
    if pause:
        pause_bar(sl, pause)
    if isinstance(step, int):
        progress(sl, step, total, y=7.12)
    return _set_notes(sl, notes)


def menti(prs, question, options=None, code='____ ____', chip_label='📊  Live poll',
          qr=None, chips=None, notes=None, size=None):
    """MENTI slide: chip, question (44 Bold, left column, balanced), QR box + code chip on
    the right, options A-D (26 pt) or `chips` (mono ranking chips, wrapping rows)."""
    sl = blank(prs)
    menti_chip(sl, label=chip_label)
    qh = 3.30 if (options or chips) else 4.80
    qsz = size or fit_size(question, 8.10, qh, (44, 40, 36), bold=True, ls=1.08)
    text(sl, M, 1.40, 8.10, qh, question, size=qsz, bold=True, anchor='m', ls=1.08,
         balance='widow')
    if qr and os.path.exists(qr):
        sl.shapes.add_picture(qr, Inches(9.333), Inches(1.40), Inches(3.25), Inches(3.25))
    else:
        b = box(sl, 9.333, 1.40, 3.25, 3.25, fill=WHITE, line='BBBBBB', lw=2, dash=True,
                radius=0.12)
        label(b, 'QR', size=24, bold=True, color=MUTED)
    chip(sl, 9.333, 4.85, 3.25, 0.60, f'menti.com  ·  {code}', size=18)
    if options:
        numbered(sl, M, 4.95, 8.10, list(options)[:4], size=26, marks='ABCD', gap=0.06)
    if chips:
        xx, yy = M, 5.0
        for c in chips:
            wch = chip_w(c, 22, True, MONO, pad=0.18)
            if xx + wch > M + 8.1:
                xx, yy = M, yy + 0.80
            mono_chip(sl, xx, yy, c, size=22)
            xx += wch + 0.22
    return _set_notes(sl, notes)


def terminal(prs, lines, title=None, pause=None, size=20, file_title=None, notes=None):
    """Full-width TERMINAL slide (<= 11 lines at 20 pt, ~66 chars/line).
    Returns (slide, panel_geometry)."""
    sl = blank(prs)
    if title:
        text(sl, M, 0.55, CW, 0.80, title, size=36, bold=True, anchor='m')
    ph = 4.40 if pause else 5.10
    g = term_panel(sl, M, 1.60, CW, ph, lines, size=size, title=file_title)
    if pause:
        pause_bar(sl, pause)
    _set_notes(sl, notes)
    return sl, g


def terminal_split(prs, title, left, right, left_title=None, right_title=None, pause=None,
                   size=20, widths=(5.60, 5.85), notes=None):
    """Two terminal panels side by side (x 0.75 and 6.73). Returns (slide, gL, gR)."""
    sl = blank(prs)
    text(sl, M, 0.55, CW, 0.80, title, size=36, bold=True, anchor='m')
    ph = 4.40 if pause else 5.10
    gl = term_panel(sl, M, 1.60, widths[0], ph, left, size=size, title=left_title)
    gr = term_panel(sl, R - widths[1], 1.60, widths[1], ph, right, size=size, title=right_title)
    if pause:
        pause_bar(sl, pause)
    _set_notes(sl, notes)
    return sl, gl, gr


def statement(prs, content, kicker=None, sub=None, size=54, notes=None):
    """Big centred statement (balanced lines). Colour ONE key phrase purple with [[...]]."""
    sl = blank(prs)
    sizes = tuple(s for s in (size, 48, 44, 40) if s <= size)
    ssz = fit_size(content, CW, 3.0, sizes, bold=True, ls=1.08)
    if kicker:
        text(sl, M, 1.40, CW, 0.50, kicker, size=24, color=INK2, align='c', anchor='m')
    text(sl, M, 2.00, CW, 3.00, content, size=ssz, bold=True, align='c', anchor='m', ls=1.08,
         balance=True)
    if sub:
        text(sl, M, 5.25, CW, 0.60, sub, size=24, color=MUTED, align='c', anchor='t',
             balance=True)
    return _set_notes(sl, notes)


def content(prs, title, items=None, lead=None, marks=None, size=30, body=None,
            pause=None, notes=None):
    """STATEMENT / CONTENT slide: 40 Bold title, optional lead line, then <= 5 short rows.
    marks: None -> 1 2 3 (goals list) | list of hex colours -> coloured dots |
    list of short strings (e.g. 'RQ1') -> INK tags. body: free text instead of rows."""
    sl = blank(prs)
    text(sl, M, 0.45, CW, 0.85, title, size=40, bold=True, anchor='m')
    y = 1.65
    if lead:
        text(sl, M, y, CW, 0.50, lead, size=26, color=INK2, anchor='m')
        y += 0.85
    if body:
        text(sl, M, y, CW, 6.0 - y, body, size=size, ls=1.15)
    if items:
        if marks and all(isinstance(m, str) and not re.fullmatch(r'[0-9A-Fa-f]{6}', m)
                         for m in marks):
            tagw = max(chip_w(m, 15) for m in marks)
            yy = y
            for m, it in zip(marks, items):
                hh = measure(it, CW - tagw - 0.3, size, ls=1.1)
                chip(sl, M, yy + (size / 72 * 1.21 * 1.1 - 0.36) / 2 + 0.01, tagw, 0.36, m,
                     fill=INK, size=15)
                text(sl, M + tagw + 0.3, yy, CW - tagw - 0.3, hh + 0.02, it, size=size,
                     ls=1.1)
                yy += hh + 0.26
        else:
            numbered(sl, M, y, CW, list(items), size=size, marks=marks, gap=0.22,
                     mark_w=0.55)
    if pause:
        pause_bar(sl, pause)
    return _set_notes(sl, notes)


goals = content


def two_column(prs, title=None, left_label=None, right_label=None, left=None, right=None,
               kicker=None, command=None, meaning=None, pause=None, step=None, total=9,
               size=26, label_size=20, label_colors=(INK, INK), notes=None):
    """Two halves split by a hairline at x 6.67.
    Title mode   : 40 Bold `title`, half labels at y 1.40, zones from y 1.95.
    Command mode : command='git revert' -> TALK header (kicker, purple mono command, one-line
                   meaning), half labels below it.
    left/right: optional text for each half; otherwise draw diagrams into the zones.
    Returns (slide, zoneL, zoneR); zones are dicts l r t b w cx cy."""
    sl = blank(prs)
    if command:
        text(sl, M, TOP, CW, 0.50, kicker or 'You just invented', size=24, color=INK2,
             anchor='m')
        text(sl, M, 1.12, CW, 1.05, command, size=54, bold=True, color=PURPLE, font=MONO,
             anchor='m', markup=False)
        ly = 2.35
        if meaning:
            msz = fit_size(meaning, CW, 0.60, (32, 30, 28, 26), max_lines=1)
            text(sl, M, 2.30, CW, 0.60, meaning, size=msz, anchor='m')
            ly = 3.15
    else:
        ty = 0.45
        if kicker:
            text(sl, M, 0.30, CW, 0.40, kicker, size=20, color=INK2, anchor='m')
            ty = 0.62
        text(sl, M, ty, CW, 0.80, title, size=40, bold=True, anchor='m')
        ly = 1.40
    bottom = (pause_bar(sl, pause) - 0.20) if pause else 6.80
    hairline(sl, 6.67, ly, 6.67, bottom)
    zt = ly + 0.55
    zl = dict(l=M, r=6.40, t=zt, b=bottom, w=6.40 - M, cx=(M + 6.40) / 2, cy=(zt + bottom) / 2)
    zr = dict(l=6.95, r=R, t=zt, b=bottom, w=R - 6.95, cx=(6.95 + R) / 2, cy=(zt + bottom) / 2)
    for z, lab, col in ((zl, left_label, label_colors[0]), (zr, right_label, label_colors[1])):
        if lab:
            text(sl, z['l'], ly, z['w'], 0.40, lab, size=label_size, bold=True, color=col,
                 anchor='m')
    for z, body in ((zl, left), (zr, right)):
        if body:
            text(sl, z['l'], zt + 0.05, z['w'], z['b'] - zt, body, size=size, ls=1.18, gap=10)
    if isinstance(step, int):
        progress(sl, step, total, y=7.12)
    _set_notes(sl, notes)
    return sl, zl, zr


def paper(prs, title, sub, cols, bottom=None, notes=None):
    """T30 PAPER: title 40 Bold, 20 pt subline, three columns (w 3.78 at x 0.75 / 4.78 /
    8.80). cols: [(header, header_colour, body, step_tag), ...]."""
    sl = blank(prs)
    tsz = fit_size(title, CW, 0.85, (40, 36, 32), bold=True, max_lines=1)
    text(sl, M, 0.45, CW, 0.85, title, size=tsz, bold=True, anchor='m')
    text(sl, M, 1.28, CW, 0.40, sub, size=20, color=MUTED, anchor='m')
    for (hd, hc, body, tag), x in zip(cols, (0.75, 4.78, 8.80)):
        box(sl, x, 2.05, 3.78, 0.07, fill=hc)
        text(sl, x, 2.30, 3.78, 0.50, hd, size=24, bold=True, color=hc, anchor='m')
        text(sl, x, 2.95, 3.78, 1.90, body, size=24, ls=1.15)
        if tag:
            text(sl, x, 4.95, 3.78, 0.40, tag, size=16, color=MUTED, anchor='m')
    if bottom:
        hairline(sl, M, 5.75, R, 5.75)
        text(sl, M, 5.95, CW, 0.55, bottom, size=24, anchor='m')
    return _set_notes(sl, notes)


def grid(sl, x, y, cols, heads, rows, pitch=0.54, size=20, head_size=15, rule=HAIR, pad=0.08):
    """Shape-drawn table (no pptx table). cols: [(w, style)], style 'ink' | 'ink2' | 'cmd' |
    'quote'. heads: caps headers in MUTED. Rows grow to fit wrapped cells. Returns bottom y."""
    style = {'ink': dict(color=INK), 'ink2': dict(color=INK2),
             'cmd': dict(color=PURPLE, bold=True, font=MONO), 'quote': dict(color=INK, bold=True)}
    xs, xx = [], x
    for w_, _ in cols:
        xs.append(xx)
        xx += w_ + 0.20
    right = xs[-1] + cols[-1][0]
    for (w_, _), cx, hd in zip(cols, xs, heads):
        text(sl, cx, y, w_, 0.40, hd.upper(), size=head_size, bold=True, color=MUTED,
             anchor='m', markup=False)
    yy = y + 0.45
    for row in rows:
        rh = pitch
        for (w_, st), cell in zip(cols, row):
            o = style[st]
            rh = max(rh, measure(cell, w_, size, o.get('bold', False), o.get('font', FONT),
                                 ls=1.05, markup=(st != 'cmd')) + 2 * pad)
        hairline(sl, x, yy, right, yy, color=rule)
        for (w_, st), cx, cell in zip(cols, xs, row):
            o = style[st]
            text(sl, cx, yy, w_, rh, cell, size=size, anchor='m', color=o['color'], ls=1.05,
                 bold=o.get('bold', False), font=o.get('font', FONT), markup=(st != 'cmd'),
                 balance='widow')
        yy += rh
    hairline(sl, x, yy, right, yy, color=rule)
    return yy


def recap(prs, rows, title='Every Git tool fixes one problem you felt',
          heads=('We felt…', 'We invented…', 'Git calls it'), notes=None):
    """RECAP mapping table (<= 9 rows): INK | INK2 | mono purple, hairline rules."""
    sl = blank(prs)
    text(sl, M, 0.45, CW, 0.85, title, size=40, bold=True, anchor='m')
    grid(sl, M, 1.55, [(3.95, 'ink'), (3.85, 'ink2'), (3.63, 'cmd')], heads, rows)
    return _set_notes(sl, notes)


def compare(prs, title, heads, rows, bottom=None, widths=(3.90, 7.73), pitch=0.80,
            notes=None):
    """Two-column table slide (H15 'Claimed vs measured'): bold left, INK2 right, 24 pt."""
    sl = blank(prs)
    text(sl, M, 0.45, CW, 0.85, title, size=40, bold=True, anchor='m')
    yb = grid(sl, M, 1.55, [(widths[0], 'quote'), (widths[1], 'ink2')], heads, rows,
              pitch=pitch, size=24)
    if bottom:
        text(sl, M, max(yb + 0.35, 5.70), CW, 0.60, bottom, size=28, bold=True, anchor='m')
    return _set_notes(sl, notes)


def pause(prs, question, rhythm='Think 1 min  ·  Pair 2 min  ·  Share', cases=None,
          notes=None):
    """PAUSE (think-pair-share): 💬, centred 44 Bold question, lavender rhythm chip.
    cases: list of strings -> T29 variant: 40 pt question, then 'a ·', 'b ·' rows (24 pt) in
    a centred block; the chip moves down if the rows need the room."""
    sl = blank(prs)
    if cases:
        text(sl, M, 0.50, CW, 0.80, '💬', size=48, align='c', anchor='m', markup=False)
        qsz = fit_size(question, 10.533, 1.60, (40, 36, 32), bold=True, ls=1.06)
        text(sl, 1.40, 1.35, 10.533, 1.60, question, size=qsz, bold=True, align='c',
             anchor='m', ls=1.06, balance=True)
        mk_w = 0.62
        widest = max(line_width(c, 24) for c in cases)
        bw = min(10.533, mk_w + widest + 0.25)
        bottom = numbered(sl, (W - bw) / 2, 3.25, bw, list(cases), size=24,
                          marks=['a ·', 'b ·', 'c ·', 'd ·'][:len(cases)], mark_w=mk_w,
                          gap=0.16)
        cy = max(5.50, bottom + 0.30)
    else:
        text(sl, M, 1.00, CW, 1.00, '💬', size=60, align='c', anchor='m', markup=False)
        qsz = fit_size(question, 10.533, 2.90, (44, 40, 36), bold=True, ls=1.08)
        text(sl, 1.40, 2.20, 10.533, 2.90, question, size=qsz, bold=True, align='c',
             anchor='m', ls=1.08, balance=True)
        cy = 5.50
    cw_ = max(6.20, chip_w(rhythm, 20))
    chip(sl, (W - cw_) / 2, cy, cw_, 0.56, rhythm, fill=LAVENDER, color=INK, size=20)
    return _set_notes(sl, notes)


def break_slide(prs, minutes=5, back_at='__:__', notes=None):
    """BREAK on yellow: ☕, 'N-minute break', 'Back at __:__'."""
    sl = blank(prs, YELLOW)
    text(sl, M, 1.85, CW, 1.30, '☕', size=72, align='c', anchor='m', markup=False)
    text(sl, M, 3.15, CW, 1.15, f'{minutes}-minute break', size=60, bold=True, align='c',
         anchor='m')
    text(sl, M, 4.40, CW, 0.60, f'Back at {back_at}', size=28, align='c', anchor='m',
         markup=False)
    return _set_notes(sl, notes)


def starry(prs, statement, kicker="If you're going to remember one thing…", small=None,
           seed=294, notes=None):
    """Sarah's dark starry 'one thing' slide (solid shapes only: glow, two hills, 95 stars).
    Stars keep clear of the text so every glyph stays crisp."""
    sl = blank(prs, NAVY)
    rnd = random.Random(seed)
    ssz = fit_size(statement, CW, 3.0, (54, 48, 44), bold=True, ls=1.1)
    # clear zones around the text
    clear = []

    def keep_clear(cx, cy, w_, h_, pad=0.18):
        clear.append((cx - w_ / 2 - pad, cy - h_ / 2 - pad, cx + w_ / 2 + pad, cy + h_ / 2 + pad))
    keep_clear(W / 2, 1.05, text_width(_smart(kicker), 36), 0.55)
    paras = balanced(statement, CW, ssz, bold=True, code_color=STAR_TEXT)
    lines_w, nl = [], 0
    for p in paras:
        cur = 0.0
        for t, o in p + [(BR, {})]:
            if t == BR:
                lines_w.append(cur); nl += 1; cur = 0.0
            else:
                cur += text_width(t, ssz, True, o.get('font', FONT))
    bh = nl * ssz * 1.21 * 1.1 / 72
    keep_clear(W / 2, 1.85 + 1.5, max(lines_w + [1.0]), bh)
    if small:
        keep_clear(W / 2, 5.25, text_width(_smart(small), 24), 0.40)
    box(sl, 2.6, 5.35, 8.2, 1.3, fill='12345A', shape=MSO_SHAPE.OVAL)
    box(sl, -2.5, 5.75, 10.5, 4.2, fill='071021', shape=MSO_SHAPE.OVAL)
    box(sl, 5.0, 5.55, 11.0, 4.6, fill='050B18', shape=MSO_SHAPE.OVAL)
    placed, tries = 0, 0
    while placed < 95 and tries < 5000:
        tries += 1
        d = rnd.choice((0.025, 0.03, 0.035, 0.045, 0.06))
        col = rnd.choices(('FFFFFF', 'CADCFF', '7F94B8'), weights=(4, 3.5, 2.5))[0]
        sx, sy = rnd.uniform(0.1, W - 0.1), rnd.uniform(0.08, 5.5)
        if any(a <= sx <= c and b <= sy <= d_ for a, b, c, d_ in clear):
            continue
        box(sl, sx, sy, d, d, fill=col, shape=MSO_SHAPE.OVAL)
        placed += 1
    text(sl, M, 0.60, CW, 0.90, kicker, size=36, color=WHITE, align='c', anchor='m')
    text(sl, M, 1.85, CW, 3.00, paras, size=ssz, bold=True, color=WHITE, align='c',
         anchor='m', ls=1.1, code_color=STAR_TEXT)
    if small:
        text(sl, M, 4.95, CW, 0.60, small, size=24, color=STAR_TEXT, align='c', anchor='m')
    return _set_notes(sl, notes)


# =============================================================== Thursday primitives
def funnel(sl, bars, x=M, y=1.75, widths=(5.5, 4.5, 3.5), h=0.75, gap=0.18, size=20):
    """Centred grey funnel bars (H6). Returns list of bar geometries."""
    cx = x + widths[0] / 2
    out = []
    for i, (txt, w_) in enumerate(zip(bars, widths)):
        yy = y + i * (h + gap)
        b = box(sl, cx - w_ / 2, yy, w_, h, fill=BAR_GREY, radius=0.10)
        label(b, txt, size=size, bold=False, color=INK)
        out.append(dict(l=cx - w_ / 2, r=cx + w_ / 2, t=yy, b=yy + h, cx=cx, cy=yy + h / 2))
    return out


def ladder(sl, rungs, pills=None, x=7.25, y=1.70, w=5.33, h=0.80, pitch=0.95, size=20,
           numbers=True):
    """Sarah's data ladder (H8/H9): stacked rounded bars, strongest evidence first.
    pills: {rung_index: (text, fill_hex, text_hex[, line_hex])} inside the bar's right end."""
    out = []
    for i, txt in enumerate(rungs):
        yy = y + i * pitch
        box(sl, x, yy, w, h, fill=BAR_GREY, radius=0.12)
        if numbers:
            text(sl, x + 0.22, yy, 0.40, h, str(i + 1), size=size, bold=True, color=MUTED,
                 anchor='m', markup=False)
        text(sl, x + (0.62 if numbers else 0.25), yy, w - 0.9, h, txt, size=size,
             anchor='m')
        if pills and i in pills:
            pt, pf, pc = pills[i][:3]
            pl = pills[i][3] if len(pills[i]) > 3 else None
            pw = chip_w(pt, 15)
            chip(sl, x + w - pw - 0.18, yy + (h - 0.40) / 2, pw, 0.40, pt, fill=pf, color=pc,
                 size=15, line=pl, lw=1.25)
        out.append(dict(l=x, r=x + w, t=yy, b=yy + h, cy=yy + h / 2))
    return out


def quote_card(sl, x, y, w, h, quote, ref, color=PINK, size=22):
    """Quote card: square card, 6 pt coloured top border, italic quote, page reference."""
    box(sl, x, y, w, h, fill=WHITE, line=PANEL_LINE, lw=1)
    box(sl, x, y, w, 0.08, fill=color)
    text(sl, x + 0.25, y + 0.38, w - 0.5, h - 0.98, quote, size=size, italic=True, ls=1.12)
    text(sl, x + 0.25, y + h - 0.52, w - 0.5, 0.30, ref, size=14, color=MUTED, anchor='m')


def fork(sl, root, tips, x=3.0, top=3.12, s=0.54, dx=3.2, gap=0.14):
    """Fork diagram: root card on the left, tip cards stacked on the right (centred on the
    root), each with a parent arrow back to the root. root / tips: card() kwargs.
    Returns (root_geometry, [tip_geometries])."""
    hh = CARD_H * s
    total = len(tips) * hh + (len(tips) - 1) * gap
    g0 = card(sl, x, top + (total - hh) / 2, s=s, **dict(root))
    gs = []
    for i, kw in enumerate(tips):
        g = card(sl, x + dx, top + i * (hh + gap), s=s, **dict(kw))
        link(sl, g, g0)
        gs.append(g)
    return g0, gs


def wall_scene(sl, y=1.85, h=3.60, left='Lab 1 table', right='Lab 2 table',
               wall_title='THE WALL  ·  GitHub', zone_w=3.20, wall_w=4.25):
    """Two tables and the Wall side by side, equal gaps, spanning x 0.75-12.58.
    Full diagram slide: defaults (spec's verified 3.2 / 4.25 / 3.18 widths).
    Inside a TALK slide's diagram band: wall_scene(sl, y=3.72, h=2.26, zone_w=3.0, wall_w=3.0).
    Returns dict(left, wall, right) geometries plus 'gap_l' / 'gap_r' = (x_from, x_to)."""
    gapw = (CW - 2 * zone_w - wall_w) / 2
    lz = table_zone(sl, M, y, zone_w, h, left)
    wz = wall(sl, M + zone_w + gapw, y, wall_w, h, wall_title)
    rz = table_zone(sl, R - zone_w, y, zone_w, h, right)
    return dict(left=lz, wall=wz, right=rz, gap_l=(lz['r'], wz['l']), gap_r=(wz['r'], rz['l']))


# =============================================================== QA: audit + render
def _shape_runs(shape):
    tf = shape.text_frame
    paras = []
    for p in tf.paragraphs:
        runs = []
        for el in p._p:
            if el.tag == qn('a:br'):
                bp = el.find(qn('a:rPr'))
                runs.append((BR, int(bp.get('sz', '1200')) / 100 if bp is not None else 12,
                             False, FONT, False))
                continue
            if el.tag != qn('a:r'):
                continue
            rPr = el.find(qn('a:rPr'))
            t = el.find(qn('a:t'))
            sz = int(rPr.get('sz', '1800')) / 100 if rPr is not None else 18
            b = rPr is not None and rPr.get('b') in ('1', 'true')
            it = rPr is not None and rPr.get('i') in ('1', 'true')
            lat = rPr.find(qn('a:latin')) if rPr is not None else None
            fn = lat.get('typeface') if lat is not None else FONT
            runs.append((t.text if t is not None and t.text else '', sz, b, fn, it))
        ls = p.line_spacing
        pitch = ls.pt if hasattr(ls, 'pt') else None
        mult = ls if isinstance(ls, float) else None
        sb = p.space_before.pt if p.space_before is not None else 0
        paras.append((runs, mult, pitch, sb))
    return paras


def audit(prs, tol=0.03):
    """Estimate wrapped height of every text frame with the real font metrics and report
    any that overflow their box, text boxes that leave the canvas, and missing notes."""
    issues = []
    for si, sl in enumerate(prs.slides, 1):
        if not (sl.has_notes_slide and sl.notes_slide.notes_text_frame.text.strip()):
            issues.append(f'slide {si}: no speaker notes (spec 9.6: every slide has notes)')
        for shp in sl.shapes:
            if not shp.has_text_frame or not shp.text_frame.text.strip():
                continue
            tf = shp.text_frame
            x, y = Emu(shp.left).inches, Emu(shp.top).inches
            w, h = Emu(shp.width).inches, Emu(shp.height).inches
            ml = (tf.margin_left or 0) / 914400
            mr = (tf.margin_right or 0) / 914400
            mt = (tf.margin_top or 0) / 914400
            mb = (tf.margin_bottom or 0) / 914400
            inner_w, inner_h = w - ml - mr, h - mt - mb
            need = 0.0
            for i, (runs, mult, pitch, sb) in enumerate(_shape_runs(shp)):
                if not runs or not ''.join(r[0] for r in runs).strip():
                    runs = runs or [(' ', 18, False, FONT, False)]
                n = _wrap_count(runs, inner_w)
                need += n * _line_h(runs, mult, pitch) + (sb / 72 if i else 0)
            snippet = tf.text.strip().replace('\n', ' / ')[:48]
            if need > inner_h + tol and not shp.rotation:
                issues.append(f'slide {si}: overflow {need:.2f} > {inner_h:.2f} in  '
                              f'"{snippet}"')
            if x < -0.01 or y < -0.01 or x + w > W + 0.01 or y + h > H + 0.01:
                issues.append(f'slide {si}: off-canvas text box "{snippet}"')
    return issues


def render(pptx_path, outdir, prefix='s', profile='lo_style', sheet=True, timeout=900):
    """PNG per slide (1280 x 720) WITH colour emoji. LibreOffice 7.3 drops Noto Color Emoji
    in PDF export, so each slide is saved as a one-slide deck and converted straight to PNG
    with a private profile (-env:UserInstallation=file:///tmp/<profile>)."""
    os.makedirs(outdir, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='split_')
    n = len(Presentation(pptx_path).slides)
    files = []
    for i in range(n):
        prs = Presentation(pptx_path)
        lst = prs.slides._sldIdLst
        for j, sid in reversed(list(enumerate(list(lst)))):
            if j != i:
                prs.part.drop_rel(sid.rId)
                lst.remove(sid)
        f = os.path.join(tmp, f'{prefix}-{i + 1:02d}.pptx')
        prs.save(f)
        files.append(f)
    subprocess.run(['soffice', f'-env:UserInstallation=file:///tmp/{profile}', '--headless',
                    '--convert-to', 'png', '--outdir', outdir] + files,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
                   timeout=timeout)
    shutil.rmtree(tmp, ignore_errors=True)
    pngs = [os.path.join(outdir, f'{prefix}-{i + 1:02d}.png') for i in range(n)]
    if sheet:
        contact_sheet(pngs, os.path.join(outdir, f'{prefix}-sheet.png'))
    return pngs


def contact_sheet(pngs, out, cols=4, thumb=480):
    """Grid of thumbnails for a quick overview."""
    try:
        from PIL import Image, ImageDraw
    except Exception:
        return None
    ims = [Image.open(p).convert('RGB') for p in pngs if os.path.exists(p)]
    if not ims:
        return None
    tw, th = thumb, int(thumb * 9 / 16)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tw + 12) + 12, rows * (th + 34) + 12), (120, 120, 120))
    d = ImageDraw.Draw(sheet)
    for k, im in enumerate(ims):
        r_, c_ = divmod(k, cols)
        x0, y0 = 12 + c_ * (tw + 12), 12 + r_ * (th + 34)
        sheet.paste(im.resize((tw, th)), (x0, y0 + 22))
        d.text((x0, y0 + 4), str(k + 1), fill=(255, 255, 255))
    sheet.save(out)
    return out


__all__ = [n for n in dir() if not n.startswith('_')]
