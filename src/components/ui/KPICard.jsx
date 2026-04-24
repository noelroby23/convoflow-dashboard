import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

function getTargetStatus(value, target, inverse) {
  if (target === null) {
    return {
      onTarget: null,
      statusLabel: null,
      borderColor: '#E5E7EB',
      statusColor: '#16A34A',
    }
  }

  const statusLevel = inverse
    ? value <= target ? 'green' : value <= target * 1.25 ? 'yellow' : 'red'
    : value >= target ? 'green' : value >= target * 0.75 ? 'yellow' : 'red'

  const palette = statusLevel === 'green'
    ? { color: '#16A34A', label: 'On track' }
    : statusLevel === 'yellow'
      ? { color: '#F59E0B', label: 'Close' }
      : { color: '#DC2626', label: 'Off target' }

  return {
    onTarget: statusLevel === 'green',
    statusLabel: palette.label,
    borderColor: palette.color,
    statusColor: palette.color,
  }
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
  onClick = null,
  loading = false,
  empty = false,
}) {
  const [showRec, setShowRec] = useState(false)

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
        <div className="skeleton h-3 w-24 mb-3" />
        <div className="skeleton h-8 w-32 mb-2" />
        <div className="skeleton h-3 w-20 mb-4" />
        <div className="skeleton h-3 w-full" />
      </div>
    )
  }

  if (empty) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm flex flex-col items-center justify-center min-h-[140px]">
        <p className="text-xs text-[#9CA3AF] text-center">{description || 'No data yet'}</p>
      </div>
    )
  }

  const { onTarget, statusLabel, borderColor, statusColor } = getTargetStatus(value, target, inverse)

  // Trend direction: positive outcome = green, negative outcome = red
  // For inverse metrics (costs): going down is good, going up is bad
  const trendGood = trend !== null && trend !== 0
    ? (inverse ? trend < 0 : trend > 0)
    : null

  const formatValue = (v) => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'number') {
      if (typeof decimals === 'number') {
        return v.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      }
      if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
      if (Number.isInteger(v)) return v.toString()
      return v.toFixed(1)
    }
    return v
  }

  return (
    <div
      className={`bg-white rounded-xl border-2 p-6 shadow-sm flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      style={{ borderColor }}
      onClick={onClick}
    >
      {/* Label */}
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>

      {/* Value */}
      <div className="flex items-baseline gap-1 mt-1">
        {prefix && <span className="text-sm font-medium text-[#6B7280]">{prefix}</span>}
        <span className="text-3xl font-bold text-[#0F0F1A]">{formatValue(value)}</span>
        {suffix && <span className="text-sm font-medium text-[#6B7280]">{suffix}</span>}
      </div>

      {/* Target */}
      {target !== null && (
        <p className="text-xs text-[#6B7280]">
          Target: {prefix}{typeof target === 'number' && target >= 1000 ? target.toLocaleString() : target}{suffix}
          {statusLabel && (
            <span className="ml-1 font-medium" style={{ color: statusColor }}>
              {onTarget ? '✓' : statusLabel === 'Close' ? '⚠' : '✗'} {statusLabel}
            </span>
          )
          }
        </p>
      )}

      {/* Trend */}
      {trend !== null && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          trendGood === null ? 'text-[#6B7280]' : trendGood ? 'text-[#16A34A]' : 'text-[#DC2626]'
        }`}>
          {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span>{trend > 0 ? '+' : ''}{trend}% {trendLabel}</span>
        </div>
      )}

      {/* Plain English description */}
      {description && (
        <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">{description}</p>
      )}

      {/* Recommendation slot */}
      {recommendation && (
        <div className="mt-2 border-t border-[#E5E7EB] pt-2">
          <button
            className="flex items-center gap-1 text-xs text-[#EC4899] font-medium hover:underline"
            onClick={(e) => { e.stopPropagation(); setShowRec(!showRec) }}
          >
            {showRec ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showRec ? 'Hide recommendation' : 'Show recommendation'}
          </button>
          {showRec && (
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{recommendation}</p>
          )}
        </div>
      )}
    </div>
  )
}
