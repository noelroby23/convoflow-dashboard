import { useCampaign } from '../useCampaign'
import { Feed, Empty, SectionHead } from '../bits'
import { num, pct, widthPct } from '../format'

/**
 * Follow-ups — where everyone sits in their four attempts.
 *
 * 🔑 THE REASON THIS TAB EXISTS IS THE PER-ATTEMPT RATE, not the counts. Four
 * calls over ten days, each in a different time slot, and the pick-up rate of
 * each slot is the only evidence that would ever justify moving one. Attempt 3
 * in the evening beating both mornings is an argument you can take to a meeting;
 * "692 people are waiting" is not.
 *
 * ⚠️ `pickup_pct` and `booking_pct` are NULL until that attempt has actually
 * been dialled, and they must render as em-dashes. A "0%" against an attempt
 * nobody has reached yet reads as "every one of those failed" — the reader acts
 * on it, and the action is to change a slot that has never been tried. Today
 * every rung is null, because the campaign has not started.
 */

/* Sarah's columns heat up toward her finish line — the same accent ramp the
   pipeline board uses, so the two tabs read as one system. */
const ACCENT = ['var(--s2)', 'var(--s2)', 'var(--s3)', 'var(--s3)']

function Rung({ r, i, last }) {
  const accent = last ? 'var(--dim)' : (ACCENT[i] || 'var(--s3)')
  const dialled = r.dials != null && r.dials > 0

  return (
    <div className="rung" style={{ '--accent': accent }}>
      <p className="eyebrow" style={{ margin: 0 }}>
        {last ? 'After 4' : `Attempt ${r.step}`}
      </p>
      <div className="day">{r.label || (last ? 'Unreachable' : `Attempt ${r.step}`)}</div>
      <div className="slot">{r.window || 'No further calls'}</div>

      <div className="waiting" style={last ? { color: 'var(--muted)' } : undefined}>
        {num(r.waiting)}
        <small>
          {last
            ? 'never answered any of the four'
            : r.step === 1 ? 'waiting for their first call'
            : r.step === 4 ? 'on their last chance'
            : `waiting on call ${r.step}`}
        </small>
      </div>

      <div className={last ? 'due' : (r.due_now > 0 ? 'due now' : 'due')}>
        {last ? 'nothing scheduled'
          : r.due_now > 0 ? `${num(r.due_now)} due now`
          : 'nothing due right now'}
      </div>

      <div className="mini">
        {/* widthPct clamps and returns 0 for a null rate, so the track renders
            empty rather than the bar inverting on a rate nobody has measured. */}
        <i style={{ width: `${widthPct(r.pickup_pct, 100)}%`, background: last ? 'var(--hairline)' : accent }} />
      </div>

      <div className="rate" style={last ? { color: 'var(--dim)' } : undefined}>
        {last ? (
          <>
            These leads stop being called.{' '}
            {r.note
              ? <b style={{ color: 'var(--text)' }}>{r.note}</b>
              : <b style={{ color: 'var(--warn)' }}>No next step defined yet.</b>}
          </>
        ) : dialled ? (
          <>
            Picks up: <b>{pct(r.pickup_pct)}</b><br />
            Books from here: <b>{pct(r.booking_pct)}</b>
            <div style={{ color: 'var(--dim)', fontSize: 11.5, marginTop: 5 }}>
              {num(r.dials)} called · {num(r.reached)} answered · {num(r.booked)} booked
            </div>
          </>
        ) : (
          <span style={{ color: 'var(--dim)' }}>
            Picks up: <b style={{ color: 'var(--dim)' }}>—</b><br />
            Books from here: <b style={{ color: 'var(--dim)' }}>—</b>
            <div style={{ fontSize: 11.5, marginTop: 5 }}>
              Nobody has been called on this attempt yet, so there is no rate to show.
            </div>
          </span>
        )}
      </div>

      {r.voicemail && <span className="vm">Voicemail left here only</span>}
    </div>
  )
}

export default function FollowUps({ openLead }) {
  const c = useCampaign()

  return (
    <Feed feed={c.ladder} what="the follow-up cycle">
      {(l) => {
        const rungs = l.rungs || []
        const overdue = l.overdue || []
        const overdueCount = l.overdue_count ?? overdue.length
        const checks = l.checks || []

        return (
          <>
            <SectionHead
              eyebrow="The follow-up cycle"
              title="Where everyone sits in their 4 attempts"
              sub="Each lead gets four calls over ten days, at a different time of day each time. The rate under each one is the rate for that attempt alone."
            />

            {rungs.length ? (
              <div className="ladder">
                {rungs.map((r, i) => (
                  <Rung key={r.step ?? `tail-${i}`} r={r} i={i} last={i === rungs.length - 1} />
                ))}
              </div>
            ) : (
              <Empty title="The ladder is not set up">
                No call steps are defined for this campaign, so there is nothing for
                anyone to sit on.
              </Empty>
            )}

            {/* ── overdue ── */}
            <section className="sec card">
              <p className="eyebrow">Attention</p>
              <h2 className="sec-title">
                {overdueCount > 0
                  ? `${num(overdueCount)} ${overdueCount === 1 ? 'person is' : 'people are'} overdue a call`
                  : 'Nobody is overdue a call'}
              </h2>
              <p className="sec-sub">
                {overdueCount > 0
                  ? 'They passed their time slot and have not been dialled. The reason is the useful half — a pacing cap and a dead line need opposite fixes.'
                  : 'Everyone waiting on a call is still inside their slot.'}
              </p>

              {overdueCount > 0 ? (
                <>
                  <table className="due-table">
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Should have been called</th>
                        <th>Attempt</th>
                        <th>Why it slipped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdue.map((o) => (
                        <tr key={`${o.lead_id}-${o.step}`}
                            onClick={() => o.lead_id && openLead(o.lead_id)}
                            style={{ cursor: o.lead_id ? 'pointer' : 'default' }}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{o.name || 'Unnamed'}</div>
                            <div className="p">{o.phone || '—'}</div>
                          </td>
                          <td>
                            {o.due || '—'}
                            {o.late_minutes != null && (
                              <div className="p">
                                {o.late_minutes >= 60
                                  ? `${Math.round(o.late_minutes / 60)}h late`
                                  : `${num(o.late_minutes)} min late`}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={o.step === 2 ? 'att-pill a2' : 'att-pill'}>
                              {o.step != null ? `${o.step} of 4` : 'unscheduled'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--muted)' }}>{o.reason || 'unknown'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* NO WRITE PATH. `cf_campaign_control` is the only write this
                      dashboard has, and it does start/pause/resume/clear-halt —
                      it deliberately cannot release or re-schedule anybody. The
                      button says what it would do and why it cannot, rather than
                      looking live and doing nothing. */}
                  <button
                    className="btn go" disabled
                    title="Not built. The only write this page has is start / pause / resume / clear halt — nothing can re-schedule a call from the browser yet."
                    style={{ marginTop: 14, opacity: 0.55, cursor: 'not-allowed' }}
                  >
                    Push all {num(overdueCount)} into today's queue
                  </button>
                  <p style={{ color: 'var(--dim)', fontSize: 12, marginTop: 8 }}>
                    Not wired up yet — nothing in the browser can re-schedule a call.
                    They go back in the queue by themselves when the pacer's next
                    window opens.
                  </p>
                </>
              ) : (
                <Empty title="Nothing has slipped">
                  When somebody passes their slot without being dialled they appear
                  here, with the reason it happened.
                </Empty>
              )}
            </section>

            {/* ── the three rules ── */}
            <section className="sec">
              <p className="eyebrow">Rules she's following</p>
              {/* The design calls this "Cadence check". The word "cadence" is
                  database vocabulary and stays there (build contract, rule 7). */}
              <h2 className="sec-title" style={{ marginBottom: 14 }}>Is she following them?</h2>
              {checks.length ? (
                <div className="rules-strip">
                  {checks.map((k) => (
                    <div key={k.rule} className={k.ok ? 'rule' : 'rule brk-r'}>
                      <span className="st" />
                      <div>
                        <div className="t">{k.rule}</div>
                        <div className="d">{k.detail || (k.ok ? 'clean' : 'breached')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="No rules reported">
                  The cadence check could not read the ladder's rules.
                </Empty>
              )}
            </section>
          </>
        )
      }}
    </Feed>
  )
}
