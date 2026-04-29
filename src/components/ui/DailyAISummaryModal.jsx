import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { Sparkles, X } from 'lucide-react'
import { useDashboardOverview } from '../../hooks/useDashboardOverview'
import { useDailyAISummary } from '../../context/DailyAISummaryContext'

export default function DailyAISummaryModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [hideForToday, setHideForToday] = useState(false)
  const {
    isEnabled,
    lastOpenedDate,
    setLastOpenedDate,
    hiddenForDate,
    setHiddenForDate,
  } = useDailyAISummary()

  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const yesterdayLabel = format(subDays(new Date(), 1), 'MMM d')
  const { data, loading } = useDashboardOverview(yesterday, yesterday)

  useEffect(() => {
    if (!isEnabled) {
      setIsOpen(false)
      setHideForToday(false)
      return
    }

    if (lastOpenedDate === today || hiddenForDate === today) return

    setIsOpen(true)
    setLastOpenedDate(today)
  }, [hiddenForDate, isEnabled, lastOpenedDate, setLastOpenedDate, today])

  if (!isOpen || !isEnabled) return null

  const leads = Number(data?.total_leads ?? 0)
  const spend = Number(data?.total_spend ?? 0)
  const bookings = Number(data?.meetings_booked ?? 0)
  const conversionRate = Math.round(Number(data?.meeting_rate ?? 0))

  const handleClose = () => {
    if (hideForToday) setHiddenForDate(today)
    setIsOpen(false)
    setHideForToday(false)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,15,26,0.78)] p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#2B2F3A] bg-[#111827] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#1F2937] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC4899]/20 text-[#F472B6]">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F472B6]">Daily AI Summary</p>
              <h2 className="mt-1 text-lg font-bold text-white">Yesterday&apos;s dashboard snapshot</h2>
              <p className="mt-1 text-sm text-[#9CA3AF]">{yesterdayLabel} performance pulled from your live dashboard data.</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#1F2937] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-16 w-full rounded-xl" />
              <div className="skeleton h-16 w-full rounded-xl" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Leads', value: leads },
                  { label: 'Spend', value: `AED ${spend.toLocaleString()}` },
                  { label: 'Bookings', value: bookings },
                  { label: 'Conversion Rate', value: `${conversionRate}%` },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-[#1F2937] bg-[#0F172A] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{metric.label}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-[#1F2937] bg-[#0B1220] px-4 py-4">
                <p className="text-sm leading-relaxed text-[#D1D5DB]">
                  Sarah generated <span className="font-semibold text-white">{leads} leads</span> on <span className="font-semibold text-white">AED {spend.toLocaleString()}</span> in spend,
                  booked <span className="font-semibold text-white">{bookings} meetings</span>, and converted at <span className="font-semibold text-white">{conversionRate}%</span> yesterday.
                </p>
              </div>
            </>
          )}

          <label className="mt-5 flex items-center gap-3 text-sm text-[#D1D5DB]">
            <input
              type="checkbox"
              checked={hideForToday}
              onChange={(e) => setHideForToday(e.target.checked)}
              className="h-4 w-4 rounded border-[#374151] bg-[#0F172A] text-[#EC4899] focus:ring-[#EC4899]"
            />
            Don&apos;t show again today
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#1F2937] bg-[#0B1220] px-6 py-4">
          <button
            onClick={handleClose}
            className="rounded-lg border border-[#374151] px-4 py-2 text-sm font-medium text-[#D1D5DB] transition-colors hover:bg-[#111827]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
