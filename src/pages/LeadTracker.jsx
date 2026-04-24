import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLeadTrackerContacts } from '../hooks/useDashboardData'
import { useDashboard } from '../store/dashboard'
import { leadsReport } from '../lib/reports/generators'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { ChevronDown, ChevronUp, Search, Download, Layers, Megaphone, Flame, FileText, Volume2, MessageSquare } from 'lucide-react'
import { exportCsv } from '../lib/exportCsv'
import AISummary from '../components/ui/AISummary'

const formatStage = (s) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : ''

// Priority: derived from stage + quality score
function getPriority(contact) {
  const stage = contact.current_stage
  const score = contact.lead_quality_score ?? 0

  if (['active', 'meeting_booked', 'showed'].includes(stage) && score >= 7) return 'immediate'
  if (['meeting_booked', 'callback', 'qualified_no_meeting'].includes(stage)) return 'immediate'
  if (score >= 7) return 'hot'
  if (score >= 4) return 'warm'
  return 'cold'
}

const PRIORITY_CONFIG = {
  immediate: { label: '🚨 Immediate', color: 'bg-red-100 text-red-700 border-red-200' },
  hot:       { label: '🔥 Hot',       color: 'bg-orange-100 text-orange-700 border-orange-200' },
  warm:      { label: '🌤 Warm',      color: 'bg-amber-100 text-amber-700 border-amber-200' },
  cold:      { label: '❄️ Cold',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
}

const PRIORITY_ORDER = { immediate: 0, hot: 1, warm: 2, cold: 3 }

const PRIORITY_FILTERS = [
  { id: 'all',       label: 'All Leads' },
  { id: 'immediate', label: '🚨 Immediate Action' },
  { id: 'hot',       label: '🔥 Hot' },
  { id: 'warm',      label: '🌤 Warm' },
  { id: 'cold',      label: '❄️ Cold' },
]

const STAGE_FILTERS = [
  { id: 'all', label: 'All Stages' },
  { id: 'new', label: 'New' },
  { id: 'follow_up', label: 'Follow Up' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'callback', label: 'Callback' },
  { id: 'qualified_no_meeting', label: 'Qualified No Meeting' },
  { id: 'meeting_booked', label: 'Meeting Booked' },
  { id: 'no_show', label: 'No Show' },
  { id: 'not_interested', label: 'Not Interested' },
  { id: 'disqualified', label: 'Disqualified' },
  { id: 'wrong_number', label: 'Wrong Number' },
  { id: 'showed', label: 'Showed Up' },
  { id: 'active', label: 'Active Opportunities' },
  { id: 'closed_won', label: 'Closed Won' },
  { id: 'closed_lost', label: 'Closed Lost' },
]

const KNOWN_STAGE_VALUES = new Set(STAGE_FILTERS.filter(stage => stage.id !== 'all').map(stage => stage.id))

const hasText = (value) => typeof value === 'string' && value.trim().length > 0

function applyFunnelFilter(data, filter) {
  if (filter === 'all') return data
  return data.filter(c => c.current_stage === filter)
}

function getStageCounts(data) {
  return {
    all: data.length,
    new: data.filter(c => c.current_stage === 'new').length,
    follow_up: data.filter(c => c.current_stage === 'follow_up').length,
    contacted: data.filter(c => c.current_stage === 'contacted').length,
    callback: data.filter(c => c.current_stage === 'callback').length,
    qualified_no_meeting: data.filter(c => c.current_stage === 'qualified_no_meeting').length,
    meeting_booked: data.filter(c => c.current_stage === 'meeting_booked').length,
    no_show: data.filter(c => c.current_stage === 'no_show').length,
    not_interested: data.filter(c => c.current_stage === 'not_interested').length,
    disqualified: data.filter(c => c.current_stage === 'disqualified').length,
    wrong_number: data.filter(c => c.current_stage === 'wrong_number').length,
    showed: data.filter(c => c.current_stage === 'showed').length,
    active: data.filter(c => c.current_stage === 'active').length,
    closed_won: data.filter(c => c.current_stage === 'closed_won').length,
    closed_lost: data.filter(c => c.current_stage === 'closed_lost').length,
  }
}

export default function LeadTracker() {
  const { data: contacts, loading } = useLeadTrackerContacts()
  const [searchParams, setSearchParams] = useSearchParams()
  const stageFromUrl = searchParams.get('stage')
  const setReportBuilder = useDashboard(s => s.setReportBuilder)
  const [expandedId, setExpandedId] = useState(null)
  const [stageFilter, setStageFilter] = useState('all')
  const [adFilter, setAdFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortByPriority, setSortByPriority] = useState(false)

  useEffect(() => {
    setReportBuilder(() => leadsReport(contacts))
    return () => setReportBuilder(null)
  }, [contacts, setReportBuilder])

  useEffect(() => {
    if (stageFromUrl && KNOWN_STAGE_VALUES.has(stageFromUrl)) {
      setStageFilter(stageFromUrl)
      return
    }

    setStageFilter('all')
  }, [stageFromUrl])

  const handleStageFilterChange = (selectedStage) => {
    setStageFilter(selectedStage)

    if (selectedStage === 'all') {
      setSearchParams({})
      return
    }

    setSearchParams({ stage: selectedStage })
  }

  const uniqueAds = contacts ? [...new Set(contacts.map(c => c.ad_name || c.source_ad).filter(Boolean))] : []
  const stageCounts = contacts ? getStageCounts(contacts) : {}

  let filtered = applyFunnelFilter(contacts ?? [], stageFilter).filter(c => {
    const matchAd = adFilter === 'all' || (c.ad_name || c.source_ad) === adFilter
    const matchPriority = priorityFilter === 'all' || getPriority(c) === priorityFilter
    const matchSearch = !search || [c.full_name, c.email, c.company, c.phone].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    return matchAd && matchPriority && matchSearch
  })

  if (sortByPriority) {
    filtered = [...filtered].sort((a, b) => PRIORITY_ORDER[getPriority(a)] - PRIORITY_ORDER[getPriority(b)])
  }

  // Priority counts for badges
  const priorityCounts = contacts ? PRIORITY_FILTERS.reduce((acc, f) => {
    acc[f.id] = f.id === 'all' ? contacts.length : contacts.filter(c => getPriority(c) === f.id).length
    return acc
  }, {}) : {}

  return (
    <>
    <ErrorBoundary>
      {/* Priority filter chips */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {PRIORITY_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setPriorityFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              priorityFilter === f.id
                ? f.id === 'immediate' ? 'bg-red-100 text-red-700 border-red-300 shadow-sm ring-2 ring-red-200'
                : f.id === 'hot' ? 'bg-orange-100 text-orange-700 border-orange-300 shadow-sm ring-2 ring-orange-200'
                : f.id === 'warm' ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm ring-2 ring-amber-200'
                : f.id === 'cold' ? 'bg-blue-100 text-blue-700 border-blue-300 shadow-sm ring-2 ring-blue-200'
                : 'bg-[#F3F4F6] text-[#333333] border-[#E5E7EB] shadow-sm'
                : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            {f.label}
            {priorityCounts[f.id] != null && (
              <span className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-current bg-opacity-10">
                {priorityCounts[f.id]}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setSortByPriority(p => !p)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${sortByPriority ? 'bg-pink-50 text-[#EC4899] border-pink-200' : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F3F4F6]'}`}
        >
          <Flame size={12} />
          Sort by Priority
        </button>
      </div>

      {/* Standard filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, company..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#EC4899]"
          />
        </div>
        <div className="relative">
          <Layers size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${stageFilter !== 'all' ? 'text-[#EC4899]' : 'text-[#9CA3AF]'}`} />
          <ChevronDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${stageFilter !== 'all' ? 'text-[#EC4899]' : 'text-[#6B7280]'}`} />
          <select value={stageFilter} onChange={e => handleStageFilterChange(e.target.value)}
            className={`appearance-none text-sm font-medium rounded-lg pl-9 pr-8 py-2 cursor-pointer transition-all focus:outline-none ${stageFilter !== 'all' ? 'border border-[#EC4899] bg-pink-50 text-[#EC4899]' : 'border border-[#E5E7EB] bg-white text-[#333333] hover:border-[#9CA3AF]'}`}>
            <option value="all">All Stages</option>
            {STAGE_FILTERS.filter(s => s.id !== 'all').map(stage => (
              <option key={stage.id} value={stage.id}>{stage.label} ({stageCounts[stage.id] ?? 0})</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Megaphone size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${adFilter !== 'all' ? 'text-[#EC4899]' : 'text-[#9CA3AF]'}`} />
          <ChevronDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${adFilter !== 'all' ? 'text-[#EC4899]' : 'text-[#6B7280]'}`} />
          <select value={adFilter} onChange={e => setAdFilter(e.target.value)}
            className={`appearance-none text-sm font-medium rounded-lg pl-9 pr-8 py-2 cursor-pointer transition-all focus:outline-none max-w-[200px] truncate ${adFilter !== 'all' ? 'border border-[#EC4899] bg-pink-50 text-[#EC4899]' : 'border border-[#E5E7EB] bg-white text-[#333333] hover:border-[#9CA3AF]'}`}>
            <option value="all">All Ads</option>
            {uniqueAds.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <span className="text-xs text-[#6B7280]">{filtered.length} leads</span>
        <button
          onClick={() => exportCsv(filtered.map(c => ({
            'Name': c.full_name, 'Company': c.company, 'Email': c.email, 'Phone': c.phone,
            'Stage': c.stage_label || formatStage(c.current_stage), 'Priority': getPriority(c), 'Source Ad': c.ad_name || c.source_ad,
            'Date': c.ghl_created_at || c.created_at, 'Quality Score': c.lead_quality_score, 'Deal Value': c.deal_value,
            'Meeting Date': c.meeting_date, 'Follow-up Attempts': c.follow_up_attempts,
            'Assigned To': c.assigned_to, 'DQ Reason': c.dq_reason, 'Call Summary': c.call_summary,
          })), 'leads')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F3F4F6]">
            <tr>
              {['Name', 'Company', 'Source Ad', 'Date', 'Stage', 'Priority', 'Quality'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-[#6B7280] px-4 py-3">{h}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-t border-[#F3F4F6]">
                  <td colSpan={8} className="px-4 py-3"><div className="skeleton h-6 w-full" /></td>
                </tr>
              ))
            ) : !filtered.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                  No leads match this filter.
                </td>
              </tr>
            ) : filtered.map((contact) => {
              const priority = getPriority(contact)
              const priorityConfig = PRIORITY_CONFIG[priority]
              const hasCallSummary = hasText(contact.call_summary)
              const hasCallRecording = hasText(contact.call_recording_url)
              const hasCallTranscript = hasText(contact.call_transcript)
              const hasCallData = hasCallSummary || hasCallRecording || hasCallTranscript

              return (
                <>
                  <tr
                    key={contact.contact_id}
                    className={`border-t border-[#F3F4F6] hover:bg-[#FAFAFA] cursor-pointer ${priority === 'immediate' ? 'border-l-2 border-l-red-400' : ''}`}
                    onClick={() => setExpandedId(expandedId === contact.contact_id ? null : contact.contact_id)}
                    >
                      <td className="px-4 py-3 font-medium text-[#0F0F1A]">{contact.full_name}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{contact.company || '—'}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{contact.ad_name || contact.source_ad || '—'}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{(contact.ghl_created_at || contact.created_at) ? new Date(contact.ghl_created_at || contact.created_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#374151]">
                          {contact.stage_label || formatStage(contact.current_stage) || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${priorityConfig.color}`}>
                          {priorityConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {contact.lead_quality_score ? (
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${contact.lead_quality_score >= 7 ? 'bg-[#16A34A]' : contact.lead_quality_score >= 4 ? 'bg-[#F59E0B]' : 'bg-[#DC2626]'}`}>
                          {contact.lead_quality_score}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">
                      {expandedId === contact.contact_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                  </tr>
                  {expandedId === contact.contact_id && (
                    <tr key={`${contact.contact_id}-exp`} className="border-t border-[#F3F4F6] bg-[#FAFAFA]">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="space-y-6">
                          {hasCallData && (
                            <div className="space-y-4">
                              {hasCallSummary && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileText size={14} className="text-[#6B7280]" />
                                    <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Call Summary</p>
                                  </div>
                                  <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#333333] leading-relaxed">
                                    {contact.call_summary}
                                  </div>
                                </div>
                              )}

                              {hasCallRecording && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Volume2 size={14} className="text-[#6B7280]" />
                                    <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Call Recording</p>
                                  </div>
                                  <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3">
                                    <audio controls preload="none" className="w-full mt-2">
                                      <source src={contact.call_recording_url} type="audio/mpeg" />
                                      Your browser does not support the audio element.
                                    </audio>
                                  </div>
                                </div>
                              )}

                              {hasCallTranscript && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare size={14} className="text-[#6B7280]" />
                                    <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Call Transcript</p>
                                  </div>
                                  <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#4B5563] leading-relaxed">
                                    {contact.call_transcript}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="space-y-2 text-sm lg:col-span-2">
                              <p className="text-xs font-semibold text-[#6B7280] mb-2">CONTACT DETAILS</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Email</span><span className="text-right">{contact.email || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Phone</span><span className="text-right">{contact.phone || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Industry</span><span className="text-right">{contact.industry || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Meeting Date</span><span className="text-right">{contact.meeting_date ? new Date(contact.meeting_date).toLocaleDateString() : '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Deal Value</span><span className="text-right font-medium">{contact.deal_value ? `AED ${Number(contact.deal_value).toLocaleString()}` : '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Pipeline</span><span className="text-right">{contact.ghl_pipeline_name || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Lead Score</span><span className="text-right">{contact.lead_quality_score || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Follow-up Attempts</span><span className="text-right">{contact.follow_up_attempts > 0 ? contact.follow_up_attempts : '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Assigned To</span><span className="text-right">{contact.assigned_to || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">DQ Reason</span><span className={`text-right ${contact.dq_reason ? 'text-[#DC2626]' : ''}`}>{contact.dq_reason || '—'}</span></div>
                              </div>
                            </div>
                            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                              <p className="text-xs font-semibold text-[#6B7280] mb-2">LEAD STATUS</p>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Stage</span><span className="text-right">{contact.stage_label || formatStage(contact.current_stage) || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Priority</span><span className="text-right">{priorityConfig.label}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Source Ad</span><span className="text-right">{contact.ad_name || contact.source_ad || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Created</span><span className="text-right">{(contact.ghl_created_at || contact.created_at) ? new Date(contact.ghl_created_at || contact.created_at).toLocaleDateString() : '—'}</span></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </ErrorBoundary>

    <LeadSummary contacts={contacts} loading={loading} />
    </>
  )
}

function LeadSummary({ contacts, loading }) {
  if (loading || !contacts?.length) return null
  const immediate = contacts.filter(c => getPriority(c) === 'immediate').length
  const hot = contacts.filter(c => getPriority(c) === 'hot').length
  const dq = contacts.filter(c => c.current_stage === 'disqualified').length
  const closed = contacts.filter(c => c.current_stage === 'closed_won').length
  return (
    <AISummary summary={
      `There are ${contacts.length} total leads in the tracker. ` +
      `${immediate} require immediate action and ${hot} are hot leads — prioritise these first. ` +
      `${closed} have closed and ${dq} were disqualified. ` +
      `${dq > contacts.length * 0.3 ? `Disqualification rate is high at ${((dq / contacts.length) * 100).toFixed(0)}% — review lead source quality.` : 'Disqualification rate is within normal range.'}`
    } />
  )
}
