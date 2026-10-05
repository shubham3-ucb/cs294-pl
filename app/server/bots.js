// Rehearse with bots: 2–12 bot students, so one person can run the whole class alone.
// Bots join by name and act only through the session's student actions (join, state, act), with
// human-like pauses. Each follows its own Stuck? Hint, so it does every step's mission: the TOP
// conflict, deleting fancy, the refused send and the lab's way back (Get & combine, or Replay on top),
// Undo on the disguise card, the boss's clean-up.
// At questions and reveals it writes an answer and a takeaway from the sample text below.
// Names end in "(bot)". Stop rehearsal, Reset or a restart removes them.
import crypto from 'node:crypto';
import { PALETTE, PARTS, palette } from '../public/monster.js';
import { SABOTAGE } from './steps.js';
import * as session from './session.js';

const NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kai', 'Noor'];
export const SPEEDS = [1, 5, 20]; // real time, 5× and 20× faster
const CHAOS_CLICKS = 4; // Step 0: each bot changes a part a few times
// Pauses in ms at real time: [shortest, longest]. A faster speed divides them.
const PAUSE = { arrive: [800, 2500], think: [2500, 7000], click: [800, 2000], write: [8000, 25000] };

// Sample answers (4 per question) and takeaways (3 per step). e2e/sim.mjs types the same ones.
export const ANSWERS = {
  'reveal-0': ['Save every version, with a name on it.', 'Keep a history of who changed what.', 'Take a snapshot after each change.', 'One person edits at a time.'],
  'reveal-1': ["The next card doesn't exist yet when you save.", "A card never changes, so it can't point to later cards.", 'Each card only knows its parent.', 'Adding an arrow would change the old card.'],
  'reveal-2': ["Still on main's card. Nothing was copied.", 'On main. The note is only a label.', 'main still points at it.', 'Nothing was copied, the notes just point.'],
  'reveal-3': ['No way to tell. A card does not record its branch.', 'We cannot say. The note is gone and no card names it.', 'The fast-forward made no card that says fancy.', 'A commit stores its parents, not its branch.'],
  'reveal-4': ['Its parent is new, so the hash is new.', 'The ID hashes the parent ID too.', 'A new parent means a new card.', 'Same change, different card: the parent changed.'],
  'reveal-5': ["A fix card only adds, so nobody's copy breaks.", 'Moving back drops a card others already have.', 'The Wall still had the card, so it came back.', 'Revert adds; reset only moves my note.'],
  'reveal-6': ['Only in the labs that kept the old cards.', 'Not on the Wall anymore.', 'The other labs still know.', 'Gone from the Wall after gc.'],
  paper: ['No force push to main.', 'Squash only your own branch, before sharing it.', 'Keep merge cards on main.', 'Protect main; rewrite only private notes.'],
  exit: ['No. Revert adds a card; the old card still holds it. Change the password.', 'No, every copy still has it. Change it, then rewrite, force push and gc.',
    'Revert is not enough. Rotate the password first.', 'No. Rotate the secret; a rewrite cannot reach the copies.'],
};
export const TAKEAWAYS = {
  0: ['Without saves, nobody knows who changed what.', 'Save every version, with a name on it.', 'One shared draft and no history is chaos.'],
  1: ['A card is a full snapshot plus its parent.', 'Cards never change; a save makes a new card.', 'Git trusts my laptop for my name and the time.'],
  2: ['A branch is a label on one card.', 'Making a branch copies nothing.', "Saving moves only the note I'm on."],
  3: ['Merge compares both sides with the split card.', 'A fast-forward only slides the note.', 'No card records the branch it was made on.'],
  4: ['Push only moves the Wall forward.', 'Refused? Merge or rebase, then push.', 'Rebase copies my cards: new IDs.'],
  5: ["Shared mistake: revert, don't reset.", 'Reset is fine only if nobody has the card.', 'The reflog remembers where my note was.'],
  6: ['Squash + force push: the Wall forgets who did what.', 'Force push skips the safety check.', 'Flat history is data loss.'],
};

const randomOf = (items) => items[crypto.randomInt(items.length)];
const fail = (error) => ({ ok: false, error });
const done = (message) => ({ ok: true, result: { message } });

// ---------- A hint, as clicks: [action, input] ----------

const tipOf = (graph, note) => graph.refs[`refs/heads/${note}`];
const intern = (st) => st.lab.graph.commits.find((c) => c.author === 'The Intern');

// Any one part changed to something new.
function anyChange(outfit, step) {
  const part = randomOf(PARTS);
  return { part, value: randomOf(palette(step)[part].filter((v) => v !== outfit[part])) };
}

// Every hint names one concrete click (session tests play whole classes with this, too).
export function movesFor(hint, st) {
  const g = st.lab.graph;
  const note = st.me.branch;
  let m;
  if ((m = /^First finish \*\*[a-z]+\*\*\. (.*)$/.exec(hint))) return movesFor(m[1], st);
  if ((m = /^Click \*\*change\*\* on (HAT|GLASSES|TOP|SHOES)\. Pick (\S+) /.exec(hint))) {
    const part = m[1].toLowerCase();
    return [['draft', { part, value: Object.keys(PALETTE[part]).find((slug) => PALETTE[part][slug] === m[2]) }]];
  }
  if (hint.startsWith('Click **change** on any part.')) return [['chaos', anyChange(st.lab.chaos, 0)]];
  if (hint.startsWith('Click **change** on one part.')) {
    const now = { ...g.commits.find((c) => c.id === tipOf(g, note)).monster, ...st.lab.drafts[note] };
    return [['draft', anyChange(now, st.session.step)], ['commit', {}]];
  }
  if (hint === 'Press **Save card**.') return [['commit', {}]];
  if ((m = /^Press \*\*New sticky note\*\*\. Name it \*\*([a-z]+)\*\*\.$/.exec(hint))) return [['branch', { name: m[1] }]];
  if ((m = /^Press \*\*Switch to\*\* and pick \*\*([a-z]+)\*\*\.$/.exec(hint))) return [['switch', { branch: m[1] }]];
  if ((m = /^Press \*\*Merge ([a-z]+) into main\*\*\.$/.exec(hint))) return [['merge', { from: m[1] }]];
  if ((m = /^Press \*\*Delete sticky note\*\* and pick \*\*([a-z]+)\*\*\.$/.exec(hint))) return [['deleteNote', { note: m[1] }]];
  if (hint.startsWith('Finish the merge')) {
    // A person picks one side of each conflict, never the disguise.
    const open = st.lab.merging[note];
    const side = (part) => randomOf([open.ours[part], open.theirsMonster[part]].filter((v) => v !== SABOTAGE.value));
    return [['resolve', { monster: { ...open.auto, ...Object.fromEntries(open.conflicts.map((p) => [p, side(p)])) } }]];
  }
  if (hint === 'Press **Send to Wall**.') return [['push', {}]];
  if (hint.startsWith('Press **Get & combine**.')) return [['pull', {}]];
  if (hint.startsWith('Press **Replay on top**.')) return [['rebase', {}]];
  if (hint.startsWith('Open the **Safety diary**.')) return [['reflog', {}], ['pull', {}]];
  if (hint.includes('Press **Move my note back here**.')) return [['reset', { commit: intern(st).parents[0] }]];
  if (hint.includes('Press **Undo this card**.')) return [['revert', { commit: intern(st).id }]];
  if (hint.startsWith("Click the newest card in your lab's cards.")) return [['inspect', { repo: 'lab', commit: tipOf(g, 'main') }]];
  if (hint.startsWith('Click the newest card on the Wall.')) return [['inspect', { repo: 'wall', commit: tipOf(st.wall.graph, 'main') }]];
  if (hint === 'Press **Replace the Wall with one card**.') return [['squash', {}]];
  if (/^Press nothing\.|^You saved\. Waiting for|is done\. The other pair is still on/.test(hint)) return [];
  throw new Error(`A hint the bots cannot follow: ${hint}`);
}

// What a bot does now: Step 0's few changes, then its hint, then the open question and takeaway.
// A third item 'write' means a longer pause first.
function nextMoves(st, bot) {
  const { scene, step } = st.session;
  if (scene.kind === 'task' && step === 0) return bot.chaos++ < CHAOS_CLICKS ? movesFor(st.me.hint, st) : [];
  if (step > 0 && st.me.hint) return movesFor(st.me.hint, st);
  const sample = (list) => list[bot.i % list.length];
  if (scene.answerable && !st.me.answers[scene.id]) return [['answer', { scene: scene.id, text: sample(ANSWERS[scene.id]) }, 'write']];
  const line = st.me.gitIn7.find((l) => l.step === scene.takeawayStep);
  if (line && !line.text) return [['takeaway', { step: line.step, text: sample(TAKEAWAYS[line.step]) }, 'write']];
  return [];
}

// ---------- The rehearsal ----------

let run = null; // {boot, speed, count, pids}
// A rehearsal lives until Stop, or until Reset starts a new session.
const live = (r) => !!r && r === run && r.boot === session.version().boot;

const pause = (r, [low, high]) => new Promise((resolve) => setTimeout(resolve, (low + crypto.randomInt(high - low)) / r.speed));

async function play(r, i) {
  for (let n = 0; n <= i; n++) await pause(r, PAUSE.arrive); // bots arrive one after another
  if (!live(r)) return;
  const joined = await session.join({ name: `${NAMES[i]} (bot)` }, { bot: true });
  if (!joined.ok) return;
  const bot = { pid: joined.pid, i, chaos: 0 };
  r.pids.push(bot.pid);
  session.connect(bot.pid); // an open page: the bot counts as online
  while (live(r)) {
    await pause(r, PAUSE.think);
    try {
      const st = live(r) && await session.state(bot.pid);
      if (!st?.me) break;
      for (const [n, [action, input, wait]] of nextMoves(st, bot).entries()) {
        if (n || wait) await pause(r, PAUSE[wait ?? 'click']);
        if (live(r)) await session.act(action, { pid: bot.pid, ...input });
      }
    } catch (err) {
      console.error(`${NAMES[i]} (bot):`, err);
    }
  }
  session.disconnect(bot.pid);
  if (r !== run) await session.leave([bot.pid]); // Stop: this bot may have joined after the others left
}

// For the console: {count, speed} while a rehearsal runs, else null.
export function status() {
  if (!live(run)) run = null;
  return run && { count: run.count, speed: run.speed };
}

// on: start (count bots at speed), or change the speed of the running rehearsal. Off: stop.
export async function rehearse({ on, count, speed }) {
  if (!on) {
    if (!run) return done('No rehearsal is running.');
    const { pids } = run;
    run = null;
    await session.leave(pids);
    return done('Rehearsal stopped. The bots left.');
  }
  const pace = SPEEDS.includes(Number(speed)) ? Number(speed) : SPEEDS[0];
  if (live(run)) {
    run.speed = pace;
    session.touch();
    return done(pace === 1 ? 'Bots play in real time.' : `Bots play ${pace}× faster.`);
  }
  const n = Number(count);
  if (!Number.isInteger(n) || n < 2 || n > NAMES.length) return fail(`Pick 2 to ${NAMES.length} bots.`);
  run = { boot: session.version().boot, speed: pace, count: n, pids: [] };
  for (let i = 0; i < n; i++) play(run, i).catch((err) => console.error(`${NAMES[i]} (bot) stopped:`, err));
  session.touch();
  return done(`${n} bots are joining.`);
}
