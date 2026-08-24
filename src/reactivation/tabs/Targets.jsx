import { useCampaign } from '../useCampaign'
import { num, pct, money, gap, toneFor, TONE_VAR, widthPct } from '../format'
import { Feed, Empty, Handoff } from '../bits'

/**
 * Targets — "how far am I from what I set".
 *
 * 🔑 THE ONE IDEA: EVERY COMPARISON IS AGAINST WHERE YOU SHOULD BE **TODAY**,
 * never against the end number. Measured against the finish line, a campaign is
 * red on every metric until its final week, at which point the colour has
 * stopped carrying information and people stop reading it. The rule is printed
 * on the page, in words, so nobody has to take it on trust — green at or ahead
 * of today's pace, yellow within 10% behind, red beyond. That is `toneFor` in
 * format.js and it is defined exactly once.
 *
 * ⚠️ THIS FILE OWNS THE PACING MATH FOR BOTH TABS. `campaignPlan()` is exported
 * and the Overview traffic-light strip, its pace track and its funnel plan-lines
 * all read it. That is deliberate, and it is CONTRACT.md rule 1: the day the
 * Overview strip and this page each work out "where you should be today" on
 * their own is the day one says 244 behind and the other says on target, and a
 * reader has no way to tell which lied. Three pages of this app once gave three
 * different answers for "meetings booked" for precisely this reason.
 */

/**
 * The plain-English vocabulary for the seven target rows.
 *
 * `cf.campaign_target.metric` is the database's own wording and it stays in the
 * database (CONTRACT rule 7). Note "Leads dialled" becomes **Leads called**:
 * the row counts PEOPLE worked through, not calls placed, and the two differ by
 * roughly 4x because the ladder dials each lead up to four times. Labelling it
 * "calls" would put a number on screen that disagrees with the scoreboard's
 * Total calls tile by a factor of four, with nothing to explain the gap.
 */
export const METRIC = {
  'Leads dialled': {
    label: 'Leads called', short: 'Leads called', owner: 'Sarah',
    unit: 'people called at least once', stage: 'called at least once', fmt: num,
  },
  'Reached': {
    label: 'People who picked up', short: 'Pick-ups', owner: 'Sarah',
    unit: 'picked up', stage: 'a human answered', fmt: num,
  },
  'Real conversations': {
    label: 'Real conversations', short: 'Conversations', owner: 'Sarah',
    unit: 'real conversations', stage: 'got past a brush-off', fmt: num,
  },
  'Meetings booked': {
    label: 'Meetings booked', short: 'Meetings booked', owner: 'Sarah',
    unit: 'meetings booked', stage: '', fmt: num,
  },
  'Showed': {
    label: 'Turned up to the meeting', short: 'Turned up', owner: 'Sarah · her finish line',
    unit: 'turned up', stage: '', fmt: num,
  },
  'Closed': {
    label: 'Deals signed', short: 'Signed', owner: 'Ron',
    unit: 'clients signed', stage: '', fmt: num,
  },
  'MRR added (AED)': {
    label: 'New monthly revenue signed', short: 'Revenue', owner: 'Ron',
    unit: 'AED a month', stage: '', fmt: money,
  },
}

/** Sarah's work ends when somebody turns up. Everything after is Ron's. */
export const SARAH_METRICS = ['Leads dialled', 'Reached', 'Real conversations', 'Meetings booked', 'Showed']
export const RON_METRICS = ['MRR added (AED)', 'Closed']

/**
 * The gap in words, in the ROW'S OWN UNIT.
 *
 * `format.gap()` is shared and always counts, which is right for five of the
 * seven rows and wrong for revenue: "1,000 behind" on a money row is a number
 * with no currency, and an unlabelled 15,000 is not a figure anybody can use.
 * The sign is carried by the word rather than a symbol, so it reads as a
 * sentence — "AED 1,000 behind".
 */
export function gapText(row, unit) {
  const d = row?.gap?.delta
  if (d == null) return '—'
  if (d === 0) return 'on target'
  const n = `${row.meta.fmt(Math.abs(d))}${unit ? ` ${unit}` : ''}`
  return d > 0 ? `${n} ahead` : `${n} behind`
}

const toneClass = { good: 'g', warn: 'y', bad: 'r', na: '' }
const gapClass = { good: 'gap-g', warn: 'gap-y', bad: 'gap-r', na: '' }
const lightClass = { good: 'dot-g', warn: 'dot-y', bad: 'dot-r', na: '' }

/**
 * HOW LONG THE CAMPAIGN IS, DERIVED ONCE.
 *
 * There is no planned-length column on `cf.campaign` and no end date — so "day
 * 9 of 24" cannot simply be read. It is computed from three figures that ARE
 * config, and it comes out at the plan's own number:
 *
 *   leads a day = the steady dial cap ÷ how many times the ladder dials a lead
 *               = 300 ÷ 4 = 75
 *   length      = the whole list ÷ 75 = 2,706 ÷ 75 = 36 working days
 *
 * ⚠️ Every input is read from the feeds, never typed in. The ladder length is
 * `overview.ladder`, so adding a fifth attempt lengthens the campaign here
 * automatically instead of leaving a literal 4 to rot in a component.
 *
 * 📌 It is deliberately linear and ignores the 3-day ramp from 150 to 300. The
 * ramp moves the finish by about a day and a half on a 36-day campaign; a pace
 * line nobody can reproduce in their head is worse than one that is a day out.
 */
export function campaignPlan(c) {
  const ov = c.overview.data
  const rows = c.funnel.data?.rows || []

  const callsPerLead = Array.isArray(ov?.ladder) && ov.ladder.length ? ov.ladder.length : null
  const capSteady = ov?.dial_cap_steady ?? null
  const leadsPerDay = capSteady != null && callsPerLead ? capSteady / callsPerLead : null

  const leadRow = rows.find((r) => r.metric === 'Leads dialled')
  const planList = leadRow?.target != null ? Number(leadRow.target) : null

  const lengthDays = leadsPerDay && planList ? Math.ceil(planList / leadsPerDay) : null
  const dayOf = c.derived.dayOf
  const daysLeft = lengthDays != null && dayOf != null ? Math.max(0, lengthDays - dayOf) : null

  // How much of the campaign has gone. NULL before it starts — 0% would say it
  // began this morning, and it has not begun at all.
  const elapsed = dayOf != null && lengthDays ? Math.min(1, dayOf / lengthDays) : null

  const enrich = (r) => {
    const meta = METRIC[r.metric] || { label: r.metric, short: r.metric, owner: '', unit: '', fmt: num }
    const actual = r.actual == null ? null : Number(r.actual)
    const target = r.target == null ? null : Number(r.target)
    const due = elapsed != null && target != null ? Math.round(target * elapsed) : null
    const tone = toneFor(actual, due)
    const g = gap(actual, due)
    // Shortfall as a share of where you should be, which is what "10% behind"
    // in the rule above actually means.
    const shortPct = due && actual != null && due > 0 ? Math.round((1 - actual / due) * 100) : null
    // The run-rate that closes it, and the run-rate she is on.
    const needPerDay = target != null && actual != null && daysLeft
      ? Math.ceil(Math.max(0, target - actual) / daysLeft) : null
    const ratePerDay = actual != null && dayOf ? actual / dayOf : null
    const projected = ratePerDay != null && lengthDays ? Math.round(ratePerDay * lengthDays) : null
    return {
      ...r, key: r.metric, meta, actual, due, target,
      conservative: r.conservative == null ? null : Number(r.conservative),
      stretch: r.stretch == null ? null : Number(r.stretch),
      tone, gap: g, shortPct, needPerDay, ratePerDay, projected,
    }
  }

  const enriched = rows.map(enrich)
  const byMetric = Object.fromEntries(enriched.map((r) => [r.metric, r]))

  return {
    lengthDays, dayOf, daysLeft, elapsed, leadsPerDay, callsPerLead, planList,
    started: dayOf != null,
    rows: enriched,
    byMetric,
    sarah: SARAH_METRICS.map((m) => byMetric[m]).filter(Boolean),
    ron: RON_METRICS.map((m) => byMetric[m]).filter(Boolean),
  }
}

/**
 * IS THIS ROW ONLY BEHIND BECAUSE THE ROW ABOVE IT IS?
 *
 * Pick-ups is the case the walkthrough calls out by name. If she has dialled
 * 80% of the leads she should have, she will have roughly 80% of the pick-ups —
 * and flagging that as its own problem sends somebody off to fix a pick-up rate
 * that is working perfectly.
 *
 * The test is the RATE, not the count: is she converting the stage above at or
 * above the rate the plan assumes? If she is, the shortfall is inherited and
 * there is nothing here to fix.
 *
 * ⚠️ The colour does NOT get softened when this is true. The rule printed at the
 * top of the page says red is more than 10% behind, and quietly exempting a row
 * from a rule the page states is how a dashboard stops being believed. The
 * colour stays honest and the words explain it.
 */
function inheritedShortfall(row, above) {
  if (!row || !above) return null
  if (row.tone === 'good' || row.tone === 'na') return null
  if (above.tone === 'good' || above.tone === 'na') return null
  if (!row.target || !above.target || !above.actual || row.actual == null) return null
  const planRate = row.target / above.target
  const realRate = row.actual / above.actual
  if (realRate < planRate * 0.95) return null
  return { planRate: planRate * 100, realRate: realRate * 100, above }
}

/** The verdict sentence: "Two red, one yellow, two green." */
function verdictWords(rows) {
  const n = { bad: 0, warn: 0, good: 0, na: 0 }
  rows.forEach((r) => { n[r.tone] = (n[r.tone] || 0) + 1 })
  const say = (k, word) => (n[k] ? `${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][n[k]] || n[k]} ${word}` : null)
  const parts = [say('bad', 'red'), say('warn', 'yellow'), say('good', 'green')].filter(Boolean)
  if (!parts.length) return 'Nothing measured yet'
  return parts.join(', ').replace(/^(\w)/, (m) => m.toUpperCase())
}

/** The bar: fill to actual, a white line at today's pace, ticks for the plan's own figures. */
function TargetBar({ row }) {
  const of = row.target
  const fill = widthPct(row.actual, of)
  const today = row.due != null ? widthPct(row.due, of) : null
  const cons = row.conservative != null && row.conservative !== row.target
    ? widthPct(row.conservative, of) : null
  return (
    <div className="tbar">
      <div className="fill" style={{ width: `${fill}%` }}>
        {fill > 14 && <span className="now-val">{row.meta.fmt(row.actual)}</span>}
      </div>
      {today != null && (
        <div className="today" style={{ left: `${today}%` }}><span>should be here</span></div>
      )}
      {cons != null && (
        <div className="tick" style={{ left: `${cons}%` }}>
          <span>conservative · {row.meta.fmt(row.conservative)}</span>
        </div>
      )}
      {of != null && (
        <div className="tick" style={{ left: '100%' }}><span>target · {row.meta.fmt(of)}</span></div>
      )}
    </div>
  )
}

function TargetCard({ row, plan, above, extraLegend }) {
  const t = row.tone
  const inherited = inheritedShortfall(row, above)

  const verdict = !plan.started
    ? 'not started'
    : row.due == null ? 'no pace line yet'
      : row.gap.delta === 0 ? 'on target'
        : row.gap.delta > 0 ? gapText(row)
          : inherited ? `${gapText(row)} · nothing to fix here`
            : `${gapText(row)}${row.shortPct != null ? ` · ${row.shortPct}% short` : ''}`

  return (
    <div className={`tgt ${toneClass[t]}`} style={{ '--lt': TONE_VAR[t] }}>
      <div className="tgt-top">
        <div className="tgt-name">
          <i />
          <div>
            <h3>{row.meta.label}</h3>
            <div className="own">{row.meta.owner}</div>
          </div>
        </div>
        <span
          className="tgt-verdict"
          style={t === 'na' ? { background: 'var(--raised)', color: 'var(--dim)' } : undefined}
        >
          {verdict}
        </span>
      </div>

      <div className="tgt-nums">
        <div className="c">
          <span className="k">Where you are</span>
          <div className="n">{row.meta.fmt(row.actual)}</div>
          <div className="s">{row.meta.unit}</div>
        </div>
        <div className="c">
          <span className="k">Should be today</span>
          <div className="n" style={{ color: 'var(--muted)' }}>{row.meta.fmt(row.due)}</div>
          <div className="s">{plan.started ? 'to be on pace' : 'once it starts'}</div>
        </div>
        <div className="c">
          <span className="k">Gap</span>
          <div className={`n ${gapClass[t]}`}>
            {row.gap.delta == null ? '—'
              : row.gap.delta === 0 ? row.meta.fmt(0)
                : `${row.gap.delta > 0 ? '+' : '−'}${row.meta.fmt(Math.abs(row.gap.delta))}`}
          </div>
          <div className="s">
            {row.gap.delta == null ? 'nothing to compare yet'
              : row.gap.delta === 0 ? 'on pace'
                : row.shortPct != null && row.shortPct > 0 ? `${row.shortPct}% short`
                  : 'ahead of pace'}
          </div>
        </div>
        <div className="c">
          <span className="k">Full target</span>
          <div className="n" style={{ color: 'var(--muted)' }}>{row.meta.fmt(row.target)}</div>
          <div className="s">
            {plan.lengthDays ? `over ${plan.lengthDays} working days` : 'for the whole campaign'}
          </div>
        </div>
      </div>

      <TargetBar row={row} />

      <p className="tbar-legend">
        {extraLegend}
        {inherited && (
          <>
            {extraLegend ? ' ' : ''}
            Her rate into this stage is <b>{pct(inherited.realRate)}</b>, against the{' '}
            {pct(inherited.planRate)} the plan assumes. The shortfall is entirely because{' '}
            {inherited.above.meta.label.toLowerCase()} is behind.
          </>
        )}
        {!extraLegend && !inherited && plan.started && row.projected != null && row.target != null && (
          <>At the rate she is going she finishes on <b>{row.meta.fmt(row.projected)}</b>, against a target of {row.meta.fmt(row.target)}.</>
        )}
        {!extraLegend && !inherited && !plan.started && (
          <>Nothing has been dialled yet, so there is no rate to project from.</>
        )}
      </p>

      <div className="tgt-action">
        <span className="lbl">{row.tone === 'good' ? 'Worth knowing' : 'To catch up'}</span>
        <p>
          {!plan.started ? (
            <>The campaign has not started, so there is nothing to catch up on. This target becomes live the day it is switched on.</>
          ) : inherited ? (
            <><b>Nothing to fix here.</b> Fix the call volume above and this fixes itself.</>
          ) : row.tone === 'good' ? (
            <>Ahead of pace. <b>Nothing to do here.</b></>
          ) : row.needPerDay != null && plan.daysLeft ? (
            <>
              She needs <b>{row.meta.fmt(row.needPerDay)}</b> a day for the remaining {num(plan.daysLeft)} days.
              {row.ratePerDay != null && <> She is averaging <b>{row.meta.fmt(Math.round(row.ratePerDay))}</b>.</>}
            </>
          ) : (
            <>No days left in the plan to catch up in. This one is decided.</>
          )}
        </p>
      </div>
    </div>
  )
}

export default function Targets({ goTo }) {
  const c = useCampaign()

  return (
    <Feed
      feed={c.funnel}
      what="your targets"
      empty={<Empty title="No targets set">The plan's figures live on the Setup tab. Nothing to measure against until they are in.</Empty>}
    >
      {() => {
        const plan = campaignPlan(c)
        const sarah = plan.sarah
        const ron = plan.ron
        const eligible = c.derived.eligible

        if (!sarah.length) {
          return <Empty title="No targets set">The plan's figures live on the Setup tab.</Empty>
        }

        return (
          <>
            <p className="eyebrow">
              {plan.started
                ? `Day ${num(plan.dayOf)}${plan.lengthDays ? ` of ${num(plan.lengthDays)}` : ''}${plan.elapsed != null ? ` · ${Math.round(plan.elapsed * 100)}% of the campaign gone` : ''}`
                : 'Not started yet'}
            </p>
            <h2 className="sec-title" style={{ fontSize: 22 }}>How far you are from your targets</h2>
            <p className="sec-sub">
              Green means you are at or ahead of where you should be today. Yellow is within 10% behind.
              Red is more than 10% behind.{' '}
              {plan.started
                ? `Measured against day ${num(plan.dayOf)} of ${num(plan.lengthDays)}, not the end number.`
                : 'Nothing is measured against anything until the campaign is switched on.'}
            </p>

            <div className="verdict-card" style={{ marginTop: 18 }}>
              <div className="lights">
                {sarah.map((r) => (
                  <i
                    key={r.key}
                    className={lightClass[r.tone]}
                    style={r.tone === 'na' ? { background: 'var(--hairline)' } : undefined}
                    title={r.meta.label}
                  />
                ))}
              </div>
              <div>
                <h2>{plan.started ? verdictWords(sarah) : 'Nothing to judge yet'}</h2>
                <p>
                  {plan.started ? (
                    <>
                      {sarah.filter((r) => r.tone === 'bad').length === 0
                        ? <>Nothing is more than 10% behind today's pace.</>
                        : <>Behind on <b>{sarah.filter((r) => r.tone === 'bad').map((r) => r.meta.label.toLowerCase()).join(', ')}</b>.</>}
                      {' '}Five targets are Sarah's, up to the moment somebody turns up to a meeting.
                      Everything past that is Ron's and sits below the divider.
                    </>
                  ) : (
                    <>
                      The campaign is set up and switched off. Its {num(sarah.length)} targets are in and the pace
                      line starts moving the day it runs — until then every gap on this page is genuinely
                      unknown rather than zero.
                    </>
                  )}
                </p>
              </div>
            </div>

            {sarah.map((row, i) => (
              <TargetCard
                key={row.key}
                row={row}
                plan={plan}
                above={i > 0 ? sarah[i - 1] : null}
                extraLegend={
                  row.key === 'Leads dialled' && eligible != null && row.target != null && eligible !== row.target ? (
                    <>
                      Your plan lists <b>{num(row.target)}</b> people. <b>{num(eligible)}</b> of them can
                      actually be called today — the rest are excluded because they said no, are on do not
                      disturb, already bought, or are in another flow. That difference is a ceiling on this
                      target, not a shortfall in her work.
                    </>
                  ) : row.key === 'Showed' && plan.byMetric['Meetings booked'] ? (
                    <>
                      This is the number that turns booked meetings into money, and it is the one Sarah is
                      judged on last. Booking more meetings does not move it — getting the booked ones to
                      turn up does.
                    </>
                  ) : null
                }
              />
            ))}

            {ron.length > 0 && (
              <section className="sec">
                <Handoff label="Past the handoff · Ron's numbers, not Sarah's" />
                {ron.map((row) => (
                  <TargetCard key={row.key} row={row} plan={plan} above={null} extraLegend={
                    <>Sarah's work is done before this number exists. It is here so the campaign can be
                      judged on money, not on activity.</>
                  } />
                ))}
              </section>
            )}

            <p style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 22 }}>
              Targets are set on the Setup tab. Conservative and target come from your plan; the "should be
              today" line moves every day and is worked out from the daily call limit
              {plan.leadsPerDay ? ` — ${num(plan.leadsPerDay)} people a day` : ''}
              {plan.lengthDays ? `, which is ${num(plan.lengthDays)} working days for the whole list` : ''}.
              {' '}<button className="chip" style={{ marginLeft: 6 }} onClick={() => goTo && goTo('overview')}>Back to overview</button>
            </p>
          </>
        )
      }}
    </Feed>
  )
}
