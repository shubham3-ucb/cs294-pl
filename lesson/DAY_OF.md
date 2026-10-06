# Day of class · checklist (Tuesday and Thursday)

**15 minutes before**
1. On the server: `cd ~/shubham/git_course/app && tmux new -s class ./host.sh`. Detach with **Ctrl-b d** (the class keeps running if your SSH window closes). Back in: `tmux attach -t class`.
   A fresh teacher key for the day: `ADMIN_KEY=$(openssl rand -hex 6) tmux new -s class ./host.sh`.
2. It prints three links per day. Tuesday: Students `…/` · Teacher `…/admin?key=…` · Projector `…/screen?key=…`. Thursday: the same with `/thu`.
3. Laptop: plug in, sleep off. Displays set to **Extend** (not mirror), so the class never sees your console.
4. Open the **Teacher** link. Press **Start presenting**. Drag the new window onto the projector. Press **F**.
5. Test: join from your phone or a private window. Check the name appears. Then **Details → Reset**, and close the test window.
6. Post the **Students** link in the course chat (laptops can't scan the QR easily).
7. Keep the deck open as the fallback: `slides/tuesday_app_preview.pdf` / `slides/thursday_app_preview.pdf`.

**In class**
- Press only **Next** (→ or Space; ← is Back). Read **Say**; ask **Ask**; the answer you hope for is under it.
- Next when the console shows everyone done, or when the clock turns red.
- Tuesday: a stuck lab → tell them **Need a hint?**; still stuck → **Rescue** on its tile.
- Thursday, before the Next after the break: "everyone open the /thu tab". Wait until "here" matches the room. Groups look wrong → **Re-form groups**.

**If the link dies**
In tmux, Ctrl-C, then `./host.sh` again. Open the new Teacher link, post the new Students link. Students type the same name: they get their place back. Nothing is lost.

**After class**
1. **Details → Export answers**.
2. Back up: `cp -r ~/shubham/git_course/app/data ~/backup-$(date +%F)`.
3. Then **Reset**. Stop the server: `tmux attach -t class`, then Ctrl-C.
