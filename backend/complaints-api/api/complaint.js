/**
 * Vercel serverless adapter for POST /api/complaint.
 *
 * Vercel auto-routes this file to `/api/complaint`. We:
 *   1. Apply CORS so the React frontend on a different origin can POST.
 *   2. Reject anything that isn't a POST.
 *   3. Hand the parsed body to the runtime-agnostic handler.
 *   4. Map ValidationError → 400, any other throw → 500.
 *
 * Deliberately no logger / metrics dep — `console.warn` lands in
 * Vercel's Function Logs panel, which is enough for low-volume
 * complaint traffic.
 */
import { handleComplaint, ValidationError } from '../lib/handler.js';

function applyCors(req, res) {
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
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method not allowed' });
    return;
  }

  // Vercel parses JSON bodies for us when Content-Type: application/json.
  // For other content types `req.body` will be undefined — validate
  // catches that.
  try {
    const result = await handleComplaint({ body: req.body });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: err.message,
        field: err.field,
      });
      return;
    }
    console.error('[complaints-api] unexpected handler error', err);
    res.status(500).json({ success: false, error: 'internal error' });
  }
}
