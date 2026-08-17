import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboardAdOptions, useDashboardContactsByBucket, useTargets } from '../hooks/useDashboardData'
import { useDashboardOverview, useCfGrowth } from '../hooks/useDashboardOverview'
import { PipelineFlow, Gauge, GrowthChart, Panel } from '../components/ui/Console'
import KPICard from '../components/ui/KPICard'
import InsightsFeed from '../components/ui/InsightsFeed'
import Funnel from '../components/ui/Funnel'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import StatusBadge from '../components/ui/StatusBadge'
import AISummary from '../components/ui/AISummary'
import DailyAISummaryModal from '../components/ui/DailyAISummaryModal'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDashboard } from '../store/dashboard'
import { homeReport } from '../lib/reports/generators'

function getLeadDateValue(lead) {
  return lead?.dubai_date || ''
}

function formatLeadDate(lead) {
  if (!lead?.dubai_date) return '—'

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

function matchesMappedStage(lead, stage) {
  return (lead?.mapped_current_stage ?? lead?.current_stage) === stage
}

function getMetaAdId(lead) {
  const id = lead?.meta_ad_id_raw ?? lead?.meta_ad_id ?? null
  return id ? String(id) : ''
}

function getCreativeAdName(lead, adOptionByMetaId = {}) {
  return adOptionByMetaId[getMetaAdId(lead)]?.ad_name || lead?.ad_name || ''
}

function hasText(value) {
  return value != null && String(value).trim() !== ''
}

function getActiveLeadSource(lead, adOptionByMetaId = {}) {
  const sourceAd = [getCreativeAdName(lead, adOptionByMetaId), lead?.source_ad]
    .find(value => hasText(value) && String(value).trim().toLowerCase() !== 'website')

  if (sourceAd) {
    return { value: String(sourceAd).trim(), label: String(sourceAd).trim(), isWebsite: false }
  }

  return { value: 'website', label: 'Website', isWebsite: true }
}

export default function Overview() {
  const navigate = useNavigate()
  const location = useLocation()
  const dateRange = useDashboard(s => s.dateRange)
  const setReportBuilder = useDashboard(s => s.setReportBuilder)
  const { data: overview, loading: overviewLoading, error: overviewError } = useDashboardOverview(dateRange.from, dateRange.to)
  const { data: targets } = useTargets()
  const { data: activeLeads, loading: activeLeadsLoading, error: activeLeadsError } = useDashboardContactsByBucket('leads')
  const { data: activePipeline, loading: pipelineLoading, error: pipelineError } = useDashboardContactsByBucket('active')
  const { data: adOptions } = useDashboardAdOptions()
  const { data: growth } = useCfGrowth(dateRange.from, dateRange.to)
  const [chartMetric, setChartMetric] = useState('leads')
  const leadsRef = useRef(null)
  const showEveryLead = () => {
    setActiveLeadStageFilter('all')
    setActiveLeadSourceFilter('all')
    setShowAllLeads(true)
    leadsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const [showAllLeads, setShowAllLeads] = useState(false)
  const [activeLeadStageFilter, setActiveLeadStageFilter] = useState('all')
  const [activeLeadSourceFilter, setActiveLeadSourceFilter] = useState('all')
  const reportDataRef = useRef({ overview: null, activePipeline: null })

  useEffect(() => {
    reportDataRef.current = { overview, activePipeline }
  }, [overview, activePipeline])

  useEffect(() => {
    setReportBuilder(() => homeReport(reportDataRef.current.overview, reportDataRef.current.activePipeline))
    return () => setReportBuilder(null)
  }, [setReportBuilder])

  const attributedLeads = overview?.attributed_leads ?? null
  const pct = (n, d) => (!d || n == null ? null : `${((n / d) * 100).toFixed(n / d < 0.1 ? 1 : 0)}%`)
  const step = (n, d, label) => {
    const v = pct(n, d)
    return v ? { value: v, label } : null
  }

  const totalLeads = overview?.total_leads ?? 0
  const meetingsBooked = overview?.meetings_booked ?? 0
  const showedUp = overview?.showed_up ?? 0
  const activeOpps = overview?.active_opportunities ?? 0
  const pipelineValue = overview?.pipeline_value ?? null
  const costPerCustomer = overview?.cost_per_customer ?? null
  const winRate = overview?.win_rate ?? null
  // Migration 158 ships the denominator alongside the rate, because 100% off a
  // single finished deal is what this window actually holds.
  const winRateN = overview?.win_rate_n ?? null
  const winRateAll = overview?.win_rate_alltime ?? null
  const windowDays = overview?.window_days ?? null
  const closedWon = overview?.closed_won ?? 0
  const totalSpend = overview?.total_spend ?? 0
  const closedRevenue = overview?.closed_revenue ?? 0
  const cpl = overview?.cost_per_lead ?? 0
  const costPerMeeting = overview?.cost_per_meeting ?? 0
  const costPerSale = closedWon > 0 ? totalSpend / closedWon : 0
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
  const pipelineTarget = targets?.pipeline_value ?? 200000
  const costPerCustomerTarget = targets?.cost_per_customer ?? 2500
  const winRateTarget = targets?.win_rate ?? 30
  const formattedSpend = Number(totalSpend).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formattedCpl = Number(cpl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formattedCostPerMeeting = Number(costPerMeeting).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formattedCostPerSale = Number(costPerSale).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formattedClosedRevenue = Number(closedRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })
  const adOptionByMetaId = useMemo(
    () => Object.fromEntries((adOptions ?? []).filter(ad => ad.meta_ad_id).map(ad => [ad.meta_ad_id, ad])),
    [adOptions]
  )
  const sortedActiveLeads = useMemo(() => {
    return [...(activeLeads ?? [])].sort((a, b) => {
      return getLeadDateValue(b).localeCompare(getLeadDateValue(a))
    })
  }, [activeLeads])
  const activeLeadSourceOptions = useMemo(() => {
    const adNames = new Set()

    for (const lead of sortedActiveLeads) {
      const source = getActiveLeadSource(lead, adOptionByMetaId)
      if (!source.isWebsite) adNames.add(source.value)
    }

    return [
      { value: 'all', label: 'All Sources' },
      { value: 'website', label: 'Website' },
      ...[...adNames].sort((a, b) => a.localeCompare(b)).map(name => ({ value: name, label: name })),
    ]
  }, [adOptionByMetaId, sortedActiveLeads])
  const sourceFilteredActiveLeads = useMemo(() => {
    if (activeLeadSourceFilter === 'all') return sortedActiveLeads

    return sortedActiveLeads.filter(lead => {
      const source = getActiveLeadSource(lead, adOptionByMetaId)
      return activeLeadSourceFilter === 'website'
        ? source.isWebsite
        : source.value === activeLeadSourceFilter
    })
  }, [activeLeadSourceFilter, adOptionByMetaId, sortedActiveLeads])
  const activeLeadStageCounts = useMemo(() => {
    return ACTIVE_LEAD_STAGE_FILTERS.reduce((counts, filter) => {
      counts[filter.id] = filter.id === 'all'
        ? sourceFilteredActiveLeads.length
        : sourceFilteredActiveLeads.filter(lead => matchesMappedStage(lead, filter.id)).length
      return counts
    }, {})
  }, [sourceFilteredActiveLeads])
  const filteredActiveLeads = useMemo(() => {
    if (activeLeadStageFilter === 'all') return sourceFilteredActiveLeads
    return sourceFilteredActiveLeads.filter(lead => matchesMappedStage(lead, activeLeadStageFilter))
  }, [activeLeadStageFilter, sourceFilteredActiveLeads])
  const visibleActiveLeads = showAllLeads ? filteredActiveLeads : filteredActiveLeads.slice(0, 10)
  const handleActiveLeadStageFilter = (stageId) => {
    setActiveLeadStageFilter(stageId)
    setShowAllLeads(false)
  }
  const handleActiveLeadSourceFilter = (source) => {
    setActiveLeadSourceFilter(source)
    setShowAllLeads(false)
  }
  const openLeadTracker = (contactId) => {
    const params = new URLSearchParams(location.search)
    if (contactId) params.set('expand', contactId)
    navigate({ pathname: '/lead-tracker', search: params.toString() ? `?${params.toString()}` : '' })
  }

  // Build insights dynamically
  const insights = []
  if (cpl > cplTarget) insights.push({ severity: 'critical', title: `CPL is AED ${formattedCpl} — above AED ${cplTarget} target`, href: '/creative-performance' })
  if (showRate < showRateTarget && showRate > 0) insights.push({ severity: 'warning', title: `Show rate at ${showRate}% — target is ${showRateTarget}%`, href: '/sales-performance' })
  if (activeOpps > 0) insights.push({ severity: 'info', title: `${activeOpps} active opportunities — total value AED ${(overview?.pipeline_value ?? 0).toLocaleString()}`, href: '/revenue' })

  return (
    // Everything Home renders sits inside the console, so the light components
    // it already uses (funnel, active leads, insights) inherit the dark ground
    // from the scoped overrides in index.css rather than being rewritten.
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

      {/* The five stages and the four ratios between them. Every card that used
          to sit here was one of those nine, cut out of the sequence it belongs
          to and laid in a grid. */}
      <ErrorBoundary>
        {overviewError && !overviewLoading ? (
          <div className="cf-panel mb-5 text-center">
            <p className="text-sm text-[#F43F5E]">KPI data is unavailable right now.</p>
          </div>
        ) : (
          <div className="mb-5">
            <div className="cf-eyebrow mb-2.5">The pipeline · {windowDays} days</div>
            <PipelineFlow kpis={overview} growth={growth} onShowLeads={showEveryLead} />
          </div>
        )}
      </ErrorBoundary>

      {/* Efficiency. Radial rather than numeric because the question is always
          "how close to target", and an arc answers that without arithmetic. */}
      <ErrorBoundary>
        {overviewError && !overviewLoading ? null : (
          <Panel eyebrow="Unit economics" title="Are the ads paying for themselves?"
                 right={<span className="text-[11px] text-[#57544E]">hover a dial for its definition</span>}>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
              <Gauge label="Cost / lead"
                     display={cpl ? `${Math.round(cpl)}` : '—'}
                     pct={cpl ? Math.min(100, (cplTarget / cpl) * 100) : null}
                     tone={cpl && cpl <= cplTarget ? '#10B981' : '#F43F5E'}
                     hint="Ad spend divided by the leads those ads produced. Lower is better."
                     footnote={`AED · target ${cplTarget}`} />
              <Gauge label="Cost / meeting"
                     display={costPerMeeting ? `${Math.round(costPerMeeting)}` : '—'}
                     pct={costPerMeeting ? Math.min(100, (costPerMeetingTarget / costPerMeeting) * 100) : null}
                     tone={costPerMeeting && costPerMeeting <= costPerMeetingTarget ? '#10B981' : '#F43F5E'}
                     hint="What each booked sales conversation costs you. Lower is better."
                     footnote={`AED · target ${costPerMeetingTarget}`} />
              <Gauge label="Cost / customer"
                     display={costPerCustomer ? `${Math.round(costPerCustomer)}` : '—'}
                     pct={costPerCustomer ? Math.min(100, (costPerCustomerTarget / costPerCustomer) * 100) : null}
                     tone={costPerCustomer && costPerCustomer <= costPerCustomerTarget ? '#10B981' : '#F43F5E'}
                     hint="Ad spend divided by the customers who signed and paid. Lower is better."
                     footnote={`AED · target ${costPerCustomerTarget}`} />
              <Gauge label="Win rate"
                     display={winRate == null ? '—' : `${winRate}%`}
                     pct={winRate == null ? null : Math.min(100, (winRate / winRateTarget) * 100)}
                     tone={winRate != null && winRate >= winRateTarget ? '#10B981' : '#F59E0B'}
                     hint="Of the deals that finished in this range, how many you won. Open deals are excluded."
                     /* The denominator travels with the rate. 100% off one deal
                        and 100% off forty are the same number, not the same
                        fact — and this window holds exactly one. */
                     footnote={winRateN != null
                       ? `${winRateN} deal${winRateN === 1 ? '' : 's'} finished · ${winRateAll}% all-time`
                       : `target ${winRateTarget}%`} />
              <Gauge label="ROAS"
                     display={roas ? `${Number(roas).toFixed(1)}x` : '—'}
                     pct={roas ? Math.min(100, (roas / roasTarget) * 100) : null}
                     tone={roas && roas >= roasTarget ? '#10B981' : '#F59E0B'}
                     hint="For every AED spent, how many you make back."
                     footnote={`target ${roasTarget}x`} />
            </div>
          </Panel>
        )}
      </ErrorBoundary>

      {/* Direction. Twelve numbers and no trend was the gap — a single instant
          cannot say whether this is the best week or the worst. */}
      <ErrorBoundary>
        <div className="mt-5">
          <Panel>
            <GrowthChart growth={growth} metric={chartMetric} onMetric={setChartMetric} />
          </Panel>
        </div>
      </ErrorBoundary>
      <div className="h-5" />

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
        <div ref={leadsRef} className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6 scroll-mt-20">
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
            <div className="mb-4 flex flex-col gap-3">
              <label className="flex w-full flex-col gap-1 text-xs font-semibold text-[#6B7280] sm:w-72">
                Source
                <select
                  value={activeLeadSourceFilter}
                  onChange={event => handleActiveLeadSourceFilter(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-[#0F0F1A] bg-[#0F0F1A] px-3 py-2 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#1F2937] focus:ring-2 focus:ring-pink-100"
                >
                  {activeLeadSourceOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-2 flex-wrap">
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
            </div>
          )}

          {activeLeadsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : activeLeadsError ? (
            <p className="text-sm text-[#B91C1C] text-center py-8">Failed to load active leads. Try refreshing.</p>
          ) : !sortedActiveLeads.length ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">No leads were created during this date range.</p>
          ) : !filteredActiveLeads.length ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">No leads match these filters.</p>
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
                    {visibleActiveLeads.map((lead, index) => {
                      const source = getActiveLeadSource(lead, adOptionByMetaId)

                      return (
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
                          <td className={`py-3 pr-4 ${source.isWebsite ? 'text-[#9CA3AF]' : 'text-[#0F0F1A] font-medium'}`}>{source.label}</td>
                          <td className="py-3 pr-4"><StatusBadge stage={lead.mapped_current_stage ?? lead.current_stage} label={lead.stage_name || lead.mapped_current_stage || 'Unknown'} /></td>
                          <td className="py-3 pr-4 text-[#6B7280] whitespace-nowrap">{formatLeadDate(lead)}</td>
                          <td className="py-3 text-[#0F0F1A] font-medium hidden md:table-cell">{lead.deal_value ? `AED ${Number(lead.deal_value).toLocaleString()}` : '—'}</td>
                        </tr>
                      )
                    })}
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
                    <td className="py-3 pr-4"><StatusBadge stage={lead.current_stage} label={lead.stage_name || 'Unknown'} successTone="red" /></td>
                    <td className="py-3 pr-4 text-[#6B7280]">{getCreativeAdName(lead, adOptionByMetaId) || '—'}</td>
                    <td className="py-3 pr-4 text-[#6B7280]">{formatLeadDate(lead)}</td>
                    <td className="py-3 font-medium text-[#0F0F1A]">{lead.deal_value ? `AED ${Number(lead.deal_value).toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ErrorBoundary>
      <AISummary summary={
        `This period you spent AED ${formattedSpend} and generated ${totalLeads} leads at a cost of AED ${formattedCpl} per lead, AED ${formattedCostPerMeeting} per meeting, and AED ${formattedCostPerSale} per sale. ` +
        `Sarah booked ${meetingsBooked} meetings, of which ${showedUp} showed up — a meeting rate of ${Number(meetingRate).toFixed(2)}% and a show rate of ${Number(showRate).toFixed(1)}%. ` +
        `${activeOpps} opportunities are currently active in the pipeline with a total value of AED ${(overview?.pipeline_value ?? 0).toLocaleString()}. ` +
        `${closedWon > 0 ? `You closed ${closedWon} deal${closedWon > 1 ? 's' : ''}, generating AED ${formattedClosedRevenue} in revenue and a ROAS of ${Number(roas).toFixed(2)}x.` : 'No deals have closed yet this period — focus on progressing active opportunities.'}` +
        (showRate > 0 && showRate < showRateTarget ? ` Show rate is below the ${showRateTarget}% target — consider adding WhatsApp reminders before meetings.` : '')
      } loading={overviewLoading} />
    </div>
  )
}
