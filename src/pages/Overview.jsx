import { useEffect } from 'react'
import { useContactDetails, useTargets } from '../hooks/useDashboardData'
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

export default function Overview() {
  const navigate = useNavigate()
  const dateRange = useDashboard(s => s.dateRange)
  const setReportBuilder = useDashboard(s => s.setReportBuilder)
  const { data: overview, loading: overviewLoading } = useDashboardOverview(dateRange.from, dateRange.to)
  const { data: targets } = useTargets()
  const { data: activePipeline, loading: pipelineLoading } = useContactDetails(['showed', 'active'])

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
  const cplTarget = targets?.cpl_target ?? 85
  const costPerMeetingTarget = targets?.cost_per_meeting ?? 600
  const costPerActiveTarget = targets?.cost_per_active ?? 1200
  const showRateTarget = targets?.show_rate ?? 75
  const meetingRateTarget = targets?.meeting_rate ?? 18
  const roasTarget = targets?.roas_target ?? 4
  const formattedSpend = Number(totalSpend).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formattedCpl = Number(cpl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3">Volume</h2>
      <ErrorBoundary>
        <div className="grid grid-cols-6 gap-3 mb-6">
          <KPICard label="Total Spend" value={totalSpend} prefix="AED " inverse={true} loading={overviewLoading} description="What you spent on ads this period" />
          <KPICard label="Total Leads" value={totalLeads} loading={overviewLoading} description="People who raised their hand interested in you" />
          <KPICard label="Meetings Booked" value={meetingsBooked} loading={overviewLoading} description="Sales conversations Sarah booked" />
          <KPICard label="Showed Up" value={showedUp} loading={overviewLoading} description="People who actually attended their meeting" />
          <KPICard label="Active Opportunities" value={activeOpps} loading={overviewLoading} description="Leads your sales team is currently working" />
          <KPICard label="Closed Won" value={closedWon} loading={overviewLoading} description="New customers who signed and paid" />
        </div>
      </ErrorBoundary>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3">Unit Economics</h2>
      <ErrorBoundary>
        <div className="grid grid-cols-6 gap-3 mb-6">
          <KPICard label="Cost per Lead" value={cpl} prefix="AED " inverse={true} loading={overviewLoading} description="What each interested person costs you" target={cplTarget} recommendation="If CPL is above target, pause underperforming ads." />
          <KPICard label="Cost per Meeting" value={costPerMeeting} prefix="AED " inverse={true} loading={overviewLoading} description="What each booked sales conversation costs you" target={costPerMeetingTarget} />
          <KPICard label="Cost per Active Opp" value={costPerActive} prefix="AED " inverse={true} loading={overviewLoading} description="What it costs to get each real engaged buyer" target={costPerActiveTarget} />
          <KPICard label="Show Rate" value={showRate} suffix="%" loading={overviewLoading} description="Out of 10 booked meetings, how many show up" target={showRateTarget} recommendation="Add WhatsApp reminders 24h and 1h before meetings." />
          <KPICard label="Meeting Rate" value={meetingRate} suffix="%" loading={overviewLoading} description="Out of 100 interested people, how many book" target={meetingRateTarget} />
          <KPICard label="ROAS" value={roas} suffix="x" loading={overviewLoading} description="For every AED spent, how many you make back" target={roasTarget} recommendation="Close active opportunities to improve ROAS." />
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Pipeline Funnel</h2>
          <Funnel data={overview} loading={overviewLoading} />
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Active Pipeline</h2>
          <p className="text-xs text-[#6B7280] mb-4">{activePipeline?.length ?? 0} leads currently being worked on</p>
          {pipelineLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
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
                  <tr key={lead.contact_id} className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA] cursor-pointer" onClick={() => navigate('/lead-tracker')}>
                    <td className="py-3 pr-4 font-medium text-[#0F0F1A]">{lead.full_name}</td>
                    <td className="py-3 pr-4 text-[#6B7280]">{lead.company || '—'}</td>
                    <td className="py-3 pr-4"><StatusBadge stage={lead.current_stage} successTone="red" /></td>
                    <td className="py-3 pr-4 text-[#6B7280]">{lead.source_ad || '—'}</td>
                    <td className="py-3 pr-4 text-[#6B7280]">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}</td>
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
