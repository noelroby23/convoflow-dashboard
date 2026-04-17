import { useState } from 'react'
import KPICard from '../components/ui/KPICard'
import Tabs from '../components/ui/Tabs'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { useSalesRepPerformance } from '../hooks/useDashboardData'

export default function SalesPerformance() {
  const [activeTab, setActiveTab] = useState('overview')
  const { data: salesReps, loading } = useSalesRepPerformance()

  // Compute team totals from real data
  const totalMeetings = salesReps?.reduce((sum, r) => sum + (r.meetings_scheduled ?? 0), 0) ?? 0
  const totalShows = salesReps?.reduce((sum, r) => sum + (r.shows ?? 0), 0) ?? 0
  const totalNoShows = salesReps?.reduce((sum, r) => sum + (r.no_shows ?? 0), 0) ?? 0
  const totalCloses = salesReps?.reduce((sum, r) => sum + (r.closes ?? 0), 0) ?? 0

  return (
    <div>
      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'ai-coach', label: 'AI Sales Coach' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'overview' && (
        <>
          <ErrorBoundary>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <KPICard label="Meetings Scheduled" value={totalMeetings} loading={loading} description="Total meetings booked this period" />
              <KPICard label="Shows" value={totalShows} loading={loading} description="People who attended their meeting" />
              <KPICard label="No-Shows" value={totalNoShows} loading={loading} inverse={true} description="People who missed their meeting" />
              <KPICard label="Closes" value={totalCloses} loading={loading} description="New customers signed" target={2} />
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Per-Salesperson Performance</h2>
              {loading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
              ) : !salesReps?.length ? (
                <p className="text-sm text-[#9CA3AF] text-center py-8">No sales rep data available yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      {['Name', 'Meetings', 'Shows', 'No-Shows', 'Show Rate', 'Closes', 'Close Rate', 'Revenue Closed'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-[#6B7280] pb-2 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesReps.map((rep) => {
                      const showRate = rep.meetings_scheduled > 0
                        ? ((rep.shows / rep.meetings_scheduled) * 100).toFixed(1)
                        : '0.0'
                      const closeRate = rep.meetings_scheduled > 0
                        ? ((rep.closes / rep.meetings_scheduled) * 100).toFixed(1)
                        : '0.0'
                      return (
                        <tr key={rep.sales_rep} className="border-b border-[#F3F4F6]">
                          <td className="py-3 pr-4 font-medium text-[#0F0F1A]">{rep.sales_rep}</td>
                          <td className="py-3 pr-4">{rep.meetings_scheduled ?? '—'}</td>
                          <td className="py-3 pr-4 text-[#16A34A] font-medium">{rep.shows ?? '—'}</td>
                          <td className="py-3 pr-4 text-[#DC2626] font-medium">{rep.no_shows ?? '—'}</td>
                          <td className={`py-3 pr-4 font-medium ${parseFloat(showRate) < 50 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>{showRate}%</td>
                          <td className="py-3 pr-4">{rep.closes ?? '—'}</td>
                          <td className={`py-3 pr-4 font-medium ${parseFloat(closeRate) === 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>{closeRate}%</td>
                          <td className="py-3 text-[#0F0F1A] font-medium">{rep.revenue_closed ? `AED ${Number(rep.revenue_closed).toLocaleString()}` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Speed Metrics</h2>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Lead to First Call', value: '1.2 hrs', target: '< 1 hr', good: false },
                  { label: 'Booking to Meeting', value: '3.2 days', target: '< 5 days', good: true },
                  { label: 'Meeting to Follow-up', value: '18 hrs', target: '< 4 hrs', good: false },
                  { label: 'Proposal to Close', value: '6 days', target: '< 7 days', good: true },
                ].map(({ label, value, target, good }) => (
                  <div key={label} className="p-4 rounded-lg bg-[#F3F4F6]">
                    <p className="text-xs text-[#6B7280] mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${good ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{value}</p>
                    <p className="text-xs text-[#9CA3AF]">Target: {target}</p>
                  </div>
                ))}
              </div>
            </div>
          </ErrorBoundary>
        </>
      )}

      {activeTab === 'ai-coach' && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 flex flex-col items-center justify-center gap-3">
          <p className="text-sm font-medium text-[#333333]">Sales coaching insights coming soon</p>
          <p className="text-xs text-[#9CA3AF]">AI Sales Coach will analyse call recordings and provide rep-by-rep feedback. Coming in V2.</p>
        </div>
      )}
    </div>
  )
}
