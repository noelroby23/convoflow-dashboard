import { useMemo } from 'react'
import { useCampaign } from '../useCampaign'
import { Feed, Empty, SectionHead } from '../bits'
import { num, pct, fmtDay, fmtDow, widthPct } from '../format'

/**
 * Shifts — the clock-out reports. One per day, written when she stops calling.
 *
 * 🔑 THE HARD RULE THIS TAB EXISTS TO PROTECT: a clock-out report is written
 * once and never recalculated. Every other view on this dashboard recomputes
 * from live tables, which is right for "what is happening now" and useless for
 * "was Monday better than Thursday" — a recomputed history moves under you, so
 * an outcome corrected on Friday silently rewrites Tuesday and the comparison
 * you drew last week stops reproducing. `cf.close_shift` refuses to overwrite a
 * closed day; this tab must never quietly re-derive one either. That is why the
 * numbers below come straight off the stored row and nothing here divides.
 *
 * ⚠️ NOTHING IS CLOCKED OUT TODAY. The campaign rests in `draft`, so `days` is
 * empty and `note` is null on every row that ever arrives until the LLM pass
 * that writes the manager's note is built. Both are rendered as an explicit
 * "not written" rather than as a silent gap — an empty card is otherwise
 * indistinguishable from a day where nothing happened.
 */

const DAY_MS = 86_400_000
const gapDays = (later, earlier) =>
  Math.round((new Date(later).getTime() - new Date(earlier).getTime()) / DAY_MS)

const label = (iso) => `${fmtDow(iso)} ${fmtDay(iso)}`

/* ── the five numbers ────────────────────────────────────────────────────── */

const N = ({ k, v, r, pink }) => (
  <div className="d1">
    <span className="k">{k}</span>
    <div className={pink ? 'v pk' : 'v'}>{v}</div>
    <div className="r">{r}</div>
  </div>
)

function DayNumbers({ d }) {
  return (
    <div className="day-nums">
      <N k="Called" v={num(d.calls)}
         r={d.cap != null ? (d.calls >= d.cap ? 'hit the cap' : `cap was ${num(d.cap)}`) : 'no cap set'} />
      <N k="Picked up" v={num(d.reached)} r={pct(d.connect_pct)} />
      <N k="Real talks" v={num(d.talks)}
         r={d.reached ? `of ${num(d.reached)} who picked up` : 'nobody picked up'} />
      <N k="Booked" v={num(d.booked)} pink
         r={d.booking_pct != null ? `${pct(d.booking_pct)} of talks` : 'of the real talks'} />
      {/* Turned up is deliberately an em-dash, not a zero: the clock-out report
          does not carry attendance, and a 0 here would read as "nobody came". */}
      <N k="Turned up" v={num(d.turned_up)} r="not in the clock-out report" />
    </div>
  )
}

function Chips({ d }) {
  const chips = []
  if (d.cap != null) {
    chips.push(d.calls >= d.cap
      ? <span key="cap" className="dchip g">full {num(d.cap)} called</span>
      : <span key="cap" className="dchip p">{num(d.calls)} of {num(d.cap)} called</span>)
  }
  if (d.booked > 0) chips.push(<span key="bk" className="dchip g">{num(d.booked)} booked</span>)
  if (d.voicemails > 0) chips.push(<span key="vm" className="dchip n">{num(d.voicemails)} voicemails</span>)
  if (d.failed > 0) chips.push(<span key="f" className="dchip p">{num(d.failed)} died before ringing</span>)
  if (!chips.length) chips.push(<span key="q" className="dchip n">no calls</span>)
  return <div className="day-chips">{chips}</div>
}

/** The note is the value, not the numbers — so its absence has to be said out
 *  loud rather than left as a blank strip under the figures. */
function Note({ text }) {
  return (
    <div className="day-note">
      <div className="av2">M</div>
      {text
        ? <p>{text}</p>
        : <p style={{ color: 'var(--dim)' }}>
            No note written for this day. The note is the one thing here you could
            only know by listening to the calls, and the pass that writes it is not
            built yet — so this is a gap in the report, not a quiet day.
          </p>}
    </div>
  )
}

/* ── the strip ───────────────────────────────────────────────────────────── */

function Strip({ days, today }) {
  const cols = useMemo(() => {
    const past = [...days].reverse()             // oldest first, left to right
    const all = today ? [...past, { ...today, now: true }] : past
    const ceiling = Math.max(1, ...all.map((d) => Math.max(d.calls || 0, d.cap || 0)))
    const out = []
    all.forEach((d, i) => {
      const prev = all[i - 1]
      if (prev && gapDays(d.date, prev.date) > 1) {
        out.push({ gap: true, key: `gap-${d.date}`, days: gapDays(d.date, prev.date) - 1 })
      }
      out.push({ ...d, key: d.date, ceiling })
    })
    return out
  }, [days, today])

  const anyCalls = cols.some((c) => !c.gap && c.calls > 0)
  if (!anyCalls) {
    return (
      <Empty title="No day has been worked yet">
        The bar for each day appears here once she has made her first calls — grey
        for calls, a pink tip on top for the meetings booked out of them.
      </Empty>
    )
  }

  return (
    <div className="sh-strip">
      {cols.map((c) => c.gap ? (
        <div className="gapday" key={c.key}><span>{c.days > 1 ? 'weekend' : 'no calls'}</span></div>
      ) : (
        <div className={c.now ? 'col2 now' : 'col2'} key={c.key}
             title={`${label(c.date)} · ${num(c.calls)} called · ${num(c.booked)} booked`}>
          <div className="stack2">
            <div className="bk" style={{ height: `${widthPct(c.booked, c.ceiling)}%` }} />
            <div className="cl" style={{
              height: `${Math.max(0, widthPct(c.calls, c.ceiling) - widthPct(c.booked, c.ceiling))}%`,
            }} />
          </div>
          <span className="dl">{label(c.date)}</span>
        </div>
      ))}
    </div>
  )
}

/* ── the tab ─────────────────────────────────────────────────────────────── */

export default function Shifts({ goTo }) {
  const c = useCampaign()

  return (
    <Feed feed={c.shifts} what="the clock-out reports">
      {(s) => {
        const days = s.days || []
        const today = s.today || null
        const worked = days.length

        return (
          <>
            <SectionHead
              eyebrow="Clock-out reports"
              title="Every day she's worked"
              sub={worked
                ? `One report per day, written when she stops calling. ${num(worked)} ${worked === 1 ? 'day' : 'days'} clocked out so far.`
                : 'One report per day, written when she stops calling. No day has been clocked out yet.'}
            />

            <p style={{
              borderLeft: '2px solid var(--pink)', paddingLeft: 14, margin: '0 0 18px',
              color: 'var(--muted)', fontSize: 13.5, maxWidth: '72ch',
            }}>
              <b style={{ color: 'var(--text)' }}>A report is written once and never recalculated.</b>{' '}
              Every other tab recomputes from live data, which is right for what is
              happening now and wrong for history — if yesterday could change, comparing
              two days would mean nothing. These numbers are frozen at the moment she
              stopped calling.
            </p>

            <section className="card">
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                flexWrap: 'wrap', gap: 10, marginBottom: 16,
              }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 4 }}>Calls a day · bookings on top in pink</p>
                  <h3 style={{ fontSize: 15 }}>
                    {worked ? 'Every day side by side' : 'Nothing to compare yet'}
                  </h3>
                </div>
                {today && (
                  <span className="dchip n">
                    today {num(today.calls)} called · {num(today.booked)} booked
                  </span>
                )}
              </div>
              <Strip days={days} today={today} />
            </section>

            {/* ── today, still running ── */}
            {today && (
              <div className="day today">
                <div className="day-top">
                  <div className="day-when">
                    <h3>
                      {label(today.date)}{' '}
                      <span className="mono" style={{ color: 'var(--pink)', fontSize: 12 }}>· still working</span>
                    </h3>
                    <div className="hrs">
                      {today.from
                        ? `Started ${today.from} · on the phone now`
                        : 'No calls placed yet today'}
                    </div>
                  </div>
                  <div className="day-chips">
                    <span className="dchip p">not clocked out yet</span>
                  </div>
                </div>

                <DayNumbers d={today} />

                <div className="day-note">
                  <div className="av2">M</div>
                  <p style={{ color: 'var(--dim)' }}>
                    Today's report is written when she stops calling
                    {today.cap != null ? ` — at ${num(today.cap)} calls, or when the last time slot closes.` : '.'}{' '}
                    Until then these numbers move, and nothing here is frozen yet.
                  </p>
                </div>

                <div className="day-foot">
                  <button className="btn" onClick={() => goTo('queue')}>Watch the queue</button>
                </div>
              </div>
            )}

            {/* ── the finished days ── */}
            {days.map((d, i) => {
              const prev = days[i - 1] || today
              const skipped = prev ? gapDays(prev.date, d.date) - 1 : 0
              return (
                <div key={d.date}>
                  {skipped > 0 && (
                    <div className="weekend">
                      <span>{skipped === 1 ? 'one day' : `${skipped} days`} with no calls</span>
                      <span style={{ color: 'var(--dim)' }}>no report written</span>
                    </div>
                  )}
                  <div className="day">
                    <div className="day-top">
                      <div className="day-when">
                        <h3>{label(d.date)}</h3>
                        <div className="hrs">
                          {d.from && d.to ? `${d.from} – ${d.to}` : 'times not recorded'}
                          {d.ended_how ? ` · ${d.ended_how}` : ''}
                          {d.hours != null ? ` · ${d.hours}h` : ''}
                        </div>
                      </div>
                      <Chips d={d} />
                    </div>

                    <DayNumbers d={d} />
                    <Note text={d.note} />

                    <div className="day-foot">
                      <button className="btn" onClick={() => goTo('queue')}>Open the queue</button>
                      <button className="btn" onClick={() => goTo('review')}>Call review</button>
                    </div>
                  </div>
                </div>
              )
            })}

            {!worked && (
              <div style={{ marginTop: 12 }}>
                <Empty title="No clock-out report yet">
                  The first one is written the evening she first calls. It freezes that
                  day's five numbers and the note about them, and never changes again.
                </Empty>
              </div>
            )}
          </>
        )
      }}
    </Feed>
  )
}
