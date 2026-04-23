import { useState, useEffect } from 'react'
import KPICard from '../components/ui/KPICard'
import Tabs from '../components/ui/Tabs'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useDashboard } from '../store/dashboard'
import { sarahReport } from '../lib/reports/generators'
import { useFunnelSummary, useAllContacts } from '../hooks/useDashboardData'

const OUTCOME_COLORS = {
  'Meeting Booked': '#16A34A',
  'Showed Up': '#22C55E',
  'No Show': '#F97316',
  'Active / Proposal': '#2563EB',
  'Disqualified': '#DC2626',
  'Not Interested': '#9CA3AF',
  'Wrong Number': '#D1D5DB',
  'Follow Up': '#FBBF24',
  'Callback': '#8B5CF6',
}

const RADIAN = Math.PI / 180
const CustomLabel = ({ cx, cy, midAngle, outerRadius, name, value }) => {
  const radius = outerRadius + 35
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill={OUTCOME_COLORS[name] || '#333'} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight={500}>
      {`${name} (${value})`}
    </text>
  )
}

export default function SarahsPerformance() {
  const [activeTab, setActiveTab] = useState('overview')
  const setReportBuilder = useDashboard(s => s.setReportBuilder)

  // Lifetime totals — not date-filtered
  const { data: funnel, loading: funnelLoading } = useFunnelSummary()
  const { data: contacts, loading: contactsLoading } = useAllContacts()

  const meetingsBooked = funnel?.meetings_booked ?? 0
  const showedUp = funnel?.showed_up ?? 0
  const activeOpps = funnel?.active_opportunities ?? 0
  const totalContacts = contacts?.length ?? 0

  // Real outcome breakdown from all contact stages
  const stageCounts = {}
  ;(contacts ?? []).forEach(c => {
    if (c.current_stage) stageCounts[c.current_stage] = (stageCounts[c.current_stage] || 0) + 1
  })

  const outcomeData = [
    { name: 'Meeting Booked',    value: stageCounts['meeting_booked'] || 0 },
    { name: 'Showed Up',         value: stageCounts['showed'] || 0 },
    { name: 'No Show',           value: stageCounts['no_show'] || 0 },
    { name: 'Active / Proposal', value: (stageCounts['active'] || 0) + (stageCounts['closed_won'] || 0) },
    { name: 'Disqualified',      value: stageCounts['disqualified'] || 0 },
    { name: 'Not Interested',    value: stageCounts['not_interested'] || 0 },
    { name: 'Wrong Number',      value: stageCounts['wrong_number'] || 0 },
    { name: 'Follow Up',         value: (stageCounts['follow_up'] || 0) + (stageCounts['contacted'] || 0) + (stageCounts['qualified_no_meeting'] || 0) },
    { name: 'Callback',          value: stageCounts['callback'] || 0 },
  ].filter(d => d.value > 0)

  const disqualifiedCount = stageCounts['disqualified'] || 0
  const notInterestedCount = stageCounts['not_interested'] || 0
  const disqualifiedPct = totalContacts > 0 ? Math.round((disqualifiedCount / totalContacts) * 100) : 0
  const notInterestedPct = totalContacts > 0 ? Math.round((notInterestedCount / totalContacts) * 100) : 0

  // Real DQ reasons from contact dq_reason field
  const dqMap = {}
  ;(contacts ?? [])
    .filter(c => c.current_stage === 'disqualified' && c.dq_reason)
    .forEach(c => { dqMap[c.dq_reason] = (dqMap[c.dq_reason] || 0) + 1 })
  const dqReasons = Object.entries(dqMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  const loading = funnelLoading || contactsLoading

  useEffect(() => {
    setReportBuilder(() => sarahReport({ meetingsBooked, showedUp, activeOpps }, dqReasons))
    return () => setReportBuilder(null)
  }, [meetingsBooked, showedUp, activeOpps, setReportBuilder])

  return (
    <div>
      <Tabs
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'recent-calls', label: 'Recent Calls' }]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'overview' && (
        <>
          <ErrorBoundary>
            <div className="grid grid-cols-6 gap-3 mb-6">
              <KPICard label="Calls Attempted" value="—" description="Call log integration coming soon" />
              <KPICard label="Calls Connected" value="—" description="Call log integration coming soon" />
              <KPICard label="Meetings Booked" value={meetingsBooked} loading={funnelLoading} description="Total meetings Sarah booked" target={15} />
              <KPICard label="Showed Up" value={showedUp} loading={funnelLoading} description="Leads who attended their meeting" target={Math.round(meetingsBooked * 0.75)} />
              <KPICard label="Not Interested" value={notInterestedCount} loading={contactsLoading} description={`${notInterestedPct}% of leads were qualified but chose not to proceed.`} inverse={true} />
              <KPICard label="Disqualified" value={disqualifiedCount} loading={contactsLoading} description={`${disqualifiedPct}% of leads did not meet fit criteria.`} inverse={true} />
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Lead Outcome Breakdown</h2>
              {contactsLoading ? (
                <div className="skeleton h-64 w-full" />
              ) : outcomeData.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] text-center py-12">No contact data available yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      dataKey="value"
                      labelLine={true}
                      label={<CustomLabel />}
                    >
                      {outcomeData.map((entry, i) => (
                        <Cell key={i} fill={OUTCOME_COLORS[entry.name] || '#E5E7EB'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v} leads`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Disqualification Reasons</h2>
              {contactsLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}</div>
              ) : dqReasons.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] text-center py-6">No disqualified leads with recorded reasons yet.</p>
              ) : (
                dqReasons.map(({ reason, count }) => (
                  <div key={reason} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                    <span className="text-sm text-[#333333]">{reason}</span>
                    <span className="text-sm font-semibold text-[#DC2626]">{count}</span>
                  </div>
                ))
              )}
            </div>
          </ErrorBoundary>

          <AISummary
            loading={loading}
            summary={
              `Sarah booked ${meetingsBooked} meetings in total, of which ${showedUp} showed up — a show rate of ${meetingsBooked > 0 ? ((showedUp / meetingsBooked) * 100).toFixed(0) : 0}%. ` +
              `${meetingsBooked >= 15 ? 'Meetings are on target.' : `Meetings are below the 15 target — ${15 - meetingsBooked} more needed.`} ` +
              `${activeOpps} opportunities are currently active in the pipeline. ` +
              (dqReasons.length > 0 ? `Top disqualification reason: ${dqReasons[0].reason} (${dqReasons[0].count} leads). ` : '') +
              `Call-level metrics will be available once VAPI call log integration is complete.`
            }
          />
        </>
      )}

      {activeTab === 'recent-calls' && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 flex flex-col items-center justify-center gap-3">
          <p className="text-sm font-medium text-[#333333]">Call recordings coming soon</p>
          <p className="text-xs text-[#9CA3AF] text-center max-w-sm">In the meantime, you can see call summaries on individual leads in the Lead Tracker.</p>
        </div>
      )}
    </div>
  )
}
