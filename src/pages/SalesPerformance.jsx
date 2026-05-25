import { useState, useEffect, useMemo } from 'react'
import KPICard from '../components/ui/KPICard'
import Tabs from '../components/ui/Tabs'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { useRepDrilldown, useSalesPerformance, useTargets } from '../hooks/useDashboardData'
import { useDashboard } from '../store/dashboard'
import { salesReport } from '../lib/reports/generators'

const REP_DRILLDOWN_METRICS = {
  meetings_booked: { label: 'meetings' },
  showed_up: { label: 'showed up' },
  no_shows: { label: 'no-shows' },
  active: { label: 'active opportunities' },
  closed_won: { label: 'closed won' },
  closed_lost: { label: 'closed lost' },
}

function getRepMetricValue(rep, metric) {
  if (metric === 'meetings_booked') return rep.meetings_booked ?? rep.meetings_scheduled
  if (metric === 'showed_up') return rep.showed_up ?? rep.shows
  if (metric === 'closed_won') return rep.closed_won ?? rep.closes
  return rep[metric]
}

function RepMetricCell({ rep, metric, onOpen, className = '' }) {
  const rawValue = getRepMetricValue(rep, metric)
  const value = Number(rawValue ?? 0)
  const displayValue = rawValue == null ? '—' : value.toLocaleString()

  if (!value) return <td className={`py-3 pr-4 ${className}`}>{displayValue}</td>

  return (
    <td className={`py-3 pr-4 ${className}`}>
      <button
        type="button"
        onClick={() => onOpen({
          repName: rep.sales_rep,
          metric,
          metricLabel: REP_DRILLDOWN_METRICS[metric].label,
          count: value,
        })}
        className="font-semibold text-[#2563EB] underline-offset-2 hover:underline cursor-pointer"
      >
        {value.toLocaleString()}
      </button>
    </td>
  )
}

function RepDrilldownModal({ drilldown, contacts, loading, error, onClose }) {
  if (!drilldown) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="w-full max-w-5xl rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-[#0F0F1A]">
              {drilldown.repName} — {drilldown.count.toLocaleString()} {drilldown.metricLabel}
            </h3>
            <p className="mt-1 text-xs text-[#6B7280]">Contacts attributed to this salesperson for the selected date range.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, index) => <div key={index} className="skeleton h-12 w-full" />)}</div>
          ) : error ? (
            <p className="text-sm text-[#B91C1C] text-center py-8">Failed to load contacts for this salesperson.</p>
          ) : !contacts?.length ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">No contacts found for this metric.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    {['Name', 'Phone', 'Company', 'Stage', 'Ad'].map(heading => (
                      <th key={heading} className="pb-2 pr-4 text-left text-xs font-semibold text-[#6B7280]">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact, index) => (
                    <tr key={contact.contact_id ?? contact.ghl_contact_id ?? index} className="border-b border-[#F3F4F6]">
                      <td className="py-3 pr-4 font-medium text-[#0F0F1A]">{contact.full_name || 'Unknown'}</td>
                      <td className="py-3 pr-4 text-[#6B7280]">{contact.phone || '—'}</td>
                      <td className="py-3 pr-4 text-[#6B7280]">{contact.company || '—'}</td>
                      <td className="py-3 pr-4 text-[#6B7280]">{contact.stage_name || contact.mapped_stage || '—'}</td>
                      <td className="py-3 pr-4 text-[#6B7280]">{contact.ad_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SalesPerformance() {
  const [activeTab, setActiveTab] = useState('overview')
  const { data: salesPerformance, loading: salesLoading, error: salesError } = useSalesPerformance()
  const { data: targets } = useTargets()
  const setReportBuilder = useDashboard(s => s.setReportBuilder)
  const [selectedDrilldown, setSelectedDrilldown] = useState(null)
  const { data: drilldownContacts, loading: drilldownLoading, error: drilldownError } = useRepDrilldown(
    selectedDrilldown?.repName,
    selectedDrilldown?.metric
  )

  const totals = salesPerformance?.totals ?? {}
  const salesReps = salesPerformance?.per_rep ?? []
  const totalMeetings = Number(totals.meetings_scheduled ?? 0)
  const totalShows = Number(totals.shows ?? 0)
  const totalNoShows = Number(totals.no_shows ?? 0)
  const totalCloses = Number(totals.closes ?? 0)
  const totalDisqualified = Number(totals.disqualified ?? 0)
  const totalLostNotInterested = Number(totals.lost_not_interested ?? 0)
  const salesOverview = useMemo(() => ({
    meetings_booked: totalMeetings,
    showed_up: totalShows,
    no_shows: totalNoShows,
    closed_won: totalCloses,
  }), [totalCloses, totalMeetings, totalNoShows, totalShows])

  useEffect(() => {
    setReportBuilder(() => salesReport(salesOverview, salesReps))
    return () => setReportBuilder(null)
  }, [salesOverview, salesReps, setReportBuilder])

  const loading = salesLoading
  const meetingsTarget = targets?.monthly_meetings ?? 30
  const showsTarget = targets?.monthly_shows ?? 23
  const closesTarget = targets?.monthly_closes ?? 4
  const showRateTarget = targets?.show_rate ?? 75
  const closeRateTarget = showsTarget > 0 ? Number(((closesTarget / showsTarget) * 100).toFixed(1)) : 0

  const showRate = totalMeetings > 0 ? Number(((totalShows / totalMeetings) * 100).toFixed(1)) : 0
  const closeRate = totalShows > 0 ? Number(((totalCloses / totalShows) * 100).toFixed(1)) : 0

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
              <KPICard label="Meetings Scheduled" value={totalMeetings} loading={salesLoading} description="Total meetings booked this period" target={meetingsTarget} />
              <KPICard label="Shows" value={totalShows} loading={salesLoading} description="People who attended their meeting" target={showsTarget} />
              <KPICard label="No-Shows" value={totalNoShows} loading={salesLoading} inverse={true} description="People who missed their meeting" />
              <KPICard label="Closes" value={totalCloses} loading={salesLoading} description="New customers signed" target={closesTarget} />
            </div>
          </ErrorBoundary>

          {/* Row 2 — Lead outcomes */}
          <ErrorBoundary>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <KPICard label="Show Rate" value={showRate} suffix="%" loading={salesLoading} description="% of booked meetings that showed up" target={showRateTarget} />
              <KPICard label="Close Rate" value={closeRate} suffix="%" loading={salesLoading} description="% of showed meetings that closed" target={closeRateTarget} />
              <KPICard label="Disqualified" value={totalDisqualified} loading={salesLoading} inverse={true} description="Leads disqualified by AI or sales team" />
              <KPICard label="Lost / Not Interested" value={totalLostNotInterested} loading={salesLoading} inverse={true} description="Leads lost or marked not interested" />
            </div>
          </ErrorBoundary>

          {/* Per-rep table */}
          <ErrorBoundary>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Per-Salesperson Performance</h2>
              {salesLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
              ) : salesError ? (
                <p className="text-sm text-[#B91C1C] text-center py-8">Failed to load sales rep data. Try refreshing.</p>
              ) : !salesReps?.length ? (
                <p className="text-sm text-[#9CA3AF] text-center py-8">No sales rep data for this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      {['Sales Rep', 'Meetings', 'Shows', 'No Shows', 'Active', 'Won', 'Lost', 'Revenue'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-[#6B7280] pb-2 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesReps.map((rep) => {
                      return (
                        <tr key={rep.sales_rep} className="border-b border-[#F3F4F6]">
                          <td className="py-3 pr-4 font-medium text-[#0F0F1A]">{rep.sales_rep}</td>
                          <RepMetricCell rep={rep} metric="meetings_booked" onOpen={setSelectedDrilldown} />
                          <RepMetricCell rep={rep} metric="showed_up" onOpen={setSelectedDrilldown} className="text-[#16A34A] font-medium" />
                          <RepMetricCell rep={rep} metric="no_shows" onOpen={setSelectedDrilldown} className="text-[#DC2626] font-medium" />
                          <RepMetricCell rep={rep} metric="active" onOpen={setSelectedDrilldown} />
                          <RepMetricCell rep={rep} metric="closed_won" onOpen={setSelectedDrilldown} />
                          <RepMetricCell rep={rep} metric="closed_lost" onOpen={setSelectedDrilldown} />
                          <td className="py-3 font-medium text-[#0F0F1A]">{rep.revenue ? `AED ${Number(rep.revenue).toLocaleString()}` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </ErrorBoundary>

          {salesError && !salesLoading && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
              Failed to load sales KPIs. Try refreshing.
            </div>
          )}

          <AISummary loading={loading} summary={
            `The sales team handled ${totalMeetings} meetings this period with ${totalShows} shows and ${totalNoShows} no-shows. ` +
            `Show rate is ${showRate}% — ${showRate >= showRateTarget ? 'on target.' : `below the ${showRateTarget}% target. Consider adding pre-meeting WhatsApp reminders.`} ` +
            `The team closed ${totalCloses} deal${totalCloses !== 1 ? 's' : ''} this period (${closeRate}% close rate). ` +
            `${totalDisqualified} leads were disqualified and ${totalLostNotInterested} were lost or not interested. ` +
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

      <RepDrilldownModal
        drilldown={selectedDrilldown}
        contacts={drilldownContacts}
        loading={drilldownLoading}
        error={drilldownError}
        onClose={() => setSelectedDrilldown(null)}
      />
    </div>
  )
}
