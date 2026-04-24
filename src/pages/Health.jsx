import { useEffect, useMemo } from 'react'
import { useTargets } from '../hooks/useDashboardData'
import { useDashboardOverview } from '../hooks/useDashboardOverview'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { useDashboard } from '../store/dashboard'
import { healthReport } from '../lib/reports/generators'

export default function Health() {
  const dateRange = useDashboard(s => s.dateRange)
  const { data, loading } = useDashboardOverview(dateRange.from, dateRange.to)
  const { data: targets } = useTargets()
  const setReportBuilder = useDashboard(s => s.setReportBuilder)

  const closedRevenue = data?.closed_revenue ?? 0
  const leadsTarget = targets?.monthly_leads ?? 100
  const meetingsTarget = targets?.monthly_meetings ?? 30
  const showRateTarget = targets?.show_rate ?? 75
  const closesTarget = targets?.monthly_closes ?? 4
  const revenueTarget = targets?.monthly_revenue ?? (closesTarget * 10000)
  const showedUpTarget = Math.round(meetingsTarget * (showRateTarget / 100))

  const metrics = useMemo(() => [
    { label: 'Total Leads',     actual: data?.total_leads ?? 0,     target: leadsTarget },
    { label: 'Meetings Booked', actual: data?.meetings_booked ?? 0, target: meetingsTarget },
    { label: 'Showed Up',       actual: data?.showed_up ?? 0,       target: showedUpTarget },
    { label: 'Closed Won',      actual: data?.closed_won ?? 0,      target: closesTarget },
    { label: 'Revenue (AED)',   actual: closedRevenue,              target: revenueTarget, isCurrency: true },
  ], [closedRevenue, closesTarget, data?.closed_won, data?.meetings_booked, data?.showed_up, data?.total_leads, leadsTarget, meetingsTarget, revenueTarget, showedUpTarget])

  const scores = metrics.filter(m => !m.isCurrency).map(m => Math.min((m.actual / m.target) * 100, 100))
  const healthScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  const healthStatus = useMemo(() => healthScore >= 80 ? { label: 'GREEN', color: '#16A34A', bg: 'bg-green-100 text-green-700' }
    : healthScore >= 60 ? { label: 'YELLOW', color: '#F59E0B', bg: 'bg-amber-100 text-amber-700' }
    : { label: 'RED', color: '#DC2626', bg: 'bg-red-100 text-red-700' }, [healthScore])

  const reportTargets = useMemo(() => ({
    total_leads: leadsTarget,
    meetings_booked: meetingsTarget,
    showed_up: showedUpTarget,
    closed_won: closesTarget,
    revenue: revenueTarget,
  }), [closesTarget, leadsTarget, meetingsTarget, revenueTarget, showedUpTarget])

  useEffect(() => {
    setReportBuilder(() => healthReport(data, healthScore, healthStatus, reportTargets))
    return () => setReportBuilder(null)
  }, [data, healthScore, healthStatus, reportTargets, setReportBuilder])

  const churnRisk = useMemo(() => healthScore >= 80 ? { label: 'LOW', bg: 'bg-green-100 text-green-700' }
    : healthScore >= 60 ? { label: 'MEDIUM', bg: 'bg-amber-100 text-amber-700' }
    : { label: 'HIGH', bg: 'bg-red-100 text-red-700' }, [healthScore])

  const getStatusBadge = (pct) => {
    if (pct >= 80) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">GREEN</span>
    if (pct >= 60) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">YELLOW</span>
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">RED</span>
  }

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 w-full rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Current month snapshot */}
      <ErrorBoundary>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Spend', value: `AED ${(data?.total_spend ?? 0).toLocaleString()}`, color: '#DC2626' },
            { label: 'Leads Generated', value: data?.total_leads ?? 0, color: '#2563EB' },
            { label: 'Closed Revenue', value: `AED ${closedRevenue.toLocaleString()}`, color: '#16A34A' },
            { label: 'Active Pipeline', value: `AED ${(data?.pipeline_value ?? 0).toLocaleString()}`, color: '#EC4899' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-1">{label}</p>
              <p className="text-2xl font-bold" style={{ color }}>{loading ? '—' : value}</p>
            </div>
          ))}
        </div>
      </ErrorBoundary>

      {/* Health score + churn risk */}
      <ErrorBoundary>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm flex flex-col items-center justify-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-4">Overall Health Score</p>
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#F3F4F6" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={healthStatus.color} strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - healthScore / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: healthStatus.color }}>{healthScore}%</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${healthStatus.bg}`}>{healthStatus.label}</span>
              </div>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-3 text-center">Average of leads, meetings, closes vs targets</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm flex flex-col items-center justify-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-2">Churn Risk</p>
            <span className={`px-4 py-2 rounded-full text-lg font-bold ${churnRisk.bg}`}>{churnRisk.label}</span>
            <p className="text-xs text-[#9CA3AF] mt-3 text-center">Based on health score and trend direction</p>
          </div>
        </div>
      </ErrorBoundary>

      {/* Actual vs Target table */}
      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Actual vs Target</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                {['Metric', 'Actual', 'Target', '% of Target', 'Status'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-[#6B7280] pb-2 pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(({ label, actual, target, isCurrency }) => {
                const pct = Math.round((actual / target) * 100)
                const fmt = v => isCurrency ? `AED ${Number(v).toLocaleString()}` : v
                return (
                  <tr key={label} className="border-b border-[#F3F4F6]">
                    <td className="py-3 pr-6 font-medium text-[#0F0F1A]">{label}</td>
                    <td className="py-3 pr-6">{fmt(actual)}</td>
                    <td className="py-3 pr-6 text-[#6B7280]">{fmt(target)}</td>
                    <td className="py-3 pr-6">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[#F3F4F6] rounded-full h-1.5 max-w-[80px]">
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= 80 ? '#16A34A' : pct >= 60 ? '#F59E0B' : '#DC2626' }} />
                        </div>
                        <span className="text-xs font-medium">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-3">{getStatusBadge(pct)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ErrorBoundary>
      <AISummary loading={loading} summary={
        `Overall health score is ${healthScore}% — ${healthStatus.label} status. ` +
        `${metrics.map(m => {
          const pct = Math.round((m.actual / m.target) * 100)
          return `${m.label}: ${m.actual} of ${m.target} target (${pct}%)`
        }).join(', ')}. ` +
        `Churn risk is ${churnRisk.label}. ` +
        `${healthScore >= 80 ? 'The campaign is performing well across all key metrics.' : healthScore >= 60 ? 'Performance is moderate — focus on the metrics showing yellow to avoid slipping into red.' : 'Performance is below target across multiple metrics — review ad spend allocation and sales follow-up urgently.'}`
      } />
    </div>
  )
}
