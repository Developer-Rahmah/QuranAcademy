/**
 * telegram — minimal Telegram Bot API client.
 *
 * One responsibility: POST a `sendMessage` for a given chat id. The
 * higher-level fan-out (loop over ADMIN_CHAT_IDS) lives in
 * `sendToAllAdmins` so per-recipient failures don't poison the others.
 *
 * Uses the global `fetch` (Node ≥ 18.17) so we don't pull a network
 * dependency. Failures are returned as `{ ok: false, error }` rather
 * than thrown — callers want to keep going when one admin's chat id
 * is wrong / blocked.
 */

const TELEGRAM_API = 'https://api.telegram.org';
// Slightly aggressive timeout — Telegram is usually <500ms; if it's
// slower than 8s the user is better served by the WhatsApp fallback.
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Parse the comma-separated `ADMIN_CHAT_IDS` env var into a clean list.
 * Returns numeric ids when possible (Telegram chat ids are integers,
 * group ids are negative). Strings that don't parse are dropped — the
 * caller logs `parsedCount` and the operator can fix the env value.
 */
export function parseAdminChatIds(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      // Telegram chat ids are signed integers. Reject anything that
      // doesn't look like one so a typo can't silently target a wrong
      // chat.
      if (!/^-?\d+$/.test(s)) return null;
      return Number(s);
    })
    .filter((n) => n !== null && Number.isFinite(n));
}

/**
 * Send one message to one chat id. Resolves with `{ ok, chatId, error? }`.
 * Never throws — caller decides what to do with failures.
 */
export async function sendMessage({ token, chatId, text }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        // No parse_mode — payload is plain text with emojis only,
        // which avoids escaping arbitrary user input.
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        chatId,
        error: `HTTP ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`,
      };
    }

    const json = await res.json().catch(() => null);
    if (json && json.ok === false) {
      return {
        ok: false,
        chatId,
        error: json.description || 'telegram returned ok=false',
      };
    }
    return { ok: true, chatId };
  } catch (err) {
    return {
      ok: false,
      chatId,
      error: err?.name === 'AbortError' ? 'timeout' : (err?.message ?? 'unknown error'),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fan-out: send the same text to every admin chat id in parallel.
 * Per-chat failures are logged but never reject the overall promise.
 *
 * Returns:
 *   {
 *     attempted: number,        // chat ids we tried
 *     succeeded: number,        // ok responses from Telegram
 *     failures: Array<{ chatId, error }>
 *   }
 */
export async function sendToAllAdmins({ token, chatIds, text }) {
  if (!token) {
    return {
      attempted: 0,
      succeeded: 0,
      failures: [{ chatId: null, error: 'TELEGRAM_BOT_TOKEN not configured' }],
    };
  }
  if (!chatIds || chatIds.length === 0) {
    return {
      attempted: 0,
      succeeded: 0,
      failures: [{ chatId: null, error: 'ADMIN_CHAT_IDS not configured' }],
    };
  }

  const results = await Promise.all(
    chatIds.map((chatId) => sendMessage({ token, chatId, text })),
  );

  const succeeded = results.filter((r) => r.ok).length;
  const failures = results
    .filter((r) => !r.ok)
    .map(({ chatId, error }) => ({ chatId, error }));

  return { attempted: chatIds.length, succeeded, failures };
}
