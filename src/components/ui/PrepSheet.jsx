import { useEffect, useState } from 'react'
import { X, CalendarDays, ExternalLink, Phone, Megaphone, Quote } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

/**
 * The prep sheet — what a salesperson needs in the minute before the meeting.
 *
 * Reads cf_lead_brief, which names every field explicitly.
 *
 * 🔑 THE FIRST VERSION GUESSED FIELD NAMES AND GOT ONE WRONG IN PUBLIC. It
 * matched "Business" by substring, hit the key
 * `how_many_leads_your_business_handle_per_month`, and printed "Under 50" as
 * the lead's line of business. A loose match on a key you do not control is
 * not resilience — it is a wrong answer wearing the costume of a right one.
 * Nothing here is inferred; a field with no answer is simply not shown.
 *
 * 🔑 AND THE GOOD MATERIAL WAS NEVER BEING READ. What the agent actually
 * qualified on the call — where their leads leak, who chases follow-ups, how
 * many of ten become appointments, whether pricing came up — sits in
 * cf.call.structured and nothing had ever surfaced it.
 */

const DUBAI = 'Asia/Dubai'
const when = (iso) => iso
  ? new Date(iso).toLocaleString('en-GB', {
      timeZone: DUBAI, weekday: 'long', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit' })
  : null

const YESNO = { true: 'Yes', false: 'No', yes: 'Yes', no: 'No', unknown: 'Not established' }
const pretty = (v) => (v == null ? null : YESNO[String(v).toLowerCase()] ?? String(v).replace(/_/g, ' '))

// Ordered the way a salesperson would ask, not the way the database stores it.
const FROM_THE_CALL = [
  ['business',             'Business'],
  ['conversion_leak',      'Their main problem'],
  ['consistent_lead_gen',  'Steady lead flow?'],
  ['appointments_per_10',  'Appointments per 10 leads'],
  ['followup_owner',       'Who follows up now'],
  ['improvement_timeline', 'Wants it fixed by'],
  ['decision_maker',       'Decision maker?'],
  ['pricing_discussed',    'Pricing already discussed?'],
]
const FROM_THE_FORM = [
  ['leads_per_month',    'Leads a month'],
  ['implement_timeline', 'Wants to start'],
  ['lead_source',        'Leads come from'],
]

/** The agent writes its summary as markdown — "*   **Lead:** sells AI voice
 *  agents". Rendering that raw puts asterisks on a sheet somebody reads sixty
 *  seconds before a call, so it is parsed into label/value lines and the
 *  preamble ("Here's a summary for your CRM log:") is dropped. */
function Summary({ text }) {
  const rows = String(text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !/^here'?s a summary/i.test(l))
    .map(l => l.replace(/^[*\-\u2022]\s*/, ''))
    .map(l => {
      const m = l.match(/^\*\*(.+?):?\*\*:?\s*(.*)$/)
      if (m) return { label: m[1].trim(), value: m[2].replace(/\*\*/g, '').trim() }
      return { label: null, value: l.replace(/\*\*/g, '').trim() }
    })
    .filter(r => r.value || r.label)

  if (!rows.length) return null
  return (
    <div className="cf-prep__summary">
      {rows.map((r, i) => r.label
        ? <p key={i}><b>{r.label}</b> {r.value}</p>
        : <p key={i}>{r.value}</p>)}
    </div>
  )
}

export default function PrepSheet({ leadId, onClose }) {
  const [b, setB] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leadId) return
    let cancelled = false
    setLoading(true)
    supabase.rpc('cf_lead_brief', { p: { lead_id: leadId } }).then(({ data, error }) => {
      if (cancelled) return
      if (error) { toast.error(error.message); setLoading(false); return }
      setB(Array.isArray(data) ? data[0] : data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [leadId])

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  if (!leadId) return null

  const call = FROM_THE_CALL.map(([k, label]) => ({ label, value: pretty(b?.[k]) })).filter(r => r.value)
  const form = FROM_THE_FORM.map(([k, label]) => ({ label, value: pretty(b?.[k]) })).filter(r => r.value)
  const nothing = !loading && b?.found && !call.length && !form.length
    && !b?.call_summary && !(b?.their_words ?? []).length

  return (
    <div className="cf-ld__scrim" onClick={onClose}>
      <aside className="cf-prep" onClick={(e) => e.stopPropagation()}>
        <header className="cf-ld__head">
          <div className="min-w-0">
            <h2 className="cf-ld__name">{b?.name ?? (loading ? 'Loading…' : 'Lead')}</h2>
            {b?.meeting?.start_at && (
              <p className="cf-prep__when"><CalendarDays size={12} /> {when(b.meeting.start_at)}</p>
            )}
          </div>
          <button onClick={onClose} className="cf-ld__x" aria-label="Close"><X size={13} /> Close</button>
        </header>

        {loading && <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 w-full" />)}</div>}

        {!loading && b?.found && (
          <div className="cf-prep__body">
            <div className="cf-prep__contact">
              <a href={`tel:${b.call_phone || b.phone}`} className="cf-prep__phone">
                <Phone size={12} /> {b.call_phone || b.phone || 'no number'}
              </a>
              {b.meeting?.link && (
                <a href={b.meeting.link} target="_blank" rel="noreferrer" className="cf-prep__join">
                  <ExternalLink size={12} /> join the meeting
                </a>
              )}
            </div>

            {/* The summary first: it is the only thing that says what the
                conversation was actually about, in prose. */}
            {b.call_summary && (
              <div className="cf-prep__block">
                <span className="cf-prep__lbl">What was discussed on the call</span>
                <Summary text={b.call_summary} />
              </div>
            )}

            {b.notes && (
              <div className="cf-prep__block">
                <span className="cf-prep__lbl">Agent's note</span>
                <p className="cf-prep__note">{b.notes}</p>
              </div>
            )}

            {call.length > 0 && (
              <div className="cf-prep__block">
                <span className="cf-prep__lbl">What they told us on the call</span>
                <dl className="cf-prep__facts">
                  {call.map(r => (
                    <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>
                  ))}
                </dl>
              </div>
            )}

            {form.length > 0 && (
              <div className="cf-prep__block">
                <span className="cf-prep__lbl">From the ad form</span>
                <dl className="cf-prep__facts">
                  {form.map(r => (
                    <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>
                  ))}
                </dl>
              </div>
            )}

            {/* Their own words last, because a summary is somebody else's
                account and these are not. */}
            {(b.their_words ?? []).length > 0 && (
              <div className="cf-prep__block">
                <span className="cf-prep__lbl">
                  <Quote size={10} /> In their own words
                  {b.qualified_in === 'chat' && ' — from WhatsApp'}
                </span>
                <ul className="cf-prep__words">
                  {b.their_words.map((w, i) => <li key={i}>“{w}”</li>)}
                </ul>
              </div>
            )}

            {nothing && (
              <p className="cf-prep__none">
                Nothing was qualified yet — they booked before answering anything, and
                neither a call nor a chat has anything on record. Treat this as a cold
                discovery call.
              </p>
            )}

            <div className="cf-prep__foot">
              {b.ad?.ad_name && (
                <span className="cf-prep__ad"><Megaphone size={11} /> from <b>{b.ad.ad_name}</b></span>
              )}
              <span className="cf-prep__ad">
                {b.connected_calls
                  ? `${b.connected_calls} call${b.connected_calls === 1 ? '' : 's'} connected`
                  : 'never reached by phone'}
              </span>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
