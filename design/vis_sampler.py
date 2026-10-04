"""Builds slides/build/visual_system_sampler.pptx -- one slide per layout/primitive."""
import sys
sys.path.insert(0, '/home/shagarw_google_com/shubham/git_course/design')
from vis import *

prs = new_deck()

# 1 title
title_slide(prs, 'Monster Lab', 'How Git actually works — by building it with paper')

# 2 divider
divider(prs, 'Make the monster', color=C['PINK'], kicker='PART 1')

# 3 task (text only)
task(prs, 3, 'Both ideas are good. Make ONE monster.',
     ['Make a card that points back to BOTH cards', 'Same panel changed twice? Talk, then pick',
      'Pin it on your table'], minutes=6)

# 4 task with visual zone (3-way inputs)
sl = task(prs, 3, 'Merge Lab A and Lab B.', ['Compare each panel with BASE', 'Who changed it?'],
          minutes=6, visual=True)
a = card(sl, 8.1, 2.1, 'b71e', ('🐱', '🤖', '🦵'), parent='4c2d', author='Lab A', s=0.9)
b = card(sl, 10.35, 2.1, '9d03', ('🙂', '🦸', '🐙'), parent='4c2d', author='Lab B', s=0.9)
flag(sl, a, 'labA'); flag(sl, b, 'labB')

# 5 talk / reveal with diagram
sl = talk(prs, 'git merge', 'A new card with two parents. Each panel is compared to the shared ancestor.',
          pause='When is a conflict actually a good thing?', step=3)
s = 0.85
base = card(sl, 2.0, 3.85, '4c2d', author='BASE', s=s)
row_labels(sl, base, size=13)
a = card(sl, 5.0, 3.85, 'b71e', ('🐱', '🤖', '🦵'), parent='4c2d', s=s, marks={0: 'changed', 1: 'changed'})
b = card(sl, 7.0, 3.85, '9d03', ('🙂', '🦸', '🐙'), parent='4c2d', s=s, marks={1: 'changed', 2: 'changed'})
m = card(sl, 10.2, 3.85, 'e5a1', ('🐱', '❓', '🐙'), parent='b71e+9d03', s=s,
         marks={0: 'auto', 1: 'conflict', 2: 'auto'})
text(sl, 3.45, 4.45, 1.5, 1.0, 'vs', size=28, color=C['MUTED'], align='c', anchor='m')
text(sl, 6.45, 4.45, 0.55, 1.0, '+', size=40, color=C['MUTED'], align='c', anchor='m')
text(sl, 8.6, 4.45, 1.5, 1.0, '=', size=40, color=C['MUTED'], align='c', anchor='m')

# 6 full-slide 3-way merge diagram ("show the conflict")
sl = blank(prs)
text(sl, M, 0.45, CW, 0.8, 'Only BODY changed on both sides', size=40, bold=True, anchor='m')
s = 0.92
base = card(sl, 1.75, 3.0, '4c2d', author='BASE', s=s)
row_labels(sl, base)
A = card(sl, 5.05, 1.55, 'b71e', ('🐱', '🤖', '🦵'), parent='4c2d', author='Lab A', s=s,
         marks={0: 'changed', 1: 'changed'})
B = card(sl, 5.05, 4.55 - 0.05, '9d03', ('🙂', '🦸', '🐙'), parent='4c2d', author='Lab B', s=s,
         marks={1: 'changed', 2: 'changed'})
Mg = card(sl, 8.6, 3.0, 'e5a1', ('🐱', '❓', '🐙'), parent='b71e + 9d03', author='merge', s=s,
          marks={0: 'auto', 1: 'conflict', 2: 'auto'})
link(sl, A, base); link(sl, B, base); link(sl, Mg, A); link(sl, Mg, B)
conflict_tag(sl, Mg, 1)
flag(sl, Mg, 'main'); head_pin(sl, Mg['cx'], Mg['t'] - 0.38 + 0.0)
text(sl, M, 6.95, CW, 0.4, [[('■ ', {'color': 'E8C547'}), ('changed vs BASE     ', {}),
     ('■ ', {'color': C['GREEN']}), ('auto-merged     ', {}), ('■ ', {'color': C['RED']}), ('conflict', {})]],
     size=16, color=C['INK2'])

# 7 history row + branch + HEAD
sl = blank(prs)
text(sl, M, 0.45, CW, 0.8, 'Cards never change. Flags move.', size=40, bold=True, anchor='m')
s = 0.85
gs = []
for i, (cid, pan) in enumerate([('1a0c', ('🙂', '📦', '🦵')), ('4c2d', ('😈', '📦', '🦵')),
                                ('b71e', ('😈', '🤖', '🦵')), ('f00d', ('😈', '🤖', '🐙'))]):
    g = card(sl, 1.6 + i * 2.85, 2.6, cid, pan, parent=(gs[-1] and None) if False else (gs[-1]['cid'] if gs else None), s=s)
    g['cid'] = cid
    gs.append(g)
for c1, c0 in zip(gs[1:], gs[:-1]):
    link(sl, c1, c0)
row_labels(sl, gs[0], size=13)
f = flag(sl, gs[-1], 'main')
head_pin(sl, f['cx'], f['y'] + 0.02)
f2 = flag(sl, gs[1], 'old-idea')
text(sl, M, 5.25, CW, 0.5, 'older  ←                                                       →  newer',
     size=18, color=C['MUTED'], align='c')

# 8 wall / remote
sl = blank(prs)
text(sl, M, 0.45, CW, 0.8, 'Push rejected: the wall moved', size=40, bold=True, anchor='m')
wall(sl, 4.55, 1.85, 4.25, 3.3)
w1 = card(sl, 4.85, 2.25, '4c2d', s=0.62)
w2 = card(sl, 6.65, 2.25, '7aa1', ('🙂', '🦸', '🦵'), s=0.62)
link(sl, w2, w1, w=1.5)
table_zone(sl, 0.75, 2.0, 3.2, 3.6, 'Lab A table')
t1 = card(sl, 1.0, 2.55, '4c2d', s=0.62)
t2 = card(sl, 2.45, 2.55, 'b71e', ('🐱', '📦', '🦵'), s=0.62)
link(sl, t2, t1, w=1.5)
table_zone(sl, 9.4, 2.0, 3.18, 3.6, 'Lab B table')
arrow(sl, 3.95, 5.5, 4.55, 4.6, color=C['PURPLE'], w=3)
badge(sl, 4.25, 5.05)
text(sl, 0.75, 5.75, 3.8, 0.5, 'push rejected', size=16, color=C['RED'], bold=True, font=MONO)
arrow(sl, 9.4, 3.8, 8.8, 3.8, color=C['BLUE'], w=2.5, dash=True)
text(sl, 9.4, 5.75, 3.2, 0.5, 'git pull', size=16, color=C['BLUE'], bold=True, font=MONO)

# 9 states + ghost
sl = blank(prs)
text(sl, M, 0.45, CW, 0.8, 'Pencil → ink → sticker', size=40, bold=True, anchor='m')
for i, (st, nm) in enumerate([('sketch', 'working copy'), ('staged', 'git add'), ('committed', 'git commit'), ('ghost', 'rebased away')]):
    g = card(sl, 1.55 + i * 2.85, 2.0, 'a3f9', parent='4c2d', state=st, s=1.0)
    text(sl, g['l'] - 0.3, g['b'] + 0.2, g['w'] + 0.6, 0.45, nm, size=20,
         bold=True, color=(C['PURPLE'] if st != 'ghost' else C['ORANGE']), align='c', font=MONO)

# 10 menti
menti(prs, 'Which Git command do people ask about most on Stack Overflow?',
      options=['git push', 'git revert', 'git merge', 'git rebase'])

# 11 terminal
terminal(prs, [('cmd', 'git merge labB'),
               ('out', 'Auto-merging monster.txt'),
               ('err', 'CONFLICT (content): Merge conflict in monster.txt'),
               ('out', 'Automatic merge failed; fix conflicts and commit.'),
               ('cmd', 'cat monster.txt'),
               ('out', 'head: cat'),
               ('dim', '---'),
               ('mark', '<<<<<<< HEAD'),
               ('out', 'body: robot'),
               ('mark', '======='),
               ('out', 'body: superhero'),
               ('mark', '>>>>>>> labB')], title='The real thing')


# 12 statement
statement(prs, [[('Git never erases — ', {}), ('until you force it to.', {'color': C['PURPLE']})]],
          sub='rebase · squash · push --force')

# 13 starry
starry(prs, 'Cards never change.\nFlags move.\nWalls copy cards.')

# 14 recap
recap(prs, [('Nobody knew who drew what', 'Never erase; new card', 'git commit'),
            ('Pile of cards, no order', '“came from” box', 'git log'),
            ('Risky idea might ruin it', 'Sticky note per idea', 'git branch'),
            ('Two ideas, one monster', 'Card with two parents', 'git merge'),
            ('Another table wants in', 'Copy all cards', 'git clone'),
            ('Two “card #5”s', 'ID from the drawing', 'hash IDs'),
            ('Wall moved under us', 'Copy, combine, add', 'pull, then push'),
            ('Bad card already shared', 'Add a fix card', 'git revert'),
            ('“Make history neat”', 'Throw cards away', 'rebase / squash')])

# 15 pause
pause(prs, 'Your boss wants a clean history. What do you lose?')

# 16 break
break_slide(prs, 5)

# 17 dividers blue / orange / purple
divider(prs, 'Under the hood', color=C['BLUE'], kicker='PART 2')
divider(prs, 'The Ugly', color=C['ORANGE'], kicker='PART 3', emoji='🧹')
divider(prs, 'So what for tool design?', color=C['PURPLE'], kicker='WRAP-UP')

out = '/home/shagarw_google_com/shubham/git_course/slides/build/visual_system_sampler.pptx'
prs.save(out)
print('saved', out, len(prs.slides._sldIdLst), 'slides')
