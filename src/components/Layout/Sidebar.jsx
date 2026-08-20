import { useEffect } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard, Megaphone, Bot, Users, DollarSign,
  TrendingUp, Target, Search, MessageCircle, Settings, ChevronDown, LogOut,
  Headphones, ScanSearch, Banknote, RefreshCcwDot
} from 'lucide-react'
import { DEFAULT_CLIENT_ID, DEFAULT_CLIENT_NAME, useDashboard } from '../../store/dashboard'
import { useClients } from '../../hooks/useDashboardData'

// Creative Performance, Sales Performance and Revenue & ROI are deliberately
// absent (Abdus, 2026-08-07 — "leave these 3 pages for phase 2").
//
// They are not hidden because they are broken. They need data cf does not
// hold and no rewiring can invent: Meta ad spend, per-deal value, and a
// sales-rep model. Their routes still resolve, so a bookmark keeps working —
// only the nav entries are gone, so nobody clicks into a page that can only
// ever show zeros.
const navItems = [
  { to: '/home', label: 'Home', icon: LayoutDashboard },
  { to: '/lead-desk', label: 'Lead Desk', icon: Headphones },
  { to: '/lead-lookup', label: 'Lead Lookup', icon: ScanSearch },
  // Everything after the booking: meeting outcomes and the sales pipeline.
  { to: '/sales-desk', label: 'Sales Desk', icon: Banknote },
  // The old database, called again. Its own page because the question it
  // answers is not "where is this lead" but "why is the campaign quiet" —
  // the launch gate, the kill criteria and the pacer's decision log.
  { to: '/reactivation', label: 'Reactivation', icon: RefreshCcwDot },
  // Back from phase 2: cf now holds Meta spend and per-lead ad attribution
  // (migrations 033/034), so this page has real data behind it again.
  { to: '/creative-performance', label: 'Creative Performance', icon: Megaphone },
  { to: '/sarahs-performance', label: "Sarah's Performance", icon: Bot },
  { to: '/week-over-week', label: 'Week-over-Week', icon: TrendingUp },
  { to: '/target-progress', label: 'Target Progress', icon: Target },
  // Lead Tracker removed: the Lead Desk board carries the same list with
  // search, stage filters and CSV export, and clicking a row now opens the
  // full record. Two pages showing one list is two places to look.
  // Conversations removed from the nav: the whole thread now lives on the
  // lead itself, and a separate page for half the story is a second place
  // to look. The route still resolves so old bookmarks keep working.
]

export default function Sidebar({ onLogout }) {
  const { currentClientId, currentClientName, setClient } = useDashboard()
  const { data: clients } = useClients()
  const [searchParams, setSearchParams] = useSearchParams()
  const realClients = clients ?? []
  const clientParam = searchParams.get('client')
  const urlClientId = clientParam === 'all' ? null : (clientParam || DEFAULT_CLIENT_ID)
  const urlClient = realClients.find(client => client.client_id === urlClientId)
  const navSearch = clientParam ? `client=${encodeURIComponent(clientParam)}` : ''
  const hasCurrentClient = currentClientId && realClients.some(client => client.client_id === currentClientId)
  const clientOptions = [
    { client_id: null, client_name: 'All Markets' },
    ...(!currentClientId || hasCurrentClient ? [] : [{ client_id: currentClientId, client_name: currentClientName || 'Current Market' }]),
    ...realClients,
  ]

  useEffect(() => {
    if (!clientParam) {
      const nextParams = new URLSearchParams()
      nextParams.set('client', DEFAULT_CLIENT_ID)
      setSearchParams(nextParams, { replace: true })
    }

    const urlClientName = urlClientId === null
      ? 'All Markets'
      : urlClient?.client_name || (urlClientId === DEFAULT_CLIENT_ID ? DEFAULT_CLIENT_NAME : 'Current Market')

    if ((currentClientId ?? null) !== (urlClientId ?? null) || currentClientName !== urlClientName) {
      setClient(urlClientId, urlClientName)
    }
  }, [clientParam, currentClientId, currentClientName, setClient, setSearchParams, urlClient?.client_name, urlClientId])

  const handleClientChange = (event) => {
    const nextClientId = event.target.value || null
    const nextClient = clientOptions.find(client => (client.client_id ?? '') === (nextClientId ?? ''))
    setClient(nextClient?.client_id ?? null, nextClient?.client_name ?? 'All Markets')
    const nextParams = new URLSearchParams()
    nextParams.set('client', nextClientId || 'all')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="cf-rail">
      {/* Logo removed at Abdus's request until a better asset is supplied.
          A wordmark that has to be colour-corrected to survive a dark
          panel is the wrong asset, not a styling problem. */}

      {/* Client selector */}
      <div className="px-3 py-3 border-b border-[#E5E7EB] cf-rail__hide">
        <div className="relative">
          <select
            value={currentClientId ?? ''}
            onChange={handleClientChange}
            className="w-full appearance-none rounded-lg bg-[#F3F4F6] px-3 py-2 pr-8 text-xs font-semibold text-[#333333] outline-none transition-colors hover:bg-[#E5E7EB] focus:ring-2 focus:ring-pink-100"
          >
            {clientOptions.map(client => (
              <option key={client.client_id ?? 'all-markets'} value={client.client_id ?? ''}>
                {client.client_name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={{ pathname: to, search: navSearch ? `?${navSearch}` : '' }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-pink-50 text-[#EC4899] border-l-2 border-[#EC4899] pl-[10px]'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#333333]'
              }`
            }
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="truncate cf-rail__label">{label}</span>
          </NavLink>
        ))}

        {/* Settings (admin) */}
        <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
          <NavLink
            to={{ pathname: '/settings', search: navSearch ? `?${navSearch}` : '' }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-pink-50 text-[#EC4899] border-l-2 border-[#EC4899] pl-[10px]'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#333333]'
              }`
            }
          >
            <Settings size={16} />
            <span className="cf-rail__label">Settings</span>
          </NavLink>
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-[#E5E7EB]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-[#EC4899] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div className="flex-1 min-w-0 cf-rail__hide">
            <p className="text-xs font-semibold text-[#333333] truncate">Mark</p>
            <p className="text-[10px] text-[#9CA3AF]">Admin</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#DC2626] transition-colors"
        >
          <LogOut size={13} className="flex-shrink-0" />
          <span className="cf-rail__label">Sign out</span>
        </button>
      </div>
    </div>
  )
}
