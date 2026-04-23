import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'
import { useSupabaseQuery } from './useSupabaseQuery'

const fallbackOverview = {
  client_id: 'mock',
  client_name: 'ConvoFlow UK',
  total_leads: 93,
  meetings_booked: 13,
  showed_up: 8,
  active_opportunities: 6,
  closed_won: 1,
  closed_lost: 0,
  no_shows: 5,
  disqualified: 24,
  not_interested: 0,
  wrong_numbers: 12,
  total_spend: 9194,
  closed_revenue: 24000,
  pipeline_value: 45000,
  cost_per_lead: 98.86,
  cost_per_meeting: 707.23,
  cost_per_active: 1532.33,
  show_rate: 61.5,
  meeting_rate: 14,
  roas: 2.6,
}

export function useDashboardOverview(dateFrom, dateTo, paidOnly = true) {
  const currentClientId = useDashboard(s => s.currentClientId)
  const refreshKey = useDashboard(s => s.refreshKey)

  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('dashboard_overview', {
        p_client_id: currentClientId,
        p_from: dateFrom,
        p_to: dateTo,
        p_paid_only: paidOnly,
      })

      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error }
    },
    [currentClientId, dateFrom, dateTo, paidOnly, refreshKey],
    fallbackOverview
  )
}
