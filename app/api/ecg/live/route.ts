import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import { appendLiveState, getLiveState } from "@/lib/db"

const BeatSchema = z.object({
  probs: z.array(z.number()).min(1).max(16),
  classes: z.array(z.string()).min(1).max(16),
})

const LiveSchema = z.object({
  ts: z.number(),
  fs: z.number().int().positive(),
  // A few seconds per flush (Android flushes every ~2.5s) — generous cap, not a full recording.
  signal: z.array(z.number()).min(1).max(20_000),
  leadOff: z.boolean(),
  signalQuality: z.number().min(0).max(1),
  bpm: z.number().int().optional().nullable(),
  latestBeat: BeatSchema.optional().nullable(),
})

/** Android calls this every ~2-3s while a live session is active and the user is logged in. */
export async function POST(req: NextRequest) {
  const payload = requireAuth(req)
  if (!payload) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = LiveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 })
  }

  const state = appendLiveState(payload.sub, {
    fs: parsed.data.fs,
    signal: parsed.data.signal,
    leadOff: parsed.data.leadOff,
    signalQuality: parsed.data.signalQuality,
    bpm: parsed.data.bpm ?? null,
    latestBeat: parsed.data.latestBeat ?? null,
  })

  return NextResponse.json({ updatedAt: state.updatedAt, sampleCount: state.signal.length }, { status: 201 })
}

/** The web dashboard polls this (e.g. every ~1s) for the signed-in user's latest live state. */
export async function GET(req: NextRequest) {
  const payload = requireAuth(req)
  if (!payload) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const state = getLiveState(payload.sub)
  if (!state) return NextResponse.json({ state: null })
  return NextResponse.json({ state })
}
