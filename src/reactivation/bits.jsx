import { num, pct, TONE_VAR, widthPct } from './format'

/**
 * The small pieces every tab shares.
 *
 * These exist so that "loading", "failed to load" and "nothing here yet" look
 * different from each other. The campaign rests in `draft` by design, so most
 * of this dashboard is legitimately empty on day one — and an empty grid is
 * indistinguishable from a broken one unless something says which (CLAUDE.md
 * §7 item 133: a quiet board is a claim about severity, not about health).
 */

/** Mono eyebrow in letterspaced caps — the existing product vernacular, kept. */
export const Eyebrow = ({ children }) => <p className="eyebrow">{children}</p>

export const SectionHead = ({ eyebrow, title, sub }) => (
  <>
    {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
    {title && <h2 className="sec-title">{title}</h2>}
    {sub && <p className="sec-sub">{sub}</p>}
  </>
)

export const Loading = ({ what = 'loading' }) => <div className="rx-loading">{what}…</div>

/** A failed read says so, and says what failed. It never renders zeros — a zero
 *  over a failed load is an answer the reader will act on. */
export const Failed = ({ error, what }) => (
  <div className="rx-error">Could not load {what}. {error?.message || String(error)}</div>
)

/** Nothing here yet, and why — not the same thing as broken. */
export const Empty = ({ title, children }) => (
  <div className="rx-empty"><b>{title}</b>{children}</div>
)

/** The one place a feed's three states are handled, so no tab forgets one. */
export function Feed({ feed, what, empty, children }) {
  if (feed?.error) return <Failed error={feed.error} what={what} />
  if (feed?.loading && !feed?.data) return <Loading what={what} />
  if (!feed?.data) return empty || <Loading what={what} />
  if (feed.data.found === false && empty) return empty
  return children(feed.data)
}

/** A coloured status dot. `tone` is good | warn | bad | na. */
export const Dot = ({ tone = 'na', size = 7, style }) => (
  <i style={{
    display: 'inline-block', width: size, height: size, borderRadius: '50%',
    background: TONE_VAR[tone] || TONE_VAR.na, flex: 'none', ...style,
  }} />
)

/** A horizontal bar with an optional "you should be here today" marker. */
export function Bar({ value, of, tone = 'good', marker = null, height = 8 }) {
  const w = widthPct(value, of)
  const m = marker != null ? widthPct(marker, of) : null
  return (
    <div style={{ position: 'relative', height, borderRadius: height / 2, background: 'var(--hairline-soft)' }}>
      <i style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w}%`,
        borderRadius: height / 2, background: TONE_VAR[tone] || TONE_VAR.na,
      }} />
      {m != null && (
        <i title="where the plan says you should be today" style={{
          position: 'absolute', left: `${m}%`, top: -2, bottom: -2, width: 2,
          background: 'var(--text)', opacity: 0.85,
        }} />
      )}
    </div>
  )
}

/** A count in the display face. A missing value renders as an em-dash. */
export const Big = ({ value, tone, suffix, format = num }) => (
  <div className="mono" style={{
    fontFamily: 'var(--display)', fontSize: 32, fontWeight: 800, letterSpacing: '-.03em',
    color: tone ? TONE_VAR[tone] : 'var(--text)', lineHeight: 1.05,
  }}>
    {format(value)}
    {suffix && <small style={{ fontSize: 13, color: 'var(--dim)', fontWeight: 400 }}>{suffix}</small>}
  </div>
)

/** Filter chips — the pressed state carries the pink border from the design. */
export const Chip = ({ active, onClick, children, title }) => (
  <button className="chip" aria-pressed={active ? 'true' : 'false'} onClick={onClick} title={title}>
    {children}
  </button>
)

/**
 * The outcome vocabulary, fixed once. The queue, the pipeline cards and the
 * lead drawer all read it, so the same outcome can never wear two colours on
 * two tabs — which is how a reader starts believing they are two things.
 */
const OUTCOME_STYLE = {
  booked:            { bg: '#12211A', bd: '#2A4A3B', fg: 'var(--good)',  label: 'Booked' },
  super_hot:         { bg: '#2A0F1C', bd: '#5E2340', fg: 'var(--pink)',  label: 'Super hot' },
  talked_not_booked: { bg: '#1F1E23', bd: '#2C2A31', fg: 'var(--muted)', label: 'Talked, not booked' },
  voicemail:         { bg: '#121A24', bd: '#254058', fg: 'var(--blue)',  label: 'Voicemail' },
  not_interested:    { bg: '#211A0D', bd: '#4A3A15', fg: 'var(--warn)',  label: 'Not interested' },
  no_answer:         { bg: 'transparent', bd: 'var(--hairline)', fg: 'var(--dim)', label: 'No answer' },
}

export function OutcomePill({ outcome, children }) {
  const s = OUTCOME_STYLE[outcome] || OUTCOME_STYLE.talked_not_booked
  return (
    <span className="mono" style={{
      fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase',
      padding: '4px 9px', borderRadius: 999,
      background: s.bg, border: `1px solid ${s.bd}`, color: s.fg, whiteSpace: 'nowrap',
    }}>
      {children || s.label}
    </span>
  )
}

/**
 * The handoff divider. Sarah's work ends here and Ron's begins, and the design
 * makes that a literal line rather than a colour change you have to know about.
 */
export const Handoff = ({ label = 'Handoff — Sarah stops here' }) => (
  <div className="handoff-line" style={{ margin: '22px 0 16px' }}>
    <i /><span>{label}</span><i />
  </div>
)

/** A pulsing dot, used only where something is genuinely happening now. */
export const LiveDot = () => (
  <i style={{
    display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
    background: 'var(--pink)', animation: 'pulse 2.4s ease-in-out infinite',
  }} />
)

export { num, pct }
