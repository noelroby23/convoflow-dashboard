import { useEffect, useMemo, useState } from 'react'
import { useAllContacts, useContactDetails, useTargets } from '../hooks/useDashboardData'
import { useDashboardOverview } from '../hooks/useDashboardOverview'
import KPICard from '../components/ui/KPICard'
import InsightsFeed from '../components/ui/InsightsFeed'
import Funnel from '../components/ui/Funnel'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import StatusBadge from '../components/ui/StatusBadge'
import AISummary from '../components/ui/AISummary'
import DailyAISummaryModal from '../components/ui/DailyAISummaryModal'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../store/dashboard'
import { homeReport } from '../lib/reports/generators'

function getLeadDateValue(lead) {
  const raw = lead?.ghl_created_at || lead?.created_at
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatLeadDate(lead) {
  const parsed = getLeadDateValue(lead)
  return parsed ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

export default function Overview() {
  const navigate = useNavigate()
  const dateRange = useDashboard(s => s.dateRange)
  const setReportBuilder = useDashboard(s => s.setReportBuilder)
  const { data: overview, loading: overviewLoading, error: overviewError } = useDashboardOverview(dateRange.from, dateRange.to)
  const { data: targets } = useTargets()
  const { data: activeLeads, loading: activeLeadsLoading, error: activeLeadsError } = useAllContacts()
  const { data: activePipeline, loading: pipelineLoading, error: pipelineError } = useContactDetails(['showed', 'active'])
  const [showAllLeads, setShowAllLeads] = useState(false)

  useEffect(() => {
    setReportBuilder(() => homeReport(overview, activePipeline))
    return () => setReportBuilder(null)
  }, [overview, activePipeline, setReportBuilder])

  const totalLeads = overview?.total_leads ?? 0
  const meetingsBooked = overview?.meetings_booked ?? 0
  const showedUp = overview?.showed_up ?? 0
  const activeOpps = overview?.active_opportunities ?? 0
  const closedWon = overview?.closed_won ?? 0
  const totalSpend = overview?.total_spend ?? 0
  const closedRevenue = overview?.closed_revenue ?? 0
  const cpl = overview?.cost_per_lead ?? 0
  const costPerMeeting = overview?.cost_per_meeting ?? 0
  const costPerActive = overview?.cost_per_active ?? 0
  const showRate = overview?.show_rate ?? 0
  const meetingRate = overview?.meeting_rate ?? 0
  const roas = overview?.roas ?? 0
  const spendTarget = targets?.monthly_spend ?? 33000
  const activeOppsTarget = targets?.active_opportunities ?? 10
  const leadsTarget = targets?.monthly_leads ?? 100
  const meetingsTarget = targets?.monthly_meetings ?? 30
  const showsTarget = targets?.monthly_shows ?? 23
  const closesTarget = targets?.monthly_closes ?? 4
  const cplTarget = targets?.cpl_target ?? 85
  const costPerMeetingTarget = targets?.cost_per_meeting ?? 600
  const costPerActiveTarget = targets?.cost_per_active ?? 1200
  const showRateTarget = targets?.show_rate ?? 75
  const meetingRateTarget = targets?.meeting_rate ?? 18
  const roasTarget = targets?.roas_target ?? 4
  const formattedSpend = Number(totalSpend).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formattedCpl = Number(cpl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sortedActiveLeads = useMemo(() => {
    return [...(activeLeads ?? [])].sort((a, b) => {
      const aDate = getLeadDateValue(a)?.getTime() ?? 0
      const bDate = getLeadDateValue(b)?.getTime() ?? 0
      return bDate - aDate
    })
  }, [activeLeads])
  const visibleActiveLeads = showAllLeads ? sortedActiveLeads : sortedActiveLeads.slice(0, 10)
  const openLeadTracker = (contactId) => {
    navigate(contactId ? `/lead-tracker?expand=${encodeURIComponent(contactId)}` : '/lead-tracker')
  }

  // Build insights dynamically
  const insights = []
  if (cpl > cplTarget) insights.push({ severity: 'critical', title: `CPL is AED ${formattedCpl} — above AED ${cplTarget} target`, href: '/creative-performance' })
  if (showRate < showRateTarget && showRate > 0) insights.push({ severity: 'warning', title: `Show rate at ${showRate}% — target is ${showRateTarget}%`, href: '/sales-performance' })
  if (activeOpps > 0) insights.push({ severity: 'info', title: `${activeOpps} active opportunities — total value AED ${(overview?.pipeline_value ?? 0).toLocaleString()}`, href: '/revenue' })

  return (
    <div>
      <DailyAISummaryModal />

      <ErrorBoundary>
        <InsightsFeed insights={insights} />
      </ErrorBoundary>

      {overviewError && !overviewLoading && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
          Failed to load Home page KPIs for the selected date range.
        </div>
      )}

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3">Volume</h2>
      <ErrorBoundary>
        {overviewError && !overviewLoading ? (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center mb-6">
            <p className="text-sm text-[#B91C1C]">KPI data is unavailable right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-3 mb-6">
            <KPICard label="Total Spend" value={totalSpend} prefix="AED " inverse={true} loading={overviewLoading} description="What you spent on ads this period" target={spendTarget} />
            <KPICard label="Total Leads" value={totalLeads} loading={overviewLoading} description="People who raised their hand interested in you" target={leadsTarget} />
            <KPICard label="Meetings Booked" value={meetingsBooked} loading={overviewLoading} description="Sales conversations Sarah booked" target={meetingsTarget} />
            <KPICard label="Showed Up" value={showedUp} loading={overviewLoading} description="People who actually attended their meeting" target={showsTarget} />
            <KPICard label="Active Opportunities" value={activeOpps} loading={overviewLoading} description="Leads your sales team is currently working" target={activeOppsTarget} />
            <KPICard label="Closed Won" value={closedWon} loading={overviewLoading} description="New customers who signed and paid" target={closesTarget} />
          </div>
        )}
      </ErrorBoundary>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3">Unit Economics</h2>
      <ErrorBoundary>
        {overviewError && !overviewLoading ? null : (
          <div className="grid grid-cols-6 gap-3 mb-6">
            <KPICard label="Cost per Lead" value={cpl} prefix="AED " inverse={true} loading={overviewLoading} description="What each interested person costs you" target={cplTarget} recommendation="If CPL is above target, pause underperforming ads." />
            <KPICard label="Cost per Meeting" value={costPerMeeting} prefix="AED " inverse={true} loading={overviewLoading} description="What each booked sales conversation costs you" target={costPerMeetingTarget} />
            <KPICard label="Cost per Active Opp" value={costPerActive} prefix="AED " inverse={true} loading={overviewLoading} description="What it costs to get each real engaged buyer" target={costPerActiveTarget} />
            <KPICard label="Show Rate" value={showRate} suffix="%" loading={overviewLoading} description="Out of 10 booked meetings, how many show up" target={showRateTarget} recommendation="Add WhatsApp reminders 24h and 1h before meetings." />
            <KPICard label="Meeting Rate" value={meetingRate} suffix="%" loading={overviewLoading} description="Out of 100 interested people, how many book" target={meetingRateTarget} />
            <KPICard label="ROAS" value={roas} suffix="x" loading={overviewLoading} description="For every AED spent, how many you make back" target={roasTarget} recommendation="Close active opportunities to improve ROAS." />
          </div>
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Pipeline Funnel</h2>
          {overviewError && !overviewLoading ? (
            <p className="text-sm text-[#B91C1C] text-center py-8">Funnel data is unavailable right now.</p>
          ) : (
            <Funnel data={overview} loading={overviewLoading} />
          )}
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Active Leads</h2>
              <p className="text-xs text-[#6B7280]">{sortedActiveLeads.length} leads came in during this period</p>
            </div>
            {sortedActiveLeads.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllLeads(current => !current)}
                className="text-xs font-medium text-[#EC4899] hover:underline"
              >
                {showAllLeads ? 'Show less' : 'Show all'}
              </button>
            )}
          </div>

          {activeLeadsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : activeLeadsError ? (
            <p className="text-sm text-[#B91C1C] text-center py-8">Failed to load active leads. Try refreshing.</p>
          ) : !sortedActiveLeads.length ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">No leads were created during this date range.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className={showAllLeads ? 'max-h-[540px] overflow-y-auto' : 'max-h-[460px] overflow-y-auto'}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-[#E5E7EB]">
                      {['Name', 'Company', 'Source Ad', 'Stage', 'Date', 'Deal Value'].map((heading) => (
                        <th
                          key={heading}
                          className={`text-left text-xs font-semibold text-[#6B7280] pb-2 pr-4 ${heading === 'Company' || heading === 'Deal Value' ? 'hidden md:table-cell' : ''}`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleActiveLeads.map((lead, index) => (
                      <tr
                        key={lead.contact_id}
                        onClick={() => openLeadTracker(lead.contact_id)}
                        className={`border-b border-[#F3F4F6] hover:bg-[#FAFAFA] cursor-pointer ${index % 2 === 1 ? 'bg-[#FCFCFD]' : ''}`}
                      >
                        <td className="py-3 pr-4 font-medium text-[#0F0F1A]">
                          <span className="hover:text-[#EC4899] transition-colors">
                            {lead.full_name || '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[#6B7280] hidden md:table-cell">{lead.company_name || lead.company || '—'}</td>
                        <td className="py-3 pr-4 text-[#6B7280]">{lead.ad_name || lead.source_ad || '—'}</td>
                        <td className="py-3 pr-4"><StatusBadge stage={lead.current_stage} /></td>
                        <td className="py-3 pr-4 text-[#6B7280] whitespace-nowrap">{formatLeadDate(lead)}</td>
                        <td className="py-3 text-[#0F0F1A] font-medium hidden md:table-cell">{lead.deal_value ? `AED ${Number(lead.deal_value).toLocaleString()}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Active Pipeline</h2>
          <p className="text-xs text-[#6B7280] mb-4">{activePipeline?.length ?? 0} leads currently being worked on</p>
          {pipelineLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : pipelineError ? (
            <p className="text-sm text-[#B91C1C] text-center py-8">Failed to load active pipeline. Try refreshing.</p>
          ) : !activePipeline?.length ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">No active pipeline yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  {['Name', 'Company', 'Stage', 'Source Ad', 'Date', 'Deal Value'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-[#6B7280] pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activePipeline.map((lead) => (
                  <tr key={lead.contact_id} className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA] cursor-pointer" onClick={() => openLeadTracker(lead.contact_id)}>
                    <td className="py-3 pr-4 font-medium text-[#0F0F1A]">{lead.full_name}</td>
                    <td className="py-3 pr-4 text-[#6B7280]">{lead.company || '—'}</td>
                    <td className="py-3 pr-4"><StatusBadge stage={lead.current_stage} successTone="red" /></td>
                    <td className="py-3 pr-4 text-[#6B7280]">{lead.ad_name || lead.source_ad || '—'}</td>
                    <td className="py-3 pr-4 text-[#6B7280]">{(lead.ghl_created_at || lead.created_at) ? new Date(lead.ghl_created_at || lead.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 font-medium text-[#0F0F1A]">{lead.deal_value ? `AED ${Number(lead.deal_value).toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ErrorBoundary>
      <AISummary summary={
        `This period you spent AED ${formattedSpend} and generated ${totalLeads} leads at a cost of AED ${formattedCpl} per lead, against a target of AED ${cplTarget}. ` +
        `Sarah booked ${meetingsBooked} meetings, of which ${showedUp} showed up — a show rate of ${showRate}%. ` +
        `${activeOpps} opportunities are currently active in the pipeline with a total value of AED ${(overview?.pipeline_value ?? 0).toLocaleString()}. ` +
        `${closedWon > 0 ? `You closed ${closedWon} deal${closedWon > 1 ? 's' : ''}, generating AED ${closedRevenue.toLocaleString()} in revenue and a ROAS of ${roas}x.` : 'No deals have closed yet this period — focus on progressing active opportunities.'}` +
        (showRate > 0 && showRate < showRateTarget ? ` Show rate is below the ${showRateTarget}% target — consider adding WhatsApp reminders before meetings.` : '')
      } loading={overviewLoading} />
    </div>
  )
}
