// HTTP: static files, the JSON API, and server-sent events. One process holds everything.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import QRCode from 'qrcode';
import * as session from './session.js';
import * as bots from './bots.js';
import * as thu from './thursday.js';
import * as thuBots from './thursday_bots.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const HEARTBEAT_MS = 15_000;

const app = express();
app.set('trust proxy', true); // the join URL keeps https behind a proxy
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

// Client fields are plain values; only Finish merge sends an object (the outfit, as `monster`).
// Dropping the rest means String() and Number() on client input never throw.
const fields = (input) => Object.fromEntries(Object.entries(input)
  .map(([k, val]) => [k, val !== null && typeof val === 'object' && k !== 'monster' ? undefined : val]));

// Every handler answers JSON. Unexpected errors are logged, never shown to students.
const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(fields({ ...req.query, ...req.body }), req));
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Something went wrong. Press again.' });
  }
};

const isAdmin = (req) => {
  const given = Buffer.from(String(req.get('x-admin-key') || req.query.key || ''));
  const want = Buffer.from(session.adminKey());
  return given.length === want.length && crypto.timingSafeEqual(given, want);
};

const adminOnly = (req, res, next) =>
  isAdmin(req) ? next() : res.status(401).json({ ok: false, error: 'Wrong or missing key.' });

const joinUrl = (req) => `${req.protocol}://${req.get('host')}/`;

// ---------- Server-sent events: {v, boot}; clients refetch /api/state when it changes ----------

const clients = new Set(); // {res, pid} for students, {res, admin: true} for admin and projector

function openStream(req, res, client) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  res.write(`:${' '.repeat(2048)}\n\n`); // padding: pushes the stream through buffering proxies
  client.res = res;
  clients.add(client);
  send(client);
  const hb = setInterval(() => res.write(': hb\n\n'), HEARTBEAT_MS);
  if (client.pid) session.connect(client.pid); // open streams = presence
  req.on('close', () => {
    clearInterval(hb);
    clients.delete(client);
    if (client.pid) session.disconnect(client.pid);
  });
}

function send(client) {
  client.res.write(`data: ${JSON.stringify(session.version())}\n\n`);
}

// Lab events go to that lab and the admin/projector; session and Wall events go to everyone.
session.onChange((labId) => {
  for (const c of clients) {
    if (!labId || c.admin || session.labOf(c.pid) === labId) send(c);
  }
});

app.get('/api/events', (req, res) => openStream(req, res, { pid: String(req.query.pid || '') }));
app.get('/api/admin/events', adminOnly, (req, res) => openStream(req, res, { admin: true }));

// ---------- Student API ----------

app.post('/api/join', handle((b) => session.join(b)));
app.get('/api/state', handle((q) => session.state(q.pid)));

for (const action of ['pair', 'chaos', 'draft', 'commit', 'branch', 'switch', 'merge', 'resolve', 'abort',
  'push', 'pull', 'rebase', 'revert', 'reset', 'answer', 'takeaway', 'predict', 'why']) {
  app.post(`/api/${action}`, handle((b) => session.act(action, b)));
}
app.post('/api/delete-note', handle((b) => session.act('deleteNote', b)));
app.post('/api/squash-force', handle((b) => session.act('squash', b)));
app.get('/api/reflog', handle((q) => session.act('reflog', q)));
app.get('/api/inspect', handle((q) => session.act('inspect', q)));

// ---------- Admin API (header x-admin-key or ?key=) ----------

app.get('/api/admin/state', adminOnly, handle(async (q, req) => ({ ...await session.adminState(joinUrl(req)), rehearsal: bots.status() })));
for (const action of ['next', 'back', 'labs', 'move', 'rescue', 'ask', 'answers', 'timer', 'sabotage', 'audit', 'gc', 'reset']) {
  app.post(`/api/admin/${action}`, adminOnly, handle((b) => session.admin(action, b)));
}
// Rehearse with bots: {on, count, speed}.
app.post('/api/admin/rehearse', adminOnly, handle((b) => bots.rehearse(b)));
// Every answer and takeaway, per question and per person, as a Markdown file.
app.get('/api/admin/export', adminOnly, async (req, res) => {
  res.attachment('outfit-lab-answers.md').type('text/markdown; charset=utf-8').send(await session.exportMarkdown());
});

app.get('/api/qr.svg', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 512);
  if (!text) return res.status(400).end();
  res.type('image/svg+xml').set('Cache-Control', 'max-age=3600');
  res.send(await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }));
});

// ---------- Thursday (/thu): polled, no stream; same teacher key ----------

app.post('/api/thu/join', handle((b) => thu.join(b)));
app.get('/api/thu/state', handle((q) => thu.state(String(q.pid || ''))));
app.post('/api/thu/answer', handle((b) => thu.answer(b)));
app.get('/api/thu/admin/state', adminOnly, handle((q, req) => ({ ...thu.adminState(`${req.protocol}://${req.get('host')}/thu`), rehearsal: thuBots.status() })));
app.post('/api/thu/admin/rehearse', adminOnly, handle((b) => thuBots.rehearse(b)));
for (const action of ['next', 'back', 'reset', 'regroup']) {
  app.post(`/api/thu/admin/${action}`, adminOnly, handle((b) => thu.admin(action, b)));
}
app.get('/api/thu/admin/export', adminOnly, (req, res) => {
  res.attachment('thursday-answers.md').type('text/markdown; charset=utf-8').send(thu.exportMarkdown());
});

// ---------- Pages ----------

// Tuesday's console and projector pages hold no secret (every /api/admin call checks the key). They take the
// key from ?key= once, keep it in sessionStorage and drop it from the address bar, so a reload has no key.
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));
app.get('/screen', (req, res) => res.sendFile(path.join(PUBLIC, 'screen.html')));
app.get('/thu', (req, res) => res.sendFile(path.join(PUBLIC, 'thu.html')));
app.get('/thu/admin', (req, res) => res.sendFile(path.join(PUBLIC, 'thu-admin.html'))); // same: the API checks the key
app.get('/thu/screen', (req, res) => res.sendFile(path.join(PUBLIC, 'thu-screen.html')));
app.use(express.static(PUBLIC));
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'No such thing.' }));
// Malformed JSON bodies and the like.
app.use((err, req, res, next) => res.status(err.status || 400).json({ ok: false, error: 'Bad request.' }));

// ---------- Start and stop ----------

await session.boot();
thu.boot();
const server = app.listen(PORT, process.env.HOST, () => {
  console.log(`Outfit Lab on http://localhost:${PORT}/`);
  console.log(`Teacher page: http://localhost:${PORT}/admin?key=${session.adminKey()}`);
  console.log(`Thursday: students http://localhost:${PORT}/thu · teacher http://localhost:${PORT}/thu/admin?key=${session.adminKey()}`);
});

function stop() {
  session.flush();
  thu.flush();
  for (const c of clients) c.res.end();
  server.close(() => process.exit(0));
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
