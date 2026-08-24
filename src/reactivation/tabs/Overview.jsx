import { useCampaign } from '../useCampaign'
import { num, pct, money, TONE_VAR, widthPct, fmtDay } from '../format'
import { Feed, Empty, Handoff, LiveDot } from '../bits'
import { campaignPlan, gapText } from './Targets'

/**
 * Overview — the landing tab. "How is it going", in about eight seconds.
 *
 * 🔑 THE SCOREBOARD AND THE TRAFFIC-LIGHT STRIP SHOW THE SAME FIVE METRICS ON
 * PURPOSE. The scoreboard is WHAT HAPPENED; the strip is WHETHER THAT IS GOOD.
 * They are different questions and the design keeps them apart deliberately —
 * a reader who wants the count should not have to decode a colour, and a reader
 * who wants the verdict should not have to do arithmetic.
 *
 * ⚠️ EVERY PACE FIGURE ON THIS PAGE COMES FROM `campaignPlan()` IN Targets.jsx.
 * Not one of them is worked out here. The strip and the Targets tab must never
 * be able to disagree about "244 behind" — that is CONTRACT rule 1, and it is
 * the fault this app has already shipped twice (three pages, three answers for
 * "meetings booked"; Home dividing spend by a lead count its neighbour counted
 * differently).
 *
 * 📌 WHAT THIS PAGE LOOKS LIKE TODAY: the campaign rests in `draft`, so nothing
 * has dialled, `started_at` is null and there is no day number. Every section
 * below has an explicit not-started branch. That is not defensive padding — a
 * wall of zeros and red dots on launch morning reads as "the campaign has
 * failed", which is the opposite of the truth, and it is exactly the mistake
 * that put four green "on track" ticks on Home over four missing numbers.
 */

/**
 * THE ONE LINE. Abdus asked for this twice: "im not able to tell how many calls
 * have been done total and how many spoke to how many picked up in a simple way
 * rigtbnow its alot". Every number was already on the page, spread across six
 * tiles and a traffic-light strip. This states the funnel in one sentence before
 * any of that.
 *
 * 🔑 "Picked up" and "talked" are DIFFERENT numbers and that gap is the point.
 * On the pilot: 49 called, 11 picked up, 4 got past a brush-off, 1 booked.
 * `talked` is migration 249 - a connected call carrying a lead turn that lasted
 * at least cf.system_config.conversation_seconds. It is NOT `conversations`,
 * which asks only whether the lead said anything at all and reads 11 of 11 here.
 * The kill criteria in 5.11 measure against `conversations`, so the two must
 * stay separate.
 */
function OneLine({ st }) {
  const steps = [
    { n: st.dials,        label: 'called',     sub: 'we dialled' },
    { n: st.connects,     label: 'picked up',  sub: st.connect_pct != null ? `${pct(st.connect_pct)} of calls` : null },
    { n: st.talked,       label: 'talked',     sub: st.talked_pct  != null ? `${pct(st.talked_pct)} of pick-ups` : null },
    { n: st.meetings,     label: 'booked',     sub: st.booking_pct != null ? `${pct(st.booking_pct)} of conversations` : null },
  ]
  return (
    <section className="oneline">
      {steps.map((s, i) => (
        <div className="ol-cell" key={s.label}>
          {i > 0 && <i className="ol-arrow" aria-hidden="true">&rsaquo;</i>}
          <div className="ol-body">
            <b>{num(s.n)}</b>
            <span>{s.label}</span>
            <em>{s.sub || '\u2014'}</em>
          </div>
        </div>
      ))}
    </section>
  )
}

const toneClassSb = { good: 'on', warn: 'off', bad: 'off', na: '' }

/** The dot on a scoreboard tile. `.sb.on`/`.sb.off` colour it; nothing colours "unknown". */
const TileDot = ({ tone }) => (
  <i className="d" style={tone === 'na' ? { background: 'var(--hairline)' } : undefined} />
)

/**
 * A scoreboard tile. `value` is what happened, `flag` is whether that is good.
 * A tile with no verdict shows no chip rather than an empty green one.
 */
function Tile({ label, value, fmt = num, sub, row, split, own, today, flagUnit, children }) {
  const tone = row?.tone || 'na'
  const cls = ['sb', toneClassSb[tone], split ? 'split' : ''].filter(Boolean).join(' ')
  const flag = row?.gap?.delta != null
  return (
    <div className={cls}>
      <span className="k"><TileDot tone={tone} />{label}</span>
      <div className="n" style={tone === 'na' ? { color: 'var(--text)' } : undefined}>{fmt(value)}</div>
      {children}
      {sub && <div className="sub">{sub}</div>}
      {flag && (
        <div
          className="flag"
          style={tone === 'na' ? { background: 'var(--raised)', color: 'var(--dim)' } : undefined}
        >
          {row.gap.delta === 0 ? 'on target'
            : `${gapText(row, flagUnit)}${row.gap.delta < 0 ? ' plan' : ''}`}
        </div>
      )}
      {today != null && <div className="td">+{num(today)} today</div>}
      {own && <div className="own">{own}</div>}
    </div>
  )
}

/**
 * THE SINGLE MOST EXPENSIVE DROP-OFF, and what closing it is worth.
 *
 * For each step, compare the rate she is converting at against the rate the
 * plan assumes, and price the difference in people. The biggest number wins.
 * Returns null when there is nothing to diagnose — an empty amber callout that
 * says "no leak" would be read as a finding.
 */
function biggestLeak(plan) {
  const chain = plan.sarah
  let worst = null
  for (let i = 1; i < chain.length; i++) {
    const row = chain[i]
    const above = chain[i - 1]
    if (!row?.target || !above?.target || !above.actual || row.actual == null) continue
    const planRate = row.target / above.target
    const wouldBe = Math.round(above.actual * planRate)
    const loss = wouldBe - row.actual
    if (loss <= 0) continue
    if (!worst || loss > worst.loss) {
      worst = { row, above, wouldBe, loss, planRate: planRate * 100, realRate: (row.actual / above.actual) * 100 }
    }
  }
  return worst
}

/** One health tile: a question a client would ask, its answer, and the stop line. */
function Health({ question, kill, targetPct, good, under }) {
  const v = kill?.pct == null ? null : Number(kill.pct)
  const floor = kill?.floor == null ? null : Number(kill.floor)
  const armed = kill?.armed
  const sample = kill?.sample

  let tone = 'na'
  let verdict = <>Not measured yet. Nothing has been dialled.</>
  if (v != null && !armed) {
    tone = 'na'
    verdict = <>Too early to judge. {num(sample)} so far, against {num(kill.after)} before this counts.</>
  } else if (v != null && floor != null && v < floor) {
    tone = 'bad'
    verdict = <><span className="no">Below the stop line.</span> This is what halts the campaign.</>
  } else if (v != null && targetPct != null && v < targetPct) {
    tone = 'warn'
    verdict = <><span className="no">Under target.</span> {under}</>
  } else if (v != null) {
    tone = 'good'
    verdict = <><span className="ok">Healthy.</span> {good}</>
  }

  // The stylesheet's .tile edge is green and .tile.amber is amber; there is no
  // red and no neutral. One overlay covers all four tones rather than leaving
  // "not measured yet" wearing a green edge, which reads as a pass.
  return (
    <div className="tile">
      <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: TONE_VAR[tone], zIndex: 1 }} />
      <div className="q">{question}</div>
      <div className="big" style={{ color: v == null ? 'var(--dim)' : TONE_VAR[tone] }}>{pct(v)}</div>
      <div className="verdict">{verdict}</div>
      <div className="floor">
        Stop if under {pct(floor)}{targetPct != null ? ` · target ${pct(targetPct)}` : ''}
      </div>
    </div>
  )
}

export default function Overview({ goTo }) {
  const c = useCampaign()
  const d = c.derived

  return (
    <Feed feed={c.overview} what="the campaign" empty={<Empty title="No campaign set up">Nothing to report on until a campaign exists.</Empty>}>
      {(ov) => {
        const plan = campaignPlan(c)
        const st = ov.stats || {}
        const eligible = d.eligible
        const axis = eligible ?? plan.planList
        const started = plan.started
        const draft = ov.status === 'draft'
        const B = plan.byMetric

        const usedPct = widthPct(d.worked, eligible)
        const callsToGo = d.remaining != null && plan.callsPerLead ? d.remaining * plan.callsPerLead : null

        return (
          <>
            {/* ── 2.0 THE ONE LINE ───────────────────────────────────────── */}
            <OneLine st={st} />

            {/* ── 2.1 SCOREBOARD ─────────────────────────────────────────── */}
            <section className="score-wrap">
              <div className="score-top">
                <div className="l">
                  <span className="nm">{ov.name}</span>
                  <span className={`st${d.isLive && !d.halted ? '' : ' amber'}`}>
                    {d.halted ? 'Halted' : ov.status === 'draft' ? 'Not started' : ov.status}
                  </span>
                  <span className="meta">
                    {String(ov.region || '').toUpperCase()}
                    {ov.started_at ? ` · started ${fmtDay(ov.started_at)}` : ' · never switched on'}
                  </span>
                </div>
                <div className="prog">
                  <div className="score-legend">
                    <span><i style={{ background: 'var(--good)' }} />on target</span>
                    <span><i style={{ background: 'var(--pink)' }} />off target</span>
                  </div>
                  <span className="meta">
                    {started
                      ? `Day ${num(plan.dayOf)}${plan.lengthDays ? ` of ${num(plan.lengthDays)}` : ''}`
                      : plan.lengthDays ? `${num(plan.lengthDays)} working days once it starts` : 'Not started'}
                  </span>
                  <div className="t">
                    <i style={{ width: `${plan.elapsed != null ? Math.round(plan.elapsed * 100) : 0}%` }} />
                  </div>
                </div>
              </div>

              <div className="score-row">
                <Tile
                  label="Total calls" value={st.dials} row={B['Leads dialled']}
                  today={st.dials_today || null} flagUnit="leads"
                >
                  <div className="sb-bar">
                    <i className="used" style={{ width: `${usedPct}%` }} />
                    <i className="left" style={{ width: `${100 - usedPct}%` }} />
                  </div>
                  <div className="sb-left">
                    <b>{num(d.remaining)} leads left</b> of {num(eligible)}
                    {callsToGo != null && <> · about {num(callsToGo)} calls to go</>}
                  </div>
                  <div className="td z" style={{ color: 'var(--dim)' }}>
                    {d.daysLeft != null
                      ? `${num(d.daysLeft)} days of database left at this rate`
                      : 'days of database left: once she has a rate to measure'}
                  </div>
                </Tile>

                <Tile
                  label="Total reached" value={st.connects} row={B['Reached']}
                  sub={st.reach_pct != null
                    ? `${pct(st.reach_pct)} of everyone called picked up`
                    : 'nobody has been called yet'}
                />

                <Tile
                  label="Real conversations" value={st.talked} row={B['Real conversations']}
                  sub={st.talked_pct != null
                    ? `${pct(st.talked_pct)} of pick-ups got past a brush-off`
                    : 'no pick-ups to measure'}
                />

                <Tile
                  label="Meetings booked" value={st.meetings} row={B['Meetings booked']}
                  sub={st.booking_pct != null
                    ? `${pct(st.booking_pct)} of every real conversation`
                    : 'no conversations to measure'}
                />

                <Tile
                  label="Turned up" value={st.showed} row={B['Showed']}
                  sub={st.show_pct != null
                    ? `${pct(st.show_pct)} of booked meetings showed`
                    : 'no meetings to measure'}
                />

                <Tile
                  label="Signed" value={st.closed} row={B['Closed']} split own="Ron, not Sarah"
                  sub={st.revenue ? `${money(st.revenue)} a month added` : 'nothing signed yet'}
                />
              </div>
            </section>

            {/* ── 2.2 NARRATIVE HEADLINE ─────────────────────────────────── */}
            <div className="headline" style={{ marginTop: 30 }}>
              {started ? (
                <>
                  <h1>Sarah has worked {num(d.worked)} of your {num(eligible)} old leads.</h1>
                  <p className="lede">
                    She has booked <b>{num(st.meetings)} meetings</b>
                    {st.showed != null && <> and got <b>{num(st.showed)} of them to turn up</b></>}.
                    {B['Meetings booked']?.tone === 'good'
                      ? ' Booking is running at or ahead of plan, so the pitch is working.'
                      : ' '}
                    {st.closed
                      ? <> Ron has closed <b>{num(st.closed)}</b>, worth <b>{money(st.revenue)}</b> a month.</>
                      : <> Nothing has been signed yet, and that number is Ron's rather than hers.</>}
                  </p>
                </>
              ) : (
                <>
                  <h1>
                    {eligible != null
                      ? <>Sarah has not started on your {num(eligible)} old leads.</>
                      : <>Sarah has not started yet.</>}
                  </h1>
                  <p className="lede">
                    The campaign is built and switched off, which is where it is meant to rest until somebody
                    starts it. Nothing has been dialled, so every figure on this page is genuinely unknown
                    rather than zero.
                    {ov.gate?.pilot_size != null && (
                      <> Starting it releases <b>{num(ov.gate.pilot_size)} calls</b> and then holds, so the
                        first thing you will see is whether {pct(ov.gate.required_pct)} of them get picked up.</>
                    )}
                  </p>
                </>
              )}
            </div>

            {/* ── 2.3 PACE TRACK ─────────────────────────────────────────── */}
            <PaceTrack plan={plan} d={d} eligible={eligible} ov={ov} />

            {/* ── 2.4 TRAFFIC-LIGHT STRIP ────────────────────────────────── */}
            <section className="sec">
              <p className="eyebrow">Against the targets you set</p>
              <h2 className="sec-title">
                {!plan.sarah.length
                  ? 'Targets have not loaded'
                  : !started
                    ? 'Nothing to score yet'
                    : (() => {
                      const off = plan.sarah.filter((r) => r.tone === 'bad' || r.tone === 'warn').length
                      return off === 0
                        ? `All ${num(plan.sarah.length)} are on track`
                        : `${num(off)} of ${num(plan.sarah.length)} are off track`
                    })()}
              </h2>
              <p className="sec-sub">
                {started
                  ? `Measured against where you should be on day ${num(plan.dayOf)} of ${num(plan.lengthDays)}, not the end number.`
                  : 'These start scoring the day the campaign is switched on. Until then there is no pace line to be behind.'}
              </p>
              <div className="strip">
                {plan.sarah.map((r) => (
                  <button key={r.key} className="sl" onClick={() => goTo && goTo('targets')}>
                    <div className="h">
                      <i style={{ background: TONE_VAR[r.tone] }} />
                      <span>{r.meta.short}</span>
                    </div>
                    <div
                      className={`g ${{ bad: 'r', warn: 'y', good: 'gr' }[r.tone] || ''}`}
                      style={r.tone === 'na' ? { color: 'var(--dim)' } : undefined}
                    >
                      {gapText(r)}
                    </div>
                    <div className="w">
                      {r.meta.fmt(r.actual)} of {r.meta.fmt(r.due)} due
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ── 2.5 TWO-UP ─────────────────────────────────────────────── */}
            <div className="two-up">
              <ShiftCard c={c} ov={ov} draft={draft} />
              <NeedsAPerson c={c} goTo={goTo} />
            </div>

            {/* ── 2.6 FUNNEL ─────────────────────────────────────────────── */}
            <FunnelCard plan={plan} st={st} axis={axis} eligible={eligible} started={started} />

            {/* ── 2.7 HEALTH CHECK ───────────────────────────────────────── */}
            <section className="sec">
              <p className="eyebrow">Health check</p>
              <h2 className="sec-title" style={{ marginBottom: 14 }}>Is Sarah doing her job?</h2>
              <div className="health">
                <Health
                  question="Are the calls getting picked up?"
                  kill={ov.kill?.connect}
                  good="Better than a live rep gets on cold data."
                  under="Above the stop line, below what this plan needs."
                />
                <Health
                  question="Are people agreeing to meet?"
                  kill={ov.kill?.booking}
                  good="The pitch is landing on the people who answer."
                  under="Above the stop line, below what this plan needs."
                />
                <Health
                  question="Are they turning up?"
                  kill={ov.kill?.show}
                  targetPct={
                    B['Showed']?.target && B['Meetings booked']?.target
                      ? Math.round((B['Showed'].target / B['Meetings booked'].target) * 100) : null
                  }
                  good="Booked meetings are becoming real ones."
                  under="Confirmations are the fix, not more dialling."
                />
              </div>
              <p style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 12 }}>
                Closing is not on this page — that is Ron's number, on the sales dashboard.
                {' '}These three are the lines that stop the campaign by themselves if they are crossed.
                {' '}The first figure counts <b style={{ color: 'var(--muted)', fontWeight: 400 }}>calls</b>;
                the scoreboard's "total reached" counts <b style={{ color: 'var(--muted)', fontWeight: 400 }}>people</b>,
                and one person is called up to {num(plan.callsPerLead)} times.
              </p>
            </section>
          </>
        )
      }}
    </Feed>
  )
}

/* ══════════════════════════════════════════════════════════════════════════ */

/**
 * The pace track. Distance, not a number.
 *
 * Pink fill is where she is, the filled pink marker sits at the end of it, the
 * hollow amber marker is where the plan says she should be today, and the
 * hatched band between them is the gap. "Two days behind" is a thing a person
 * can act on; "244 behind" is a thing they have to convert first.
 *
 * ⚠️ The axis is the CALLABLE list, not the plan's list. The plan names 2,706
 * people and 1,794 of them can actually be dialled today — running the track to
 * 2,706 would draw a bar that can never fill, and the Targets tab is where that
 * difference is explained rather than hidden.
 */
function PaceTrack({ plan, d, eligible, ov }) {
  const you = d.worked
  const due = plan.elapsed != null && eligible != null ? Math.round(eligible * plan.elapsed) : null
  const youPct = widthPct(you, eligible)
  const duePct = due != null ? widthPct(due, eligible) : null
  const behind = due != null && you != null ? due - you : null
  const daysBehind = behind != null && d.perDay ? Math.round(behind / d.perDay) : null

  const finishAt = (days) => {
    if (days == null) return null
    const t = new Date(Date.now() + days * 86_400_000)
    return fmtDay(t.toISOString())
  }
  const atThisRate = plan.started ? finishAt(d.daysLeft) : null
  // Days of dialling at the planned release rate. Rendered as a DATE only once
  // the campaign is running — a finish date on a draft campaign is a claim that
  // it has started, which is the one thing this page must not say today.
  const capDays = plan.leadsPerDay && d.remaining != null
    ? Math.ceil(d.remaining / plan.leadsPerDay) : null
  const atTheCap = plan.started && capDays != null ? finishAt(capDays) : null

  return (
    <section className="pace">
      <div className="pace-head">
        <div className="pace-verdict">
          {!plan.started ? (
            <>Not started — the pace line begins the day it is switched on</>
          ) : behind == null ? (
            <>No pace line yet</>
          ) : behind <= 0 ? (
            <>Ahead of pace — <span style={{ color: 'var(--good)' }}>{num(Math.abs(behind))} leads in front</span></>
          ) : (
            <>Behind on dialling — <span className="behind">
              {daysBehind ? `about ${num(daysBehind)} ${daysBehind === 1 ? 'day' : 'days'} behind` : `${num(behind)} leads behind`}
            </span></>
          )}
        </div>
        <div className="pace-meta">
          {d.remaining != null ? `${num(d.remaining)} leads left` : 'nobody worked yet'}
          {atThisRate && ` · finishing ${atThisRate} at the rate she is going`}
          {atTheCap && ` · ${atTheCap} at the planned ${num(plan.leadsPerDay)} a day`}
          {!plan.started && plan.leadsPerDay && capDays != null
            && ` · about ${num(capDays)} days of dialling at ${num(plan.leadsPerDay)} people a day`}
        </div>
      </div>

      <div className="track">
        <div className="done" style={{ width: `${youPct}%` }} />
        {duePct != null && duePct > youPct && (
          <div className="gap" style={{ left: `${youPct}%`, width: `${duePct - youPct}%` }} />
        )}
        {you != null && (
          <div className="marker you" style={{ left: `${youPct}%` }}>
            <span className="tag">You · {num(you)}</span>
            <span className="dot" />
          </div>
        )}
        {duePct != null && (
          <div className="marker plan" style={{ left: `${duePct}%` }}>
            <span className="dot" />
            <span className="tag">Plan · {num(due)}</span>
          </div>
        )}
      </div>

      <div className="track-ends">
        <span><b>{ov.started_at ? 'Started' : 'Starts'}</b> {ov.started_at ? fmtDay(ov.started_at) : 'when you switch it on'}</span>
        <span>
          <b>Whole callable list worked</b> {num(eligible)}
          {atThisRate ? ` · ${atThisRate}` : ''}
        </span>
      </div>
    </section>
  )
}

/**
 * Her shift so far.
 *
 * ⚠️ THE DESIGN'S HOURLY BAR CHART IS NOT DRAWN, AND THAT IS DELIBERATE.
 * `cf_shifts` returns the day as totals — calls, reached, talks, booked, first
 * and last call — with no per-hour breakdown anywhere in the feed. Ten bars
 * spread out of one total would be a shape the reader would take as measured,
 * and inventing the distribution is exactly the class of lie the em-dash rule
 * exists to stop. The daily limit bar below is real and answers the same
 * question the chart was there for: how much of today is used up.
 *
 * 📌 These figures are Sarah's WHOLE DAY, not just the campaign. Her shift
 * includes ordinary follow-up traffic, and the campaign is deliberately held
 * out of the business's numbers — so this card is labelled as her day and the
 * scoreboard above stays campaign-only. They are not meant to add up.
 */
function ShiftCard({ c, ov, draft }) {
  return (
    <div className="card">
      <Feed feed={c.shifts} what="today's shift" empty={<Empty title="No shift today">She has not clocked in.</Empty>}>
        {(sh) => {
          const t = sh.today || {}
          // `shifts.today.cap` is null while the campaign is off, by design — the
          // campaign cap only applies once it is piloting or running. Falling
          // back to the configured cap on a draft campaign would draw a limit
          // bar for a limit that is not in force.
          const cap = t.cap ?? (draft ? null : ov.daily_dial_cap ?? null)
          const usedPct = widthPct(t.calls, cap)
          return (
            <>
              <p className="eyebrow">Today · {fmtDay(t.date)}</p>
              <h2 className="sec-title">Her shift so far</h2>
              <p className="sec-sub">
                {t.from && t.from !== '—'
                  ? <>First call {t.from}, last {t.to}, Dubai time. Reactivation calls only.</>
                  : <>She has not made a call today.</>}
              </p>

              <div className="shift-row">
                <div className="stat">
                  <span className="k">Called</span>
                  <span className="v">{num(t.calls)}{cap != null && <small>/{num(cap)}</small>}</span>
                </div>
                <div className="stat">
                  <span className="k">Got through</span>
                  <span className="v">{num(t.reached)}</span>
                </div>
                <div className="stat">
                  <span className="k">Real talks</span>
                  <span className="v">{num(t.talks)}</span>
                </div>
                <div className="stat">
                  <span className="k">Booked</span>
                  <span className="v hot">{num(t.booked)}</span>
                </div>
              </div>

              {cap != null ? (
                <>
                  <div className="sb-bar" style={{ height: 8, marginTop: 4 }}>
                    <i className="used" style={{ width: `${usedPct}%` }} />
                    <i className="left" style={{ width: `${100 - usedPct}%` }} />
                  </div>
                  <div className="hours-lab" style={{ marginTop: 6 }}>
                    <span>0</span>
                    <span>{Math.round(usedPct)}% of today's limit used</span>
                    <span>{num(cap)}</span>
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--dim)', fontSize: 12.5, margin: '4px 0 0' }}>
                  No daily limit is running — it applies once the campaign is switched on.
                </p>
              )}

              <p className="cap-note">
                {c.derived.dialingNow > 0 && <><LiveDot />{' '}</>}
                {draft ? (
                  <>The campaign is switched off, so nothing here is a reactivation call.</>
                ) : ov.headroom_today != null ? (
                  <>
                    <b style={{ color: 'var(--text)' }}>{num(ov.headroom_today)}</b> calls left in today's limit
                    {ov.scheduled_today != null && <>, with {num(ov.scheduled_today)} already lined up.</>}
                  </>
                ) : (
                  <>Today's remaining limit is not being reported.</>
                )}
              </p>
            </>
          )
        }}
      </Feed>
    </div>
  )
}

/**
 * The escalation list. Four things only a person can clear — which is what
 * makes each one an escalation rather than a metric.
 *
 * Every action button lands on a tab that can actually action it. A button that
 * navigates nowhere is the same defect as an agent promising a call it never
 * queues: it reports success and does nothing.
 */
const TASKS = [
  {
    key: 'super_hot', mark: 'urgent', go: 'pipeline', action: 'Assign',
    title: (n) => `${num(n)} super hot ${n === 1 ? 'lead is' : 'leads are'} waiting on a human`,
    detail: 'Ready to buy or asked for a person. Sarah cannot close these.',
  },
  {
    key: 'unconfirmed_meetings', mark: 'soon', go: 'pipeline', action: 'Review',
    title: (n) => `${num(n)} booked ${n === 1 ? 'meeting is' : 'meetings are'} not confirmed`,
    detail: 'Unconfirmed meetings turn up about half as often as confirmed ones.',
  },
  {
    key: 'unlogged_outcomes', mark: 'soon', go: 'queue', action: 'Fix',
    title: (n) => `${num(n)} ${n === 1 ? 'call has' : 'calls have'} no outcome recorded`,
    detail: 'Nobody marked what happened, so the rates above are missing these.',
  },
  {
    key: 'unsent_messages', mark: '', go: 'followups', action: 'Open',
    title: (n) => `${num(n)} requested ${n === 1 ? 'WhatsApp has' : 'WhatsApps have'} not gone out`,
    detail: 'They asked for details on WhatsApp and nothing was sent.',
  },
]

function NeedsAPerson({ c, goTo }) {
  return (
    <div className="card">
      <Feed feed={c.brief} what="the escalation list" empty={<Empty title="Nothing to escalate">Nothing is waiting on a person.</Empty>}>
        {(b) => {
          const n = b.needs_a_person || {}
          const live = TASKS.filter((t) => Number(n[t.key]) > 0)
          return (
            <>
              <p className="eyebrow">Needs a person</p>
              <h2 className="sec-title">
                {live.length ? `${num(live.length)} ${live.length === 1 ? 'thing' : 'things'} Sarah cannot do` : 'Nothing needs you'}
              </h2>
              <p className="sec-sub">
                {live.length ? 'Everything else is handled.' : 'Nothing is sitting waiting on a human right now.'}
              </p>
              {live.map((t) => (
                <div className="task" key={t.key}>
                  <span className={`mk ${t.mark}`} />
                  <div>
                    <div className="t">{t.title(Number(n[t.key]))}</div>
                    <div className="d">{t.detail}</div>
                  </div>
                  <button className="go" onClick={() => goTo && goTo(t.go)}>{t.action}</button>
                </div>
              ))}
            </>
          )
        }}
      </Feed>
    </div>
  )
}

/**
 * The funnel. Every bar is drawn against the same axis — the callable list — so
 * the shape on screen IS the drop-off. Solid pink is real, the dashed block
 * behind it is where the plan says today should be.
 */
function FunnelStep({ row, axis, cmp, tone }) {
  const actPct = widthPct(row.actual, axis)
  const planPct = row.due != null ? widthPct(row.due, axis) : 0
  const outside = actPct < 12
  return (
    <div className="step">
      <div className="lab">
        {row.meta.label}
        {row.meta.stage && <em>{row.meta.stage}</em>}
      </div>
      <div className="fbar">
        {planPct > 0 && <div className="plan" style={{ width: `${planPct}%` }} />}
        <div className={`act${tone ? ` ${tone}` : ''}`} style={{ width: `${actPct}%` }}>
          {!outside && <span className="val">{row.meta.fmt(row.actual)}</span>}
        </div>
        {outside && (
          <span className="val out" style={{ left: `calc(${actPct}% + 12px)` }}>
            {row.meta.fmt(row.actual)}
          </span>
        )}
      </div>
      <div className="cmp">{cmp}</div>
    </div>
  )
}

function FunnelCard({ plan, st, axis, eligible, started }) {
  const leak = biggestLeak(plan)
  const B = plan.byMetric
  const calledPct = eligible ? widthPct(B['Leads dialled']?.actual, eligible) : null

  const cmpFor = {
    'Leads dialled': calledPct != null ? <><b>{pct(calledPct)}</b> of the list</> : '—',
    'Reached': <><b>{pct(st.reach_pct)}</b> of those called</>,
    'Real conversations': <><b>{pct(st.talked_pct)}</b> of pick-ups</>,
    'Meetings booked': <><b>{pct(st.booking_pct)}</b> of real talks</>,
    'Showed': <><b>{pct(st.show_pct)}</b> of meetings</>,
    'Closed': <><b>{pct(st.close_pct)}</b> of turn-ups</>,
  }

  return (
    <section className="sec card">
      <p className="eyebrow">Where the leads go</p>
      <h2 className="sec-title">
        {eligible != null
          ? <>Out of {num(eligible)} people, this is what has happened</>
          : <>What has happened so far</>}
      </h2>
      <p className="sec-sub">
        {started
          ? 'Solid bar is real. The block behind it is where plan says you should be today.'
          : 'Nothing has been dialled, so every bar is empty. They fill from the top down.'}
      </p>

      <div className="funnel">
        {plan.sarah.map((row) => (
          <FunnelStep
            key={row.key} row={row} axis={axis}
            cmp={cmpFor[row.key]}
            tone={row.key === 'Showed' && row.tone === 'bad' ? 'warn' : ''}
          />
        ))}
      </div>

      {B['Closed'] && (
        <>
          <Handoff label="Sarah stops here · Ron takes over" />
          <div className="funnel">
            <FunnelStep
              row={{
                ...B['Closed'],
                meta: {
                  ...B['Closed'].meta,
                  stage: st.revenue ? `${money(st.revenue)} / month` : 'nothing signed yet',
                },
              }}
              axis={axis} cmp={cmpFor['Closed']} tone="team"
            />
          </div>
        </>
      )}

      {leak ? (
        <div className="leak">
          <span className="ic">BIGGEST LEAK</span>
          <p>
            <b>{num(leak.loss)} short at "{leak.row.meta.label.toLowerCase()}".</b>{' '}
            {leak.above.meta.label} is at {num(leak.above.actual)}. The plan assumes {pct(leak.planRate)}
            {' '}of those carry through, which would be <b>{num(leak.wouldBe)} rather than {num(leak.row.actual)}</b>
            {' '}from the exact same calls. She is getting {pct(leak.realRate)}. This step costs more than any
            other on the page, so it is the one worth fixing first.
          </p>
        </div>
      ) : started ? null : (
        <div className="leak" style={{ background: 'var(--raised)', borderColor: 'var(--hairline)' }}>
          <span className="ic" style={{ color: 'var(--dim)' }}>NO LEAK YET</span>
          <p style={{ color: 'var(--muted)' }}>
            Nothing has been dialled, so there is no drop-off to diagnose. This callout names the single
            most expensive step the day there is one.
          </p>
        </div>
      )}
    </section>
  )
}
