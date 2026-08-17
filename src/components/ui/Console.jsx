import { useEffect, useRef, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

/**
 * The Home console — dark, glass, mission-control.
 *
 * The brief asked for a "liquid pipeline" instead of cards, and that turns out
 * to be the honest shape for this page: Home's twelve numbers are five stages
 * and the ratios between them. Spend buys leads, leads become meetings,
 * meetings become shows, shows become customers. Every card on the old page was
 * one of those five, or one of the four ratios, cut apart and laid in a grid.
 *
 * 🔑 THE CONNECTORS CARRY THE CONVERSION. Same idea as the Lead Desk funnel:
 * the number between two nodes is what got through, so a leak is a shape rather
 * than a division the reader performs. It is the one loud thing; the nodes stay
 * quiet.
 *
 * Motion is CSS, deliberately — the project has no animation library and adding
 * one for a single page means two systems to keep in step (§7 item 127's lesson
 * applied before it bites). Everything here respects prefers-reduced-motion.
 */

const AED = (n, dp = 0) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

function useCountUp(value, ms = 800) {
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
      setShown(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [value, ms])
  return shown
}

/** Change against the previous window of equal length. Null when there is
 *  nothing to compare to — a delta from zero is not a percentage. */
export function Delta({ now, before, invert = false, suffix = '' }) {
  if (now == null || before == null) return null
  const n = Number(now), b = Number(before)
  if (!Number.isFinite(n) || !Number.isFinite(b)) return null
  if (b === 0) {
    if (n === 0) return <span className="cf-delta cf-delta--flat">no change</span>
    // Nothing last period, something this one. A glowing badge says that
    // better than the word "new" repeated down the row.
    return <span className="cf-badge-live"><i />active{suffix}</span>
  }
  const pct = Math.round(((n - b) / Math.abs(b)) * 100)
  if (pct === 0) return <span className="cf-delta cf-delta--flat">flat</span>
  const good = invert ? pct < 0 : pct > 0
  return (
    <span className={`cf-delta ${good ? 'cf-delta--up' : 'cf-delta--down'}`}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}%{suffix}
    </span>
  )
}

function Node({ label, value, prefix, delta, tone, note, big, onClick, title }) {
  const shown = useCountUp(value)
  const text = shown == null ? '—'
    : big ? AED(Math.round(shown))
    : AED(shown, Number.isInteger(Number(value)) ? 0 : 0)
  const As = onClick ? 'button' : 'div'
  return (
    <As className={`cf-node group${onClick ? ' cf-node--click' : ''}`}
        onClick={onClick} title={title} type={onClick ? 'button' : undefined}>
      <div className="cf-node__label">
        <span className="cf-node__dot" style={{ background: tone }} />
        {label}
        {/* The unit belongs with the label. Inline before the digits it ate
            enough width to truncate AED 1,710 to "1,7…" in a fifth-width node. */}
        {prefix && <span className="cf-node__unit">{prefix}</span>}
      </div>
      <div className="cf-node__value">{text}</div>
      <div className="cf-node__foot">
        {delta}
        {note && <span className="cf-node__note">{note}</span>}
      </div>
    </As>
  )
}

/** The connector. `pct` is the conversion; the bar is filled to it. */
function Link({ pct, caption, tone }) {
  const [lit, setLit] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLit(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const filled = pct == null ? 0 : Math.max(2, Math.min(100, pct))
  return (
    <div className="cf-link">
      <div className="cf-link__track">
        <i style={{ '--p': lit ? `${filled}%` : '0%', background: tone }} />
      </div>
      <div className="cf-link__label" style={{ color: pct == null ? undefined : tone }}>
        {pct == null ? '—' : `${pct}%`}
        <span> {caption}</span>
      </div>
    </div>
  )
}

const GOOD = '#10B981'
const WARN = '#F59E0B'
const BAD = '#F43F5E'
const BRAND = '#EC4899'
const COOL = '#60A5FA'

const band = (pct, hi, mid) => (pct == null ? undefined : pct >= hi ? GOOD : pct >= mid ? WARN : BAD)

export function PipelineFlow({ kpis, growth, onShowLeads }) {
  const prev = growth?.previous
  const spend = kpis?.total_spend
  const leads = kpis?.total_leads
  const meetings = kpis?.meetings_booked
  const shows = kpis?.showed_up
  const won = kpis?.closed_won

  // cf.appointment only goes back to the day v2 booked its first meeting.
  // A window before that has no record, which is a different statement from
  // "nobody booked" — so the node says which, rather than showing a bare dash.
  const noRecords = meetings == null && kpis?.meetings_from
  const sinceLabel = kpis?.meetings_from
    ? new Date(kpis.meetings_from + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''

  const rate = (a, b) => (b ? Math.round((Number(a) / Number(b)) * 100) : null)
  const bookRate = rate(meetings, leads)
  const showRate = kpis?.show_rate == null ? null : Math.round(Number(kpis.show_rate))
  const closeRate = rate(won, shows)

  return (
    <section className="cf-pipe" aria-label="Pipeline">
      <Node label="Spend" prefix="AED" value={spend} big tone={BRAND}
            delta={<Delta now={spend} before={prev?.spend} invert />} />
      <Link pct={null} caption="bought" tone="rgba(255,255,255,.14)" />

      <Node label="Leads" value={leads} tone={COOL}
            onClick={onShowLeads}
            title="Show every one of these leads"
            delta={<Delta now={leads} before={prev?.leads} />}
            note={kpis?.attributed_leads != null
              ? `${kpis.attributed_leads} from ads · ${Math.max(0, Number(leads ?? 0) - Number(kpis.attributed_leads))} not`
              : null} />
      <Link pct={bookRate} caption="booked" tone={band(bookRate, 20, 10)} />

      <Node label="Meetings" value={meetings} tone={BRAND}
            delta={meetings == null ? null : <Delta now={meetings} before={prev?.meetings} />}
            note={noRecords ? `records start ${sinceLabel}` : null} />
      <Link pct={showRate} caption="showed" tone={band(showRate, 75, 50)} />

      <Node label="Showed up" value={shows} tone={GOOD}
            delta={null}
            note={noRecords ? `records start ${sinceLabel}`
                  : kpis?.no_shows ? `${kpis.no_shows} no-show` : 'no no-shows yet'} />
      <Link pct={closeRate} caption="closed" tone={band(closeRate, 25, 10)} />

      <Node label="Won" value={won} tone={GOOD}
            delta={<Delta now={won} before={prev?.won} />}
            note={kpis?.closed_revenue ? `AED ${AED(kpis.closed_revenue)}` : null} />
    </section>
  )
}

/**
 * A radial gauge. `pct` is progress toward the target, already normalised so
 * that 100 always means "at target" whether the metric should be high (win
 * rate) or low (cost per lead).
 */
export function Gauge({ label, display, pct, tone, hint, footnote }) {
  const [lit, setLit] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLit(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const R = 52, C = 2 * Math.PI * R
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  // Only the reading goes inside the ring. The label used to sit in there too
  // and "COST / CUSTOMER" is wider than a 128px circle, so it ran out over the
  // stroke on three of the five dials.
  const long = String(display).length >= 5
  return (
    <div className="cf-gauge" title={hint}>
      <svg viewBox="0 0 128 128" className="cf-gauge__svg" aria-hidden="true">
        <circle cx="64" cy="64" r={R} className="cf-gauge__track" />
        <circle
          cx="64" cy="64" r={R} className="cf-gauge__fill"
          stroke={tone}
          strokeDasharray={C}
          strokeDashoffset={lit ? C - (C * p) / 100 : C}
        />
      </svg>
      <div className="cf-gauge__mid">
        <div className={`cf-gauge__value${long ? ' is-long' : ''}`}>{display}</div>
      </div>
      <div className="cf-gauge__label">{label}</div>
      {footnote && <div className="cf-gauge__foot">{footnote}</div>}
    </div>
  )
}

/** Growth over the window, against the previous window of equal length. */
export function GrowthChart({ growth, metric, onMetric }) {
  const series = (growth?.series ?? []).map(d => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    spend: Number(d.spend), leads: Number(d.leads), meetings: Number(d.meetings),
  }))

  const METRICS = [
    { key: 'leads', label: 'Leads', tone: COOL },
    { key: 'spend', label: 'Spend', tone: BRAND },
    { key: 'meetings', label: 'Meetings', tone: GOOD },
  ]
  const active = METRICS.find(m => m.key === metric) ?? METRICS[0]

  if (!series.length) {
    return <p className="cf-empty">No days in this range.</p>
  }

  return (
    <div className="cf-chart">
      <div className="cf-chart__head">
        <div>
          <div className="cf-eyebrow">Growth</div>
          <h3 className="cf-chart__title">{active.label} per day</h3>
        </div>
        <div className="cf-seg">
          {METRICS.map(m => (
            <button key={m.key} onClick={() => onMetric(m.key)}
                    className={m.key === metric ? 'is-on' : ''}>{m.label}</button>
          ))}
        </div>
      </div>
      <div className="cf-chart__body">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="cfArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={active.tone} stopOpacity={0.42} />
                <stop offset="100%" stopColor={active.tone} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8A8781', fontSize: 11 }}
                   axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={{ fill: '#8A8781', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,.18)' }}
              contentStyle={{
                background: 'rgba(18,18,22,.94)', border: '1px solid rgba(255,255,255,.12)',
                borderRadius: 12, color: '#FAFAF9', fontSize: 12,
              }}
              labelStyle={{ color: '#8A8781' }}
              formatter={(v) => [active.key === 'spend' ? `AED ${AED(v, 2)}` : v, active.label]}
            />
            <Area type="monotone" dataKey={active.key} stroke={active.tone} strokeWidth={2}
                  fill="url(#cfArea)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={!reduceMotion()} animationDuration={700} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="cf-chart__foot">
        Compared with {growth?.prev_from} → {growth?.prev_to}, the {growth?.days} days before this range.
      </div>
    </div>
  )
}

export function Panel({ title, eyebrow, right, children, glow }) {
  return (
    <section className={`cf-panel${glow ? ' cf-panel--glow' : ''}`}>
      {(title || right) && (
        <header className="cf-panel__head">
          <div>
            {eyebrow && <div className="cf-eyebrow">{eyebrow}</div>}
            {title && <h3 className="cf-panel__title">{title}</h3>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}
