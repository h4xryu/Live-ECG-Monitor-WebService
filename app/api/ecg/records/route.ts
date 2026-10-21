import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { listEcgUploadsForUser } from "@/lib/db"

/** Lists the authenticated user's uploaded ECG records (metadata only, no raw signal). */
export async function GET(req: NextRequest) {
  const payload = requireAuth(req)
  if (!payload) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  return NextResponse.json({ records: listEcgUploadsForUser(payload.sub) })
}
