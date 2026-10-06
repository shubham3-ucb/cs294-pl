# Thursday · Git, Part 2: The Humans · lesson script

80 min (74 + 6 buffer) · the app at `/thu`, same server as Tuesday · you press only **Next** · deck for the record: [`slides/thursday_app.pptx`](../slides/thursday_app.pptx)
Paper: Yang, Zhang, Pan, Xu, Zhou, Huang. *Do Developers Really Know How to Use Git Commands? A Large-Scale Study Using Stack Overflow.* ACM TOSEM 2022. Its data is public: [github.com/gitcommandstudy/gitcommands](https://github.com/gitcommandstudy/gitcommands).

The console shows **Say**, **Ask** and **Hope to hear** for every scene, and a clock: time in this scene against its plan (red when over). This page is the plan around it. The short version for the day is [`TEACHER_BRIEF.md`](TEACHER_BRIEF.md).

## Objectives

After this session, we should be confident students could:
1. **Name** a study's research question and its kind (need-finding, formative, evaluative), and **say** whether its data can answer it.
2. **Place** data on Sarah's ladder (watching > traces > asking) and **catch** a measure that does not match its claim, by checking it on real data: the counting rule (8 posts) and qualitative coding (Table 8).
3. **Turn** a finding that survives into one tool change, with an evaluative question, a measure, one threat to it, and data that does not rely on asking.

Checked in: (1) the survey comparison and the claim verdicts · (2) the 8 labels, the 7 codes and the claim verdicts · (3) the design cards and the exit line.

## Why these activities

Sarah's test: completing the activity teaches the concept, and you cannot complete it without learning it.
- **Take the paper's survey.** Students become the paper's self-report data, then see what self-ratings and memories cannot tell.
- **Label 8 posts.** The paper counts a post for every command in its question *or its accepted answer*. Three labels (stuck on it / needs it, can't name it / not about it) force the difference the rule erases. Nothing is highlighted: you have to read.
- **Code 7 comments.** The paper's Table 8 sorted 65 comments with no named method and no agreement score. Students code its own examples and see their agreement with the paper and with each other.
- **Put one claim on trial.** A group must write what was measured before it may write what the data supports. One claim (experience) survives as written: the point is to be fair, not to win.
- **Design.** Why do people have to *ask* how to undo? One change, Sarah's evaluative question, a measure and one threat (learning effect, ceiling), and data that is not a survey.

## Before class

- `tmux new -s class ./host.sh` in `app/` (detach with Ctrl-b d). Links: Students `…/thu` · Teacher `…/thu/admin?key=…` · Projector `…/thu/screen?key=…`.
- Displays on **Extend**, not mirror. Teacher page on your laptop, **Start presenting**, drag that window to the projector, press **F**.
- Rehearse alone the day before: **Details → Rehearse with bots** (8 bots, 5×), press Next through the class, then **Stop**.
- Test: open `…/thu` in a private window, join, then **Details → Reset** and close the window.
- Post the student link in the course chat. Students never need the paper: everything is on their screens.

## Clock

| Clock | Min | Scene | Students do | Land this |
|---|---|---|---|---|
| 0:00 | 3 | Join | Type a first name | — |
| 0:03 | 4 | Take the paper's survey | Answer the real questions | You are respondent 93. |
| 0:07 | 4 | How the study was done | Listen | They collected 80,370 questions, counted a command when its name appears in the question or the accepted answer, measured views and accepted answers, and surveyed 92 people. |
| 0:11 | 3 | What the paper found | Listen | Five findings; we check them today. |
| 0:14 | 3 | Your answers next to the paper's 92 | Compare | Self-ratings and memories are weak evidence; the 92 came via Stack Overflow. |
| 0:17 | 8 | Read 8 real posts | Label each: stuck on it / needs it but doesn't know it / not about it | — |
| 0:25 | 4 | Your labels for the 8 posts | — | In 5 of 8 the command is only in the answer; the paper counts all 8. |
| 0:29 | 5 | Sort 7 survey comments | Sort into the paper's 6 categories | — |
| 0:34 | 3 | Your sorting next to the paper's | — | No method named, no agreement reported. |
| 0:37 | 5 | **Break** | Back on /thu | Groups form on Next. |
| 0:42 | 8 | Check one claim from the paper | Groups: what was measured, what it shows | — |
| 0:50 | 5 | Each claim, and what the data supports | Reasons on laptops | The experience claim holds (it is weak); three shrink. |
| 0:55 | 10 | Design a better undo | Groups: change, test, measure + risk, data | — |
| 1:05 | 3 | Your designs | Read them out | Which can you test by watching? |
| 1:08 | 3 | What holds in the paper, and what does not | — | Fair to the authors. |
| 1:11 | 2 | One idea to take home | One line each | — |
| 1:13 | 1 | Thank you | — | What people ask shows where they get stuck, not what they can do. |
| 1:14 | 6 | Buffer |  |  |

**Never cut:** the 8 labels · the coding · the verdicts · the design · the exit.
**Running late:** "Your designs" takes two groups; "Your answers next to the paper's 92" takes 2 minutes; "What the paper found" is read in one breath.

## At the verdicts: why each claim shrinks

Students see these reasons on their laptops; the console shows them too.
- **"This suggests that even developers with years of development experience can have trouble using Git commands."** (RQ2 answer) Survives as written: "can have trouble" is weak, and two quoted askers had trouble. It cannot say how common trouble is, or separate Git experience from programming experience (registration is a proxy, §5; Paper 1's teams switched to Git mid-career).
- **"…for the more frequently-used commands, git credential and git submodule are among the most difficult ones."** (§1, finding 4) Measured: questions with no accepted answer. `git credential` is above Git questions overall (paper 43.0%; our re-run 39.3% vs 36.5%); `git submodule` barely differs (37.5%). And a post counted through its accepted answer has one by construction, so commands that appear in fixes look easy: `git reflog` 20.7% overall, 46.3% when the asker names it.
- **"Self-learning is the primary learning approach."** (Abstract) Measured: what 92 of 508 invited people ticked (81.7% of 197 ticks; 85 of 92 people chose the internet). Most respondents were found through Stack Overflow, which favours internet learners (all 18 academics ticked the internet too); "how I learned" is a memory.
- **"…indicating that even experienced developers still have doubts about Git usage."** (§3.5) Measured: a self-rated level, novice to expert; 79 of 92 chose competent or below. A self-rating is a judgment (modesty, the labels, what "expert" means); it measures neither doubts nor skill.

## Every number, and where it comes from

| Number | Source |
|---|---|
| 80,370 questions, July 2008 to December 2020 | Paper §2.1 Steps 1–2 |
| Since 2010, about 0.4% of all Stack Overflow questions each year | Table 1 |
| 2020: 40.0% of Git askers registered more than 5 years earlier, 21.2% of all askers | Table 3 |
| Most viewed on average among commands in 200+ questions: revert, reflog, stash, clean, reset | Table 4 |
| `git pack-redundant` 100% without an accepted answer, 1 question; `git credential` 43.0% of 328; `git submodule` 37.5% of 2,911 | Table 6 |
| 92 of 508 answered; 81.7% = 161 of 197 ticks; 85 of 92 ticked the internet, 76 the documentation; 79 of 92 rate themselves competent or below | §2.2, §3.5, Table 7, Fig. 4 |
| 65 comments in 6 categories (18, 17, 14, 9, 5, 2) "for better delivery purposes"; the 7 example comments | §3.5, Table 8 |
| Cohen's kappa 0.844 for which posts are about Git commands | §2.1 Step 2 |
| Three of Stack Overflow's five most-voted questions were about Git commands | §1, "as of this writing" |
| Recruiting emails found through GitHub accounts; the authors say they were unaware GitHub's policy discourages it | Footnote 7 |
| [36]'s accepted answer: the fix is `git reset HEAD~`; `git reflog` appears under "Further Reading" | The post itself |
| 36.5% of all 80,370 Git questions have no accepted answer; `git credential` 39.3%; `git reflog` 20.7%, 46.3% when the asker names it | Our re-run, [`analysis/thursday_numbers.py`](../analysis/thursday_numbers.py) |
| Command only in the accepted answer: 55% of `git reflog` posts, 44% `git revert`, 44% `git reset` | Our re-run |
| "How do I undo the most recent local commits in Git?": 9,100,722 views, names no command, counts for five through its accepted answer; without it `git reflog` falls from #2 to #8 | Our re-run |
| Dropping each command's top two posts: revert, stash, clean, reset stay in the top 5; reflog falls to #7 | Our re-run |
| The 8 posts: drawn at random (seed 294) from short, answered posts credited to the top-5 commands | Our re-run |
| Git 2.23 (August 2019) added `git switch` and `git restore` | Git 2.23 release notes |

Our re-run applies the paper's rule (a case-insensitive string match on the title, body and accepted answer) to the paper's data. It matches the authors' post counts exactly for 73 of 136 commands, and Table 4's 30 rows within 8% (median under 1%).

## Say it right

- "81.7% of ticked boxes", never "81.7% of developers".
- "Accounts registered more than 5 years earlier", never "5 years of Git".
- "Most viewed on average", never "most confusing".
- "Our re-run of their rule on their data" for every number not printed in the paper.
- Be fair: the experience claim survives; the authors flag the proxy themselves (§5).

## If something goes wrong

- **Groups look wrong after the break:** **Re-form groups** (under People). It clears group answers, so do it before groups type.
- **The link died:** in tmux, run `./host.sh` again; post the new link. Students type the same name and get their answers and group back.
- **A student is behind:** survey, labels and codes stay open until their reveal is over; the student's laptop shows "finish this".
- **The app is down for good:** the deck has every slide, with the paper's numbers and the model answers. Survey and votes by hands; labels and codes on the deck's tables; claims and design on paper.
