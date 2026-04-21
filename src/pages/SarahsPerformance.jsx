import { useState, useEffect } from 'react'
import KPICard from '../components/ui/KPICard'
import Tabs from '../components/ui/Tabs'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { mockSarahKPIs, mockCallOutcomes } from '../data/mockData'
import { useDashboard } from '../store/dashboard'
import { sarahReport } from '../lib/reports/generators'

const DQ_REASONS = [
  { reason: 'Budget too low', count: 11 },
  { reason: 'Wrong timing', count: 6 },
  { reason: 'Not ICP', count: 4 },
  { reason: 'Already has solution', count: 3 },
]

export default function SarahsPerformance() {
  const [activeTab, setActiveTab] = useState('overview')
  const setReportBuilder = useDashboard(s => s.setReportBuilder)

  useEffect(() => {
    setReportBuilder(() => sarahReport(mockSarahKPIs, DQ_REASONS))
    return () => setReportBuilder(null)
  }, [setReportBuilder])

  return (
    <div>
      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'recent-calls', label: 'Recent Calls' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <ErrorBoundary>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <KPICard label="Calls Attempted" value={mockSarahKPIs.callsAttempted} description="Total outbound call attempts Sarah made" />
              <KPICard label="Calls Connected" value={mockSarahKPIs.callsConnected} description="Calls where Sarah actually reached the lead" />
              <KPICard label="Qualified Rate" value={mockSarahKPIs.qualifiedRate} suffix="%" description="% of connected calls that were qualified" target={20} />
              <KPICard label="Meetings Booked" value={mockSarahKPIs.meetingsBooked} description="Meetings Sarah booked from her calls" target={15} />
            </div>
          </ErrorBoundary>

          {/* Outcome breakdown */}
          <ErrorBoundary>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Call Outcome Breakdown</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={mockCallOutcomes}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {mockCallOutcomes.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ErrorBoundary>

          {/* DQ reasons */}
          <ErrorBoundary>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
              <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Disqualification Reasons</h2>
              {DQ_REASONS.map(({ reason, count }) => (
                <div key={reason} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                  <span className="text-sm text-[#333333]">{reason}</span>
                  <span className="text-sm font-semibold text-[#DC2626]">{count}</span>
                </div>
              ))}
            </div>
          </ErrorBoundary>

          <AISummary summary={
            `Sarah attempted ${mockSarahKPIs.callsAttempted} calls this period, connecting with ${mockSarahKPIs.callsConnected} leads — a connection rate of ${((mockSarahKPIs.callsConnected / mockSarahKPIs.callsAttempted) * 100).toFixed(0)}%. ` +
            `Of those connected, ${mockSarahKPIs.qualifiedRate}% were qualified, resulting in ${mockSarahKPIs.meetingsBooked} meetings booked. ` +
            `The top disqualification reason is budget — 11 leads were disqualified for being under budget. ` +
            `${mockSarahKPIs.qualifiedRate >= 20 ? 'Qualified rate is on target.' : 'Qualified rate is below the 20% target — review Sarah\'s qualification script.'}`
          } />
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
