import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { findUserByUsername } from "@/lib/db"
import { signToken } from "@/lib/auth"

const LoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 })
  }
  const { username, password } = parsed.data

  const user = findUserByUsername(username)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" }, { status: 401 })
  }

  const token = signToken({ sub: user.id, username: user.username })
  return NextResponse.json({ token, user: { id: user.id, username: user.username } })
}
