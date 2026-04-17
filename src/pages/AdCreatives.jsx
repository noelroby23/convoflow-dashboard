import { useState } from 'react'
import { useAdPerformance } from '../hooks/useDashboardData'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'
import { exportCsv } from '../lib/exportCsv'

export default function AdCreatives() {
  const { data: ads, loading, error } = useAdPerformance()
  const [expandedId, setExpandedId] = useState(null)
  const [sortKey, setSortKey] = useState('total_spend')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = ads ? [...ads].sort((a, b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
    return sortDir === 'asc' ? av - bv : bv - av
  }) : []

  const getCPLColor = (cpl) => {
    if (!cpl) return 'text-[#9CA3AF]'
    if (cpl <= 85) return 'text-[#16A34A] font-semibold'
    if (cpl <= 120) return 'text-[#F59E0B] font-semibold'
    return 'text-[#DC2626] font-semibold'
  }

  const getFreqColor = (freq) => {
    if (!freq) return ''
    if (freq > 2.0) return 'text-[#DC2626] font-semibold'
    if (freq > 1.5) return 'text-[#F59E0B] font-semibold'
    return 'text-[#333333]'
  }

  const cols = [
    { key: 'ad_name', label: 'Ad Name' },
    { key: 'status', label: 'Status' },
    { key: 'total_spend', label: 'Spend (AED)' },
    { key: 'total_leads', label: 'Leads' },
    { key: 'cost_per_lead', label: 'CPL (AED)' },
    { key: 'meetings_booked', label: 'Meetings' },
    { key: 'showed_up', label: 'Showed' },
    { key: 'active_opportunities', label: 'Active Opps' },
    { key: 'cost_per_active', label: 'Cost/Active' },
    { key: 'avg_frequency', label: 'Frequency' },
    { key: 'avg_ctr', label: 'CTR %' },
  ]

  if (loading) return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
      <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
    </div>
  )

  if (error) return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
      <p className="text-sm text-[#DC2626]">Failed to load ad performance data.</p>
    </div>
  )

  if (!ads?.length) return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
      <p className="text-sm text-[#9CA3AF]">No ad campaigns running yet. Once ads launch, performance appears here.</p>
    </div>
  )

  const handleExport = () => {
    exportCsv(sorted.map(ad => ({
      'Ad Name': ad.ad_name,
      'Status': ad.status,
      'Spend (AED)': ad.total_spend,
      'Leads': ad.total_leads,
      'CPL (AED)': ad.cost_per_lead,
      'Meetings': ad.meetings_booked,
      'Showed': ad.showed_up,
      'Active Opps': ad.active_opportunities,
      'Cost/Active': ad.cost_per_active,
      'Frequency': ad.avg_frequency,
      'CTR %': ad.avg_ctr,
    })), 'ad-performance')
  }

  return (
    <ErrorBoundary>
      <div className="flex justify-end mb-3">
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
          <Download size={14} />
          Export CSV
        </button>
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F3F4F6]">
            <tr>
              {cols.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="text-left text-xs font-semibold text-[#6B7280] px-4 py-3 cursor-pointer hover:text-[#333333] whitespace-nowrap"
                >
                  {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((ad) => (
              <>
                <tr
                  key={ad.ad_id}
                  className={`border-t border-[#F3F4F6] hover:bg-[#FAFAFA] cursor-pointer transition-colors ${ad.status === 'paused' ? 'opacity-60' : ''}`}
                  onClick={() => setExpandedId(expandedId === ad.ad_id ? null : ad.ad_id)}
                >
                  <td className="px-4 py-3 font-medium text-[#0F0F1A]">{ad.ad_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ad.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ad.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {ad.status === 'active' ? 'ACTIVE' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{ad.total_spend ? `AED ${Number(ad.total_spend).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3">{ad.total_leads ?? '—'}</td>
                  <td className={`px-4 py-3 ${getCPLColor(ad.cost_per_lead)}`}>{ad.cost_per_lead ? `AED ${Number(ad.cost_per_lead).toFixed(0)}` : '—'}</td>
                  <td className="px-4 py-3">{ad.meetings_booked ?? '—'}</td>
                  <td className="px-4 py-3">{ad.showed_up ?? '—'}</td>
                  <td className={`px-4 py-3 font-medium ${(ad.active_opportunities ?? 0) > 0 ? 'text-[#16A34A]' : (ad.total_leads ?? 0) > 0 ? 'text-[#DC2626]' : ''}`}>
                    {ad.active_opportunities ?? '—'}
                  </td>
                  <td className="px-4 py-3">{ad.cost_per_active ? `AED ${Number(ad.cost_per_active).toFixed(0)}` : '∞'}</td>
                  <td className={`px-4 py-3 ${getFreqColor(ad.avg_frequency)}`}>{ad.avg_frequency ? Number(ad.avg_frequency).toFixed(2) : '—'}</td>
                  <td className="px-4 py-3">{ad.avg_ctr ? `${Number(ad.avg_ctr).toFixed(2)}%` : '—'}</td>
                  <td className="px-4 py-3 text-[#6B7280]">
                    {expandedId === ad.ad_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </td>
                </tr>
                {expandedId === ad.ad_id && (
                  <tr key={`${ad.ad_id}-expanded`} className="border-t border-[#F3F4F6] bg-[#FAFAFA]">
                    <td colSpan={12} className="px-6 py-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold text-[#6B7280] mb-3">PERFORMANCE BREAKDOWN</p>
                          <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={[
                              { name: 'Leads', value: ad.total_leads ?? 0 },
                              { name: 'Meetings', value: ad.meetings_booked ?? 0 },
                              { name: 'Showed', value: ad.showed_up ?? 0 },
                              { name: 'Active', value: ad.active_opportunities ?? 0 },
                              { name: 'Closed', value: ad.closed_won ?? 0 },
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#EC4899" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#6B7280] mb-3">AD DETAILS</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-[#6B7280]">Total Impressions</span><span className="font-medium">{ad.total_impressions ? Number(ad.total_impressions).toLocaleString() : '—'}</span></div>
                            <div className="flex justify-between"><span className="text-[#6B7280]">Avg Frequency</span><span className={getFreqColor(ad.avg_frequency)}>{ad.avg_frequency ? Number(ad.avg_frequency).toFixed(2) : '—'}</span></div>
                            <div className="flex justify-between"><span className="text-[#6B7280]">CTR</span><span className="font-medium">{ad.avg_ctr ? `${Number(ad.avg_ctr).toFixed(2)}%` : '—'}</span></div>
                            <div className="flex justify-between"><span className="text-[#6B7280]">Cost per Lead</span><span className={getCPLColor(ad.cost_per_lead)}>{ad.cost_per_lead ? `AED ${Number(ad.cost_per_lead).toFixed(0)}` : '—'}</span></div>
                            <div className="flex justify-between"><span className="text-[#6B7280]">Cost per Active</span><span className="font-medium">{ad.cost_per_active ? `AED ${Number(ad.cost_per_active).toFixed(0)}` : '∞'}</span></div>
                          </div>
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
