import { num, pct as fmtPct } from '../../format'
import { C, Card, Eyebrow, Num, Bar, Dot, hexFor, Feed, Empty } from '../ui'

/**
 * Overview — the design's verdict-first page.
 *
 * It answers one question at the top in a sentence, then shows the arithmetic
 * behind that sentence underneath. Nothing here is computed: every figure comes
 * from the adapter, which reads `campaignPlan()` — the same function the classic
 * view's Targets tab reads, so the two cannot disagree about "behind plan".
 */

const rateText = (r) => (r == null ? '—' : `${Math.round(r * 100)}%`)

export default function Overview({ m, goTo }) {
  return (
    <Feed feed={m.c.funnel} what="the funnel"
          empty={<div style={{ padding: 24 }}>
            <Empty>No campaign on record for this region. Nothing has been enrolled, so there is
              nothing to measure — this is not a failed load.</Empty>
          </div>}>
      {() => (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Verdict m={m} />
          <Pacing m={m} />
          <Cards m={m} />
          <Funnel m={m} />
          <Counters m={m} goTo={goTo} />
        </div>
      )}
    </Feed>
  )
}

/* ------------------------------------------------------------------ verdict */

/**
 * 🔑 THE TONE IS GREY UNTIL THERE IS SOMETHING TO MEASURE, never green.
 *
 * A campaign with no settled meetings has no show rate, and a green banner
 * saying so reads as "on track" to somebody who glances at colour first — the
 * exact bug that put four green ✓ On track ticks on Home over four missing
 * numbers, because `null <= target` is true (§7 item 178's neighbour).
 */
function Verdict({ m }) {
  const showedActual = m.showed?.actual
  const showedTarget = m.showed?.target
  const enoughToRead = m.liveShow != null && (m.booked?.actual ?? 0) >= 5

  const head = showedActual == null || showedTarget == null
    ? 'No show target on record yet'
    : `${num(showedActual)} of ${num(showedTarget)} showed, ${num(m.showsLeft)} to go` +
      (m.plan.daysLeft != null ? ` with ${num(m.plan.daysLeft)} dialling day${m.plan.daysLeft === 1 ? '' : 's'} left` : '')

  let tone = 'na'
  let line
  if (m.showsLeft === 0) {
    tone = 'good'
    line = 'The campaign target is already met.'
  } else if (!enoughToRead) {
    tone = 'na'
    line = m.planShow
      ? `Not enough settled meetings yet to read a show rate, so the plan still stands at ${rateText(m.planShow)}: ${num(m.booked?.target)} bookings for ${num(showedTarget)} shows.`
      : 'Not enough settled meetings yet to read a show rate.'
  } else if (m.reqBookings != null && m.booked?.target != null && m.reqBookings + (m.booked.actual ?? 0) > m.booked.target) {
    const need = m.reqBookings + (m.booked.actual ?? 0)
    tone = 'bad'
    line = `Show rate is running at ${rateText(m.liveShow)}, not ${rateText(m.planShow)}. You now need ${num(need)} bookings, not ${num(m.booked.target)} — ${num(need - m.booked.target)} more than planned.`
  } else {
    tone = 'good'
    line = `Show rate is holding at ${rateText(m.liveShow)} against the ${rateText(m.planShow)} plan, so ${num(m.booked?.target)} bookings still gets you to ${num(showedTarget)}.`
  }

  const step = m.worst && m.worst.ratio < 0.99
    ? `${m.worst.label} is the step that is off: ${rateText(m.worst.live)} against ${rateText(m.worst.plan)} planned.`
    : m.measured === 0
      ? 'No step has enough volume behind it yet to be called. Every rate on screen is the plan, not performance.'
      : m.measured < m.chainLength
        ? `The ${m.measured === 1 ? 'one step' : `${m.measured} steps`} with enough volume to read ${m.measured === 1 ? 'is' : 'are'} running at or above plan. The rest are still plan figures.`
        : 'Every step in the chain is running at or above plan.'

  const fill = { good: 'rgba(34,197,94,0.10)', warn: 'rgba(245,158,11,0.10)', bad: 'rgba(239,68,68,0.10)', na: 'rgba(255,255,255,0.04)' }
  const edge = { good: 'rgba(34,197,94,0.32)', warn: 'rgba(245,158,11,0.32)', bad: 'rgba(239,68,68,0.32)', na: 'rgba(255,255,255,0.10)' }

  return (
    <div style={{
      padding: '26px 28px', borderRadius: 18,
      background: fill[tone], border: `1px solid ${edge[tone]}`,
    }}>
      <div style={{
        fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1,
        color: tone === 'na' ? C.text : hexFor(tone), textWrap: 'pretty',
      }}>{head}</div>
      <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.5, marginTop: 10, color: C.text, textWrap: 'pretty' }}>{line}</div>
      <div style={{ fontSize: 15, lineHeight: 1.5, marginTop: 8, color: C.muted, textWrap: 'pretty' }}>{step}</div>
    </div>
  )
}

/* ------------------------------------------------------------------- pacing */

function Pacing({ m }) {
  const { plan } = m
  const left = plan.daysLeft && plan.daysLeft > 0 ? plan.daysLeft : null

  const perDay = (v) => (v == null || !left ? null : Math.ceil(v / left))
  const showsPerDay = m.showsLeft != null && left ? Math.round((m.showsLeft / left) * 10) / 10 : null

  const dialsDue = m.dialled?.due
  const dialsActual = m.dialled?.actual

  const items = [
    {
      label: 'Dialling day',
      value: plan.dayOf != null && plan.lengthDays != null ? `${plan.dayOf} of ${plan.lengthDays}` : '—',
      color: C.text,
    },
    {
      label: 'People dialled',
      value: dialsActual == null ? '—'
        : `${num(dialsActual)}${dialsDue != null ? ` of ${num(dialsDue)} due by now` : ''}`,
      color: dialsDue == null ? C.text : (dialsActual >= dialsDue ? C.good : C.bad),
    },
    {
      label: 'From here, per day',
      value: [
        perDay(m.reqDials) != null ? `${num(perDay(m.reqDials))} dialled` : null,
        perDay(m.reqTalks) != null ? `${num(perDay(m.reqTalks))} conversations` : null,
        perDay(m.reqBookings) != null ? `${num(perDay(m.reqBookings))} bookings` : null,
        showsPerDay != null ? `${showsPerDay} shows` : null,
      ].filter(Boolean).join(' · ') || 'not enough measured rates to say yet',
      color: C.pinkSoft,
    },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
      padding: '14px 18px', border: `1px solid ${C.line}`, borderRadius: 14, background: C.surface,
    }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <Eyebrow color={C.dim}>{it.label}</Eyebrow>
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: it.color }}>{it.value}</span>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------- cards */

function Cards({ m }) {
  const showTone = m.showed?.tone || 'na'
  const showHex = hexFor(showTone)

  const small = [
    { row: m.dialled, label: 'Dialled' },
    { row: m.talked, label: 'Conversations' },
    { row: m.booked, label: 'Bookings' },
  ]

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
      {/* the one number the campaign is judged on */}
      <div style={{
        flex: '1.4 1 340px', background: C.surface, border: '1px solid rgba(236,72,153,0.4)',
        borderRadius: 18, padding: 26, boxShadow: '0 18px 44px rgba(236,72,153,0.10)',
      }}>
        <Eyebrow color={C.pinkSoft} size={13} style={{ letterSpacing: '0.1em' }}>Meetings showed · the target</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
          <Num size={86} color={showHex}>{num(m.showed?.actual)}</Num>
          <span className="mono" style={{ fontSize: 19, color: C.muted }}>
            of {num(m.showed?.due)} by now, {num(m.showed?.target)} in the campaign
          </span>
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 10, textWrap: 'pretty' }}>
          Show rate {rateText(m.liveShow)} against {rateText(m.planShow)} planned
        </div>
        <div style={{ marginTop: 14 }}><Bar value={m.showed?.actual} of={m.showed?.due} color={showHex} height={10} /></div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.pinkSoft, marginTop: 12, textWrap: 'pretty' }}>
          {m.showsLeft === 0 ? 'Target met.'
            : m.reqBookings != null
              ? `Still needed: ${num(m.reqBookings)} more bookings, ${num(m.reqTalks)} more conversations, ${num(m.reqDials)} more people dialled`
              : 'Not enough measured rates yet to say what is still needed.'}
        </div>
      </div>

      <div style={{
        flex: '2.2 1 520px', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16,
      }}>
        {small.map(({ row, label }) => {
          const hex = hexFor(row?.tone || 'na')
          return (
            <Card key={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Eyebrow size={12} style={{ letterSpacing: '0.1em', fontWeight: 600 }}>{label}</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <Num size={38} color={hex}>{num(row?.actual)}</Num>
                <span className="mono" style={{ fontSize: 14, color: C.muted }}>of {num(row?.due)}</span>
              </div>
              <Bar value={row?.actual} of={row?.due} color={hex} />
              <span className="mono" style={{ fontSize: 12, color: C.dim }}>
                {num(row?.target)} in the campaign
                {row?.needPerDay != null && m.plan.daysLeft ? ` · ${num(row.needPerDay)} a day from here` : ''}
              </span>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- funnel */

function Funnel({ m }) {
  return (
    <Card pad={24}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Funnel</div>
        <div style={{ fontSize: 13, color: C.muted }}>
          Each figure counts PEOPLE, and the percentage between two steps is how many of the step
          before reached the next one.
        </div>
      </div>

      <div style={{ marginTop: 18, overflowX: 'auto', paddingBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 900 }}>
          {m.steps.map((s, i) => (
            <div key={s.metric} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              {i > 0 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '0 8px', whiteSpace: 'nowrap',
                }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: hexFor(s.convTone) }}>
                    {s.conv == null ? '·' : `${Math.round(s.conv * 100)}%`}
                  </span>
                  {s.convPlan != null && (
                    <span style={{ fontSize: 10, color: C.dim }}>plan {Math.round(s.convPlan * 100)}%</span>
                  )}
                </div>
              )}
              <div title={s.def} style={{
                flex: 1, border: `1px solid ${C.lineSoft}`, borderRadius: 12, padding: 14,
                display: 'flex', flexDirection: 'column', gap: 5, cursor: 'help',
              }}>
                <Eyebrow size={12} style={{ letterSpacing: '0.06em', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</Eyebrow>
                <Num size={s.metric === 'Showed' ? 32 : 28} color={s.metric === 'Showed' ? C.pinkSoft : C.text}>
                  {num(s.actual)}
                </Num>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ----------------------------------------------------------------- counters */

function Counters({ m, goTo }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
      {m.counters.map((k) => (
        <button
          key={k.key} onClick={() => goTo(k.page)}
          style={{
            display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', textAlign: 'left',
            background: C.surface, border: `1px solid ${k.hot ? 'rgba(239,68,68,0.4)' : C.line}`,
            borderRadius: 16, padding: 18, cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Eyebrow size={12} style={{ fontWeight: 600 }}>{k.label}</Eyebrow>
            {k.live && <Dot color={C.pink} size={7} pulse />}
          </div>
          <Num size={34} color={k.hot ? C.badSoft : C.text}>{num(k.count)}</Num>
          <div style={{ fontSize: 12, color: C.muted }}>{k.go}</div>
        </button>
      ))}
    </div>
  )
}
