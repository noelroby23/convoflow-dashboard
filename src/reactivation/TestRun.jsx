import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { Dot } from './bits'

/**
 * The test button — it can only ever dial a test number.
 *
 * Pressing Start releases a 50-dial pilot into the real list. That is the wrong
 * first move when what you actually want is to watch the queue fill, see a row
 * go live, and check the recording and transcript appear. This queues calls to
 * the team's own numbers instead and touches nothing else.
 *
 * 🔑 "TEST NUMBERS ONLY" IS ENFORCED IN THE DATABASE, NOT HERE. `cf_campaign_test`
 * sources its numbers from `cf.test_phone` and refuses anything else — hand it a
 * real lead's number and it queues nothing (migration 228, assertion B3). This
 * component cannot widen that even if somebody edits it, which is the point: a
 * guard that lives in the browser is a guard anyone can remove.
 *
 * ⚠️ It does NOT start the campaign and does NOT release a single real member.
 * The 359 people in batch 1 stay exactly where they are.
 */
export default function TestRun() {
  const [list, setList] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('cf_campaign_test', { p: { action: 'list' } })
    if (error) { setList({ error: error.message }); return }
    const d = Array.isArray(data) ? data[0] : data
    setList(d)
    // Default to everyone who can actually be dialled. Somebody opening this
    // wants to test, not to tick boxes first.
    setPicked(new Set((d?.numbers || []).filter((n) => n.ready).map((n) => n.phone)))
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (phone) => setPicked((s) => {
    const next = new Set(s)
    next.has(phone) ? next.delete(phone) : next.add(phone)
    return next
  })

  const run = async () => {
    if (!picked.size) return
    setBusy(true); setResult(null)
    try {
      const { data, error } = await supabase.rpc('cf_campaign_test',
        { p: { action: 'run', phones: [...picked] } })
      if (error) throw error
      const d = Array.isArray(data) ? data[0] : data
      setResult(d)
      if (d?.queued > 0) toast.success(`${d.queued} test call${d.queued > 1 ? 's' : ''} queued — watch the Queue tab`)
      else toast.error('Nothing was queued — see the reasons below')
    } catch (e) {
      // A refusal explains itself; swallowing it renders as a button that does nothing.
      toast.error(e.message)
      setResult({ ok: false, reason: e.message })
    } finally { setBusy(false) }
  }

  const ready = (list?.numbers || []).filter((n) => n.ready)

  return (
    <section className="card" style={{ marginTop: 20, borderColor: '#5E2340' }}>
      <p className="eyebrow" style={{ color: 'var(--pink)' }}>Before you launch</p>
      <h2 className="sec-title">Try it on your own phones first</h2>
      <p className="sec-sub">
        Queues a real reactivation call to the numbers below and nothing else. The campaign stays
        where it is, and not one of the people on your list is touched.
      </p>

      {list?.error && <div className="rx-error">Could not load the test numbers. {list.error}</div>}
      {!list && <div className="rx-loading">loading the test numbers…</div>}

      {list?.numbers && (
        <>
          <div style={{ display: 'grid', gap: 6, margin: '16px 0 4px' }}>
            {list.numbers.map((n) => (
              <label
                key={n.phone}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px',
                  borderRadius: 9, border: '1px solid var(--hairline-soft)',
                  background: picked.has(n.phone) ? '#2A0F1C' : 'var(--raised)',
                  cursor: n.ready ? 'pointer' : 'not-allowed', opacity: n.ready ? 1 : 0.5,
                }}
                title={n.why_not || undefined}
              >
                <input
                  type="checkbox" disabled={!n.ready}
                  checked={picked.has(n.phone)}
                  onChange={() => toggle(n.phone)}
                  style={{ accentColor: 'var(--pink)' }}
                />
                <span style={{ fontWeight: 600, minWidth: 160 }}>{n.who}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{n.phone}</span>
                {/* A number that cannot be dialled says why, rather than just
                    being greyed out and leaving somebody to guess. */}
                {!n.ready && (
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--warn)',
                    letterSpacing: '.06em', textTransform: 'uppercase', marginLeft: 'auto' }}>
                    {n.why_not}
                  </span>
                )}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              onClick={run}
              disabled={busy || !picked.size}
              className="mono"
              style={{
                background: picked.size ? 'var(--pink)' : 'var(--raised)',
                color: picked.size ? '#170A10' : 'var(--dim)',
                border: 0, borderRadius: 9, padding: '11px 20px', fontWeight: 700,
                fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase',
                cursor: picked.size && !busy ? 'pointer' : 'not-allowed',
              }}
            >
              {busy ? 'queueing…' : `Call ${picked.size || 'no'} test number${picked.size === 1 ? '' : 's'}`}
            </button>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
              rings within a minute · the campaign is not started · no real lead is called
            </span>
          </div>

          {result && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline-soft)' }}>
              {result.queued > 0 && (
                <>
                  <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                    <Dot tone="good" /> {result.queued} call{result.queued > 1 ? 's' : ''} queued.
                    They will ring within a minute — open the <b>Queue</b> tab to watch.
                  </p>
                  <ul className="mono" style={{ fontSize: 12, color: 'var(--muted)', margin: 0, paddingLeft: 18 }}>
                    {(result.calls || []).map((x) => (
                      <li key={x.queue_id}>{x.who} · {x.phone}</li>
                    ))}
                  </ul>
                </>
              )}
              {/* Skips are named, never silently dropped: a test that quietly
                  dials three of four teaches the wrong thing about the fourth. */}
              {result.skipped > 0 && (
                <p className="mono" style={{ fontSize: 12, color: 'var(--warn)', marginTop: 10 }}>
                  {result.skipped} skipped —{' '}
                  {(result.skipped_detail || []).map((x) => `${x.who} (${x.why})`).join(' · ')}
                </p>
              )}
              {result.ok === false && (
                <p className="mono" style={{ fontSize: 12, color: 'var(--bad)' }}>{result.reason}</p>
              )}
            </div>
          )}

          {ready.length === 0 && list.numbers.length > 0 && (
            <p className="mono" style={{ fontSize: 12, color: 'var(--warn)', marginTop: 12 }}>
              None of these numbers can be dialled right now — see the reason beside each.
            </p>
          )}
        </>
      )}
    </section>
  )
}
