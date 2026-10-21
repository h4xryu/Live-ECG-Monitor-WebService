"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { clearSession, getToken, getUsername } from "@/lib/auth-client"

interface LiveBeat {
  probs: number[]
  classes: string[]
}

interface LiveState {
  updatedAt: number
  fs: number
  signal: number[]
  leadOff: boolean
  signalQuality: number
  bpm: number | null
  latestBeat: LiveBeat | null
}

// Mirrors ArrhythmiaConfig.CLASS_NAMES / CLASS_LABELS_KO / the cls_* color tokens on the
// Android side, so a class reads as the same color in both places.
const CLASS_META: Record<string, { label: string; color: string }> = {
  Normal: { label: "정상", color: "#067647" },
  Sinus_Tachy: { label: "동성빈맥", color: "#B54708" },
  APC: { label: "심방조기수축", color: "#1A56DB" },
  AF_AFL: { label: "심방조/세동", color: "#6941C6" },
  VPC: { label: "심실조기수축", color: "#C4320A" },
}

const POLL_MS = 1000
const STALE_MS = 8000 // no update for this long → treat the session as gone, not just quiet

function hexToRgba(hex: string, alpha: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildPolyline(signal: number[], width: number, height: number): string {
  if (signal.length < 2) return ""
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const v of signal) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min || 1
  const padded = span * 1.15
  const mid = (max + min) / 2
  const lo = mid - padded / 2
  const step = width / (signal.length - 1)
  return signal
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - lo) / padded) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

export default function LivePage() {
  const router = useRouter()
  const [state, setState] = useState<LiveState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    const token = getToken()
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const res = await fetch("/api/ecg/live", { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) {
        clearSession()
        router.replace("/login")
        return
      }
      const json = await res.json()
      setState(json.state)
      setError(null)
    } catch {
      setError("서버에 연결할 수 없습니다")
    }
  }, [router])

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login")
      return
    }
    setUsername(getUsername())
    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [poll, router])

  const isStale = state ? Date.now() - state.updatedAt > STALE_MS : false
  const beat = state?.latestBeat
  const topIndex = beat ? beat.probs.indexOf(Math.max(...beat.probs)) : -1
  const topClass = beat && topIndex >= 0 ? beat.classes[topIndex] : null
  const topProb = beat && topIndex >= 0 ? beat.probs[topIndex] : 0
  const topMeta = topClass ? CLASS_META[topClass] : null

  const qualityPct = state ? Math.round(state.signalQuality * 100) : 0
  const qualityColor = qualityPct >= 80 ? "#067647" : qualityPct >= 50 ? "#B54708" : "#C4320A"

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">실시간 모니터링</h1>
          <p className="text-muted-foreground text-sm">
            {username ? `${username} 님의 기기` : "연결 대기 중"}
          </p>
        </div>
        <button
          className="text-sm text-muted-foreground hover:underline"
          onClick={() => {
            clearSession()
            router.replace("/login")
          }}
        >
          로그아웃
        </button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!state && !error && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            아직 전송된 실시간 데이터가 없습니다. Android 앱에서 모니터링을 시작하고 로그인되어 있는지
            확인하세요.
          </CardContent>
        </Card>
      )}

      {state && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={state.bpm ? "default" : "outline"}>
              {state.bpm ? `${state.bpm} BPM` : "BPM --"}
            </Badge>
            <Badge variant={state.leadOff ? "destructive" : "outline"}>
              {state.leadOff ? "전극 이탈 (Lead-off)" : "전극 정상"}
            </Badge>
            {isStale && <Badge variant="outline">연결 끊김 — 마지막 수신: {new Date(state.updatedAt).toLocaleTimeString()}</Badge>}
            {topMeta && (
              <Badge style={{ backgroundColor: hexToRgba(topMeta.color, Math.max(0.25, topProb)) }}>
                {topMeta.label} {(topProb * 100).toFixed(0)}%
              </Badge>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ECG</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full h-40 rounded-md border bg-white overflow-hidden">
                <svg viewBox="0 0 800 160" preserveAspectRatio="none" className="w-full h-full">
                  <polyline
                    points={buildPolyline(state.signal, 800, 160)}
                    fill="none"
                    stroke={state.leadOff ? "#C4C2BC" : "#111111"}
                    strokeWidth={1.5}
                  />
                  {/* Most recent beat, as a highlighted band at the right edge — opacity tracks
                      the model's confidence in that class, same idea as the probability bars below. */}
                  {topMeta && !state.leadOff && (
                    <rect
                      x={760}
                      y={0}
                      width={40}
                      height={160}
                      fill={hexToRgba(topMeta.color, Math.min(0.5, topProb * 0.5))}
                    />
                  )}
                </svg>
                {(state.leadOff || isStale) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-muted-foreground text-sm font-medium">
                    {state.leadOff ? "전극이 떨어졌습니다" : "신호 수신 대기 중"}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">신호 품질</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${qualityPct}%`, backgroundColor: qualityColor }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {qualityPct}% · 최근 구간 중 전극 정상 비율 기반 추정치
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">분류 확률</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {beat ? (
                  beat.classes.map((cls, i) => {
                    const meta = CLASS_META[cls] ?? { label: cls, color: "#666666" }
                    const p = beat.probs[i]
                    return (
                      <div key={cls} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{meta.label}</span>
                          <span className="text-muted-foreground">{(p * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${p * 100}%`, backgroundColor: hexToRgba(meta.color, Math.max(0.2, p)) }}
                          />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">아직 분류 결과가 없습니다.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          ← 대시보드로 돌아가기
        </Link>
      </p>
    </div>
  )
}
