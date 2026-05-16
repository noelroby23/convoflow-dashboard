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

const STAGE_ALIASES = {
  showed: ['showed', 'meeting_attended'],
  meeting_attended: ['meeting_attended', 'showed'],
}

const expandMappedStages = (stages) => {
  const values = Array.isArray(stages) ? stages : [stages]
  return [...new Set(values.filter(Boolean).flatMap(stage => STAGE_ALIASES[stage] ?? [stage]))]
}

const getMappedStageIds = async (stages) => {
  const mappedStages = expandMappedStages(stages)
  if (!mappedStages.length) return { stageIds: [], mappedStageById: new Map(), error: null }

  const { data, error } = await supabase
    .from('ghl_stage_map')
    .select('stage_id, mapped_current_stage')
    .in('mapped_current_stage', mappedStages)

  if (error) return { stageIds: [], mappedStageById: new Map(), error }

  const mappedStageById = new Map((data ?? []).map(row => [row.stage_id, row.mapped_current_stage]))
  return { stageIds: [...mappedStageById.keys()], mappedStageById, error: null }
}

const getOpportunityContactIdsByMappedStage = async ({ stages, clientId }) => {
  const { stageIds, error: stageError } = await getMappedStageIds(stages)
  if (stageError) return { contactIds: [], error: stageError }
  if (!stageIds.length) return { contactIds: [], error: null }

  const { data, error } = await filterByClient(
    supabase.from('ghl_opportunities').select('contact_id').in('pipeline_stage_id', stageIds),
    clientId
  )

  if (error) return { contactIds: [], error }

  return { contactIds: [...new Set((data ?? []).map(row => row.contact_id).filter(Boolean))], error: null }
}

const getStageFilterValues = (mappedStages) => {
  const values = new Set(mappedStages)
  if (values.has('meeting_attended')) values.add('showed')
  if (values.has('showed')) values.add('meeting_attended')
  return [...values]
}

const decorateContactsWithOpportunityStages = async (rows) => {
  const contactIds = [...new Set((rows ?? []).map(row => row.contact_id).filter(Boolean))]
  if (!contactIds.length) return { data: rows ?? [], error: null }

  const opportunitiesResult = await supabase
    .from('ghl_opportunities')
    .select('contact_id, pipeline_stage_id')
    .in('contact_id', contactIds)

  if (opportunitiesResult.error) return { data: null, error: opportunitiesResult.error }

  const stageIds = [...new Set((opportunitiesResult.data ?? []).map(row => row.pipeline_stage_id).filter(Boolean))]
  if (!stageIds.length) return { data: rows.map(row => ({ ...row, mapped_current_stages: [], stage_filter_values: [] })), error: null }

  const stageMapResult = await supabase
    .from('ghl_stage_map')
    .select('stage_id, mapped_current_stage')
    .in('stage_id', stageIds)

  if (stageMapResult.error) return { data: null, error: stageMapResult.error }

  const mappedStageById = new Map((stageMapResult.data ?? []).map(row => [row.stage_id, row.mapped_current_stage]))
  const mappedStagesByContactId = new Map()

  for (const opportunity of opportunitiesResult.data ?? []) {
    const mappedStage = mappedStageById.get(opportunity.pipeline_stage_id)
    if (!mappedStage) continue

    const stages = mappedStagesByContactId.get(opportunity.contact_id) ?? new Set()
    stages.add(mappedStage)
    mappedStagesByContactId.set(opportunity.contact_id, stages)
  }

  return {
    data: rows.map(row => {
      const mappedStages = [...(mappedStagesByContactId.get(row.contact_id) ?? [])]
      const stageFilterValues = getStageFilterValues(mappedStages)
      const hasMappedStages = mappedStages.length > 0

      return {
        ...row,
        mapped_current_stages: mappedStages,
        stage_filter_values: stageFilterValues,
        funnel_meeting_booked: hasMappedStages ? stageFilterValues.some(stage => ['meeting_booked', 'meeting_attended', 'showed', 'no_show', 'active', 'closed_won', 'closed_lost'].includes(stage)) : row.funnel_meeting_booked,
        funnel_showed_up: hasMappedStages ? stageFilterValues.some(stage => ['meeting_attended', 'showed', 'active', 'closed_won', 'closed_lost'].includes(stage)) : row.funnel_showed_up,
        funnel_active_opp: hasMappedStages ? stageFilterValues.includes('active') : row.funnel_active_opp,
        funnel_closed_won: hasMappedStages ? stageFilterValues.includes('closed_won') : row.funnel_closed_won,
        funnel_closed_lost: hasMappedStages ? stageFilterValues.includes('closed_lost') : row.funnel_closed_lost,
        funnel_no_show: hasMappedStages ? stageFilterValues.includes('no_show') : row.funnel_no_show,
      }
    }),
    error: null,
  }
}

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

export function useContactDetails(stageFilter = null) {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      let query = filterByClient(supabase.from('lead_tracker').select('*'), currentClientId)

      if (stageFilter) {
        const { contactIds, error: opportunityError } = await getOpportunityContactIdsByMappedStage({
          stages: stageFilter,
          clientId: currentClientId,
        })

        if (opportunityError) return { data: null, error: opportunityError }
        if (!contactIds.length) return { data: [], error: null }

        query = query.in('contact_id', contactIds)
      }

      const { data, error } = await filterLeadTrackerByDubaiDate(
        query,
        dateRange.from,
        dateRange.to
      ).order('ghl_created_at', { ascending: false, nullsFirst: false })

      if (error) return { data: null, error }
      return decorateContactsWithOpportunityStages(data ?? [])
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
        filterByClient(supabase.from('lead_tracker').select('*'), currentClientId),
        dateRange.from,
        dateRange.to
      ).order('ghl_created_at', { ascending: false, nullsFirst: false })

      if (error) return { data: null, error }

      return decorateContactsWithOpportunityStages(data ?? [])
    },
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackLeadTracker
  )
}

export function useLeadTrackerContacts() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    async () => {
      const { data, error } = await filterLeadTrackerByDubaiDate(
        filterByClient(supabase.from('lead_tracker').select('*'), currentClientId),
        dateRange.from,
        dateRange.to
      ).order('ghl_created_at', { ascending: false, nullsFirst: false })
      if (error) return { data: null, error }

      return decorateContactsWithOpportunityStages(data ?? [])
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
  const { currentClientId, dateRange, refreshKey } = useDashboard()
  return useSupabaseQuery(
    () => filterByClient(supabase.from('daily_metrics').select('*'), currentClientId)
      .gte('date', dateRange.from).lte('date', dateRange.to)
      .order('date', { ascending: true }),
    [currentClientId, dateRange.from, dateRange.to, refreshKey], mockFallbackDailyMetrics
  )
}

export function useTrendMetricsByDate() {
  const { currentClientId, dateRange, refreshKey } = useDashboard()
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
  const { currentClientId, dateRange, refreshKey } = useDashboard()
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
  const { currentClientId, refreshKey } = useDashboard()
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
