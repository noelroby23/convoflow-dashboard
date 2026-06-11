import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MessageCircle, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DEFAULT_CLIENT_ID, useDashboard } from '../store/dashboard'

const PAGE_SIZE = 50

const TEMPERATURES = [
  { id: 'hot', label: 'Hot', icon: '🔥', color: '#EF4444' },
  { id: 'warm', label: 'Warm', icon: '☀️', color: '#F59E0B' },
  { id: 'cold', label: 'Cold', icon: '❄️', color: '#3B82F6' },
  { id: 'ghosting', label: 'Ghosting', icon: '👻', color: '#6B7280' },
  { id: 'no_response', label: 'No Response', icon: '📭', color: '#374151' },
]

const TEMPERATURE_BY_ID = Object.fromEntries(TEMPERATURES.map(temperature => [temperature.id, temperature]))

function formatTemperature(value) {
  return TEMPERATURE_BY_ID[value]?.label ?? 'Unknown'
}

function formatRelativeHours(value) {
  if (value == null || value === '') return 'No inbound yet'

  const hours = Number(value)
  if (!Number.isFinite(hours)) return 'No inbound yet'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`

  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`

  const months = Math.round(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

function truncate(value, maxLength = 80) {
  if (!value) return 'No message body'
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}...`
}

function getDirectionArrow(direction) {
  return direction === 'inbound' ? '←' : direction === 'outbound' ? '→' : ''
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.filter(Boolean)
  if (!tags) return []
  return String(tags).split(',').map(tag => tag.trim()).filter(Boolean)
}

function ConversationSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1320] p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-white/10" />
        <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        <div className="ml-auto h-5 w-16 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="grid grid-cols-5 gap-4">
        <div className="h-4 animate-pulse rounded bg-white/10" />
        <div className="h-4 animate-pulse rounded bg-white/10" />
        <div className="h-4 animate-pulse rounded bg-white/10 col-span-2" />
        <div className="h-4 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  )
}

export default function ConversationsPage() {
  const currentClientId = useDashboard(s => s.currentClientId)
  const refreshKey = useDashboard(s => s.refreshKey)
  const clientId = currentClientId || DEFAULT_CLIENT_ID
  const [temperatureFilter, setTemperatureFilter] = useState('all')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [conversations, setConversations] = useState([])
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summaryError, setSummaryError] = useState(null)

  useEffect(() => {
    setPage(0)
  }, [clientId, temperatureFilter, directionFilter])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase.rpc('get_conversations', {
      p_client_id: clientId,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
      p_temperature: temperatureFilter === 'all' ? null : temperatureFilter,
      p_direction: directionFilter === 'all' ? null : directionFilter,
    }).then(({ data, error }) => {
      if (cancelled) return

      if (error) {
        setError(error.message)
        setConversations([])
      } else {
        const sorted = [...(data ?? [])].sort((a, b) => String(b.last_message_date ?? '').localeCompare(String(a.last_message_date ?? '')))
        setConversations(sorted)
      }

      setLoading(false)
    }).catch(err => {
      if (cancelled) return
      setError(err.message)
      setConversations([])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [clientId, directionFilter, page, refreshKey, temperatureFilter])

  useEffect(() => {
    let cancelled = false
    setSummaryLoading(true)
    setSummaryError(null)

    supabase.rpc('get_temperature_summary', {
      p_client_id: clientId,
    }).then(({ data, error }) => {
      if (cancelled) return

      if (error) {
        setSummaryError(error.message)
        setSummary([])
      } else {
        setSummary(data ?? [])
      }

      setSummaryLoading(false)
    }).catch(err => {
      if (cancelled) return
      setSummaryError(err.message)
      setSummary([])
      setSummaryLoading(false)
    })

    return () => { cancelled = true }
  }, [clientId, refreshKey])

  const summaryCounts = useMemo(() => {
    return TEMPERATURES.reduce((counts, temperature) => {
      const row = summary.find(item => item.temperature === temperature.id)
      counts[temperature.id] = Number(row?.count ?? 0)
      return counts
    }, {})
  }, [summary])

  const filteredConversations = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    if (!searchTerm) return conversations

    return conversations.filter(conversation => (
      conversation.contact_name?.toLowerCase().includes(searchTerm) ||
      conversation.phone?.toLowerCase().includes(searchTerm)
    ))
  }, [conversations, search])

  const totalCount = Number(conversations[0]?.total_count ?? 0)
  const startCount = totalCount === 0 ? 0 : page * PAGE_SIZE + 1
  const endCount = Math.min((page + 1) * PAGE_SIZE, totalCount)
  const hasNextPage = totalCount > (page + 1) * PAGE_SIZE
  const hasPreviousPage = page > 0

  return (
    <div className="-m-6 min-h-[calc(100vh-64px)] bg-[#070a12] p-4 text-slate-100 sm:p-6" style={{ fontFamily: 'DM Sans, Outfit, sans-serif' }}>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#D85A30]">GHL Conversations</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Conversation temperature</h2>
          <p className="mt-1 text-sm text-slate-400">Read-only view of synced conversations linked to contacts.</p>
        </div>
        <div className="rounded-full border border-[#D85A30]/30 bg-[#D85A30]/10 px-3 py-1 text-xs font-semibold text-[#F9B196]">
          Syncs every 30 minutes
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
        {TEMPERATURES.map(temperature => {
          const isActive = temperatureFilter === temperature.id
          return (
            <button
              key={temperature.id}
              type="button"
              onClick={() => setTemperatureFilter(temperature.id)}
              className="rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
              style={{
                borderColor: isActive ? temperature.color : 'rgba(255,255,255,0.1)',
                background: isActive ? `${temperature.color}18` : 'rgba(13,19,32,0.92)',
                boxShadow: isActive ? `0 0 0 1px ${temperature.color}55, 0 18px 40px rgba(0,0,0,0.22)` : 'none',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xl" aria-hidden="true">{temperature.icon}</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: temperature.color, backgroundColor: `${temperature.color}18` }}>
                  {formatTemperature(temperature.id)}
                </span>
              </div>
              <p className="mt-5 text-3xl font-bold text-white" style={{ fontFamily: 'DM Mono, monospace' }}>
                {summaryLoading ? '-' : summaryCounts[temperature.id].toLocaleString()}
              </p>
            </button>
          )
        })}
      </div>

      {summaryError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Failed to load temperature summary. {summaryError}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0d1320] p-3 lg:flex-row lg:items-center">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-400">
          Temperature
          <select
            value={temperatureFilter}
            onChange={event => setTemperatureFilter(event.target.value)}
            className="min-w-[180px] rounded-xl border border-white/10 bg-[#070a12] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-[#D85A30]"
          >
            <option value="all">All</option>
            {TEMPERATURES.map(temperature => <option key={temperature.id} value={temperature.id}>{temperature.label}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-400">
          Direction
          <select
            value={directionFilter}
            onChange={event => setDirectionFilter(event.target.value)}
            className="min-w-[160px] rounded-xl border border-white/10 bg-[#070a12] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-[#D85A30]"
          >
            <option value="all">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </label>

        <label className="relative flex flex-1 flex-col gap-1 text-xs font-semibold text-slate-400">
          Search
          <Search size={15} className="absolute bottom-2.5 left-3 text-slate-500" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search contact or phone..."
            className="w-full rounded-xl border border-white/10 bg-[#070a12] py-2 pl-9 pr-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-[#D85A30]"
          />
        </label>

        <button
          type="button"
          onClick={() => setTemperatureFilter('all')}
          className="self-end rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5"
        >
          Clear temp
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1320] shadow-2xl shadow-black/20">
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['Contact Name', 'Phone', 'Pipeline Stage', 'Last Message', 'Last Reply', 'Unread Count', 'Tags'].map(heading => (
                  <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                [...Array(6)].map((_, index) => (
                  <tr key={index}>
                    <td colSpan={7} className="px-4 py-4"><ConversationSkeleton /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-red-200">Failed to load conversations. {error}</td>
                </tr>
              ) : !filteredConversations.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <EmptyState />
                  </td>
                </tr>
              ) : filteredConversations.map(conversation => <ConversationRow key={conversation.ghl_conversation_id || conversation.ghl_contact_id} conversation={conversation} />)}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 xl:hidden">
          {loading ? (
            [...Array(6)].map((_, index) => <ConversationSkeleton key={index} />)
          ) : error ? (
            <div className="px-4 py-12 text-center text-sm text-red-200">Failed to load conversations. {error}</div>
          ) : !filteredConversations.length ? (
            <div className="py-12"><EmptyState /></div>
          ) : filteredConversations.map(conversation => <ConversationCard key={conversation.ghl_conversation_id || conversation.ghl_contact_id} conversation={conversation} />)}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0d1320] px-4 py-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {loading ? 'Loading conversations...' : `Showing ${startCount.toLocaleString()}-${endCount.toLocaleString()} of ${totalCount.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(currentPage => Math.max(0, currentPage - 1))}
            disabled={!hasPreviousPage || loading}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 font-semibold text-slate-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="rounded-xl bg-white/5 px-3 py-2 font-mono text-xs text-slate-300">Page {page + 1}</span>
          <button
            type="button"
            onClick={() => setPage(currentPage => currentPage + 1)}
            disabled={!hasNextPage || loading}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 font-semibold text-slate-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ConversationRow({ conversation }) {
  const temperature = TEMPERATURE_BY_ID[conversation.temperature] ?? TEMPERATURE_BY_ID.no_response
  const tags = normalizeTags(conversation.tags)
  const visibleTags = tags.slice(0, 3)
  const extraTags = tags.length - visibleTags.length
  const unreadCount = Number(conversation.unread_count ?? 0)

  return (
    <tr className="transition-colors hover:bg-white/[0.03]">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: temperature.color }} />
          <div>
            <p className="font-bold text-white">{conversation.contact_name || 'Unknown Contact'}</p>
            <p className="text-xs text-slate-500">{formatTemperature(conversation.temperature)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-slate-300" style={{ fontFamily: 'DM Mono, monospace' }}>{conversation.phone || '-'}</td>
      <td className="px-4 py-4"><StagePill stage={conversation.mapped_current_stage} /></td>
      <td className="max-w-[340px] px-4 py-4 text-slate-300">
        <span className="mr-2 font-mono text-[#D85A30]">{getDirectionArrow(conversation.last_message_direction)}</span>
        {truncate(conversation.last_message_body)}
      </td>
      <td className="px-4 py-4 text-slate-300" style={{ fontFamily: 'DM Mono, monospace' }}>{formatRelativeHours(conversation.hours_since_last_inbound)}</td>
      <td className="px-4 py-4">{unreadCount > 0 ? <UnreadBadge count={unreadCount} /> : <span className="text-slate-600">-</span>}</td>
      <td className="px-4 py-4"><TagList tags={visibleTags} extraTags={extraTags} /></td>
    </tr>
  )
}

function ConversationCard({ conversation }) {
  const temperature = TEMPERATURE_BY_ID[conversation.temperature] ?? TEMPERATURE_BY_ID.no_response
  const tags = normalizeTags(conversation.tags)
  const visibleTags = tags.slice(0, 3)
  const extraTags = tags.length - visibleTags.length
  const unreadCount = Number(conversation.unread_count ?? 0)

  return (
    <article className="rounded-2xl border border-white/10 bg-[#070a12] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: temperature.color }} />
          <div>
            <p className="font-bold text-white">{conversation.contact_name || 'Unknown Contact'}</p>
            <p className="text-xs text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>{conversation.phone || '-'}</p>
          </div>
        </div>
        {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: temperature.color, backgroundColor: `${temperature.color}18` }}>
          {formatTemperature(conversation.temperature)}
        </span>
        <StagePill stage={conversation.mapped_current_stage} />
      </div>
      <p className="text-sm text-slate-300">
        <span className="mr-2 font-mono text-[#D85A30]">{getDirectionArrow(conversation.last_message_direction)}</span>
        {truncate(conversation.last_message_body)}
      </p>
      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>{formatRelativeHours(conversation.hours_since_last_inbound)}</span>
        <TagList tags={visibleTags} extraTags={extraTags} />
      </div>
    </article>
  )
}

function StagePill({ stage }) {
  return (
    <span className="inline-flex max-w-[220px] items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-300">
      <span className="truncate">{stage || 'No stage'}</span>
    </span>
  )
}

function UnreadBadge({ count }) {
  return <span className="inline-flex items-center rounded-full bg-[#D85A30] px-2 py-0.5 text-xs font-bold text-white">{count}</span>
}

function TagList({ tags, extraTags }) {
  if (!tags.length && extraTags <= 0) return <span className="text-slate-600">-</span>

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => (
        <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-slate-400">
          {tag}
        </span>
      ))}
      {extraTags > 0 && (
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          +{extraTags}
        </span>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-500">
        <MessageCircle size={22} />
      </div>
      <p className="text-sm font-semibold text-slate-300">No conversations synced yet. Data syncs every 30 minutes.</p>
    </div>
  )
}
