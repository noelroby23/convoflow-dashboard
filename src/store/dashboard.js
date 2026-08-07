import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { subDays, subMonths, subQuarters, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfWeek, endOfWeek, format } from 'date-fns'

// 'this_month' was the default while the old dashboard was fed daily by the
// Meta and GHL syncs, so the current month always had data in it.
//
// It is the wrong default now. cf holds imported history spanning 2025-12 to
// 2026-08 — 2,633 leads — and August has 13 of them, because v2 has not been
// switched on yet and is generating nothing. Every page therefore opened on a
// window containing 0.5% of the data and looked broken when it was merely
// scoped.
//
// Revisit at cutover: once v2 is live and producing leads daily, a rolling
// window ('last_30_days') becomes the sensible default again.
export const DEFAULT_DATE_PRESET = 'all_time'
export const ALL_TIME_START = '2020-01-01'
export const DEFAULT_CLIENT_ID = 'b7f3e2a1-5c8d-4e9f-a1b2-3c4d5e6f7a8b'
export const DEFAULT_CLIENT_NAME = 'ConvoFlow UAE'

const getInitialClientId = () => {
  if (typeof window === 'undefined') return DEFAULT_CLIENT_ID
  const clientParam = new URLSearchParams(window.location.search).get('client')
  if (clientParam === 'all') return null
  return clientParam || DEFAULT_CLIENT_ID
}

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

const getDubaiNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))

export const getPresetRange = (preset) => {
  const now = getDubaiNow()
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
      currentClientId: getInitialClientId(),
      currentClientName: getInitialClientId() === DEFAULT_CLIENT_ID ? DEFAULT_CLIENT_NAME : 'Current Market',
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
      // v4 drops the persisted dateRange. Anyone who used the dashboard before
      // today has 'this_month' saved in localStorage, and changing
      // DEFAULT_DATE_PRESET alone would never reach them — the stored value
      // wins. They would keep seeing a near-empty August and reasonably
      // conclude the rebuild had not worked.
      version: 4,
      migrate: (state) => {
        if (state) {
          delete state.currentClientId
          delete state.currentClientName
          delete state.dateRange
        }
        return state
      },
      partialize: (state) => ({ dateRange: state.dateRange }),
    }
  )
)
