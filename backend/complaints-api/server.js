/**
 * Local Express server — mirrors the Vercel function exactly so we
 * can develop and self-host with the same code path. Render, Fly,
 * Railway, a plain VPS, etc. all run this file unchanged.
 *
 *   npm install
 *   cp .env.example .env  # then fill the values
 *   npm run dev           # auto-reload via --watch
 *   # or
 *   npm start
 */
import express from 'express';
import { handleComplaint, ValidationError } from './lib/handler.js';

const app = express();

// JSON parser with an explicit small limit. Complaints carry a 500-char
// message + small metadata; capping at 16kb stops a misbehaving client
// from streaming megabytes at us.
app.use(express.json({ limit: '16kb' }));

// CORS for the React frontend. Mirrors the Vercel adapter so behaviour
// is identical between deploy targets.
app.use((req, res, next) => {
  const allowed = (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin;

  if (allowed.includes('*') || (origin && allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
});

// Health check — handy for uptime monitors and deploy smoke tests.
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Symmetry with the Vercel adapter — non-POST hits the JSON 405
// branch instead of Express's HTML "Cannot GET …" default.
app.all('/api/complaint', (req, res, next) => {
  if (req.method === 'POST') return next();
  res.status(405).json({ success: false, error: 'method not allowed' });
});

app.post('/api/complaint', async (req, res) => {
  try {
    const result = await handleComplaint({ body: req.body });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      res
        .status(400)
        .json({ success: false, error: err.message, field: err.field });
      return;
    }
    console.error('[complaints-api] unexpected handler error', err);
    res.status(500).json({ success: false, error: 'internal error' });
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`[complaints-api] listening on http://localhost:${PORT}`);
});
