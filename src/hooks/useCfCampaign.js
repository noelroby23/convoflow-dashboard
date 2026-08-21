import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCfRpc } from './useCfDesk'

/**
 * The reactivation campaign — reads.
 *
 * Same shape as useCfDesk: every one of these is a SECURITY DEFINER RPC in
 * `public` taking a single jsonb arg named `p`, because the cf.* tables are
 * not exposed through PostgREST. They are also revoked from anon (CLAUDE.md
 * §7 item 177), so an unauthenticated call comes back 42501 rather than data.
 *
 * These wrap useCfRpc rather than re-implementing polling: one implementation
 * of "call an RPC on an interval and pause while the tab is hidden", not two.
 */

// A `returns jsonb` RPC hands back the object; a `returns table` one hands back
// a one-row array. Every campaign RPC is documented as a single object, so the
// unwrap is defensive — it costs nothing and stops a shape change rendering as
// a blank page.
const one = (d) => (Array.isArray(d) ? (d[0] ?? null) : d)

const range = (r) => (r?.from && r?.to ? { from: r.from, to: r.to } : {})

// The header, the gate and the kill criteria all live on the overview, and the
// gate is the thing somebody stares at while a pilot runs — so it is the
// fastest of these.
export function useCampaignOverview() {
  const q = useCfRpc('cf_campaign_overview', { p: {} }, { intervalMs: 20_000 })
  return { ...q, data: one(q.data) }
}

export function useCampaignFunnel() {
  const q = useCfRpc('cf_campaign_funnel', { p: {} }, { intervalMs: 60_000 })
  return { ...q, data: one(q.data) }
}

export function useCampaignDaily(dateRange) {
  const q = useCfRpc('cf_campaign_daily', { p: range(dateRange) }, { intervalMs: 60_000 })
  return { ...q, data: one(q.data) }
}

/**
 * THE QUEUE — who is being dialled, who is next, and what happened last.
 *
 * This is the one hook on the page that refreshes on its own AND can be told
 * to stop. That combination is why it does not wrap useCfRpc: useCfRpc reruns
 * its effect whenever intervalMs changes, so expressing pause by dropping
 * the interval to 0 fires an immediate load — which would refresh the table
 * underneath somebody the instant they opened a transcript. The pause has to
 * live in a ref that the timer reads, not in the dependency array.
 *
 * 🔑 THE ROWS ARRIVE IN THE ORDER THEY MUST BE SHOWN and are never re-sorted
 * here. cf_campaign_members orders by the same sort key the dialler itself
 * uses — dialing now, calling next, scheduled, then the rest — so the table is
 * a view of the queue rather than a second opinion about it (§7 item 141).
 *
 * `status` is passed straight through, reason chips included: the RPC decides
 * for itself whether a value is a status or an exclusion reason (migration
 * 210), so the page does not need a second copy of that vocabulary.
 */
export function useCampaignQueue({
  status, reason, q: search, limit = 25, offset = 0,
  intervalMs = 15_000, paused = false,
} = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const args = {
    limit, offset,
    ...(status && status !== 'all' ? { status } : {}),
    ...(reason ? { reason } : {}),
    ...(search ? { q: search } : {}),
  }
  const argsKey = JSON.stringify(args)

  // Read by the timer, never by the effect — changing it must not re-fetch.
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const load = useCallback(async () => {
    try {
      const { data: d, error: e } = await supabase.rpc('cf_campaign_members', { p: JSON.parse(argsKey) })
      if (e) throw e
      setData(one(d))
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [argsKey])

  useEffect(() => {
    let cancelled = false
    load()
    if (intervalMs <= 0) return () => { cancelled = true }
    const id = setInterval(() => {
      // Hidden tab, open transcript, or a cursor in the search box: all three
      // are reasons not to move the rows.
      if (!cancelled && !document.hidden && !pausedRef.current) load()
    }, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [load, intervalMs])

  return { data, error, loading, refresh: load }
}

/**
 * One call, fetched when somebody actually opens it.
 *
 * The transcript is deliberately NOT in the list payload — a page of 25 rows
 * carrying 25 full transcripts is a slow table nobody asked for. It comes back
 * { found: false, reason } for a call id that is not this campaign's, which is
 * an answer to render and not an error to swallow.
 */
export async function fetchCampaignCall(vapiCallId) {
  const { data, error } = await supabase.rpc('cf_campaign_call', { p: { vapi_call_id: vapiCallId } })
  if (error) throw error
  return one(data)
}

// The pacer's decision log — this is what answers "why is nothing happening?",
// so it refreshes at roughly the rate decisions get made.
export function useCampaignEvents(limit = 40) {
  const q = useCfRpc('cf_campaign_events', { p: { limit } }, { intervalMs: 20_000 })
  return { ...q, data: one(q.data) }
}

export function useCampaignPool() {
  const q = useCfRpc('cf_campaign_pool', { p: {} }, { intervalMs: 120_000 })
  return { ...q, data: one(q.data) }
}

/**
 * The only write on this page. `action` is start | pause | resume | clear_halt.
 *
 * 🔑 A REFUSAL IS NOT AN ERROR AND MUST NOT BE SWALLOWED. `resume` on a halted
 * campaign comes back { ok: false, reason } with no Postgres error at all — the
 * pacer is telling you why it will not restart. Throwing the reason means the
 * caller shows it; returning silently would render as a button that does
 * nothing, which is the exact failure this page exists to explain.
 */
export async function campaignControl(action) {
  const { data, error } = await supabase.rpc('cf_campaign_control', { p: { action } })
  if (error) throw error
  const out = one(data)
  if (out?.ok === false) throw new Error(out.reason || 'The campaign refused that action')
  return out
}
