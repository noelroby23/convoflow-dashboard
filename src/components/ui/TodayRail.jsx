import { useEffect, useRef, useState } from 'react'

/**
 * "Today so far" — the desk's opening statement.
 *
 * This replaces the eight equal tiles that used to sit here. Two problems with
 * those: the same three facts were also rendered by the headline Stat row
 * lower down under different words (Calls made / Dials, Answered / Actually
 * reached), and a rate that matters — how many dials reached a human — was
 * split into two counts and left for the reader to divide.
 *
 * So the row is a funnel, and the CONNECTORS carry the ratio. The bar between
 * "Calls made" and "Reached" is literally filled to the connect rate, which
 * means a bad shift is visible from across the room without reading a digit.
 * The stages stay deliberately quiet; the connectors are the one loud thing.
 */

const INK = '#22211D'
const MUTED = '#6D6B63'
const FAINT = '#B5B3AC'

// Signal colours already used by the board and the activity feed, so a green
// here means the same thing it means there.
const GOOD = '#14794A'
const FAIR = '#96660C'
const POOR = '#B91C1C'

// Thresholds are a UI judgement, not a target from cf.target — deliberately so,
// since nothing in the database defines a "good" connect rate. ~59% of dials
// never connect on a healthy day (CLAUDE.md 7.7), so half getting through is
// the realistic ceiling rather than an aspiration.
const connectTone = (pct) => (pct >= 50 ? GOOD : pct >= 30 ? FAIR : POOR)
const bookTone = (pct) => (pct >= 50 ? GOOD : pct >= 25 ? FAIR : POOR)

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * Counts up to `value` once it lands. Null stays null — an absent reading must
 * never animate to zero, because a zero on this desk is a measured result.
 */
function useCountUp(value, ms = 700) {
  const [shown, setShown] = useState(value == null ? null : 0)
  const frame = useRef()

  useEffect(() => {
    if (value == null) { setShown(null); return }
    const target = Number(value)
    if (!Number.isFinite(target)) { setShown(null); return }
    if (reduceMotion() || target === 0) { setShown(target); return }

    const started = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - started) / ms)
      // easeOutCubic — fast arrival, quiet settle.
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [value, ms])

  return shown
}

function Stage({ label, value, note, tone, onClick, title }) {
  const shown = useCountUp(value)
  const As = onClick ? 'button' : 'div'
  return (
    <As
      onClick={onClick}
      title={title}
      className={`group relative flex-1 min-w-0 text-left bg-white border border-[#E9E9E7]
                  rounded-xl px-4 py-3.5 transition-[transform,border-color,box-shadow] duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC4899]
                  focus-visible:ring-offset-2
                  ${onClick
                    ? 'cursor-pointer hover:-translate-y-px hover:border-[#C9C8C4] hover:shadow-[0_2px_10px_rgba(34,33,29,0.06)]'
                    : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125"
          style={{ background: tone || FAINT }}
        />
        <span
          className="font-meter text-[10px] uppercase leading-none truncate"
          style={{ color: MUTED, letterSpacing: '0.14em' }}
        >
          {label}
        </span>
      </div>

      <div
        className="font-meter tabular-nums mt-2 text-[30px] leading-none"
        style={{ color: INK, letterSpacing: '-0.02em' }}
      >
        {shown ?? '—'}
      </div>

      <div className="mt-1.5 text-[11px] leading-tight" style={{ color: FAINT }}>
        {note}
      </div>
    </As>
  )
}

/**
 * The connector. `pct` null means the ratio is undefined (nothing upstream to
 * divide by) and the bar stays empty rather than reading as 0% — those are
 * different statements and only one of them is a failure.
 */
function Flow({ pct, caption, tone }) {
  const [live, setLive] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLive(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const filled = pct == null ? 0 : Math.max(2, Math.min(100, pct))

  return (
    <div className="flex lg:flex-col items-center gap-2 lg:gap-1.5 lg:w-24 shrink-0 pl-5 lg:pl-0 py-1 lg:py-0">
      <div className="cf-flow h-8 w-[3px] lg:h-[3px] lg:w-full" aria-hidden="true">
        <i style={{ '--p': live ? `${filled}%` : '0%', background: tone || FAINT }} />
      </div>
      <div className="font-meter text-[10px] leading-none whitespace-nowrap" style={{ color: pct == null ? FAINT : tone }}>
        {pct == null ? '—' : `${pct}%`}
        <span className="hidden lg:inline" style={{ color: FAINT }}> {caption}</span>
      </div>
      <span className="lg:hidden text-[10px]" style={{ color: FAINT }}>{caption}</span>
    </div>
  )
}

export default function TodayRail({ today, day = 'today', onFilter }) {
  const leads = today?.new_leads
  const calls = today?.calls_made
  const answered = today?.answered
  const missed = today?.no_answer
  const booked = today?.meetings_booked
  const reminders = today?.reminders_sent
  const reMade = today?.reactivation_made
  const reAnswered = today?.reactivation_answered

  const rate = (num, den) =>
    den == null || Number(den) === 0 || num == null ? null : Math.round((Number(num) / Number(den)) * 100)

  const connectPct = rate(answered, calls)
  const bookPct = rate(booked, answered)
  const when = day === 'today' ? 'today' : 'yesterday'

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <Stage
          label="New leads"
          value={leads}
          note={`arrived ${when}`}
          tone={Number(leads) > 0 ? GOOD : undefined}
          onClick={onFilter ? () => onFilter('new') : undefined}
          title="Show only new leads on the board"
        />

        {/* No ratio here on purpose: calls include follow-ups to leads that
            arrived weeks ago, so dividing them by today's leads would invent
            a number. */}
        <Flow pct={null} caption="then dialled" tone={FAINT} />

        <Stage
          label="Calls made"
          value={calls}
          note={missed > 0 ? `${missed} never reached anyone` : 'dials placed'}
          tone={Number(calls) > 0 ? '#2E62E0' : undefined}
        />

        <Flow pct={connectPct} caption="connected" tone={connectPct == null ? FAINT : connectTone(connectPct)} />

        <Stage
          label="Reached"
          value={answered}
          note="picked up the phone"
          tone={connectPct == null ? undefined : connectTone(connectPct)}
        />

        <Flow pct={bookPct} caption="booked" tone={bookPct == null ? FAINT : bookTone(bookPct)} />

        <Stage
          label="Meetings booked"
          value={booked}
          note="taken off those calls"
          tone={Number(booked) > 0 ? GOOD : undefined}
          onClick={onFilter ? () => onFilter('booked') : undefined}
          title="Show only booked leads on the board"
        />
      </div>

      {/* The two counts that used to occupy whole tiles while reading zero.
          They belong on the desk, but not at the same weight as the funnel. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 text-[11px]" style={{ color: MUTED }}>
        <span>
          Reactivation{' '}
          <b className="font-meter font-normal tabular-nums" style={{ color: reMade > 0 ? INK : FAINT }}>{reMade ?? '—'}</b>
          {' '}called,{' '}
          <b className="font-meter font-normal tabular-nums" style={{ color: reAnswered > 0 ? INK : FAINT }}>{reAnswered ?? '—'}</b>
          {' '}answered
        </span>
        <span>
          Reminders sent{' '}
          <b className="font-meter font-normal tabular-nums" style={{ color: reminders > 0 ? INK : FAINT }}>{reminders ?? '—'}</b>
        </span>
      </div>
    </div>
  )
}
