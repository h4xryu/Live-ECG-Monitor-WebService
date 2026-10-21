import { NextResponse } from "next/server"

/**
 * No auth, no body — a cheap reachability check for the Android client's retry loop (hit this
 * before/alongside the live-send backoff instead of inferring liveness from a 401/timeout).
 */
export async function GET() {
  return NextResponse.json({ status: "ok", time: Date.now() })
}
