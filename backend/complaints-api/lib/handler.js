/**
 * handler — runtime-agnostic entry point for the complaint endpoint.
 *
 * Both surfaces (the Vercel function in `api/complaint.js` and the
 * Express route in `server.js`) call this so business logic, status
 * codes, and the response envelope stay identical between deploy
 * targets. The runtime adapter handles Node.js req/res specifics.
 *
 * Inputs:
 *   - `body`  : already-parsed JSON (object).
 *   - `env`   : a snapshot of the env vars the handler needs. Passing
 *               this in (instead of reading `process.env` here) keeps
 *               the function trivially testable.
 *
 * Output (always 200 once validation passes):
 *   {
 *     success: true,
 *     telegramSent: boolean,    // true iff ≥1 admin received the message
 *     whatsappText: string,     // ready for `wa.me/<n>?text=...`
 *   }
 *
 * Validation failures throw `ValidationError`, which the adapter maps
 * to a 400. Telegram failures DO NOT fail the request — the frontend
 * can still surface the WhatsApp fallback.
 */
import { validateComplaint, ValidationError } from './validate.js';
import { formatTelegramMessage, formatWhatsAppText } from './format.js';
import { parseAdminChatIds, sendToAllAdmins } from './telegram.js';

export { ValidationError };

export async function handleComplaint({ body, env = process.env }) {
  // Throws ValidationError on bad input; adapter catches and returns 400.
  const payload = validateComplaint(body);

  const telegramText = formatTelegramMessage(payload);
  const whatsappText = formatWhatsAppText(payload);

  const chatIds = parseAdminChatIds(env.ADMIN_CHAT_IDS);
  const result = await sendToAllAdmins({
    token: env.TELEGRAM_BOT_TOKEN,
    chatIds,
    text: telegramText,
  });

  if (result.failures.length > 0) {
    // Log per-chat failures so the operator can see WHICH admin chat
    // is misconfigured without re-running with debug. We keep this at
    // warn-level because the request itself succeeded from the user's
    // point of view (they get the WhatsApp fallback).
    console.warn(
      `[complaints-api] telegram fan-out: ${result.succeeded}/${result.attempted} delivered`,
      result.failures,
    );
  }

  return {
    success: true,
    telegramSent: result.succeeded > 0,
    whatsappText,
  };
}
