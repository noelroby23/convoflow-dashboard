import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

// A card reports one number. Three things decide how it looks, in this order:
// whether the number EXISTS, whether it has a target, and only then whether it
// is meeting that target.
//
// ⚠️ The old version skipped the first question. getTargetStatus(null, 1200)
// returned GREEN, because `null <= 1200` is true — so an absent figure rendered
// as "✓ On track". That is how Home showed four green ticks while spend, cost
// per lead and cost per meeting were all missing: zero and null are always
// under a cost target. An unknown number now has no verdict at all.
function getTargetStatus(value, target, inverse) {
  const missing = value === null || value === undefined
  if (missing || target === null) {
    return { level: missing ? 'unknown' : 'none', statusLabel: null, statusColor: null }
  }

  const level = inverse
    ? value <= target ? 'good' : value <= target * 1.25 ? 'near' : 'bad'
    : value >= target ? 'good' : value >= target * 0.75 ? 'near' : 'bad'

  const palette = {
    good: { color: '#0E7C55', label: 'On track' },
    near: { color: '#B45309', label: 'Close' },
    bad:  { color: '#C2334B', label: 'Off target' },
  }[level]

  return { level, statusLabel: palette.label, statusColor: palette.color }
}

const RAIL = {
  good: '#0E7C55',
  near: '#B45309',
  bad: '#C2334B',
  none: '#D8D8DE',
  unknown: '#D8D8DE',
}

export default function KPICard({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = null,
  target = null,
  inverse = false,
  trend = null,
  trendLabel = 'vs last week',
  description = '',
  recommendation = null,
  // Conversion from the previous funnel step, e.g. "10% of leads". The volume
  // row IS a sequence — money in, then leads, meetings, shows, deals — so the
  // step-to-step rate is real information about where the funnel leaks, not
  // decoration. Cards outside a sequence simply don't pass it.
  fromPrevious = null,
  // Why a number is absent. Shown in place of a verdict, because "we don't
  // track this yet" and "this is zero" are different facts.
  missingNote = null,
  onClick = null,
  loading = false,
  empty = false,
}) {
  const [showRec, setShowRec] = useState(false)

  const shell = 'relative overflow-hidden bg-white rounded-xl border border-[#E9E9EE] ' +
    'shadow-[0_1px_2px_rgba(15,15,26,0.04)]'

  if (loading) {
    return (
      <div className={`${shell} p-5`}>
        <div className="skeleton h-3 w-24 mb-4" />
        <div className="skeleton h-9 w-28 mb-3" />
        <div className="skeleton h-3 w-20" />
      </div>
    )
  }

  if (empty) {
    return (
      <div className={`${shell} p-5 flex items-center justify-center min-h-[150px]`}>
        <p className="text-xs text-[#9CA3AF] text-center">{description || 'No data yet'}</p>
      </div>
    )
  }

  const { level, statusLabel, statusColor } = getTargetStatus(value, target, inverse)
  const isMissing = value === null || value === undefined

  const trendGood = trend !== null && trend !== 0
    ? (inverse ? trend < 0 : trend > 0)
    : null

  const formatValue = (v) => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'number') {
      if (typeof decimals === 'number') {
        return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      }
      if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
      if (Number.isInteger(v)) return v.toString()
      return v.toFixed(1)
    }
    return v
  }

  return (
    <div
      className={`${shell} pt-5 pb-5 px-5 flex flex-col ${
        onClick ? 'cursor-pointer transition-shadow hover:shadow-[0_4px_14px_rgba(15,15,26,0.08)]' : ''
      }`}
      onClick={onClick}
    >
      {/* Status is a rail on one edge, not a frame around everything. Twelve
          coloured frames is not a signal, it is wallpaper — the eye stops
          reading it after the third card. One thin mark keeps the colour
          meaningful and lets the numbers hold the page. */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: RAIL[level] ?? RAIL.none }}
      />

      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
        {label}
      </p>

      {/* DM Mono was already loaded in index.css and never used. Figures in a
          mono face line up down the whole grid, which is the point of a metrics
          page — you compare columns, not read sentences. */}
      <div className="flex items-baseline gap-1.5 mt-3">
        {prefix && !isMissing && (
          <span className="text-xs font-medium text-[#9CA3AF] tracking-wide">{prefix}</span>
        )}
        <span
          className="text-[34px] leading-none font-medium text-[#0F0F1A] tabular-nums"
          style={{ fontFamily: "'DM Mono', ui-monospace, monospace", letterSpacing: '-0.02em' }}
        >
          {formatValue(value)}
        </span>
        {suffix && !isMissing && (
          <span className="text-sm font-medium text-[#9CA3AF]">{suffix}</span>
        )}
      </div>

      {/* Where this step sits in the funnel. Only passed for the sequence. */}
      {fromPrevious && !isMissing && (
        <p className="mt-2 text-[11px] text-[#6B7280]">
          <span className="font-semibold text-[#0F0F1A] tabular-nums">{fromPrevious.value}</span>
          {' '}{fromPrevious.label}
        </p>
      )}

      <div className="mt-2 space-y-1">
        {isMissing ? (
          <p className="text-[11px] text-[#9CA3AF]">{missingNote || 'Not measured for this period'}</p>
        ) : target !== null && (
          <p className="text-[11px] text-[#6B7280] tabular-nums">
            Target {prefix}{typeof target === 'number' && target >= 1000 ? target.toLocaleString() : target}{suffix}
            {statusLabel && (
              <span className="ml-2 font-semibold" style={{ color: statusColor }}>{statusLabel}</span>
            )}
          </p>
        )}

        {trend !== null && !isMissing && (
          <div className={`flex items-center gap-1 text-[11px] font-medium ${
            trendGood === null ? 'text-[#6B7280]' : trendGood ? 'text-[#0E7C55]' : 'text-[#C2334B]'
          }`}>
            {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
            <span className="tabular-nums">{trend > 0 ? '+' : ''}{trend}% {trendLabel}</span>
          </div>
        )}
      </div>

      {description && (
        <p className="text-[11px] text-[#9CA3AF] mt-3 leading-relaxed">{description}</p>
      )}

      {recommendation && (
        <div className="mt-auto pt-3">
          <button
            className="flex items-center gap-1 text-[11px] text-[#EC4899] font-semibold hover:underline
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EC4899] focus-visible:ring-offset-2 rounded"
            onClick={(e) => { e.stopPropagation(); setShowRec(!showRec) }}
          >
            {showRec ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showRec ? 'Hide advice' : 'What to do'}
          </button>
          {showRec && (
            <p className="text-[11px] text-[#6B7280] mt-2 leading-relaxed">{recommendation}</p>
          )}
        </div>
      )}
    </div>
  )
}
