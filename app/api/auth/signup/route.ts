import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { createUser, findUserByUsername } from "@/lib/db"
import { signToken } from "@/lib/auth"

const SignupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "아이디는 3자 이상이어야 합니다")
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, "아이디는 영문/숫자/._-만 사용할 수 있습니다"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다").max(128),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = SignupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 })
  }
  const { username, password } = parsed.data

  if (findUserByUsername(username)) {
    return NextResponse.json({ error: "이미 사용 중인 아이디입니다" }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = createUser(username, passwordHash)
  const token = signToken({ sub: user.id, username: user.username })

  return NextResponse.json({ token, user: { id: user.id, username: user.username } }, { status: 201 })
}
