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

const mockFallbackSarahPerformance = USE_MOCK ? {
  byBucket: {},
  totalLeads: 0,
  realConversations: 0,
  rows: [],
} : null

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

// ---------------------------------------------------------------------------
// ConvoFlow v2 backend.
//
// These pages were written against the OLD project's multi-client `public`
// schema. That schema does not exist on convoflow-v2, so every one of them
// 404'd. The fix keeps the page UI untouched and swaps only the source: the
// cf_* RPCs in migration 028 return the same column names and types as the
// legacy functions they replace.
//
// Two consequences worth knowing when reading the pages:
//   * cf is single-client, so client_id is not a filter any more. It is still
//     passed through as null so the page components keep their shape.
//   * spend, revenue, deal value and pipeline value come back NULL, not 0 —
//     cf has no ad-spend or deal-value data (phase 2). Do not coerce them to
//     0; a 0 renders as "we spent nothing", which is a lie. `??` on a number
//     is fine, `?? 0` on these four is not.
// ---------------------------------------------------------------------------
const REGION = 'uae'
const cfArgs = (dateRange, extra) => ({
  p: { region: REGION, from: dateRange?.from, to: dateRange?.to, ...extra },
})

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

// cf is single-client. The client switcher has nothing to switch between, so
// this returns the one client rather than querying a table that no longer
// exists.
export function useClients() {
  return useSupabaseQuery(
    async () => ({ data: [{ client_id: null, client_name: 'ConvoFlow UAE' }], error: null }),
    [], null
  )
}

export function useFunnelByDate() {
  const { dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('cf_funnel_summary', cfArgs(dateRange))
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error }
    },
    [dateRange.from, dateRange.to, refreshKey], mockFallbackFunnel
  )
}

export function useFunnelSummary() {
  const { refreshKey } = useDashboardQueryState({ includeDateRange: false })
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('cf_funnel_summary',
        cfArgs({ from: '2020-01-01', to: getDubaiToday() }))
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error }
    },
    [refreshKey], mockFallbackFunnel
  )
}

export function useAdPerformance() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('dashboard_ad_performance', {
        p_start_date: dateRange.from,
        p_end_date: dateRange.to,
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

export function useAdDrilldown(metaAdId = null, metric = null) {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      if (!metaAdId || !metric) return { data: [], error: null }

      const { data, error } = await supabase.rpc('dashboard_ad_drilldown', {
        p_meta_ad_id: String(metaAdId),
        p_metric: metric,
        p_start_date: dateRange.from,
        p_end_date: dateRange.to,
        p_client_id: currentClientId ?? null,
      })

      if (error) return { data: null, error }

      return {
        data: (data ?? []).map(row => ({
          ...row,
          full_name: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || null,
          monetary_value: Number(row.monetary_value ?? 0),
        })),
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, metaAdId, metric, refreshKey],
    []
  )
}

export function useRepDrilldown(repName = null, metric = null) {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      if (!repName || !metric) return { data: [], error: null }

      const { data, error } = await supabase.rpc('dashboard_rep_drilldown', {
        p_rep_name: repName,
        p_metric: metric,
        p_start_date: dateRange.from,
        p_end_date: dateRange.to,
        p_client_id: currentClientId ?? null,
      })

      if (error) return { data: null, error }

      return {
        data: (data ?? []).map(row => ({
          ...row,
          full_name: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || null,
          monetary_value: Number(row.monetary_value ?? 0),
        })),
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, repName, metric, refreshKey],
    []
  )
}

// One RPC now serves all five contact hooks. cf_contacts_by_bucket already
// returns stage_name and meta_ad_id_raw, so the old mergeStageNames /
// mergeMetaAdIds round-trips against `contacts` and `lead_tracker` are gone —
// those tables do not exist here, and the extra queries were only ever
// stitching back what one query can return.
function useCfContacts(bucket, { emptyWhenNoBucket = false } = {}) {
  const { dateRange, refreshKey } = useDashboardQueryState()
  return useNormalizedContactQuery(
    async () => {
      if (emptyWhenNoBucket && !bucket) return { data: [], error: null }
      return supabase.rpc('cf_contacts_by_bucket', cfArgs(dateRange, { bucket: bucket ?? 'leads' }))
    },
    [dateRange.from, dateRange.to, bucket, refreshKey],
    null
  )
}

export function useContactDetails(bucket = null) {
  return useCfContacts(bucket)
}

export function useDashboardContactsByBucket(bucket = null) {
  return useCfContacts(bucket, { emptyWhenNoBucket: true })
}

export function useAllContacts() {
  return useCfContacts(null)
}

export function useLeadTrackerContacts() {
  return useCfContacts(null)
}

export function useLeadTrackerBucketContacts(bucket = null) {
  return useCfContacts(bucket, { emptyWhenNoBucket: true })
}

export function useDashboardAdOptions() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('dashboard_ad_options', {
        p_start_date: dateRange.from,
        p_end_date: dateRange.to,
        p_client_id: currentClientId ?? null,
      })

      if (error) return { data: null, error }

      return {
        data: (data ?? []).map(ad => ({
          ...ad,
          meta_ad_id: ad.meta_ad_id == null ? null : String(ad.meta_ad_id),
          contact_count: Number(ad.contact_count ?? 0),
        })),
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey],
    []
  )
}
export function useSarahPerformance() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()

  const { data, loading, error } = useSupabaseQuery(
    async () => {
      const [breakdownResult, conversationCountResult] = await Promise.all([
        supabase.rpc('cf_sarah_breakdown', cfArgs(dateRange)),
        supabase.rpc('cf_real_conversations', cfArgs(dateRange)),
      ])

      if (breakdownResult.error) return { data: null, error: breakdownResult.error }
      if (conversationCountResult.error) return { data: null, error: conversationCountResult.error }

      const rows = breakdownResult.data ?? []
      const conversationCount = Array.isArray(conversationCountResult.data)
        ? (conversationCountResult.data[0] ?? null)
        : conversationCountResult.data

      return {
        data: {
          byBucket: Object.fromEntries(rows.map(row => [row.bucket, row])),
          totalLeads: Number(rows[0]?.total_leads ?? 0),
          realConversations: Number(conversationCount?.real_conversations ?? 0),
          rows,
        },
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey],
    mockFallbackSarahPerformance
  )

  return {
    byBucket: data?.byBucket ?? {},
    totalLeads: data?.totalLeads ?? 0,
    realConversations: data?.realConversations ?? 0,
    rows: data?.rows ?? [],
    loading,
    error,
  }
}

// The daily_metrics VIEW is replaced by cf_daily_metrics, which returns the
// same columns plus dials / reached / messages. spend, impressions, clicks and
// avg_frequency are NULL — that is the ad data, which is phase 2.
export function useDailyMetrics() {
  const { dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    () => supabase.rpc('cf_daily_metrics', cfArgs(dateRange)),
    [dateRange.from, dateRange.to, refreshKey], mockFallbackDailyMetrics
  )
}

export function useTrendMetricsByDate() {
  const { dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      if (!dateRange.from || !dateRange.to) return { data: [], error: null }
      const { data, error } = await supabase.rpc('cf_daily_metrics', cfArgs(dateRange))
      return { data: data ?? [], error }
    },
    [dateRange.from, dateRange.to, refreshKey],
    mockFallbackDailyMetrics
  )
}

export function useSalesPerformance() {
  const { currentClientId, dateRange, refreshKey } = useDashboardQueryState()
  return useSupabaseQuery(
    async () => {
      const { data: kpiData, error: kpiError } = await supabase.rpc('dashboard_kpis', {
        start_date: dateRange.from,
        end_date: dateRange.to,
        p_client_id: currentClientId,
      })
      if (kpiError) return { data: null, error: kpiError }

      const { data: repsData, error: repsError } = await supabase.rpc('dashboard_sales_rep_performance', {
        p_start_date: dateRange.from,
        p_end_date: dateRange.to,
        p_client_id: currentClientId,
      })
      if (repsError) return { data: null, error: repsError }

      const totals = Array.isArray(kpiData) ? (kpiData[0] ?? {}) : (kpiData ?? {})
      const perRep = Array.isArray(repsData) ? repsData : []

      return {
        data: {
          totals: {
            meetings_scheduled: Number(totals.meetings_booked ?? 0),
            shows: Number(totals.showed_up ?? 0),
            no_shows: Number(totals.no_shows ?? 0),
            closes: Number(totals.closed_won ?? 0),
            disqualified: Number(totals.disqualified ?? 0),
            lost_not_interested: Number(totals.closed_lost ?? 0),
            revenue_closed: Number(totals.deal_value ?? totals.closed_revenue ?? 0),
          },
          per_rep: perRep.map(rep => ({
            ...rep,
            meetings_scheduled: Number(rep.meetings_booked ?? rep.meetings_scheduled ?? 0),
            meetings_booked: Number(rep.meetings_booked ?? rep.meetings_scheduled ?? 0),
            shows: Number(rep.showed_up ?? rep.shows ?? 0),
            showed_up: Number(rep.showed_up ?? rep.shows ?? 0),
            no_shows: Number(rep.no_shows ?? 0),
            active: Number(rep.active ?? 0),
            closes: Number(rep.closed_won ?? rep.closes ?? 0),
            closed_won: Number(rep.closed_won ?? rep.closes ?? 0),
            closed_lost: Number(rep.closed_lost ?? 0),
            revenue_closed: Number(rep.revenue ?? rep.revenue_closed ?? 0),
            revenue: Number(rep.revenue ?? rep.revenue_closed ?? 0),
            pipeline_value: Number(rep.pipeline_value ?? 0),
          })),
        },
        error: null,
      }
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackSalesPerformance
  )
}

// cf.target is the single source for targets (Section 5.9, "KPIs with targets
// for Ads / Agent / Sales"). It stores one row per metric per period and
// cf_targets_map derives the daily/weekly/monthly variants the UI asks for, so
// the same number cannot be stored twice and drift.
//
// The old hard-coded fallback is gone deliberately. It quietly supplied
// spend/CPL/ROAS targets that nothing measures any more, which made those cards
// render a target line against a value that is always null.
export function useTargets() {
  const { refreshKey } = useDashboardQueryState({ includeDateRange: false })
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabase.rpc('cf_targets_map', { p: { region: REGION } })
      return { data: data ?? {}, error }
    },
    [refreshKey],
    null
  )
}
