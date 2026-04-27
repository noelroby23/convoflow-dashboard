import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'
import { useSupabaseQuery } from './useSupabaseQuery'
import {
  mockAds, mockLeads, mockTrendsData, mockSalesReps
} from '../data/mockData'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const fallbackFunnel = {
  client_id: 'mock', client_name: 'ConvoFlow UK', total_leads: 93, meetings_booked: 13,
  showed_up: 8, active_opportunities: 6, closed_won: 1, no_shows: 5, disqualified: 24,
  wrong_numbers: 12, total_spend: 9194, closed_revenue: 24000, pipeline_value: 45000,
}

const fallbackAds = mockAds.map(ad => ({
  ad_id: ad.id, client_id: 'mock', ad_name: ad.name, status: ad.status, total_spend: ad.spend,
  total_impressions: ad.impressions, avg_frequency: ad.frequency, avg_ctr: ad.ctr,
  total_leads: ad.leads, meetings_booked: ad.meetings, showed_up: ad.showed,
  active_opportunities: ad.activeOpps, closed_won: ad.closedWon, cost_per_lead: ad.cpl,
  cost_per_active: ad.costPerActive, meta_ad_id: null, creative_url: null, creative_type: null,
  video_url: null, effective_object_story_id: null,
}))

const fallbackContacts = mockLeads.map(lead => ({
  contact_id: lead.id, client_id: 'mock', full_name: lead.name, email: null, phone: null,
  company: lead.company, created_at: lead.date, source_ad: lead.sourceAd,
  current_stage: lead.stage, current_tags: [], call_summary: lead.callSummary,
  call_transcript: null, call_recording_url: null, lead_quality_score: lead.qualityScore,
  hot_lead: lead.qualityScore >= 8, meeting_date: lead.meetingDate, assigned_to: null,
  deal_value: lead.dealValue, dq_reason: null, follow_up_attempts: lead.followUpAttempts,
  last_activity_at: lead.date,
}))

const fallbackLeadTracker = fallbackContacts.map(contact => ({
  ...contact,
  ghl_contact_id: null,
  source: 'Facebook',
  mainflow_stage: contact.current_stage,
  stage_label: contact.current_stage ? contact.current_stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
  ad_name: contact.source_ad,
  campaign_name: null,
  ghl_pipeline_name: null,
  ghl_created_at: contact.created_at,
  status_updated_at: contact.last_activity_at,
  funnel_meeting_booked: ['meeting_booked', 'showed', 'no_show', 'active', 'closed_won', 'closed_lost'].includes(contact.current_stage),
  funnel_showed_up: ['showed', 'active', 'closed_won', 'closed_lost'].includes(contact.current_stage),
  funnel_active_opp: ['showed', 'active'].includes(contact.current_stage),
  funnel_closed_won: contact.current_stage === 'closed_won',
  funnel_closed_lost: contact.current_stage === 'closed_lost',
  funnel_no_show: contact.current_stage === 'no_show',
}))

const fallbackDailyMetrics = mockTrendsData.map(d => ({
  client_id: 'mock', date: d.date, spend: d.spend, impressions: 0, avg_frequency: 1.43,
  clicks: 0, leads: d.leads, meetings_booked: d.meetings, closes: 0,
}))

const fallbackSarahStages = {
  stages: [],
  totalLeads: 0,
  funnelMeetings: 0,
  funnelConversations: 0,
}

const parseDateValue = (value) => {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isWithinDateRange = (value, from, to) => {
  const parsed = parseDateValue(value)
  if (!parsed || !from || !to) return false

  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T23:59:59.999Z`)
  return parsed >= start && parsed <= end
}

const filterRowsByDateRange = (rows, getValue, from, to) => (
  (rows ?? []).filter(row => isWithinDateRange(getValue(row), from, to))
)

const getDateRangeDays = (from, to) => {
  if (!from || !to) return []

  const days = []
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)

  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    days.push(date.toISOString().slice(0, 10))
  }

  return days
}

const fallbackSalesReps = mockSalesReps.map(rep => ({
  client_id: 'mock', sales_rep: rep.name, meetings_scheduled: rep.meetings, shows: rep.shows,
  no_shows: rep.noShows, closes: rep.closes, revenue_closed: rep.closes * 24000,
}))

export function useClients() {
  return useSupabaseQuery(
    () => supabase.from('funnel_summary').select('client_id, client_name'),
    [], [{ client_id: 'mock', client_name: 'ConvoFlow UK' }]
  )
}

export function useFunnelByDate() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('funnel_summary_by_date', {
        p_client_id: currentClientId, p_from: dateRange.from, p_to: dateRange.to, p_paid_only: true,
      })
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], fallbackFunnel
  )
}

export function useFunnelSummary() {
  const { currentClientId, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('funnel_summary_by_date', {
        p_client_id: currentClientId, p_from: '2020-01-01',
        p_to: new Date().toISOString().slice(0, 10), p_paid_only: true,
      })
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error }
    },
    [currentClientId, refreshKey], fallbackFunnel
  )
}

export function useAdPerformance() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const adsResult = await supabase.from('ads').select('*').eq('client_id', currentClientId)
      if (adsResult.error) return { data: null, error: adsResult.error }

      const ads = adsResult.data ?? []
      const adIds = ads.map(ad => ad.id).filter(Boolean)

      const [performanceResult, dailyMetricsResult, leadTrackerResult] = await Promise.all([
        supabase.from('ad_performance').select('*').eq('client_id', currentClientId),
        adIds.length
          ? supabase.from('ad_daily_metrics').select('*').in('ad_id', adIds).gte('date', dateRange.from).lte('date', dateRange.to)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('lead_tracker').select('*').eq('client_id', currentClientId).order('ghl_created_at', { ascending: false, nullsFirst: false }),
      ])

      if (performanceResult.error || dailyMetricsResult.error || leadTrackerResult.error) {
        return { data: null, error: performanceResult.error || dailyMetricsResult.error || leadTrackerResult.error }
      }

      const performanceRows = performanceResult.data ?? []
      const dailyMetricRows = dailyMetricsResult.data ?? []
      const leadRows = filterRowsByDateRange(leadTrackerResult.data, row => row.ghl_created_at || row.created_at, dateRange.from, dateRange.to)

      const adsById = new Map(ads.filter(ad => ad.id).map(ad => [String(ad.id), ad]))
      const adsByMetaAdId = new Map(ads.filter(ad => ad.meta_ad_id).map(ad => [String(ad.meta_ad_id), ad]))

      const dailyMetricsByAdId = new Map()
      for (const row of dailyMetricRows) {
        const adId = String(row.ad_id)
        const current = dailyMetricsByAdId.get(adId) ?? {
          total_spend: 0,
          total_impressions: 0,
          total_clicks: 0,
          frequencySum: 0,
          frequencyCount: 0,
        }

        current.total_spend += Number(row.spend ?? 0)
        current.total_impressions += Number(row.impressions ?? 0)
        current.total_clicks += Number(row.clicks ?? 0)
        if (row.frequency != null) {
          current.frequencySum += Number(row.frequency)
          current.frequencyCount += 1
        }

        dailyMetricsByAdId.set(adId, current)
      }

      const leadMetricsByAdName = new Map()
      for (const row of leadRows) {
        const adName = row.ad_name || row.source_ad
        if (!adName) continue

        const current = leadMetricsByAdName.get(adName) ?? {
          total_leads: 0,
          meetings_booked: 0,
          showed_up: 0,
          active_opportunities: 0,
          closed_won: 0,
        }

        current.total_leads += 1
        if (row.funnel_meeting_booked) current.meetings_booked += 1
        if (row.funnel_showed_up) current.showed_up += 1
        if (row.funnel_active_opp) current.active_opportunities += 1
        if (row.funnel_closed_won) current.closed_won += 1

        leadMetricsByAdName.set(adName, current)
      }

      const merged = performanceRows.map(row => {
        const creative = adsByMetaAdId.get(String(row.meta_ad_id ?? '')) || adsById.get(String(row.ad_id ?? row.id ?? ''))
        const dailyMetrics = dailyMetricsByAdId.get(String(row.ad_id ?? row.id ?? ''))
        const leadMetrics = leadMetricsByAdName.get(row.ad_name) ?? {
          total_leads: 0,
          meetings_booked: 0,
          showed_up: 0,
          active_opportunities: 0,
          closed_won: 0,
        }

        const totalSpend = Number(dailyMetrics?.total_spend ?? 0)
        const totalImpressions = Number(dailyMetrics?.total_impressions ?? 0)
        const totalClicks = Number(dailyMetrics?.total_clicks ?? 0)
        const totalLeads = Number(leadMetrics.total_leads ?? 0)
        const activeOpps = Number(leadMetrics.active_opportunities ?? 0)

        return {
          ...row,
          ad_name: row.ad_name ?? creative?.ad_name ?? null,
          status: row.status ?? creative?.status ?? null,
          campaign_name: row.campaign_name ?? creative?.campaign_name ?? null,
          meta_ad_id: row.meta_ad_id ?? creative?.meta_ad_id ?? null,
          creative_url: row.creative_url ?? creative?.creative_url ?? null,
          creative_type: row.creative_type ?? creative?.creative_type ?? null,
          video_url: row.video_url ?? creative?.video_url ?? null,
          effective_object_story_id: row.effective_object_story_id ?? creative?.effective_object_story_id ?? null,
          fb_post_url: row.fb_post_url ?? creative?.fb_post_url ?? null,
          total_spend: totalSpend,
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          avg_frequency: dailyMetrics?.frequencyCount ? dailyMetrics.frequencySum / dailyMetrics.frequencyCount : 0,
          avg_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          total_leads: totalLeads,
          meetings_booked: Number(leadMetrics.meetings_booked ?? 0),
          showed_up: Number(leadMetrics.showed_up ?? 0),
          active_opportunities: activeOpps,
          closed_won: Number(leadMetrics.closed_won ?? 0),
          cost_per_lead: totalLeads > 0 ? totalSpend / totalLeads : null,
          cost_per_active: activeOpps > 0 ? totalSpend / activeOpps : null,
        }
      })

      return { data: merged, error: null }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], fallbackAds
  )
}

export function useContactDetails(stageFilter = null) {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  const filtered = stageFilter
    ? fallbackContacts.filter(c => stageFilter.includes(c.current_stage)) : fallbackContacts
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.from('contact_details').select('*')
        .eq('client_id', currentClientId)
        .or('source.eq.Facebook,ad_id.not.is.null')

      if (error) return { data: null, error }

      let rows = filterRowsByDateRange(data, row => row.ghl_created_at || row.created_at, dateRange.from, dateRange.to)
      if (stageFilter) rows = rows.filter(row => stageFilter.includes(row.current_stage))

      return { data: rows, error: null }
    },
    [currentClientId, dateRange.from, dateRange.to, JSON.stringify(stageFilter), refreshKey], filtered
  )
}

export function useAllContacts() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.from('contact_details').select('*')
        .eq('client_id', currentClientId)
        .or('source.eq.Facebook,ad_id.not.is.null')
        .order('created_at', { ascending: false })

      if (error) return { data: null, error }

      return {
        data: filterRowsByDateRange(data, row => row.ghl_created_at || row.created_at, dateRange.from, dateRange.to),
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], fallbackContacts
  )
}

export function useLeadTrackerContacts() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.from('lead_tracker').select('*').eq('client_id', currentClientId).order('ghl_created_at', { ascending: false, nullsFirst: false })
      if (error) return { data: null, error }

      return {
        data: filterRowsByDateRange(data, row => row.ghl_created_at || row.created_at, dateRange.from, dateRange.to),
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], fallbackLeadTracker
  )
}

export function useSarahStages() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()

  const { data, loading, error } = useSupabaseQuery(
    async () => {
      const [stageResult, contactsResult] = await Promise.all([
        supabase.rpc('sarah_stage_summary', {
          start_date: dateRange.from,
          end_date: dateRange.to,
          p_client_id: currentClientId,
        }),
        supabase.from('contacts').select('id, ghl_created_at, created_at').eq('client_id', currentClientId).eq('is_test', false),
      ])

      if (stageResult.error || contactsResult.error) {
        return { data: null, error: stageResult.error || contactsResult.error }
      }

      const allRows = stageResult.data ?? []
      const stages = allRows.filter(row => !row.stage?.startsWith('_funnel_'))
      const funnelMeetings = Number(allRows.find(row => row.stage === '_funnel_meetings_booked')?.count ?? 0)
      const funnelConversations = Number(allRows.find(row => row.stage === '_funnel_conversations')?.count ?? 0)
      const filteredContactRows = filterRowsByDateRange(contactsResult.data, row => row.ghl_created_at || row.created_at, dateRange.from, dateRange.to)
      const totalLeads = new Set(filteredContactRows.map(row => row.id)).size


      return {
        data: {
          stages,
          totalLeads,
          funnelMeetings,
          funnelConversations,
        },
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey],
    fallbackSarahStages
  )

  return {
    stages: data?.stages ?? [],
    totalLeads: data?.totalLeads ?? 0,
    funnelMeetings: data?.funnelMeetings ?? 0,
    funnelConversations: data?.funnelConversations ?? 0,
    loading,
    error,
  }
}

export function useDailyMetrics() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    () => supabase.from('daily_metrics').select('*')
      .eq('client_id', currentClientId)
      .gte('date', dateRange.from).lte('date', dateRange.to)
      .order('date', { ascending: true }),
    [currentClientId, dateRange.from, dateRange.to, refreshKey], fallbackDailyMetrics
  )
}

export function useTrendMetricsByDate() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      if (!dateRange.from || !dateRange.to || !currentClientId) {
        return { data: [], error: null }
      }

      const days = getDateRangeDays(dateRange.from, dateRange.to)

      // TODO(n8n WF2): add ghl_created_at: body.dateAdded || null in the
      // Prepare Contact Upsert Payload node's contactRow object so future
      // day bucketing continues to use the real GHL creation timestamp.
      const [dailyMetricsResult, dailyFunnelResults] = await Promise.all([
        supabase.from('daily_metrics').select('*')
          .eq('client_id', currentClientId)
          .gte('date', dateRange.from).lte('date', dateRange.to)
          .order('date', { ascending: true }),
        Promise.all(days.map(async (date) => {
          const { data, error } = await supabase.rpc('funnel_summary_by_date', {
            p_client_id: currentClientId,
            p_from: date,
            p_to: date,
            p_paid_only: true,
          })

          return {
            date,
            error,
            row: Array.isArray(data) ? (data[0] ?? null) : data,
          }
        }))
      ])

      if (dailyMetricsResult.error) {
        return { data: null, error: dailyMetricsResult.error }
      }

      const dailyFunnelError = dailyFunnelResults.find(result => result.error)?.error
      if (dailyFunnelError) {
        return { data: null, error: dailyFunnelError }
      }

      const frequencyByDate = new Map((dailyMetricsResult.data ?? []).map(row => [row.date, row]))
      const merged = days.map((date) => {
        const funnelRow = dailyFunnelResults.find(result => result.date === date)?.row ?? null
        const metricRow = frequencyByDate.get(date)

        return {
          client_id: currentClientId,
          date,
          spend: Number(funnelRow?.total_spend ?? 0),
          impressions: Number(metricRow?.impressions ?? 0),
          avg_frequency: Number(metricRow?.avg_frequency ?? 0),
          clicks: Number(metricRow?.clicks ?? 0),
          leads: Number(funnelRow?.total_leads ?? 0),
          meetings_booked: Number(funnelRow?.meetings_booked ?? 0),
          closes: Number(funnelRow?.closed_won ?? 0),
        }
      })

      return { data: merged, error: null }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey],
    fallbackDailyMetrics
  )
}

export function useSalesRepPerformance() {
  const { currentClientId, refreshKey } = useDashboard()
  return useSupabaseQuery(
    () => supabase.from('sales_rep_performance').select('*').eq('client_id', currentClientId),
    [currentClientId, refreshKey], USE_MOCK ? fallbackSalesReps : null
  )
}

export function useTargets() {
  const { currentClientId, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.from('targets').select('metric_name, target_value').eq('client_id', currentClientId)
      if (error) return { data: null, error }
      const pivot = {}
      for (const row of data || []) { pivot[row.metric_name] = Number(row.target_value) }
      return { data: pivot, error: null }
    },
    [currentClientId, refreshKey],
    { monthly_spend: 33000, active_opportunities: 10, monthly_revenue: 40000, monthly_leads: 100, monthly_meetings: 30, monthly_shows: 23, monthly_closes: 4, weekly_leads: 28,
      weekly_meetings: 8, weekly_shows: 6, weekly_closes: 1, daily_spend: 420, cpl_target: 85,
      cost_per_meeting: 600, cost_per_active: 1200, show_rate: 75, meeting_rate: 18, roas_target: 4 }
  )
}
