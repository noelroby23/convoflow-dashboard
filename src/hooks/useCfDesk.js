import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../lib/supabase'

// All ConvoFlow v2 desk data comes from SECURITY DEFINER RPCs in `public`.
// The cf.* tables are not exposed through PostgREST, so this is the only
// surface the browser can reach — and the only one it should.
async function callRpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data
}

/**
 * Poll an RPC on an interval. Pauses while the tab is hidden so a backgrounded
 * dashboard doesn't hammer the database all night.
 */
export function useCfRpc(fn, args, { intervalMs = 0, enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const argsKey = JSON.stringify(args ?? {})
  const timer = useRef(null)

  const load = useCallback(async () => {
    try {
      const result = await callRpc(fn, JSON.parse(argsKey))
      setData(result)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [fn, argsKey])

  useEffect(() => {
    let cancelled = false
    const tick = () => { if (!cancelled && !document.hidden) load() }

    // `enabled` exists for the lead drawer, which has no lead until one is
    // clicked. Defaults to true, so every existing caller is unchanged.
    // Stale data is cleared rather than left on screen: reopening the drawer
    // on a different lead must not show the previous lead's calls for a frame.
    if (!enabled) {
      setData(null)
      setError(null)
      setLoading(false)
      return () => { cancelled = true }
    }

    load()
    if (intervalMs > 0) timer.current = setInterval(tick, intervalMs)

    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      if (timer.current) clearInterval(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, intervalMs, enabled])

  return { data, error, loading, refresh: load }
}

// The three range-aware hooks. Until now they took no dates at all, so the
// date-range control at the top of the page changed nothing and every card
// read "today" — a permanent row of zeros above a pipeline rail full of leads.
// `range` is the store's { from, to } (yyyy-MM-dd, Dubai); omit it and the
// RPC still defaults to today.
const withRange = (region, range) =>
  range?.from && range?.to ? { region, from: range.from, to: range.to } : { region }

export const useCfHeadline = (region = 'uae', range) =>
  useCfRpc('cf_dash_headline', { p: withRange(region, range) }, { intervalMs: 60_000 })

// The queue moves constantly, so it refreshes fastest.
export const useCfQueue = () =>
  useCfRpc('cf_dash_queue', { p: {} }, { intervalMs: 10_000 })

export const useCfPipeline = (region = 'uae') =>
  useCfRpc('cf_dash_pipeline', { p: { region } }, { intervalMs: 30_000 })

export const useCfMeetings = (region = 'uae') =>
  useCfRpc('cf_dash_meetings', { p: { region } }, { intervalMs: 30_000 })

export const useCfSplit = (view, region = 'uae') =>
  useCfRpc('cf_dash_split', { p: { region, view } }, { intervalMs: 30_000 })

export const useCfQaDigest = (days = 7) =>
  useCfRpc('cf_qa_digest', { p_days: days }, { intervalMs: 120_000 })

export const useCfEod = (region = 'uae') =>
  useCfRpc('cf_eod_summary', { p: { region } }, { intervalMs: 300_000 })

export const useCfTargets = (region = 'uae', range) =>
  useCfRpc('cf_dash_targets', { p: withRange(region, range) }, { intervalMs: 60_000 })

export const useCfAttention = (region = 'uae') =>
  useCfRpc('cf_dash_attention', { p: { region } }, { intervalMs: 30_000 })

export const useCfCalls = (region = 'uae', range) =>
  useCfRpc('cf_dash_calls', { p: { ...withRange(region, range), limit: 100 } },
           { intervalMs: 30_000 })

// --------------------------------------------------------------------------
// Command Center parity (CLAUDE.md §7 item 52).
//
// These back the board, the "today so far" strip and the activity feed that
// the n8n page at /webhook/cf-queue-view-8842 shows. That page reads the
// LEGACY stack — call_queue_cf on the agency project, GHL directly, n8n
// dataTables — so it goes blank at cutover. These read cf instead.
// --------------------------------------------------------------------------

// The board moves as calls happen, so it refreshes with the queue, not with
// the slower panels.
// `range` scopes by when the lead arrived and `q` searches name or phone.
// Both optional: with neither, this is the live "in play" board.
export const useCfBoard = (region = 'uae', filter = 'all', range, q) =>
  useCfRpc('cf_dash_board', {
    p: {
      region, filter, per_column: 50,
      ...(range?.from && range?.to ? { from: range.from, to: range.to } : {}),
      ...(q ? { q } : {}),
    },
  }, { intervalMs: 15_000 })

// `date` is a yyyy-MM-dd in Dubai; omit for today. Drives the Today/Yesterday
// toggle without touching the page's main date range, which scopes history.
export const useCfToday = (region = 'uae', date) =>
  useCfRpc('cf_dash_today', { p: date ? { region, date } : { region } }, { intervalMs: 30_000 })

export const useCfActivity = (region = 'uae', date) =>
  useCfRpc('cf_dash_activity', { p: date ? { region, date, limit: 40 } : { region, limit: 40 } },
           { intervalMs: 20_000 })

export async function lookupLead(q) {
  return callRpc('cf_lead_lookup', { p: { q } })
}

// --------------------------------------------------------------------------
// One lead, everything about it — the drawer behind a board card.
// --------------------------------------------------------------------------

/**
 * Keyed on lead_id, never on name or phone.
 *
 * cf_lead_lookup resolves free text and takes `order by updated_at desc limit
 * 1`, which is the wrong thing to hang a click on: GHL makes a fresh contact
 * per form fill, so one person is routinely several cf.lead rows on the same
 * number (CLAUDE.md §7 items 89 and 119 — eight rows on one number in one
 * evening). Resolving a clicked card by phone can open a different row than
 * the card, with different calls, and nothing on screen would say so.
 * The card carries lead_id, so use it.
 *
 * Polls while open because a lead can be mid-call: the status phrase, the
 * queue and the call list all move underneath the drawer.
 */
export const useCfLeadDetail = (leadId) =>
  useCfRpc('cf_lead_detail', { p: { lead_id: leadId } },
           { intervalMs: 20_000, enabled: Boolean(leadId) })

/**
 * Ask for a playable URL for one call recording.
 *
 * cf.call.recording_url is VAPI's raw R2 object path and returns 400 in a
 * browser — the "play" link this dashboard used to show has never played
 * anything. The URL that works is presigned by VAPI on demand and needs the
 * private VAPI key, so it is minted by the cf-recording edge function.
 *
 * A plain fetch rather than supabase.functions.invoke() because the STATUS
 * CODE carries the meaning: 410 = the audio aged out of VAPI's 14-day window
 * (the transcript is still there and the UI should say so), 404 = not one of
 * our calls, 502 = actually broken. invoke() flattens all three into one
 * error, and "expired" and "broken" need different words on screen.
 *
 * The URL it returns is signed for 30 minutes. Nothing caches it.
 */
export async function getRecordingUrl(callId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    const e = new Error('Your session has expired — sign in again')
    e.reason = 'no_session'
    throw e
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/cf-recording`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ call_id: callId }),
  })

  let body = {}
  try { body = await res.json() } catch { /* keep the status, drop the body */ }

  if (!res.ok) {
    const e = new Error(body.error || `Could not load the recording (${res.status})`)
    e.reason = body.reason || String(res.status)
    e.ageDays = body.age_days
    e.detail = body.detail
    throw e
  }
  return body
}

/**
 * Pipeline write-back. Routes through cf.set_state, so a human drag runs the
 * same state machine, logging and GHL mirroring as an automated transition —
 * it is not a shortcut around the engine.
 */
export async function setLeadState(leadId, state, reason) {
  return callRpc('cf_dash_set_state', {
    p: { lead_id: leadId, state, reason: reason || 'changed from dashboard' },
  })
}
