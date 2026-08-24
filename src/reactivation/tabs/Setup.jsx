import { useState } from 'react'
import { useCampaign, releaseBatch } from '../useCampaign'
import { Feed, Empty, SectionHead, Dot } from '../bits'
import { num, pct, humanise } from '../format'
import { usePendingEdits, pendingEdits } from './CallReview'
import TestRun from '../TestRun'

/**
 * Setup — everything that is configuration rather than status. A client never
 * opens this tab.
 *
 * 🔑 START ALWAYS ENTERS THE PILOT. `cf_campaign_control` sets `piloting` and
 * never `running`, whatever the button is called — the plan's first page is a
 * 50-dial gate, and a start that skipped it is the one control on this page
 * able to burn 2,706 leads on a bad trunk. So the button says so beside itself.
 * A button that quietly does something smaller than its label is worse than one
 * that explains itself.
 *
 * 🔑 CLEARING A HALT DOES NOT RESTART ANYTHING. Two decisions, two clicks: the
 * campaign halted itself on evidence, and disagreeing with that evidence is a
 * separate act from starting to dial again. Both buttons are rendered, both
 * always visible, each disabled with the reason in its tooltip when it does not
 * apply — hiding a control makes the reader wonder whether it exists.
 *
 * ⚠️ NOTHING HERE EDITS CONFIGURATION. The daily cap, the ladder, the targets
 * and the stop rules are all rows in the database and are shown read-only,
 * because the only write this dashboard has is start / pause / resume /
 * clear halt. Everything that looks like it should be editable says it is not.
 */

/* ── the controls ────────────────────────────────────────────────────────── */

const CONTROLS = [
  {
    action: 'start', label: 'Start the pilot', primary: true,
    can: (s) => s === 'draft' || s === 'paused',
    why: (s) => s === 'halted'
      ? 'The campaign halted itself. Clear the halt first.'
      : `Already ${s || 'unknown'} — there is nothing to start.`,
    saying: 'Pilot started — it dials 50, then holds for the connect gate',
  },
  {
    action: 'pause', label: 'Pause',
    can: (s) => s === 'piloting' || s === 'running',
    why: () => 'Nothing is dialling, so there is nothing to pause.',
    saying: 'Paused — no more calls will be released',
  },
  {
    action: 'resume', label: 'Resume',
    can: (s) => s === 'paused',
    why: (s) => s === 'halted'
      ? 'It halted itself on its own evidence. Clear the halt first, deliberately.'
      : 'Only a paused campaign can be resumed.',
    saying: 'Resumed — back into the pilot',
  },
  {
    action: 'clear_halt', label: 'Clear the halt',
    can: (s) => s === 'halted',
    why: () => 'Nothing has halted.',
    saying: 'Halt cleared — the campaign is paused, not running',
  },
]

/**
 * RELEASE A BATCH BY HAND.
 *
 * 🔑 The pacer is deliberately slow — pilot, gate, ramp, daily cap. Right for an
 * unattended campaign, and not what somebody watching the screen wants. This
 * overrides the PACING and nothing else: every per-lead guard still runs, so it
 * cannot dial a customer, a DND number, someone with a meeting booked, or anyone
 * already reactivated. It cannot restart a halted campaign either.
 *
 * ⚠️ It states WHEN the calls will happen before you press it, not after. A batch
 * released at five in the afternoon dials this evening, not tomorrow morning, and
 * that is the single thing most likely to surprise the person pressing it.
 */
function ReleaseBatch({ ov, busy }) {
  const [n, setN] = useState(50)
  const [state, setState] = useState({ running: false, said: null, error: null })
  const status = ov?.status || null
  const pending = ov?.stats?.members_pending ?? null
  const allowed = (status === 'piloting' || status === 'running') && (pending ?? 0) > 0

  const why = status === 'halted'
    ? 'It halted itself. Clear the halt first.'
    : status === 'paused' ? 'The campaign is paused. Resume it first.'
    : status === 'draft'  ? 'Press Start first, so the pilot gate is on the record.'
    : (pending ?? 0) === 0 ? 'Everybody enrolled has already been released.'
    : null

  const go = async () => {
    setState({ running: true, said: null, error: null })
    try {
      const r = await releaseBatch(n)
      setState({
        running: false, error: null,
        said: `Released ${num(r.released)}${r.excluded ? ` · ${num(r.excluded)} were no longer eligible` : ''}`
             + `${r.still_pending != null ? ` · ${num(r.still_pending)} still waiting` : ''}`,
      })
    } catch (e) {
      setState({ running: false, said: null, error: e.message })
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>Release a batch now</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="number" min="1" max="200" value={n}
          onChange={(e) => setN(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
          disabled={!allowed || busy || state.running}
          style={{
            width: 74, padding: '7px 9px', borderRadius: 8, fontSize: 14,
            background: 'var(--panel-2)', color: 'var(--ink)',
            border: '1px solid var(--hairline)',
          }}
        />
        <button
          className={allowed ? 'btn go' : 'btn'}
          disabled={!allowed || busy || state.running}
          title={why || undefined}
          style={!allowed ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          onClick={go}
        >
          {state.running ? 'Releasing…' : `Release ${num(n)} now`}
        </button>
        {pending != null && (
          <span style={{ color: 'var(--dim)', fontSize: 12.5 }}>
            {num(pending)} still waiting to be called
          </span>
        )}
      </div>

      {state.said  && <p style={{ color: 'var(--good)', fontSize: 13, marginTop: 9 }}>{state.said}</p>}
      {state.error && <p style={{ color: 'var(--pink)', fontSize: 13, marginTop: 9 }}>{state.error}</p>}
      {why && !state.error && (
        <p style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 9 }}>{why}</p>
      )}

      <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 10, maxWidth: '72ch' }}>
        This skips the daily cap and the connect gate — that is what it is for. It does
        <b style={{ color: 'var(--text)' }}> not</b> skip the per-lead checks: nobody who has
        gone DND, bought from you, has a meeting booked, asked to be left alone, or has been
        reactivated before can be released by it.
        {' '}Calls are spaced {ov?.dial_spacing_seconds ? `${num(ov.dial_spacing_seconds)} seconds` : 'evenly'} apart
        and land in the next open calling window — released late in the day, they dial the same evening.
      </p>
    </div>
  )
}

function Controls({ ov, control, busy }) {
  const status = ov?.status || null
  return (
    <section className="card">
      <p className="eyebrow">Running the campaign</p>
      <h3 style={{ fontSize: 15 }}>
        Right now it is <span style={{ color: 'var(--pink)' }}>{humanise(status) || 'unknown'}</span>
      </h3>
      {ov?.halted_reason && (
        <p style={{ color: 'var(--warn)', fontSize: 13.5, margin: '8px 0 0', maxWidth: '72ch' }}>
          It stopped itself: {ov.halted_reason}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {CONTROLS.map((k) => {
          const allowed = k.can(status)
          return (
            <button
              key={k.action}
              className={k.primary && allowed ? 'btn go' : 'btn'}
              disabled={!allowed || busy}
              title={allowed ? undefined : k.why(status)}
              style={!allowed ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
              onClick={() => control(k.action, k.saying)}
            >
              {k.label}
            </button>
          )
        })}
      </div>

      <ReleaseBatch ov={ov} busy={busy} />

      <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 12, maxWidth: '72ch' }}>
        <b style={{ color: 'var(--text)' }}>Start always enters the pilot.</b> It releases
        {ov?.pilot_size != null ? ` ${num(ov.pilot_size)}` : ' the pilot batch of'} calls and
        then holds until the pick-up rate clears {pct(ov?.gate_connect_pct)} — it cannot go
        straight to the full daily cap, whichever button you press.
        Clearing a halt leaves the campaign paused rather than restarting it.
      </p>
    </section>
  )
}

/* ── the three stop rules ────────────────────────────────────────────────── */

const RULE_TEXT = {
  connect: (k) => `Pick-up rate under ${pct(k.floor)} after ${num(k.after)} calls`,
  booking: (k) => `Booking rate under ${pct(k.floor)} after ${num(k.after)} conversations`,
  show:    (k) => `Show rate under ${pct(k.floor)} after ${num(k.after)} meetings`,
}

function StopRules({ kill }) {
  const keys = ['connect', 'booking', 'show'].filter((k) => kill?.[k])
  if (!keys.length) {
    return <p style={{ color: 'var(--dim)', fontSize: 13 }}>No stop rules are configured.</p>
  }
  return (
    <ul className="rules" style={{ paddingLeft: 0, marginTop: 8, listStyle: 'none' }}>
      {keys.map((k) => {
        const r = kill[k]
        // A rule that has not gathered its sample yet is not passing — it is not
        // watching. Those need different words, or a quiet screen reads as safe.
        const breached = r.armed && r.pct != null && Number(r.pct) < Number(r.floor)
        const tone = !r.armed ? 'na' : breached ? 'bad' : 'good'
        return (
          <li key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <Dot tone={tone} style={{ marginTop: 6 }} />
            <div>
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13.5 }}>
                {RULE_TEXT[k](r)}
              </div>
              <div style={{ color: r.armed ? 'var(--muted)' : 'var(--dim)', fontSize: 12.5, marginTop: 3 }}>
                {r.armed
                  ? <>Watching now · currently {pct(r.pct)} over {num(r.sample)}</>
                  : <>Not watching yet — {num(r.sample)} of the {num(r.after)} it needs first</>}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ── the tab ─────────────────────────────────────────────────────────────── */

export default function Setup({ control, busy, goTo }) {
  const c = useCampaign()
  const staged = usePendingEdits()

  const ov = c.overview.data
  const pool = c.pool.data
  const rungs = c.ladder.data?.rungs || []
  const tail = rungs.length ? rungs[rungs.length - 1] : null
  const parked = tail?.waiting ?? null

  const breakdown = Object.entries(pool?.breakdown || {})
    .filter(([k]) => k !== 'eligible')
    .sort((a, b) => b[1] - a[1])

  return (
    <>
      <SectionHead
        eyebrow="How this campaign is set up"
        title="The rules Sarah follows"
        sub="Read-only. Everything here lives in the database, and changing it takes effect on the next call."
      />

      <Feed feed={c.overview} what="the campaign">
        {(o) => <Controls ov={o} control={control} busy={busy} />}
      </Feed>

      {/* Above the configuration, because it is the thing somebody wants
          BEFORE they press Start, not a setting they came here to read. */}
      <TestRun />

      <div className="setup-grid" style={{ marginTop: 20 }}>
        {/* ── left: who, how many, aiming for, prompt ── */}
        <div>
          <dl>
            <dt>Who she's calling</dt>
            <dd>
              {/* Three states, not two: a feed still loading must not render an
                  em-dash, because an em-dash is a claim that nobody measured it. */}
              <Feed feed={c.pool} what="the list">
                {(pl) => (
                  <>
                    {num(pl.eligible)} people
                    <small>
                      From {num(pl.total)} in the database.
                      {breakdown.length > 0 && (
                        <span style={{ display: 'block', marginTop: 6 }}>
                          Off-limits:{' '}
                          {breakdown.map(([reason, n], i) => (
                            <span key={reason}>
                              {i ? ' · ' : ''}{num(n)} {reason}
                            </span>
                          ))}
                        </span>
                      )}
                    </small>
                  </>
                )}
              </Feed>
            </dd>

            <dt>How many a day</dt>
            <dd>
              <Feed feed={c.overview} what="the daily cap">
                {(o) => (
                  <>
                    {num(o.daily_dial_cap)}
                    {o.dial_cap_steady != null && o.dial_cap_steady !== o.daily_dial_cap
                      ? <>, rising to {num(o.dial_cap_steady)}</> : null}
                    <small>
                      {o.dial_spacing_seconds != null
                        ? `${num(o.dial_spacing_seconds)} seconds between calls, so the number does not get flagged.`
                        : 'Spacing between calls is not set.'}
                      {o.ramp_days != null && <> The cap rises after {num(o.ramp_days)} days, and only if the pick-up rate held.</>}
                    </small>
                  </>
                )}
              </Feed>
            </dd>

            <dt>What she's aiming for</dt>
            <dd>
              <Feed
                feed={c.funnel} what="the targets"
                empty={<Empty title="No targets set">Nothing to aim at has been written down for this campaign.</Empty>}
              >
                {(fn) => (fn.rows || []).length ? (
                  <>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {fn.rows.map((r) => (
                        <div key={r.metric} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                          <span>{r.metric}</span>
                          <span className="mono" style={{ color: 'var(--muted)' }}>
                            {num(r.conservative)} · <b style={{ color: 'var(--text)' }}>{num(r.target)}</b> · {num(r.stretch)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <small>Conservative · target · stretch. Closing is Ron's number, not hers.</small>
                  </>
                ) : (
                  <Empty title="No targets set">Nothing to aim at has been written down for this campaign.</Empty>
                )}
              </Feed>
            </dd>

            <dt>Prompt version</dt>
            <dd>
              <span className="na">not tracked</span>
              <small>
                The database does not record which prompt version Sarah is running or
                when it changed, so this page cannot tell you. Staged edits below are
                held in this browser tab only.
              </small>
            </dd>
          </dl>
        </div>

        {/* ── right: after four, stop rules, publish ── */}
        <div>
          <dt>What happens after 4 failed attempts</dt>
          <ul className="rules" style={{ paddingLeft: 18, marginTop: 8 }}>
            <li>She marks them <b>unreachable</b> and stops calling.</li>
            <li>{tail?.note
              ? <>{tail.note}</>
              : <b>Nothing else happens. No WhatsApp, no nurture, no re-dial date.</b>}</li>
            {parked != null && parked > 0 && (
              <li style={{ color: 'var(--warn)' }}>
                {num(parked)} {parked === 1 ? 'person has' : 'people have'} finished all four
                attempts. Worth checking the next step is actually running for them before
                the campaign ends — nothing on this page can confirm it did.
              </li>
            )}
            {parked === 0 && (
              <li style={{ color: 'var(--dim)' }}>Nobody has run out of attempts yet.</li>
            )}
          </ul>

          <dt style={{ marginTop: 20 }}>Stop rules</dt>
          <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '2px 0 4px', maxWidth: '60ch' }}>
            Any one of these stops the whole campaign by itself, and only a person can
            clear it.
          </p>
          <Feed feed={c.overview} what="the stop rules">
            {(o) => <StopRules kill={o.kill} />}
          </Feed>

          <dt style={{ marginTop: 20 }}>Prompt edits</dt>
          {/* NO WRITE PATH. There is no versioning table and no publish RPC, so
              this button is disabled and says why. It must never look live: a
              publish that silently does nothing is the worst button on the page. */}
          <button
            className="btn go" disabled
            title="Not built. There is no prompt-version table and no publish RPC — the only write this dashboard has is start / pause / resume / clear halt."
            style={{ marginTop: 8, opacity: 0.55, cursor: 'not-allowed' }}
          >
            {staged.length
              ? `Publish ${num(staged.length)} pending prompt ${staged.length === 1 ? 'edit' : 'edits'}`
              : 'Publish pending prompt edits'}
          </button>

          {staged.length ? (
            <div style={{ marginTop: 12 }}>
              {staged.map((s) => (
                <div key={s.rule} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 12, padding: '8px 0', borderBottom: '1px solid var(--hairline-soft)',
                }}>
                  <span style={{ fontSize: 13 }}>{s.label || s.rule}</span>
                  <button className="btn" onClick={() => pendingEdits.unstage(s.rule)}>Remove</button>
                </div>
              ))}
              <p style={{ color: 'var(--warn)', fontSize: 12.5, marginTop: 10, maxWidth: '60ch' }}>
                These are staged in this browser tab and nowhere else. Publishing is not
                built, so nothing has reached Sarah's prompt and a refresh loses them.
                Until it exists, the edit has to be applied to the assistant by hand.
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 10, maxWidth: '60ch' }}>
              Nothing staged. Prompt edits are staged on the{' '}
              <button className="btn" style={{ padding: '2px 8px' }} onClick={() => goTo('review')}>
                Call review
              </button>{' '}
              tab, and would be published from here once that is built.
            </p>
          )}
        </div>
      </div>

      {!ov && !c.overview.loading && (
        <div style={{ marginTop: 20 }}>
          <Empty title="No campaign found">
            Nothing is configured under this campaign id, so there is nothing to show or
            control.
          </Empty>
        </div>
      )}
    </>
  )
}
