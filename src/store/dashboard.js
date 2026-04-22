import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { subDays, startOfDay, endOfDay, format } from 'date-fns'

const getPresetRange = (preset) => {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: format(startOfDay(now), 'yyyy-MM-dd'), to: format(endOfDay(now), 'yyyy-MM-dd') }
    case 'last_7_days':
      return { from: format(subDays(now, 7), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'last_30_days':
      return { from: format(subDays(now, 30), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'this_month':
      return { from: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    default:
      return { from: format(subDays(now, 7), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
  }
}

export const useDashboard = create(
  persist(
    (set) => ({
      currentClientId: 'ca5a5257-9217-4d06-990e-b789cb233ac0',
      currentClientName: 'ConvoFlow UK',
      dateRange: { preset: 'last_7_days', ...getPresetRange('last_7_days') },
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
