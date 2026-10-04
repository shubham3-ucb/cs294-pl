# Lead review (Claude, main session): must-fix for smooth learning

Reviewed the full e2e screenshot set for steps 0–8: student, admin and screen views. The core flow is strong. These are the gaps that would make a first-time student hesitate.

1. **Nobody is told how to change a part.** In Steps 0–1 nothing says the panels are clickable. Add one muted hint under the monster, "Click a part to change it.", shown until the student has changed a part once. Make panels look clickable: hover lift, cursor, a small chevron or "change" affordance.
2. **Step 4 instruction is too long** (5 sentences). Cut to at most 3 short ones that also explain why the lab's cards changed. Suggested: "The Wall is the class's shared copy, like GitHub. Every lab now has a full copy of it (Lab N's monster). Compare your newest card's ID with the Wall's."
3. **The card graph clips cards at the left edge** when scrolled to the newest card (Steps 4, 5 and 7). Either fit the graph to width, or add a soft fade plus a visible "← older cards" cue. Never show half-cut cards with text running out.
4. **Step 7 graph:** dashed "only in the diary" cards float far from the rest, with large empty areas. Lay them out compactly near where they used to be, keep the clean card readable, and avoid huge empty bands.
5. **Toasts cover content.** Stacked toasts sit over the legend and "The Wall" heading. Show one toast at a time (newest wins), anchored top-right or bottom-right, with auto-dismiss in about 4 s. Keep the red "Refused" toast until dismissed or acted on.
6. **Step 0 "Behind the door" is empty noise.** Hide it in Step 0, or show the single line "No Git yet. Nothing is saved."
7. **Behind the door is dense** (Problem / Idea / Git / You'd type / Last / low-level). Keep it collapsed by default. When opened, show only: what you did (plain), the Git command, and one sentence of how. Put the rest behind "Show the low-level steps Git ran".
8. **Make the paper moment explicit in Step 7.** The projector already shows Before and After audits. Add one quiet line on the projector and admin: "This is the Tuesday paper: rewriting history erased what the audit needed." Facts only, from lesson/tuesday_paper_notes.md.
9. **Copy consistency:** in-app step titles, buttons and checks must match lesson/tuesday.md and lesson/ONE_PAGE.md exactly. Same names everywhere: card, sticky note, your pin, draft, the Wall, safety diary.
10. **The step timer must match the lesson clock** in lesson/app_copy_proposals.md. Otherwise the admin page shows "behind plan" all class.
11. **Tie each step to the Tuesday paper with one quiet line**, inside Behind the door or the teacher notes only, using facts from lesson/tuesday_paper_notes.md (the full paper has now been read):
    - Step 1: "Git takes your name and your laptop's clock on trust. The paper found 99k+ wrong timestamps in 9 projects."
    - Step 3, after the fast-forward: "No merge card says these cards came from cat-robot. The paper: fast-forward forgets the branch."
    - Step 5: "Each card's trip to the Wall is an integration path. How long it took is code velocity, the metric Microsoft had to rebuild for Git."
    - Step 7: "Squash dropped the cards, and who made them. The paper: some loss cannot be recovered."
