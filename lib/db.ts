import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

// Minimal file-backed data store — no native deps, works with a plain `npm install`.
// Good enough for a single-instance dev/demo server; swap for a real database (Postgres,
// SQLite, etc.) before scaling beyond one process.

const DATA_DIR = path.join(process.cwd(), "data")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const ECG_DIR = path.join(DATA_DIR, "ecg-records")
const LIVE_DIR = path.join(DATA_DIR, "live")

// How much of the rolling live waveform a single user's state file keeps, regardless of fs.
const LIVE_WINDOW_SAMPLES = 15000 // ~60s at 250Hz

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  createdAt: number
}

export interface EcgUploadRecord {
  id: string
  userId: string
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
  if (!fs.existsSync(LIVE_DIR)) fs.mkdirSync(LIVE_DIR, { recursive: true })
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8")
}

function readUsers(): UserRecord[] {
  ensureDataDir()
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"))
}

function writeUsers(users: UserRecord[]) {
  ensureDataDir()
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8")
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

export function saveEcgUpload(record: Omit<EcgUploadRecord, "id" | "uploadedAt">): EcgUploadRecord {
  ensureDataDir()
  const full: EcgUploadRecord = {
    ...record,
    id: crypto.randomUUID(),
    uploadedAt: Date.now(),
  }
  fs.writeFileSync(path.join(ECG_DIR, `${full.id}.json`), JSON.stringify(full), "utf8")
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

function liveFile(userId: string) {
  return path.join(LIVE_DIR, `${userId}.json`)
}

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
  ensureDataDir()
  const file = liveFile(userId)
  let signal: number[] = []
  if (fs.existsSync(file)) {
    const prev: LiveState = JSON.parse(fs.readFileSync(file, "utf8"))
    signal = prev.signal
  }
  signal = signal.concat(chunk.signal)
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
  fs.writeFileSync(file, JSON.stringify(next), "utf8")
  return next
}

export function getLiveState(userId: string): LiveState | null {
  ensureDataDir()
  const file = liveFile(userId)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, "utf8"))
}
