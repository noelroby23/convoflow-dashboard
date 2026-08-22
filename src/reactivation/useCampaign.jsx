import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * ONE STATE OBJECT. Every number on every tab reads from this and nothing else.
 *
 * The design's first build note, verbatim: "One state object, one paint cycle.
 * Every visible number reads from it. The day two places compute 'meetings
 * booked' independently, they will disagree."
 *
 * That is not a style preference — it is a fault this dashboard has already
 * shipped twice. Three pages once gave three different answers for "meetings
 * booked" (120, 9 and 23) because each counted a different population, and Home
 * divided ad spend by a lead count a neighbouring card computed differently.
 * Both were fixed by moving the arithmetic into one place. This is that place,
 * built before it can happen a third time.
 *
 * 🔑 THE RULE FOR ANYONE ADDING A TAB: if the number you want is not in here,
 * add it to a database function and surface it here. Do not compute it in a
 * component. A component may format a value, colour it, or lay it out — it may
 * not derive a figure another component also derives.
 *
 * ⚠️ THIS DASHBOARD HAS NO DATE-RANGE PICKER, deliberately (build note P1.6).
 * A campaign is measured over its own lifetime or over today; a global range
 * silently rebases the pace line and every "behind plan" figure hanging off it,
 * which makes two readers on two ranges disagree about whether it is working.
 * Nothing here accepts a range, so nothing can pass one by accident.
 */

const Ctx = createContext(null)

const one = (d) => (Array.isArray(d) ? (d[0] ?? null) : d)

/**
 * Every read is a SECURITY DEFINER RPC in `public` taking a single jsonb `p`,
 * because the cf.* tables are not exposed through PostgREST and are revoked
 * from anon (§7 item 177) — an unauthenticated call returns 42501, not data.
 */
async function rpc(fn, p = {}) {
  const { data, error } = await supabase.rpc(fn, { p })
  if (error) throw error
  return one(data)
}

/**
 * How often each feed is worth re-reading, in ms.
 *
 * Deliberately not uniform. The gate is what somebody stares at while a pilot
 * runs, so it is fastest. The eligible pool changes when a human bulk-tags,
 * which happens a few times a campaign, so it is slowest. Polling everything at
 * the fast rate is twelve round trips a minute for figures that move once a day.
 */
const FEEDS = {
  overview: { fn: 'cf_campaign_overview',   every: 20_000 },
  funnel:   { fn: 'cf_campaign_funnel',     every: 60_000 },
  pipeline: { fn: 'cf_campaign_pipeline',   every: 45_000 },
  ladder:   { fn: 'cf_campaign_ladder',     every: 60_000 },
  shifts:   { fn: 'cf_shifts',              every: 60_000 },
  scores:   { fn: 'cf_score_summary',       every: 120_000 },
  findings: { fn: 'cf_score_findings',      every: 120_000 },
  pool:     { fn: 'cf_campaign_pool',       every: 300_000 },
  events:   { fn: 'cf_campaign_events',     every: 30_000, args: { limit: 40 } },
  daily:    { fn: 'cf_campaign_daily',      every: 120_000 },
  brief:    { fn: 'cf_manager_brief_facts', every: 300_000 },
}

export function CampaignProvider({ children }) {
  const [state, setState] = useState(() =>
    Object.fromEntries(Object.keys(FEEDS).map((k) => [k, { data: null, error: null, loading: true }])))

  // A poll still in flight when the tree unmounts must not set state on it.
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback(async (key) => {
    const feed = FEEDS[key]
    try {
      const data = await rpc(feed.fn, feed.args || {})
      if (alive.current) setState((s) => ({ ...s, [key]: { data, error: null, loading: false } }))
    } catch (error) {
      // The error is kept, never swallowed. A tab that cannot load says so.
      // Rendering zeros over a failed read is the worse outcome, because zeros
      // look exactly like an answer.
      if (alive.current) setState((s) => ({ ...s, [key]: { ...s[key], error, loading: false } }))
    }
  }, [])

  const refreshAll = useCallback(() => { Object.keys(FEEDS).forEach(load) }, [load])

  useEffect(() => {
    Object.keys(FEEDS).forEach(load)
    const timers = Object.entries(FEEDS).map(([key, feed]) =>
      setInterval(() => { if (!document.hidden) load(key) }, feed.every))
    return () => timers.forEach(clearInterval)
  }, [load])

  /**
   * The derived figures — computed ONCE here, read by name everywhere else.
   *
   * Everything below is arithmetic over values the database already agreed on.
   * Nothing invents a measurement: if an input is null the output is null, and
   * format.js renders that as an em-dash rather than a zero.
   */
  const derived = useMemo(() => {
    const ov = state.overview.data
    const st = ov?.stats
    const pool = state.pool.data
    const pipe = state.pipeline.data

    const eligible = pool?.eligible ?? null
    const worked = st ? (st.members_released ?? 0) : null
    const remaining = eligible != null && worked != null ? Math.max(0, eligible - worked) : null

    // Day N of the campaign. NULL before it starts — "day 1 of 24" on a draft
    // campaign is a claim that it has begun, and it has not.
    const startedAt = ov?.started_at ? new Date(ov.started_at) : null
    const dayOf = startedAt
      ? Math.max(1, Math.floor((Date.now() - startedAt.getTime()) / 86_400_000) + 1)
      : null

    // Working days to finish at the rate ACTUALLY achieved, not at the cap.
    // The cap is a permission; the rate is what is happening, and the reader is
    // asking when this ends.
    const perDay = dayOf && worked ? worked / dayOf : null
    const daysLeft = perDay && perDay > 0 && remaining != null ? Math.ceil(remaining / perDay) : null

    // Whether anything is on the phone right now — one source, so the pill in
    // the top bar and the live row in the queue can never disagree.
    const dialingNow = st?.in_flight ?? 0

    return {
      eligible, worked, remaining, dayOf, perDay, daysLeft, dialingNow,
      status: ov?.status ?? null,
      halted: !!ov?.halted_reason,
      // Live only when it is genuinely allowed to release. Derived from status,
      // never from a separate stored flag (build note P1.4).
      isLive: ov?.status === 'running' || ov?.status === 'piloting',
      sarahTotal: pipe?.sarah_total ?? null,
      ronTotal: pipe?.ron_total ?? null,
    }
  }, [state.overview.data, state.pool.data, state.pipeline.data])

  const value = useMemo(() => ({ ...state, derived, refresh: load, refreshAll }),
    [state, derived, load, refreshAll])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCampaign() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCampaign must be used inside <CampaignProvider>')
  return v
}

/**
 * The only write on the dashboard. start | pause | resume | clear_halt.
 *
 * 🔑 A REFUSAL IS NOT AN ERROR AND MUST NOT BE SWALLOWED. `resume` on a halted
 * campaign returns { ok:false, reason } with no Postgres error at all — that is
 * the pacer explaining why it will not restart. Throwing the reason makes the
 * caller show it; returning quietly renders as a button that does nothing,
 * which is the exact confusion this page exists to remove.
 */
export async function campaignControl(action) {
  const out = await rpc('cf_campaign_control', { action })
  if (out?.ok === false) throw new Error(out.reason || 'The campaign refused that action')
  return out
}

/** One call, fetched only when somebody opens it — a page of 25 rows carrying
 *  25 full transcripts is a slow table nobody asked for. */
export async function fetchCall(vapiCallId) {
  return rpc('cf_campaign_call', { vapi_call_id: vapiCallId })
}

/** The queue list. Paged and filtered, so deliberately NOT in shared state —
 *  two tabs asking for different pages must not fight over one cache. */
export async function fetchMembers(args) {
  return rpc('cf_campaign_members', args)
}

/** Export rows. Never held in shared state: this can be thousands of rows and
 *  exists only for the moment a file is built. */
export async function fetchExport(args) {
  return rpc('cf_campaign_export', args)
}

/** One lead, in full, for the drawer. */
export async function fetchLead(leadId) {
  return rpc('cf_lead_detail', { lead_id: leadId })
}
