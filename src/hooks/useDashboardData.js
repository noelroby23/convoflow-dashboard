import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'
import { useSupabaseQuery } from './useSupabaseQuery'
import {
  mockAds, mockLeads, mockTrendsData, mockSalesReps
} from '../data/mockData'

// --- Fallback mock data mapped to Supabase field names ---

const fallbackFunnel = {
  client_id: 'mock',
  client_name: 'ConvoFlow UK',
  total_leads: 93,
  meetings_booked: 13,
  showed_up: 8,
  active_opportunities: 6,
  closed_won: 1,
  no_shows: 5,
  disqualified: 24,
  wrong_numbers: 12,
  total_spend: 9194,
  closed_revenue: 24000,
  pipeline_value: 45000,
}

const fallbackAds = mockAds.map(ad => ({
  ad_id: ad.id,
  client_id: 'mock',
  ad_name: ad.name,
  status: ad.status,
  total_spend: ad.spend,
  total_impressions: ad.impressions,
  avg_frequency: ad.frequency,
  avg_ctr: ad.ctr,
  total_leads: ad.leads,
  meetings_booked: ad.meetings,
  showed_up: ad.showed,
  active_opportunities: ad.activeOpps,
  closed_won: ad.closedWon,
  cost_per_lead: ad.cpl,
  cost_per_active: ad.costPerActive,
}))

const fallbackContacts = mockLeads.map(lead => ({
  contact_id: lead.id,
  client_id: 'mock',
  full_name: lead.name,
  email: null,
  phone: null,
  company: lead.company,
  created_at: lead.date,
  source_ad: lead.sourceAd,
  current_stage: lead.stage,
  current_tags: [],
  call_summary: lead.callSummary,
  call_transcript: null,
  call_recording_url: null,
  lead_quality_score: lead.qualityScore,
  hot_lead: lead.qualityScore >= 8,
  meeting_date: lead.meetingDate,
  assigned_to: null,
  deal_value: lead.dealValue,
  dq_reason: null,
  follow_up_attempts: lead.followUpAttempts,
  last_activity_at: lead.date,
}))

const fallbackDailyMetrics = mockTrendsData.map(d => ({
  client_id: 'mock',
  date: d.date,
  spend: d.spend,
  impressions: 0,
  avg_frequency: 1.43,
  clicks: 0,
  leads: d.leads,
  meetings_booked: d.meetings,
  closes: 0,
}))

const fallbackSalesReps = mockSalesReps.map(rep => ({
  client_id: 'mock',
  sales_rep: rep.name,
  meetings_scheduled: rep.meetings,
  shows: rep.shows,
  no_shows: rep.noShows,
  closes: rep.closes,
  revenue_closed: rep.closes * 24000,
}))

// --- Hooks ---

export function useClients() {
  return useSupabaseQuery(
    () => supabase.from('funnel_summary').select('client_id, client_name'),
    [],
    [{ client_id: 'mock', client_name: 'ConvoFlow UK' }]
  )
}

export function useFunnelByDate() {
  const { currentClientId, dateRange } = useDashboard()
  return useSupabaseQuery(
    () => supabase.rpc('funnel_summary_by_date', {
      p_client_id: currentClientId,
      p_from: dateRange.from,
      p_to: dateRange.to,
    }),
    [currentClientId, dateRange.from, dateRange.to],
    fallbackFunnel
  )
}

export function useFunnelSummary() {
  const { currentClientId } = useDashboard()
  return useSupabaseQuery(
    () => supabase.from('funnel_summary').select('*').eq('client_id', currentClientId).single(),
    [currentClientId],
    fallbackFunnel
  )
}

export function useAdPerformance() {
  const { currentClientId } = useDashboard()
  return useSupabaseQuery(
    () => supabase.from('ad_performance').select('*').eq('client_id', currentClientId),
    [currentClientId],
    fallbackAds
  )
}

export function useContactDetails(stageFilter = null) {
  const { currentClientId } = useDashboard()
  const filtered = stageFilter
    ? fallbackContacts.filter(c => stageFilter.includes(c.current_stage))
    : fallbackContacts

  return useSupabaseQuery(
    () => {
      let query = supabase.from('contact_details').select('*').eq('client_id', currentClientId)
      if (stageFilter) query = query.in('current_stage', stageFilter)
      return query
    },
    [currentClientId, JSON.stringify(stageFilter)],
    filtered
  )
}

export function useAllContacts() {
  const { currentClientId } = useDashboard()
  return useSupabaseQuery(
    () => supabase.from('contact_details').select('*').eq('client_id', currentClientId).order('created_at', { ascending: false }),
    [currentClientId],
    fallbackContacts
  )
}

export function useDailyMetrics() {
  const { currentClientId, dateRange } = useDashboard()
  return useSupabaseQuery(
    () => supabase.from('daily_metrics').select('*')
      .eq('client_id', currentClientId)
      .gte('date', dateRange.from)
      .lte('date', dateRange.to)
      .order('date', { ascending: true }),
    [currentClientId, dateRange.from, dateRange.to],
    fallbackDailyMetrics
  )
}

export function useSalesRepPerformance() {
  const { currentClientId } = useDashboard()
  return useSupabaseQuery(
    () => supabase.from('sales_rep_performance').select('*').eq('client_id', currentClientId),
    [currentClientId],
    fallbackSalesReps
  )
}
