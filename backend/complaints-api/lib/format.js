/**
 * format — turns a validated complaint payload into:
 *
 *   1. The plain-text Telegram message body that the bot sends to each
 *      admin chat. Plain text avoids HTML/Markdown escaping pitfalls
 *      with arbitrary user input (a curly brace, a `*`, an `<` etc.)
 *      and keeps the bot's API call simple.
 *
 *   2. A `whatsappText` string the frontend can hand to a `wa.me`
 *      deeplink as the WhatsApp fallback. URL-encoding is the caller's
 *      job (`encodeURIComponent`) — we just produce the raw text.
 *
 * Both outputs are rendered in Arabic — the academy is Arabic-first
 * and the recipient is the Arabic-speaking admin team. The message
 * type is also localised so the labels read naturally to the admin.
 */

// Arabic labels for the three accepted `type` values. The frontend
// already exposes the same labels under `feedback.type*` keys; we
// duplicate them here (rather than importing) because this is a
// standalone Node service with no link to the Vite locales.
const TYPE_LABELS_AR = {
  complaint: 'شكوى',
  suggestion: 'اقتراح',
  bug: 'خطأ تقني',
};

function labelFor(type) {
  return TYPE_LABELS_AR[type] ?? type;
}

/**
 * Build the message that goes to Telegram admins (Arabic).
 *
 * Format (plain text — no parse_mode):
 *
 *   📩 رسالة جديدة - أكاديمية وهديناك
 *
 *   👤 الاسم: <name>
 *   📝 النوع: <type>
 *   💬 الرسالة: <message>
 */
export function formatTelegramMessage({ name, message, type }) {
  return [
    '📩 رسالة جديدة - أكاديمية وهديناك',
    '',
    `👤 الاسم: ${name}`,
    `📝 النوع: ${labelFor(type)}`,
    `💬 الرسالة: ${message}`,
  ].join('\n');
}

/**
 * Build the WhatsApp fallback text (Arabic). The frontend will append
 * this to a `https://wa.me/<digits>?text=<encoded>` URL or copy it to
 * clipboard.
 */
export function formatWhatsAppText({ name, message, type }) {
  return [
    'رسالة جديدة - أكاديمية وهديناك',
    `الاسم: ${name}`,
    `النوع: ${labelFor(type)}`,
    `الرسالة: ${message}`,
  ].join('\n');
}
