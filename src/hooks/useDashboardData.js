import { useMemo } from 'react'
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

const mockFallbackSalesPerformance = USE_MOCK ? {
  totals: {
    meetings_scheduled: mockFallbackSalesReps.reduce((sum, rep) => sum + Number(rep.meetings_scheduled ?? 0), 0),
    shows: mockFallbackSalesReps.reduce((sum, rep) => sum + Number(rep.shows ?? 0), 0),
    no_shows: mockFallbackSalesReps.reduce((sum, rep) => sum + Number(rep.no_shows ?? 0), 0),
    closes: mockFallbackSalesReps.reduce((sum, rep) => sum + Number(rep.closes ?? 0), 0),
    disqualified: 0,
    lost_not_interested: 0,
    revenue_closed: mockFallbackSalesReps.reduce((sum, rep) => sum + Number(rep.revenue_closed ?? 0), 0),
  },
  per_rep: mockFallbackSalesReps,
} : null

const filterByClient = (query, clientId) => clientId ? query.eq('client_id', clientId) : query

const normalizeContactRows = (rows) => (rows ?? []).map(row => {
  const currentStage = row.current_stage ?? row.mapped_current_stage ?? row.stage ?? null
  const stageFilterValues = Array.isArray(row.stage_filter_values)
    ? row.stage_filter_values
    : (currentStage ? [currentStage] : [])
  const fallbackName = [row.first_name, row.last_name].filter(Boolean).join(' ')
  const fullName = (row.full_name ?? row.contact_name ?? row.name ?? fallbackName) || null

  return {
    ...row,
    contact_id: row.contact_id ?? row.contact_uuid ?? row.id ?? row.ghl_contact_id,
    full_name: fullName,
    company: row.company ?? row.company_name ?? null,
    source_ad: row.source_ad ?? row.source ?? null,
    current_stage: currentStage,
    stage_filter_values: stageFilterValues,
    funnel_meeting_booked: row.funnel_meeting_booked ?? stageFilterValues.some(stage => ['meeting_booked', 'showed', 'no_show', 'active', 'closed_won', 'closed_lost'].includes(stage)),
    funnel_showed_up: row.funnel_showed_up ?? stageFilterValues.some(stage => ['showed', 'active', 'closed_won', 'closed_lost'].includes(stage)),
    funnel_active_opp: row.funnel_active_opp ?? stageFilterValues.includes('active'),
    funnel_closed_won: row.funnel_closed_won ?? stageFilterValues.includes('closed_won'),
    funnel_closed_lost: row.funnel_closed_lost ?? stageFilterValues.includes('closed_lost'),
    funnel_no_show: row.funnel_no_show ?? stageFilterValues.includes('no_show'),
  }
})

function useDashboardQueryState({ includeDateRange = true } = {}) {
  const currentClientId = useDashboard(s => s.currentClientId)
  const dateRange = useDashboard(s => s.dateRange)
  const refreshKey = useDashboard(s => s.refreshKey)

  return includeDateRange
    ? { currentClientId, dateRange, refreshKey }
    : { currentClientId, refreshKey }
}

function useNormalizedContactQuery(queryFn, deps, fallback) {
  const result = useSupabaseQuery(queryFn, deps, fallback)
  const data = useMemo(
    () => result.data ? normalizeContactRows(result.data) : result.data,
    [result.data]
  )

  return { ...result, data }
}

export function useClients() {
  return useSupabaseQuery(
    () => supabase.from('funnel_summary').select('client_id, client_name'),
    [], USE_MOCK ? [{ client_id: 'mock', client_name: 'ConvoFlow UK' }] : null
  )
}

export function useFunnelByDate() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
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
  const { currentClientId, refreshKey } = useDashboardQueryState({ includeDateRange: false })
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
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('ad_performance_by_date', {
        start_date: dateRange.from,
        end_date: dateRange.to,
        p_client_id: currentClientId,
      })

      if (error) return { data: null, error }

      const normalized = (data ?? []).map(row => {
        const totalSpend = Number(row.total_spend ?? 0)
        const totalImpressions = Number(row.total_impressions ?? 0)
        const totalClicks = Number(row.total_clicks ?? 0)
        const totalLeads = Number(row.total_leads ?? 0)
        const meetingsBooked = Number(row.meetings_booked ?? 0)
        const showedUp = Number(row.showed_up ?? 0)
        const activeOpps = Number(row.active_opportunities ?? 0)
        const closedWon = Number(row.closed_won ?? 0)

        return {
          ...row,
          total_spend: totalSpend,
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          avg_frequency: Number(row.avg_frequency ?? 0),
          avg_ctr: Number(row.avg_ctr ?? 0),
          total_leads: totalLeads,
          meetings_booked: meetingsBooked,
          showed_up: showedUp,
          active_opportunities: activeOpps,
          closed_won: closedWon,
          closed_revenue: Number(row.closed_revenue ?? 0),
          pipeline_value: Number(row.pipeline_value ?? 0),
          cost_per_lead: row.cost_per_lead == null ? null : Number(row.cost_per_lead),
          cost_per_active: row.cost_per_active == null ? null : Number(row.cost_per_active),
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

      return { data: normalized, error: null }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackAds
  )
}

export function useContactDetails(bucket = null) {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useNormalizedContactQuery(
    async () => {
      if (bucket) {
        return supabase.rpc('dashboard_contacts_by_bucket', {
          p_bucket: bucket,
          p_start_date: dateRange.from,
          p_end_date: dateRange.to,
          p_client_id: currentClientId ?? null,
        })
      }

      return filterLeadTrackerByDubaiDate(
        filterByClient(supabase.from('lead_tracker').select('*'), currentClientId),
        dateRange.from,
        dateRange.to
      ).order('ghl_created_at', { ascending: false, nullsFirst: false })
    },
    [currentClientId, dateRange.from, dateRange.to, bucket, refreshKey],
    USE_MOCK && mockFallbackContacts
      ? (bucket ? mockFallbackContacts.filter(c => c.current_stage === bucket) : mockFallbackContacts)
      : null
  )
}

export function useAllContacts() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useNormalizedContactQuery(
    () => filterLeadTrackerByDubaiDate(
        filterByClient(supabase.from('lead_tracker').select('*'), currentClientId),
        dateRange.from,
        dateRange.to
      ).order('ghl_created_at', { ascending: false, nullsFirst: false }),
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackLeadTracker
  )
}

export function useLeadTrackerContacts() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useNormalizedContactQuery(
    () => filterLeadTrackerByDubaiDate(
        filterByClient(supabase.from('lead_tracker').select('*'), currentClientId),
        dateRange.from,
        dateRange.to
      ).order('ghl_created_at', { ascending: false, nullsFirst: false }),
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackLeadTracker
  )
}

export function useSarahStages() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()

  const { data, loading, error } = useSupabaseQuery(
    async () => {
      const [stageResult, contactsResult] = await Promise.all([
        supabase.rpc('sarah_stage_summary', {
          start_date: dateRange.from,
          end_date: dateRange.to,
          p_client_id: currentClientId,
        }),
        filterLeadTrackerByDubaiDate(
          filterByClient(supabase.from('lead_tracker').select('contact_id'), currentClientId),
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
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    () => filterByClient(supabase.from('daily_metrics').select('*'), currentClientId)
      .gte('date', dateRange.from).lte('date', dateRange.to)
      .order('date', { ascending: true }),
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackDailyMetrics
  )
}

export function useTrendMetricsByDate() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      if (!dateRange.from || !dateRange.to) {
        return { data: [], error: null }
      }

      const { data, error } = await filterByClient(supabase.from('daily_metrics').select('*'), currentClientId)
        .gte('date', dateRange.from).lte('date', dateRange.to)
        .order('date', { ascending: true })

      return { data: data ?? [], error }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey],
    mockFallbackDailyMetrics
  )
}

export function useSalesPerformance() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('sales_performance_by_date', {
        start_date: dateRange.from,
        end_date: dateRange.to,
        p_client_id: currentClientId,
      })
      if (error) return { data: null, error }

      const totals = data?.totals ?? {}
      const perRep = Array.isArray(data?.per_rep) ? data.per_rep : []

      return {
        data: {
          totals: {
            meetings_scheduled: Number(totals.meetings_scheduled ?? 0),
            shows: Number(totals.shows ?? 0),
            no_shows: Number(totals.no_shows ?? 0),
            closes: Number(totals.closes ?? 0),
            disqualified: Number(totals.disqualified ?? 0),
            lost_not_interested: Number(totals.lost_not_interested ?? 0),
            revenue_closed: Number(totals.revenue_closed ?? 0),
          },
          per_rep: perRep.map(rep => ({
            ...rep,
            meetings_scheduled: Number(rep.meetings_scheduled ?? 0),
            shows: Number(rep.shows ?? 0),
            no_shows: Number(rep.no_shows ?? 0),
            closes: Number(rep.closes ?? 0),
            revenue_closed: Number(rep.revenue_closed ?? 0),
          })),
        },
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackSalesPerformance
  )
}

export function useTargets() {
  const { currentClientId, refreshKey } = useDashboardQueryState({ includeDateRange: false })
  return useSupabaseQuery(
    async () => {
      const { data, error } = await filterByClient(supabase.from('targets').select('metric_name, target_value'), currentClientId)
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
