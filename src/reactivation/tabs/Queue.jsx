import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCampaign, fetchMembers, fetchCall } from '../useCampaign'
import { Chip, Empty, Eyebrow, Failed, Loading, LiveDot, OutcomePill } from '../bits'
import { dur, fmtTime, humanise, num, widthPct } from '../format'
import { CallRecording, CallTranscript } from '../../components/ui/CallRecording'
import LiveListen from '../../components/ui/LiveListen'

/**
 * Queue — today's call list, top to bottom, like watching someone work down a
 * spreadsheet.
 *
 * 🔑 NOTHING REORDERS. `cf_campaign_members` returns rows in the order the
 * dialler will actually work them — migration 215 made `sort_key` a real column
 * so the ordering happens BEFORE limit/offset, which is what put the live row
 * on page one instead of on whatever page it happened to land on. Re-sorting
 * here would be a second opinion about who is next, and the whole point of this
 * screen is that it is a view of the dialler rather than an argument with it.
 *
 * 🔑 THE COUNTER STRIP DOES NOT COUNT THE ROWS ON SCREEN. Those are one page of
 * many, and they move as you filter. Called / got through / real talks / booked
 * are the day's figures from `cf_shifts.today`, which is also what the Shifts
 * tab reads — so the two tabs cannot disagree about how many calls she made
 * today, which is the fault this dashboard has already shipped twice.
 */

/**
 * The outcome vocabulary, mapped once from the database's `cf.call_outcome`
 * enum onto the six colours `OutcomePill` fixes in `bits.jsx`. Exported because
 * the Pipeline reads the tone half of it: one outcome must not wear two colours
 * on two tabs, and two copies of this map is how that starts.
 */
const OUTCOME_KEY = {
  booked: 'booked',
  human_requested: 'super_hot',
  voicemail: 'voicemail',
  not_interested: 'not_interested',
  disqualified: 'not_interested',
  wrong_number: 'not_interested',
  no_answer: 'no_answer',
  failed_to_connect: 'no_answer',
  no_engagement: 'no_answer',
  callback_requested: 'talked_not_booked',
  wa_requested: 'talked_not_booked',
  interested_no_meeting: 'talked_not_booked',
}
export const outcomeKey = (o) => OUTCOME_KEY[o] || 'talked_not_booked'

/**
 * The same reading, applied to a plain-English status phrase rather than to an
 * enum. `cf_campaign_members.live_status` and `cf.lead_status_phrase` are two
 * functions that speak the same sentences, so the Pipeline's card tags and this
 * table's pills stay one colour language. Returns a `.tagline` modifier from
 * the design's own stylesheet.
 */
export function phraseTone(phrase) {
  const s = String(phrase || '').toLowerCase()
  if (!s) return 'flatt'
  if (s.includes('booked') || s.includes('attended') || s.includes('turned up') || s.includes('signed')) return 'goodt'
  if (s.includes('human') || s.includes('hot') || s.includes('now')) return 'hot'
  if (s.includes('not interested') || s.includes('wrong number') || s.includes('not a fit')
      || s.includes('unreachable') || s.includes('missed')) return 'warnt'
  if (s.includes('call') || s.includes('scheduled') || s.includes('whatsapp') || s.includes('chat')) return 'bluet'
  return 'flatt'
}

const PAGE = 25

/** Dubai wall-clock minutes since midnight, from an ISO instant. `fmtTime`
 *  already renders in Asia/Dubai, so parsing its output needs no offset
 *  literal — and an offset literal is exactly how a timezone bug gets in. */
const clockMinutes = (hhmm) => {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(String(hhmm))) return null
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}

/**
 * The list, polled — but not while somebody is using it.
 *
 * Without the interval this screen is a photograph of a live thing and
 * "Dialing now" never moves. With an unconditional interval the rows shuffle
 * out from under an open transcript or a live listen. Both are true, so both
 * are handled: `paused` freezes the poll and says so on screen, because a live
 * view that has quietly stopped refreshing looks exactly like a campaign that
 * has quietly stopped dialling.
 */
function useQueue({ status, reason, q, offset, paused, every = 15_000 }) {
  // `every` is the resting rate. While a call is actually on the phone the
  // caller passes something faster - watching a live call at 15-second refresh
  // is watching a slideshow, and the whole point of this tab is that it moves.
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const args = useMemo(() => {
    const a = { limit: PAGE, offset }
    if (status) a.status = status
    if (reason) a.reason = reason
    if (q) a.q = q
    return a
  }, [status, reason, q, offset])

  const load = useCallback(async () => {
    try {
      const data = await fetchMembers(args)
      if (alive.current) setState({ data, error: null, loading: false })
    } catch (error) {
      if (alive.current) setState((s) => ({ ...s, error, loading: false }))
    }
  }, [args])

  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden && !pausedRef.current) load() }, every)
    return () => clearInterval(t)
  }, [load, every])

  return state
}

/**
 * WHO IS ON THE PHONE, asked separately and unfiltered.
 *
 * The live row sorts first, but only in an unfiltered result at offset 0 — so
 * reading it off the page the user happens to be looking at makes the tile go
 * blank the moment they filter to "waiting to start", which reads as "nobody is
 * calling" rather than "you filtered them out". One row, every 10 seconds.
 */
function useOnThePhone() {
  const [row, setRow] = useState(null)
  useEffect(() => {
    let alive = true
    const go = () => fetchMembers({ limit: 1 })
      .then((d) => { if (alive) setRow(d?.rows?.[0]?.sort_key === '1' ? d.rows[0] : null) })
      .catch(() => { if (alive) setRow(null) })
    go()
    const t = setInterval(() => { if (!document.hidden) go() }, 10_000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return row
}

/** One tile of the counter strip. A figure nobody measured is an em-dash. */
const Tile = ({ label, value, note, hot, on, suffix }) => (
  <div className={`qc${hot ? ' hot' : ''}${on ? ' on' : ''}`}>
    <span className="k">{label}</span>
    <div className="v" style={on ? { color: 'var(--pink)' } : undefined}>
      {value}{suffix && <small>{suffix}</small>}
    </div>
    <div className="s">{note}</div>
  </div>
)

/** The transcript, opened in place under its row rather than in a second
 *  drawer — the lead record already owns the drawer, and two of them is two
 *  things to keep in step. */
function TranscriptRow({ callId, onClose }) {
  const [call, setCall] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(null); setCall(null)
    fetchCall(callId)
      .then((d) => { if (alive) setCall(d) })
      .catch((e) => { if (alive) setError(e) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [callId])

  return (
    <tr>
      <td colSpan={6} style={{ background: 'var(--ink)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <Eyebrow>What was said</Eyebrow>
          <button className="qact" onClick={onClose}>Close</button>
        </div>

        {loading && <Loading what="the call" />}
        {!loading && error && <Failed error={error} what="that call" />}

        {/* `found: false` is an ANSWER, not a failure — cf_campaign_call
            refuses a call id that is not this campaign's, because the VAPI org
            is shared with other clients. */}
        {!loading && !error && call?.found === false && (
          <Empty title="Not this campaign's call">
            {humanise(call.reason) || 'It belongs to another campaign, so it is not shown here.'}
          </Empty>
        )}

        {!loading && !error && call?.found && (
          <>
            {call.summary
              ? <p className="qsaid" style={{ margin: '0 0 10px', fontSize: 13 }}>{call.summary}</p>
              : <p className="qsaid" style={{ margin: '0 0 10px' }}>No summary was written for this call.</p>}
            {/* ⚠️ CallTranscript is the app's one transcript renderer and its
                classes come from index.css, where `--ink` is dark TEXT on a
                light card. In here `--ink` is the page background, so the
                lead's own words would be black on black. Re-pointed at the
                design's own variables — no hex, and no second renderer. */}
            <div style={{ '--ink': 'var(--text)', '--faint': 'var(--dim)', '--muted': 'var(--muted)' }}>
              <CallTranscript text={call.transcript} />
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

/**
 * One row, in one of four states: on the phone · done · queued · never called.
 *
 * Extracted rather than left inline so the four branches can be rendered and
 * read on their own — an inline map is where a state nobody exercised hides,
 * and a green build says nothing about whether a branch produces markup
 * (§7 item 178).
 */
export function QueueRow({ m, n, steps, ladder, onOpen, onListen, openCall, onToggleTranscript }) {
  const lc = m.last_call
  const isLive = m.live_status === 'Dialing now' || !!m.listen_url
  const notCalled = m.member_status === 'excluded'
  const isWaiting = !isLive && !notCalled && !lc &&
    (m.member_status === 'pending' || m.live_status === 'Scheduled' || m.live_status === 'Calling next')
  const day = m.attempt && ladder?.[m.attempt - 1]?.label
    ? String(ladder[m.attempt - 1].label).split(/\s*[-–]\s*/)[0]
    : null

  return (
    <tr
      className={isLive ? 'live' : (isWaiting || notCalled) ? 'wait' : undefined}
      onClick={() => onOpen(m.lead_id)}
      style={{ cursor: 'pointer' }}
    >
      <td className="qn">{num(n)}</td>

      <td>
        <div className="qname">
          {isLive && <span className="livedot" />}{m.name || '—'}
        </div>
        <div className="qphone">{m.phone || '—'}</div>
        {/* The line that mattered. There is no verbatim quote in this payload,
            so this is the call's own account of itself — never invented, and
            never shown for a call that has not happened. */}
        {lc?.summary && <div className="qsaid">{lc.summary}</div>}
        {isLive && !lc?.summary && <div className="qsaid">Talking now</div>}
      </td>

      <td className="qatt">
        {m.attempt
          ? `${m.attempt}${steps ? ` of ${steps}` : ''}${day ? ` · ${day}` : ''}`
          : (m.attempts_made ? `${num(m.attempts_made)} dialled` : '—')}
      </td>

      <td>
        {isLive ? (
          <span className="out oncall">On the phone</span>
        ) : notCalled ? (
          <span className="out noans">
            Not called{m.exclude_reason ? ` · ${humanise(m.exclude_reason)}` : ''}
          </span>
        ) : isWaiting ? (
          /* The RPC's own phrase — "Waiting to start" for somebody the pacer
             has not released, "Scheduled" for a row with a time on it. Writing
             "Queued" over both would say the campaign had committed to a call
             it has not. */
          <span className="out wait">
            {m.live_status || 'Queued'}{m.live_detail ? ` · ${m.live_detail}` : ''}
          </span>
        ) : lc?.outcome ? (
          <OutcomePill outcome={outcomeKey(lc.outcome)}>{m.live_status}</OutcomePill>
        ) : (
          <span className="out noans">{m.live_status || '—'}</span>
        )}
      </td>

      <td className="qdur">{lc ? dur(lc.duration_sec) : '—'}</td>

      <td onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
          {/* 🔑 PRESENT ONLY WHILE THE CALL IS UP, never a disabled button.
              `listen_url` is a capability, not a field: the RPC returns it for
              the dialing row alone and it stops existing when the call ends
              (§7 item 54). A greyed-out control would imply the audio is there
              and merely unavailable. */}
          {m.listen_url && (
            <LiveListen listenUrl={m.listen_url} name={m.name} onActive={onListen} />
          )}
          {/* Takes the CALL ID, never a stored URL — only the cf-recording
              function can mint one a browser will play (§7 item 139). */}
          {lc?.has_recording && <CallRecording callId={lc.vapi_call_id} hasRecording />}
          {lc?.has_transcript && (
            <button className="qact" onClick={() => onToggleTranscript(lc.vapi_call_id)}>
              {openCall === lc.vapi_call_id ? 'Hide' : 'Transcript'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function Queue({ goTo, openLead, search }) {
  const c = useCampaign()
  const ov = c.overview.data
  const today = c.shifts.data?.today

  const [filter, setFilter] = useState({ key: 'all' })
  const [offset, setOffset] = useState(0)
  const [openCall, setOpenCall] = useState(null)
  const [listening, setListening] = useState(null)
  const [q, setQ] = useState('')

  // The top bar owns the search box; this debounces it so a slow RPC is not
  // called on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(String(search || '').trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Any change of filter or search goes back to page one — a narrower result
  // read at an old offset renders empty and looks like a broken table.
  useEffect(() => { setOffset(0) }, [filter, q])

  // 🔑 PAUSE ONLY FOR A TRANSCRIPT. Reading one means rows moving under you is
  // a nuisance; LISTENING to a live call is the moment you most want the row to
  // stay current, so listening no longer freezes the poll.
  const paused = !!openCall
  const live = useOnThePhone()
  // Five seconds while somebody is on the phone or a call is due within the
  // minute; fifteen when the campaign is idle. Polling hard at 3am against a
  // draft campaign is just noise on the database.
  const busy = (live?.length ?? 0) > 0
  const { data, error, loading } = useQueue({
    status: filter.status, reason: filter.reason, q: q || undefined, offset, paused,
    every: busy ? 5_000 : 15_000,
  })

  const rows = data?.rows ?? []
  const byStatus = data?.by_status ?? {}
  const breakdown = data?.breakdown ?? {}
  const enrolled = Object.values(byStatus).reduce((a, b) => a + Number(b || 0), 0) || null

  // The ladder's own length, so "2 of 4" comes from the cadence rather than
  // from a 4 typed into this page.
  const ladder = ov?.ladder ?? []
  const steps = ladder.length || null

  /* ── Today's figures ──────────────────────────────────────────────────
     🔑 `today.cap` IS NULL UNTIL THE CAMPAIGN IS ACTUALLY RUNNING, and it is
     left null here rather than back-filled from `daily_dial_cap`. The RPC reads
     the cap off a campaign whose status is piloting or running, so a null is
     the database saying "there is no list today" — and standing the configured
     cap in its place would draw a progress bar against a plan nobody has
     started, which reads as 2% of a day's work done rather than as not started.
     The configured number is still shown below, named as the plan. */
  const cap = today?.cap ?? null
  const planCap = ov?.daily_dial_cap ?? null
  const called = today?.calls ?? null
  const left = cap != null && called != null ? Math.max(0, cap - called) : null
  const donePct = cap ? widthPct(called, cap) : null

  /**
   * When she finishes, at the rate ACTUALLY achieved — never at the cap. The
   * cap is a permission; the rate is what is happening, and that is the
   * question being asked. No rate yet means it says so rather than guessing.
   */
  const finishAt = useMemo(() => {
    if (!cap || !called || !today?.from || left == null || left <= 0) return null
    const start = clockMinutes(today.from)
    const now = clockMinutes(fmtTime(new Date().toISOString()))
    if (start == null || now == null) return null
    const elapsed = now - start
    if (elapsed <= 0) return null
    const perMin = called / elapsed
    if (!Number.isFinite(perMin) || perMin <= 0) return null
    const mins = left / perMin
    if (!Number.isFinite(mins) || mins <= 0 || mins > 16 * 60) return null
    return fmtTime(new Date(Date.now() + mins * 60_000).toISOString())
  }, [cap, called, left, today?.from])

  /* ── The filter chips ─────────────────────────────────────────────────
     Counts come from `by_status` and `breakdown`, which the RPC computes over
     the WHOLE campaign regardless of the filter — so a chip's number never
     changes as you click between them. Migration 210 is why the reason chips
     work at all: a `status` that is not a status is read as an exclusion
     reason, so a chip filters the thing it is named after instead of
     returning an empty table that reads as a true zero. */
  const chips = [
    { key: 'all', label: 'All', n: enrolled },
    { key: 'released', label: 'Called', n: byStatus.released, status: 'released' },
    { key: 'pending', label: 'Waiting to start', n: byStatus.pending, status: 'pending' },
    { key: 'excluded', label: 'Not called', n: byStatus.excluded, status: 'excluded' },
    ...Object.entries(breakdown)
      .filter(([k]) => !['released', 'pending', 'excluded'].includes(k))
      .map(([k, n]) => ({ key: `r:${k}`, label: humanise(k), n, reason: k })),
  ]

  const total = data?.total ?? null
  const filtered = filter.key !== 'all' || !!q

  return (
    <>
      {/* ── The counter strip ─────────────────────────────────────────── */}
      <Eyebrow>
        Today's call list{today?.date ? ` · ${today.date}` : ''}
      </Eyebrow>
      <h2 className="sec-title" style={{ fontSize: 20 }}>
        {live ? "She's working down this list right now" : 'The list she works down'}
      </h2>

      {c.shifts.error && <Failed error={c.shifts.error} what="today's figures" />}
      {c.shifts.loading && !c.shifts.data && <Loading what="today's figures" />}

      <div className="q-counters">
        {/* A position needs a list to be a position in. With no cap there is
            no list today, and "Row 0" reads as the first row of one. */}
        <Tile
          label="Row"
          value={num(cap == null || called == null ? null : called + (live ? 1 : 0))}
          suffix={cap ? `/${num(cap)}` : null}
          note={cap ? "position in today's list" : 'no list today'}
        />
        <Tile label="Called" value={num(called)} note="dialled so far" />
        <Tile label="Got through" value={num(today?.reached)} note="a human answered" />
        <Tile label="Real talks" value={num(today?.talks)} note="past the opener" />
        <Tile label="Booked today" value={num(today?.booked)} note="meetings in the diary" hot />
        {/* ⚠️ The design puts a running timer here. There is no call-start
            timestamp in the payload — `next_at` is when the row fell due, not
            when the phone started ringing — and a stopwatch started from when
            this browser first noticed would be a measurement of the page
            rather than of the call. Name and a live dot instead. */}
        <Tile
          on
          label="On the phone"
          value={live ? <span style={{ fontSize: 17 }}><LiveDot /> {live.name || '—'}</span> : '—'}
          note={live ? 'talking now' : 'nobody on the phone'}
        />
      </div>

      {/* ── The progress line ─────────────────────────────────────────── */}
      <div className="q-progress">
        <span className="lab">
          {donePct != null
            ? <><b>{Math.round(donePct)}%</b> of today's list</>
            : <>No list today</>}
        </span>
        <div className="track2"><i style={{ width: `${donePct ?? 0}%` }} /></div>
        <span className="lab">
          {cap != null ? (
            <>
              <b>{num(left)}</b> left · stops at {num(cap)}
              {finishAt
                ? <> · <b>finishes ~{finishAt}</b></>
                : <> · <b>{called ? 'no steady rate yet' : 'not started today'}</b></>}
            </>
          ) : (
            <>
              {ov?.status ? `Not calling — the campaign is ${ov.status}. ` : ''}
              {planCap != null && <>The plan is <b>{num(planCap)} dials a day</b> once it starts.</>}
            </>
          )}
        </span>
      </div>

      {/* ── The list ──────────────────────────────────────────────────── */}
      <div style={{ marginTop: 18 }}>
        <div className="q-head-row">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {chips.map((ch) => (
              <Chip
                key={ch.key}
                active={filter.key === ch.key}
                onClick={() => setFilter({ key: ch.key, status: ch.status, reason: ch.reason })}
              >
                {ch.label}{ch.n != null ? ` · ${num(ch.n)}` : ''}
              </Chip>
            ))}
            {/* Booked and Needs-a-human are columns on the board, not filters
                this RPC can apply — it filters on member status and exclusion
                reason and nothing else. Passing either as a filter would return
                no rows, and an empty table is indistinguishable from a true
                zero (§7 item 191). They go where the count is real. */}
            <Chip
              onClick={() => goTo('pipeline')}
              title="Not something this list can filter on — opens the board, where booked meetings are a column with a real count"
            >Booked ↗</Chip>
            <Chip
              onClick={() => goTo('pipeline')}
              title="Not something this list can filter on — opens the board, where Super hot is a column with a real count"
            >Needs a human ↗</Chip>
          </div>

          {/* A live view that has quietly stopped refreshing looks exactly like
              a campaign that has quietly stopped dialling, so it always says
              which it is - and offers the way back rather than leaving you to
              find the transcript you left open. */}
          {paused ? (
            <button
              className="livepill"
              onClick={() => setOpenCall(null)}
              title="Close the transcript and go back to live"
              style={{ color: 'var(--warn)', borderColor: '#4A3A15',
                       background: '#211A0D', cursor: 'pointer' }}
            >
              Paused while you read · resume
            </button>
          ) : (
            <span className="livepill">
              {busy ? 'Live · every 5s' : 'Live · every 15s'}
            </span>
          )}
        </div>

        {/* An explicit height is the one adaptation this needs: the design's
            `.q-scroll` fills a flex panel, and here it sits in the shell's own
            scroller. Without it the sticky header has nothing to stick to. */}
        <div className="q-scroll" style={{ maxHeight: 'calc(100vh - 430px)', minHeight: 260 }}>
          <table className="q">
            <thead>
              <tr>
                <th>#</th><th>Person</th><th>Attempt</th>
                <th>What happened</th><th>Length</th><th />
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr><td colSpan={6}><Failed error={error} what="the call list" /></td></tr>
              )}

              {!error && loading && !data && (
                <tr><td colSpan={6}><Loading what="the call list" /></td></tr>
              )}

              {!error && data && !rows.length && (
                <tr><td colSpan={6}>
                  <Empty title={filtered ? 'Nobody matches that' : 'Nobody is on the list yet'}>
                    {filtered
                      ? 'Clear the filter or the search to see everyone.'
                      : 'Tag contacts with reactivate in the CRM and they land here, waiting. Nothing is dialled until the campaign is started.'}
                  </Empty>
                </td></tr>
              )}

              {!error && rows.map((m, i) => (
                <Fragment key={m.lead_id}>
                  <QueueRow
                    m={m} n={offset + i + 1} steps={steps} ladder={ladder}
                    onOpen={openLead}
                    onListen={(on) => setListening(on ? m.lead_id : null)}
                    openCall={openCall}
                    onToggleTranscript={(id) => setOpenCall(openCall === id ? null : id)}
                  />
                  {openCall && m.last_call?.vapi_call_id === openCall && (
                    <TranscriptRow callId={openCall} onClose={() => setOpenCall(null)} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <p style={{ color: 'var(--dim)', fontSize: 12, margin: 0, maxWidth: '62ch' }}>
            {rows.length
              ? <>Rows fill in where they sit — nothing reorders, so your eye stays in one place. Everything below the live row is queued{ov?.dial_spacing_seconds ? `, ${num(ov.dial_spacing_seconds)} seconds apart` : ''}.</>
              : null}
            {/* Two counts of one population sit on this screen and they are
                built differently: the campaign's own member count, and this
                list, which is inner-joined to the lead record. They part
                company by exactly the members whose lead row has gone — and
                such a member can never be dialled, which is worth saying
                rather than hiding. Silent when they agree. */}
            {!filtered && total != null && enrolled != null && enrolled !== total && (
              <> {num(total)} listed here against {num(enrolled)} on the campaign
                — {num(enrolled - total)} have no lead record, so they can never be dialled.</>
            )}
          </p>

          {total != null && total > PAGE && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
                {num(offset + 1)}–{num(Math.min(offset + PAGE, total))} of {num(total)}
              </span>
              <button className="qact" disabled={offset === 0}
                      style={offset === 0 ? { opacity: 0.4 } : undefined}
                      onClick={() => setOffset((o) => Math.max(0, o - PAGE))}>Previous</button>
              <button className="qact" disabled={offset + PAGE >= total}
                      style={offset + PAGE >= total ? { opacity: 0.4 } : undefined}
                      onClick={() => setOffset((o) => o + PAGE)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
