import { useEffect } from 'react'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { mockTrendsData, mockAds } from '../data/mockData'
import { useDashboard } from '../store/dashboard'
import { revenueReport } from '../lib/reports/generators'

export default function Revenue() {
  const setReportBuilder = useDashboard(s => s.setReportBuilder)

  useEffect(() => {
    setReportBuilder(() => revenueReport())
    return () => setReportBuilder(null)
  }, [setReportBuilder])
  const totalSpend = 9194
  const closedRevenue = 24000
  const activePipelineValue = 45000
  const historicalCloseRate = 0.2
  const projectedRevenue = closedRevenue + (activePipelineValue * historicalCloseRate)

  const revenueByAd = mockAds.filter(ad => ad.closedWon > 0).map(ad => ({
    name: ad.name,
    revenue: ad.closedWon * 24000,
  }))

  // Build dual-line chart: spend per day + cumulative revenue (steps up on close date)
  let cumulativeRevenue = 0
  const spendVsRevenue = mockTrendsData.map(d => {
    if (d.date === 'Apr 10') cumulativeRevenue = 24000
    return { date: d.date, spend: d.spend, revenue: cumulativeRevenue }
  })

  return (
    <div>
      {/* Big headline */}
      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 shadow-sm mb-6 text-center">
          <p className="text-sm text-[#6B7280] mb-2">Campaign performance so far</p>
          <h2 className="text-4xl font-bold text-[#0F0F1A] mb-1">
            You made <span className="text-[#16A34A]">AED {closedRevenue.toLocaleString()}</span> back on <span className="text-[#DC2626]">AED {totalSpend.toLocaleString()}</span> spent
          </h2>
          <p className="text-sm text-[#6B7280] mt-2">Return on ad spend: <span className="font-bold text-[#0F0F1A]">{(closedRevenue / totalSpend).toFixed(1)}x</span></p>
        </div>
      </ErrorBoundary>

      {/* Four cards */}
      <ErrorBoundary>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Spend', value: `AED ${totalSpend.toLocaleString()}`, sub: 'What you put in', color: '#DC2626' },
            { label: 'Booked Deal Value', value: `AED ${activePipelineValue.toLocaleString()}`, sub: 'Active pipeline value', color: '#2563EB' },
            { label: 'Closed Revenue', value: `AED ${closedRevenue.toLocaleString()}`, sub: 'Actual revenue received', color: '#16A34A' },
            { label: 'Projected Revenue', value: `AED ${Math.round(projectedRevenue).toLocaleString()}`, sub: 'Closed + active x close rate', color: '#EC4899' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-2">{label}</p>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
              <p className="text-xs text-[#9CA3AF] mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </ErrorBoundary>

      {/* Revenue by source */}
      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Revenue by Source Ad</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByAd}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`AED ${v.toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ErrorBoundary>

      {/* Monthly trend */}
      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Spend vs Revenue Trend</h2>
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
        </div>
      </ErrorBoundary>

      <AISummary summary={
        `You spent AED ${totalSpend.toLocaleString()} and closed AED ${closedRevenue.toLocaleString()} in revenue — a ROAS of ${(closedRevenue / totalSpend).toFixed(1)}x. ` +
        `${(closedRevenue / totalSpend) >= 4 ? 'ROAS is on target.' : 'ROAS is below the 4x target — closing active pipeline will bring it up.'} ` +
        `There are AED ${activePipelineValue.toLocaleString()} in active deals being worked right now. ` +
        `Projected revenue including active pipeline at a ${(historicalCloseRate * 100).toFixed(0)}% close rate is AED ${Math.round(projectedRevenue).toLocaleString()}.`
      } />
    </div>
  )
}
