# Tuesday · Monster Lab · one page

80 min · 3 labs · S at the front, A walks the labs. Every step: Problem → ask for the Idea → Next → Pause → How Git does it → board line.

| Time | Step | The one question | Hope to hear |
|---|---|---|---|
| 0:00 | Opening. Join QR, pick a lab. | — | — |
| 0:03 | Step 0 · Chaos. 90 s, then "Hands off." | What did your monster look like a minute ago? Who changed the legs? | No idea. Nothing was saved. |
| 0:07 | Learning objectives | — | — |
| 0:08 | Step 1 · Commit. Save card, open a card. | Why do arrows point back, never forward? | The next card doesn't exist yet. Cards never change. |
| 0:15 | Step 2 · Branch. Two sticky notes. | Where is the original monster now? Did anything get copied? | Still on main's card. Nothing copied. |
| 0:22 | Step 3 · Merge. Fast-forward, then BODY conflict. | Why did FACE and LEGS combine alone, but BODY needed you? | Compared with the split card, only BODY changed on both sides. |
| 0:32 | **Break, 4 min.** "Back in 4 minutes." Write the real return time. | — | — |
| 0:36 | Step 4 · Meet the Wall. Pick a lab, Next. Compare IDs. | Two labs never made that card. Why does their copy have the same ID? | The ID is computed from the card. Same card, same ID. |
| 0:42 | Step 5 · Push and pull. First lab wins, others refused. | Why did the Wall refuse your card instead of adding it? | It would drop the first lab's card. The Wall only moves forward. |
| 0:51 | Step 6 · Revert, reset, reflog. Sabotage on Step 5, then Next. | Why is adding a fix card safe, but moving back is not? | A fix card only adds. Moving back drops a shared card. |
| 1:00 | Step 7 · Squash, force push, gc. Audit → replace → Audit → bin. | Who added the tentacles? Where does that answer still exist? | Not on the Wall. Only on the labs' laptops. |
| 1:08 | The paper: **flat history is data loss.** Pairs, 2 min. | You run your company's Wall. One rule: clean history, and the auditor still knows? | No force push to main. |
| 1:12 | Exit question. Laptops closed, index card. | A password reached the Wall. Does revert remove it? If not, what would? | No. Change the password. Rewrite, force push, gc. |
| 1:15 | Step 8 · Wrap. Read the homework. | — | — |
| 1:17 | **Buffer, 3 min.** | — | — |

**Never cut:** the Step 3 conflict · the refused sends in Steps 5 and 6 · both Audits · the exit question.
**Homework:** Yang et al., §3.2–3.5. For one finding, write down what they measured.

<div style="page-break-after: always"></div>

# Thursday · Git, Part 2: The Humans · one page

80 min · 3 teams (Tuesday's labs) · Shubham before the break, Ananya after. Critique with three questions: Interesting? Can the data answer it? Do we believe the analysis?

| Time | Step | The one question | Hope to hear |
|---|---|---|---|
| 0:00 | Slide 1 · Welcome. Sit with your Tuesday lab. | — | — |
| 0:02 | Slides 2–3 · Hook. Menti vote, then: revert wins. | Think of Tuesday's mustache. Why would "undo" confuse people? | The right undo depends on where the card is. |
| 0:07 | Slide 4 · The study. No judging yet. | — | — |
| 0:10 | Slide 5 · What they found. | Which of these three do you believe least? (One word, private.) | — |
| 0:14 | Slide 6 · Three questions, the ladder. | This paper has two data sources. Where does each sit? | Questions: traces of asking for help. Survey: self-report. |
| 0:19 | Slide 7 · Claim Court, 12 min. Minute-5 check at 0:24. | What did they measure? | The card's "Measured" line. |
| 0:31 | Slide 8 · Pitches, jury vote. | Why did one claim survive and two shrink? | Team 3's measure matches its words. |
| 0:42 | Slide 9 · Claimed ≠ measured. | They counted command names. What would a tool designer rather know? | What people tried to do, and where they got stuck. |
| 0:48 | **Break, 4 min.** "Back in 4 minutes." Deal finding cards. | — | — |
| 0:52 | Slide 11 · Design sprint. 7 min build, 1 min pitches. | How would you know it worked, without asking anyone? | Something logged or watched. |
| 1:04 | Slide 12 · Git listened (2019). | Did switch and restore help? How would you find out? | Two groups, same task. Log time, errors, lost work. |
| 1:09 | Slide 12 · Design question, 1 min. | Each sticky note kept its own draft. Real Git doesn't. Which do you want? | The app's. (Gitless made that choice.) |
| 1:10 | Slide 13 · Exit, Menti, alone. | Which lesson up there did no slide say? Whose is it? | A student names theirs. |
| 1:16 | Slide 14 · Close. | — | — |
| 1:18 | **Buffer, 2 min.** | — | — |

**Never cut:** the minute-5 check · the break · the exit.
**Say it right:** "81.7% of survey ticks", never "of developers". "Accounts over 5 years old", never "5 years of Git".
