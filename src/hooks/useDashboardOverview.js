import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'
import { useSupabaseQuery } from './useSupabaseQuery'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const mockFallbackOverview = USE_MOCK ? {
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
} : null

export function useDashboardOverview(dateFrom, dateTo) {
  const currentClientId = useDashboard(s => s.currentClientId)
  const refreshKey = useDashboard(s => s.refreshKey)

  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('cf_dash_kpis', {
        p: { region: 'uae', from: dateFrom, to: dateTo },
      })

      if (error) return { data: null, error }

      const row = Array.isArray(data) ? (data[0] ?? null) : data
      if (!row) return { data: null, error: null }

      // Counts are real and default to 0. Money is NOT: an unknown figure must
      // STAY null, because coercing it to 0 renders "AED 0 spent" and a 0%
      // ROAS, which reads as a measured result rather than an absent one.
      // (The old note here said cf has no spend or deal value at all — that
      // was true until migrations 149 and 154; both are now real.)
      const num = (v) => (v == null ? null : Number(v))
      const totalSpend = num(row.total_spend)
      // ⚠️ NOT `deal_value ?? closed_revenue`. Since migration 154 `deal_value`
      // is the AVERAGE won deal, so preferring it showed the average in place
      // of the total — all-time that is AED 7,558 instead of AED 143,600.
      // It only looked right while both were null, and again on a window
      // holding exactly one deal, where the average IS the total.
      const closedRevenue = num(row.closed_revenue)
      const totalLeads = Number(row.total_leads ?? 0)
      const meetingsBooked = Number(row.meetings_booked ?? 0)
      const showedUp = Number(row.showed_up ?? 0)
      const activeOpps = Number(row.active_opportunities ?? 0)

      // Fallback only. Migration 156 computes every cost in SQL, naming its own
      // denominator, so Home and Creative Performance cannot disagree. Dividing
      // here is what made cost per lead AED 34 instead of AED 81: it used all
      // 50 leads when only 21 came from ads, and divided a date-ranged spend by
      // the all-time open-deal count for cost per active opp.
      const perUnit = (n) => (totalSpend == null || !n ? null : totalSpend / n)
      const prefer = (fromDb, fallback) => (fromDb == null ? fallback : Number(fromDb))

      return {
        data: {
          ...row,
          total_spend: totalSpend,
          total_leads: totalLeads,
          meetings_booked: meetingsBooked,
          showed_up: showedUp,
          active_opportunities: activeOpps,
          closed_won: num(row.closed_won),
          closed_revenue: closedRevenue,
          cost_per_lead: prefer(row.cost_per_lead, perUnit(totalLeads)),
          cost_per_meeting: prefer(row.cost_per_meeting, perUnit(meetingsBooked)),
          cost_per_active: prefer(row.cost_per_active_opp, perUnit(activeOpps)),
          show_rate: meetingsBooked > 0 ? (showedUp / meetingsBooked) * 100 : 0,
          meeting_rate: totalLeads > 0 ? (meetingsBooked / totalLeads) * 100 : 0,
          roas: prefer(row.roas, totalSpend && closedRevenue != null ? closedRevenue / totalSpend : null),
        },
        error: null,
      }

    },
    [currentClientId, dateFrom, dateTo, refreshKey],
    mockFallbackOverview
  )
}
