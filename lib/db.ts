import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

// Minimal file-backed data store — no native deps, works with a plain `npm install`.
// Good enough for a single-instance dev/demo server; swap for a real database (Postgres,
// SQLite, etc.) before scaling beyond one process.

const DATA_DIR = path.join(process.cwd(), "data")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const ECG_DIR = path.join(DATA_DIR, "ecg-records")

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
