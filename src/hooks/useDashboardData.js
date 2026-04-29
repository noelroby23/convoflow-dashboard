import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'
import { useSupabaseQuery } from './useSupabaseQuery'
import {
  mockAds, mockLeads, mockTrendsData, mockSalesReps
} from '../data/mockData'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const mockFallbackFunnel = USE_MOCK ? {
  client_id: 'mock', client_name: 'ConvoFlow UK', total_leads: 93, meetings_booked: 13,
  showed_up: 8, active_opportunities: 6, closed_won: 1, no_shows: 5, disqualified: 24,
  wrong_numbers: 12, total_spend: 9194, closed_revenue: 24000, pipeline_value: 45000,
} : null

const mockFallbackAds = USE_MOCK ? mockAds.map(ad => ({
  ad_id: ad.id, client_id: 'mock', ad_name: ad.name, status: ad.status, total_spend: ad.spend,
  total_impressions: ad.impressions, avg_frequency: ad.frequency, avg_ctr: ad.ctr,
  total_leads: ad.leads, meetings_booked: ad.meetings, showed_up: ad.showed,
  active_opportunities: ad.activeOpps, closed_won: ad.closedWon, cost_per_lead: ad.cpl,
  cost_per_active: ad.costPerActive, meta_ad_id: null, creative_url: null, creative_type: null,
  video_url: null, effective_object_story_id: null,
})) : null

const mockFallbackContacts = USE_MOCK ? mockLeads.map(lead => ({
  contact_id: lead.id, client_id: 'mock', full_name: lead.name, email: null, phone: null,
  company: lead.company, created_at: lead.date, source_ad: lead.sourceAd,
  current_stage: lead.stage, current_tags: [], call_summary: lead.callSummary,
  call_transcript: null, call_recording_url: null, lead_quality_score: lead.qualityScore,
  hot_lead: lead.qualityScore >= 8, meeting_date: lead.meetingDate, assigned_to: null,
  deal_value: lead.dealValue, dq_reason: null, follow_up_attempts: lead.followUpAttempts,
  last_activity_at: lead.date,
})) : null

const mockFallbackLeadTracker = USE_MOCK ? mockFallbackContacts.map(contact => ({
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
})) : null

const mockFallbackDailyMetrics = USE_MOCK ? mockTrendsData.map(d => ({
  client_id: 'mock', date: d.date, spend: d.spend, impressions: 0, avg_frequency: 1.43,
  clicks: 0, leads: d.leads, meetings_booked: d.meetings, closes: 0,
})) : null

const mockFallbackSarahStages = USE_MOCK ? {
  stages: [],
  totalLeads: 0,
  funnelMeetings: 0,
  funnelConversations: 0,
} : null

const filterLeadTrackerByDubaiDate = (query, from, to) => query.gte('dubai_date', from).lte('dubai_date', to)

const getDubaiToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const mockFallbackSalesReps = USE_MOCK ? mockSalesReps.map(rep => ({
  client_id: 'mock', sales_rep: rep.name, meetings_scheduled: rep.meetings, shows: rep.shows,
  no_shows: rep.noShows, closes: rep.closes, revenue_closed: null,
})) : null

export function useClients() {
  return useSupabaseQuery(
    () => supabase.from('funnel_summary').select('client_id, client_name'),
    [], USE_MOCK ? [{ client_id: 'mock', client_name: 'ConvoFlow UK' }] : null
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
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackFunnel
  )
}

export function useFunnelSummary() {
  const { currentClientId, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('funnel_summary_by_date', {
        p_client_id: currentClientId, p_from: '2020-01-01',
        p_to: getDubaiToday(), p_paid_only: true,
      })
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error }
    },
    [currentClientId, refreshKey], mockFallbackFunnel
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

      const [performanceResult, dailyMetricsResult] = await Promise.all([
        supabase.from('ad_performance').select('*').eq('client_id', currentClientId),
        adIds.length
          ? supabase.from('ad_daily_metrics').select('*').in('ad_id', adIds).gte('date', dateRange.from).lte('date', dateRange.to)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (performanceResult.error || dailyMetricsResult.error) {
        return { data: null, error: performanceResult.error || dailyMetricsResult.error }
      }

      const performanceRows = performanceResult.data ?? []
      const dailyMetricRows = dailyMetricsResult.data ?? []

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

      const merged = performanceRows.map(row => {
        const creative = adsByMetaAdId.get(String(row.meta_ad_id ?? '')) || adsById.get(String(row.ad_id ?? row.id ?? ''))
        const dailyMetrics = dailyMetricsByAdId.get(String(row.ad_id ?? row.id ?? ''))

        const totalSpend = Number(dailyMetrics?.total_spend ?? 0)
        const totalImpressions = Number(dailyMetrics?.total_impressions ?? 0)
        const totalClicks = Number(dailyMetrics?.total_clicks ?? 0)
        const totalLeads = Number(row.total_leads ?? 0)
        const meetingsBooked = Number(row.meetings_booked ?? 0)
        const showedUp = Number(row.showed_up ?? 0)
        const activeOpps = Number(row.active_opportunities ?? 0)
        const closedWon = Number(row.closed_won ?? 0)

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
          meetings_booked: meetingsBooked,
          showed_up: showedUp,
          active_opportunities: activeOpps,
          closed_won: closedWon,
          closed_revenue: Number(row.closed_revenue ?? 0),
          pipeline_value: Number(row.pipeline_value ?? 0),
          cost_per_lead: totalLeads > 0 ? totalSpend / totalLeads : null,
          cost_per_active: activeOpps > 0 ? totalSpend / activeOpps : null,
        }
      }).filter(row => (
        Number(row.total_spend ?? 0) > 0 ||
        Number(row.total_impressions ?? 0) > 0 ||
        Number(row.total_clicks ?? 0) > 0 ||
        Number(row.total_leads ?? 0) > 0 ||
        Number(row.meetings_booked ?? 0) > 0 ||
        Number(row.showed_up ?? 0) > 0 ||
        Number(row.active_opportunities ?? 0) > 0 ||
        Number(row.closed_won ?? 0) > 0
      ))

      return { data: merged, error: null }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackAds
  )
}

export function useContactDetails(stageFilter = null) {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await filterLeadTrackerByDubaiDate(
        supabase.from('lead_tracker').select('*').eq('client_id', currentClientId),
        dateRange.from,
        dateRange.to
      ).order('ghl_created_at', { ascending: false, nullsFirst: false })

      if (error) return { data: null, error }

      let rows = data ?? []
      if (stageFilter) rows = rows.filter(row => stageFilter.includes(row.current_stage))

      return { data: rows, error: null }
    },
    [currentClientId, dateRange.from, dateRange.to, JSON.stringify(stageFilter), refreshKey],
    USE_MOCK && mockFallbackContacts
      ? (stageFilter ? mockFallbackContacts.filter(c => stageFilter.includes(c.current_stage)) : mockFallbackContacts)
      : null
  )
}

export function useAllContacts() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await filterLeadTrackerByDubaiDate(
        supabase.from('lead_tracker').select('*').eq('client_id', currentClientId),
        dateRange.from,
        dateRange.to
      ).order('ghl_created_at', { ascending: false, nullsFirst: false })

      if (error) return { data: null, error }

      return {
        data: data ?? [],
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackLeadTracker
  )
}

export function useLeadTrackerContacts() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await filterLeadTrackerByDubaiDate(
        supabase.from('lead_tracker').select('*').eq('client_id', currentClientId),
        dateRange.from,
        dateRange.to
      ).order('ghl_created_at', { ascending: false, nullsFirst: false })
      if (error) return { data: null, error }

      return {
        data: data ?? [],
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackLeadTracker
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
        filterLeadTrackerByDubaiDate(
          supabase.from('lead_tracker').select('contact_id').eq('client_id', currentClientId),
          dateRange.from,
          dateRange.to
        ),
      ])

      if (stageResult.error || contactsResult.error) {
        return { data: null, error: stageResult.error || contactsResult.error }
      }

      const allRows = stageResult.data ?? []
      const stages = allRows.filter(row => !row.stage?.startsWith('_funnel_'))
      const funnelMeetings = Number(allRows.find(row => row.stage === '_funnel_meetings_booked')?.count ?? 0)
      const funnelConversations = Number(allRows.find(row => row.stage === '_funnel_conversations')?.count ?? 0)
      const totalLeads = new Set((contactsResult.data ?? []).map(row => row.contact_id)).size


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
    mockFallbackSarahStages
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
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackDailyMetrics
  )
}

export function useTrendMetricsByDate() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      if (!dateRange.from || !dateRange.to || !currentClientId) {
        return { data: [], error: null }
      }

      const { data, error } = await supabase.from('daily_metrics').select('*')
        .eq('client_id', currentClientId)
        .gte('date', dateRange.from).lte('date', dateRange.to)
        .order('date', { ascending: true })

      return { data: data ?? [], error }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey],
    mockFallbackDailyMetrics
  )
}

export function useSalesRepPerformance() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await filterLeadTrackerByDubaiDate(
        supabase.from('lead_tracker').select('*').eq('client_id', currentClientId),
        dateRange.from,
        dateRange.to
      )

      if (error) return { data: null, error }

      const rows = data ?? []
      const reps = new Map()

      for (const row of rows) {
        const repName = row.assigned_to_name || row.assigned_to || 'Unassigned'
        const rep = reps.get(repName) ?? {
          client_id: currentClientId,
          sales_rep: repName,
          meetings_scheduled: 0,
          shows: 0,
          no_shows: 0,
          closes: 0,
          revenue_closed: 0,
        }

        if (row.funnel_meeting_booked) rep.meetings_scheduled += 1
        if (row.funnel_showed_up) rep.shows += 1
        if (row.funnel_no_show) rep.no_shows += 1
        if (row.funnel_closed_won) {
          rep.closes += 1
          rep.revenue_closed += Number(row.deal_value ?? 0)
        }

        reps.set(repName, rep)
      }

      return { data: [...reps.values()].filter(rep => rep.meetings_scheduled || rep.shows || rep.no_shows || rep.closes), error: null }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackSalesReps
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
