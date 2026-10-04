# Thursday · Git, Part 2: The Humans · lesson script

80 min · 14 slides (`slides/thursday_simple.pptx`) · Paper: Yang et al., TOSEM 2022.
Page numbers are the "111:N" in the paper's page header. Students read the paper on laptops.

**Shubham:** slides and Menti. Talks before the break.
**Ananya:** timer and cards. Talks after the break.
**Team work:** both teachers walk the tables. At the minute-5 check, Ananya takes Teams 1 and 2. Shubham takes Team 3.

## Objectives

After this session, we should be confident students could:
1. **Separate** what a study measured from what it claims. **Rewrite** an overreaching claim into one the data supports.
2. **Rank** a study's data: watching people > traces of real use > asking people. **Judge** the study with three questions:
   - Is the research question interesting?
   - Can the data answer it?
   - Do we believe the analysis?
3. **Turn** a finding into one change to a tool. **Name** something to log or watch that shows it worked.

Checked in: #1, each claim card's "Measured" line and weaker sentence. #2, the Slide 6 pause and the jury vote. #3, line 3 of the design card and the exit answer.

## Before class

- **Menti:** three questions, results hidden. Hook: Slide 2. Jury: Slide 8. Exit: Slide 13. Exact text is below.
- **Print:**
  - 3 claim cards and 3 finding cards (below)
  - 3 blank index cards
  - 2 copies of this script
- **Paper:** post the PDF link.

## Clock

| Clock | Min | Slide | Block |
|---|---|---|---|
| 0:00 | 2 | 1 | Welcome |
| 0:02 | 5 | 2–3 | Hook and link to Tuesday |
| 0:07 | 3 | 4 | The study |
| 0:10 | 4 | 5 | What they found |
| 0:14 | 5 | 6 | Three questions for any study |
| 0:19 | 12 | 7 | Claim Court (teams) |
| 0:31 | 11 | 8 | Court in session and jury vote |
| 0:42 | 6 | 9 | Claimed ≠ measured |
| 0:48 | 4 | 10 | **Break** |
| 0:52 | 12 | 11 | Design sprint (teams) |
| 1:04 | 6 | 12 | Git listened (2019) |
| 1:10 | 6 | 13 | Exit (on your own) |
| 1:16 | 2 | 14 | Close |
| 1:18 | 2 | — | **Buffer** |

---

## 0:00 · Slide 1 · Welcome

**Time:** 2 min.

**Do:** Students sit with their Tuesday lab. Lab 1 becomes Team 1, and so on.
**Say:** "Tuesday you ran real Git. Today we study real people using Git. First we put a study on trial. Then we design a tool with what survives. You leave with one new idea about tools for people."

---

## 0:02 · Slides 2–3 · Hook

**Time:** 5 min (vote 1 · reveal 2 · pause 2).

**Do:** Slide 2. Menti vote, 45 seconds, results hidden. Then show the votes, then Slide 3.
**Menti (multiple choice):** "Which Git command's Stack Overflow questions get the most views, on average?"
- Options: git merge · git rebase · git revert · git push
- Correct: git revert

**Say (Slide 3):**
- "git revert. Its questions average 21,726 views each." (Table 4, p.14)
- "The top five: revert, reflog, stash, clean, reset."
- "stash sets unsaved edits aside. clean deletes files Git doesn't track."
- "The authors count stash as recovery (p.13). So four of five are about going back."
- "push is 21st. merge is 24th. rebase is not in the top 30."
- "One question is famous. It asks: 'How do I undo the most recent local commits in Git?'"
- "It has over 22,000 votes and 9 million views." (p.3)

**Pause.**
**Ask:** "Think of Tuesday's mustache. Why would 'undo' confuse people?"
**Hope to hear:** "The right undo depends on where the card is. Only on my laptop: move back. Already shared: add a fix card. To pick, you must know Git's model."
**If silent, ask:** "What happened when Lab 2 moved its note back and sent?" (The Wall refused.)
**Say:** "One goal: undo. Several commands, one per place. That's a design problem."

**Recap of Tuesday's undo tools (say it in 30 seconds):**
- **Problem.** A bad commit is already in history that others share.
- **Idea.** Undo by adding a fix card. Move back only if nobody has it. Keep a diary of where you were.
- **How Git does it.**
  - `git revert <commit>` adds a new commit that undoes an old one. History only grows.
  - `git reset <commit>` moves your branch back. Safe only if nobody else has those commits.
  - `git reflog` is your local diary of where HEAD and each branch pointed.

---

## 0:07 · Slide 4 · The study

**Time:** 3 min.

**Say:** "What they did. No judging yet."
1. "They took every Stack Overflow question with 'git' in a tag. 2008 to 2020: 198,626 questions." (p.5)
2. "They kept questions that name an exact Git command, like git reset. It could be in the title, the question, or the accepted answer. That left 80,370." (p.6)
3. "They checked 600 by hand: 300 kept, 300 dropped. 599 were in the right pile." (p.6)
4. "They also ran a survey. They invited 508 people. 92 replied." (p.9)

**Say:** "Two sources. The questions are traces: records people left while stuck in real work. The survey is people describing themselves."
**Watch for:** Don't say who got the survey invite. Team 2 must find that.

---

## 0:10 · Slide 5 · What they found

**Time:** 4 min.

**Say:** "Their three main findings, in short."
1. "Going back is the top pain. Recovery commands get the most views." (Table 4)
2. "Even long-time users ask. In 2020, 40% of Git askers had Stack Overflow accounts 5+ years old. Across all Stack Overflow askers, any topic: 21%." (Table 3, p.12)
3. "Most people learn Git on their own. On one survey question, 81.7% of all ticks went to self-learning." (Table 7, p.20)

**Say:** "In five minutes, you put these on trial."
**Ask:** "Check what you wrote down. Which of these three do you believe least? Write one word. Keep it to yourself."
**Hope to hear:** Nothing out loud. It is their private bet for the jury.
**Watch for:** The slide says "Even 5-year veterans ask." Don't defend it. Slide 9 takes it apart.

---

## 0:14 · Slide 6 · Three questions for any study

**Time:** 5 min.

**Say:**
1. "Is the question interesting? Would the answer change what a tool builder does?"
2. "Can the data answer it? Picture a ladder."
   - "Top: watch people. You see what they do and where they stall."
   - "Middle: traces of real use. You see what they did, not why."
   - "Bottom: ask people. You get what they remember and choose to say."
3. "Do we believe the analysis? Does the number mean what they say?"
4. "80,370 sounds big. Size doesn't make a weak measure strong."

**Pause.**
**Ask:** "This paper has two data sources. Where does each one sit?"
**Hope to hear:** "The questions are traces of asking for help. Not traces of using Git. The survey is self-report. Nobody watched anyone."
**If silent, ask:** "Did anyone in this study watch a developer use Git?" (No.) "So which source is stronger?"
**Watch for:** The slide says "Do we believe the answer?" Say "analysis".

---

## 0:19 · Slide 7 · Claim Court (teams)

**Time:** 12 min.

**Do (0:19):** Hand each team its claim card (cards are below).
**Say:** "One claim per team. Open the paper at the pages on your card. Fill the four boxes. Verdict WEAKER? Write the sentence the data does support."
**Do (0:24):** Minute-5 check. Each team reads its "Measured" line to a teacher. Wrong? Fix it in one sentence.
**Say (0:29):** "Two minutes. Pick a speaker who hasn't spoken today. Practice on the back of the card."
**Watch for:** A stuck team. Ask the "If stuck" question from its answer key.

---

## 0:31 · Slide 8 · Court in session and jury vote

**Time:** 11 min (pitches 7.5 · vote 1 · reveal 0.5 · discuss 2).

**Do:**
1. Teams 1, 2, 3 each pitch for 2 minutes. After each, the room asks one question (30 s).
2. Everyone votes on Menti (1 min).
3. Reveal the results (30 s).
4. Discuss (2 min).

**Menti (Scales, 1 = don't believe, 5 = fully believe):** "Jury: how much do you believe each claim?"
- Team 1: Even developers with years of experience struggle with Git.
- Team 2: Self-learning is the main way developers learn Git.
- Team 3: Questions about recovery commands get the most views.

**Watch for:** Team 3 should score highest. Teams 1 and 2 lower.

**Pause.**
**Ask:** "Why did one claim survive and two shrink?"
**Hope to hear:** "Team 3's measure matches its words. Teams 1 and 2 stretch theirs. Account age isn't experience. 92 replies, mostly from Stack Overflow askers, aren't 'developers' in general."
**If silent, ask:** "Read each claim's measure out loud. Does it match the words?"
**If the votes are all alike, ask:** "Which pitch moved you, and why?"
**Ask:** "Look at your one-word bet from Slide 5. Did the evidence move it?"
**Hope to hear:** "Yes. I trust the recovery claim more, and 'experienced' less. The measure decided it."
**Say:** "Match your belief to the evidence. A critic who rejects everything helps no one."

---

## 0:42 · Slide 9 · Claimed ≠ measured

**Time:** 6 min (say 2 · pause 4).

**Say:** "Their words are bigger than their measures."
- "'Experienced' was measured as Stack Overflow account age (p.12)."
- "The authors call that proxy 'a compromise' (p.24)."
- "Our Slide 5 said 'veterans'. That's a big word for account age."
- "'Difficult' meant: share of a command's questions with no accepted answer."
- "The popularity table dropped commands under 200 questions (p.13). The difficulty table didn't."
- "So the two hardest had 1 and 3 questions, none accepted (Table 6, p.17)."
- "One question with no accepted answer made a command look hardest."
- "The title asks if developers *know* Git. The data shows who *asks*."
- "For tool builders: to find struggle, measure struggle. Log it or watch it."

**Pause (Sarah's question 1).**
**Ask:** "Is the research question interesting? They counted command names. What would a tool designer rather know?"
**Hope to hear:** "What people were trying to do, and where they got stuck."
**If silent, ask:** "Which helps you build the next Git? 'reflog appears in 1,282 questions'? Or 'people who reset by mistake don't know reflog exists'?"
**Say:** "The paper backs you up. Only 17% of questions name one command. 83% name two or more (p.14, Fig. 3). People ask about a task, not a command. Counting names misses the task."
**Say:** "Then they write, 'Rather than changing the design of Git…' (p.26). Right before, they cite De Rosso and Jackson (refs 17, 42). Those two said Git's design is the problem. They built a redesign, Gitless. This paper chose to count. You'll design, after the break."

---

## 0:48 · Slide 10 · Break

**Time:** 4 min.

**Say:** "Break. Back in 4 minutes."
**Do:** Write the real return time on the board. Start the timer.
**Do (Ananya, during the break):** Deal one finding card, face down, to each table. Add one blank index card.

---

## 0:52 · Slide 11 · Design sprint (teams)

**Time:** 12 min (build 7 · pitches 5).

**Say (0:52):** "Flip your card. Fix that finding with one change to a tool. On the index card, write three things. Seven minutes."
1. A sketch of what the user sees.
2. "This fixes ___ because ___."
3. "We'd know it worked if ___." Something you can log or watch. No surveys.

**Do (0:59):** Pitches: Team 1, then 2, then 3. One minute each.
**Do:** After each pitch, the next team asks the Reviewer question. Team 2 asks Team 1. Team 3 asks Team 2. Team 1 asks Team 3.

**Pause (the Reviewer question).**
**Ask:** "How would you know it worked, without asking anyone?"
**Hope to hear:** Something logged or watched. For example:
- time to recover a lost commit in a lab task
- how often a reset is followed by a successful recovery
- commands typed to finish a task

**If they answer with a survey, ask:** "That's asking people. What could you log or watch?"
**Watch for:** "Better docs." **Ask:** "Where is the user at that moment?" (In the terminal, mid-mistake.)
**Watch for:** "An AI assistant." That's allowed. **Ask:** "Show what the user sees. How would you know it helped?"

---

## 1:04 · Slide 12 · Git listened (2019)

**Time:** 6 min (say 2 · pause 3 · design question 1).

**Problem.** `git checkout` did several jobs with one verb.
- `git checkout main` changes branch.
- `git checkout -- face.txt` throws away that file's edits not yet added with `git add`. No undo.
- `git checkout a1b2c3` jumps to an old commit and leaves you on no branch.
- Same verb. One use moves you. Another destroys work.
- A user with years of Git asked: "What exactly does git checkout [file] do?" (p.13)

**Idea.** One command per job. Name each command after what the user wants.

**How Git does it (Git 2.23, August 2019).**
- `git switch <branch>` changes branch. `git switch -c <name>` creates one and moves to it. An old commit needs `--detach`.
- `git restore <file>` puts a file back to your last `git add`, or last commit. `--source=<commit>` takes an older version. `--staged` undoes a `git add`.
- `git checkout` still works. Nothing was removed.

**Say:** "You turned a finding into a tool change. Git's makers did the same, in 2019."

**Pause.**
**Ask:** "Did switch and restore help? How would you find out?"
**Hope to hear:** "Two groups, same task. One uses checkout, one uses switch and restore. Log time, errors and lost work."
**If silent, ask:** "Would you survey 'Is switch clearer?' Where is that on the ladder?" (Asking people. The bottom.)
**Say:** "This paper could have checked. Its keywords come from Git 2.30 (p.6). That version has switch and restore. The paper reports no numbers for them."

**Ask (design question, 1 min):** "Tuesday, each sticky note kept its own draft. Real Git carries unsaved edits along, or refuses to switch. Which do you want?"
**Hope to hear:** "The app's. My half-done work stays where I left it."
**Say:** "Gitless, the redesign this paper cites, made the app's choice. Design from what people mean to do."

---

## 1:10 · Slide 13 · Exit (on your own)

**Time:** 6 min (write 2.5 · read 2.5 · pause 1).

**Do:** Menti open-ended. Students write alone. Then read 4 answers aloud.
**Menti:** "One sentence: a lesson for designing programming tools for humans. Point to today's evidence."

**Hope to hear (examples):**
- "Put the way back where people get stuck. Recovery is the top pain."
- "One command per job."
- "Measure struggle by logging failures, not by counting mentions."
- "Most people learn alone. So the error message is the teacher."

**If an answer is only critique, ask:** "So what should the tool do?"

**Pause.**
**Ask:** "Which lesson up there did no slide say? Whose is it?"
**Hope to hear:** One or two students name theirs. **Say:** "That's a new insight. Keep it."
**If silent:** Pick the most unusual answer on screen. **Ask:** "Who wrote this? Say more."

---

## 1:16 · Slide 14 · Close

**Time:** 2 min.

**Say:**
- "Question the proxy. Design the way back."
- "When you read a study, ask what they measured."
- "When you build a tool, people will need to go back. Show them the way."
- "Thanks. That's Git week."

---

## 1:18 · Buffer

**Time:** 2 min. Unused? Read two more exit answers.

**If behind, cut in this order:**
1. Use the buffer.
2. Drop the room's question after each jury pitch (saves 1.5 min).
3. Slide 12: say the design-question answer yourself (saves 1 min).
4. Slide 12: say the pause answer yourself (saves 2 min).
5. Cut sprint pitches to 45 seconds, no Reviewer question (saves 2 min).

**Never cut:** the minute-5 check, the break, the exit.

---

## Claim cards (print one per team)

**Front:** the claim, where to read, and four boxes. Boxes 1–3 are Sarah's three questions.
1. Is the question interesting? Would the answer change what a tool builder does?
2. Can the data answer it? What did they measure: watching, traces of real use, or asking?
3. Do we believe the analysis? One other explanation for the same numbers.
4. Verdict: BELIEVE · WEAKER (write the sentence the data supports) · REJECT. One thing they did right, with a page.

**Back (2-minute pitch):** The claim is… → It matters because… → They measured… → Another explanation… → Our verdict… → One thing they did right…

### Team 1 · Experience

- **Claim (p.13, end of §3.2):** "even developers with years of development experience can have trouble using Git commands"
- **Read:** §2.1 Step 4 (p.6–7). §3.2 and Table 3 (p.11–13). §5, "Data analysis" (p.24).

**Answer key**
- **Matters:** if true, tools must help experts too, not only beginners.
- **Measured:** how long each asker had had a Stack Overflow account. Traces. In 2020, 40.0% of Git askers had accounts over 5 years old. For all askers: 21.2% (Table 3, p.12).
- **Other explanations:**
  - An old account isn't years of Git. The paper's own example: "I've been developing for several years now, and I've never had the time to learn about version control" (p.12).
  - People may join Stack Overflow years before they touch Git.
- **Their own words:** the proxy is "a compromise" (p.24).
- **Stronger evidence, same paper:** survey respondents report a median of 8 years of Git (p.9). Only 14.1% rate themselves proficient or above (p.19). Still self-report, mostly from askers.
- **Weaker sentence:** "In 2020, 40% of Git askers had accounts over 5 years old. For all askers: 21%."
- **Did right:** every year is compared with all Stack Overflow askers (Table 3).
- **Wanted verdict:** WEAKER.
- **If stuck, ask:** "Five years of what?"

### Team 2 · Learning

- **Claim (p.20, §3.5):** "self-learning is the primary way for developers to learn to use Git commands"
- **Read:** §2.2, "Target participants" and "Respondents" (p.9). §3.5 and Table 7 (p.19–20). §5, "Design and skewness of survey" (p.24).

**Answer key**
- **Matters:** if most people learn alone, the tool itself must teach.
- **Measured:** one survey question. Asking. People could tick several boxes.
  - 92 of 508 invited people replied.
  - Invites went to recent Stack Overflow Git askers and some researchers (p.9).
  - 81.7% is 161 of 197 *checkmarks*. It is not 81.7% of people.
  - Per person: 85 of 92 ticked internet, 76 docs, 15 peers, 10 online courses, 8 a class (Table 7, p.20).
- **Other explanations:**
  - The question was tick-all: how did you learn? "Primary" needs a ranking. Reading the docs once counts the same as a full course.
  - They recruited on Stack Overflow. Of course those people learn from the internet.
  - It is self-report, from memory, years later.
- **Weaker sentence:** "Of 92 respondents, most found via Stack Overflow, 85 learned online. 8 learned in a class."
- **Did right:** they published raw counts. They pilot-tested the survey with 5 graduate students (p.9).
- **Wanted verdict:** WEAKER.
- **If stuck, ask:** "Who got the survey email?"

### Team 3 · Recovery

- **Claim (p.15, end of §3.3):** "Git commands (e.g., git revert and git reflog) about recovery are among the most popular commands asked on Stack Overflow"
- **Read:** §2.1 Step 5 (p.7). §3.3 and Table 4 (p.13–14). Table 2 (p.11). The "undo" question in the introduction (p.3).

**Answer key**
- **Matters:** it tells a tool builder where to put help: the way back.
- **Measured:** average views of the questions that name the command. Traces. Title, body or accepted answer counts.
  - A question naming five commands credits all five with its views (p.7, p.13).
  - Only commands with 200 or more questions are ranked (p.13).
- **Other explanations:**
  - One huge question lifts every command in its answer. "How do I undo the most recent local commits in Git?" has 9 million views (p.3).
  - They use averages, not medians.
  - Older questions have had more years to collect views (Table 2, p.11).
  - The 600-question check asked "about Git commands?" Not "about this command?" (p.6).
- **But:** the same commands also rank high on favorites and score (Table 4).
- **Weaker sentence:** "Questions that mention recovery commands get the most views on average."
- **Did right:** the 200-question filter (p.13). Three different measures agree.
- **Wanted verdict:** BELIEVE, or a mild WEAKER.
- **If stuck, ask:** "One question mentions five commands. Who gets its views?"

## Finding cards (one per team, dealt face down during the break)

Each team gets a finding it did not judge in Claim Court. Every card ends with the same three lines:
1. Sketch what the user sees.
2. It fixes ___ because ___.
3. We'd know it worked if ___ (something you log or watch, not a survey).

| Team | Card | Finding (evidence) | Prompt |
|---|---|---|---|
| 1 | WAY BACK | 4 of the top 5 commands by average views are about going back: revert, reflog, stash, reset (Table 4, p.14). | Design a way back. |
| 2 | GOALS | Only 17% of questions mention a single command. The other 83% mention two or more (p.14, Fig. 3). | People have goals. Git has commands. Design for the goal. |
| 3 | SELF-TAUGHT | 85 of 92 survey respondents learned Git from the internet. 8 learned it in a class (Table 7, p.20). Survey of Stack Overflow askers. | The tool is the teacher. Design the teaching moment. |

## Facts to get right

- Say "81.7% of survey ticks". Never "81.7% of developers". Per person: 85 of 92 picked the internet.
- Say "Stack Overflow accounts over 5 years old". Never "5 years of Git".
- rebase is not "unpopular". It is not in the top 30 by average views.
- The paper says "experienced developers". It never says "veterans". That word is ours, on Slide 5.
- The two "hardest" commands had answers. None was accepted. Don't say "unanswered".
- Fig. 3 spikes at five commands: 22%, with four at 15% and six at 9%. Don't present "five" as a finding. A student spots it? Say: "Good catch. Only reading the raw questions would tell."
- Git 2.23 (2019) came before this paper. It did not remove `checkout`.
- The paper names neither switch nor restore in its results. Only a cited question's link says "restore" (ref 41).
- The paper says De Rosso and Jackson "propose alternative designs" (p.26). The name Gitless comes from their ref 17, not from this paper.
- Tuesday paper facts: use only `tuesday_paper_notes.md` (full text read). Its one message: flat history is data loss.

## Slide wordings to know about (deck not changed)

- **Slide 2** says "the #1 Git question". The paper ranks commands by average views per question. The Menti text and your Slide 3 line use the exact wording. Fix, if you want: "Guess: which command's questions get the most views?"
- **Slide 5** says "Even 5-year veterans ask." Keep it as bait. Slide 9 calls it out.
- **Slide 5** says "81.7% of survey picks". Say "ticks", and say it was one question.
- **Slide 6** says "Do we believe the answer?" Say "analysis", Sarah's word.
