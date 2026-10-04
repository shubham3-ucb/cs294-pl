"""Builds style_sample.pptx: one slide per layout / primitive of style.py, then renders it."""
import sys
sys.path.insert(0, '/home/shagarw_google_com/shubham/git_course/slides/build')
from style import *

OUT = '/home/shagarw_google_com/shubham/git_course/slides/build/style_sample.pptx'
REN = '/home/shagarw_google_com/shubham/git_course/slides/renders/sample'
prs = new_deck()

# 1 TITLE
title_slide(prs, 'Monster Lab', 'Build Git out of paper',
            notes='No Git lecture today. You will rebuild Git out of paper.')

# 2-4 DIVIDERS
divider(prs, 'One table', PINK, kicker='PART 1', notes='Part 1: one team, one table.')
divider(prs, 'Many tables', BLUE, kicker='PART 2', notes='Part 2.')
divider(prs, 'Is the research question even interesting?', PINK,
        sub='They counted commands. People have goals.', notes='H16 variant: two-line title + sub.')

# 5 TASK (text only)
task(prs, 0, 'Draw one monster. Together. One sheet.',
     ['Open your secret slip', 'Pencils only', 'Go!'], minutes='1:30',
     notes='Call "Forty-five seconds!" at 0:45, stop at 1:30.')

# 6 TASK with visual zone
sl = task(prs, 3, 'The Client wants ONE monster with both ideas.',
          ['One new card. Never erase.', 'Which panels need a talk?',
           'Disagree? Red ❓, then decide.'], minutes=5, visual=True,
          notes='Visual zone variant: 40 pt instruction, cards on the right.')
vx, vy, vw, vh = VISUAL_ZONE
cy0 = vy + (vh - CARD_H * 0.9 - 0.45) / 2
a = card(sl, 8.15, cy0, '#2', ('cat', 'robot', 'sticks'), parent='#1', author='Lab A', s=0.9)
b = card(sl, 10.45, cy0, '#3', ('smiley', 'superhero', 'tentacles'), parent='#1',
         author='Lab B', s=0.9)
caption(sl, a, 'cat-robot', size=16)
caption(sl, b, 'superhero', size=16)

# 7 TALK: git commit (card states)
sl = talk(prs, 'git commit', 'Never erase. Every change = a new card of the **whole** monster.',
          pause='You pencilled a new FACE and a new BODY. Only FACE is ready. What goes on the next card?',
          step=0, notes='A commit is a snapshot, not a diff.')
z = sl.zone
s = fit_scale(z)
y0 = card_top(z, s)
xs = [1.35, 5.05, 8.75]
g1 = card(sl, xs[0], y0, panels=('cat', 'robot', 'sticks'), state='sketch', s=s)
g2 = card(sl, xs[1], y0, panels=('cat', 'box', 'sticks'), state='staged', s=s,
          marks={0: 'changed'})
g3 = card(sl, xs[2], y0, '#2', ('cat', 'box', 'sticks'), parent='#1', s=s, marks={0: 'changed'})
for g, lab in zip((g1, g2, g3), ('working copy', 'git add', 'git commit')):
    text(sl, g['r'] + 0.22, g['cy'] - 0.2, 1.95, 0.4, lab, size=18, bold=True, color=PURPLE,
         font=MONO, anchor='m', markup=False)

# 8 TALK: git log (history row)
sl = talk(prs, 'git log', 'Each card points to its parent. History = follow the arrows back.',
          pause='Why do the arrows point backward, never forward?', step=1,
          notes='Git keeps no separate history list.')
s = 0.85
gs = []
for i, (cid, pan, au, par) in enumerate([('W', ('smiley', 'box', 'sticks'), 'Ken', '—'),
                                         ('X', ('horns', 'box', 'sticks'), 'Barbara', 'W'),
                                         ('Y', ('horns', 'box', 'wheels'), 'Margaret', 'X')]):
    gs.append(card(sl, 3.05 + i * 2.85, card_top(sl.zone, s), cid, pan, parent=par, author=au,
                   s=s))
for c1, c0 in zip(gs[1:], gs[:-1]):
    link(sl, c1, c0)
row_labels(sl, gs[0], size=13)

# 9 TALK fork: git branch + HEAD + flags on the right edge
sl = talk(prs, 'git branch', 'A branch is a flag on a card. HEAD = you are here.',
          pause='Pin HEAD on a card with no flag, draw a card, then switch back. Where is your new card?',
          step=2, notes='Fork diagram: flags on the tip cards\' right edge.')
g0, (t1, t2) = fork(sl, dict(cid='#1', panels=('smiley', 'box', 'sticks'), parent='—'),
                    [dict(cid='#2', panels=('cat', 'robot', 'sticks'), parent='#1'),
                     dict(cid='#3', panels=('smiley', 'superhero', 'tentacles'), parent='#1')],
                    x=2.6, top=3.10, s=0.54, dx=3.0)
flag(sl, g0, 'main')
f1 = flag(sl, t1, 'cat-robot', edge='right')
flag(sl, t2, 'superhero', edge='right')
head_pin_on(sl, f1, side='right')
text(sl, 9.3, 4.45, 3.2, 0.8, 'New idea = new flag.\nZero copied cards.', size=16,
     color=MUTED, ls=1.15)

# 10 CONFLICT (T12)
conflict(prs, pause='Why does Git need BASE? Why not just compare the two?', step=3,
         notes='Three-way merge: for each panel, who changed it since the shared ancestor?')

# 11 MENTI
menti(prs, 'You type `git branch experiment`. What does Git create?',
      ['A copy of all your files', 'A copy of all your commits', 'One new commit',
       'One tiny file holding one ID'], notes='Gut answer. Hide results.')

# 12 MENTI ranking chips (H2)
menti(prs, 'Rank by average views per Stack Overflow question. Most viewed first.',
      chips=['git rebase', 'git merge', 'git push', 'git revert', 'git checkout', 'git commit'],
      notes='Menti ranking question, 45 s.')

# 13 TERMINAL full
sl, g = terminal(prs, [
    ('cmd', 'git ls-tree main'),
    [('out', '100644 blob d591a27…   body.txt')],
    [('out', '100644 blob 875229f…   face.txt')],
    [('out', '100644 blob '), ('hi', 'a27e19c…'), ('out', '   legs.txt')],
    ('cmd', 'git ls-tree cat-robot'),
    [('out', '100644 blob ba63925…   body.txt')],
    [('out', '100644 blob ef07ddc…   face.txt')],
    [('out', '100644 blob '), ('hi', 'a27e19c…'), ('out', '   legs.txt')],
], title='Inside a card: a tree of blobs',
    pause='LEGS never changed. How many copies of it does Git store?',
    notes='Answer: one. Same content, same blob ID, stored once.')

# 14 TERMINAL split with auto chips (T13)
sl, gl, gr = terminal_split(prs, 'Same merge, real Git', [
    ('cmd', 'git switch cat-robot'),
    ('cmd', 'git merge superhero'),
    'Auto-merging monster.txt',
    ('err', 'CONFLICT (content): Merge'),
    ('err', '  conflict in monster.txt'),
], [
    'face: cat', '', ('mark', '<<<<<<< HEAD'), 'body: robot', ('mark', '======='),
    'body: superhero', ('mark', '>>>>>>> superhero'), '', 'legs: tentacles',
], right_title='monster.txt', notes='Run it live from Appendix A.')
term_chip(sl, gr, 0, 11)
term_chip(sl, gr, 8, 17)

# 15 STATEMENT
statement(prs, 'Git never erases, [[until you force it to.]]', sub='rebase · squash · push --force',
          notes='Big statement layout.')

# 16 CONTENT goals
content(prs, "Today's goals", lead='After today, we should be confident you could:', items=[
    'Explain a commit, a branch, and HEAD', 'Predict what conflicts in a merge',
    'Fix a rejected push', 'Choose revert, reset, or rebase, and say what each destroys'],
    notes='The exit ticket checks all four.')

# 17 CONTENT with RQ tags (H7)
sl = content(prs, 'What they found', items=[
    '0.4% of SO questions, but 1.5% of askers',
    '2020: 40% of askers on SO 5+ years (all SO: 21%)',
    'Recovery tops views; 83% of questions mix commands',
    'Least answered: rare commands, then credential, submodule',
    '81.7% of learning picks = self-learning'],
    marks=['RQ1', 'RQ2', 'RQ3', 'RQ4', 'RQ5'], size=26,
    notes='Write down which of these five you believe least.')
source_line(sl, 'Yang et al., TOSEM 2022. Tables 1–4, 6, 7; Fig. 3.')

# 18 TWO-COLUMN (T26 revert vs reset), command mode
sl, zl, zr = two_column(prs, command='git revert',
                        meaning='Shared? Add a fix card. Private? You may move the flag back.',
                        left_label='revert · safe when shared',
                        right_label='reset · only if nobody copied it',
                        pause='Where did the ripped-off card go? Can you get it back?',
                        label_colors=(GREEN, ORANGE), step=7,
                        notes='Two halves divided by a hairline.')
s = 0.62
cy = zl['t'] + 0.35
a = card(sl, zl['l'] + 0.20, cy, 'drt3', ('dragon', 'cape', 'tentacles'), parent='#4', s=s)
b = card(sl, zl['l'] + 2.05, cy, 'mst1', ('mustache', 'cape', 'tentacles'), parent='drt3', s=s,
         marks={0: 'changed'})
c = card(sl, zl['l'] + 3.90, cy, 'fix2', ('dragon', 'cape', 'tentacles'), parent='mst1', s=s,
         marks={0: 'changed'})
link(sl, b, a); link(sl, c, b)
flag(sl, c, 'main')
a2 = card(sl, zr['l'] + 0.20, cy, 'drt3', ('dragon', 'cape', 'tentacles'), parent='#4', s=s)
b2 = card(sl, zr['l'] + 2.05, cy, 'mst1', state='ghost', parent='drt3', s=s)
link(sl, b2, a2, color=GHOST, dash=True)
flag(sl, a2, 'main')
text(sl, b2['r'] + 0.25, b2['cy'] - 0.35, 2.4, 0.7, 'unreachable,\nnot deleted', size=16,
     bold=True, color=ORANGE, ls=1.1, anchor='m')

# 19 PAPER (T30)
paper(prs, 'Switching to Git: the Good, the Bad, and the Ugly',
      'Just, Herzig, Czerwonka, Murphy · ISSRE 2016 · Microsoft Research',
      [('GOOD', GREEN, 'Cheap branches. Local commits.', 'Steps 2–3'),
       ('BAD', INK, 'Many routes to main. Hard to trace.', 'Step 6'),
       ('UGLY', ORANGE, 'Rebase, squash, force-push erase history.', 'Step 8')],
      bottom='Their algorithm: rebuild **integration paths** from what is left.',
      notes='Our reading of the abstract. No numbers.')

# 20 RECAP
recap(prs, [('Can\'t go back', 'Never erase: new card', 'git commit'),
            ('Shuffled pile', '"came from __"', 'git log'),
            ('Risky ideas', 'flags; you are here', 'branch · HEAD'),
            ('Two ideas, one monster', 'card with two parents', 'git merge'),
            ('Work from my table', 'copy every card', 'clone · origin/main'),
            ('Two #5s', 'ID from the card itself', 'SHA-1 hash'),
            ('My card fell off', 'look, combine, post', 'fetch · pull · push'),
            ('Bad card, already copied', 'fix card', 'git revert'),
            ('Boss wants it neat', 'bin + FORCE', 'rebase · --force')],
      notes='Almost every Git command makes a card, moves a flag, or copies cards.')

# 21 COMPARE (H15 two-column table)
compare(prs, 'Claimed vs measured', ('They said', 'They measured'), [
    ('"difficult"', '% with no accepted answer (n can be 1)'),
    ('"experienced"', 'years since joining Stack Overflow'),
    ('"how developers learn"', 'multi-select picks from 92 survey respondents'),
    ('"popular"', 'mean views, credited to every command in the post')],
    bottom="80,370 rows can't fix a weak proxy.", notes='Credit students by name.')

# 22 PAUSE
pause(prs, 'Name one place our paper model lies.', rhythm='Model Critics  ·  30 s each',
      notes='Each critic reads one entry.')

# 23 PAUSE with cases (T29)
pause(prs, 'The Boss has a real reason. So does the auditor. Invent ONE wall rule that serves both.',
      cases=['squashing your 5 messy cards before anyone copied them?',
             'force-pushing `main` to drop the mustache after everyone pulled?',
             '"Squash and merge" of a teammate\'s 6-card idea via the PR button?'],
      rhythm='Think 1 min  ·  Pair 2 min  ·  Share 2 min', notes='Contrasting cases.')

# 24 BREAK
break_slide(prs, 3, notes='Labs put their Part-1 cards in their envelope.')

# 25 STARRY
starry(prs, 'Cards never change.\nFlags move.\nWalls copy cards.',
       small='…and Git never erases, until you force it to.', notes='Thursday: the humans.')

# 26 PRIMITIVES: card states + panel marks
sl = blank(prs)
text(sl, M, 0.45, CW, 0.85, 'Primitives: card states and panel marks', size=40, bold=True,
     anchor='m')
s = 1.0
specs = [('sketch', {}, None, 'sketch'), ('staged', {}, None, 'staged'),
         ('committed', {0: 'changed'}, '#2', 'committed'),
         ('committed', {0: 'auto', 1: 'conflict', 2: 'auto'}, 'e5a1', 'marks'),
         ('ghost', {}, 'mst1', 'ghost')]
for i, (st, mk, cid, lab) in enumerate(specs):
    g = card(sl, 1.35 + i * 2.25, 1.85, cid or '', ('cat', 'robot', 'tentacles') if i < 3 else
             ('cat', None, 'tentacles'), parent='#1', author=('Ananya' if i == 2 else None),
             s=s, state=st, marks=mk)
    if i == 0:
        row_labels(sl, g)
    caption(sl, g, lab, size=18, color=(ORANGE if st == 'ghost' else PURPLE))
gst = card_stack(sl, 1.35, 4.95, [dict(cid='#1', parent='—'), dict(cid='#2', parent='#1'),
                                  dict(cid='#3', parent='#1'),
                                  dict(cid='#4', panels=('cat', 'cape', 'tentacles'),
                                       parent='#2 + #3')], s=0.45)
text(sl, gst['r'] + 0.25, gst['cy'] - 0.25, 3.2, 0.5, 'card_stack · s = 0.45', size=16,
     color=MUTED, anchor='m')
for i, sc in enumerate((0.85, 0.62)):
    g = card(sl, 6.6 + i * 2.6, 6.95 - CARD_H * sc, 'drt3', ('dragon', 'cape', 'tentacles'),
             parent='#4', author='Lab 1', s=sc, marks={0: 'changed'})
    text(sl, g['r'] + 0.15, g['b'] - 0.35, 1.2, 0.35, f's = {sc}', size=14, color=MUTED,
         anchor='m')
notes(sl, 'Reference: card states (sketch / staged / committed / ghost), panel marks, scales.')

# 27 PRIMITIVES: flags, HEAD, conflict tag, chips, arrows
sl = blank(prs)
text(sl, M, 0.45, CW, 0.85, 'Primitives: flags, pins, chips, arrows', size=40, bold=True,
     anchor='m')
g = card(sl, 1.20, 2.35, '#4', ('cat', 'cape', 'tentacles'), parent='#2 + #3', s=0.85)
f = flag(sl, g, 'main')
head_pin_on(sl, f)
g2 = card(sl, 3.60, 2.35, 'cdt5', ('cat', 'cape', 'skates'), parent='#4', s=0.85)
flag(sl, g2, 'origin/main', kind='origin')
link(sl, g2, g)
g3 = card(sl, 6.10, 2.35, 'e5a1', ('cat', None, 'tentacles'), parent='#2 + #3', s=0.85,
          marks={0: 'auto', 1: 'conflict', 2: 'auto'})
conflict_tag(sl, g3, 1)
step_chip(sl, 3, x=9.35, y=2.35)
timer_chip(sl, 5, x=9.35, y=3.05)
menti_chip(sl, x=9.35, y=3.75)
mono_chip(sl, 9.35, 4.40, 'git revert')
push_arrow(sl, 1.2, 5.80, 3.2, 5.80)
text(sl, 1.2, 5.95, 2.4, 0.4, 'push', size=16, color=PURPLE, bold=True, font=MONO, markup=False)
fetch_arrow(sl, 4.0, 5.80, 6.6, 5.80)
text(sl, 4.0, 5.95, 3.0, 0.4, 'fetch / pull / clone', size=16, color=BLUE, bold=True,
     font=MONO, markup=False)
arrow(sl, 9.4, 5.80, 7.4, 5.80)
text(sl, 7.4, 5.95, 2.4, 0.4, 'parent (points back)', size=16, color=INK2, markup=False)
badge(sl, 10.45, 5.80)
text(sl, 10.8, 5.6, 1.8, 0.4, 'rejected', size=16, color=RED, bold=True, anchor='m')
progress(sl, 4, y=6.92)
notes(sl, 'Reference: flags, origin/main, HEAD pin, CONFLICT tag, chips, arrows, badge.')

# 28 WALL: push rejected + fetch (T23)
sl = talk(prs, 'git push', 'The wall only moves forward. Your card must lead back to its main.',
          pause='Why refuse your card instead of just adding it?', step=6,
          notes='Remotes accept only fast-forwards.')
ws = wall_scene(sl, y=3.72, h=2.26, zone_w=3.0, wall_w=3.0)
s = 0.45
four = [dict(cid='#1', parent='—'), dict(cid='#2', parent='#1'), dict(cid='#3', parent='#1'),
        dict(cid='#4', panels=('cat', 'cape', 'tentacles'), parent='#2 + #3')]
tops = {}
for key, (nid, pan, par) in {'left': ('drt3', ('dragon', 'cape', 'tentacles'), '#4'),
                            'wall': ('cdt5', ('cat', 'cape', 'skates'), '#4'),
                            'right': ('cdt5', ('cat', 'cape', 'skates'), '#4')}.items():
    z = ws[key]
    x0 = z['l'] + (z['w'] - (1.70 * s + 0.30 + 0.55 + 1.70 * s)) / 2
    st = card_stack(sl, x0, z['t'] + 0.42, four, s=s)
    g = card(sl, st['r'] + 0.55, st['t'], nid, pan, parent=par, s=s)
    link(sl, g, st)
    tops[key] = g
flag(sl, tops['wall'], 'main')
origin_flag(sl, tops['right'])
yl = tops['left']['t'] + 0.30
push_arrow(sl, ws['gap_l'][0] + 0.08, yl, ws['gap_l'][1] - 0.08, yl)
badge(sl, sum(ws['gap_l']) / 2, yl, d=0.36, size=16)
text(sl, ws['gap_l'][0], yl + 0.28, ws['gap_l'][1] - ws['gap_l'][0], 0.6,
     'rejected:\nfetch first', size=13, bold=True, color=RED, align='c', ls=1.05)
yr = tops['wall']['b'] - 0.30
fetch_arrow(sl, ws['gap_r'][0] + 0.08, yr, ws['gap_r'][1] - 0.08, yr)
text(sl, ws['gap_r'][0], yr - 0.36, ws['gap_r'][1] - ws['gap_r'][0], 0.3, 'git fetch',
     size=13, bold=True, color=BLUE, font=MONO, align='c', anchor='m', markup=False)
text(sl, ws['gap_r'][0] - 0.1, yr + 0.10, ws['gap_r'][1] - ws['gap_r'][0] + 0.2, 0.6,
     'pull =\nfetch + merge', size=13, bold=True, color=BLUE, align='c', ls=1.05)

# 29 THURSDAY: ladder + prompts (H9)
sl = blank(prs)
text(sl, M, 0.45, CW, 0.85, 'Where it sits', size=40, bold=True, anchor='m')
numbered(sl, M, 1.85, 6.0, ['RQ: reconnaissance ("what goes wrong?")',
                            'Data: traces in the wild + self-report',
                            'Analysis: counts, means, rankings, coded comments'],
         size=24, marks=[PINK, BLUE, ORANGE], gap=0.30, mark_w=0.42)
ladder(sl, ['Observe people', 'Traces in the wild', 'Tricks to avoid introspection',
            'Self-report'], pills={1: ('Stack Overflow', BLUE, INK), 3: ('Survey', WHITE, INK2, 'BBBBBB')})
pause_bar(sl, 'Pairs, 90 s: what would you need to observe to know someone "knows how to use" a command?')
notes(sl, 'Rung 2 is good, rung 4 is "consider rejecting".')

# 30 THURSDAY: funnel (H6)
sl = blank(prs)
text(sl, M, 0.45, CW, 0.85, 'The study in one picture', size=40, bold=True, anchor='m')
bars = funnel(sl, ['198,626 SO questions tagged git', 'contains an exact Git command',
                   '**80,370 questions**'], y=1.90)
for i, rq in enumerate(['RQ1  How popular?', 'RQ2  Who asks?', 'RQ3  Which commands?',
                        'RQ4  Which are hard?']):
    chip(sl, 7.75, 1.80 + i * 0.66, 3.6, 0.50, rq, fill=WHITE, color=INK, line=INK, lw=1.25,
         size=18)
    line(sl, bars[2]['r'] + 0.1, bars[2]['cy'], 7.70, 1.80 + i * 0.66 + 0.25, color=HAIR, w=1.5)
b = box(sl, M, 5.25, 11.833, 0.75, fill=WHITE, line=PANEL_LINE, lw=1.25, radius=0.12)
label(b, 'Survey: 508 invited  →  **92 replied**  →  RQ5 How do people learn?', size=20,
      bold=False)
source_line(sl, 'Yang et al., TOSEM 2022, p.5–9.')
notes(sl, 'Just what they did. No judging yet.')

# 31 THURSDAY: quote cards (H14)
sl = blank(prs, WHITE)
text(sl, M, 0.45, CW, 0.85, 'Court is in session', size=40, bold=True, anchor='m')
text(sl, M, 1.35, CW, 0.5, 'Jury: how much do you believe it? 1–5 → Menti', size=24, color=INK2,
     anchor='m')
qs = [('"even developers with years of development experience can have trouble using Git commands"', 'p.13', PINK),
      ('"self-learning is the primary way for developers to learn to use Git commands"', 'p.20', BLUE),
      ('"Git commands … about recovery are among the most popular commands asked on Stack Overflow"', 'p.15', ORANGE)]
for i, (q, p, col) in enumerate(qs):
    quote_card(sl, 0.75 + i * 4.025, 2.25, 3.78, 3.6, q, p, col)
notes(sl, 'Everyone votes, then each court gets 3 minutes.')

save(prs, OUT)
pngs = render(OUT, REN, 's', profile='lo_style')
print(len(pngs), 'PNGs ->', REN)
