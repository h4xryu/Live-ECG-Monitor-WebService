import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import { saveEcgUpload } from "@/lib/db"

const UploadSchema = z.object({
  deviceId: z.string().trim().max(128).optional().nullable(),
  recordedAt: z.number(),
  fs: z.number().int().positive(),
  bpm: z.number().int().optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
  // Guards against pathological payloads; a 2M-sample array at 250Hz is ~2.2 hours of ECG.
  signal: z.array(z.number()).min(1).max(2_000_000),
})

export async function POST(req: NextRequest) {
  const payload = requireAuth(req)
  if (!payload) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = UploadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 })
  }

  const saved = saveEcgUpload({
    userId: payload.sub,
    deviceId: parsed.data.deviceId ?? null,
    recordedAt: parsed.data.recordedAt,
    fs: parsed.data.fs,
    bpm: parsed.data.bpm ?? null,
    summary: parsed.data.summary ?? null,
    sampleCount: parsed.data.signal.length,
    signal: parsed.data.signal,
  })

  const { signal, ...meta } = saved
  return NextResponse.json({ record: meta }, { status: 201 })
}
