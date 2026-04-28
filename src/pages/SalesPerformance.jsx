import { useState, useEffect } from 'react'
import KPICard from '../components/ui/KPICard'
import Tabs from '../components/ui/Tabs'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { useSalesRepPerformance, useTargets } from '../hooks/useDashboardData'
import { useDashboardOverview } from '../hooks/useDashboardOverview'
import { useDashboard } from '../store/dashboard'
import { salesReport } from '../lib/reports/generators'

export default function SalesPerformance() {
  const [activeTab, setActiveTab] = useState('overview')
  const { data: salesReps, loading: repsLoading, error: repsError } = useSalesRepPerformance()
  const dateRange = useDashboard(s => s.dateRange)
  const { data: overview, loading: overviewLoading, error: overviewError } = useDashboardOverview(dateRange.from, dateRange.to)
  const { data: targets } = useTargets()
  const setReportBuilder = useDashboard(s => s.setReportBuilder)

  useEffect(() => {
    setReportBuilder(() => salesReport(overview, salesReps))
    return () => setReportBuilder(null)
  }, [overview, salesReps, setReportBuilder])

  const loading = repsLoading || overviewLoading

  const totalMeetings = (salesReps ?? []).reduce((sum, rep) => sum + Number(rep.meetings_scheduled ?? 0), 0)
  const totalShows = (salesReps ?? []).reduce((sum, rep) => sum + Number(rep.shows ?? 0), 0)
  const totalNoShows = (salesReps ?? []).reduce((sum, rep) => sum + Number(rep.no_shows ?? 0), 0)
  const totalCloses = (salesReps ?? []).reduce((sum, rep) => sum + Number(rep.closes ?? 0), 0)
  const totalDisqualified = Number(overview?.disqualified ?? 0)
  const totalLost = Number(overview?.closed_lost ?? 0)
  const totalNotInterested = Number(overview?.not_interested ?? 0)
  const meetingsTarget = targets?.monthly_meetings ?? 30
  const showsTarget = 23
  const closeRateTarget = 20

  const showRate = totalMeetings > 0 ? ((totalShows / totalMeetings) * 100).toFixed(0) : 0
  const closeRate = totalShows > 0 ? ((totalCloses / totalShows) * 100).toFixed(0) : 0

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
          {/* Row 1 — Meetings */}
          <ErrorBoundary>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <KPICard label="Meetings Scheduled" value={totalMeetings} loading={overviewLoading} description="Total meetings booked this period" target={meetingsTarget} />
              <KPICard label="Shows" value={totalShows} loading={overviewLoading} description="People who attended their meeting" target={showsTarget} />
              <KPICard label="No-Shows" value={totalNoShows} loading={overviewLoading} inverse={true} description="People who missed their meeting" />
              <KPICard label="Closes" value={totalCloses} loading={overviewLoading} description="New customers signed" target={2} />
            </div>
          </ErrorBoundary>

          {/* Row 2 — Lead outcomes */}
          <ErrorBoundary>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <KPICard label="Show Rate" value={showRate} suffix="%" loading={overviewLoading} description="% of booked meetings that showed up" target={75} />
              <KPICard label="Close Rate" value={closeRate} suffix="%" loading={overviewLoading} description="% of showed meetings that closed" target={closeRateTarget} />
              <KPICard label="Disqualified" value={totalDisqualified} loading={overviewLoading} inverse={true} description="Leads disqualified by AI or sales team" />
              <KPICard label="Lost / Not Interested" value={totalLost + totalNotInterested} loading={overviewLoading} inverse={true} description="Leads lost or marked not interested" />
            </div>
          </ErrorBoundary>

          {/* Per-rep table */}
          <ErrorBoundary>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Per-Salesperson Performance</h2>
              {repsLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
              ) : repsError ? (
                <p className="text-sm text-[#B91C1C] text-center py-8">Failed to load sales rep data. Try refreshing.</p>
              ) : !salesReps?.length ? (
                <p className="text-sm text-[#9CA3AF] text-center py-8">No sales rep data for this period.</p>
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
                        ? ((rep.shows / rep.meetings_scheduled) * 100).toFixed(1) : '0.0'
                      const closeRate = rep.shows > 0
                        ? ((rep.closes / rep.shows) * 100).toFixed(1) : '0.0'
                      return (
                        <tr key={rep.sales_rep} className="border-b border-[#F3F4F6]">
                          <td className="py-3 pr-4 font-medium text-[#0F0F1A]">{rep.sales_rep}</td>
                          <td className="py-3 pr-4">{rep.meetings_scheduled ?? '—'}</td>
                          <td className="py-3 pr-4 text-[#16A34A] font-medium">{rep.shows ?? '—'}</td>
                          <td className="py-3 pr-4 text-[#DC2626] font-medium">{rep.no_shows ?? '—'}</td>
                          <td className={`py-3 pr-4 font-medium ${parseFloat(showRate) < 50 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>{showRate}%</td>
                          <td className="py-3 pr-4">{rep.closes ?? '—'}</td>
                          <td className={`py-3 pr-4 font-medium ${parseFloat(closeRate) === 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>{closeRate}%</td>
                          <td className="py-3 font-medium text-[#0F0F1A]">{rep.revenue_closed ? `AED ${Number(rep.revenue_closed).toLocaleString()}` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </ErrorBoundary>

          {overviewError && !overviewLoading && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
              Failed to load sales KPIs. Try refreshing.
            </div>
          )}

          <AISummary loading={loading} summary={
            `The sales team handled ${totalMeetings} meetings this period with ${totalShows} shows and ${totalNoShows} no-shows. ` +
            `Show rate is ${showRate}% — ${showRate >= 75 ? 'on target.' : 'below the 75% target. Consider adding pre-meeting WhatsApp reminders.'} ` +
            `The team closed ${totalCloses} deal${totalCloses !== 1 ? 's' : ''} this period (${closeRate}% close rate). ` +
            `${totalDisqualified} leads were disqualified and ${totalLost + totalNotInterested} were lost or not interested. ` +
            `${totalNoShows > 3 ? `No-shows are elevated at ${totalNoShows} — review follow-up sequences after booking.` : 'No-show volume is manageable.'}`
          } />
        </>
      )}

      {activeTab === 'ai-coach' && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 flex flex-col items-center justify-center gap-3">
          <p className="text-sm font-medium text-[#333333]">Sales coaching insights coming soon</p>
          <p className="text-xs text-[#9CA3AF]">AI Sales Coach will analyse Fathom call recordings and provide rep-by-rep feedback, objection patterns, and deal loss analysis. Coming in V2.</p>
        </div>
      )}
    </div>
  )
}
