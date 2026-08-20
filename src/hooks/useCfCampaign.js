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

// No interval: this one is paged, filtered and searched, so a background
// refresh underneath somebody's cursor would move the rows they are reading.
export function useCampaignMembers({ status, q: search, limit = 25, offset = 0 } = {}) {
  const res = useCfRpc('cf_campaign_members', {
    p: {
      limit, offset,
      ...(status && status !== 'all' ? { status } : {}),
      ...(search ? { q: search } : {}),
    },
  })
  return { ...res, data: one(res.data) }
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
