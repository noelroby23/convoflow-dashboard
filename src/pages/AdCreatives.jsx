import { useState, useEffect } from 'react'
import { useAdPerformance } from '../hooks/useDashboardData'
import { useDashboard } from '../store/dashboard'
import { creativeReport } from '../lib/reports/generators'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'
import { exportCsv } from '../lib/exportCsv'

const FILTER_CHIPS = [
  { id: 'all',        label: 'All Ads',          color: 'text-[#6B7280] bg-white border-[#E5E7EB]' },
  { id: 'active',     label: 'Active',            color: 'text-[#16A34A] bg-green-50 border-green-200' },
  { id: 'best',       label: '🏆 Best Performing', color: 'text-[#2563EB] bg-blue-50 border-blue-200' },
  { id: 'worst',      label: '📉 Worst Performing', color: 'text-[#F59E0B] bg-amber-50 border-amber-200' },
  { id: 'action',     label: '🚨 Immediate Action', color: 'text-[#DC2626] bg-red-50 border-red-200' },
  { id: 'removal',    label: '🗑 Needs Removal',   color: 'text-[#6B7280] bg-gray-50 border-gray-200' },
  { id: 'revamp',     label: '🔄 Needs Revamp',    color: 'text-[#8B5CF6] bg-purple-50 border-purple-200' },
]

function classifyAd(ad) {
  const cpl = Number(ad.cost_per_lead ?? 0)
  const leads = Number(ad.total_leads ?? 0)
  const freq = Number(ad.avg_frequency ?? 0)
  const hook = ad.hook_rate_pct != null ? Number(ad.hook_rate_pct) : null
  const isActive = ad.status === 'active'

  // Best: active, CPL <= 85, has leads
  if (isActive && cpl > 0 && cpl <= 85 && leads > 0) return 'best'
  // Immediate action: active but CPL way above target or hook rate in kill zone
  if (isActive && ((cpl > 150 && leads > 0) || (hook != null && hook < 25))) return 'action'
  // Needs removal: inactive, zero leads, spent money
  if (!isActive && leads === 0 && Number(ad.total_spend ?? 0) > 0) return 'removal'
  // Needs revamp: active, CPL 85-150, or freq > 2
  if (isActive && ((cpl > 85 && cpl <= 150) || freq > 2.0)) return 'revamp'
  // Worst: active, highest CPL with leads but not qualifying for action
  if (isActive && cpl > 150 && leads > 0) return 'worst'
  return null
}

export default function AdCreatives() {
  const { data: ads, loading, error } = useAdPerformance()
  const setReportBuilder = useDashboard(s => s.setReportBuilder)
  const [expandedId, setExpandedId] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    setReportBuilder(() => creativeReport(ads))
    return () => setReportBuilder(null)
  }, [ads, setReportBuilder])

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

  const filtered = sorted.filter(ad => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'active') return ad.status === 'active'
    return classifyAd(ad) === activeFilter
  })

  // Count per filter for badge numbers
  const counts = ads ? FILTER_CHIPS.reduce((acc, chip) => {
    if (chip.id === 'all') acc[chip.id] = ads.length
    else if (chip.id === 'active') acc[chip.id] = ads.filter(a => a.status === 'active').length
    else acc[chip.id] = ads.filter(a => classifyAd(a) === chip.id).length
    return acc
  }, {}) : {}

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

  const getHookRateColor = (rate) => {
    if (rate == null) return 'text-[#9CA3AF]'
    if (rate >= 30) return 'text-[#16A34A] font-semibold'
    if (rate >= 25) return 'text-[#F59E0B] font-semibold'
    return 'text-[#DC2626] font-semibold'
  }

  const getWatchThroughColor = (rate) => {
    if (rate == null) return 'text-[#9CA3AF]'
    if (rate >= 40) return 'text-[#16A34A] font-semibold'
    if (rate >= 20) return 'text-[#333333]'
    return 'text-[#F59E0B]'
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
    { key: 'hook_rate_pct', label: 'Hook Rate' },
    { key: 'watch_through_pct', label: 'Watch-Thru' },
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
      <p className="text-sm text-[#9CA3AF]">No ad campaigns running yet.</p>
    </div>
  )

  const handleExport = () => {
    exportCsv(filtered.map(ad => ({
      'Ad Name': ad.ad_name, 'Status': ad.status, 'Spend (AED)': ad.total_spend,
      'Leads': ad.total_leads, 'CPL (AED)': ad.cost_per_lead, 'Meetings': ad.meetings_booked,
      'Showed': ad.showed_up, 'Active Opps': ad.active_opportunities, 'Cost/Active': ad.cost_per_active,
      'Frequency': ad.avg_frequency, 'CTR %': ad.avg_ctr,
      'Hook Rate %': ad.hook_rate_pct, 'Watch-Through %': ad.watch_through_pct,
    })), 'ad-performance')
  }

  return (
    <>
    <ErrorBoundary>
      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTER_CHIPS.map(chip => (
          <button
            key={chip.id}
            onClick={() => setActiveFilter(chip.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${chip.color} ${activeFilter === chip.id ? 'shadow-sm ring-2 ring-offset-1 ring-current opacity-100' : 'opacity-70 hover:opacity-100'}`}
          >
            {chip.label}
            {counts[chip.id] != null && counts[chip.id] > 0 && (
              <span className="ml-0.5 bg-current bg-opacity-20 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {counts[chip.id]}
              </span>
            )}
          </button>
        ))}
        <button onClick={handleExport} className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
          <p className="text-sm text-[#9CA3AF]">No ads match this filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F3F4F6]">
              <tr>
                {cols.map(({ key, label }) => (
                  <th key={key} onClick={() => handleSort(key)}
                    className="text-left text-xs font-semibold text-[#6B7280] px-4 py-3 cursor-pointer hover:text-[#333333] whitespace-nowrap">
                    {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((ad) => {
                const classification = classifyAd(ad)
                const rowAccent = classification === 'action' ? 'border-l-2 border-l-red-400' :
                                  classification === 'best' ? 'border-l-2 border-l-green-400' :
                                  classification === 'revamp' ? 'border-l-2 border-l-purple-400' : ''
                return (
                  <>
                    <tr
                      key={ad.ad_id}
                      className={`border-t border-[#F3F4F6] hover:bg-[#FAFAFA] cursor-pointer transition-colors ${ad.status === 'paused' ? 'opacity-60' : ''} ${rowAccent}`}
                      onClick={() => setExpandedId(expandedId === ad.ad_id ? null : ad.ad_id)}
                    >
                      <td className="px-4 py-3 font-medium text-[#0F0F1A]">
                        <div className="flex items-center gap-2">
                          {ad.ad_name}
                          {classification === 'action' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">ACTION</span>}
                          {classification === 'best' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">BEST</span>}
                          {classification === 'revamp' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">REVAMP</span>}
                          {classification === 'removal' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">REMOVE</span>}
                        </div>
                      </td>
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
                      <td className={`px-4 py-3 ${getHookRateColor(ad.hook_rate_pct)}`}>{ad.hook_rate_pct != null ? `${Number(ad.hook_rate_pct).toFixed(1)}%` : '—'}</td>
                      <td className={`px-4 py-3 ${getWatchThroughColor(ad.watch_through_pct)}`}>{ad.watch_through_pct != null ? `${Number(ad.watch_through_pct).toFixed(1)}%` : '—'}</td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {expandedId === ad.ad_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {expandedId === ad.ad_id && (
                      <tr key={`${ad.ad_id}-expanded`} className="border-t border-[#F3F4F6] bg-[#FAFAFA]">
                        <td colSpan={14} className="px-6 py-4">
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
                                <div className="flex justify-between pt-2 border-t border-[#E5E7EB]"><span className="text-[#6B7280]">Hook Rate</span><span className={getHookRateColor(ad.hook_rate_pct)}>{ad.hook_rate_pct != null ? `${Number(ad.hook_rate_pct).toFixed(1)}%` : '—'}</span></div>
                                <div className="flex justify-between"><span className="text-[#6B7280]">Watch-Through</span><span className={getWatchThroughColor(ad.watch_through_pct)}>{ad.watch_through_pct != null ? `${Number(ad.watch_through_pct).toFixed(1)}%` : '—'}</span></div>
                              </div>
                            </div>
                          </div>
                          {(ad.total_video_plays_3s ?? 0) > 0 && (
                            <div className="mt-5 pt-4 border-t border-[#E5E7EB]">
                              <p className="text-xs font-semibold text-[#6B7280] mb-3">VIDEO RETENTION FUNNEL</p>
                              <ResponsiveContainer width="100%" height={120}>
                                <BarChart data={[
                                  { name: '3-sec', value: ad.total_video_plays_3s ?? 0 },
                                  { name: '25%', value: ad.total_video_plays_25pct ?? 0 },
                                  { name: '50%', value: ad.total_video_plays_50pct ?? 0 },
                                  { name: '75%', value: ad.total_video_plays_75pct ?? 0 },
                                  { name: '100%', value: ad.total_video_plays_100pct ?? 0 },
                                ]}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                  <YAxis tick={{ fontSize: 11 }} />
                                  <Tooltip />
                                  <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </ErrorBoundary>

    <AdsSummary ads={ads} loading={loading} />
  </>
  )
}

function AdsSummary({ ads, loading }) {
  if (!ads?.length) return null
  const withCPL = ads.filter(a => a.cost_per_lead != null)
  const best = withCPL.length ? [...withCPL].sort((a, b) => a.cost_per_lead - b.cost_per_lead)[0] : null
  const worst = withCPL.length ? [...withCPL].sort((a, b) => b.cost_per_lead - a.cost_per_lead)[0] : null
  const highFreq = ads.filter(a => (a.avg_frequency ?? 0) > 1.5)
  const activeCount = ads.filter(a => a.status === 'active').length
  const withHook = ads.filter(a => a.hook_rate_pct != null)
  const killZone = withHook.filter(a => a.hook_rate_pct < 25)
  const bestHook = withHook.length ? [...withHook].sort((a, b) => b.hook_rate_pct - a.hook_rate_pct)[0] : null
  const hookSummary = !withHook.length ? '' :
    killZone.length > 0
      ? `${killZone.length} creative${killZone.length !== 1 ? 's have' : ' has'} hook rate below the 25% kill threshold (${killZone.map(a => `${a.ad_name}: ${a.hook_rate_pct}%`).join(', ')}). `
      : `Hook rates are healthy. Top performer: ${bestHook?.ad_name} at ${bestHook?.hook_rate_pct}%. `

  return (
    <AISummary loading={loading} summary={
      `You have ${activeCount} active ad${activeCount !== 1 ? 's' : ''} running this period. ` +
      (best ? `${best.ad_name} is your best performer with a CPL of AED ${Number(best.cost_per_lead).toFixed(0)}, ${best.cost_per_lead <= 85 ? 'within' : 'above'} the AED 85 target. ` : '') +
      (worst && worst.ad_name !== best?.ad_name ? `${worst.ad_name} has the highest CPL at AED ${Number(worst.cost_per_lead).toFixed(0)} — consider pausing it if performance doesn't improve. ` : '') +
      hookSummary +
      (highFreq.length > 0 ? `${highFreq.map(a => a.ad_name).join(', ')} ${highFreq.length === 1 ? 'has' : 'have'} frequency above 1.5 — watch for creative fatigue.` : 'All ads are within healthy frequency ranges.')
    } />
  )
}
