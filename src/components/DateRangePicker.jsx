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

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const SIDE_PRESET_IDS = ['last_7_days', 'last_14_days', 'last_30_days', 'this_week', 'last_week', 'this_month', 'last_month', 'last_quarter', 'all_time']

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
  const today = new Date()

  return (
    <div className="min-w-0">
      <div className="mb-4 text-sm font-semibold text-[#1F2937] text-center">{format(month, 'MMM yyyy')}</div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="text-[11px] font-medium text-[#9CA3AF] text-center py-1">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelectedStart = startDate && isSameDay(day, startDate)
          const isSelectedEnd = endDate && isSameDay(day, endDate)
          const selected = isSelectedStart || isSelectedEnd
          const inRange = isInRange(day, startDate, endDate)
          const currentMonth = isSameMonth(day, month)
          const isToday = isSameDay(day, today)

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className={[
                'h-9 rounded-full text-sm transition-colors',
                currentMonth ? 'text-[#374151]' : 'text-[#D1D5DB]',
                selected ? 'bg-[#FF6B8A] text-white shadow-sm' : '',
                !selected && inRange ? 'bg-[#FFE0E6] text-[#B8325A]' : '',
                !selected && !inRange ? 'hover:bg-[#FFF0F3]' : '',
                isToday && !selected ? 'ring-1 ring-[#FF6B8A]' : '',
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
  const [isVisible, setIsVisible] = useState(false)
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
      if (event.key === 'Escape') handleClose()
    }

    const frame = requestAnimationFrame(() => setIsVisible(true))
    window.addEventListener('keydown', handleEscape)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleEscape)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const startDate = parseDate(draftFrom)
  const endDate = parseDate(draftTo)
  const leftMonth = subMonths(displayMonth, 1)
  const sidePresets = DATE_RANGE_PRESETS.filter(preset => SIDE_PRESET_IDS.includes(preset.id))

  const handleOpen = () => {
    setIsOpen(true)
    setIsVisible(false)
  }

  const handleClose = () => {
    setIsVisible(false)
    window.setTimeout(() => setIsOpen(false), 180)
  }

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

    handleClose()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="no-print flex items-center gap-2 px-3 py-2 text-xs rounded-xl bg-[#FF6B8A] text-white hover:bg-[#FF5C80] transition-colors min-w-[220px] justify-between shadow-sm"
      >
        <span className="flex items-center gap-2 min-w-0">
          <CalendarDays size={14} />
          <span className="truncate font-medium">{formatRangeLabel(dateRange.from, dateRange.to, dateRange.preset)}</span>
        </span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div
          className={`fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-sm transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          onClick={handleClose}
        >
          <div
            className={`absolute right-6 top-20 w-[min(1080px,calc(100vw-2rem))] rounded-[12px] bg-white shadow-2xl overflow-hidden transition-all duration-200 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-4 bg-gradient-to-r from-[#FF6B8A] to-[#FF8FA3]">
              <h2 className="text-lg font-semibold text-white">Select Date Range</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px]">
              <div className="bg-[#F8F9FA] p-5 border-b lg:border-b-0 lg:border-r border-[#E5E7EB]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF] mb-4">Recently used</p>
                <div className="space-y-1">
                  {sidePresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetSelect(preset.id)}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white transition-colors"
                    >
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${draftPreset === preset.id ? 'border-[#FF6B8A]' : 'border-[#D1D5DB]'}`}>
                        {draftPreset === preset.id && <span className="w-2 h-2 rounded-full bg-[#FF6B8A]" />}
                      </span>
                      <span className={`text-sm ${draftPreset === preset.id ? 'font-semibold text-[#B8325A]' : 'text-[#374151]'}`}>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 border-b lg:border-b-0 lg:border-r border-[#E5E7EB] min-w-0">
                <div className="flex items-center justify-between mb-6">
                  <button type="button" onClick={() => setDisplayMonth(subMonths(displayMonth, 1))} className="w-9 h-9 rounded-full border border-[#F3C5CF] text-[#FF6B8A] hover:bg-[#FFF0F3] flex items-center justify-center transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="w-9 h-9" />
                  <button type="button" onClick={() => setDisplayMonth(addMonths(displayMonth, 1))} className="w-9 h-9 rounded-full border border-[#F3C5CF] text-[#FF6B8A] hover:bg-[#FFF0F3] flex items-center justify-center transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CalendarMonth month={leftMonth} startDate={startDate} endDate={endDate} onSelectDate={handleDateSelect} />
                  <CalendarMonth month={displayMonth} startDate={startDate} endDate={endDate} onSelectDate={handleDateSelect} />
                </div>
              </div>

              <div className="p-6 min-w-0">
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-[#6B7280] mb-2">Select Date Range</label>
                  <select
                    value={draftPreset}
                    onChange={(event) => handlePresetSelect(event.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#FFB8C7] focus:border-[#FF6B8A]"
                  >
                    {DATE_RANGE_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7280] mb-2">From</label>
                    <input
                      value={draftFrom}
                      onChange={(event) => {
                        setDraftPreset('custom')
                        setDraftFrom(event.target.value)
                      }}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#FFB8C7] focus:border-[#FF6B8A]"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7280] mb-2">To</label>
                    <input
                      value={draftTo}
                      onChange={(event) => {
                        setDraftPreset('custom')
                        setDraftTo(event.target.value)
                      }}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#FFB8C7] focus:border-[#FF6B8A]"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-semibold text-[#6B7280] mb-2">Comparison Range</label>
                  <select className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#FFB8C7] focus:border-[#FF6B8A]">
                    <option>No Comparison</option>
                  </select>
                </div>

                <div className="rounded-xl bg-[#FFF7F9] border border-[#FFE0E6] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF] mb-1">Selected Range</div>
                  <div className="text-sm font-medium text-[#374151]">{formatRangeLabel(draftFrom, draftTo || draftFrom, draftPreset)}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-[#E5E7EB] px-6 py-4 bg-white">
              <p className="text-xs text-[#9CA3AF]">Dates shown in Dubai Time</p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F8F9FA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="rounded-lg bg-[#FF6B8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#FF5C80] transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
