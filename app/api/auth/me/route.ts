import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { findUserById } from "@/lib/db"

/** Lets a client (e.g. the Android app) check whether its stored token is still valid. */
export async function GET(req: NextRequest) {
  const payload = requireAuth(req)
  if (!payload) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const user = findUserById(payload.sub)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  return NextResponse.json({ user: { id: user.id, username: user.username } })
}
