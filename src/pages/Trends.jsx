import { useEffect } from 'react'
import { useTrendMetricsByDate, useAdPerformance } from '../hooks/useDashboardData'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, startOfWeek } from 'date-fns'
import { useDashboard } from '../store/dashboard'
import { trendsReport } from '../lib/reports/generators'

const FREQ_CEILING = 2.5

const parseTrendDate = (value) => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function Trends() {
  const { data: metrics, loading } = useTrendMetricsByDate()
  const { data: ads } = useAdPerformance()
  const setReportBuilder = useDashboard(s => s.setReportBuilder)

  const chartData = (metrics ?? []).reduce((rows, d) => {
    const parsedDate = parseTrendDate(d?.date)
    if (!parsedDate) return rows

    rows.push({
      date: format(parsedDate, 'MMM d'),
      spend: Number(d.spend ?? 0),
      leads: Number(d.leads ?? 0),
      cpl: d.leads > 0 ? +(d.spend / d.leads).toFixed(1) : 0,
      meetings: Number(d.meetings_booked ?? 0),
      frequency: Number(d.avg_frequency ?? 0),
      rawDate: d.date,
    })

    return rows
  }, [])

  // Group daily data into weeks for comparison table
  const weeklyData = (() => {
    const weeks = {}
    chartData.forEach(d => {
      const rawDate = parseTrendDate(d.rawDate)
      if (!rawDate) return

      const weekKey = format(startOfWeek(rawDate, { weekStartsOn: 1 }), 'MMM d')
      if (!weeks[weekKey]) weeks[weekKey] = { week: weekKey, spend: 0, leads: 0, meetings: 0, frequency: [], days: 0 }
      weeks[weekKey].spend += d.spend
      weeks[weekKey].leads += d.leads
      weeks[weekKey].meetings += d.meetings
      weeks[weekKey].frequency.push(d.frequency)
      weeks[weekKey].days++
    })
    return Object.values(weeks)
      .map(w => ({
        ...w,
        cpl: w.leads > 0 ? +(w.spend / w.leads).toFixed(0) : null,
        costPerMeeting: w.meetings > 0 ? +(w.spend / w.meetings).toFixed(0) : null,
        avgFrequency: w.frequency.length ? +(w.frequency.reduce((a, b) => a + b, 0) / w.frequency.length).toFixed(2) : null,
      }))
      .filter(w => w.spend > 0 || w.leads > 0 || w.meetings > 0 || (w.avgFrequency ?? 0) > 0)
  })()

  useEffect(() => {
    setReportBuilder(() => trendsReport(chartData, ads))
    return () => setReportBuilder(null)
  }, [metrics, ads, setReportBuilder])

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-48 w-full rounded-xl" />)}
    </div>
  )

  if (!metrics?.length) return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
      <p className="text-sm text-[#9CA3AF]">No trend data available yet for the selected date range.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Cost per Lead</h2>
          <p className="text-xs text-[#9CA3AF] mb-4">Daily CPL vs AED 85 target</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`AED ${v}`, 'CPL']} />
              <ReferenceLine y={85} stroke="#DC2626" strokeDasharray="4 4" label={{ value: 'Target AED 85', position: 'right', fontSize: 10, fill: '#DC2626' }} />
              <Line type="monotone" dataKey="cpl" stroke="#EC4899" strokeWidth={2} dot={false} name="CPL (AED)" />
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
            <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Daily Lead Volume</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="#2563EB" radius={[3, 3, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Frequency Tracker</h2>
          <p className="text-xs text-[#9CA3AF] mb-5">Per-ad frequency vs 2.5 ceiling — higher means audience fatigue risk</p>
          {ads?.length ? (
            <div className="space-y-3">
              {[...ads]
                .filter(ad => ad.avg_frequency > 0)
                .sort((a, b) => (b.avg_frequency ?? 0) - (a.avg_frequency ?? 0))
                .map(ad => {
                  const freq = Number(ad.avg_frequency ?? 0)
                  const pct = Math.min((freq / FREQ_CEILING) * 100, 100)
                  const color = freq >= 2.0 ? '#DC2626' : freq >= 1.5 ? '#F59E0B' : '#16A34A'
                  const label = freq >= 2.0 ? 'High risk' : freq >= 1.5 ? 'Watch' : 'Healthy'
                  return (
                    <div key={ad.ad_id} className="flex items-center gap-3">
                      <span className="text-xs text-[#333333] font-medium w-44 truncate">{ad.ad_name}</span>
                      <div className="flex-1 bg-[#F3F4F6] rounded-full h-2.5 relative">
                        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        {/* Ceiling marker */}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-[#DC2626]" style={{ left: '100%' }} />
                      </div>
                      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{freq.toFixed(2)}</span>
                      <span className="text-xs w-16" style={{ color }}>{label}</span>
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
                <ReferenceLine y={2.5} stroke="#DC2626" strokeDasharray="4 4" label={{ value: 'Ceiling 2.5', position: 'right', fontSize: 10, fill: '#DC2626' }} />
                <Line type="monotone" dataKey="frequency" stroke="#F59E0B" strokeWidth={2} dot={false} name="Frequency" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ErrorBoundary>

      {weeklyData.length >= 2 && (
        <ErrorBoundary>
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Week-over-Week Comparison</h2>
            <p className="text-xs text-[#9CA3AF] mb-4">Green = better than previous week · Red = worse</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left text-xs font-semibold text-[#6B7280] pb-2 pr-4">Week</th>
                  {['Spend (AED)', 'Leads', 'CPL (AED)', 'Meetings', 'Cost/Meeting', 'Avg Frequency'].map(h => (
                    <th key={h} className="text-right text-xs font-semibold text-[#6B7280] pb-2 px-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyData.map((w, i) => {
                  const prev = weeklyData[i - 1]
                  const cell = (val, prevVal, inverse = false, fmt = v => v) => {
                    if (val === null) return <td className="text-right py-3 px-3 text-[#9CA3AF]">—</td>
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
                      {cell(w.spend, prev?.spend, false, v => `AED ${Number(v).toLocaleString()}`)}
                      {cell(w.leads, prev?.leads, false, v => v)}
                      {cell(w.cpl, prev?.cpl, true, v => `AED ${v}`)}
                      {cell(w.meetings, prev?.meetings, false, v => v)}
                      {cell(w.costPerMeeting, prev?.costPerMeeting, true, v => `AED ${Number(v).toLocaleString()}`)}
                      {cell(w.avgFrequency, prev?.avgFrequency, true, v => v)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ErrorBoundary>
      )}

      <AISummary loading={loading} summary={(() => {
        const avgCPL = chartData.length ? (chartData.reduce((s, d) => s + d.cpl, 0) / chartData.filter(d => d.cpl > 0).length || 0) : 0
        const totalLeads = chartData.reduce((s, d) => s + d.leads, 0)
        const totalSpend = chartData.reduce((s, d) => s + d.spend, 0)
        const avgFreq = chartData.length ? (chartData.reduce((s, d) => s + d.frequency, 0) / chartData.length) : 0
        const trend = chartData.length >= 2 ? chartData[chartData.length - 1].cpl - chartData[0].cpl : 0
        return (
          `Over this period you generated ${totalLeads} leads on AED ${totalSpend.toLocaleString()} in spend. ` +
          `Average daily CPL is AED ${avgCPL.toFixed(0)} vs the AED 85 target — ` +
          `${avgCPL <= 85 ? 'within target.' : 'above target.'} ` +
          `CPL is ${trend > 0 ? `trending up (+AED ${trend.toFixed(0)}) — monitor ad performance closely.` : trend < 0 ? `trending down (AED ${trend.toFixed(0)}) — positive direction.` : 'holding steady.'} ` +
          `Average frequency is ${avgFreq.toFixed(2)} — ${avgFreq > 2.0 ? 'above 2.0, creative fatigue risk is high.' : avgFreq > 1.5 ? 'approaching 1.5, monitor closely.' : 'within healthy range.'}`
        )
      })()} />
    </div>
  )
}
