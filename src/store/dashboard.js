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
      currentClientId: 'convoflow-uk',
      currentClientName: 'ConvoFlow UK',
      dateRange: { preset: 'last_7_days', ...getPresetRange('last_7_days') },
      setClient: (id, name) => set({ currentClientId: id, currentClientName: name }),
      setDatePreset: (preset) => set({ dateRange: { preset, ...getPresetRange(preset) } }),
      setCustomDateRange: (from, to) => set({ dateRange: { preset: 'custom', from, to } }),
    }),
    {
      name: 'convoflow-dashboard-store',
      partialize: (state) => ({ currentClientId: state.currentClientId, dateRange: state.dateRange }),
    }
  )
)
