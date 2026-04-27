import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { DATE_RANGE_PRESETS, getPresetRange, useDashboard } from '../store/dashboard'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseDate(value) {
  if (!value) return null
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatRangeLabel(from, to, preset) {
  const start = parseDate(from)
  const end = parseDate(to)

  if (!start || !end) return 'Select range'
  if (preset === 'all_time') return 'All Time'
  if (isSameDay(start, end)) return format(start, 'MMM d, yyyy')
  if (format(start, 'yyyy') === format(end, 'yyyy')) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

function getCalendarDays(month) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })
}

function isInRange(day, from, to) {
  if (!from || !to) return false
  if (isSameDay(day, from) || isSameDay(day, to)) return true
  return isAfter(day, from) && isBefore(day, to)
}

function rangeMatchesPreset(from, to) {
  const match = DATE_RANGE_PRESETS
    .filter(preset => preset.id !== 'custom')
    .find((preset) => {
      const presetRange = getPresetRange(preset.id)
      return presetRange.from === from && presetRange.to === to
    })

  return match?.id ?? 'custom'
}

function CalendarMonth({ month, startDate, endDate, onSelectDate }) {
  const days = useMemo(() => getCalendarDays(month), [month])

  return (
    <div className="min-w-0">
      <div className="mb-3 text-sm font-semibold text-white">{format(month, 'MMMM yyyy')}</div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="text-[11px] font-medium text-slate-400 text-center py-1">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelectedStart = startDate && isSameDay(day, startDate)
          const isSelectedEnd = endDate && isSameDay(day, endDate)
          const selected = isSelectedStart || isSelectedEnd
          const inRange = isInRange(day, startDate, endDate)
          const currentMonth = isSameMonth(day, month)

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className={[
                'h-10 rounded-lg text-sm transition-colors',
                currentMonth ? 'text-white' : 'text-slate-600',
                selected ? 'bg-[#EC4899] text-white shadow-sm' : '',
                !selected && inRange ? 'bg-[#7C2D92]/40 text-pink-100' : '',
                !selected && !inRange ? 'hover:bg-slate-800' : '',
              ].join(' ')}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DateRangePicker() {
  const { dateRange, setDatePreset, setCustomDateRange } = useDashboard()
  const [isOpen, setIsOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(dateRange.from)
  const [draftTo, setDraftTo] = useState(dateRange.to)
  const [draftPreset, setDraftPreset] = useState(dateRange.preset)
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(parseDate(dateRange.to) ?? new Date()))

  useEffect(() => {
    if (!isOpen) return
    setDraftFrom(dateRange.from)
    setDraftTo(dateRange.to)
    setDraftPreset(dateRange.preset)
    setDisplayMonth(startOfMonth(parseDate(dateRange.to) ?? new Date()))
  }, [dateRange.from, dateRange.preset, dateRange.to, isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const startDate = parseDate(draftFrom)
  const endDate = parseDate(draftTo)
  const leftMonth = subMonths(displayMonth, 1)

  const handlePresetSelect = (presetId) => {
    if (presetId === 'custom') {
      setDraftPreset('custom')
      return
    }

    const range = getPresetRange(presetId)
    setDraftPreset(presetId)
    setDraftFrom(range.from)
    setDraftTo(range.to)
    setDisplayMonth(startOfMonth(parseDate(range.to) ?? new Date()))
  }

  const handleDateSelect = (day) => {
    const iso = format(day, 'yyyy-MM-dd')
    const from = parseDate(draftFrom)
    const to = parseDate(draftTo)

    setDraftPreset('custom')

    if (!from || (from && to)) {
      setDraftFrom(iso)
      setDraftTo('')
      return
    }

    if (isBefore(day, from)) {
      setDraftFrom(iso)
      setDraftTo(format(from, 'yyyy-MM-dd'))
      return
    }

    setDraftTo(iso)
  }

  const handleApply = () => {
    const from = parseDate(draftFrom)
    const to = parseDate(draftTo || draftFrom)
    if (!from || !to) return

    const normalizedFrom = format(isBefore(from, to) ? from : to, 'yyyy-MM-dd')
    const normalizedTo = format(isAfter(to, from) ? to : from, 'yyyy-MM-dd')
    const matchedPreset = draftPreset === 'custom' ? rangeMatchesPreset(normalizedFrom, normalizedTo) : draftPreset

    if (matchedPreset !== 'custom') {
      setDatePreset(matchedPreset)
    } else {
      setCustomDateRange(normalizedFrom, normalizedTo)
    }

    setIsOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="no-print flex items-center gap-2 px-3 py-1.5 text-xs border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors min-w-[210px] justify-between"
      >
        <span className="flex items-center gap-2 min-w-0">
          <CalendarDays size={14} />
          <span className="truncate">{formatRangeLabel(dateRange.from, dateRange.to, dateRange.preset)}</span>
        </span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div
            className="absolute right-6 top-20 w-[min(960px,calc(100vw-3rem))] rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.9fr]">
              <div className="p-6 border-b lg:border-b-0 lg:border-r border-slate-800">
                <div className="flex items-center justify-between mb-5">
                  <button type="button" onClick={() => setDisplayMonth(subMonths(displayMonth, 1))} className="w-9 h-9 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-900 flex items-center justify-center">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Custom Range</div>
                  <button type="button" onClick={() => setDisplayMonth(addMonths(displayMonth, 1))} className="w-9 h-9 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-900 flex items-center justify-center">
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CalendarMonth month={leftMonth} startDate={startDate} endDate={endDate} onSelectDate={handleDateSelect} />
                  <CalendarMonth month={displayMonth} startDate={startDate} endDate={endDate} onSelectDate={handleDateSelect} />
                </div>
              </div>

              <div className="p-6 bg-slate-950/80">
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {DATE_RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetSelect(preset.id)}
                      className={[
                        'rounded-lg border px-3 py-2 text-xs font-medium text-left transition-colors',
                        draftPreset === preset.id
                          ? 'border-[#EC4899] bg-[#EC4899]/15 text-pink-100'
                          : 'border-slate-800 text-slate-300 hover:bg-slate-900',
                      ].join(' ')}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">From</label>
                    <input
                      value={draftFrom}
                      onChange={(event) => {
                        setDraftPreset('custom')
                        setDraftFrom(event.target.value)
                      }}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EC4899]"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">To</label>
                    <input
                      value={draftTo}
                      onChange={(event) => {
                        setDraftPreset('custom')
                        setDraftTo(event.target.value)
                      }}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EC4899]"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">Selected</div>
                  <div className="text-sm text-white">{formatRangeLabel(draftFrom, draftTo || draftFrom, draftPreset)}</div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="rounded-lg bg-[#EC4899] px-4 py-2 text-sm font-medium text-white hover:bg-[#DB2777] transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
