import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { subDays, subMonths, subQuarters, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfWeek, endOfWeek, format } from 'date-fns'

export const DEFAULT_DATE_PRESET = 'this_month'
export const ALL_TIME_START = '2020-01-01'

export const DATE_RANGE_PRESETS = [
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_14_days', label: 'Last 14 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_quarter', label: 'Last Quarter' },
  { id: 'all_time', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
]

export const getPresetRange = (preset) => {
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const yesterday = format(subDays(now, 1), 'yyyy-MM-dd')
      return { from: yesterday, to: yesterday }
    }
    case 'last_7_days':
      return { from: format(subDays(now, 6), 'yyyy-MM-dd'), to: today }
    case 'last_14_days':
      return { from: format(subDays(now, 13), 'yyyy-MM-dd'), to: today }
    case 'last_30_days':
      return { from: format(subDays(now, 29), 'yyyy-MM-dd'), to: today }
    case 'this_week':
      return {
        from: format(startOfWeek(now), 'yyyy-MM-dd'),
        to: format(endOfWeek(now), 'yyyy-MM-dd'),
      }
    case 'last_week': {
      const lastWeek = subDays(startOfWeek(now), 1)
      return {
        from: format(startOfWeek(lastWeek), 'yyyy-MM-dd'),
        to: format(endOfWeek(lastWeek), 'yyyy-MM-dd'),
      }
    }
    case 'this_month':
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: today }
    case 'last_month': {
      const lastMonth = subMonths(now, 1)
      return {
        from: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        to: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      }
    }
    case 'last_quarter': {
      const lastQuarter = subQuarters(now, 1)
      return {
        from: format(startOfQuarter(lastQuarter), 'yyyy-MM-dd'),
        to: format(endOfQuarter(lastQuarter), 'yyyy-MM-dd'),
      }
    }
    case 'all_time':
      return { from: ALL_TIME_START, to: today }
    default:
      return { from: format(subDays(now, 29), 'yyyy-MM-dd'), to: today }
  }
}

export const useDashboard = create(
  persist(
    (set) => ({
      currentClientId: 'ca5a5257-9217-4d06-990e-b789cb233ac0',
      currentClientName: 'ConvoFlow UK',
      dateRange: { preset: DEFAULT_DATE_PRESET, ...getPresetRange(DEFAULT_DATE_PRESET) },
      refreshKey: 0,
      reportBuilder: null,
      reportContent: null,
      isReportOpen: false,
      setClient: (id, name) => set({ currentClientId: id, currentClientName: name }),
      setDatePreset: (preset) => set({ dateRange: { preset, ...getPresetRange(preset) } }),
      setCustomDateRange: (from, to) => set({ dateRange: { preset: 'custom', from, to } }),
      refresh: () => set(state => ({ refreshKey: state.refreshKey + 1 })),
      setReportBuilder: (fn) => set({ reportBuilder: fn }),
      openReport: () => set(state => {
        const content = state.reportBuilder?.()
        return content ? { reportContent: content, isReportOpen: true } : {}
      }),
      closeReport: () => set({ isReportOpen: false }),
    }),
    {
      name: 'convoflow-dashboard-store-v2',
      partialize: (state) => ({ currentClientId: state.currentClientId, dateRange: state.dateRange }),
    }
  )
)
