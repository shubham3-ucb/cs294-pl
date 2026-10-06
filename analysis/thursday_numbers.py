#!/usr/bin/env python3
"""Every Thursday number that the paper does not print, recomputed from the paper's own data.

Data: https://github.com/gitcommandstudy/gitcommands (Data/Posts.zip, Results/RQ1-5.zip), published by the authors.
Posts are Stack Overflow content, CC BY-SA. Unzip both into DATA (default /tmp/gcs):
  DATA/posts/Posts/question-git.txt   80,370 questions (the paper's set P)
  DATA/posts/Posts/answer-git.txt     their 51,040 accepted answers
  DATA/results/RQ1-5/RQ1.xlsx, RQ3.xlsx   the authors' yearly counts, command list and Table 4 values
Run:  python3 analysis/thursday_numbers.py [DATA]
Writes app/server/thursday_posts.json (the 8 posts students label) and prints every number used in class.

The paper's rule (Section 2.1, Steps 5-6): a question counts for every Git command whose text appears in its title,
body, or accepted answer (case-insensitive exact string match, so "git add" also matches inside "git address").
We apply that rule to each post's text (HTML tags removed). Checked against the authors' published counts below.
"""
import ast, html, json, os, random, re, statistics as st, sys

import openpyxl

DATA = sys.argv[1] if len(sys.argv) > 1 else '/tmp/gcs'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'server', 'thursday_posts.json')
TOP5 = ['git revert', 'git reflog', 'git stash', 'git clean', 'git reset']
UNDO = '927358'  # "How do I undo the most recent local commits in Git?" (the paper's reference [36])


def load(name):
    with open(os.path.join(DATA, 'posts', 'Posts', name), encoding='utf-8') as f:
        return {d['Id']: d for d in map(ast.literal_eval, f)}


def plain(h):
    return html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))


def sheet(name):
    return openpyxl.load_workbook(os.path.join(DATA, 'results', 'RQ1-5', name), data_only=True).worksheets[0]


Q, A = load('question-git.txt'), load('answer-git.txt')
PUB = {r[0]: r for r in sheet('RQ3.xlsx').iter_rows(min_row=2, values_only=True) if r[0]}  # command, views, fav, score, posts
ASKED = {i: (plain(q.get('Title')) + ' ' + plain(q.get('Body'))).lower() for i, q in Q.items()}
ANSWER = {i: plain(A.get(q.get('AcceptedAnswerId'), {}).get('Body')).lower() for i, q in Q.items()}
views = lambda i: int(Q[i]['ViewCount'])
accepted = lambda i: bool(Q[i].get('AcceptedAnswerId'))
pct = lambda a, b: f'{100 * a / b:.1f}%'


def named(cmd, i):
    return cmd.lower() in ASKED[i]


def credited(cmd):
    c = cmd.lower()
    return [i for i in Q if c in ASKED[i] or c in ANSWER[i]]


CREDIT = {c: credited(c) for c in PUB}

print(f'{len(Q):,} questions, {len(A):,} accepted answers')
exact = sum(len(CREDIT[c]) == PUB[c][4] for c in PUB)
diffs = [abs(len(CREDIT[c]) - PUB[c][4]) / max(PUB[c][4], 1) for c in PUB]
print(f'The rule vs the authors\' post counts: exact for {exact} of {len(PUB)} commands, median difference {st.median(diffs):.1%}')
table4 = sorted((c for c in PUB if PUB[c][4] >= 200), key=lambda c: -PUB[c][1])[:30]
dn = [abs(len(CREDIT[c]) - PUB[c][4]) / PUB[c][4] for c in table4]
dv = [abs(st.mean(map(views, CREDIT[c])) - PUB[c][1]) / PUB[c][1] for c in table4]
print(f'Table 4 (30 rows): posts within {max(dn):.1%} (median {st.median(dn):.1%}); mean views within {max(dv):.1%} (median {st.median(dv):.1%})')

# RQ1: the authors' yearly counts.
rq1 = {str(r[0]): r[1:] for r in sheet('RQ1.xlsx').iter_rows(values_only=True) if r[0]}
counts = {str(y): n for y, n in zip(rq1['Year'], rq1['# of questions']) if y is not None and n is not None}
years = list(counts)
print('Git questions per year (authors\' RQ1 file):', ', '.join(f'{y}: {counts[y]:,}' for y in years if y >= '2014'))

# Accepted answers: overall, and like for like (only questions where the asker names a command).
noacc_all = sum(not accepted(i) for i in Q) / len(Q)
any_named = [i for i in Q if any(named(c, i) for c in PUB)]
print(f'No accepted answer: all Git questions {noacc_all:.1%}; questions naming any command {sum(not accepted(i) for i in any_named) / len(any_named):.1%}')
for c in ['git credential', 'git submodule', 'git reflog']:
    ids = CREDIT[c]
    nm = [i for i in ids if named(c, i)]
    print(f'  {c}: all {pct(sum(not accepted(i) for i in ids), len(ids))} of {len(ids)}; asker names it {pct(sum(not accepted(i) for i in nm), len(nm))} of {len(nm)}')

u = Q[UNDO]
print(f'\n[36] "{u["Title"]}": {views(UNDO):,} views, score {int(u["Score"]):,}')
print('  counts for (asker names none):', ', '.join(c for c in sorted(PUB) if UNDO in CREDIT[c]), '| named in question:', [c for c in PUB if named(c, UNDO)])
ans = plain(A[u['AcceptedAnswerId']]['Body'])
print('  accepted answer mentions git reflog at:', [m.start() for m in re.finditer('git reflog', ans.lower())], 'of', len(ans), 'chars')

# Table 4 by other measures, among the commands the paper's filter keeps (200+ posts in the authors' counts).
cmds = [c for c in PUB if PUB[c][4] >= 200]
S = {}
for c in cmds:
    ids = CREDIT[c]
    nm = [i for i in ids if named(c, i)]
    v = sorted(map(views, ids))
    S[c] = dict(mean=st.mean(v), median=st.median(v), named_mean=st.mean(map(views, nm)) if nm else 0,
                named_median=st.median(list(map(views, nm))) if nm else 0, answer_only=1 - len(nm) / len(ids),
                wo_undo=st.mean([views(i) for i in ids if i != UNDO]), wo_top=st.mean(v[:-1]), wo_top2=st.mean(v[:-2]))
rank = lambda k: sorted(cmds, key=lambda c: -S[c][k])
R = {k: rank(k) for k in ['mean', 'median', 'named_mean', 'named_median', 'wo_undo', 'wo_top', 'wo_top2']}
print(f'\nRanks among the {len(cmds)} commands with 200+ posts in the authors\' counts (views from our re-run):')
print('  command      mean  median  asker-names(mean)  asker-names(median)  without[36]  without-own-top-post  without-top-2  only-in-answer  median-views')
for c in TOP5:
    r = {k: R[k].index(c) + 1 for k in R}
    print(f'  {c:11} #{r["mean"]:<4} #{r["median"]:<6} #{r["named_mean"]:<17} #{r["named_median"]:<19} #{r["wo_undo"]:<11} #{r["wo_top"]:<21} #{r["wo_top2"]:<13} '
          f'{S[c]["answer_only"]:.0%}            {S[c]["median"]:,.0f}')
print('  Top 5 by mean (the paper):', ', '.join(R['mean'][:5]))
print('  Top 5 when the asker names the command (mean):', ', '.join(R['named_mean'][:5]))

# The 8 posts students label: a seeded random sample, short enough to read in a minute,
# credited to the paper's top-5 commands (2 reflog, 2 revert, 2 reset, 1 stash, 1 clean).
def blocks(h, limit):
    out, used = [], 0
    for m in re.finditer(r'<pre[^>]*>(.*?)</pre>|<p>(.*?)</p>|<li>(.*?)</li>', h or '', re.S):
        code = m.group(1) is not None
        t = plain(m.group(1) if code else (m.group(2) or m.group(3))).strip()
        t = '\n'.join(t.splitlines()[:6]) if code else re.sub(r'\s+', ' ', t)
        if not t:
            continue
        if used + len(t) > limit:
            if not code and limit - used > 80:
                out.append({'code': False, 'text': t[:limit - used].rsplit(' ', 1)[0] + ' …'})
            break
        out.append({'code': code, 'text': t})
        used += len(t)
    return out


def excerpt(h, cmd, limit):
    """From the first block that shows the command (with the paragraph before it), up to limit characters."""
    parts = blocks(h, 10_000)
    hit = next((k for k, b in enumerate(parts) if cmd in b['text'].lower()), 0)
    start = max(0, hit - 1) if hit and not parts[hit]['code'] else hit
    out, used = [], 0
    for b in parts[start:]:
        if used + len(b['text']) > limit and out:
            break
        out.append(b)
        used += len(b['text'])
    return out


rng = random.Random(294)
plan = [('git reflog', 2), ('git revert', 2), ('git reset', 2), ('git stash', 1), ('git clean', 1)]
picked, seen = [], set()
for cmd, k in plan:
    pool = sorted(i for i in CREDIT[cmd]
                  if len(ASKED[i]) <= 700 and 0 < len(ANSWER[i]) <= 1500 and int(Q[i]['Score']) >= 1 and i not in seen)
    for i in rng.sample(pool, k):
        seen.add(i)
        q, a = Q[i], A[Q[i]['AcceptedAnswerId']]
        names = named(cmd, i)
        question = blocks(q['Body'], 520)
        if names and cmd not in (plain(q['Title']) + ' ' + ' '.join(b['text'] for b in question)).lower():
            question = blocks(q['Body'], 260) + [{'code': False, 'text': '…'}] + excerpt(q['Body'], cmd, 260)
        picked.append({
            'id': i, 'command': cmd, 'title': html.unescape(q['Title']), 'year': q['CreationDate'][:4],
            'views': views(i), 'question': question, 'answer': excerpt(a['Body'], cmd, 420),
            'askerNamesIt': names, 'url': f'https://stackoverflow.com/q/{i}', 'license': q.get('ContentLicense', 'CC BY-SA'),
        })
rng.shuffle(picked)
with open(OUT, 'w') as f:
    json.dump({'source': 'Stack Overflow via the paper\'s dataset (github.com/gitcommandstudy/gitcommands); '
               'seeded random sample (seed 294) from analysis/thursday_numbers.py; CC BY-SA', 'posts': picked}, f, indent=1)
print(f'\nWrote {len(picked)} posts to {os.path.relpath(OUT, ROOT)}:')
for p in picked:
    print(f'  {p["command"]:11} asker names it: {"yes" if p["askerNamesIt"] else "no ":3}  {p["views"]:9,} views  {p["title"]}')
