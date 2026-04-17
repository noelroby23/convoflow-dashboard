import { useFunnelByDate, useContactDetails } from '../hooks/useDashboardData'
import KPICard from '../components/ui/KPICard'
import InsightsFeed from '../components/ui/InsightsFeed'
import Funnel from '../components/ui/Funnel'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import StatusBadge from '../components/ui/StatusBadge'
import { useNavigate } from 'react-router-dom'

export default function Overview() {
  const navigate = useNavigate()
  const { data: funnel, loading: funnelLoading } = useFunnelByDate()
  const { data: activePipeline, loading: pipelineLoading } = useContactDetails(['active', 'proposal_sent', 'follow_up_meeting', 'meeting_booked'])

  // Derived calculations
  const totalLeads = funnel?.total_leads ?? 0
  const meetingsBooked = funnel?.meetings_booked ?? 0
  const showedUp = funnel?.showed_up ?? 0
  const activeOpps = funnel?.active_opportunities ?? 0
  const closedWon = funnel?.closed_won ?? 0
  const totalSpend = funnel?.total_spend ?? 0
  const closedRevenue = funnel?.closed_revenue ?? 0

  const cpl = totalLeads > 0 ? +(totalSpend / totalLeads).toFixed(1) : 0
  const costPerMeeting = meetingsBooked > 0 ? +(totalSpend / meetingsBooked).toFixed(1) : 0
  const costPerActive = activeOpps > 0 ? +(totalSpend / activeOpps).toFixed(1) : 0
  const showRate = (meetingsBooked > 0) ? +((showedUp / meetingsBooked) * 100).toFixed(1) : 0
  const meetingRate = (totalLeads > 0) ? +((meetingsBooked / totalLeads) * 100).toFixed(1) : 0
  const roas = totalSpend > 0 ? +(closedRevenue / totalSpend).toFixed(1) : 0

  // Build insights dynamically
  const insights = []
  if (cpl > 85) insights.push({ severity: 'critical', title: `CPL is AED ${cpl} — above AED 85 target`, href: '/creative-performance' })
  if (showRate < 75 && showRate > 0) insights.push({ severity: 'warning', title: `Show rate at ${showRate}% — target is 75%`, href: '/sales-performance' })
  if (activeOpps > 0) insights.push({ severity: 'info', title: `${activeOpps} active opportunities — total value AED ${(funnel?.pipeline_value ?? 0).toLocaleString()}`, href: '/revenue' })

  return (
    <div>
      <ErrorBoundary>
        <InsightsFeed insights={insights} />
      </ErrorBoundary>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3">Volume</h2>
      <ErrorBoundary>
        <div className="grid grid-cols-6 gap-3 mb-6">
          <KPICard label="Total Spend" value={totalSpend} prefix="AED " inverse={true} loading={funnelLoading} description="What you spent on ads this period" />
          <KPICard label="Total Leads" value={totalLeads} loading={funnelLoading} description="People who raised their hand interested in you" />
          <KPICard label="Meetings Booked" value={meetingsBooked} loading={funnelLoading} description="Sales conversations Sarah booked" />
          <KPICard label="Showed Up" value={showedUp} loading={funnelLoading} description="People who actually attended their meeting" />
          <KPICard label="Active Opportunities" value={activeOpps} loading={funnelLoading} description="Leads your sales team is currently working" />
          <KPICard label="Closed Won" value={closedWon} loading={funnelLoading} description="New customers who signed and paid" />
        </div>
      </ErrorBoundary>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3">Unit Economics</h2>
      <ErrorBoundary>
        <div className="grid grid-cols-6 gap-3 mb-6">
          <KPICard label="Cost per Lead" value={cpl} prefix="AED " inverse={true} loading={funnelLoading} description="What each interested person costs you" target={85} recommendation="If CPL is above target, pause underperforming ads." />
          <KPICard label="Cost per Meeting" value={costPerMeeting} prefix="AED " inverse={true} loading={funnelLoading} description="What each booked sales conversation costs you" target={600} />
          <KPICard label="Cost per Active Opp" value={costPerActive} prefix="AED " inverse={true} loading={funnelLoading} description="What it costs to get each real engaged buyer" target={1200} />
          <KPICard label="Show Rate" value={showRate} suffix="%" loading={funnelLoading} description="Out of 10 booked meetings, how many show up" target={75} recommendation="Add WhatsApp reminders 24h and 1h before meetings." />
          <KPICard label="Meeting Rate" value={meetingRate} suffix="%" loading={funnelLoading} description="Out of 100 interested people, how many book" target={18} />
          <KPICard label="ROAS" value={roas} suffix="x" loading={funnelLoading} description="For every AED spent, how many you make back" target={4} recommendation="Close active opportunities to improve ROAS." />
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Pipeline Funnel</h2>
          <Funnel data={funnel} loading={funnelLoading} />
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
                    <td className="py-3 pr-4"><StatusBadge stage={lead.current_stage} /></td>
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
    </div>
  )
}
