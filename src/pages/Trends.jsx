import { useEffect, useMemo } from 'react'
import { useTrends, useAdPerformance } from '../hooks/useDashboardData'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { format } from 'date-fns'
import { useDashboard } from '../store/dashboard'
import { trendsReport } from '../lib/reports/generators'

const FREQ_CEILING = 2.5
const CPL_TARGET = 85

const parseDay = (value) => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const numOrNull = (v) => (v == null ? null : Number(v))
const aed = (v) => (v == null ? '—' : `AED ${Math.round(Number(v)).toLocaleString()}`)

/**
 * Week-over-Week, on the ads business (the reactivation campaign buys no media).
 *
 * Every figure here comes from cf_dash_trends (migration 315), worked out on the server:
 *  · leads are form fills in the window — new or returning — counted as people;
 *  · cost per lead is spend over the leads that came from a Meta ad (website-form leads
 *    cost no ad money, so dividing by them would flatter the ads);
 *  · a meeting is an appointment made that day that was not cancelled;
 *  · frequency is Meta's OWN figure for each day, each week and the whole window.
 *    Frequency cannot be averaged or added up — the same person seen on two days is one
 *    person to Meta — so this page never derives a week or a total from day rows.
 */
export default function Trends() {
  const { data: trends, loading, error } = useTrends('ads')
  const { data: ads, error: adsError } = useAdPerformance()
  const setReportBuilder = useDashboard(s => s.setReportBuilder)

  const win = trends?.window ?? null

  const chartData = useMemo(() => (trends?.days ?? []).reduce((rows, d) => {
    const day = parseDay(d?.date)
    if (!day) return rows
    rows.push({
      date: format(day, 'MMM d'),
      rawDate: d.date,
      spend: Number(d.spend ?? 0),
      leads: Number(d.leads ?? 0),
      metaLeads: Number(d.meta_leads ?? 0),
      websiteLeads: Number(d.website_leads ?? 0),
      // a day with spend and no Meta lead has no cost per lead — a gap, not a zero
      cpl: numOrNull(d.cpl),
      meetings: Number(d.meetings ?? 0),
      frequency: numOrNull(d.frequency),
    })
    return rows
  }, []), [trends])

  const weeklyData = useMemo(() => (trends?.weeks ?? [])
    .map(w => {
      const start = parseDay(w.week_start)
      const end = parseDay(w.week_end)
      const partial = Number(w.days ?? 7) < 7
      return {
        week: start ? format(start, 'MMM d') + (partial && end ? `–${format(end, 'MMM d')}` : '') : '',
        partial,
        spend: Number(w.spend ?? 0),
        leads: Number(w.leads ?? 0),
        metaLeads: Number(w.meta_leads ?? 0),
        cpl: numOrNull(w.cpl),
        meetings: Number(w.meetings ?? 0),
        costPerMeeting: numOrNull(w.cost_per_meeting),
        avgFrequency: numOrNull(w.frequency),
      }
    })
    .filter(w => w.spend > 0 || w.leads > 0 || w.meetings > 0), [trends])

  useEffect(() => {
    setReportBuilder(() => trendsReport(chartData, ads, win))
    return () => setReportBuilder(null)
  }, [chartData, ads, win, setReportBuilder])

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-48 w-full rounded-xl" />)}
    </div>
  )

  if (error) return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
      <p className="text-sm text-[#B91C1C]">Failed to load trend data. Try refreshing.</p>
    </div>
  )

  if (!chartData.length) return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
      <p className="text-sm text-[#9CA3AF]">No trend data available yet for the selected date range.</p>
    </div>
  )

  const freq = numOrNull(win?.frequency)
  const freqColor = freq == null ? '#9CA3AF' : freq >= 2.0 ? '#DC2626' : freq >= 1.5 ? '#F59E0B' : '#16A34A'

  return (
    <div className="space-y-4">
      <ErrorBoundary>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Ad spend', value: aed(win?.spend) },
            { label: 'Leads', value: Number(win?.leads ?? 0).toLocaleString(), sub: `${win?.meta_leads ?? 0} from Meta ads · ${Math.max(0, (win?.leads ?? 0) - (win?.meta_leads ?? 0))} website form` },
            { label: 'Cost per Meta lead', value: aed(win?.cpl), sub: `target AED ${CPL_TARGET}` },
            { label: 'Meetings booked', value: Number(win?.meetings ?? 0).toLocaleString(), sub: 'cancelled ones excluded' },
            { label: 'Cost per meeting', value: aed(win?.cost_per_meeting) },
            { label: 'Frequency', value: freq == null ? '—' : freq.toFixed(2), sub: win?.frequency_source === 'meta' ? "Meta's own figure for this window" : win?.frequency_source === 'unavailable' ? 'Meta could not be reached' : 'no ad delivery', color: freqColor },
          ].map(t => (
            <div key={t.label} className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{t.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: t.color ?? '#0F0F1A' }}>{t.value}</p>
              {t.sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{t.sub}</p>}
            </div>
          ))}
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Cost per Lead</h2>
          <p className="text-xs text-[#9CA3AF] mb-4">Daily ad spend ÷ leads from Meta ads, vs AED {CPL_TARGET} target. A gap is a day with spend and no Meta lead.</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v == null ? '—' : `AED ${v}`, 'CPL']} />
              <ReferenceLine y={CPL_TARGET} stroke="#DC2626" strokeDasharray="4 4" label={{ value: `Target AED ${CPL_TARGET}`, position: 'right', fontSize: 10, fill: '#DC2626' }} />
              <Line type="monotone" dataKey="cpl" stroke="#EC4899" strokeWidth={2} dot={{ r: 2 }} name="CPL (AED)" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ErrorBoundary>

      <div className="grid grid-cols-2 gap-4">
        <ErrorBoundary>
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Daily Ad Spend</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`AED ${v}`, 'Spend']} />
                <Bar dataKey="spend" fill="#EC4899" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Daily Lead Volume</h2>
            <p className="text-xs text-[#9CA3AF] mb-3">Everyone who filled a form that day, new or returning</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="metaLeads" stackId="l" fill="#2563EB" name="Meta ads" />
                <Bar dataKey="websiteLeads" stackId="l" fill="#93C5FD" radius={[3, 3, 0, 0]} name="Website form" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Frequency Tracker</h2>
          <p className="text-xs text-[#9CA3AF] mb-5">
            How many times the average person saw each ad in this window, from Meta — vs the {FREQ_CEILING} ceiling.
            {freq != null && <> Across all ads: <span className="font-semibold" style={{ color: freqColor }}>{freq.toFixed(2)}</span>.</>}
          </p>
          {adsError ? (
            <p className="text-sm text-[#B91C1C] text-center py-12">Failed to load ad frequency data. Try refreshing.</p>
          ) : ads?.some(ad => ad.avg_frequency > 0) ? (
            <div className="space-y-3">
              {[...ads]
                .filter(ad => ad.avg_frequency > 0)
                .sort((a, b) => (b.avg_frequency ?? 0) - (a.avg_frequency ?? 0))
                .map(ad => {
                  const f = Number(ad.avg_frequency ?? 0)
                  const pct = Math.min((f / FREQ_CEILING) * 100, 100)
                  const color = f >= 2.0 ? '#DC2626' : f >= 1.5 ? '#F59E0B' : '#16A34A'
                  const label = f >= 2.0 ? 'High risk' : f >= 1.5 ? 'Watch' : 'Healthy'
                  return (
                    <div key={ad.ad_id} className="flex items-center gap-3">
                      <span className="text-xs text-[#333333] font-medium w-44 truncate" title={ad.ad_name}>{ad.ad_name}</span>
                      <div className="flex-1 bg-[#F3F4F6] rounded-full h-2.5 relative">
                        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        <div className="absolute top-0 bottom-0 w-0.5 bg-[#DC2626]" style={{ left: '100%' }} />
                      </div>
                      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{f.toFixed(2)}</span>
                      <span className="text-xs w-16" style={{ color }}>{label}</span>
                      {ad.frequency_source === 'estimate' && <span className="text-[10px] text-[#9CA3AF]">est.</span>}
                    </div>
                  )
                })}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#F3F4F6]">
                <div className="w-3 h-3 rounded-full bg-[#16A34A]" /><span className="text-xs text-[#6B7280] mr-3">&lt; 1.5 Healthy</span>
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]" /><span className="text-xs text-[#6B7280] mr-3">1.5–2.0 Watch</span>
                <div className="w-3 h-3 rounded-full bg-[#DC2626]" /><span className="text-xs text-[#6B7280]">&gt; 2.0 High risk</span>
                <span className="ml-auto text-xs text-[#9CA3AF]">Ceiling: {FREQ_CEILING}</span>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 3]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <ReferenceLine y={FREQ_CEILING} stroke="#DC2626" strokeDasharray="4 4" label={{ value: `Ceiling ${FREQ_CEILING}`, position: 'right', fontSize: 10, fill: '#DC2626' }} />
                <Line type="monotone" dataKey="frequency" stroke="#F59E0B" strokeWidth={2} dot={false} name="Frequency" connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ErrorBoundary>

      {weeklyData.length >= 2 && (
        <ErrorBoundary>
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Week-over-Week Comparison</h2>
            <p className="text-xs text-[#9CA3AF] mb-4">Weeks run Monday to Sunday · a week cut by the date range shows its dates · Green = better than the week before · Red = worse</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left text-xs font-semibold text-[#6B7280] pb-2 pr-4">Week</th>
                  {['Spend (AED)', 'Leads', 'CPL (AED)', 'Meetings', 'Cost/Meeting', 'Frequency (Meta)'].map(h => (
                    <th key={h} className="text-right text-xs font-semibold text-[#6B7280] pb-2 px-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyData.map((w, i) => {
                  const prev = weeklyData[i - 1]
                  const cell = (val, prevVal, inverse = false, fmt = v => v) => {
                    if (val === null || val === undefined) return <td className="text-right py-3 px-3 text-[#9CA3AF]">—</td>
                    const better = prevVal != null ? (inverse ? val < prevVal : val > prevVal) : null
                    const worse = prevVal != null ? (inverse ? val > prevVal : val < prevVal) : null
                    return (
                      <td className={`text-right py-3 px-3 font-medium ${better ? 'text-[#16A34A]' : worse ? 'text-[#DC2626]' : 'text-[#0F0F1A]'}`}>
                        {fmt(val)}
                        {better && <span className="ml-1 text-xs">↑</span>}
                        {worse && <span className="ml-1 text-xs">↓</span>}
                      </td>
                    )
                  }
                  return (
                    <tr key={w.week} className="border-b border-[#F3F4F6]">
                      <td className="py-3 pr-4 font-semibold text-[#0F0F1A]">W{i + 1} ({w.week})</td>
                      {cell(w.spend, prev?.spend, false, v => `AED ${Math.round(Number(v)).toLocaleString()}`)}
                      {cell(w.leads, prev?.leads, false, v => v)}
                      {cell(w.cpl, prev?.cpl, true, v => `AED ${Math.round(v)}`)}
                      {cell(w.meetings, prev?.meetings, false, v => v)}
                      {cell(w.costPerMeeting, prev?.costPerMeeting, true, v => `AED ${Math.round(Number(v)).toLocaleString()}`)}
                      {cell(w.avgFrequency, prev?.avgFrequency, true, v => Number(v).toFixed(2))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ErrorBoundary>
      )}

      <AISummary loading={loading} summary={(() => {
        const cpl = numOrNull(win?.cpl)
        const withCpl = chartData.filter(d => d.cpl != null)
        const trend = withCpl.length >= 2 ? withCpl[withCpl.length - 1].cpl - withCpl[0].cpl : 0
        return (
          `Over this period ${win?.leads ?? 0} people filled a form (${win?.meta_leads ?? 0} from Meta ads) on ${aed(win?.spend)} of ad spend. ` +
          (cpl == null ? 'There is no cost per lead for this window. '
            : `Cost per Meta lead is AED ${Math.round(cpl)} vs the AED ${CPL_TARGET} target — ${cpl <= CPL_TARGET ? 'within target.' : 'above target.'} `) +
          (withCpl.length >= 2 ? `Day to day, CPL is ${trend > 0 ? `trending up (+AED ${trend.toFixed(0)}) — monitor ad performance closely.` : trend < 0 ? `trending down (AED ${trend.toFixed(0)}) — positive direction.` : 'holding steady.'} ` : '') +
          (freq == null ? '' : `Meta's frequency for the window is ${freq.toFixed(2)} — ${freq > 2.0 ? 'above 2.0, creative fatigue risk is high.' : freq > 1.5 ? 'past 1.5, watch it.' : 'within the healthy range.'}`)
        )
      })()} />
    </div>
  )
}
