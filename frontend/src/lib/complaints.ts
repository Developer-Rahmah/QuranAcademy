/**
 * complaints — thin client for the backend complaints API.
 *
 * The endpoint lives in `backend/complaints-api/` and is invoked at
 *   POST `${VITE_COMPLAINTS_API_URL}/api/complaint`.
 *
 * The frontend's only job is to forward `{ name, type, message }`. The
 * backend owns the Telegram bot token + admin chat ids, so nothing
 * sensitive is ever bundled into the SPA. If `VITE_COMPLAINTS_API_URL`
 * is empty (e.g. local dev without the side service) the helper short
 * -circuits with a `not_configured` outcome so callers can render the
 * right toast instead of opening a network error to the user.
 *
 * Output is a discriminated union so the call site doesn't have to
 * defensively branch on truthy/falsy state.
 */
import { env } from './env';

export const COMPLAINT_TYPES = ['complaint', 'suggestion', 'bug'] as const;
export type ComplaintType = (typeof COMPLAINT_TYPES)[number];
export const COMPLAINT_MESSAGE_MAX = 500;

export interface ComplaintPayload {
  name: string;
  type: ComplaintType;
  message: string;
}

/**
 * Discrete failure reasons surfaced to the modal. The frontend uses
 * each one to pick a different localized toast:
 *
 *   - `not_configured` : the SPA env doesn't know the API base URL.
 *   - `validation`     : backend 4xx (bad payload / rejected fields).
 *   - `network`        : transport error (timeout, 5xx, CORS, DNS).
 *   - `delivery`       : backend accepted the request but no admin
 *                        actually received the Telegram message
 *                        (bot token missing, all chat ids wrong, etc).
 *                        This is a REAL failure — the previous code
 *                        treated it as success and toasted "sent",
 *                        which masked broken backend env.
 */
export type ComplaintResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_configured' | 'validation' | 'network' | 'delivery';
      message?: string;
    };

interface ApiSuccess {
  success: true;
  telegramSent: boolean;
  whatsappText: string;
}

interface ApiError {
  success: false;
  error: string;
  field?: string;
}

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Submit one complaint payload. Never throws — the caller renders one
 * of the four documented outcomes via `result.ok` + `result.reason`.
 */
export async function submitComplaint(
  payload: ComplaintPayload,
): Promise<ComplaintResult> {
  const base = env.COMPLAINTS_API_URL;
  if (!base) {
    return { ok: false, reason: 'not_configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/api/complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => null)) as
      | ApiSuccess
      | ApiError
      | null;

    if (!res.ok) {
      // 4xx: backend rejected the input. 5xx: backend is down.
      const reason: 'validation' | 'network' =
        res.status >= 500 ? 'network' : 'validation';
      return {
        ok: false,
        reason,
        message: json && 'error' in json ? json.error : undefined,
      };
    }

    if (!json || json.success !== true) {
      return { ok: false, reason: 'network' };
    }
    // 200 with `telegramSent: false` means the backend received our
    // request but couldn't actually deliver to a single admin chat
    // (token missing, all chat ids invalid, Telegram API rejected
    // every request, etc). For the user, that's a failure — their
    // message is nowhere — so surface it as such instead of toasting
    // "sent successfully".
    if (!json.telegramSent) {
      return { ok: false, reason: 'delivery' };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: (err as Error)?.name === 'AbortError' ? 'timeout' : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}
