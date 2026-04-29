import { Fragment, useState, useEffect } from 'react'
import { useAdPerformance } from '../hooks/useDashboardData'
import { useDashboard } from '../store/dashboard'
import { creativeReport } from '../lib/reports/generators'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import AISummary from '../components/ui/AISummary'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronDown, ChevronUp, Download, Play, FileText, ExternalLink } from 'lucide-react'
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
  const spend = Number(ad.total_spend ?? 0)
  const isActive = getAdStatusDisplay(ad.status).label === 'ACTIVE'

  if (spend > 300 && leads === 0) return 'action'
  if (spend > 200 && leads === 0 && !isActive) return 'removal'
  if (leads > 0 && cpl <= 85) return 'best'
  if (leads > 0 && cpl > 200) return 'worst'
  if (leads > 0 && cpl > 85 && cpl <= 200) return 'revamp'

  return null
}

function getAdStatusDisplay(status) {
  const normalized = String(status ?? '').trim().toUpperCase()

  if (normalized === 'ACTIVE') {
    return {
      label: 'ACTIVE',
      badge: 'bg-green-100 text-green-700',
      dot: 'bg-green-500',
      isActive: true,
    }
  }

  return {
    label: 'OFF',
    badge: 'bg-gray-100 text-gray-500',
    dot: 'bg-gray-400',
    isActive: false,
  }
}

function getHookRateValue(ad) {
  return ad.hook_rate_pct ?? ad.hook_rate ?? null
}

function getWatchThroughValue(ad) {
  return ad.watch_through_pct ?? ad.watch_through_rate ?? null
}

function formatDecimal(value, digits = 2) {
  if (value == null) return '—'
  return Number(value).toFixed(digits)
}

function formatWholeNumber(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString()
}

function formatCurrency(value) {
  if (value == null) return '—'
  return `AED ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function getAdViewUrl(ad) {
  if (ad.video_url) return ad.fb_post_url || ad.video_url
  if (ad.meta_ad_id) {
    return `https://primary-production-3cd9.up.railway.app/webhook/ad-preview?meta_ad_id=${ad.meta_ad_id}`
  }
  return ad.fb_post_url || null
}

function openAdDestination(url) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function matchesFilter(ad, filterId) {
  if (filterId === 'all') return true
  if (filterId === 'active') return getAdStatusDisplay(ad.status).isActive
  return classifyAd(ad) === filterId
}

function CreativeTypeBadge({ creativeType }) {
  if (creativeType === 'VIDEO') {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">Video</span>
  }

  if (creativeType === 'SHARE') {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">Post</span>
  }

  return null
}

function CreativeThumbnail({ ad }) {
  const isVideo = ad.creative_type === 'VIDEO'
  const destination = getAdViewUrl(ad)
  const hasLink = Boolean(ad.video_url || ad.meta_ad_id)

  const handleThumbClick = (e) => {
    e.stopPropagation()
    openAdDestination(destination)
  }

  return (
    <div
      className={`group relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded bg-gray-100 border border-gray-200 flex items-center justify-center transition-all ${hasLink ? 'cursor-pointer hover:scale-110 hover:shadow-md hover:border-blue-400' : ''}`}
      onClick={hasLink ? handleThumbClick : undefined}
      title={hasLink ? (isVideo ? 'View ad on Facebook' : 'Preview ad') : 'No preview available'}
      role={hasLink ? 'button' : undefined}
      tabIndex={hasLink ? 0 : undefined}
      onKeyDown={hasLink ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleThumbClick(e)
        }
      } : undefined}
    >
      <div className="absolute inset-0 rounded bg-white/75 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="text-[8px] font-semibold text-blue-600">View ↗</span>
      </div>
      <div className="relative z-10">
        {isVideo ? <Play size={16} className="text-[#9CA3AF] ml-0.5" /> : <FileText size={16} className="text-[#9CA3AF]" />}
      </div>
      {hasLink && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white text-[8px]">↗</span>
        </div>
      )}
    </div>
  )
}

function ExpandedCreativePreview({ ad }) {
  const isVideo = ad.creative_type === 'VIDEO'
  const destination = getAdViewUrl(ad)
  const hasLink = Boolean(ad.video_url || ad.meta_ad_id)

  return (
    <div>
      <p className="text-xs font-semibold text-[#6B7280] mb-3">CREATIVE PREVIEW</p>
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <div
          className={`group relative w-full max-w-[220px] ${hasLink ? 'cursor-pointer' : ''}`}
          onClick={hasLink ? () => openAdDestination(destination) : undefined}
          role={hasLink ? 'button' : undefined}
          tabIndex={hasLink ? 0 : undefined}
          onKeyDown={hasLink ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openAdDestination(destination)
            }
          } : undefined}
          aria-label={hasLink ? `${isVideo ? 'View' : 'Preview'} ${ad.ad_name} on Facebook` : undefined}
        >
          <div className="w-full max-w-[220px] aspect-square rounded-lg border border-gray-200 bg-[#F3F4F6] flex items-center justify-center relative overflow-hidden transition-all group-hover:shadow-md group-hover:border-blue-400">
            {isVideo ? <Play size={52} className="text-[#9CA3AF] ml-1 relative z-10" /> : <FileText size={52} className="text-[#9CA3AF] relative z-10" />}
            {isVideo && hasLink && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg hover:bg-black/40 transition">
                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
            )}
            {hasLink && !isVideo && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-[10px]">↗</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-bold text-[#0F0F1A] leading-snug truncate" title={ad.ad_name}>{ad.ad_name}</p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {hasLink ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openAdDestination(destination)
                }}
                className="inline-flex"
              >
                <CreativeTypeBadge creativeType={ad.creative_type} />
              </button>
            ) : (
              <CreativeTypeBadge creativeType={ad.creative_type} />
            )}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-2">{ad.campaign_name || '—'}</p>

          {hasLink && (
            <a
              href={destination}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {isVideo ? 'View on Facebook' : 'Preview Ad'}
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdCreatives() {
  const { data, loading, error } = useAdPerformance()
  const ads = data
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
    return matchesFilter(ad, activeFilter)
  })

  // Count per filter for badge numbers
  const counts = ads ? FILTER_CHIPS.reduce((acc, chip) => {
    acc[chip.id] = ads.filter(a => matchesFilter(a, chip.id)).length
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
            onClick={() => setActiveFilter(current => current === chip.id ? 'all' : chip.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${chip.color} ${activeFilter === chip.id ? 'shadow-sm ring-2 ring-offset-1 ring-current opacity-100' : 'opacity-70 hover:opacity-100'}`}
          >
            {chip.label}
            <span className="ml-0.5 bg-current bg-opacity-20 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {counts[chip.id] ?? 0}
            </span>
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
                const statusDisplay = getAdStatusDisplay(ad.status)
                const hookRate = getHookRateValue(ad)
                const watchThrough = getWatchThroughValue(ad)
                const isVideo = ad.creative_type === 'VIDEO'
                const adDetails = [
                  { label: 'Total Impressions', value: ad.total_impressions?.toLocaleString() || '—' },
                  { label: 'Avg Frequency', value: ad.avg_frequency != null ? Number(ad.avg_frequency).toFixed(2) : '—' },
                  { label: 'CTR', value: ad.avg_ctr != null ? `${formatDecimal(ad.avg_ctr)}%` : '—' },
                  { label: 'Cost per Lead', value: ad.cost_per_lead ? `AED ${Number(ad.cost_per_lead).toLocaleString()}` : '—' },
                  { label: 'Cost per Active', value: ad.cost_per_active ? `AED ${Number(ad.cost_per_active).toLocaleString()}` : '—' },
                  ...(isVideo ? [
                    { label: 'Hook Rate', value: ad.hook_rate_pct != null ? `${ad.hook_rate_pct}%` : '—', bordered: true },
                    { label: 'Watch-Through', value: ad.watch_through_pct != null ? `${ad.watch_through_pct}%` : '—' },
                  ] : []),
                ]
                const rowAccent = classification === 'action' ? 'border-l-2 border-l-red-400' :
                                  classification === 'best' ? 'border-l-2 border-l-green-400' :
                                  classification === 'revamp' ? 'border-l-2 border-l-purple-400' : ''
                return (
                  <>
                    <tr
                      key={ad.ad_id}
                      className={`border-t border-[#F3F4F6] hover:bg-[#FAFAFA] cursor-pointer transition-colors ${!statusDisplay.isActive ? 'opacity-60' : ''} ${rowAccent}`}
                      onClick={() => setExpandedId(expandedId === ad.ad_id ? null : ad.ad_id)}
                    >
                      <td className="px-4 py-3 font-medium text-[#0F0F1A]">
                        <div className="flex items-center gap-3 min-w-0">
                          <CreativeThumbnail ad={ad} />
                          <div className="min-w-0">
                            <div className="truncate">{ad.ad_name}</div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <CreativeTypeBadge creativeType={ad.creative_type} />
                              {classification === 'action' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">ACTION</span>}
                              {classification === 'best' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">BEST</span>}
                              {classification === 'revamp' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">REVAMP</span>}
                              {classification === 'removal' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">REMOVE</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusDisplay.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDisplay.dot}`} />
                          {statusDisplay.label}
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
                      <td className={`px-4 py-3 ${getFreqColor(ad.avg_frequency)}`}>{formatDecimal(ad.avg_frequency)}</td>
                      <td className="px-4 py-3">{ad.avg_ctr != null ? `${formatDecimal(ad.avg_ctr)}%` : '—'}</td>
                      <td className={`px-4 py-3 ${getHookRateColor(hookRate)}`}>{hookRate != null ? `${formatDecimal(hookRate)}%` : '—'}</td>
                      <td className={`px-4 py-3 ${getWatchThroughColor(watchThrough)}`}>{watchThrough != null ? `${formatDecimal(watchThrough)}%` : '—'}</td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {expandedId === ad.ad_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {expandedId === ad.ad_id && (
                      <tr key={`${ad.ad_id}-expanded`} className="border-t border-[#F3F4F6] bg-[#FAFAFA]">
                        <td colSpan={14} className="px-6 py-4">
                          <div className="flex w-full flex-col gap-4 overflow-hidden xl:flex-row xl:flex-wrap 2xl:flex-nowrap">
                            <div className="w-full shrink-0 xl:w-[250px]">
                              <ExpandedCreativePreview ad={ad} />
                            </div>
                            <div className="min-w-0 flex-1 xl:max-w-[450px]">
                              <p className="text-xs font-semibold text-[#6B7280] mb-3">PERFORMANCE BREAKDOWN</p>
                              <div className="max-w-[380px]">
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
                            </div>
                            <div className="min-w-0 shrink-0 xl:w-full 2xl:w-[280px] 2xl:basis-[280px]">
                              <p className="text-xs font-semibold text-[#6B7280] mb-3">AD DETAILS</p>
                              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px] xl:max-w-[560px] 2xl:max-w-none">
                                {adDetails.map(({ label, value, bordered }) => (
                                  <Fragment key={label}>
                                    {bordered && <div className="col-span-2 mt-1 border-t border-[#E5E7EB] pt-1" />}
                                    <span className="text-[#6B7280]">{label}</span>
                                    <span className="text-right font-semibold text-[#0F0F1A] whitespace-nowrap">{value || '—'}</span>
                                  </Fragment>
                                ))}
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
