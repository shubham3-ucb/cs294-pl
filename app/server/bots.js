// Rehearse with bots: 2–12 bot students, so one person can run the whole class alone.
// Bots join by name and act only through the session's student actions (join, state, act), with
// human-like pauses. Each follows the click of its own Stuck? Hint (the hint's second level), so it does
// every step's mission: the TOP conflict, deleting fancy, the refused send and a way back it chooses
// (Get & combine or Replay on top), an undo it chooses (Undo this card or Move my note back), the boss's clean-up.
// Bots predict, too: as lab-mates in the panel, and with every Merge and Send they press. One bot in three
// guesses naively (no conflict; the Wall accepts), so the reveals show a mix of right and wrong.
// Where a hint offers two ways, bots choose a mix: Step 4 by the order the Wall refused their labs, Step 5 by
// lab number. At questions and reveals it writes an answer and a takeaway from the sample text below.
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
  paper: ['Gain: one card per feature to revert. Lose: who wrote which part.', 'A short main and easy bisect; the auditor loses authors and times.',
    'One clean card per feature. Who did what is gone once the branch is deleted.', 'Gain: a readable main. Lose: how the feature was built, and by whom.'],
  exit: ['No. Revert adds a card; the old card still holds it. Change the password.', 'No, every copy still has it. Change it, then rewrite, force push, gc, and re-clone.',
    'Revert is not enough. Rotate the password first.', 'No. Rotate the secret; a lab with the old cards would merge them back.'],
};
export const TAKEAWAYS = {
  0: ['Without saves, nobody knows who changed what.', 'Save every version, with a name on it.', 'One shared draft and no history is chaos.'],
  1: ['A card is a full snapshot plus its parent.', 'Cards never change; a save makes a new card.', 'Git trusts my laptop for my name and the time.'],
  2: ['A branch is a label on one card.', 'Making a branch copies nothing.', "Saving moves only the note I'm on."],
  3: ['Merge compares both sides with the split card.', 'A fast-forward only slides the note.', 'No card records the branch it was made on.'],
  4: ['Push only moves the Wall forward.', 'Refused? Merge or rebase, then push.', 'Rebase copies my cards: new IDs.'],
  5: ["Shared mistake: revert, don't reset.", 'Reset is fine only if nobody has the card.', 'The reflog remembers where my note was.'],
  6: ['Squash + force push: the Wall forgets who did what.', 'Force push skips the safety check.', 'For analysts, flat history is data loss.'],
};

const randomOf = (items) => items[crypto.randomInt(items.length)];
const fail = (error) => ({ ok: false, error });
const done = (message) => ({ ok: true, result: { message } });

// ---------- A hint, as clicks: [action, input] ----------

const tipOf = (graph, note) => graph.refs[`refs/heads/${note}`];
const intern = (st) => st.lab.graph.commits.find((c) => c.author === 'The Intern');

function ancestorsOf(byId, id) {
  const seen = new Set();
  for (const todo = id ? [id] : []; todo.length;) {
    const c = byId.get(todo.pop());
    if (c && !seen.has(c.id)) { seen.add(c.id); todo.push(...c.parents); }
  }
  return seen;
}

// What Git will do, read off the lab's cards the way a student can: merge — compare both sides with the card
// where they split; send — is the Wall's newest card (the live Wall) in main's history?
function rightGuess(kind, st, target) {
  const g = st.lab.graph;
  const byId = new Map(g.commits.map((c) => [c.id, c]));
  const mine = ancestorsOf(byId, tipOf(g, 'main'));
  if (kind === 'push') return mine.has(tipOf(st.wall.graph, 'main')) ? 'accepted' : 'refused';
  const theirs = ancestorsOf(byId, tipOf(g, target));
  if (theirs.has(tipOf(g, 'main'))) return 'ff';
  const common = [...mine].filter((id) => theirs.has(id));
  const base = common.find((id) => !common.some((o) => o !== id && ancestorsOf(byId, o).has(id)));
  const [b, o, t] = [base, tipOf(g, 'main'), tipOf(g, target)].map((id) => byId.get(id)?.monster ?? {});
  const clash = PARTS.find((p) => o[p] !== b[p] && t[p] !== b[p] && o[p] !== t[p]);
  return clash ? `conflict:${clash}` : 'clean';
}

// One bot in three guesses naively. Without a bot (the session tests), the guess is right.
const NAIVE = { merge: 'clean', push: 'accepted' };
const guessFor = (kind, st, bot, target) => (bot && bot.i % 3 === 2 ? NAIVE[kind] : rightGuess(kind, st, target));

// Step 4: the first lab the Wall refused combines, the next replays, and so on; a lone refusable lab replays.
function wayFor(st) {
  if (st.session.labs.length - 1 <= 1) return 'rebase';
  return session.refusedOrder().indexOf(st.lab.id) % 2 === 0 ? 'merge' : 'rebase';
}

// Step 5: even labs, and a lab alone, move back first (and meet the refusal); odd labs add a fix card.
const undoFor = (st) => (st.session.labs.filter((l) => !l.practice).length === 1 || Number(st.lab.id) % 2 === 0 ? 'reset' : 'revert');

// Any one part changed to something new.
function anyChange(outfit, step) {
  const part = randomOf(PARTS);
  return { part, value: randomOf(palette(step)[part].filter((v) => v !== outfit[part])) };
}

// Every hint's click names one concrete move, or two ways to choose from (session tests play whole classes
// with this, too). A Merge (Step 3) or a Send (Steps 4–5) carries the presser's prediction.
export function movesFor(hint, st, bot = null) {
  const g = st.lab.graph;
  const note = st.me.branch;
  let m;
  if ((m = /^First finish \*\*[a-z]+\*\*\. (.*)$/.exec(hint))) return movesFor(m[1], st, bot);
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
  if ((m = /^Press \*\*Merge ([a-z]+) into main\*\*\.$/.exec(hint))) return [['merge', { from: m[1], guess: guessFor('merge', st, bot, m[1]) }]];
  if ((m = /^Press \*\*Delete sticky note\*\* and pick \*\*([a-z]+)\*\*\.$/.exec(hint))) return [['deleteNote', { note: m[1] }]];
  if (hint.startsWith('Finish the merge')) {
    // A person picks one side of each conflict, never the disguise.
    const open = st.lab.merging[note];
    const side = (part) => randomOf([open.ours[part], open.theirsMonster[part]].filter((v) => v !== SABOTAGE.value));
    return [['resolve', { monster: { ...open.auto, ...Object.fromEntries(open.conflicts.map((p) => [p, side(p)])) } }]];
  }
  if (hint === 'Press **Send to Wall**.') return [['push', { guess: guessFor('push', st, bot) }]];
  if (hint.startsWith('Pick a way:')) return [[wayFor(st) === 'merge' ? 'pull' : 'rebase', {}]];
  if (hint.startsWith('Press **Get & combine**.')) return [['pull', {}]];
  if (hint.startsWith('Press **Replay on top**.')) return [['rebase', {}]];
  if (hint.startsWith('Open the **Safety diary**.')) return [['reflog', {}], ['pull', {}]];
  const undo = hint.includes('**Undo this card**');
  const back = hint.includes('**Move my note back here**');
  if (back && (!undo || undoFor(st) === 'reset')) return [['reset', { commit: intern(st).parents[0] }]];
  if (undo) return [['revert', { commit: intern(st).id }]];
  if (hint.startsWith("Click the newest card in your lab's cards.")) return [['inspect', { repo: 'lab', commit: tipOf(g, 'main') }]];
  if (hint.startsWith('Click the newest card on the Wall.')) return [['inspect', { repo: 'wall', commit: tipOf(st.wall.graph, 'main') }]];
  if (hint === 'Press **Replace the Wall with one card**.') return [['squash', {}]];
  if (/^Press nothing\.|^You saved\. Waiting for|is done\. The other pair is still on/.test(hint)) return [];
  throw new Error(`A hint the bots cannot follow: ${hint}`);
}

// What a bot does now: Step 0's few changes, then a prediction while its lab's next merge or send is open,
// then its hint's click, then the open question and takeaway. A third item 'write' means a longer pause first.
function nextMoves(st, bot) {
  const { scene, step } = st.session;
  if (scene.kind === 'task' && step === 0) return bot.chaos++ < CHAOS_CLICKS ? movesFor(st.me.hint.click, st, bot) : [];
  const open = scene.kind === 'task' && !st.lab.done && st.lab.moments[0]; // the lab's next action, as the panel shows it
  if (open && !open.mine) return [['predict', { moment: open.id, guess: guessFor(open.kind, st, bot, open.target) }]];
  if (step > 0 && st.me.hint) return movesFor(st.me.hint.click, st, bot);
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
