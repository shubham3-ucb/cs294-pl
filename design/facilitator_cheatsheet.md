# Facilitator cheat sheet: Git Week (one page per day)
S = Shubham (front) · A = Ananya (floor / Wall). Full script: `design/spec.md`. Menti text: `menti_questions.md`.
**Slide numbers:** "T15" etc. are spec labels. In the Tuesday deck B1 is a visible slide right after T14, so from T15 on deck slide = T + 1 (T34 = slide 35). Every speaker note starts with its label. Thursday's H1–H22 = deck slides 1–22.

---

## TUESDAY 10/13 · Monster Lab · 80 min

**Materials:** ☐ 90 blank cards (FACE/BODY/LEGS) ☐ 3 Step-1 envelopes (W/X/Y/Z, metadata on the back) ☐ 5 official sets #1–#4 (Wall, 3 copy packs, rescue) ☐ 3 "You were cloned" wrappers with yellow `main` and blue `origin/main` on #4 ☐ mustache card ☐ 3 A3 sheets + 12 pencils ☐ 12 black + 3 red markers ☐ 4 yellow pads + 1 blue pad ☐ 3 lab envelopes ☐ gc bin ☐ tape ☐ mission cards: 12 Step-0 slips, 6 idea cards, 3 lab missions, 3 ID-rule slips, GUARD, BOSS, AUDIT, KEY ☐ 3 Model Critic sheets ☐ laptop with `monster/`, `monster-files/`, `broken/` built (`bash demo/setup_demo_repos.sh`, prints "All checks passed") ☐ Menti open ☐ phone timer

| Clock | Slides | S says / does | A does · watch for |
|---|---|---|---|
| 0:00 | T1–T2 | "No Git lecture. You'll rebuild it from paper." Menti hook; **don't reveal**. | Seat 3 labs. |
| 0:02 | T3–T5 | Step 0, 1:30: "One sheet, pencils, follow your slip." At 0:45: "Forty-five seconds!" Then "Who added the horns? Get me the 0:30 monster back." → invent never-erase. T5 pause: "Only FACE is ready. What goes on the next card?" (new FACE + *old* BODY = `git add -p`). | Labs name a **Model Critic**. Hand out cards, markers, critic sheets. Watch: polishing drawings. |
| 0:07 | T6 | Goals, 1 min. | |
| 0:08 | T7–T8 | Step 1, 3:30: "Put another lab's history in order." Once they invent came-from: "**Flip them.** Draw the arrows." Horns added; **no single newest** (Y and Z) → "Step 2." | Check every #1 has "came from: —". Watch: "timestamps". |
| 0:13 | T9–T10 | Step 2, 4:00. Check: "cat-robot draws again: came-from? which flags move?" T10 live: `cat .git/HEAD`; `git rev-parse HEAD > .git/refs/heads/hack && git branch`. Pause: pin on a flagless card = **detached HEAD**. Reveal hook: **D**. | **At 2:30 be the Client:** "Approved monster AND each idea's latest. Now!" |
| 0:20 | T11–T12 | Step 3, 5:00: "ONE monster, both ideas." Nudge: "Who changed each panel since #1?" Check: "Cover #1. Is FACE a conflict?" | Watch: "take the newest" → "whose work did you throw away?" Stuck: rescue #1–#3 side by side. |
| 0:28 | T13–T15 | Live merge (body-only conflict) → resolve → `cat-file -p HEAD`. Menti T14 → show **B1**. T15 `broken/`: clean merge, NameError. Say: **"False alarms AND silent misses."** | |
| 0:33 | T16 | **Break 3 min.** *Must start by 0:33.* | Labs envelope Part-1 cards. Tape #1–#4 + `main` on the Wall; gc bin; a copy pack on each table. |
| 0:36 | T17–T18 | "You were cloned." Check: "All four cards, not just #4. Why?" "And the blue flag?" | One fixed Courier per lab. |
| 0:37 | T19–T21 | Step 5, 2:00: everyone shouts "#5" → "Could the name come from the card?" → hand out ID slips. Check: "Lab 1 changes LEGS to wheels?" (**drw0**; every later card changes). Live `hash-object` on 2 laptops (`946ac5d…`). T21: `ls-tree`, same `legs.txt` blob. | Watch: miscounts (fine). Bonus: "dragon → donkey?" (**drt3** collision). |
| 0:42 | T22–T23 | Step 6, 6:00. Freeze after the 2nd card: "Lab 1, where's your dragon?" → class invents GUARD. Check: "Blue flag says #4. Where's the wall's main?" | **Be the Wall:** accept 2 cards → move main back → read **GUARD**. Rejected: copy cards + move blue flag (fetch) → combine card → re-post. **AUDIT run 1:** Lab 1, 30 s, succeeds. |
| 0:51 | T24–T26 | Step 7, 3:00: "Make it gone. Don't break anyone's table." Check: "When is ripping off OK?" | *Before T25:* post the mustache, "Everyone pull." Rip it off when asked → "Lab 3, push one card" → **zombie**. Accept the fix card only if it comes from the wall's *current* `main` (Lab 3's card after the zombie). |
| 0:57 | T27–T28 | Step 8, 3:00. Be the Boss, **straight-faced; read the reason**. "FORCE." T28 pause: "Where does the truth still exist?" → "Lab 1, ask Lab 2's table, 30 s." | Bin the old cards, empty the bin. **AUDIT run 2:** Lab 1 fails. |
| 1:02 | T29 | TPS 1/2/2: one rule, sort cases a/b/c. Bans only force → "(c) needs no force. What did the auditor lose?" | **KEY card** to any "never rewrite" pair. |
| 1:07 | T30 | Paper: "Their algorithm rebuilds integration paths from what's left." **No numbers, no how.** | |
| 1:09 | T31 | Exit ticket, 4 Qs, laptops closed. | Note any item < 70%. |
| 1:13 | T32–T34 | Recap 1 min · Model Critics 3 × 30 s ("where does paper lie?") · Starry · "Bring one claim you don't believe, with its page." | |
| 1:17 | — | **Buffer 3:** redo any exit item < 70% on cards. | |

**Key IDs** (last digit of letters + parent digits; Ananya enforces GUARD, not arithmetic):
- **Lab cards:** drt3 · cdt5 · crr3
- **First combine:** first-in drt3 + cdt5 → **ddt2** · drt3 + crr3 → **drr8** · cdt5 + crr3 → **cdr2**
- **Final** (dragon/disco suit/roller skates = 27 letters): **ddr2** (via ddt2 or cdr2) or **ddr0** (via drr8). Any other path: last digit of 27 + both parents' digits.
- **Mustache** (mustache 8 + 9 + 12 = 29 + main's digit): ddr2 → **mdr1**, fix card **ddr8** · ddr0 → **mdr9**, fix card **ddr6**. (These fix-card IDs are the textbook case on T26, fix card straight on the mustache. Live, after the zombie, the fix card sits on Lab 3's card: any consistent ID.)
- **Slides use** crr3 first on the wall (T23) → cdr2 → ddr2 → mdr1 → ddr8 (T26, T28, Thursday H4). Live order will differ; that's fine.
- **Boss's clean card** (no parent): **ddr7**

**Cut if behind:** ① T21 → one sentence ② T15 → say the line only ③ Model Critics → one entry ④ Step 7 → talk only, A acts out the zombie ⑤ Step 5 → S computes Lab 1's ID on the board.
**Never cut:** Step 3 · Step 8 + both AUDIT runs · exit Q-c, Q-d. **Ahead:** hidden B3 (tag · stash · cherry-pick · blame).

---

## THURSDAY 10/15 · The Humans · 80 min

**Materials:** ☐ ~14 stickies + pens at the door ("claim you don't believe + page") ☐ 16 slips, half **A** (`git rebase --onto main A B`), half **B** (`git add`), each with the Novice…Expert scale, **shuffled into one stack** ☐ 3 court packets: Pink P1★ + B2 · Blue B1★ + O2 · Orange O1★ + P3; all three axis checklists + presentation script on the back ☐ 4 finding cards (RECOVERY, COMBOS, SELF-TAUGHT, bonus HISTORY) ☐ index cards ☐ whiteboard markers ☐ Menti (6 slides) ☐ printed 7.1 answer key for both facilitators

| Clock | Slides | S says / does | A does · watch for |
|---|---|---|---|
| 0:00 | H1 | "If you leave without one new design insight, we've failed." | **At the door:** a sticky for every student. |
| 0:02 | H2–H4 | Menti **ranking**, 45 s, hidden → class ranking → H3 truth (revert 1, commit 16, checkout 17, push 21, merge 24, rebase > 30). H4: "Why was the mustache the hardest call?" | During H2–H9, sort the stickies by axis onto the court tables. Re-ask any Tuesday exit item < 70% on H4. |
| 0:08 | H5 | Goals. | |
| 0:09 | H6–H9 | Paper, 2 slides, no judging. **H8: students place it first** (2 Menti Qs) → H9 reveal (reconnaissance; SO rung 2, survey rung 4). Pairs 90 s: "What would you need to *observe*?" | Watch votes: evaluative → "evaluating which tool?"; rung 1 → "did anyone watch a developer?" |
| 0:17 | H10–H12 | Deal slips face down, 2 min. **Before the tally**, write on the board: "Hard question first → lower median. If tied or flipped, we were wrong." H12: "n ≈ 6 each: what would it take to believe this?" | **Tally** on the board: 2 rows (A/B) × 5 levels. **Don't explain away a miss.** |
| 0:22 | H13 | Claim Court rules, 2 min: 3 boxes, weaker version = a sentence the data literally supports. Courts may swap their backup for the top student sticky. | |
| 0:24 | H13 | Courts work, 10 min. Float with Orange. | Float Pink + Blue. **Minute 5 board check:** each court writes its ★ "Measured:" line; correct it within 30 s (answers in 7.1). |
| 0:34 | H14 | Jury Menti (before) → 3 courts × 3 min (verdict, gap, weaker version, one thing done right + page) → re-vote, show the shift. | Timekeeper: hard stop at 3:00. |
| 0:45 | H15 | Claimed vs measured. **Credit students by name** for sticky claims used. Raise any missed ★ (A2!). | |
| 0:48 | H16 | "Is the RQ even interesting?" 4 min. Facilitator-only P2/B3/O3 if useful. | |
| 0:52 | H17 | **Break 4 min.** | A finding card face down on each table. |
| 0:56 | H18 | Git listened (sometimes): checkout → switch/restore vs the `pull` config hint. "Which is better design, and what study would tell you?" | |
| 0:59 | H19 | Sprint, 7 min build + 5 min pitches (60 s + one Reviewer-2 question). **Each person initials one line.** | Watch: self-report measure → "That's rung 4. What could you log?" "Better docs" → "Where is the user at that moment?" |
| 1:11 | H20 | **Individual exit**, 3 min, before our list. Read 3–4 aloud. | Note any answer with no finding or a self-report measure → Ed follow-up. |
| 1:15 | H21–H22 | "Ours, for comparison. Whose answer isn't on our list?" Starry: "Question the proxy. Design the way back." | |
| 1:18 | — | Buffer 2. | |

**Watch for (all session):**
- Say "81.7% of *selections*".
- 14.1% Proficient+ is of all 92; the median of 8 yrs also describes all 92.
- Never call the slip result a finding.
- No numbers from Just et al.
- `rebase` isn't "unpopular", just not in the top 30.

**Cut if late:** ① skip the break (+4) ② courts present the ★ claim only, 2 min each (+3) ③ H16 → 2 min (+2) ④ pitches 45 s (+1).
**Never cut:** the H8 vote · H20 exit.
