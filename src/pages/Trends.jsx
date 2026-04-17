import { useDailyMetrics } from '../hooks/useDashboardData'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format } from 'date-fns'

export default function Trends() {
  const { data: metrics, loading } = useDailyMetrics()

  const chartData = (metrics ?? []).map(d => ({
    date: format(new Date(d.date), 'MMM d'),
    spend: Number(d.spend ?? 0),
    leads: Number(d.leads ?? 0),
    cpl: d.leads > 0 ? +(d.spend / d.leads).toFixed(1) : 0,
    meetings: Number(d.meetings_booked ?? 0),
    frequency: Number(d.avg_frequency ?? 0),
  }))

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-48 w-full rounded-xl" />)}
    </div>
  )

  if (!metrics?.length) return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
      <p className="text-sm text-[#9CA3AF]">No trend data available yet for the selected date range.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-1">Cost per Lead</h2>
          <p className="text-xs text-[#9CA3AF] mb-4">Daily CPL vs AED 85 target</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`AED ${v}`, 'CPL']} />
              <ReferenceLine y={85} stroke="#DC2626" strokeDasharray="4 4" label={{ value: 'Target AED 85', position: 'right', fontSize: 10, fill: '#DC2626' }} />
              <Line type="monotone" dataKey="cpl" stroke="#EC4899" strokeWidth={2} dot={false} name="CPL (AED)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ErrorBoundary>

      <div className="grid grid-cols-2 gap-4">
        <ErrorBoundary>
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Daily Ad Spend</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`AED ${v}`, 'Spend']} />
                <Bar dataKey="spend" fill="#EC4899" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Daily Lead Volume</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="#2563EB" radius={[3, 3, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F0F1A] mb-4">Frequency Tracker</h2>
          <p className="text-xs text-[#9CA3AF] mb-4">Average ad frequency vs 2.5 ceiling — higher means audience fatigue</p>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 3]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine y={2.5} stroke="#DC2626" strokeDasharray="4 4" label={{ value: 'Ceiling 2.5', position: 'right', fontSize: 10, fill: '#DC2626' }} />
              <Line type="monotone" dataKey="frequency" stroke="#F59E0B" strokeWidth={2} dot={false} name="Frequency" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ErrorBoundary>
    </div>
  )
}
