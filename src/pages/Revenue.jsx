import { useEffect } from 'react'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useDashboard } from '../store/dashboard'
import { revenueReport } from '../lib/reports/generators'
import { useAdPerformance, useDailyMetrics, useLeadTrackerContacts } from '../hooks/useDashboardData'
import { useDashboardOverview } from '../hooks/useDashboardOverview'

export default function Revenue() {
  const dateRange = useDashboard(s => s.dateRange)
  const setReportBuilder = useDashboard(s => s.setReportBuilder)
  const { data: overview, loading: overviewLoading, error: overviewError } = useDashboardOverview(dateRange.from, dateRange.to)
  const { data: ads, loading: adsLoading, error: adsError } = useAdPerformance()
  const { data: dailyMetrics, loading: metricsLoading, error: metricsError } = useDailyMetrics()
  const { data: leads, loading: leadsLoading, error: leadsError } = useLeadTrackerContacts()

  const totalSpend = Number(overview?.total_spend ?? 0)
  const closedRevenue = Number(overview?.closed_revenue ?? 0)
  const activePipelineValue = Number(overview?.pipeline_value ?? 0)
  const showedUp = Number(overview?.showed_up ?? 0)
  const closedWon = Number(overview?.closed_won ?? 0)
  const historicalCloseRate = showedUp > 0 ? closedWon / showedUp : 0
  const projectedRevenue = closedRevenue + (activePipelineValue * historicalCloseRate)
  const roas = totalSpend > 0 ? (closedRevenue / totalSpend).toFixed(1) : '0.0'

  useEffect(() => {
    setReportBuilder(() => revenueReport(overview))
    return () => setReportBuilder(null)
  }, [overview, setReportBuilder])

  const closedWonLeads = (leads ?? []).filter(lead => lead.funnel_closed_won || lead.current_stage === 'closed_won')
  const revenueByAd = Object.values(closedWonLeads.reduce((acc, lead) => {
    const name = lead.ad_name || lead.source_ad || 'Unknown source'
    acc[name] = acc[name] ?? { name, revenue: 0 }
    acc[name].revenue += Number(lead.deal_value ?? 0)
    return acc
  }, {}))

  // Spend vs cumulative revenue trend from daily_metrics
  let cumulativeRevenue = 0
  const spendVsRevenue = (dailyMetrics ?? []).map(d => {
    const dayRevenue = closedWonLeads
      .filter(lead => (lead.closed_at || lead.status_updated_at || lead.ghl_created_at || lead.created_at)?.slice(0, 10) === d.date)
      .reduce((sum, lead) => sum + Number(lead.deal_value ?? 0), 0)
    cumulativeRevenue += dayRevenue
    return {
      date: d.date?.slice(5), // "MM-DD"
      spend: Number(d.spend ?? 0),
      revenue: cumulativeRevenue,
    }
  })

  const loading = overviewLoading || adsLoading || metricsLoading || leadsLoading

  return (
    <div>
      {/* Big headline */}
      {(overviewError || adsError || metricsError || leadsError) && !loading && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
          Failed to load revenue data. Try refreshing.
        </div>
      )}

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 shadow-sm mb-6 text-center">
          <p className="text-sm text-[#6B7280] mb-2">Campaign performance so far</p>
          {loading ? (
            <div className="skeleton h-10 w-96 mx-auto mb-2" />
          ) : (
            <h2 className="text-4xl font-bold text-[#0F0F1A] mb-1">
              You made <span className="text-[#16A34A]">AED {closedRevenue.toLocaleString()}</span> back on{' '}
              <span className="text-[#DC2626]">AED {Math.round(totalSpend).toLocaleString()}</span> spent
            </h2>
          )}
          <p className="text-sm text-[#6B7280] mt-2">
            Return on ad spend: <span className="font-bold text-[#0F0F1A]">{roas}x</span>
          </p>
        </div>
      </ErrorBoundary>

      {/* Four KPI cards */}
      <ErrorBoundary>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Spend', value: loading ? '—' : `AED ${Math.round(totalSpend).toLocaleString()}`, sub: 'What you put in', color: '#DC2626' },
            { label: 'Booked Deal Value', value: loading ? '—' : `AED ${Math.round(activePipelineValue).toLocaleString()}`, sub: 'Active pipeline value', color: '#2563EB' },
            { label: 'Closed Revenue', value: loading ? '—' : `AED ${Math.round(closedRevenue).toLocaleString()}`, sub: 'Actual revenue received', color: '#16A34A' },
            { label: 'Projected Revenue', value: loading ? '—' : `AED ${Math.round(projectedRevenue).toLocaleString()}`, sub: 'Closed + active x close rate', color: '#EC4899' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-2">{label}</p>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
              <p className="text-xs text-[#9CA3AF] mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </ErrorBoundary>

      {/* Revenue by source ad */}
      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Revenue by Source Ad</h2>
          {adsLoading || leadsLoading ? (
            <div className="skeleton h-48 w-full" />
          ) : adsError || leadsError ? (
            <p className="text-sm text-[#B91C1C] text-center py-12">Failed to load revenue by ad. Try refreshing.</p>
          ) : revenueByAd.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-12">No closed revenue recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueByAd}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`AED ${v.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ErrorBoundary>

      {/* Spend vs Revenue trend */}
      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Spend vs Revenue Trend</h2>
          {metricsLoading || leadsLoading ? (
            <div className="skeleton h-52 w-full" />
          ) : metricsError || leadsError ? (
            <p className="text-sm text-[#B91C1C] text-center py-12">Failed to load spend vs revenue trend. Try refreshing.</p>
          ) : spendVsRevenue.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-12">No daily metrics available for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={spendVsRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v, name) => [`AED ${Number(v).toLocaleString()}`, name]} />
                <Legend />
                <Line type="monotone" dataKey="spend" stroke="#DC2626" strokeWidth={2} name="Ad Spend (AED)" dot={false} />
                <Line type="stepAfter" dataKey="revenue" stroke="#16A34A" strokeWidth={2} name="Closed Revenue (AED)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ErrorBoundary>

      <AISummary
        loading={loading}
        summary={
          `You spent AED ${Math.round(totalSpend).toLocaleString()} and closed AED ${Math.round(closedRevenue).toLocaleString()} in revenue — a ROAS of ${roas}x. ` +
          `${Number(roas) >= 4 ? 'ROAS is on target.' : 'ROAS is below the 4x target — closing active pipeline will bring it up.'} ` +
          `There are AED ${Math.round(activePipelineValue).toLocaleString()} in active deals being worked right now. ` +
          `Projected revenue including active pipeline at a ${(historicalCloseRate * 100).toFixed(0)}% close rate is AED ${Math.round(projectedRevenue).toLocaleString()}.`
        }
      />
    </div>
  )
}
