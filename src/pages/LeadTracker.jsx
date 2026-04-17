import { useState } from 'react'
import { useAllContacts } from '../hooks/useDashboardData'
import StatusBadge from '../components/ui/StatusBadge'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { ChevronDown, ChevronUp, Search, Download } from 'lucide-react'
import { exportCsv } from '../lib/exportCsv'

export default function LeadTracker() {
  const { data: contacts, loading } = useAllContacts()
  const [expandedId, setExpandedId] = useState(null)
  const [stageFilter, setStageFilter] = useState('all')
  const [adFilter, setAdFilter] = useState('all')
  const [search, setSearch] = useState('')

  const uniqueAds = contacts ? [...new Set(contacts.map(c => c.source_ad).filter(Boolean))] : []
  const uniqueStages = contacts ? [...new Set(contacts.map(c => c.current_stage).filter(Boolean))] : []

  const filtered = (contacts ?? []).filter(c => {
    const matchStage = stageFilter === 'all' || c.current_stage === stageFilter
    const matchAd = adFilter === 'all' || c.source_ad === adFilter
    const matchSearch = !search || [c.full_name, c.email, c.company, c.phone].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    return matchStage && matchAd && matchSearch
  })

  return (
    <ErrorBoundary>
      {/* Filters */}
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
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#EC4899]">
          <option value="all">All Stages</option>
          {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={adFilter} onChange={e => setAdFilter(e.target.value)} className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#EC4899]">
          <option value="all">All Ads</option>
          {uniqueAds.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-xs text-[#6B7280] ml-auto">{filtered.length} leads</span>
        <button
          onClick={() => exportCsv(filtered.map(c => ({
            'Name': c.full_name,
            'Company': c.company,
            'Email': c.email,
            'Phone': c.phone,
            'Stage': c.current_stage,
            'Source Ad': c.source_ad,
            'Date': c.created_at,
            'Quality Score': c.lead_quality_score,
            'Deal Value': c.deal_value,
            'Meeting Date': c.meeting_date,
            'Follow-up Attempts': c.follow_up_attempts,
            'Assigned To': c.assigned_to,
            'DQ Reason': c.dq_reason,
            'Call Summary': c.call_summary,
          })), 'leads')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F3F4F6]">
            <tr>
              {['Name', 'Company', 'Source Ad', 'Date', 'Stage', 'Quality'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-[#6B7280] px-4 py-3">{h}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-t border-[#F3F4F6]">
                  <td colSpan={7} className="px-4 py-3"><div className="skeleton h-6 w-full" /></td>
                </tr>
              ))
            ) : !filtered.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                  No leads yet. When Sarah engages with her first lead, they appear here.
                </td>
              </tr>
            ) : filtered.map((contact) => (
              <>
                <tr
                  key={contact.contact_id}
                  className="border-t border-[#F3F4F6] hover:bg-[#FAFAFA] cursor-pointer"
                  onClick={() => setExpandedId(expandedId === contact.contact_id ? null : contact.contact_id)}
                >
                  <td className="px-4 py-3 font-medium text-[#0F0F1A]">{contact.full_name}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{contact.company || '—'}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{contact.source_ad || '—'}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{contact.created_at ? new Date(contact.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge stage={contact.current_stage} /></td>
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
                    <td colSpan={7} className="px-6 py-4">
                      <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-2 text-sm">
                          <p className="text-xs font-semibold text-[#6B7280] mb-2">CONTACT DETAILS</p>
                          <div className="flex justify-between"><span className="text-[#6B7280]">Email</span><span>{contact.email || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B7280]">Phone</span><span>{contact.phone || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B7280]">Meeting Date</span><span>{contact.meeting_date ? new Date(contact.meeting_date).toLocaleDateString() : '—'}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B7280]">Deal Value</span><span className="font-medium">{contact.deal_value ? `AED ${Number(contact.deal_value).toLocaleString()}` : '—'}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B7280]">Follow-up Attempts</span><span>{contact.follow_up_attempts ?? '—'}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B7280]">Assigned To</span><span>{contact.assigned_to || '—'}</span></div>
                          {contact.dq_reason && <div className="flex justify-between"><span className="text-[#6B7280]">DQ Reason</span><span className="text-[#DC2626]">{contact.dq_reason}</span></div>}
                        </div>
                        <div className="col-span-2">
                          {contact.call_summary && (
                            <>
                              <p className="text-xs font-semibold text-[#6B7280] mb-2">SARAH'S CALL SUMMARY</p>
                              <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 text-sm text-[#333333] leading-relaxed mb-3">
                                {contact.call_summary}
                              </div>
                            </>
                          )}
                          {contact.call_transcript && (
                            <>
                              <p className="text-xs font-semibold text-[#6B7280] mb-2">TRANSCRIPT</p>
                              <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 text-xs text-[#6B7280] max-h-40 overflow-y-auto leading-relaxed">
                                {contact.call_transcript}
                              </div>
                            </>
                          )}
                          {!contact.call_summary && !contact.call_transcript && (
                            <p className="text-sm text-[#9CA3AF]">No call data available for this lead yet.</p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </ErrorBoundary>
  )
}
