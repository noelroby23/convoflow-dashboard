import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'
import { useSupabaseQuery } from './useSupabaseQuery'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

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
      const { data, error } = await supabase.rpc('dashboard_kpis', {
        start_date: dateFrom,
        end_date: dateTo,
        p_client_id: currentClientId,
      })

      if (error) return { data: null, error }

      const row = Array.isArray(data) ? (data[0] ?? null) : data
      if (!row) return { data: null, error: null }

      const totalSpend = Number(row.total_spend ?? 0)
      const totalLeads = Number(row.total_leads ?? 0)
      const meetingsBooked = Number(row.meetings_booked ?? 0)
      const showedUp = Number(row.showed_up ?? 0)
      const activeOpps = Number(row.active_opportunities ?? 0)
      const closedWon = Number(row.closed_won ?? 0)
      const closedRevenue = Number(row.deal_value ?? row.closed_revenue ?? 0)

      return {
        data: {
          ...row,
          total_spend: totalSpend,
          total_leads: totalLeads,
          meetings_booked: meetingsBooked,
          showed_up: showedUp,
          active_opportunities: activeOpps,
          closed_won: closedWon,
          closed_revenue: closedRevenue,
          cost_per_lead: totalLeads > 0 ? totalSpend / totalLeads : 0,
          cost_per_meeting: meetingsBooked > 0 ? totalSpend / meetingsBooked : 0,
          cost_per_active: activeOpps > 0 ? totalSpend / activeOpps : 0,
          show_rate: meetingsBooked > 0 ? (showedUp / meetingsBooked) * 100 : 0,
          meeting_rate: totalLeads > 0 ? (meetingsBooked / totalLeads) * 100 : 0,
          roas: totalSpend > 0 ? closedRevenue / totalSpend : 0,
        },
        error: null,
      }

    },
    [currentClientId, dateFrom, dateTo, paidOnly, refreshKey],
    USE_MOCK ? fallbackOverview : null
  )
}
