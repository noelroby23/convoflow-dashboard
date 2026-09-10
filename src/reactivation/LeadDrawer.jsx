import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { CallRecording, CallTranscript } from '../components/ui/CallRecording'
import { fetchLead } from './useCampaign'
import { Feed, OutcomePill } from './bits'
import { num, dur, fmtWhen, fmtDay, ago } from './format'
import { downloadBlob, stamp } from './ExportSheet'

/**
 * The lead drawer — §10.1. Opens from a queue row, a pipeline card or a search
 * result, over a scrim, and closes on the scrim or on Esc.
 *
 * ⚠️ NO Esc HANDLER HERE. The shell owns one keydown listener and closes the
 * innermost thing first (Reactivation.jsx). A second listener would close the
 * drawer AND the panel behind it on one press.
 *
 * 🔑 WHY "WHAT SARAH CAPTURED" IS THE SHARPEST THING ON THIS PAGE, and why the
 * missing state is loud rather than blank: open a lead she booked with nothing
 * asked and every row reads "Not asked" in amber with a flag under it; open a
 * properly qualified one and it is full. Same agent, same week, side by side —
 * that is how a prompt argument is settled in thirty seconds, and it only works
 * if an unasked question looks like a failure instead of an empty cell.
 *
 * 🔑 THE PLAYER AND THE TRANSCRIPT ARE THE APP'S OWN, IMPORTED, NOT REBUILT.
 * cf.call.recording_url is an unsigned R2 path that 404s in a browser — 267
 * "play" links in this app had never played anything (§7 item 139). Only
 * CallRecording knows to mint a presigned URL through the cf-recording edge
 * function, and only it knows a 400 carrying "retention" means the audio aged
 * out rather than the dashboard being broken (§7 item 140). A second player
 * here would be a second thing to get that wrong.
 */

/**
 * The six questions, in the order and with the meaning the DATABASE already
 * uses — cf_campaign_export names exactly these, so the drawer and the
 * spreadsheet can never disagree about what "qualified" means.
 *
 * The extra keys per row are aliases the live data actually carries: the voice
 * agent's structured schema has been rewritten several times (`business` then
 * `Industry`, `lead_volume` then `conv_monthly_lead_volume`), and a lead who
 * answered under an older key must not be reported as never asked. A FALSE
 * "Not asked" is worse than no list at all, because the whole section is read
 * as evidence.
 */
const QUAL = [
  { label: 'Industry',            keys: ['business', 'Industry', 'industry'] },
  { label: 'Monthly lead volume', keys: ['lead_volume', 'monthly_lead_volume', 'conv_monthly_lead_volume'] },
  { label: 'Who follows up now',  keys: ['handles_leads_now', 'conv_followup_owner', 'who_follows_up'] },
  { label: 'Budget discussed',    keys: ['budget_discussed', 'pricing_discussed'] },
  { label: 'Decision maker',      keys: ['is_decision_maker'] },
  { label: 'Main problem',        keys: ['main_problem', 'main_need', 'pain_point', 'conv_main_conversion_leak'] },
]

/** Answers worth showing when they exist, but not worth flagging when they do
 *  not — so a genuinely captured answer is never hidden by the six-row list. */
const EXTRA = {
  primary_objection: 'Objection',
  implement_timeline: 'Timeline',
  conv_improvement_timeline: 'Timeline',
  Timeline_for_Implementation: 'Timeline',
  conv_primary_lead_source: 'Where leads come from',
  primary_lead_source: 'Where leads come from',
  language: 'Language',
  conv_has_consistent_lead_gen: 'Steady lead flow',
  conv_leads_to_appointment_out_of_10: 'Leads that become appointments',
  team_size_or_role: 'Their role',
  conv_language_preference: 'Language',
  dq_reason: 'Why disqualified',
}

const NOT_AN_ANSWER = new Set(['', 'unknown', 'null', 'none', 'n/a', 'na', 'not discussed', 'not_discussed', 'not asked'])

/** A captured `false` IS an answer — "no, not the decision maker" is a real
 *  qualification, and rendering it as missing loses the most useful half. */
function answerOf(known, keys) {
  for (const k of keys) {
    const v = known?.[k]
    if (v === true) return 'Yes'
    if (v === false) return 'No'
    if (v == null) continue
    if (typeof v === 'object') { const s = JSON.stringify(v); if (s !== '{}' && s !== '[]') return s }
    const s = String(v).trim()
    if (s && !NOT_AN_ANSWER.has(s.toLowerCase())) return s
  }
  return null
}

const Fact = ({ k, children }) => (
  <div className="f">
    <span className="k">{k}</span>
    <div className={`v${children == null ? ' mut' : ''}`}>{children ?? '—'}</div>
  </div>
)

export default function LeadDrawer({ leadId, onClose }) {
  const [feed, setFeed] = useState({ data: null, error: null, loading: true })
  const [openCall, setOpenCall] = useState(null)   // vapi_call_id of the transcript on show
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    let alive = true
    setFeed((f) => ({ ...f, loading: true }))
    fetchLead(leadId)
      .then((data) => { if (alive) setFeed({ data, error: null, loading: false }) })
      .catch((error) => { if (alive) setFeed((f) => ({ ...f, error, loading: false })) })
    return () => { alive = false }
  }, [leadId])

  useEffect(load, [load])

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Lead detail">
        {/* The close button exists before the data does. A drawer that fails to
            load and offers no way out is the state a reader is most likely to
            hit and least likely to forgive. */}
        {!feed.data && (
          <div className="dr-head">
            <div className="top">
              <div><h2>Lead</h2><div className="ph">{feed.error ? 'could not load' : 'loading…'}</div></div>
              <button className="x" onClick={onClose} aria-label="Close">×</button>
            </div>
          </div>
        )}
        {/* display:contents so the loaded body's own head/body/foot stay direct
            flex children of the drawer; a plain wrapper would break the sticky
            footer. Inline rather than a Tailwind class — this page is not
            Tailwind and the two must not meet. */}
        <div className={feed.data ? undefined : 'dr-body'}
             style={feed.data ? { display: 'contents' } : undefined}>
        <Feed
          feed={feed}
          what="this lead"
          empty={<Body notFound onClose={onClose} reason={feed.data?.reason} />}
        >
          {(d) => (
            <Body
              d={d} onClose={onClose} busy={busy} setBusy={setBusy}
              openCall={openCall} setOpenCall={setOpenCall} reload={load}
            />
          )}
        </Feed>
        </div>
      </aside>
    </>
  )
}

function Body({ d, notFound, reason, onClose, busy, setBusy, openCall, setOpenCall, reload }) {
  if (notFound) {
    return (
      <>
        <div className="dr-head">
          <div className="top">
            <div><h2>No such lead</h2><div className="ph">{reason || 'that lead id is not in the database'}</div></div>
            <button className="x" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>
        <div className="dr-body">
          <div className="rx-empty">
            <b>Nothing to show</b>
            A lead is opened by its id, and this one resolved to nothing — usually a record
            that was merged or purged after the card was drawn. Close and reopen the tab.
          </div>
        </div>
      </>
    )
  }

  const lead = d.lead || {}
  const camp = d.campaign
  const calls = d.calls || []
  const known = d.known_answers || {}
  const appts = d.appointments || []
  const qa = d.qa || []
  const qCalls = d.queued_calls || []
  const qMsgs = d.queued_messages || []
  const ad = d.attribution || {}

  // Attempt numbering runs oldest-first the way a person counts them, off the
  // true total rather than the page — the RPC caps `calls` at 50.
  const total = d.calls_total ?? calls.length
  const numbered = calls.map((c, i) => ({ ...c, attempt: total - i }))

  // The call whose transcript and recording are on show. Newest by default,
  // preferring one that actually connected — the top of the list is often a
  // carrier failure with nothing in it.
  const selected = useMemo(() => {
    if (openCall) return numbered.find((c) => c.vapi_call_id === openCall) || null
    // 309: the MAIN call — the latest sales call — never a reminder that happened to be newer
    return (d.main_call_id && numbered.find((c) => c.vapi_call_id === d.main_call_id))
      || numbered.find((c) => c.connected && c.transcript) || numbered[0] || null
  }, [openCall, numbered])

  const answers = QUAL.map((q) => ({ label: q.label, value: answerOf(known, q.keys) }))
  const missing = answers.filter((a) => a.value == null).length
  const extras = Object.entries(EXTRA)
    .map(([k, label]) => ({ label, value: answerOf(known, [k]) }))
    .filter((e) => e.value != null)
  // Dedupe repeated labels (three keys mean "Timeline").
  const seenExtra = new Set()
  const extraRows = extras.filter((e) => (seenExtra.has(e.label) ? false : seenExtra.add(e.label)))

  const futureMeeting = appts.find((a) => ['booked', 'rescheduled'].includes(a.status) && new Date(a.start_at) > new Date())
  /**
   * 🔑 A MEETING ONLY COUNTS IF THIS CONVERSATION COULD HAVE MADE IT.
   * Honore was flagged "Booked with almost nothing asked" on the strength of two
   * meetings from 13 MAY, three months before the campaign released him — he was
   * disqualified on the call being judged, not booked. `appts[0]` is any meeting
   * ever, which reads history as a campaign outcome (§7 item 197's class).
   * Migration 259 adds booked_at, so the question can be asked properly: booked
   * after the campaign reached them, or failing that after the oldest call on
   * screen. No date at all falls back to counting it, because refusing to flag is
   * the safer half of the trade.
   */
  const judgeFrom = camp?.released_at
    || numbered.map((c) => c.at).filter(Boolean).sort()[0]
    || null
  const anyMeeting = appts.find((a) =>
    !a.booked_at || !judgeFrom || new Date(a.booked_at) >= new Date(judgeFrom))
  const spoken = numbered.filter((c) => c.connected).length

  /**
   * The flag under the qualification list.
   *
   * The system's own verdict comes first: if the QA scoring already wrote a
   * ticket on this lead, that sentence is the finding — written by the pass
   * that reads the transcript AND what the system actually did, so it does not
   * make item 162's mistake of calling a kept promise a broken one. Only when
   * there is no ticket does the drawer speak for itself, and then only about
   * the list immediately above it.
   */
  const ticket = qa.find((t) => t.severity >= 3 && t.verdict !== 'lead_not_ready')
  const flag = ticket
    ? { head: `FLAGGED · SEV ${ticket.severity}`, text: ticket.title, sub: ticket.analysis }
    // Nothing is flagged unless somebody actually picked up. A wrong number and
    // nine unanswered dials leave the same six empty rows as a botched
    // conversation, and calling that a failure is how a review board fills with
    // things nobody did wrong (§5.8's `lead_not_ready` rule, applied here).
    // …and nothing is flagged where the record already says there was nothing
    // to get right: a wrong number, or a QA pass that looked at this lead and
    // returned `lead_not_ready`. Manufacturing a failure to look thorough is
    // the fault §5.8 spends most of its words on.
    : (spoken === 0 || lead.state === 'wrong_number' || qa.some((t) => t.verdict === 'lead_not_ready'))
      ? null
      : (missing >= 4 && anyMeeting)
        ? { head: 'FLAGGED', text: `Booked with almost nothing asked — ${missing} of the ${answers.length} questions never came up across ${spoken} ${spoken === 1 ? 'conversation' : 'conversations'}.` }
        : (missing === answers.length)
          ? { head: 'FLAGGED', text: `${spoken} ${spoken === 1 ? 'conversation' : 'conversations'} and not one of the ${answers.length} qualifying questions was answered.` }
          : null

  const move = async (state, saying, warn) => {
    if (warn && !window.confirm(warn)) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('cf_dash_set_state', {
        p: { lead_id: lead.lead_id, state, reason: 'handed over from the reactivation drawer' },
      })
      if (error) throw new Error(error.message)
      toast.success(saying)
      reload()
    } catch (e) {
      toast.error(e.message || 'Could not move that lead')
    } finally {
      setBusy(false)
    }
  }

  /** One lead, one file — built from the payload already on screen, so it can
   *  never say something different from what the reader is looking at. */
  const exportLead = () => {
    const rows = numbered.length ? numbered.map((c) => ({
      name: lead.name, phone: lead.phone, calling_number: lead.call_phone, email: lead.email,
      source: lead.source, stage: lead.stage_name, status: lead.status,
      attempt: c.attempt, at: c.at, connected: c.connected, outcome: c.outcome,
      ended_reason: c.ended_reason, duration_sec: c.secs, role: c.role,
      summary: (c.summary || '').replace(/[\r\n]+/g, ' '),
      transcript: (c.transcript || '').replace(/[\r\n]+/g, ' | '),
      recording_call_id: c.has_recording ? c.vapi_call_id : null,
      ...Object.fromEntries(answers.map((a) => [a.label.toLowerCase().replace(/\s+/g, '_'), a.value])),
    })) : [{
      name: lead.name, phone: lead.phone, email: lead.email, source: lead.source,
      stage: lead.stage_name, status: lead.status, attempt: null,
      note: 'no calls on record for this lead',
    }]
    const csv = Papa.unparse(rows)
    const safe = String(lead.name || 'lead').replace(/[^\w]+/g, '-').toLowerCase()
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `lead-${safe}-${stamp()}.csv`)
    toast.success('Downloaded — every call and full transcripts')
  }

  const downloadRecording = async () => {
    if (!selected?.vapi_call_id) return
    setBusy(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/cf-recording`, {
        method: 'POST',
        headers: {
          apikey: supabase.supabaseKey,
          Authorization: `Bearer ${token ?? supabase.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ call_id: selected.vapi_call_id }),
      })
      const body = await res.json().catch(() => null)
      // "Gone" and "broken" need different words. VAPI keeps 14 days and says so
      // in a 400 with a sentence in it, not in a 404 (§7 item 140).
      if (res.status === 404 || body?.expired) {
        toast.error('That audio has expired — VAPI keeps 14 days. The transcript below is permanent.')
        return
      }
      if (!res.ok || !body?.url) throw new Error(body?.error ?? `HTTP ${res.status}`)
      try {
        const audio = await fetch(body.url)
        if (!audio.ok) throw new Error(`HTTP ${audio.status}`)
        downloadBlob(await audio.blob(), `call-${selected.vapi_call_id}.wav`)
        toast.success('Recording saved')
      } catch {
        // The presigned link lives 30 minutes; opening it is still a real way
        // to get the file if the cross-origin fetch is refused.
        window.open(body.url, '_blank', 'noopener')
      }
    } catch (e) {
      toast.error(e.message || 'Could not fetch that recording')
    } finally {
      setBusy(false)
    }
  }

  const isHuman = lead.state === 'human_intervention'

  return (
    <>
      <div className="dr-head">
        <div className="top">
          <div>
            <h2>{lead.name || 'Unnamed lead'}</h2>
            {/* The business they are from, right under the name. GHL carried
                `companyName` all along and nothing read it (migration 276). */}
            {lead.company && <div className="co">{lead.company}</div>}
            <div className="ph">
              {lead.phone || 'no number on file'}
              {lead.call_phone && lead.call_phone !== lead.phone && <> · calls go to {lead.call_phone}</>}
            </div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="dr-stage">
          <span className={`tagline ${toneClass(lead.state)}`} style={{ margin: 0 }}>
            {lead.stage_name || lead.state || 'no stage'}
          </span>
          {camp
            ? <span className="tagline hot" style={{ margin: 0 }}>
                {camp.attempt ? `Attempt ${camp.attempt} of ${camp.of}` : `Reactivation · ${camp.member_status}`}
              </span>
            : <span className="tagline flatt" style={{ margin: 0 }}>
                {lead.attempts != null ? `Attempt ${num(lead.attempts)}` : 'Not in the campaign'}
              </span>}
          {camp?.exclude_reason && (
            <span className="tagline warnt" style={{ margin: 0 }}>Not called — {camp.exclude_reason}</span>
          )}
          {camp?.stage_predates_campaign && (
            <span className="tagline bluet" style={{ margin: 0 }} title="This stage is from before the campaign rang them">
              Stage predates this campaign
            </span>
          )}
        </div>
      </div>

      <div className="dr-body">
        {lead.status && (
          <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--muted)' }}>{lead.status}</p>
        )}

        <div className="dr-h">Who they are</div>
        <div className="facts">
          <Fact k="Company">{lead.company}</Fact>
          <Fact k="Phone">{lead.phone}</Fact>
          <Fact k="Email">{lead.email}</Fact>
          <Fact k="Came from">{lead.source}</Fact>
          <Fact k="First enquired">{lead.created_at ? fmtDay(lead.created_at) : null}</Fact>
          {/* Nobody is assigned to a LEAD in the CRM — only deals and meetings
              carry an owner, and meetings are round-robin (§7 items 163/175).
              An em-dash is the honest answer; a name here would be invented. */}
          <Fact k="Owner">{null}</Fact>
          <Fact k="Attempts used">
            {camp?.attempt != null ? `${camp.attempt} of ${camp.of}`
              : lead.attempts != null ? `${num(lead.attempts)} · ${num(lead.dials)} dial${lead.dials === 1 ? '' : 's'}`
              : null}
          </Fact>
        </div>

        {(ad.ad_name || ad.campaign_name) && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>
            Came in on <b style={{ color: 'var(--muted)' }}>{ad.ad_name || ad.campaign_name}</b>
            {ad.adset_name && <> · {ad.adset_name}</>}
          </p>
        )}

        <div className="dr-h">What Sarah captured</div>
        {answers.map((a) => (
          <div className="qa" key={a.label}>
            <span className="q">{a.label}</span>
            <span className={`a${a.value == null ? ' miss' : ''}`}>{a.value ?? 'Not asked'}</span>
          </div>
        ))}
        {extraRows.map((e) => (
          <div className="qa" key={e.label}>
            <span className="q">{e.label}</span>
            <span className="a">{e.value}</span>
          </div>
        ))}
        {flag && (
          <div className="leak">
            <span className="ic">{flag.head}</span>
            <p>
              {flag.text}
              {flag.sub && <><br /><span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{flag.sub}</span></>}
            </p>
          </div>
        )}
        {!flag && spoken > 0 && missing > 0 && missing < answers.length && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>
            {missing} of {answers.length} never came up. The rest is on record.
          </p>
        )}
        {spoken === 0 && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>
            {total === 0
              ? 'Nothing has been asked because nobody has called them yet.'
              : `${total} ${total === 1 ? 'attempt' : 'attempts'} and nobody has picked up, so there was nothing she could ask.`}
          </p>
        )}

        <div className="dr-h">Every call</div>
        {!numbered.length && (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)' }}>
            No calls on record. {qCalls.length > 0 ? 'One is queued — see below.' : 'Nothing is queued either.'}
          </p>
        )}
        {numbered.map((c) => (
          <div className="att-row" key={c.vapi_call_id || c.at}>
            <span className="num">{c.attempt} of {total}</span>
            <div className="info">
              <div className="d">
                <OutcomePill outcome={pillFor(c)}>{outcomeWords(c)}</OutcomePill>
              </div>
              <div className="t">
                {fmtWhen(c.at)}
                {!c.started && ' · never rang'}
                {c.secs != null && c.secs > 0 && ` · ${dur(c.secs)}`}
                {(c.agent || c.role) && ` · ${c.agent || c.role}`}
                {c.is_main && ' · main call'}
              </div>
            </div>
            <CallRecording callId={c.vapi_call_id} hasRecording={!!c.has_recording} />
            {c.transcript
              ? <button
                  className="qact"
                  aria-pressed={selected?.vapi_call_id === c.vapi_call_id}
                  onClick={() => setOpenCall(c.vapi_call_id)}
                >
                  Transcript
                </button>
              : <span className="qdur" style={{ color: 'var(--dim)' }}>no transcript</span>}
          </div>
        ))}

        {selected && (
          <>
            <div className="dr-h">
              Recording · attempt {selected.attempt} of {total} · {fmtWhen(selected.at)}
            </div>
            <div className="player">
              <div className="row">
                {/* The app's player, not a drawn waveform. There is no scrubber
                    because there is no waveform data — a fake one implies a
                    seek bar that does not exist. */}
                <CallRecording callId={selected.vapi_call_id} hasRecording={!!selected.has_recording} />
                <span className="tm" style={{ marginLeft: 'auto' }}>
                  {selected.secs != null ? dur(selected.secs) : '—'}
                </span>
              </div>
              {selected.summary && (
                <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--muted)' }}>
                  {selected.summary}
                </p>
              )}
            </div>

            <div className="dr-h">Transcript</div>
            <div
              className="tscript"
              /* The shared renderer reads --ink for the lead's words, and inside
                 .rx that variable is the page BACKGROUND, not the text colour.
                 Left alone, every word the lead said renders black on black. */
              style={{ '--ink': 'var(--text)', '--faint': 'var(--dim)', padding: '10px 16px' }}
            >
              {selected.transcript
                ? <CallTranscript text={selected.transcript} />
                : <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>
                    Nothing was transcribed on this attempt.
                  </p>}
            </div>
          </>
        )}

        {(qCalls.length > 0 || qMsgs.length > 0 || futureMeeting) && (
          <>
            <div className="dr-h">What happens next</div>
            {futureMeeting && (
              <div className="att-row">
                <span className="num">Meeting</span>
                <div className="info">
                  <div className="d">{fmtWhen(futureMeeting.start_at)}</div>
                  <div className="t">{ago(futureMeeting.start_at)}{futureMeeting.link ? ' · has a Meet link' : ' · no link'}</div>
                </div>
              </div>
            )}
            {qCalls.map((q) => (
              <div className="att-row" key={q.id}>
                <span className="num">Call</span>
                <div className="info">
                  <div className="d">{fmtWhen(q.due)}</div>
                  <div className="t">{ago(q.due)} · {q.status}{q.step ? ` · step ${q.step}` : ''}</div>
                </div>
              </div>
            ))}
            {qMsgs.map((m) => (
              <div className="att-row" key={m.id}>
                <span className="num">Message</span>
                <div className="info">
                  <div className="d">{fmtWhen(m.due)}</div>
                  <div className="t">{ago(m.due)} · {m.template}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {(d.journey || []).length > 0 && (
          <>
            <div className="dr-h">How they got here</div>
            {d.journey.slice(0, 8).map((j, i) => (
              <div className="qa" key={i}>
                <span className="q">{fmtWhen(j.at)}</span>
                <span className="a" style={{ fontWeight: 400 }}>
                  {j.from ? `${j.from} → ` : ''}{j.to}{j.reason ? ` · ${j.reason}` : ''}
                </span>
              </div>
            ))}
          </>
        )}

        {lead.ghl_url && (
          <p style={{ margin: '20px 0 0', fontSize: 12.5 }}>
            <a href={lead.ghl_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pink)' }}>
              Open this contact in GHL →
            </a>
          </p>
        )}
      </div>

      <div className="dr-foot">
        <button className="btn go" onClick={exportLead}>Export this lead</button>
        <button
          className="btn"
          onClick={downloadRecording}
          disabled={busy || !selected?.has_recording}
          title={selected?.has_recording
            ? 'Saves the audio file. VAPI keeps recordings 14 days.'
            : 'No recording was made on this attempt'}
        >
          Download recording
        </button>
        <button
          className="btn"
          onClick={() => move(
            'human_intervention',
            'Handed to a human · every queued call and message cancelled',
            'Handing this lead to a human stops all contact — every queued call and message for them is cancelled and Sarah goes quiet. Continue?',
          )}
          disabled={busy || isHuman}
          title={isHuman ? 'A person already has this lead' : 'Stops all automated contact and raises the handover brief'}
        >
          {isHuman ? 'A human has this' : 'Assign to a human'}
        </button>
      </div>
    </>
  )
}

/** The state's colour, using the design's own tag classes so a stage cannot
 *  wear one colour here and another on the board. */
function toneClass(state) {
  if (['meeting_booked', 'meeting_attended', 'closed_won'].includes(state)) return 'goodt'
  if (['super_hot', 'callback_requested'].includes(state)) return 'hot'
  if (['not_interested', 'disqualified', 'wrong_number', 'unreachable'].includes(state)) return 'warnt'
  if (state === 'human_intervention') return 'bluet'
  return 'flatt'
}

/** Map a call onto the shared outcome vocabulary in bits.jsx, so the pill in
 *  the drawer is the same pill as on the queue and the pipeline. */
function pillFor(c) {
  if (!c.connected) return c.outcome === 'voicemail' ? 'voicemail' : 'no_answer'
  if (c.outcome === 'booked') return 'booked'
  if (c.outcome === 'super_hot') return 'super_hot'
  if (c.outcome === 'not_interested' || c.outcome === 'disqualified') return 'not_interested'
  if (c.outcome === 'voicemail') return 'voicemail'
  return 'talked_not_booked'
}

function outcomeWords(c) {
  if (!c.connected) {
    if (c.outcome === 'voicemail') return 'Voicemail'
    if (!c.started) return 'Never rang'
    return 'No answer'
  }
  return (c.outcome || 'talked').replace(/_/g, ' ')
}
