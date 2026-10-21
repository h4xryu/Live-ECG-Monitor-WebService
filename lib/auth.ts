import jwt from "jsonwebtoken"
import type { NextRequest } from "next/server"

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me"
const TOKEN_TTL = "30d"

export interface AuthTokenPayload {
  sub: string // user id
  username: string
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload
  } catch {
    return null
  }
}

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return header.slice("Bearer ".length).trim()
}

/** Returns the authenticated user's token payload, or null if missing/invalid. */
export function requireAuth(req: NextRequest): AuthTokenPayload | null {
  const token = getBearerToken(req)
  if (!token) return null
  return verifyToken(token)
}
