import { useEffect } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard, Megaphone, Bot, Users, DollarSign,
  TrendingUp, Target, Search, MessageCircle, Settings, ChevronDown, LogOut,
  Headphones, ScanSearch
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
  { to: '/sarahs-performance', label: "Sarah's Performance", icon: Bot },
  { to: '/week-over-week', label: 'Week-over-Week', icon: TrendingUp },
  { to: '/target-progress', label: 'Target Progress', icon: Target },
  { to: '/lead-tracker', label: 'Lead Tracker', icon: Search },
  { to: '/conversations', label: 'Conversations', icon: MessageCircle },
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
    <div className="fixed left-0 top-0 h-full w-[220px] bg-white border-r border-[#E5E7EB] flex flex-col z-40">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-center">
        <img src="/convoflow-logo-v2.jpg" alt="ConvoFlow" className="max-h-20 w-auto object-contain" />
      </div>

      {/* Client selector */}
      <div className="px-3 py-3 border-b border-[#E5E7EB]">
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
            <span className="truncate">{label}</span>
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
            <span>Settings</span>
          </NavLink>
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-[#E5E7EB]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-[#EC4899] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#333333] truncate">Mark</p>
            <p className="text-[10px] text-[#9CA3AF]">Admin</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#DC2626] transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </div>
  )
}
