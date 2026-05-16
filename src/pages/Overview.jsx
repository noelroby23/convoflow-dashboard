import { useEffect, useMemo, useState } from 'react'
import { useAllContacts, usePipelineState, useTargets } from '../hooks/useDashboardData'
import { useDashboardOverview } from '../hooks/useDashboardOverview'
import KPICard from '../components/ui/KPICard'
import InsightsFeed from '../components/ui/InsightsFeed'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import StatusBadge from '../components/ui/StatusBadge'
import AISummary from '../components/ui/AISummary'
import DailyAISummaryModal from '../components/ui/DailyAISummaryModal'
import PipelineStageTable from '../components/ui/PipelineStageTable'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../store/dashboard'
import { homeReport } from '../lib/reports/generators'

function getLeadDateValue(lead) {
  return lead?.dubai_date || ''
}

function formatLeadDate(lead) {
  if (!lead?.dubai_date) return '-'

  const [year, month, day] = lead.dubai_date.split('-')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[Number(month) - 1]} ${Number(day)}, ${year}`
}

const ACTIVE_LEAD_STAGE_FILTERS = [
  { id: 'all', label: 'All', color: 'text-[#6B7280] bg-white border-[#E5E7EB]' },
  { id: 'follow_up', label: 'Follow Up', color: 'text-[#D97706] bg-amber-50 border-amber-200' },
  { id: 'wa_chatbot', label: 'WA - Chatbot', color: 'text-[#2563EB] bg-blue-50 border-blue-200' },
  { id: 'meeting_booked', label: 'Meeting Booked', color: 'text-[#16A34A] bg-green-50 border-green-200' },
  { id: 'showed', label: 'Show', color: 'text-[#16A34A] bg-green-50 border-green-200' },
  { id: 'no_show', label: 'No Show', color: 'text-[#F59E0B] bg-amber-50 border-amber-200' },
  { id: 'not_interested', label: 'Not Interested', color: 'text-[#DC2626] bg-red-50 border-red-200' },
  { id: 'disqualified', label: 'Disqualified', color: 'text-[#DC2626] bg-red-50 border-red-200' },
  { id: 'wrong_number', label: 'Wrong Number', color: 'text-[#6B7280] bg-gray-50 border-gray-200' },
]

export default function Overview() {
  const navigate = useNavigate()
  const dateRange = useDashboard(s => s.dateRange)
  const setReportBuilder = useDashboard(s => s.setReportBuilder)
  const { data: overview, loading: overviewLoading, error: overviewError } = useDashboardOverview(dateRange.from, dateRange.to)
  const { data: targets } = useTargets()
  const { data: activeLeads, loading: activeLeadsLoading, error: activeLeadsError } = useAllContacts()
  const { data: pipelineStages, loading: pipelineStagesLoading, error: pipelineStagesError } = usePipelineState()
  const [showAllLeads, setShowAllLeads] = useState(false)
  const [activeLeadStageFilter, setActiveLeadStageFilter] = useState('all')

  useEffect(() => {
    setReportBuilder(() => homeReport(overview, []))
    return () => setReportBuilder(null)
  }, [overview, setReportBuilder])

  const totalLeads = overview?.total_leads ?? 0
  const meetingsBooked = overview?.meetings_booked ?? 0
  const totalSpend = overview?.total_spend ?? 0
  const cpl = overview?.cost_per_lead ?? 0
  const spendTarget = targets?.monthly_spend ?? 33000
  const leadsTarget = targets?.monthly_leads ?? 100
  const meetingsTarget = targets?.monthly_meetings ?? 30
  const cplTarget = targets?.cpl_target ?? 85
  const formattedSpend = Number(totalSpend).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formattedCpl = Number(cpl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sortedActiveLeads = useMemo(() => {
    return [...(activeLeads ?? [])].sort((a, b) => {
      return getLeadDateValue(b).localeCompare(getLeadDateValue(a))
    })
  }, [activeLeads])
  const activeLeadStageCounts = useMemo(() => {
    return ACTIVE_LEAD_STAGE_FILTERS.reduce((counts, filter) => {
      counts[filter.id] = filter.id === 'all'
        ? sortedActiveLeads.length
        : sortedActiveLeads.filter(lead => lead.current_stage === filter.id).length
      return counts
    }, {})
  }, [sortedActiveLeads])
  const filteredActiveLeads = useMemo(() => {
    if (activeLeadStageFilter === 'all') return sortedActiveLeads
    return sortedActiveLeads.filter(lead => lead.current_stage === activeLeadStageFilter)
  }, [activeLeadStageFilter, sortedActiveLeads])
  const visibleActiveLeads = showAllLeads ? filteredActiveLeads : filteredActiveLeads.slice(0, 10)
  const handleActiveLeadStageFilter = (stageId) => {
    setActiveLeadStageFilter(stageId)
    setShowAllLeads(false)
  }
  const openLeadTracker = (contactId) => {
    navigate(contactId ? `/lead-tracker?expand=${encodeURIComponent(contactId)}` : '/lead-tracker')
  }
  const openPipelineStage = ({ pipelineId, stageId }) => {
    navigate(`/lead-tracker?pipeline=${encodeURIComponent(pipelineId)}&stage=${encodeURIComponent(stageId)}`)
  }

  // Build insights dynamically
  const insights = []
  if (cpl > cplTarget) insights.push({ severity: 'critical', title: `CPL is AED ${formattedCpl}, above AED ${cplTarget} target`, href: '/creative-performance' })

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

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3">Performance</h2>
      <ErrorBoundary>
        {overviewError && !overviewLoading ? (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center mb-6">
            <p className="text-sm text-[#B91C1C]">KPI data is unavailable right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            <KPICard label="Total Leads" value={totalLeads} loading={overviewLoading} description="People who raised their hand interested in you" target={leadsTarget} />
            <KPICard label="Total Spend" value={totalSpend} prefix="AED " inverse={true} loading={overviewLoading} description="What you spent on ads this period" target={spendTarget} />
            <KPICard label="Cost per Lead" value={cpl} prefix="AED " inverse={true} loading={overviewLoading} description="What each interested person costs you" target={cplTarget} recommendation="If CPL is above target, pause underperforming ads." />
            <KPICard label="Meetings Booked" value={meetingsBooked} loading={overviewLoading} description="Sales conversations Sarah booked" target={meetingsTarget} />
          </div>
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        <PipelineStageTable rows={pipelineStages} loading={pipelineStagesLoading} error={pipelineStagesError} onStageClick={openPipelineStage} />
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Active Leads</h2>
              <p className="text-xs text-[#6B7280]">{filteredActiveLeads.length} of {sortedActiveLeads.length} leads shown for this period</p>
            </div>
            {filteredActiveLeads.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllLeads(current => !current)}
                className="text-xs font-medium text-[#EC4899] hover:underline"
              >
                {showAllLeads ? 'Show less' : 'Show all'}
              </button>
            )}
          </div>

          {!activeLeadsLoading && !activeLeadsError && sortedActiveLeads.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {ACTIVE_LEAD_STAGE_FILTERS.map(filter => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => handleActiveLeadStageFilter(filter.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter.color} ${activeLeadStageFilter === filter.id ? 'shadow-sm ring-2 ring-offset-1 ring-current opacity-100' : 'opacity-70 hover:opacity-100'}`}
                >
                  {filter.label}
                  <span className="ml-0.5 bg-current bg-opacity-20 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                    {activeLeadStageCounts[filter.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}

          {activeLeadsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : activeLeadsError ? (
            <p className="text-sm text-[#B91C1C] text-center py-8">Failed to load active leads. Try refreshing.</p>
          ) : !sortedActiveLeads.length ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">No leads were created during this date range.</p>
          ) : !filteredActiveLeads.length ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">No leads match this stage filter.</p>
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
                            {lead.full_name || '-'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[#6B7280] hidden md:table-cell">{lead.company_name || lead.company || '-'}</td>
                        <td className="py-3 pr-4 text-[#6B7280]">{lead.ad_name || lead.source_ad || '-'}</td>
                        <td className="py-3 pr-4"><StatusBadge stage={lead.current_stage} /></td>
                        <td className="py-3 pr-4 text-[#6B7280] whitespace-nowrap">{formatLeadDate(lead)}</td>
                        <td className="py-3 text-[#0F0F1A] font-medium hidden md:table-cell">{lead.deal_value ? `AED ${Number(lead.deal_value).toLocaleString()}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>

      <AISummary summary={
        `This period you spent AED ${formattedSpend} and generated ${totalLeads} leads at a cost of AED ${formattedCpl} per lead, against a target of AED ${cplTarget}. ` +
        `Sarah booked ${meetingsBooked} meetings in the selected period. ` +
        'Use the pipeline stage table to see exactly where current opportunities sit by CRM stage.'
      } loading={overviewLoading} />
    </div>
  )
}
