import { TONE_VAR } from '../format'

/**
 * The Agent view's small pieces — the design's own style helpers, ported.
 *
 * 🔑 THE TRAFFIC LIGHT IS NOT REDEFINED HERE. The source design carries its own
 * `tone(v,t)` — at or above target green, within 10% amber, else red — which is
 * `toneFor` in ../format character for character. Writing a second copy would
 * give this app two answers to "is this figure behind", and the two would
 * disagree the first time somebody nudged one of them (§7 item 127). `hexFor`
 * below only maps `toneFor`'s verdict onto this palette's hexes.
 */

export const C = {
  bg: '#0F0F1A', rail: '#12121F', surface: '#16162A', raised: '#1C1C2E',
  text: '#F5F5FA', soft: '#D1D5DB', muted: '#9CA3AF', dim: '#6B7280',
  pink: '#EC4899', pinkSoft: '#F9A8D4', pinkLink: '#F472B6', pinkDeep: '#DB2777',
  good: '#22C55E', goodSoft: '#4ADE80', warn: '#F59E0B', bad: '#EF4444', badSoft: '#F87171',
  line: 'rgba(255,255,255,0.08)', lineSoft: 'rgba(255,255,255,0.06)',
  track: 'rgba(255,255,255,0.07)',
}

export const MONO = "'JetBrains Mono',ui-monospace,monospace"

/** toneFor's verdict in this palette. `na` stays grey — never green, because a
 *  figure with no denominator has not passed anything. */
export const hexFor = (tone) =>
  tone === 'good' ? C.good : tone === 'warn' ? C.warn : tone === 'bad' ? C.bad : C.muted

export const TONE_HEX = { good: C.good, warn: C.warn, bad: C.bad, na: C.muted }

/* ---------------------------------------------------------------- text bits */

export const Eyebrow = ({ children, color = C.muted, size = 11, style }) => (
  <div style={{
    fontSize: size, letterSpacing: '0.08em', textTransform: 'uppercase',
    color, fontWeight: 700, ...style,
  }}>{children}</div>
)

export const Num = ({ children, size = 28, color = C.text, style }) => (
  <div style={{
    fontSize: size, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: 'tabular-nums',
    lineHeight: 1, color, ...style,
  }}>{children}</div>
)

export const Mono = ({ children, size = 13, color = C.muted, style }) => (
  <span style={{ fontSize: size, color, fontFamily: MONO, ...style }}>{children}</span>
)

/* -------------------------------------------------------------- containers */

export const Card = ({ children, edge = C.line, pad = 20, style, ...rest }) => (
  <div style={{
    background: C.surface, border: `1px solid ${edge}`, borderRadius: 16, padding: pad, ...style,
  }} {...rest}>{children}</div>
)

/* ------------------------------------------------------------------ inputs */

export const chipStyle = (active) => (active ? {
  background: C.pink, border: `1px solid ${C.pink}`, color: '#fff',
  fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
} : {
  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: C.muted,
  fontSize: 13, fontWeight: 500, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
})

export const Chip = ({ active, onClick, children, title }) => (
  <button className="cfa-ghost" style={chipStyle(active)} onClick={onClick} title={title}
          aria-pressed={active ? 'true' : 'false'}>{children}</button>
)

export const ghostBtn = {
  background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: C.text,
  fontSize: 13, fontWeight: 500, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
}

export const solidBtn = {
  background: C.pink, border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
  padding: '9px 16px', borderRadius: 999, cursor: 'pointer',
  boxShadow: '0 12px 32px rgba(236,72,153,0.28)',
}

export const fieldStyle = {
  background: C.raised, border: '1px solid rgba(255,255,255,0.12)', color: C.text,
  fontSize: 14, padding: '9px 12px', borderRadius: 12,
}

/* ------------------------------------------------------------------- parts */

export const Dot = ({ color = C.muted, size = 8, pulse = false, style }) => (
  <span style={{
    width: size, height: size, borderRadius: '50%', background: color,
    flex: '0 0 auto', animation: pulse ? 'cfpulse 1.6s infinite' : undefined, ...style,
  }} />
)

/**
 * A bar. Width is clamped, so bad data can never render past its track — and a
 * missing measurement renders as an empty track rather than a full one.
 */
export const Bar = ({ value, of, color = C.pink, height = 6 }) => {
  const w = (value == null || of == null || Number(of) <= 0)
    ? 0 : Math.max(0, Math.min(100, (Number(value) / Number(of)) * 100))
  return (
    <div style={{ height, background: C.track, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 999 }} />
    </div>
  )
}

/** The design's outcome pill vocabulary, kept as its own map so a new outcome
 *  string falls back to grey rather than silently borrowing a colour. */
const PILL = {
  showed:   [C.good, 'rgba(34,197,94,0.14)'],
  attended: [C.good, 'rgba(34,197,94,0.14)'],
  booked:   [C.pinkSoft, 'rgba(236,72,153,0.16)'],
  upcoming: [C.pinkSoft, 'rgba(236,72,153,0.16)'],
  no_show:  [C.bad, 'rgba(239,68,68,0.14)'],
  missed:   [C.bad, 'rgba(239,68,68,0.14)'],
  cancelled:[C.muted, 'rgba(255,255,255,0.06)'],
}

export const Pill = ({ tone, children, style }) => {
  const [fg, bg] = PILL[tone] || [C.muted, 'rgba(255,255,255,0.06)']
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: fg, background: bg, padding: '2px 7px', borderRadius: 999,
      whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  )
}

/* -------------------------------------------------------- the three states */

export const Loading = ({ what = 'loading' }) => (
  <div style={{ fontSize: 14, color: C.dim, padding: '18px 2px' }}>{what}…</div>
)

export const Failed = ({ error, what }) => (
  <div style={{
    fontSize: 14, color: C.badSoft, padding: '14px 16px', lineHeight: 1.5,
    border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', borderRadius: 12,
  }}>Could not load {what}. {error?.message || String(error)}</div>
)

export const Empty = ({ children }) => (
  <div style={{ fontSize: 14, color: C.muted, padding: '14px 2px', lineHeight: 1.5 }}>{children}</div>
)

/**
 * loading ≠ failed ≠ empty, in one place so no page forgets one.
 *
 * The classic view's `<Feed>` rule, restated for this palette: an empty grid and
 * a broken one look identical unless something says which (§7 item 133).
 */
export function Feed({ feed, what, empty, children }) {
  if (feed?.error) return <Failed error={feed.error} what={what} />
  if (feed?.loading && !feed?.data) return <Loading what={what} />
  if (!feed?.data) return <Loading what={what} />
  if (feed.data.found === false && empty) return empty
  return children(feed.data)
}
