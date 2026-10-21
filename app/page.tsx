"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { clearSession, getToken, getUsername } from "@/lib/auth-client"
import { LiveStripChart, hexToRgba } from "@/components/live-strip-chart"

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
const CLASS_ORDER = ["Normal", "Sinus_Tachy", "APC", "AF_AFL", "VPC"]
const CLASS_META: Record<string, { label: string; color: string }> = {
  Normal: { label: "정상", color: "#067647" },
  Sinus_Tachy: { label: "동성빈맥", color: "#B54708" },
  APC: { label: "심방조기수축", color: "#1A56DB" },
  AF_AFL: { label: "심방조/세동", color: "#6941C6" },
  VPC: { label: "심실조기수축", color: "#C4320A" },
}

const POLL_MS = 1000
const STALE_MS = 8000

export default function Home() {
  const router = useRouter()
  const [state, setState] = useState<LiveState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null) // null = not checked yet
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      const res = await fetch("/api/ecg/live", { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) {
        clearSession()
        setLoggedIn(false)
        return
      }
      const json = await res.json()
      setState(json.state)
      setError(null)
    } catch {
      setError("서버에 연결할 수 없습니다")
    }
  }, [])

  useEffect(() => {
    const token = getToken()
    setLoggedIn(!!token)
    if (!token) return
    setUsername(getUsername())
    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [poll])

  const isStale = state ? Date.now() - state.updatedAt > STALE_MS : false
  const secondsAgo = state ? Math.max(0, Math.round((Date.now() - state.updatedAt) / 1000)) : 0
  const beat = state?.latestBeat
  const topIndex = beat ? beat.probs.indexOf(Math.max(...beat.probs)) : -1
  const topClass = beat && topIndex >= 0 ? beat.classes[topIndex] : null
  const topProb = beat && topIndex >= 0 ? beat.probs[topIndex] : 0
  const topMeta = topClass ? CLASS_META[topClass] : null

  const qualityPct = state ? Math.round(state.signalQuality * 100) : 0
  const qualityColor = qualityPct >= 80 ? "#067647" : qualityPct >= 50 ? "#B54708" : "#C4320A"

  if (loggedIn === false) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-semibold">실시간 모니터링</h1>
        <p className="text-muted-foreground text-sm">
          Android 앱과 같은 계정으로 로그인하면 실시간 ECG를 볼 수 있습니다.
        </p>
        <Link href="/login" className="inline-block text-sm font-medium underline">
          로그인하러 가기
        </Link>
        <p className="text-xs text-muted-foreground pt-8">
          파일을 업로드해 분석하는 도구는{" "}
          <Link href="/tools" className="underline">
            여기
          </Link>
          에 있습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">실시간 ECG</h1>
          {/* Legend — same color per class everywhere (Android strip, probability bars, here). */}
          <div className="hidden sm:flex items-center gap-2">
            {CLASS_ORDER.map((cls) => {
              const meta = CLASS_META[cls]
              const active = cls === topClass
              return (
                <span
                  key={cls}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground"
                  style={active ? { color: meta.color, fontWeight: 600 } : undefined}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ backgroundColor: hexToRgba(meta.color, active ? 1 : 0.4) }}
                  />
                  {meta.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {username ?? "..."}
        </Badge>
        <Badge variant={state?.bpm ? "default" : "outline"}>{state?.bpm ? `${state.bpm} BPM` : "BPM --"}</Badge>
        <Badge variant={state?.leadOff ? "destructive" : "outline"}>
          {state?.leadOff ? "전극 이탈" : "전극 정상"}
        </Badge>
        {state && (
          <span className="text-xs text-muted-foreground">
            신호품질{" "}
            <span style={{ color: qualityColor, fontWeight: 600 }}>{qualityPct}%</span>
          </span>
        )}
        {isStale && state && (
          <Badge variant="destructive">연결 끊김 · 마지막 수신 {secondsAgo}초 전</Badge>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!state && !error && (
        <div className="rounded-md border py-16 text-center text-muted-foreground text-sm">
          아직 전송된 실시간 데이터가 없습니다. Android 앱에서 모니터링을 시작하세요.
        </div>
      )}

      {state && (
        <LiveStripChart
          signal={state.signal}
          fs={state.fs}
          leadOff={state.leadOff}
          stale={isStale}
          topMeta={topMeta}
          topProb={topProb}
        />
      )}
    </div>
  )
}
