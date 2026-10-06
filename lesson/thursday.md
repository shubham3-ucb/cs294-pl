# Thursday · Git, Part 2: The Humans · lesson script

80 min (78 + 2 buffer) · the app at `/thu`, same server as Tuesday · you press only **Next** · deck for the record: [`slides/thursday_app.pptx`](../slides/thursday_app.pptx)
Paper: Yang, Zhang, Pan, Xu, Zhou, Huang. *Do Developers Really Know How to Use Git Commands? A Large-Scale Study Using Stack Overflow.* ACM TOSEM 2022. Its data is public: [github.com/gitcommandstudy/gitcommands](https://github.com/gitcommandstudy/gitcommands).

The console shows **Say**, **Ask** and **Hope to hear** for every scene. This page is the plan around it.

## Objectives

After this session, we should be confident students could:
1. **Name** a study's research question and its kind (need-finding, formative, evaluative), and **say** whether its data can answer it.
2. **Place** data on Sarah's ladder (watching > traces > asking) and **catch** a measure that does not match its claim, by checking it on real data.
3. **Turn** a finding that survives into one tool change, with an evaluative question and data that does not rely on asking.

Checked in: (1) the two votes · (2) the 8 labels and the claim verdicts · (3) the design cards and the exit line.

## Why these activities

Sarah's test: completing the activity teaches the concept, and you cannot complete it without learning it.
- **Take the paper's survey.** Students become the paper's self-report data, then see what that data cannot tell.
- **Check the rule on 8 posts.** The paper counts a post for every command in its question *or its accepted answer*. Labeling forces the difference between "asked about" and "named in the fix".
- **Put one claim on trial.** A group must write what was measured before it may write what the data supports.
- **Design for the need that survived.** One change, Sarah's evaluative question shape, and data that is not a survey.

## Before class

- `cd app && ./host.sh`. Links: Students `…/thu` · Teacher `…/thu/admin?key=…` · Projector `…/thu/screen?key=…`.
- Teacher page on your laptop, **Start presenting**, drag that window to the projector, press **F**.
- Post the paper's PDF link: groups open it during the claim trial.
- Try it alone: open `…/thu` in two or three private windows as students.

## Clock

| Clock | Min | Scene | Students do | Land this |
|---|---|---|---|---|
| 0:00 | 2 | Join | Type a first name | — |
| 0:02 | 4 | Take the paper's survey | The form's Q2–Q7, word for word | You are respondent 93. |
| 0:06 | 3 | The paper in one slide | Listen | Five RQs: four from Stack Overflow, one from a survey. |
| 0:09 | 2 | What kind of study is this? | Vote | — |
| 0:11 | 3 | Need-finding | — | Questions record what people got stuck on; when Git just worked, nobody asked. Is the question interesting? Yes. |
| 0:14 | 2 | Stack Overflow posts are… | Vote | — |
| 0:16 | 3 | Traces. Of asking. | — | Traces of asking, not of using. Nobody was watched. |
| 0:19 | 4 | You and the paper's 92 | Compare | People found through Stack Overflow say they learn online: the sample decides the answer. |
| 0:23 | 9 | Check the rule on 8 real posts | Label each post | — |
| 0:32 | 5 | The rule and you | — | Often the command is the fix, not the problem. |
| 0:37 | 4 | One question, 9.1 million views | — | Undo questions really are the most viewed. Which command gets the credit depends on the rule. |
| 0:41 | 5 | **Break** | — | Groups form when you press Next. |
| 0:46 | 8 | Put one claim on trial | Groups of about 4, one claim each | — |
| 0:54 | 6 | The verdicts | — | Nothing in the paper watches anyone use Git. |
| 1:00 | 10 | Design for the need that survived | Groups: change, study, data | — |
| 1:10 | 3 | Your designs | Read them out | Push on the data: watch, trace, or ask? |
| 1:13 | 2 | What Git and Jujutsu did | — | A new command makes new questions. Did it help? That needs an evaluative study. |
| 1:15 | 2 | Exit | One line each | — |
| 1:17 | 1 | **Asking is not using.** | — | Tuesday: flat history is data loss. Both: check what your data records. |
| 1:18 | 2 | Buffer | | |

**Never cut:** the 8 labels · the verdicts · the design · the exit.
**Short on time:** cut "Your designs" to two groups, then the break to 3 minutes.

## At the verdicts: why each claim shrinks

The console shows these for the claims in play.
- **"This suggests that even developers with years of development experience can have trouble using Git commands."** (RQ2 answer) Measured: years since the asker registered on Stack Overflow, which §5 calls a proxy. Experienced programmers can be new to Git: Paper 1 describes Microsoft teams switching from Source Depot and Team Foundation Server, for whom Git is "a small revolution". The data cannot tell "Git stays hard for experienced Git users" from "experienced programmers are new to Git".
- **"…for the more frequently-used commands, git credential and git submodule are among the most difficult ones."** (§1, finding 4) Measured: questions where the asker never accepted an answer. Supported: they end without one more often (43.0%, 37.5%) than Git questions overall (36.5%). But a post counted through its accepted answer has one by construction, so commands that appear in fixes look easy: `git reflog` lacks one in 20.7% of its posts, 46.3% of those whose asker names it.
- **"Self-learning is the primary learning approach."** (Abstract) Measured: what 92 of 508 invited people ticked; the practitioners invited had recently asked a Git question on Stack Overflow. The paper gives both 81.7% of 197 ticks and 85 of 92 people. Either way the respondents were found through Stack Overflow, so they use the internet by construction, and "how I learned" is a memory.
- **"…the number of questions related to Git commands has been growing steadily."** (Conclusion) Measured: questions per year. They peaked in 2016 (9,125), fell to 7,076 in 2019 and rose again in 2020; their share has held at about 0.4% since 2010. §3.1 itself says "dropped a bit from 2017".

## Every number, and where it comes from

| Number | Source |
|---|---|
| 80,370 questions, July 2008 to December 2020 | Paper §2.1 Steps 1–2 |
| Since 2010, about 0.4% of all Stack Overflow questions each year | Table 1 |
| Git questions per year: 9,125 in 2016, 7,076 in 2019, 7,501 in 2020 | Fig. 2(a); the authors' RQ1 file |
| 2020: 40.0% of Git askers registered more than 5 years earlier, 21.2% of all askers | Table 3 |
| Most viewed on average among commands in 200+ questions: revert, reflog, stash, clean, reset | Table 4 |
| `git pack-redundant` 100% without an accepted answer, 1 question; `git credential` 43.0% of 328; `git submodule` 37.5% of 2,911 | Table 6 |
| 92 of 508 answered; 81.7% = 161 of 197 ticks; 85 of 92 ticked the internet, 76 the documentation | §2.2, §3.5, Table 7 |
| Three of Stack Overflow's five most-voted questions were about Git commands | §1, "as of this writing" |
| Recruiting emails found through GitHub accounts; the authors say they were unaware GitHub's policy discourages it | Footnote 7 |
| [36]'s accepted answer: the fix is `git reset HEAD~`; `git reflog` appears under "Further Reading" | The post itself |
| 36.5% of all 80,370 Git questions have no accepted answer; `git reflog`: 20.7% of its posts, 46.3% when the asker names it | Our re-run, [`analysis/thursday_numbers.py`](../analysis/thursday_numbers.py) |
| Command only in the accepted answer: 55% of `git reflog` posts, 44% `git revert`, 44% `git reset` | Our re-run |
| Ranks by mean, by median and when the asker names the command, among the 62 commands in 200+ questions (the paper's filter) | Our re-run |
| "How do I undo the most recent local commits in Git?": 9,100,722 views, names no command, counts for five through its accepted answer; without it `git reflog` falls from #2 to #8 | Our re-run |
| Median post of each top-5 command: about 250 to 360 views; without each command's own top post, all five stay in the top 5 | Our re-run |
| The 8 posts: seeded random sample (seed 294), short ones, from the top-5 commands | Our re-run |
| Git 2.23 (August 2019) added `git switch` and `git restore` | Git 2.23 release notes |

Our re-run applies the paper's rule (a case-insensitive string match on the title, body and accepted answer) to the paper's data. It matches the authors' post counts exactly for 73 of 136 commands, and Table 4's 30 rows within 8% (median under 1%).

## Say it right

- "81.7% of ticked boxes", never "81.7% of developers".
- "Accounts registered more than 5 years earlier", never "5 years of Git".
- "Most viewed on average", never "most confusing".
- "Our re-run of their rule on their data" for every number not printed in the paper.

## If the app fails

The deck has every slide, with the paper's numbers and the model answers. Survey: hands up per option. Labels: show the deck's table of the 8 posts and vote per row. Claims and design: on paper, one sheet per group.
