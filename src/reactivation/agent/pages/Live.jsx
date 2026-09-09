import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchMembers, fetchCall } from '../../useCampaign'
import { num, dur, fmtTime, ago } from '../../format'
import { CallRecording, CallTranscript } from '../../../components/ui/CallRecording'
import { C, MONO, Card, Eyebrow, Num, Bar, Dot, Pill, hexFor, ghostBtn, fieldStyle, Loading, Failed } from '../ui'

/**
 * Live and call log — the page you leave open during a dialling day.
 *
 * Three bands, as the design draws them: today against the day's own share of
 * plan, where the whole list stands, and then what the dialler is doing right
 * now with the call log underneath.
 *
 * 🔑 THE QUEUE IS THE DIALLER'S OWN ORDER, not a second opinion about it.
 * `cf_campaign_members` sorts by the same rule `cf.claim_next_call` claims by,
 * so "calling next" here is who is genuinely next. A list built from a separate
 * guess would drift the first time the pacer changed (§7 item 141).
 */

const LIMIT = 60

export default function Live({ m, openLead }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await fetchMembers({ limit: LIMIT, status: 'released', q: q.trim() || undefined })
      setRows(d?.rows || []); setError(null)
    } catch (e) { setError(e) }
  }, [q])

  useEffect(() => { load() }, [load])

  // The dialler polls at 5s; the list every 15 is enough to keep them agreeing
  // without asking for 60 rows twelve times a minute.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load() }, 15_000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Today m={m} />
      <WhereTheListStands m={m} />
      <Dialler m={m} rows={rows} error={error} openLead={openLead} />
      <Log m={m} rows={rows} error={error} q={q} setQ={setQ}
           expanded={expanded} setExpanded={setExpanded} openLead={openLead} />
    </div>
  )
}

/* --------------------------------------------------------------- today band */

/**
 * Today against today's share of the plan.
 *
 * ⚠️ The denominator is the plan's PER-DAY figure, not the campaign total — a
 * card comparing one morning against 2,706 is red every day until the last one,
 * and a colour that is always red stops being read.
 */
function Today({ m }) {
  const t = m.today
  const days = m.plan.lengthDays

  const perDay = (target) => (target != null && days ? Math.round(target / days) : null)

  const tiles = [
    { label: 'Dialled', value: t?.calls, target: perDay(m.dialled?.target) },
    { label: 'Reached', value: t?.reached, target: perDay(m.showed == null ? null : m.plan.byMetric?.Reached?.target) },
    { label: 'Real conversations', value: t?.talks, target: perDay(m.talked?.target) },
    { label: 'Booked', value: t?.booked, target: perDay(m.booked?.target) },
  ]

  return (
    <Card edge="rgba(236,72,153,0.30)" pad={22}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Today</div>
        <span className="mono" style={{ fontSize: 13, color: C.muted }}>
          {t ? `${t.from}–${t.to} · ${t.ended_how}` : 'no shift on record for the selected day'}
        </span>
        {t?.connect_pct != null && (
          <span className="mono" style={{ fontSize: 13, color: C.muted, marginLeft: 'auto' }}>
            connect {t.connect_pct}% · {num(t.voicemails)} voicemails · {num(t.failed)} never rang
          </span>
        )}
      </div>

      <div style={{
        marginTop: 16, display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14,
      }}>
        {tiles.map((k) => {
          const tone = k.target ? (k.value >= k.target ? 'good' : k.value >= k.target * 0.9 ? 'warn' : 'bad') : 'na'
          const hex = hexFor(tone)
          const behind = k.target != null && k.value != null ? k.target - k.value : null
          return (
            <div key={k.label} style={{
              background: C.raised, border: `1px solid ${C.lineSoft}`, borderRadius: 14, padding: 16,
            }}>
              <Eyebrow>{k.label}</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 8, flexWrap: 'wrap' }}>
                <Num size={30} color={hex}>{num(k.value)}</Num>
                <span className="mono" style={{ fontSize: 13, color: C.muted }}>
                  {k.target == null ? 'no daily plan' : `of ${num(k.target)}`}
                </span>
              </div>
              <div style={{ marginTop: 10 }}><Bar value={k.value} of={k.target} color={hex} /></div>
              <div className="mono" style={{ fontSize: 11, color: behind > 0 ? C.warn : C.dim, marginTop: 6 }}>
                {behind == null ? 'a day plan needs a campaign length'
                  : behind > 0 ? `${num(behind)} behind today` : 'at or ahead of today'}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ---------------------------------------------------------- where it stands */

function WhereTheListStands({ m }) {
  const total = m.pipe?.members ?? null
  // Everyone the campaign has actually touched. `waiting` is excluded because
  // it is the not-yet-released remainder and would be 60% of every bar.
  const cols = m.board.filter((k) => k.col !== 'waiting')
  const waiting = m.colBy.waiting

  return (
    <Card pad={22}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Where the list stands</div>
        <span className="mono" style={{ fontSize: 13, color: C.muted }}>
          {num(total)} on the campaign · {num(waiting?.count)} not released yet
        </span>
      </div>

      <div style={{
        marginTop: 16, display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 12,
      }}>
        {cols.map((k) => {
          const share = total ? Math.round((k.count / total) * 100) : null
          return (
            <div key={k.col} style={{
              background: C.raised, borderRadius: 13, padding: 14,
              border: `1px solid ${k.col === 'meeting_booked' ? 'rgba(236,72,153,0.32)' : C.lineSoft}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Dot color={k.colour} size={7} />
                <Eyebrow size={11} style={{ letterSpacing: '0.06em' }}>{k.label}</Eyebrow>
              </div>
              <Num size={26} style={{ marginTop: 8 }}>{num(k.count)}</Num>
              <div style={{ marginTop: 9 }}><Bar value={k.count} of={total} color={k.colour} height={5} /></div>
              <div className="mono" style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>
                {share == null ? '—' : `${share}% of the list`}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------- live dialler */

function Dialler({ m, rows, error, openLead }) {
  const d = m.dial
  const live = (rows || []).filter((r) => r.live_status === 'Dialing now')
  const next = (rows || []).filter((r) => r.live_status === 'Calling next' || r.live_status === 'Scheduled').slice(0, 12)
  const done = (rows || []).filter((r) => r.last_call_at)
    .sort((a, b) => new Date(b.last_call_at) - new Date(a.last_call_at)).slice(0, 12)

  const tone = d?.state === 'on' ? C.good : d?.state === 'off' ? C.bad : C.dim

  return (
    <Card pad={20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Dot color={tone} size={9} pulse={d?.state === 'on'} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          {d?.state === 'on' ? 'Calling' : d?.state === 'off' ? 'Stopped' : 'Idle'}
        </div>
        <span style={{ fontSize: 13, color: C.muted }}>{d?.why}</span>
        <span className="mono" style={{ fontSize: 12, color: C.dim, marginLeft: 'auto' }}>
          {d?.last_dial_at ? `last dial ${ago(d.last_dial_at)}` : 'no dial yet'}
        </span>
      </div>

      <div style={{
        marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
        gap: 1, background: C.track, borderRadius: 12, overflow: 'hidden',
      }}>
        {[
          { label: 'On the phone', value: d?.dialling_now, sub: `concurrency ${num(d?.concurrency)}` },
          { label: 'Queued', value: d?.queued, sub: `${num(d?.due_now)} due now` },
          { label: 'Gap between dials', value: d?.gap_seconds == null ? null : `${d.gap_seconds}s`, sub: 'trunk politeness, not a per-person guard' },
          { label: 'Headroom today', value: m.ov?.headroom_today, sub: `cap ${num(m.ov?.daily_dial_cap)}` },
        ].map((k) => (
          <div key={k.label} style={{ background: C.raised, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Eyebrow size={10}>{k.label}</Eyebrow>
            <Num size={22}>{typeof k.value === 'string' ? k.value : num(k.value)}</Num>
            <div style={{ fontSize: 12, color: C.muted }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ marginTop: 16 }}><Failed error={error} what="the queue" /></div>}
      {!rows && !error && <Loading what="the queue" />}

      {rows && (
        <div style={{
          marginTop: 16, display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16,
        }}>
          <Strip title="In progress" empty="Nothing on a call right now.">
            {live.map((r) => (
              <div key={r.lead_id} onClick={() => openLead(r.lead_id)} style={{
                animation: 'cfrow 2.4s infinite', border: '1px solid rgba(236,72,153,0.25)',
                borderRadius: 10, padding: '9px 11px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{r.name || 'Unnamed'}</span>
                <Pill tone="booked">attempt {r.attempt}</Pill>
                <span className="mono" style={{ fontSize: 13, color: C.pinkSoft, marginLeft: 'auto' }}>{r.live_detail}</span>
              </div>
            ))}
          </Strip>

          <Strip title="Queued next" empty="Nothing scheduled.">
            {next.map((r, i) => (
              <div key={r.lead_id} onClick={() => openLead(r.lead_id)} className="cfa-row"
                   style={{ padding: '7px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ fontSize: 11, color: C.muted, width: 22 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{r.name || 'Unnamed'}</span>
                <span className="mono" style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{r.next_at || r.live_status}</span>
              </div>
            ))}
          </Strip>

          <Strip title="Just finished" empty="No calls yet.">
            {done.map((r) => (
              <div key={r.lead_id} onClick={() => openLead(r.lead_id)} className="cfa-row"
                   style={{ padding: '7px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Dot color={r.last_call?.connected ? C.good : C.dim} size={7} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{r.name || 'Unnamed'}</span>
                <span style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>
                  {(r.last_call?.outcome || '—').replace(/_/g, ' ')}
                </span>
                <span className="mono" style={{ fontSize: 11, color: C.dim }}>{fmtTime(r.last_call_at)}</span>
              </div>
            ))}
          </Strip>
        </div>
      )}
    </Card>
  )
}

function Strip({ title, empty, children }) {
  const any = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div>
      <Eyebrow size={10} style={{ letterSpacing: '0.1em', marginBottom: 8 }}>{title}</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 190, overflowY: 'auto' }}>
        {any ? children : <div style={{ fontSize: 13, color: C.muted }}>{empty}</div>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- call log */

function Log({ rows, error, q, setQ, expanded, setExpanded, openLead }) {
  const called = useMemo(
    () => (rows || []).filter((r) => r.last_call_at)
      .sort((a, b) => new Date(b.last_call_at) - new Date(a.last_call_at)),
    [rows])

  return (
    <Card pad={20}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Call log</div>
        <span className="mono" style={{ fontSize: 13, color: C.muted }}>
          {num(called.length)} of the most recent {LIMIT} released
        </span>
        <input
          className="cfa-field" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Find a name or number…"
          style={{ ...fieldStyle, marginLeft: 'auto', width: 240 }}
        />
      </div>

      {error && <div style={{ marginTop: 14 }}><Failed error={error} what="the call log" /></div>}
      {!rows && !error && <Loading what="the call log" />}

      {rows && called.length === 0 && (
        <div style={{ fontSize: 14, color: C.muted, padding: '18px 2px' }}>
          Nothing has been dialled in this slice of the queue{q ? ' that matches your search' : ''}.
        </div>
      )}

      {rows && called.length > 0 && (
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <div style={{ minWidth: 880 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '90px 1.3fr 1.1fr 0.7fr 1fr 0.9fr 90px',
              gap: 12, padding: '0 12px 10px', borderBottom: `1px solid ${C.line}`,
            }}>
              {['Time', 'Name', 'Number', 'Attempt', 'Outcome', 'Length', ''].map((h, i) => (
                <Eyebrow key={i} size={10} color={C.dim} style={{ letterSpacing: '0.07em' }}>{h}</Eyebrow>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '52vh', overflowY: 'auto' }}>
              {called.map((r) => (
                <LogRow key={r.lead_id} r={r} open={expanded === r.lead_id}
                        onToggle={() => setExpanded(expanded === r.lead_id ? null : r.lead_id)}
                        openLead={openLead} />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function LogRow({ r, open, onToggle, openLead }) {
  const call = r.last_call
  const connected = !!call?.connected

  return (
    <div>
      <div onClick={onToggle} className="cfa-row" style={{
        display: 'grid', gridTemplateColumns: '90px 1.3fr 1.1fr 0.7fr 1fr 0.9fr 90px',
        gap: 12, padding: 12, borderBottom: `1px solid ${C.lineSoft}`,
        cursor: 'pointer', alignItems: 'center',
      }}>
        <span className="mono" style={{ fontSize: 13, color: C.muted }}>{fmtTime(r.last_call_at)}</span>
        <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {r.name || 'Unnamed'}
        </span>
        <span className="mono" style={{ fontSize: 13, color: C.muted }}>{r.phone}</span>
        <span className="mono" style={{ fontSize: 13, color: C.muted }}>{num(r.attempts_made)}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: connected ? C.text : C.muted }}>
          <Dot color={connected ? C.good : C.dim} size={7} />
          {(call?.outcome || 'no answer').replace(/_/g, ' ')}
        </span>
        <span className="mono" style={{ fontSize: 13, color: C.muted }}>{connected ? dur(call?.duration_sec) : '—'}</span>
        <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button className="cfa-ghost" style={{ ...ghostBtn, padding: '5px 9px', fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); openLead(r.lead_id) }} title="Open lead">→</button>
        </span>
      </div>

      {open && (
        <div style={{ padding: '14px 16px 18px', borderBottom: `1px solid ${C.lineSoft}`, background: 'rgba(255,255,255,0.02)' }}>
          {!call ? (
            <div style={{ fontSize: 13, color: C.muted }}>No call recorded against this person yet.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <CallRecording callId={call.vapi_call_id} hasRecording={call.has_recording} />
                <span className="mono" style={{ fontSize: 12, color: C.dim }}>{call.at_label}</span>
              </div>
              {call.summary && (
                <div style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.55, whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>
                  {call.summary}
                </div>
              )}
              {call.has_transcript && <TranscriptOnDemand callId={call.vapi_call_id} />}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 🔑 The transcript is fetched only when somebody opens it. A page of 60 rows
 * carrying 60 full transcripts is a slow table nobody asked for, which is why
 * `cf_campaign_members` returns `has_transcript` and not the text.
 */
function TranscriptOnDemand({ callId }) {
  const [state, setState] = useState({ loading: false, text: null, error: null })

  const load = async () => {
    setState({ loading: true, text: null, error: null })
    try {
      const d = await fetchCall(callId)
      setState({ loading: false, text: d?.transcript || '', error: null })
    } catch (e) { setState({ loading: false, text: null, error: e }) }
  }

  if (state.text != null) {
    return (
      <div style={{
        marginTop: 12, background: C.bg, border: `1px solid ${C.lineSoft}`,
        borderRadius: 12, padding: 14, maxHeight: 260, overflowY: 'auto',
      }}>
        <CallTranscript text={state.text} />
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={load} disabled={state.loading}
              style={{ background: 'transparent', border: 'none', color: C.pinkLink, fontSize: 13, fontWeight: 600, padding: 0, cursor: 'pointer' }}>
        {state.loading ? 'loading the transcript…' : 'Read the transcript'}
      </button>
      {state.error && <span style={{ fontSize: 12, color: C.badSoft, marginLeft: 10 }}>{state.error.message}</span>}
    </div>
  )
}
