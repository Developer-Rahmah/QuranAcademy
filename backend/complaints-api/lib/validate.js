/**
 * validate — normalises and validates the inbound complaint payload.
 *
 * Accepts the raw `req.body` (already JSON-parsed) and returns either
 * a validated payload or an Error with a human-readable `message`
 * suitable for surfacing to the API caller. The handler layer turns
 * thrown errors into 400s.
 *
 * Rules (matching the product spec):
 *   - name      : non-empty trimmed string
 *   - message   : non-empty trimmed string, ≤ 500 chars
 *   - type      : one of 'complaint' | 'suggestion' | 'bug'
 */

export const ALLOWED_TYPES = Object.freeze(['complaint', 'suggestion', 'bug']);
export const MAX_MESSAGE_LENGTH = 500;

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

function asString(value) {
  return typeof value === 'string' ? value : '';
}

export function validateComplaint(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object', 'body');
  }

  const name = asString(body.name).trim();
  const message = asString(body.message).trim();
  const type = asString(body.type).trim().toLowerCase();

  if (!name) {
    throw new ValidationError('name is required', 'name');
  }
  if (!message) {
    throw new ValidationError('message is required', 'message');
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError(
      `message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
      'message',
    );
  }
  if (!ALLOWED_TYPES.includes(type)) {
    throw new ValidationError(
      `type must be one of: ${ALLOWED_TYPES.join(', ')}`,
      'type',
    );
  }

  return { name, message, type };
}
