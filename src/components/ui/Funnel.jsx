const pinkShades = [
  'bg-pink-100',
  'bg-pink-200',
  'bg-pink-300',
  'bg-pink-400',
  'bg-pink-500',
]

const pinkTextShades = [
  'text-pink-700',
  'text-pink-700',
  'text-pink-800',
  'text-white',
  'text-white',
]

export default function Funnel({ data, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-9 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!data || (data.total_leads ?? 0) === 0) {
    return (
      <p className="text-sm text-[#9CA3AF] text-center py-8">
        No funnel data available for the selected date range.
      </p>
    )
  }

  const stages = [
    { label: 'Leads', count: data.total_leads ?? 0 },
    { label: 'Meetings Booked', count: data.meetings_booked ?? 0 },
    { label: 'Showed Up', count: data.showed_up ?? 0 },
    { label: 'Active Opps', count: data.active_opportunities ?? 0 },
    { label: 'Closed Won', count: data.closed_won ?? 0 },
  ]

  const maxCount = stages[0].count || 1

  // Conversion rate summaries
  const leadToMeeting = stages[0].count > 0 ? ((stages[1].count / stages[0].count) * 100).toFixed(1) : '0.0'
  const meetingToShow = stages[1].count > 0 ? ((stages[2].count / stages[1].count) * 100).toFixed(1) : '0.0'
  const showToActive = stages[2].count > 0 ? ((stages[3].count / stages[2].count) * 100).toFixed(1) : '0.0'
  const activeToWon = stages[3].count > 0 ? ((stages[4].count / stages[3].count) * 100).toFixed(1) : '0.0'
  const leadToWon = stages[0].count > 0 ? ((stages[4].count / stages[0].count) * 100).toFixed(1) : '0.0'

  return (
    <>
      <div className="space-y-3">
        {stages.map((stage, i) => {
          const widthPct = (stage.count / maxCount) * 100
          const convRate = i === 0 ? null : ((stage.count / (stages[i - 1].count || 1)) * 100).toFixed(1)
          return (
            <div key={stage.label} className="flex items-center gap-4">
              <div className="w-36 text-right">
                <span className="text-sm font-medium text-[#333333]">{stage.label}</span>
              </div>
              <div className="flex-1 h-9 bg-[#F3F4F6] rounded-lg overflow-hidden">
                <div
                  className={`h-full ${pinkShades[i]} rounded-lg flex items-center justify-end pr-3 transition-all`}
                  style={{ width: `${widthPct}%` }}
                >
                  <span className={`text-sm font-semibold ${pinkTextShades[i]}`}>{stage.count}</span>
                </div>
              </div>
              <div className="w-24 text-left">
                {convRate !== null ? (
                  <span className="text-xs text-[#6B7280]">{convRate}% conv.</span>
                ) : (
                  <span className="text-xs text-[#6B7280]">100%</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-[#E5E7EB] flex gap-6">
        <div className="text-center">
          <p className="text-xs text-[#6B7280]">Lead → Meeting</p>
          <p className="text-sm font-semibold text-[#0F0F1A]">{leadToMeeting}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[#6B7280]">Meeting → Show</p>
          <p className="text-sm font-semibold text-[#0F0F1A]">{meetingToShow}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[#6B7280]">Show → Active</p>
          <p className="text-sm font-semibold text-[#0F0F1A]">{showToActive}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[#6B7280]">Active → Won</p>
          <p className="text-sm font-semibold text-[#0F0F1A]">{activeToWon}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[#6B7280]">Lead → Won</p>
          <p className="text-sm font-semibold text-[#EC4899] font-bold">{leadToWon}%</p>
        </div>
      </div>
    </>
  )
}
