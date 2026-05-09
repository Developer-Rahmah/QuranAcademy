# Wahdaynak Complaints API

Lightweight Node service that accepts complaints / suggestions / bug
reports from the Wahdaynak Academy frontend and forwards them to one
or more Telegram admin chats. No database, no Supabase, no third-party
dependencies beyond Express + the Telegram Bot HTTP API.

The same handler ships in two shapes:

- **Vercel serverless function** at `api/complaint.js` (recommended)
- **Plain Express server** at `server.js` (Render, Fly, Railway, VPS)

Both call the same logic in `lib/handler.js`, so behaviour is
identical regardless of where you deploy.

## API

### `POST /api/complaint`

**Request body**

```json
{
  "name": "Sara",
  "type": "complaint",
  "message": "The login button doesn't work on Safari iOS."
}
```

**Validation**

| Field | Rule |
| --- | --- |
| `name` | required, non-empty string |
| `message` | required, non-empty string, ≤ 500 chars |
| `type` | one of `complaint`, `suggestion`, `bug` |

**Success (200)**

```json
{
  "success": true,
  "telegramSent": true,
  "whatsappText": "New Message - Wahdaynak Academy\nName: Sara\nType: Complaint\nMessage: The login button doesn't work on Safari iOS."
}
```

`telegramSent` is `true` if **at least one** admin chat received the
message. Per-admin failures are logged but don't fail the request,
because the frontend can still hand the user the WhatsApp fallback.

**Errors**

- `400` — invalid body. Response includes `error` and the offending
  `field`.
- `405` — non-`POST` method.
- `500` — unexpected server error.

## Environment

Copy `.env.example` to `.env` and fill the values:

```
TELEGRAM_BOT_TOKEN=     # from @BotFather
ADMIN_CHAT_IDS=         # comma-separated, e.g. 123,456,-1001234567890
ALLOWED_ORIGINS=        # optional, comma-separated; defaults to *
PORT=3000               # local Express only; Vercel ignores this
WHATSAPP_NUMBER=        # optional, used by the frontend's wa.me link
```

### Getting the chat ids

1. Send any message to your bot from each admin's Telegram account.
2. Visit
   `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates` — each
   message in the response carries a `chat.id`.
3. For a group: add the bot to the group, post any message, then read
   the same `getUpdates`. Group ids are negative (e.g. `-100123…`).
4. Concatenate the ids with commas in `ADMIN_CHAT_IDS`.

Once `ADMIN_CHAT_IDS` is set, you can clear `getUpdates` traffic.

## Local development

```bash
cd backend/complaints-api
npm install
cp .env.example .env
# edit .env with real values
npm run dev          # auto-reload via node --watch
```

Then test with the curl below.

## Deploy: Vercel (recommended)

1. From `backend/complaints-api`:

   ```bash
   npx vercel link        # one-time, points the dir at a new project
   ```

2. Set env vars in the dashboard (**Settings → Environment Variables**)
   for **Production** and **Preview**:

   - `TELEGRAM_BOT_TOKEN`
   - `ADMIN_CHAT_IDS`
   - `ALLOWED_ORIGINS` (set to your prod origin, e.g.
     `https://www.wahdaynakacademy.com`)

3. Deploy:

   ```bash
   npx vercel --prod
   ```

4. The function is reachable at:

   ```
   https://<project>.vercel.app/api/complaint
   ```

Vercel auto-detects `api/complaint.js` and routes `/api/complaint`
to it — no extra config needed beyond `vercel.json`.

## Deploy: Render (or any Node host)

1. Push this directory as part of the repo.
2. Create a new **Web Service**.
   - Build command: `npm install`
   - Start command: `npm start`
   - Runtime: Node 18 or newer.
3. Set the same env vars under the service's **Environment** tab.
4. Render will give you a public URL like
   `https://complaints-api.onrender.com`. The endpoint is at
   `/api/complaint`.

The same flow works on Fly.io, Railway, a bare VPS with PM2, etc. —
nothing in the code is Vercel-specific.

## Test

```bash
curl -X POST https://<your-deploy>/api/complaint \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Sara",
    "type": "complaint",
    "message": "The login button does not work on Safari iOS."
  }'
```

Locally:

```bash
curl -X POST http://localhost:3000/api/complaint \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Sara",
    "type": "complaint",
    "message": "The login button does not work on Safari iOS."
  }'
```

Validation error example (missing `type`):

```bash
curl -X POST http://localhost:3000/api/complaint \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Sara", "message": "hi" }'
# → 400 { "success": false, "error": "type must be one of: complaint, suggestion, bug", "field": "type" }
```

## Frontend wiring

The React app should POST to a value held in
`VITE_COMPLAINTS_API_URL` (set in the Vercel project for the frontend),
**not** the bot token. The token never leaves this service.

```ts
// example, frontend
await fetch(`${import.meta.env.VITE_COMPLAINTS_API_URL}/api/complaint`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, type, message }),
});
```

## Security notes

- `TELEGRAM_BOT_TOKEN` is read from env only and never returned in any
  response. Keep it out of the frontend bundle (no `VITE_` prefix).
- If a token leaks (e.g. pasted in chat or committed): `@BotFather` →
  `/revoke`, pick the bot, copy the new token into the deploy's env.
- CORS defaults to `*` for ease of bring-up — set `ALLOWED_ORIGINS` to
  your production domain in production.
- The handler caps `message` at 500 chars and the body parser at 16 kb
  so a misbehaving client cannot stream large payloads.
