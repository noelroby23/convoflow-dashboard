import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Megaphone, Bot, Users, DollarSign,
  TrendingUp, Target, Search, Settings, ChevronDown, LogOut
} from 'lucide-react'
import { useDashboard } from '../../store/dashboard'

const navItems = [
  { to: '/home', label: 'Home', icon: LayoutDashboard },
  { to: '/creative-performance', label: 'Creative Performance', icon: Megaphone },
  { to: '/sarahs-performance', label: "Sarah's Performance", icon: Bot },
  { to: '/sales-performance', label: 'Sales Performance', icon: Users },
  { to: '/revenue', label: 'Revenue & ROI', icon: DollarSign },
  { to: '/week-over-week', label: 'Week-over-Week', icon: TrendingUp },
  { to: '/target-progress', label: 'Target Progress', icon: Target },
  { to: '/lead-tracker', label: 'Lead Tracker', icon: Search },
]

export default function Sidebar({ onLogout }) {
  const { currentClientName } = useDashboard()

  return (
    <div className="fixed left-0 top-0 h-full w-[220px] bg-white border-r border-[#E5E7EB] flex flex-col z-40">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-center">
        <img src="/convoflow-logo-v2.jpg" alt="ConvoFlow" className="max-h-20 w-auto object-contain" />
      </div>

      {/* Client selector */}
      <div className="px-3 py-3 border-b border-[#E5E7EB]">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors">
          <span className="text-xs font-semibold text-[#333333] truncate">{currentClientName}</span>
          <ChevronDown size={13} className="text-[#6B7280] flex-shrink-0" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
            to="/settings"
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
