import { useLocation } from 'react-router-dom'
import { useDashboard } from '../../store/dashboard'
import { FileDown } from 'lucide-react'

const pageTitles = {
  '/home': 'Home',
  '/creative-performance': 'Creative Performance',
  '/sarahs-performance': "Sarah's Performance",
  '/sales-performance': 'Sales Performance',
  '/revenue': 'Revenue & ROI',
  '/week-over-week': 'Week-over-Week',
  '/target-progress': 'Target Progress',
  '/lead-tracker': 'Lead Tracker',
  '/settings': 'Settings',
}

const presets = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
]

export default function Header() {
  const location = useLocation()
  const { dateRange, setDatePreset } = useDashboard()
  const title = pageTitles[location.pathname] || 'Dashboard'

  return (
    <div className="fixed top-0 left-[220px] right-0 h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 z-30">
      <h1 className="text-lg font-bold text-[#0F0F1A]">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Date presets */}
        <div className="flex items-center gap-1 bg-[#F3F4F6] rounded-lg p-1">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setDatePreset(p.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                dateRange.preset === p.id
                  ? 'bg-white text-[#EC4899] shadow-sm'
                  : 'text-[#6B7280] hover:text-[#333333]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>


        {/* PDF export */}
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
        >
          <FileDown size={13} />
          Export PDF
        </button>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-[#EC4899] flex items-center justify-center">
          <span className="text-white text-xs font-bold">M</span>
        </div>
      </div>
    </div>
  )
}
