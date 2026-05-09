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
 * Keeping both formatters here means the on-screen presentation stays
 * identical between channels.
 */

const TYPE_LABELS = {
  complaint: 'Complaint',
  suggestion: 'Suggestion',
  bug: 'Bug',
};

function labelFor(type) {
  return TYPE_LABELS[type] ?? type;
}

/**
 * Build the message that goes to Telegram admins.
 *
 * Format (matches the spec, plain text — no parse_mode):
 *
 *   📩 New Message - Wahdaynak Academy
 *
 *   👤 Name: <name>
 *   📝 Type: <type>
 *   💬 Message: <message>
 */
export function formatTelegramMessage({ name, message, type }) {
  return [
    '📩 New Message - Wahdaynak Academy',
    '',
    `👤 Name: ${name}`,
    `📝 Type: ${labelFor(type)}`,
    `💬 Message: ${message}`,
  ].join('\n');
}

/**
 * Build the WhatsApp fallback text. The frontend will append this to a
 * `https://wa.me/<digits>?text=<encoded>` URL or copy it to clipboard.
 */
export function formatWhatsAppText({ name, message, type }) {
  return [
    'New Message - Wahdaynak Academy',
    `Name: ${name}`,
    `Type: ${labelFor(type)}`,
    `Message: ${message}`,
  ].join('\n');
}
