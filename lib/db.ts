import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

// Minimal file-backed data store — no native deps, works with a plain `npm install`.
// Good enough for a single-instance dev/demo server; swap for a real database (Postgres,
// SQLite, etc.) before scaling beyond one process.

const DATA_DIR = path.join(process.cwd(), "data")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const ECG_DIR = path.join(DATA_DIR, "ecg-records")

// How much of the rolling live waveform a single user's in-memory state keeps, regardless of fs.
const LIVE_WINDOW_SAMPLES = 15000 // ~60s at 250Hz

/**
 * Writes via a temp file + rename so a crash mid-write can never leave USERS_FILE half-written
 * (rename is atomic on the same filesystem). True concurrent-request races aren't a separate
 * risk here: every call site below is synchronous fs with no `await` between its read and its
 * write, and Node runs one request handler at a time, so each read-modify-write already
 * completes without another request's write interleaving.
 */
function writeFileAtomic(filePath: string, content: string) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, content, "utf8")
  fs.renameSync(tmp, filePath)
}

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  createdAt: number
}

export interface EcgUploadRecord {
  id: string
  userId: string
  /** The client's own locally-generated record id (e.g. Android's DiagnosisRecord.id), used to
   *  de-duplicate retried uploads (WorkManager etc.) — null for clients that don't send one. */
  clientRecordId: string | null
  deviceId: string | null
  recordedAt: number
  uploadedAt: number
  fs: number
  bpm: number | null
  summary: string | null
  sampleCount: number
  signal: number[]
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(ECG_DIR)) fs.mkdirSync(ECG_DIR, { recursive: true })
  if (!fs.existsSync(USERS_FILE)) writeFileAtomic(USERS_FILE, "[]")
}

function readUsers(): UserRecord[] {
  ensureDataDir()
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"))
}

function writeUsers(users: UserRecord[]) {
  ensureDataDir()
  writeFileAtomic(USERS_FILE, JSON.stringify(users, null, 2))
}

export function findUserByUsername(username: string): UserRecord | undefined {
  return readUsers().find((u) => u.username === username)
}

export function findUserById(id: string): UserRecord | undefined {
  return readUsers().find((u) => u.id === id)
}

export function createUser(username: string, passwordHash: string): UserRecord {
  const users = readUsers()
  const user: UserRecord = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    createdAt: Date.now(),
  }
  users.push(user)
  writeUsers(users)
  return user
}

function findEcgUploadByClientId(userId: string, clientRecordId: string): EcgUploadRecord | undefined {
  const files = fs.readdirSync(ECG_DIR).filter((f) => f.endsWith(".json"))
  for (const f of files) {
    const rec: EcgUploadRecord = JSON.parse(fs.readFileSync(path.join(ECG_DIR, f), "utf8"))
    if (rec.userId === userId && rec.clientRecordId === clientRecordId) return rec
  }
  return undefined
}

/**
 * Idempotent when the client sends a `clientRecordId`: a retried upload of the same local
 * record (WorkManager retrying after the first attempt's response was lost, for example)
 * returns the existing saved record instead of creating a duplicate.
 */
export function saveEcgUpload(record: Omit<EcgUploadRecord, "id" | "uploadedAt">): EcgUploadRecord {
  ensureDataDir()
  if (record.clientRecordId) {
    const existing = findEcgUploadByClientId(record.userId, record.clientRecordId)
    if (existing) return existing
  }
  const full: EcgUploadRecord = {
    ...record,
    id: crypto.randomUUID(),
    uploadedAt: Date.now(),
  }
  writeFileAtomic(path.join(ECG_DIR, `${full.id}.json`), JSON.stringify(full))
  return full
}

export function listEcgUploadsForUser(userId: string): Array<Omit<EcgUploadRecord, "signal">> {
  ensureDataDir()
  const files = fs.readdirSync(ECG_DIR).filter((f) => f.endsWith(".json"))
  const out: Array<Omit<EcgUploadRecord, "signal">> = []
  for (const f of files) {
    const rec: EcgUploadRecord = JSON.parse(fs.readFileSync(path.join(ECG_DIR, f), "utf8"))
    if (rec.userId === userId) {
      const { signal, ...rest } = rec
      out.push(rest)
    }
  }
  out.sort((a, b) => b.uploadedAt - a.uploadedAt)
  return out
}

export interface LiveBeat {
  probs: number[]
  classes: string[]
}

export interface LiveState {
  userId: string
  updatedAt: number
  fs: number
  signal: number[] // rolling window, oldest first, capped to LIVE_WINDOW_SAMPLES
  leadOff: boolean
  signalQuality: number
  bpm: number | null
  latestBeat: LiveBeat | null
}

// In-memory only, by design: live state is "a few seconds ago at best" data — writing it to
// disk every ~2.5s per user would thrash the filesystem for no benefit, and losing it on a
// server restart is fine (the next Android flush repopulates it within a few seconds). This
// means live state does NOT survive a restart and does NOT work across multiple instances;
// neither matters for a single always-on process, but swap for Redis or similar if that changes.
const liveStateByUser = new Map<string, LiveState>()

/** Appends a chunk to the user's rolling live window and overwrites the other live fields. */
export function appendLiveState(
  userId: string,
  chunk: {
    fs: number
    signal: number[]
    leadOff: boolean
    signalQuality: number
    bpm: number | null
    latestBeat: LiveBeat | null
  },
): LiveState {
  const prev = liveStateByUser.get(userId)
  let signal = prev ? prev.signal.concat(chunk.signal) : chunk.signal.slice()
  if (signal.length > LIVE_WINDOW_SAMPLES) {
    signal = signal.slice(signal.length - LIVE_WINDOW_SAMPLES)
  }

  const next: LiveState = {
    userId,
    updatedAt: Date.now(),
    fs: chunk.fs,
    signal,
    leadOff: chunk.leadOff,
    signalQuality: chunk.signalQuality,
    bpm: chunk.bpm,
    latestBeat: chunk.latestBeat,
  }
  liveStateByUser.set(userId, next)
  return next
}

export function getLiveState(userId: string): LiveState | null {
  return liveStateByUser.get(userId) ?? null
}
