import { useEffect, useState } from 'react'
import {
  X, Phone, MessageSquare, GitBranch, Bug, CalendarDays, Megaphone,
  Loader2, ExternalLink, ListChecks,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useDashboard } from '../../store/dashboard'
import { toast } from 'sonner'
import { CallRecording as Recording, CallTranscript as Transcript } from './CallRecording'

/**
 * Everything that ever happened to one lead, in one panel.
 *
 * cf_lead_detail has returned all of this since migration 111 and NOTHING has
 * ever called it (§7 item 139) — the drawer that did was lost in a deploy. So
 * this is not new data, it is data that has been sitting unread.
 *
 * 🔑 TWO RENDERING BUGS THIS FIXES, both of which made the record look empty
 * when it was full:
 *   · messages were compared against dir === 'in' while the column holds
 *     'inbound', so every message the LEAD sent rendered as one of ours. The
 *     whole conversation looked like the bot talking to itself.
 *   · the recording was never playable. cf.call.recording_url is an unsigned
 *     R2 object path that 400s in a browser; only VAPI's presigned URL plays,
 *     and only cf-recording can mint one.
 */

const DUBAI = 'Asia/Dubai'
const fmt = (iso) => iso
  ? new Date(iso).toLocaleString('en-GB', { timeZone: DUBAI, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—'
const day = (iso) => iso
  ? new Date(iso).toLocaleDateString('en-GB', { timeZone: DUBAI, day: 'numeric', month: 'short', year: 'numeric' })
  : '—'

const VERDICT = {
  ai_failure: '#FB7185', system_failure: '#FBBF24',
  lead_not_ready: '#8A8781', unclear: '#57544E',
}

function Section({ icon: Icon, title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="cf-ld__sec">
      <button type="button" className="cf-ld__sechead" onClick={() => setOpen(v => !v)}>
        <Icon size={13} />
        <span>{title}</span>
        {count != null && <span className="cf-ld__count">{count}</span>}
        <span className="cf-ld__chev">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="cf-ld__secbody">{children}</div>}
    </section>
  )
}

/** Move a lead to any stage, from wherever the record is open.
 *
 *  🔑 ONE WRITE PATH. cf_dash_set_state moves lead_state and emits the GHL
 *  mirror ops, and every board on every page reads lead_state — so this one
 *  control reaches Lead Desk, the Sales Desk, Home and the CRM without a
 *  second writer. Two writers for one field is how the desk and the CRM
 *  drifted apart before.
 */
function StagePicker({ leadId, current, onDone }) {
  const [stages, setStages] = useState([])
  const [busy, setBusy] = useState(false)
  const bump = useDashboard(s => s.refresh)

  useEffect(() => {
    supabase.rpc('cf_lead_states', { p: { region: 'uae' } })
      .then(({ data }) => setStages(data ?? []))
  }, [])

  const move = async (state) => {
    if (!state || state === current) return
    const s = stages.find(x => x.state === state)
    // Warn before a stage that kills every queued call and message. Finding
    // that out after the click is not a choice, it is a surprise.
    if (s?.stops_contact &&
        !window.confirm(`"${s.stage_name}" stops all contact — every queued call and message for this lead is cancelled. Continue?`)) {
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.rpc('cf_dash_set_state', {
        p: { lead_id: leadId, state, reason: 'moved from the lead record' },
      })
      if (error) throw new Error(error.message)
      toast.success(`Moved to ${s?.stage_name ?? state} · GHL updated`)
      bump?.()          // every other page refetches
      onDone?.()
    } catch (e) {
      toast.error(e.message || 'Could not move that lead')
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="cf-ld__stage">
      <span>Move to</span>
      <select value={current ?? ''} disabled={busy || !stages.length}
              onChange={(e) => move(e.target.value)}>
        <option value="">choose a stage…</option>
        {stages.map(s => (
          <option key={s.state} value={s.state}>
            {s.stage_name}{s.stops_contact ? ' — stops contact' : ''}
          </option>
        ))}
      </select>
      {busy && <Loader2 size={12} className="animate-spin" />}
    </label>
  )
}

export default function LeadDetail({ leadId, onClose }) {
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!leadId) return
    let cancelled = false
    setLoading(true)
    supabase.rpc('cf_lead_detail', { p: { lead_id: leadId } }).then(({ data, error }) => {
      if (cancelled) return
      if (error) { toast.error(error.message); setLoading(false); return }
      setD(Array.isArray(data) ? data[0] : data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [leadId, version])

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  if (!leadId) return null
  const l = d?.lead
  const att = d?.attribution

  return (
    <div className="cf-ld__scrim" onClick={onClose}>
      <aside className="cf-ld" onClick={(e) => e.stopPropagation()}>
        <header className="cf-ld__head">
          <div className="min-w-0">
            <h2 className="cf-ld__name">{l?.name ?? (loading ? 'Loading…' : 'Lead')}</h2>
            {l && (
              <p className="cf-ld__sub">
                {l.status || l.state}
                {l.since && <> · since {fmt(l.since)}</>}
              </p>
            )}
          </div>
          <button onClick={onClose} className="cf-ld__x" aria-label="Close">
            <X size={13} /> Close
          </button>
        </header>

        {loading && <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>}

        {!loading && d?.found === false && <p className="cf-ld__empty p-5">No record for that lead.</p>}

        {!loading && l && (
          <div className="cf-ld__body">
            {/* Identity. Both numbers, because §5.4b makes them different
                things: one is for WhatsApp, one is for the dialler. */}
            <div className="cf-ld__grid">
              <div><span>WhatsApp</span><b>{l.phone || '—'}</b></div>
              <div><span>Calling number</span><b>{l.call_phone || l.phone || '—'}</b></div>
              <div><span>Source</span><b>{l.source || '—'}</b></div>
              <div><span>Stage</span><b>{l.stage_name || l.state}</b></div>
              <div><span>First seen</span><b>{day(l.created_at)}</b></div>
              <div><span>Dials / attempts</span><b>{l.dials ?? 0} / {l.attempts ?? 0}</b></div>
            </div>

            {l.killed && (
              <p className="cf-ld__killed">
                Stopped — {l.kill_reason || 'no reason recorded'} · {fmt(l.killed_at)}
              </p>
            )}
            <StagePicker leadId={leadId} current={l.state}
                         onDone={() => setVersion(v => v + 1)} />

            {l.ghl_url && (
              <a href={l.ghl_url} target="_blank" rel="noreferrer" className="cf-ld__ghl">
                <ExternalLink size={11} /> open in GHL
              </a>
            )}

            {att?.ad_name && (
              <Section icon={Megaphone} title="Where they came from" defaultOpen>
                <div className="cf-ld__grid">
                  <div><span>Ad</span><b>{att.ad_name}</b></div>
                  {att.adset_name && <div><span>Ad set</span><b>{att.adset_name}</b></div>}
                  {att.campaign_name && <div><span>Campaign</span><b>{att.campaign_name}</b></div>}
                </div>
              </Section>
            )}

            <Section icon={Phone} title="Calls" count={d.calls_total ?? d.calls?.length ?? 0} defaultOpen>
              {(d.calls ?? []).length === 0 && <p className="cf-ld__empty">No calls yet.</p>}
              {(d.calls ?? []).map((c, i) => (
                <div key={i} className="cf-ld__call">
                  <div className="cf-ld__callhead">
                    <span className={`cf-ld__pill${c.connected ? ' is-good' : ''}`}>
                      {c.connected ? (c.outcome || 'connected') : (c.ended_reason || 'no connect')}
                    </span>
                    <span className="cf-ld__meta">{fmt(c.at || c.started)}</span>
                    {c.secs != null && <span className="cf-ld__meta">{c.secs}s</span>}
                    {c.role && <span className="cf-ld__meta">{c.role}</span>}
                    <span className="ml-auto">
                      <Recording callId={c.vapi_call_id} hasRecording={c.has_recording} />
                    </span>
                  </div>
                  {c.summary && <p className="cf-ld__summary">{c.summary}</p>}
                  {c.transcript && <Transcript text={c.transcript} />}
                </div>
              ))}
            </Section>

            {/* The whole thread, both sides. */}
            <Section icon={MessageSquare} title="WhatsApp" count={d.messages_total ?? d.messages?.length ?? 0} defaultOpen>
              {(d.messages ?? []).length === 0 && <p className="cf-ld__empty">No messages.</p>}
              <div className="cf-ld__thread">
                {(d.messages ?? []).map((m, i) => {
                  // 'inbound', not 'in'. Comparing against 'in' matched nothing
                  // and rendered every message the lead sent as one of ours.
                  const theirs = m.dir === 'inbound'
                  return (
                    <div key={i} className={`cf-ld__msg${theirs ? ' is-them' : ''}`}>
                      <div className="cf-ld__bubble">{m.text || <em>(no text)</em>}</div>
                      <div className="cf-ld__msgmeta">
                        {theirs ? 'them' : 'us'} · {fmt(m.at)}{m.template ? ` · ${m.template}` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>

            {(d.appointments ?? []).length > 0 && (
              <Section icon={CalendarDays} title="Meetings" count={d.appointments.length}>
                {d.appointments.map((a, i) => (
                  <div key={i} className="cf-ld__row">
                    <span>{fmt(a.start_at)}</span>
                    <span className="cf-ld__pill">{a.status}</span>
                    {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="cf-ld__link">join</a>}
                  </div>
                ))}
              </Section>
            )}

            {((d.queued_calls ?? []).length > 0 || (d.queued_messages ?? []).length > 0) && (
              <Section icon={ListChecks} title="What happens next"
                       count={(d.queued_calls?.length ?? 0) + (d.queued_messages?.length ?? 0)} defaultOpen>
                {(d.queued_calls ?? []).map((q, i) => (
                  <div key={`c${i}`} className="cf-ld__row"><span>Call</span><span className="cf-ld__meta">{fmt(q.due || q.not_before)}</span></div>
                ))}
                {(d.queued_messages ?? []).map((q, i) => (
                  <div key={`m${i}`} className="cf-ld__row"><span>{q.template || 'Message'}</span><span className="cf-ld__meta">{fmt(q.due || q.fire_at)}</span></div>
                ))}
              </Section>
            )}

            {(d.journey ?? []).length > 0 && (
              <Section icon={GitBranch} title="Journey" count={d.journey.length}>
                {d.journey.map((j, i) => (
                  <div key={i} className="cf-ld__row">
                    <span>{j.from ? `${j.from} → ${j.to}` : j.to}</span>
                    <span className="cf-ld__meta">{j.reason}</span>
                    <span className="cf-ld__meta ml-auto">{fmt(j.at)}</span>
                  </div>
                ))}
              </Section>
            )}

            {(d.actions ?? []).length > 0 && (
              <Section icon={ListChecks} title="Everything the system did" count={d.actions.length}>
                {d.actions.map((a, i) => (
                  <div key={i} className="cf-ld__row">
                    <span>{a.flow}{a.step ? ` · ${a.step}` : ''}</span>
                    <span className={`cf-ld__meta${a.error ? ' is-bad' : ''}`}>{a.error || a.result}</span>
                    <span className="cf-ld__meta ml-auto">{fmt(a.at)}</span>
                  </div>
                ))}
              </Section>
            )}

            {(d.qa ?? []).length > 0 && (
              <Section icon={Bug} title="QA findings" count={d.qa.length}>
                {d.qa.map((q, i) => (
                  <div key={i} className="cf-ld__qa">
                    <div className="cf-ld__qahead">
                      <span className="cf-ld__pill" style={{ color: VERDICT[q.verdict] }}>{q.verdict}</span>
                      <span className="cf-ld__meta">sev {q.severity}</span>
                      <span className="cf-ld__meta ml-auto">{fmt(q.at)}</span>
                    </div>
                    <p className="cf-ld__qatitle">{q.title}</p>
                    {q.analysis && <p className="cf-ld__summary">{q.analysis}</p>}
                  </div>
                ))}
              </Section>
            )}

            {d.known_answers && Object.keys(d.known_answers).length > 0 && (
              <Section icon={ListChecks} title="What they told us" count={Object.keys(d.known_answers).length}>
                <div className="cf-ld__grid">
                  {Object.entries(d.known_answers).map(([k, v]) => (
                    <div key={k}><span>{k.replace(/_/g, ' ')}</span><b>{String(v)}</b></div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
