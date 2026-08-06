import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

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
export function useCfRpc(fn, args, { intervalMs = 0 } = {}) {
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

    load()
    if (intervalMs > 0) timer.current = setInterval(tick, intervalMs)

    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      if (timer.current) clearInterval(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, intervalMs])

  return { data, error, loading, refresh: load }
}

export const useCfHeadline = (region = 'uae') =>
  useCfRpc('cf_dash_headline', { p: { region } }, { intervalMs: 60_000 })

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

export async function lookupLead(q) {
  return callRpc('cf_lead_lookup', { p: { q } })
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
