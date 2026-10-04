// HTTP: static files, the JSON API, and server-sent events. One process holds everything.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import QRCode from 'qrcode';
import * as session from './session.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const HEARTBEAT_MS = 15_000;

const app = express();
app.set('trust proxy', true); // the join URL keeps https behind a proxy
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

// Client fields are plain values; only Finish merge sends an object (the monster).
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
  'push', 'pull', 'revert', 'reset']) {
  app.post(`/api/${action}`, handle((b) => session.act(action, b)));
}
app.post('/api/squash-force', handle((b) => session.act('squash', b)));
app.get('/api/reflog', handle((q) => session.act('reflog', q)));
app.get('/api/inspect', handle((q) => session.act('inspect', q)));

// ---------- Admin API (header x-admin-key or ?key=) ----------

app.get('/api/admin/state', adminOnly, handle((q, req) => session.adminState(joinUrl(req))));
for (const action of ['step', 'labs', 'move', 'rescue', 'ask', 'break', 'timer', 'sabotage', 'audit', 'gc', 'reset']) {
  app.post(`/api/admin/${action}`, adminOnly, handle((b) => session.admin(action, b)));
}

app.get('/api/qr.svg', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 512);
  if (!text) return res.status(400).end();
  res.type('image/svg+xml').set('Cache-Control', 'max-age=3600');
  res.send(await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }));
});

// ---------- Pages ----------

const page = (file) => (req, res) =>
  isAdmin(req) ? res.sendFile(path.join(PUBLIC, file)) : res.status(403).type('text').send('Wrong or missing key.');
app.get('/admin', page('admin.html'));
app.get('/screen', page('screen.html'));
app.use(express.static(PUBLIC));
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'No such thing.' }));
// Malformed JSON bodies and the like.
app.use((err, req, res, next) => res.status(err.status || 400).json({ ok: false, error: 'Bad request.' }));

// ---------- Start and stop ----------

await session.boot();
const server = app.listen(PORT, process.env.HOST, () => {
  console.log(`Monster Lab on http://localhost:${PORT}/`);
  console.log(`Teacher page: http://localhost:${PORT}/admin?key=${session.adminKey()}`);
});

function stop() {
  session.flush();
  for (const c of clients) c.res.end();
  server.close(() => process.exit(0));
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
