// Records the demo: one real class run on this machine, 3 labs of 2 students, and the teacher presses
// only Next through the 7 steps. Ana (Lab 1) and Ben (Lab 2) click through the real student page; their
// lab-mates and Lab 3 call the same student API those buttons call. One 1920×1080 stage shows four live
// pages (console, projector, Ana, Ben) under a caption bar, and a Chrome screencast of it becomes the video.
//   node demo/record_demo.mjs        (Node 22+, Playwright's Chromium, ffmpeg)
// Writes demo/DEMO.mp4, demo/DEMO_STORYBOARD.pdf and docs/demo.gif. The app runs on 127.0.0.1:3310 with
// DATA_DIR=/tmp/v3_demo and ADMIN_KEY=demo, and is stopped at the end. Frames go to /tmp/v3_demo_rec.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from '../app/node_modules/playwright/index.mjs';
import { SCENES, STEPS } from '../app/server/steps.js';
import { ANSWERS, TAKEAWAYS } from '../app/server/bots.js';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 3310;
const KEY = 'demo';
const DATA = '/tmp/v3_demo';
const WORK = '/tmp/v3_demo_rec';
const API = `http://127.0.0.1:${PORT}`;
const W = 1200; // each page's own viewport, drawn at 0.8 in the grid and 1.6 when it fills the stage
const H = 620;
const FPS = 30;
const LAB = { Ana: '1', Raj: '1', Mei: '2', Ben: '2', Kim: '3', Tom: '3' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- The app, and the four people nobody sees ----------

fs.rmSync(DATA, { recursive: true, force: true });
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(`${WORK}/frames`, { recursive: true });

let serverErr = '';
const server = spawn(process.execPath, ['server/index.js'], {
  cwd: `${ROOT}app`, env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT), DATA_DIR: DATA, ADMIN_KEY: KEY, LABS: '3' },
});
server.stderr.on('data', (d) => { serverErr += d; });

const post = (path, body, admin = false) => fetch(API + path, {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...(admin ? { 'x-admin-key': KEY } : {}) },
}).then((r) => r.json());
const adminState = () => fetch(`${API}/api/admin/state?key=${KEY}`).then((r) => r.json());

const P = {}; // name → pid
const streams = []; // open event streams: the server counts these people as online
async function join(name) {
  const r = await post('/api/join', { name });
  P[name] = r.pid;
  if (r.labId !== LAB[name]) await post('/api/admin/move', { pid: r.pid, labId: LAB[name] }, true);
  streams.push(http.get(`${API}/api/events?pid=${r.pid}`, (res) => res.resume()));
}
// A hidden student presses a button: the same endpoint the page calls.
async function as(name, action, body = {}) {
  const r = await post(`/api/${action}`, { pid: P[name], ...body });
  if (!r.ok) throw new Error(`${name} ${action}: ${r.error}`);
  return r;
}
async function save(name, parts) {
  for (const [part, value] of Object.entries(parts)) await as(name, 'draft', { part, value });
  return as(name, 'commit');
}
const write = (name, step) => as(name, 'takeaway', { step, text: TAKEAWAYS[step][1] });
const answer = (name, scene, i) => as(name, 'answer', { scene, text: ANSWERS[scene][i] });

const gitIn = (repo, ...args) => execFileSync('git', args, {
  cwd: repo === 'wall' ? `${DATA}/wall.git` : `${DATA}/labs/${repo}`, encoding: 'utf8',
  env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
}).trim();
const tip = (repo, ref = 'refs/heads/main') => gitIn(repo, 'rev-parse', ref);

// ---------- The stage: four live pages and a caption bar ----------

const STAGE = `<!doctype html><meta charset="utf-8"><style>
@property --s { syntax: '<number>'; inherits: true; initial-value: .8; }
@property --x { syntax: '<number>'; inherits: false; initial-value: 600; }
@property --y { syntax: '<number>'; inherits: false; initial-value: 420; }
* { box-sizing: border-box; margin: 0; }
body { width: 1920px; height: 1080px; overflow: hidden; background: #fff; color: #111; font-family: Inter, sans-serif; }
.q { position: absolute; width: 960px; height: 496px; overflow: hidden; background: #fff; box-shadow: 0 0 0 1px #D4D4D8;
  --s: .8; transition: left .6s ease, top .6s ease, width .6s ease, height .6s ease, --s .6s ease; }
.q.big { left: 0 !important; top: 0 !important; width: 1920px; height: 992px; --s: 1.6; }
.q.up { z-index: 2; }
.q iframe { display: block; width: ${W}px; height: ${H}px; border: 0; transform-origin: 0 0; transform: scale(var(--s)); }
.tag { position: absolute; right: 12px; top: 10px; padding: 5px 11px; border-radius: 8px; background: rgba(17,17,17,.8);
  color: #fff; font-size: 14px; font-weight: 600; pointer-events: none; }
#t .tag { right: 222px; }
#p .tag { top: auto; bottom: 10px; }
.cursor { position: absolute; left: calc(var(--x) * var(--s) * 1px); top: calc(var(--y) * var(--s) * 1px); width: 28px; height: 28px;
  margin: -14px 0 0 -14px; border-radius: 50%; border: 3px solid #111; background: rgba(255,255,255,.6);
  box-shadow: 0 1px 6px rgba(0,0,0,.35); opacity: 0; pointer-events: none;
  transition: --x .45s ease-in-out, --y .45s ease-in-out, transform .12s, opacity .3s; }
.cursor.on { opacity: 1; }
.cursor.press { transform: scale(.65); }
#cap { position: absolute; left: 0; right: 0; bottom: 0; height: 88px; display: flex; align-items: center; gap: 28px;
  padding: 0 40px; border-top: 1px solid #D4D4D8; background: #fff; }
#step { font-size: 17px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #8B3DFF; white-space: nowrap; }
#text { flex: 1; font-size: 26px; font-weight: 500; line-height: 1.25; }
#tool { font: 600 21px ui-monospace, "JetBrains Mono", "Noto Sans Mono", monospace; padding: 8px 14px; border-radius: 10px;
  background: #F3ECFF; color: #6A1FD8; white-space: nowrap; }
#tool:empty { display: none; }
</style>
<div class="q" id="t" style="left:0;top:0"><iframe src="http://localhost:${PORT}/admin?key=${KEY}"></iframe>
  <span class="tag">Teacher console</span><i class="cursor"></i></div>
<div class="q" id="p" style="left:960px;top:0"><iframe src="http://localhost:${PORT}/screen?key=${KEY}"></iframe>
  <span class="tag">Projector</span></div>
<div class="q" id="a" style="left:0;top:496px"><iframe src="http://ana.demo:${PORT}/"></iframe>
  <span class="tag">Ana · Lab 1</span><i class="cursor"></i></div>
<div class="q" id="b" style="left:960px;top:496px"><iframe src="http://ben.demo:${PORT}/"></iframe>
  <span class="tag">Ben · Lab 2</span><i class="cursor"></i></div>
<footer id="cap"><span id="step"></span><span id="text"></span><code id="tool"></code></footer>`;

// The students' new-button tips are switched off, so the bubbles never cover the class; the join tour stays.
const TIPS = STEPS.flatMap((s, n) => s.tips.map((t) => `${n}:${t.action}`));

let stage;
const pane = {}; // t, p, a, b → {frame, el}

// ---------- The screencast: every frame Chrome draws, with its time ----------

const frames = []; // {file, t}
let cdp;
let t0 = null;
async function startRecording() {
  cdp = await stage.context().newCDPSession(stage);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    t0 ??= metadata.timestamp;
    const file = `${WORK}/frames/${String(frames.length).padStart(6, '0')}.jpg`;
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp - t0 });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
}
const now = () => (t0 === null ? 0 : Date.now() / 1000 - t0);

// ---------- Captions, stills for the storyboard, clips for the GIF ----------

const board = []; // {t, step, text, tool, img}
const clips = []; // [start, end] in video seconds
async function still() {
  board.at(-1).img = await stage.screenshot({ type: 'jpeg', quality: 82 });
}
async function say(step, text, tool = '') {
  if (board.length && !board.at(-1).img) await still();
  await stage.evaluate(([s, x, t]) => {
    document.getElementById('step').textContent = s;
    document.getElementById('text').textContent = x;
    document.getElementById('tool').textContent = t;
    document.getElementById('cap').animate([{ opacity: 0.2 }, { opacity: 1 }], 300);
  }, [step, text, tool]);
  board.push({ t: now(), step, text, tool, img: null });
}
async function amend(text) {
  board.at(-1).text = text;
  await stage.evaluate((x) => { document.getElementById('text').textContent = x; }, text);
}
async function clip(seconds) {
  const start = now();
  await sleep(seconds * 1000);
  clips.push([start, now()]);
}

// One page fills the stage (or none: the grid). The enlarged page stays on top until it is back in place.
async function zoom(id = null) {
  await stage.evaluate((big) => {
    for (const q of document.querySelectorAll('.q')) {
      const on = q.id === big;
      if (on || q.classList.contains('big')) q.classList.add('up');
      q.classList.toggle('big', on);
    }
    setTimeout(() => { for (const q of document.querySelectorAll('.q:not(.big)')) q.classList.remove('up'); }, 650);
  }, id);
  await sleep(700);
}

// ---------- Acting through a page ----------

// Scroll a page smoothly so an element is in view (block: start | center | end).
async function show(id, sel, block = 'start') {
  await pane[id].frame.locator(sel).first().evaluate((e, b) => e.scrollIntoView({ block: b, behavior: 'smooth' }), block);
  await sleep(700);
}
async function top(id) {
  await pane[id].frame.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(600);
}

// A real mouse click: the pane's pointer glides to the element, then the mouse presses on the stage
// (the pages are scaled, so the point is the element's spot in the page times the pane's scale).
// api: wait for that endpoint's answer and return it; want: the answer's ok, checked.
async function tap(id, sel, { api, corner = false, want = true } = {}) {
  const { frame, el } = pane[id];
  const loc = frame.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 10_000 });
  await loc.evaluate((e) => e.scrollIntoView({ block: 'nearest' }));
  const [left, topY, width, height] = await loc.evaluate((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
  const x = corner ? left + 14 : left + width / 2;
  const y = corner ? topY + 14 : topY + height / 2;
  await stage.evaluate(([q, cx, cy]) => {
    const c = document.querySelector(`#${q} .cursor`);
    c.style.setProperty('--x', cx);
    c.style.setProperty('--y', cy);
    c.classList.add('on');
  }, [id, x, y]);
  await sleep(550);
  const box = await el.boundingBox();
  const s = box.width / W;
  const answered = api && stage.waitForResponse((r) => new URL(r.url()).pathname === `/api/${api}`, { timeout: 10_000 });
  await stage.evaluate((q) => {
    const c = document.querySelector(`#${q} .cursor`);
    c.classList.add('press');
    setTimeout(() => c.classList.remove('press'), 160);
    clearTimeout(c.fade);
    c.fade = setTimeout(() => c.classList.remove('on'), 1500); // the pointer rests, then fades
  }, id);
  await stage.mouse.click(box.x + x * s, box.y + y * s);
  if (!answered) return null;
  const json = await (await answered).json();
  if (want !== null && json.ok !== want) throw new Error(`${id}: ${sel} → ${JSON.stringify(json)}`);
  return json;
}

// Action-row buttons hold a dropdown on their right, so press near the corner, on the words.
const API_OF = { deleteNote: 'delete-note', squash: 'squash-force' };
const press = (id, act, want = true) => tap(id, `#actions [data-act="${act}"]`, { api: API_OF[act] ?? act, corner: true, want });
async function pick(id, part, slug) {
  await tap(id, `#draft [data-part="${part}"]`);
  await sleep(250);
  await tap(id, `#popover [data-slug="${slug}"]`, { api: SCENES[scene].step === 0 ? 'chaos' : 'draft' });
}
async function choose(id, act, note, want = true) {
  await pane[id].frame.selectOption(`#actions select[data-pick="${act}"]`, note);
  return press(id, act, want);
}
async function openCard(id, cardId, svg = '#graph') {
  await tap(id, `${svg} .g-card[data-key="${cardId}"]`);
  await pane[id].frame.locator('#card-dialog[open]').waitFor();
}
const closeDialog = (id, dialog) => tap(id, `#${dialog} [data-close]`);
async function type(id, field, text) {
  const box = pane[id].frame.locator(`#qa [data-field="${field}"]`);
  await box.fill(text);
  const answered = stage.waitForResponse((r) => /^\/api\/(answer|takeaway)$/.test(new URL(r.url()).pathname));
  await box.press('Enter');
  await answered;
}
async function sees(id, sel, text, ms = 10_000) {
  const end = Date.now() + ms;
  while (!(await pane[id].frame.locator(sel).first().textContent().catch(() => '') ?? '').includes(text)) {
    if (Date.now() > end) throw new Error(`${id} never showed "${text}" in ${sel}`);
    await sleep(100);
  }
}

// The teacher's only button. The console scrolls to it, the pointer presses it, every page follows.
let scene = 0;
async function next(...caption) {
  if (board.length && !board.at(-1).img) await still();
  await show('t', '#next', 'center');
  await tap('t', '#next');
  if (caption.length) await say(...caption);
  scene += 1;
  const s = SCENES[scene];
  await sees('t', '#scene-title', s.title);
  await pane.p.frame.locator(`#slide .sl.kind-${s.kind}`).waitFor();
  const crumb = s.kind === 'join' ? 'Getting ready' : s.title;
  await Promise.all(['a', 'b'].map((id) => sees(id, '#crumbs', crumb)));
  await Promise.all(['t', 'a', 'b'].map(top));
}

// Takeaways at a reveal (they are optional): Ana and Ben type theirs, Raj sends his. Three different lines.
async function takeaways(step) {
  await type('a', `t:${step}`, TAKEAWAYS[step][0]);
  await type('b', `t:${step}`, TAKEAWAYS[step][2]);
  await write('Raj', step);
}

// ---------- The class ----------

async function lesson() {
  await say('Outfit Lab', 'A real class run: 3 labs of 2 students. The teacher presses only Next. Every button runs real Git.');
  await sleep(4200);

  // Join: Ana lands in Lab 1 and Ben in Lab 2; Raj and Tom join their labs meanwhile.
  await say('Join', 'Students open the link and type a name. The app puts them in a lab.');
  await pane.a.frame.locator('#join-name').pressSequentially('Ana', { delay: 90 });
  await tap('a', '#join-form button[type=submit]', { api: 'join' });
  await sees('a', '#crumbs', 'Lab 1 · Ana');
  await sleep(900);
  await tap('a', '#coach [data-coach="next"]');
  await sleep(1100);
  await tap('a', '#coach [data-coach="next"]');
  await join('Raj');
  await join('Tom');
  await pane.b.frame.locator('#join-name').pressSequentially('Ben', { delay: 90 });
  await tap('b', '#join-form button[type=submit]', { api: 'join' });
  await sees('b', '#crumbs', 'Lab 2 · Ben');
  await sleep(700);
  await tap('b', '#coach [data-coach="skip"]');
  await sees('t', '#people', '6 people · 6 online');
  await sleep(1800);

  // Step 0
  await next('Step 0 · Chaos', 'Each lab edits one shared outfit, live. Nothing is saved.', 'no Git yet');
  await pick('a', 'hat', 'helmet');
  await as('Raj', 'chaos', { part: 'top', value: 'vest' });
  await pick('b', 'shoes', 'sandals');
  await as('Mei', 'chaos', { part: 'hat', value: 'sunhat' });
  await as('Kim', 'chaos', { part: 'glasses', value: 'monocle' });
  await sleep(1500);
  await still();

  await next('Step 0 · Chaos', 'Nobody can say who changed what. Students answer in the app: what rule would fix it?');
  await answer('Kim', 'reveal-0', 0);
  await answer('Raj', 'reveal-0', 1);
  await takeaways(0);
  await sleep(1500);

  // Step 1
  await next('Step 1 · Save', 'Everyone changes one part and presses Save card. Each save is a commit, with a name and a time.', 'git commit');
  await pick('a', 'hat', 'sunhat');
  await press('a', 'commit');
  await save('Raj', { top: 'coat' });
  await pick('b', 'glasses', 'goggles');
  await press('b', 'commit');
  await save('Mei', { hat: 'sunhat' });
  await save('Kim', { hat: 'sunhat' });
  await save('Tom', { glasses: 'goggles' });
  await show('a', '#table');
  await sleep(1200);
  await still();
  await zoom('a');
  await say('Step 1 · Save', 'Click a card: the commit object Git stored. A tree, the parent, and an author and a committer, each with a time.', 'git cat-file -p');
  await openCard('a', gitIn('1', 'rev-parse', 'refs/heads/main~1'));
  await tap('a', '#card-dialog .stored summary');
  await sleep(4500);
  await closeDialog('a', 'card-dialog');
  await zoom();

  await next('Step 1 · Save', 'One technical card per tool. Git stores the name and clock your laptop gives it. It checks neither.', 'git commit');
  await zoom('p');
  await sleep(5500);
  await zoom();
  await takeaways(1);

  // Step 2
  await next('Step 2 · Two ideas', 'Pair A builds fancy and Pair B builds sporty, each on its own sticky note. Both change TOP.', 'git switch -c');
  await tap('a', '#actions [data-act="branch"]', { corner: true });
  await tap('a', '#popover button.primary', { api: 'branch' });
  await pick('a', 'hat', 'tophat');
  await pick('a', 'top', 'tie');
  await press('a', 'commit');
  await as('Raj', 'branch', { name: 'sporty' });
  await save('Raj', { top: 'jersey', shoes: 'boots' });
  await tap('b', '#actions [data-act="branch"]', { corner: true });
  await tap('b', '#popover button.primary', { api: 'branch' });
  await pick('b', 'top', 'jersey');
  await pick('b', 'shoes', 'boots');
  await press('b', 'commit');
  for (const [name, note, parts] of [['Mei', 'fancy', { hat: 'tophat', top: 'tie' }], ['Kim', 'fancy', { hat: 'tophat', top: 'tie' }],
    ['Tom', 'sporty', { top: 'jersey', shoes: 'boots' }]]) {
    await as(name, 'branch', { name: note });
    await save(name, parts);
  }
  await show('a', '#table');
  await show('b', '#table');
  await sleep(2500);
  await still();

  await next('Step 2 · Two ideas', 'A branch is a tiny file that holds one commit ID. Making one copies nothing.', 'git branch');
  await takeaways(2);
  await sleep(2000);

  // Step 3: Ana merges on camera; Mei and Kim merge in their labs.
  await next('Step 3 · Combine', 'One person per lab merges both ideas into main.', 'git merge');
  await choose('b', 'switch', 'main');
  await choose('a', 'switch', 'main');
  await zoom('a');
  await say('Step 3 · Combine', 'Merge fancy into main: main only slides forward. A fast-forward makes no new card.', 'git merge');
  await choose('a', 'merge', 'fancy');
  await show('a', '#table', 'center');
  await sleep(3000);
  await still();
  await top('a');
  await say('Step 3 · Combine', 'Delete the fancy note. Git allows it because main already has its cards.', 'git branch -d fancy');
  await choose('a', 'deleteNote', 'fancy');
  await show('a', '#table', 'center');
  await sleep(3000);
  await still();
  await top('a');
  await say('Step 3 · Combine', 'Merge sporty: HAT and SHOES combine by themselves. TOP changed on both sides, so a person picks.', 'git merge');
  await choose('a', 'merge', 'sporty');
  const resolver = pane.a.frame.locator('#resolver-dialog[open]');
  await resolver.waitFor();
  await sleep(500);
  await clip(3.5);
  await resolver.evaluate((d) => d.scrollTo({ top: d.scrollHeight, behavior: 'smooth' }));
  await sleep(2200);
  await still();
  await tap('a', '#resolver-dialog [data-choose="top"][data-slug="tie"]');
  await sleep(900);
  await tap('a', '#resolver-dialog [data-finish]', { api: 'resolve' });
  await say('Step 3 · Combine', 'Finish merge writes a merge card with two parents.', 'git commit');
  await show('a', '#table', 'center');
  await sleep(3000);
  await still();
  await top('a');
  await zoom();
  for (const name of ['Mei', 'Kim']) {
    await as(name, 'switch', { branch: 'main' });
    await as(name, 'merge', { from: 'fancy' });
    await as(name, 'delete-note', { note: 'fancy' });
    await as(name, 'merge', { from: 'sporty' });
    await as(name, 'resolve', { monster: { hat: 'tophat', glasses: 'goggles', top: 'jersey', shoes: 'boots' } });
  }
  await sees('t', '#ready', 'Labs done: 3/3');
  await sleep(1500);

  await next('Step 3 · Combine', 'Which cards were made on fancy? No way to tell: a commit does not record its branch.', 'git merge');
  await type('a', 'a:reveal-3', ANSWERS['reveal-3'][0]);
  await answer('Tom', 'reveal-3', 3);
  await takeaways(3);
  await sleep(2500);

  // Step 4: Lab 3 sends first. Ana is refused first (Combine), Ben second (Replay on top).
  await next('Step 4 · Share', "Next puts Lab 1's outfit on the Wall, the class's shared copy. Every lab is now a full copy of it.", 'git clone');
  await sleep(3500);
  await still();
  await say('Step 4 · Share', 'Each lab makes one change and saves. Lab 3 sends first: the Wall moves forward.', 'git push');
  await save('Kim', { glasses: 'shades' });
  await pick('b', 'shoes', 'skates');
  await press('b', 'commit');
  await as('Kim', 'push');
  await pick('a', 'hat', 'crown');
  await press('a', 'commit');
  await zoom('a');
  await press('a', 'push', false);
  await say('Step 4 · Share', "Ana's send is refused: the Wall has a card her main lacks. A push may only move the Wall forward.", 'git push');
  await sleep(3500);
  await still();
  await say('Step 4 · Share', "Lab 1's way is Combine: fetch the Wall's cards, write a merge card with two parents, then send.", 'git pull --no-rebase');
  await press('a', 'pull');
  await sleep(1200);
  await press('a', 'push');
  await show('a', '#table', 'center');
  await sleep(2500);
  await still();
  await top('a');
  await zoom('b');
  await press('b', 'push', false);
  await say('Step 4 · Share', "Ben's send is refused too. Lab 2's way is Replay on top.", 'git push');
  await sleep(2500);
  await press('b', 'rebase');
  await say('Step 4 · Share', "Replay on top: Git writes a new card with the same change, on the Wall's newest card. New parent, new ID.", 'git pull --rebase');
  await show('b', '#table', 'center');
  await sleep(3200);
  await still();
  await top('b');
  await openCard('b', tip('2'));
  await say('Step 4 · Share', 'Same author and author time, a new committer time. The original card is only in the safety diary.', 'git rebase');
  await sleep(500);
  await clip(4);
  await sleep(500);
  await still();
  await closeDialog('b', 'card-dialog');
  await press('b', 'push');
  await sleep(1500);
  await zoom();
  await as('Raj', 'pull');
  await as('Kim', 'pull');
  await sees('t', '#ready', 'Labs done: 3/3');
  await sleep(1500);

  await next('Step 4 · Share', "On the Wall: Lab 1's merge card has two parents. Lab 2's copy is a straight line with a new ID.", 'git push · git rebase');
  await zoom('p');
  await sleep(3000);
  await still();
  await clip(3.5);
  await say('Step 4 · Share', "The teacher sees each change's path to main, with this class's real times: made → on the Wall.", 'code velocity');
  await zoom('t');
  await show('t', '#paths', 'center');
  await sleep(3500);
  await still();
  await top('t');
  await say('Step 4 · Share', "Ben's lab: its original card is not on the Wall. The path starts at a copy.", 'git rebase');
  await zoom('b');
  await show('b', '#paths', 'end');
  await sleep(4500);
  await still();
  await top('b');
  await zoom();
  await type('b', 'a:reveal-4', ANSWERS['reveal-4'][0]);
  await answer('Mei', 'reveal-4', 2);
  await takeaways(4);
  await sleep(1000);

  // Step 5: Ben moves back first and is refused; then both undo with a fix card.
  await next('Step 5 · Undo', 'Next: the Intern pushes a 🥸 card to the Wall. Every lab gets it, as a fast-forward.', 'git pull');
  const intern = tip('wall');
  const before = tip('wall', `${intern}~1`);
  await sleep(3000);
  await still();
  await zoom('b');
  await say('Step 5 · Undo', 'Lab 2 tries Move my note back: main points again at the card before 🥸.', 'git reset --hard');
  await show('b', '#table', 'center');
  await openCard('b', before);
  await tap('b', '#card-dialog [data-card-act="reset"]', { api: 'reset' });
  await sleep(1500);
  await top('b');
  await press('b', 'push', false);
  await say('Step 5 · Undo', 'The Wall refuses: it still has the 🥸 card, and a push may only move it forward.', 'git push');
  await sleep(3500);
  await still();
  await press('b', 'reflog');
  await pane.b.frame.locator('#diary-dialog[open]').waitFor();
  await say('Step 5 · Undo', 'The safety diary lists every place main has been.', 'git reflog main');
  await sleep(3500);
  await still();
  await closeDialog('b', 'diary-dialog');
  await press('b', 'pull');
  await say('Step 5 · Undo', 'Get & combine brings the 🥸 card back: the Wall still had it.', 'git pull');
  await sleep(3000);
  await show('b', '#table', 'center');
  await openCard('b', intern);
  await tap('b', '#card-dialog [data-card-act="revert"]', { api: 'revert' });
  await say('Step 5 · Undo', 'Undo this card adds a fix card on top. History only grows, so it sends like any card.', 'git revert');
  await sleep(2500);
  await still();
  await top('b');
  await press('b', 'push');
  await sleep(1500);
  await zoom();
  await say('Step 5 · Undo', 'Ana undoes it too. Her send is refused, so she combines the two fix cards (no conflict) and sends.', 'git revert');
  await show('a', '#table', 'center');
  await openCard('a', intern);
  await tap('a', '#card-dialog [data-card-act="revert"]', { api: 'revert' });
  await top('a');
  await press('a', 'push', false);
  await sleep(1200);
  await press('a', 'pull');
  await press('a', 'push');
  await as('Kim', 'revert', { commit: intern });
  if (!(await post('/api/push', { pid: P.Kim })).ok) {
    await as('Kim', 'pull');
    await as('Kim', 'push');
  }
  await as('Raj', 'pull');
  await as('Mei', 'pull');
  await sees('t', '#ready', 'Labs done: 3/3');
  await sleep(1500);
  await still();

  await next('Step 5 · Undo', 'revert is safe on shared history. reset only if nobody else has those cards.', 'git revert · git reset');
  await takeaways(5);
  await sleep(2500);

  // Step 6: Next asks the Wall; Lab 1, the boss, replaces it; the reveal asks again.
  await next('Step 6 · Clean up', 'Next asks the Wall who first added the 🥾 boots.', 'git log');
  const found = (await adminState()).session.audits.before.rows[0].text.replace(/^Wall: /, '').replace(/, (\w+)$/, ', card $1');
  await zoom('p');
  await amend(`Next asks the Wall who first added the 🥾 boots. It answers: ${found}.`);
  await sleep(4000);
  await still();
  await zoom('a');
  await say('Step 6 · Clean up', 'The boss lab squashes every card after Start into one new card, and forces the Wall onto it.', 'squash + git push --force');
  await tap('a', '#actions [data-act="squash"]', { corner: true });
  await pane.a.frame.locator('#confirm-dialog[open]').waitFor();
  await sleep(1800);
  await still();
  await tap('a', '#confirm-dialog [data-yes]', { api: 'squash-force' });
  await show('a', '#wall-block');
  await sleep(3500);
  await still();
  await top('a');
  await zoom();

  await next('Step 6 · Clean up', 'Asked again, the Wall says: not found. Only the labs that kept the old cards still know.', 'git push --force');
  await zoom('p');
  await clip(3.5);
  await sleep(2000);
  await still();
  await zoom();
  await takeaways(6);

  // Find the path back: the paper's algorithm, tier by tier
  await next('Find the path back', "The paper's algorithm rebuilds each change's path to main from the arrows alone, tier by tier.", 'Just et al., ISSRE 2016 · §6.2');
  await sleep(5000);

  // The paper, the exit question
  await next('The paper', "Code velocity from this class's own times. After the squash, the Wall has none of these cards.", 'Just et al., ISSRE 2016');
  await zoom('p');
  await sleep(7000);
  await still();
  await zoom();
  await answer('Kim', 'paper', 0);
  await answer('Mei', 'paper', 1);

  await next('Exit question', 'On their own: a password reached the Wall and two labs pulled. Does revert remove it?');
  await type('a', 'a:exit', ANSWERS.exit[0]);
  await answer('Raj', 'exit', 1);
  await sleep(3000);
  await still();

  await say('The end', `${SCENES.length} scenes, 7 steps. The teacher pressed only Next, and every click ran real Git.`);
  await sleep(4500);
  await still();
}

// ---------- Outputs ----------

const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function encode(end) {
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`);
  fs.writeFileSync(`${WORK}/frames.txt`, `ffconcat version 1.0\n${list.join('\n')}\nfile '${frames.at(-1).file}'\n`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${WORK}/frames.txt`,
    '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart',
    `${ROOT}demo/DEMO.mp4`]);
}

function gif() {
  const pick = clips.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+');
  fs.mkdirSync(`${ROOT}docs`, { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${ROOT}demo/DEMO.mp4`, '-filter_complex',
    `fps=8,select='${pick}',setpts=N/8/TB,scale=960:-1:flags=lanczos,split[a][b];`
    + '[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    `${ROOT}docs/demo.gif`]);
}

async function storyboard(browser, end) {
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const words = (b) => `<b>${clock(b.t)}</b> <span class="st">${esc(b.step)}</span> ${esc(b.text)}${b.tool ? ` <code>${esc(b.tool)}</code>` : ''}`;
  const frame = (b) => `<figure><img src="data:image/jpeg;base64,${b.img.toString('base64')}"><figcaption>${words(b)}</figcaption></figure>`;
  const pages = [];
  for (let i = 0; i < board.length; i += 2) pages.push(`<section>${board.slice(i, i + 2).map(frame).join('')}</section>`);
  const html = `<!doctype html><meta charset="utf-8"><style>
    @page { size: 297mm 210mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; }
    body { font-family: Inter, sans-serif; color: #111; }
    section { width: 297mm; height: 210mm; padding: 12mm 14mm; display: grid; grid-template-rows: 1fr 1fr; gap: 8mm; break-after: page; overflow: hidden; }
    figure { display: grid; grid-template-columns: 165mm 1fr; gap: 8mm; align-items: center; }
    img { width: 165mm; border: 1px solid #D4D4D8; }
    figcaption { font-size: 13pt; line-height: 1.45; }
    figcaption b, li b { font-variant-numeric: tabular-nums; }
    .st { display: block; margin: 1mm 0; color: #8B3DFF; font-weight: 700; text-transform: uppercase; font-size: 9pt; letter-spacing: .06em; }
    code { font-family: ui-monospace, "Noto Sans Mono", monospace; font-size: .85em; background: #F3ECFF; color: #6A1FD8; padding: 1px 6px; border-radius: 4px; }
    .cover { display: block; padding: 13mm 16mm; }
    h1 { font-size: 26pt; }
    .cover p { font-size: 11pt; line-height: 1.4; margin: 2.5mm 0 6mm; color: #333; max-width: 250mm; }
    ol { columns: 3; column-gap: 7mm; font-size: 7.6pt; line-height: 1.3; padding: 0; list-style: none; }
    li { break-inside: avoid; margin-bottom: 1.1mm; }
    li .st { display: inline; margin: 0 1mm; font-size: 7pt; }
  </style>
  <section class="cover"><h1>Outfit Lab · demo storyboard</h1>
    <p>One real class run, ${clock(end)} long: 3 labs of 2 students on one laptop. The teacher presses only Next through the
    ${SCENES.length} scenes of the 7 steps. Ana (Lab 1) and Ben (Lab 2) click the real student page; every button runs real Git.
    The times and IDs on screen are this run's own. Video: demo/DEMO.mp4.</p>
    <ol>${board.map((b) => `<li>${words(b)}</li>`).join('')}</ol></section>
  ${pages.join('')}`;
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: `${ROOT}demo/DEMO_STORYBOARD.pdf`, width: '297mm', height: '210mm', printBackground: true });
  await page.close();
}

// ---------- Run ----------

let browser;
try {
  for (let i = 0; !(await fetch(API).then((r) => r.ok, () => false)); i++) {
    if (i > 100) throw new Error(`The app did not start:\n${serverErr}`);
    await sleep(100);
  }
  await join('Mei'); // Lab 2 and Lab 3 already have one person each, so Ana lands in Lab 1 and Ben in Lab 2
  await join('Kim');

  browser = await chromium.launch({ args: ['--host-resolver-rules=MAP *.demo 127.0.0.1'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript((tips) => {
    if (location.hostname.endsWith('.demo')) localStorage.setItem('outfitLab.tips', JSON.stringify(tips));
  }, TIPS);
  stage = await context.newPage();
  fs.writeFileSync(`${WORK}/stage.html`, STAGE); // a file page may frame the local app; a web page may not
  await stage.goto(`file://${WORK}/stage.html`);
  for (const id of ['t', 'p', 'a', 'b']) {
    const el = await stage.$(`#${id} iframe`);
    pane[id] = { el, frame: await el.contentFrame() };
  }
  await pane.t.frame.locator('#next').waitFor();
  await pane.p.frame.locator('#slide .sl.kind-join').waitFor();
  await Promise.all(['a', 'b'].map((id) => pane[id].frame.locator('#join-name').waitFor()));
  await sleep(1000);

  await startRecording();
  await lesson();
  await still();
  await cdp.send('Page.stopScreencast');
  const end = now();
  if (serverErr.trim()) throw new Error(`The app wrote errors:\n${serverErr}`);

  encode(end);
  gif();
  await storyboard(browser, end);
  fs.writeFileSync(`${WORK}/captions.json`, JSON.stringify(board.map(({ t, step, text, tool }) => ({ t: clock(t), step, text, tool })), null, 1));
  console.log(`${clock(end)} · ${board.length} captions · ${frames.length} frames`);
} finally {
  await browser?.close();
  for (const s of streams) s.destroy();
  server.kill('SIGTERM');
}
