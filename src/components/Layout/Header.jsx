import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useDashboard } from '../../store/dashboard'
import { FileDown, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { triggerRefresh } from '../../lib/triggerRefresh'
import { useDailyAISummary } from '../../context/DailyAISummaryContext'
import DateRangePicker from '../DateRangePicker'

const pageTitles = {
  '/home': 'Home',
  '/creative-performance': 'Creative Performance',
  '/sarahs-performance': "Sarah's Performance",
  '/sales-performance': 'Sales Performance',
  '/revenue': 'Revenue & ROI',
  '/week-over-week': 'Week-over-Week',
  '/target-progress': 'Target Progress',
  '/lead-tracker': 'Lead Tracker',
  '/conversations': 'Conversations',
  '/settings': 'Settings',
}

export default function Header() {
  const location = useLocation()
  const { currentClientId, refresh, openReport } = useDashboard()
  const { regenerate } = useDailyAISummary()
  const title = pageTitles[location.pathname] || 'Dashboard'
  const isSettings = location.pathname === '/settings'
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)

    try {
      const { ok, data } = await triggerRefresh('all', currentClientId)
      const refreshStatus = data?.status

      if (!ok) {
        toast.error(`Refresh failed: ${data?.error || 'Unknown error'}`)
        return
      }

      if (refreshStatus === 'duplicate_recent_request') {
        toast.info('Just refreshed, please wait a minute before trying again')
        return
      }

      toast.info('Syncing latest data from GHL and Meta...')
      await new Promise(resolve => setTimeout(resolve, 10000))
      refresh()
      regenerate()

      if (refreshStatus === 'partial') {
        toast.warning('Partial refresh — some sources failed')
        return
      }

      toast.success('Data updated')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="cf-topbar justify-between px-6 w-auto">
      <h1 className="text-lg font-bold text-[#0F0F1A]">{title}</h1>

      <div className="flex items-center gap-3">
        <DateRangePicker />

        {!isSettings && (
          <>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="no-print flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={openReport}
              className="no-print flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            >
              <FileDown size={13} />
              AI Report
            </button>
          </>
        )}

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-[#EC4899] flex items-center justify-center">
          <span className="text-white text-xs font-bold">M</span>
        </div>
      </div>
    </div>
  )
}
