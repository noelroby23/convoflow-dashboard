import { useFunnelSummary } from '../hooks/useDashboardData'
import ErrorBoundary from '../components/ui/ErrorBoundary'

const TARGETS = {
  total_leads: 100,
  meetings_booked: 15,
  showed_up: 12,
  closed_won: 2,
}

export default function Health() {
  const { data, loading } = useFunnelSummary()

  const metrics = [
    { label: 'Total Leads', actual: data?.total_leads ?? 0, target: TARGETS.total_leads },
    { label: 'Meetings Booked', actual: data?.meetings_booked ?? 0, target: TARGETS.meetings_booked },
    { label: 'Showed Up', actual: data?.showed_up ?? 0, target: TARGETS.showed_up },
    { label: 'Closed Won', actual: data?.closed_won ?? 0, target: TARGETS.closed_won },
  ]

  const scores = metrics.map(m => Math.min((m.actual / m.target) * 100, 100))
  const healthScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  const healthStatus = healthScore >= 80 ? { label: 'GREEN', color: '#16A34A', bg: 'bg-green-100 text-green-700' }
    : healthScore >= 60 ? { label: 'YELLOW', color: '#F59E0B', bg: 'bg-amber-100 text-amber-700' }
    : { label: 'RED', color: '#DC2626', bg: 'bg-red-100 text-red-700' }

  const churnRisk = healthScore >= 80 ? { label: 'LOW', bg: 'bg-green-100 text-green-700' }
    : healthScore >= 60 ? { label: 'MEDIUM', bg: 'bg-amber-100 text-amber-700' }
    : { label: 'HIGH', bg: 'bg-red-100 text-red-700' }

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
      {/* Health score + churn risk */}
      <ErrorBoundary>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm flex flex-col items-center justify-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-2">Overall Health Score</p>
            <p className="text-6xl font-bold" style={{ color: healthStatus.color }}>{healthScore}%</p>
            <span className={`mt-2 px-3 py-1 rounded-full text-xs font-semibold ${healthStatus.bg}`}>{healthStatus.label}</span>
            <p className="text-xs text-[#9CA3AF] mt-2 text-center">Average of leads, meetings, closes vs targets</p>
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
              {metrics.map(({ label, actual, target }) => {
                const pct = Math.round((actual / target) * 100)
                return (
                  <tr key={label} className="border-b border-[#F3F4F6]">
                    <td className="py-3 pr-6 font-medium text-[#0F0F1A]">{label}</td>
                    <td className="py-3 pr-6">{actual}</td>
                    <td className="py-3 pr-6 text-[#6B7280]">{target}</td>
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
    </div>
  )
}
