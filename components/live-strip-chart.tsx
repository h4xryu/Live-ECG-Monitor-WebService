"use client"

// Paper-strip style ECG view: several fixed-duration rows stacked top to bottom (oldest to
// newest), a light clinical-paper grid, and a highlighted box over the most recent beat's
// class — modeled on the HiCardi Android app's own strip view and the reference photo of it,
// rather than the flat single-line + card layout this started as.

export interface StripClassMeta {
  label: string
  color: string
}

interface LiveStripChartProps {
  signal: number[] // rolling buffer, oldest first
  fs: number
  leadOff: boolean
  /** True when the server hasn't heard from the device in a while — a different condition
   *  from leadOff, so it gets its own overlay message instead of being folded into leadOff. */
  stale?: boolean
  topMeta: StripClassMeta | null
  topProb: number
  rowSeconds?: number
  width?: number
}

const ROW_HEIGHT = 92
const LABEL_GUTTER = 28

export function LiveStripChart({
  signal,
  fs,
  leadOff,
  stale = false,
  topMeta,
  topProb,
  rowSeconds = 10,
  width = 860,
}: LiveStripChartProps) {
  const dimmed = leadOff || stale
  const samplesPerRow = Math.max(1, Math.round(fs * rowSeconds))
  const rows: number[][] = []
  for (let start = 0; start < signal.length; start += samplesPerRow) {
    rows.push(signal.slice(start, start + samplesPerRow))
  }
  // Oldest row at the top, most recent at the bottom — matches how a paper strip reads.
  const totalRows = Math.max(1, rows.length)
  const height = totalRows * (ROW_HEIGHT + LABEL_GUTTER)

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const v of signal) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = -1
    max = 1
  }
  const span = max - min || 1
  const padded = span * 1.25
  const mid = (max + min) / 2
  const lo = mid - padded / 2

  const innerWidth = width - 8
  // rowIndex counts from the top (oldest). The row's LEFT edge, in seconds before now — the
  // bottom row's right edge lands exactly on 0 ("now"), and each row's left edge matches the
  // row above's right edge, so the seconds-ago axis is continuous down the whole strip.
  const rowStartSecondsAgo = (rowIndex: number) => {
    const rowsFromEnd = totalRows - 1 - rowIndex
    return (rowsFromEnd + 1) * rowSeconds
  }

  return (
    <div className="relative w-full overflow-hidden rounded-md border bg-white">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height: Math.min(height, 420) }}>
        {/* Clinical-paper grid: a light pink minor grid + a slightly darker major grid every second. */}
        <defs>
          <pattern id="stripGrid" width={innerWidth / rowSeconds / 5} height={14} patternUnits="userSpaceOnUse">
            <path d={`M ${innerWidth / rowSeconds / 5} 0 L 0 0 0 14`} fill="none" stroke="#FBEAE6" strokeWidth={0.5} />
          </pattern>
        </defs>

        {rows.map((rowSignal, rowIndex) => {
          const y0 = rowIndex * (ROW_HEIGHT + LABEL_GUTTER)
          const isLastRow = rowIndex === rows.length - 1
          const step = rowSignal.length > 1 ? innerWidth / (rowSignal.length - 1) : innerWidth
          const points = rowSignal
            .map((v, i) => {
              const x = i * step
              const y = ROW_HEIGHT - ((v - lo) / padded) * ROW_HEIGHT
              return `${x.toFixed(1)},${y.toFixed(1)}`
            })
            .join(" ")

          const rowStart = rowStartSecondsAgo(rowIndex)

          return (
            <g key={rowIndex} transform={`translate(4, ${y0})`}>
              <rect x={0} y={0} width={innerWidth} height={ROW_HEIGHT} fill="url(#stripGrid)" />
              {/* Second ticks across this row. */}
              {Array.from({ length: rowSeconds + 1 }, (_, s) => s).map((s) => {
                const x = (s / rowSeconds) * innerWidth
                const major = s % 5 === 0
                return (
                  <g key={s}>
                    <line x1={x} y1={0} x2={x} y2={ROW_HEIGHT} stroke={major ? "#E4A79C" : "#F6D6CF"} strokeWidth={major ? 0.9 : 0.5} />
                    <text x={x} y={ROW_HEIGHT + 14} fontSize={9} textAnchor="middle" fill="#9A958F">
                      {`-${rowStart - s}s`}
                    </text>
                  </g>
                )
              })}
              <polyline
                points={points}
                fill="none"
                stroke={dimmed ? "#C4C2BC" : "#111111"}
                strokeWidth={1.3}
              />
              {/* Most recent beat's class, highlighted over the last ~2.5s of the newest row only —
                  we don't track exactly where in the buffer each past beat landed, so this marks
                  "now", not a precise historical position. */}
              {isLastRow && topMeta && !dimmed && (
                <g>
                  <rect
                    x={Math.max(0, innerWidth - (2.5 / rowSeconds) * innerWidth)}
                    y={0}
                    width={(2.5 / rowSeconds) * innerWidth}
                    height={ROW_HEIGHT}
                    fill={hexToRgba(topMeta.color, Math.max(0.12, Math.min(0.5, topProb * 0.55)))}
                    stroke={hexToRgba(topMeta.color, Math.min(0.9, topProb + 0.2))}
                    strokeDasharray="4 3"
                    strokeWidth={1.2}
                  />
                  <text
                    x={Math.max(4, innerWidth - (2.5 / rowSeconds) * innerWidth + 4)}
                    y={14}
                    fontSize={11}
                    fontWeight={600}
                    fill={topMeta.color}
                  >
                    {topMeta.label} {(topProb * 100).toFixed(0)}%
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {dimmed && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-muted-foreground text-sm font-medium">
          {stale ? "연결 끊김" : "전극이 떨어졌습니다"}
        </div>
      )}
    </div>
  )
}

export function hexToRgba(hex: string, alpha: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
