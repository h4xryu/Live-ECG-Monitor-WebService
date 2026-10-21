# Backend API (added for Android ↔ web service integration)

This adds a minimal account + ECG-upload backend to the Next.js app under
`app/api/`. It's file-storage based (`data/users.json`, `data/ecg-records/*.json`) —
no external database required, but it only works as a single process (one `next start`
instance, not a serverless/multi-instance deployment). Swap `lib/db.ts` for a real
database before scaling past that.

Set `JWT_SECRET` in `.env.local` (copy `.env.local.example`) before running anywhere
other than your own machine.

## Auth

### POST /api/auth/signup
Request:
```json
{ "username": "jdoe", "password": "at-least-8-chars" }
```
- `username`: 3–32 chars, `[a-zA-Z0-9_.-]` only.
- `password`: 8–128 chars.

Response `201`:
```json
{ "token": "<jwt>", "user": { "id": "...", "username": "jdoe" } }
```
Response `409` if the username is taken: `{ "error": "..." }`.

### POST /api/auth/login
Request: `{ "username": "...", "password": "..." }`
Response `200`: same shape as signup. `401` on bad credentials.

### GET /api/auth/me
Header: `Authorization: Bearer <jwt>`
Response `200`: `{ "user": { "id": "...", "username": "..." } }`.
`401` if the token is missing/expired/invalid — the client should treat this as
"logged out" and send the user back to login.

## ECG data

### POST /api/ecg/upload
Header: `Authorization: Bearer <jwt>`
Request:
```json
{
  "deviceId": "AA:BB:CC:DD:EE:FF",
  "recordedAt": 1732000000000,
  "fs": 250,
  "bpm": 72,
  "summary": "Normal sinus rhythm",
  "signal": [0.01, 0.02, ...]
}
```
- `recordedAt`: epoch millis the recording started.
- `fs`: sample rate in Hz.
- `signal`: the (filtered or raw) ECG samples, up to 2,000,000 values (~2.2h at 250Hz).
  For longer recordings, split into multiple uploads rather than widening this limit.

Response `201`: `{ "record": { "id": "...", "uploadedAt": ..., "sampleCount": ... , ... } }`
(no `signal` field — metadata only, to keep the response small).

### GET /api/ecg/records
Header: `Authorization: Bearer <jwt>`
Response `200`: `{ "records": [ { "id": "...", "deviceId": ..., "recordedAt": ..., "fs": ...,
"bpm": ..., "summary": ..., "sampleCount": ..., "uploadedAt": ... }, ... ] }`
(metadata only, newest first; raw signal is not included).

## Notes for the Android client

- Store the JWT from signup/login (e.g. `SharedPreferences`) and send it as
  `Authorization: Bearer <token>` on every `/api/ecg/*` call.
- On `401` from any authenticated endpoint, clear the stored token and prompt re-login —
  tokens expire after 30 days (`TOKEN_TTL` in `lib/auth.ts`).
- The base URL during local development is typically `http://10.0.2.2:<port>/api/` from
  an emulator (host loopback) or `http://<your-LAN-ip>:<port>/api/` from a physical phone
  on the same network — not `http://localhost:<port>/api/`, which on-device resolves to
  the phone itself.
