import { useNavigate } from 'react-router-dom'
import KPICard from '../components/ui/KPICard'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { useSarahStages, useTargets } from '../hooks/useDashboardData'

const STAGE_BORDER_CLASS = {
  meeting_booked: 'border-l-[#16A34A]',
  contacted: 'border-l-[#2563EB]',
  callback: 'border-l-[#2563EB]',
  qualified_no_meeting: 'border-l-[#2563EB]',
  follow_up: 'border-l-[#F59E0B]',
  no_show: 'border-l-[#F59E0B]',
  not_interested: 'border-l-[#DC2626]',
  disqualified: 'border-l-[#DC2626]',
  wrong_number: 'border-l-[#DC2626]',
}

const STAGE_TEXT_CLASS = {
  meeting_booked: 'text-[#16A34A]',
  contacted: 'text-[#2563EB]',
  callback: 'text-[#2563EB]',
  qualified_no_meeting: 'text-[#2563EB]',
  follow_up: 'text-[#D97706]',
  no_show: 'text-[#D97706]',
  not_interested: 'text-[#DC2626]',
  disqualified: 'text-[#DC2626]',
  wrong_number: 'text-[#DC2626]',
}

const CONVERSATION_STAGES = ['contacted', 'callback', 'qualified_no_meeting', 'meeting_booked']

function formatPercent(count, total) {
  if (!total) return '0% of total leads'

  const percent = ((count / total) * 100).toFixed(count > 0 ? 1 : 0)
  return `${percent}% of total leads`
}

export default function SarahsPerformance() {
  const navigate = useNavigate()
  const { stages, totalLeads, loading, error } = useSarahStages()
  const { data: targets } = useTargets()

  const stageCounts = {}
  stages.forEach(({ stage, count }) => {
    stageCounts[stage] = Number(count ?? 0)
  })

  const conversations = CONVERSATION_STAGES.reduce((sum, stage) => sum + (stageCounts[stage] || 0), 0)
  const meetingsBooked = stageCounts.meeting_booked || 0
  const bookingRate = totalLeads > 0 ? Number(((meetingsBooked / totalLeads) * 100).toFixed(1)) : 0
  const meetingsTarget = targets?.monthly_meetings ? Math.round(targets.monthly_meetings / 2) : 15

  return (
    <div>
      <ErrorBoundary>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          <KPICard
            label="Total Leads"
            value={totalLeads}
            loading={loading}
            description="All non-test leads assigned to Sarah's pipeline."
          />
          <KPICard
            label="Conversations"
            value={conversations}
            loading={loading}
            description="Leads Sarah reached, advanced, or booked into a meeting."
          />
          <KPICard
            label="Meetings Booked"
            value={meetingsBooked}
            loading={loading}
            target={meetingsTarget}
            description="Meetings Sarah successfully handed over to sales."
          />
          <KPICard
            label="Booking Rate"
            value={bookingRate}
            suffix="%"
            loading={loading}
            description="Meetings booked as a share of Sarah's total leads."
          />
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#0F0F1A]">Stage Breakdown</h2>
            <p className="text-xs text-[#6B7280] mt-1">Sarah-owned stages only, from follow-up through meeting booked and early exits.</p>
          </div>

          {error && !loading && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[...Array(9)].map((_, index) => (
                <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] border-l-4 border-l-[#E5E7EB] p-5 shadow-sm">
                  <div className="skeleton h-4 w-40 mb-4" />
                  <div className="skeleton h-9 w-20 mb-3" />
                  <div className="skeleton h-3 w-28" />
                </div>
              ))}
            </div>
          ) : !stages.length ? (
            <p className="text-sm text-[#9CA3AF] text-center py-12">No Sarah stage data available yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {stages.map(({ stage, count, label }) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => navigate(`/lead-tracker?stage=${encodeURIComponent(stage)}`)}
                  className={`rounded-xl border border-[#E5E7EB] border-l-4 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${STAGE_BORDER_CLASS[stage] || 'border-l-[#E5E7EB]'}`}
                >
                  <p className="text-sm font-semibold text-[#0F0F1A]">{label}</p>
                  <p className={`mt-3 text-3xl font-bold ${STAGE_TEXT_CLASS[stage] || 'text-[#0F0F1A]'}`}>
                    {Number(count ?? 0).toLocaleString()}
                  </p>
                  <p className="mt-2 text-xs text-[#9CA3AF]">{formatPercent(Number(count ?? 0), totalLeads)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </ErrorBoundary>
    </div>
  )
}
