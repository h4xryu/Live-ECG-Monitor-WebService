# Backend API (added for Android ↔ web service integration)

This adds a minimal account + ECG-upload backend to the Next.js app under
`app/api/`. Users and uploaded recordings are file-storage based (`data/users.json`,
`data/ecg-records/*.json`) — no external database required, but it only works as a single
process (one `next start` instance, not a serverless/multi-instance deployment). Swap
`lib/db.ts` for a real database before scaling past that. Live state (below) is in-memory
only, on purpose — see that section.

**Design principle**: the server is an optional add-on, never a dependency of the on-device
monitor. Real-time state (`/api/ecg/live`) is throwaway — if it's lost, the client just sends
a fresh one. Uploaded recordings (`/api/ecg/upload`) are not — the client is expected to queue
and retry them until they land, which is why that endpoint is idempotent (`clientRecordId`,
below).

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
  "clientRecordId": "a1b2c3d4-...",
  "deviceId": "AA:BB:CC:DD:EE:FF",
  "recordedAt": 1732000000000,
  "fs": 250,
  "bpm": 72,
  "summary": "Normal sinus rhythm",
  "signal": [0.01, 0.02, ...]
}
```
- `clientRecordId`: the client's own local id for this recording (Android: `DiagnosisRecord.id`).
  **Idempotent when sent**: uploading the same `clientRecordId` again (a WorkManager retry after
  the first response was lost, for example) returns the already-saved record instead of creating
  a duplicate. Omit it and every POST creates a new record, retries included — send it whenever
  the client queues/retries uploads.
- `recordedAt`: epoch millis the recording started.
- `fs`: sample rate in Hz.
- `signal`: the (filtered or raw) ECG samples, up to 2,000,000 values (~2.2h at 250Hz).
  For longer recordings, split into multiple uploads rather than widening this limit.

Response `201`: `{ "record": { "id": "...", "uploadedAt": ..., "sampleCount": ... , ... } }`
(no `signal` field — metadata only, to keep the response small). A retried upload (same
`clientRecordId`) also returns `201` with the original record — the client can't tell a dedup
apart from a fresh save, which is the point: it doesn't need to.

### GET /api/ecg/records
Header: `Authorization: Bearer <jwt>`
Response `200`: `{ "records": [ { "id": "...", "deviceId": ..., "recordedAt": ..., "fs": ...,
"bpm": ..., "summary": ..., "sampleCount": ..., "uploadedAt": ... }, ... ] }`
(metadata only, newest first; raw signal is not included).

## Live state

**In-memory only, by design** — a `Map` in the Node process, not a file. Live state is a few
seconds old at best; writing it to disk every ~2.5 seconds per user would thrash the
filesystem for data nobody needs to keep. It does **not** survive a server restart and does
**not** work across multiple instances — neither matters for a single always-on process, but
if that changes, swap `liveStateByUser` in `lib/db.ts` for Redis or similar rather than files.

### POST /api/ecg/live
Header: `Authorization: Bearer <jwt>`
Request:
```json
{
  "ts": 1732000000000,
  "fs": 250,
  "signal": [0.01, 0.02, ...],
  "leadOff": false,
  "signalQuality": 0.95,
  "bpm": 72,
  "latestBeat": { "probs": [0.9, 0.02, 0.03, 0.02, 0.03], "classes": ["Normal", "Sinus_Tachy", "APC", "AF_AFL", "VPC"] }
}
```
- Meant to be called every ~2-3 seconds while a live session is active; `signal` is just the
  samples since the last call, not the whole recording (capped at 20,000 values per call).
- The server appends `signal` to that user's rolling ~60s window (older samples drop off) and
  overwrites `leadOff`/`signalQuality`/`bpm`/`latestBeat` with this call's values.
- `latestBeat` is optional/nullable — omit it when no new beat was classified since the last
  flush.

Response `201`: `{ "updatedAt": ..., "sampleCount": ... }`. `400`/`401` as elsewhere.

**Client behavior this is designed for** (not enforced server-side): send only the latest
snapshot, never a queue — if a send is in flight, drop intermediate state rather than buffering
it, and back off (growing delay, capped) on repeated failures rather than hammering the
endpoint. A dropped live update should never retry; by the time a retry would land, the data is
stale anyway.

### GET /api/ecg/live
Header: `Authorization: Bearer <jwt>`
Response `200`: `{ "state": { "updatedAt": ..., "fs": ..., "signal": [...], "leadOff": ...,
"signalQuality": ..., "bpm": ..., "latestBeat": {...} | null } }`, or `{ "state": null }` if
this user has never sent a live update (or the server restarted since). Meant to be polled
(the homepage polls every second); check `updatedAt` against the current time
and show a "disconnected" state once it's stale — don't just keep showing the last waveform as
if it were current.

## GET /api/health
No auth. `{ "status": "ok", "time": ... }`. A cheap reachability check — useful for a client's
retry loop to tell "server is down" apart from "my own connection is down" before trying an
authenticated call.

## Notes for the Android client

- Store the JWT from signup/login (e.g. `SharedPreferences`) and send it as
  `Authorization: Bearer <token>` on every `/api/ecg/*` call.
- On `401` from any authenticated endpoint, clear the stored token and prompt re-login —
  tokens expire after 30 days (`TOKEN_TTL` in `lib/auth.ts`).
- The base URL during local development is typically `http://10.0.2.2:<port>/api/` from
  an emulator (host loopback), or `http://localhost:<port>/api/` from a physical phone over
  USB after `adb reverse tcp:<port> tcp:<port>` (without it, `localhost` on-device is the
  phone itself). The app only permits cleartext HTTP to those two hosts, so a LAN IP needs an
  entry in its `network_security_config.xml`. From outside the lab, use the HTTPS tunnel URL
  — see [ALWAYS_ON.md](ALWAYS_ON.md).
