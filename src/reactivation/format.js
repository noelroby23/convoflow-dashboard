/**
 * Every number on the reactivation dashboard is printed by one of these.
 *
 * 🔑 A MISSING MEASUREMENT IS AN EM-DASH, NEVER A ZERO.
 *
 * This is CLAUDE.md §7 item 56, and it is the single most load-bearing rule on
 * the page. "0% show rate" on a campaign with zero meetings is a measured claim
 * that nobody measured; "43% of booked meetings showed" on day one is a lie the
 * reader will act on. Every *_pct the database returns is deliberately NULL
 * rather than 0 when its denominator is empty, and that decision only survives
 * if the render layer keeps it.
 *
 * The rule has already been broken once in this app, one layer up: Home showed
 * four green "✓ On track" ticks because `null <= target` is true, so every
 * absent figure passed its target. That is what these functions exist to stop.
 *
 * ⚠️ Do not add a `?? 0` anywhere in this file. That is the bug, spelled out.
 */

export const DUBAI = 'Asia/Dubai'

const missing = (n) => n == null || n === '' || Number.isNaN(Number(n))

/** A count. 1,794 — grouped, never rounded to "1.8k" on a figure people reconcile. */
export const num = (n) =>
  missing(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })

/** A rate. One decimal only when there is one, so columns do not jitter as they tick. */
export const pct = (n) =>
  missing(n) ? '—' : `${Number(n).toFixed(Number(n) % 1 ? 1 : 0)}%`

/** Money, always with its currency — an unlabelled 15,000 is not a number anyone can use. */
export const money = (n, ccy = 'AED') =>
  missing(n) ? '—' : `${ccy} ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

/**
 * The traffic light, defined once so the page and the reader cannot disagree.
 * Green at or ahead of today's pace · yellow within 10% behind · red beyond.
 *
 * Measured against where you should be TODAY, never against the end number —
 * otherwise everything is red until the final week and the colour stops meaning
 * anything at all.
 */
export const toneFor = (actual, due) => {
  if (missing(actual) || missing(due) || Number(due) === 0) return 'na'
  const ratio = Number(actual) / Number(due)
  if (ratio >= 1) return 'good'
  if (ratio >= 0.9) return 'warn'
  return 'bad'
}

/** A signed gap in words: +17 ahead · 244 behind · on target. The sign alone is not read. */
export const gap = (actual, due) => {
  if (missing(actual) || missing(due)) return { text: '—', tone: 'na', delta: null }
  const d = Number(actual) - Number(due)
  if (d === 0) return { text: 'on target', tone: 'good', delta: 0 }
  if (d > 0) return { text: `+${num(d)} ahead`, tone: 'good', delta: d }
  return { text: `${num(Math.abs(d))} behind`, tone: toneFor(actual, due), delta: d }
}

export const TONE_VAR = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', na: 'var(--dim)' }

/** Clamped, so a bar can never render wider than its track or invert on bad data. */
export const widthPct = (part, whole) => {
  if (missing(part) || missing(whole) || Number(whole) <= 0) return 0
  return Math.max(0, Math.min(100, (Number(part) / Number(whole)) * 100))
}

const dtf = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: DUBAI, ...opts })

export const fmtTime = (iso) => (iso ? dtf({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—')
export const fmtDay  = (iso) => (iso ? dtf({ day: 'numeric', month: 'short' }).format(new Date(iso)) : '—')
export const fmtDow  = (iso) => (iso ? dtf({ weekday: 'short' }).format(new Date(iso)) : '—')
export const fmtWhen = (iso) => (iso ? `${fmtDay(iso)} ${fmtTime(iso)}` : '—')

/** mm:ss. A duration is read as clock time, not as "138 seconds". */
export const dur = (secs) => {
  if (missing(secs)) return '—'
  const s = Math.max(0, Math.round(Number(secs)))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "3 days ago" / "in 2 hours" — for waiting times, where the exact stamp is noise. */
export const ago = (iso) => {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.round(Math.abs(ms) / 60000)
  const future = ms < 0
  const say = (n, u) => `${future ? 'in ' : ''}${n} ${u}${n === 1 ? '' : 's'}${future ? '' : ' ago'}`
  if (mins < 1) return future ? 'any moment' : 'just now'
  if (mins < 60) return say(mins, 'min')
  const h = Math.round(mins / 60)
  if (h < 24) return say(h, 'hour')
  return say(Math.round(h / 24), 'day')
}

/** Sentence case for a snake_case key, so a column id can be shown to a human. */
export const humanise = (k) =>
  !k ? '' : String(k).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
