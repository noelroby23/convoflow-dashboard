import { useState } from 'react'
import { toast } from 'sonner'
import { useCampaign } from './useCampaign'
import { Feed } from './bits'
import { num, pct, money } from './format'

/**
 * The manager brief — §10.3. Bottom right, opens on arrival, written as a
 * person rather than as a report.
 *
 * 🔑 THE RULE THIS WHOLE FILE EXISTS TO KEEP: the brief must never state a
 * number the dashboard cannot show you. cf_manager_brief_facts returns ONLY
 * facts, and every one of them is lifted from a function that already feeds a
 * visible panel — so "go and look at it yourself" always works. The prose is
 * written here, from those facts, and nothing is computed on the way.
 *
 * 🔑 AND THE HABIT THAT KEEPS IT HONEST: if a fact is null, the sentence that
 * depends on it is NOT WRITTEN. Not softened, not hedged, not filled with a
 * zero — omitted. A campaign resting in `draft` has no show rate, and a brief
 * that says "0% of meetings showed" on nought meetings has invented the single
 * most damaging kind of number there is (§7 item 56). Every section below can
 * return null, and on day one most of them do.
 *
 * ⚠️ TWO SCOPES ARE MIXED IN THE FACTS AND MUST NOT BE MIXED IN THE PROSE.
 * `scorecard` and `worst_rules` are campaign-only (cf_score_summary is called
 * with campaign_only: true). `recent_failures` is NOT — it is the last eight
 * failed rules from cf.call_score across the whole system, and `today_so_far`
 * is Sarah's whole day, campaign or not. Presenting either as a verdict on
 * this campaign would be the same error as QA ticket 243, where a reviewer
 * without the full record confidently reported a kept promise as broken.
 * Where they appear, they are LABELLED as coming from her other calls.
 *
 * ⚠️ NO Esc HANDLER HERE — the shell owns one and closes the innermost panel.
 */

const SNOOZE = 'rx.brief.snoozedUntil'

/** localStorage throws outright in some embedded contexts, so every touch is
 *  guarded and a failure means "not snoozed" rather than a blank panel. */
const readSnooze = () => {
  try { return Number(localStorage.getItem(SNOOZE)) || 0 } catch { return 0 }
}
const writeSnooze = (ms) => {
  try { localStorage.setItem(SNOOZE, String(ms)) } catch { /* private mode — the panel just does not snooze */ }
}

/** Next Monday, 08:00 local. "Remind me Monday" has to mean a real date or the
 *  button is decoration. */
function nextMonday() {
  const d = new Date()
  d.setHours(8, 0, 0, 0)
  const days = (8 - d.getDay()) % 7 || 7
  d.setDate(d.getDate() + days)
  return d.getTime()
}

const FIXES = {
  opener: 'Fix: the permission line is one sentence at the top of the script. Make it required output, not a suggestion.',
  objection: 'Fix: one scripted second ask after a no. She is allowed exactly one, and right now she takes none.',
  booking_rules: 'Fix: gate the booking tool behind two qualifying answers and a two-hour minimum on the slot.',
  clean_end: 'Fix: a required close — confirm the time, ask for the commitment, then say goodbye.',
}
const fixFor = (rule) => FIXES[rule] || 'Fix: name the moment in the script and make it required output.'

export default function ManagerBrief({ onClose, goTo }) {
  const c = useCampaign()
  const [snoozed, setSnoozed] = useState(() => readSnooze() > Date.now())

  const later = () => {
    const until = nextMonday()
    writeSnooze(until)
    setSnoozed(true)
    toast.success(`Held until ${new Date(until).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`)
  }

  if (snoozed) {
    return (
      <aside className="mgr" role="dialog" aria-label="Manager brief">
        <div className="mgr-head">
          <div className="av">M</div>
          <div>
            <div className="who">Your sales manager</div>
            <div className="sub">held until Monday</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="mgr-body">
          <p className="open">Parked. I will not open on arrival again until Monday.</p>
          <p style={{ margin: 0 }}>
            <button className="btn" onClick={() => { writeSnooze(0); setSnoozed(false) }}>Read it anyway</button>
          </p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="mgr" role="dialog" aria-label="Manager brief">
      <Feed feed={c.brief} what="the brief">
        {(b) => <Brief b={b} onClose={onClose} goTo={goTo} later={later} />}
      </Feed>
    </aside>
  )
}

function Brief({ b, onClose, goTo, later }) {
  const camp = b.campaign || {}
  const n = b.numbers || {}
  const gate = b.gate || {}
  const kill = b.kill || {}
  const pacing = b.pacing || {}
  const pipe = b.pipeline || {}
  const need = b.needs_a_person || {}
  const scorecard = b.scorecard || []
  const worst = b.worst_rules || []
  const fails = b.recent_failures || []

  const status = camp.status
  const halted = !!camp.halted_reason
  // Explicitly `!= null`, never `?? 0` — a null dial count means the campaign
  // has not started, and coercing it to zero is how a missing measurement
  // becomes a stated one (format.js's whole reason for existing).
  const started = n.dials != null && n.dials > 0

  const labelOf = (rule) =>
    scorecard.find((s) => s.rule === rule)?.label || String(rule || '').replace(/_/g, ' ')

  // What the scoring flags on her calls ELSEWHERE — grouped, so it reads as a
  // pattern rather than as eight anecdotes. Labelled as off-campaign wherever
  // it is used, because that is what it is.
  const elsewhere = Object.values(
    fails.reduce((acc, f) => {
      const k = f.rule || 'other'
      acc[k] = acc[k] || { rule: k, n: 0, example: f }
      acc[k].n += 1
      return acc
    }, {}),
  ).sort((a, x) => x.n - a.n)

  const chores = [
    need.super_hot > 0 && { n: need.super_hot, text: `${num(need.super_hot)} super hot ${need.super_hot === 1 ? 'lead is' : 'leads are'} sitting unassigned` },
    need.unsent_messages > 0 && { n: need.unsent_messages, text: `${num(need.unsent_messages)} ${need.unsent_messages === 1 ? 'message is' : 'messages are'} queued and unsent` },
    need.unlogged_outcomes > 0 && { n: need.unlogged_outcomes, text: `${num(need.unlogged_outcomes)} connected ${need.unlogged_outcomes === 1 ? 'call has' : 'calls have'} no outcome logged, so any rate I quote you is a guess until someone fills them in` },
    need.unconfirmed_meetings > 0 && { n: need.unconfirmed_meetings, text: `${num(need.unconfirmed_meetings)} booked ${need.unconfirmed_meetings === 1 ? 'meeting has' : 'meetings have'} nobody confirmed against them` },
  ].filter(Boolean)

  return (
    <>
      <div className="mgr-head">
        <div className="av">M</div>
        <div>
          <div className="who">Your sales manager</div>
          <div className="sub">
            {b.generated_at || '—'}
            {started ? ` · read ${num(n.dials)} calls` : ' · nothing dialled yet'}
          </div>
        </div>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="mgr-body">
        {/* ── opening ── */}
        {halted ? (
          <p className="open">
            Stop — the campaign has halted itself and it will not restart on its own.
            <br /><span className="bad">{camp.halted_reason}</span>
          </p>
        ) : !started ? (
          <p className="open">
            Morning. Nothing has been dialled yet, so this is a pre-flight rather than a report.
          </p>
        ) : (
          <p className="open">Morning — quick one on Sarah.</p>
        )}

        {/* ── the short version ── */}
        <ShortVersion started={started} halted={halted} status={status} n={n} pipe={pipe} />

        {/* ── what she's doing well · or what is set up ── */}
        {started
          ? <DoingWell n={n} scorecard={scorecard} />
          /* A halted campaign gets no "when you press go" — it has already gone,
             and telling somebody what happens next while the thing is stopped is
             the sort of cheerful nonsense that makes a brief unreadable. */
          : !halted && <ReadyToGo gate={gate} kill={kill} pacing={pacing} n={n} />}

        {/* ── three things to talk to her about ── */}
        <ThreeThings
          started={started} worst={worst} elsewhere={elsewhere}
          labelOf={labelOf}
        />

        {/* ── the one thing ── */}
        <FixThis
          halted={halted} camp={camp} started={started} gate={gate} kill={kill}
          worst={worst} labelOf={labelOf} chores={chores} n={n}
        />

        {/* ── what I need from you, not her ── */}
        <div className="mgr-h">What I need from you, not her</div>
        {chores.length ? (
          <p>
            {chores.map((ch, i) => (
              <span key={i}>
                {i > 0 && (i === chores.length - 1 ? ' And ' : ' ')}
                <b>{ch.text}</b>.
              </span>
            ))}
            {' '}None of that is something she can clear herself.
          </p>
        ) : (
          <p>
            Nothing is waiting on a person right now — no unassigned hot leads, no unsent messages,
            no calls missing an outcome, no meetings without a confirmation. That is a measured
            nought, not an empty screen.
          </p>
        )}

        {/* ── the defence ── */}
        <Defence started={started} halted={halted} pacing={pacing} n={n} />

        <p className="mgr-sign">
          {started
            ? 'I will look at the same numbers tomorrow and tell you whether anything moved.'
            : 'Press go and I will have the first real read for you after the pilot lands.'}
        </p>
      </div>

      <div className="mgr-foot">
        <button className="btn go" onClick={() => goTo('review')}>
          {worst.length ? `Apply the ${Math.min(3, worst.length)} fixes` : 'Open call review'}
        </button>
        <button className="btn" onClick={() => goTo('targets')}>See the targets</button>
        <button className="btn" onClick={later}>Remind me Monday</button>
      </div>
    </>
  )
}

/* ───────────────────────── the sections ───────────────────────── */

function ShortVersion({ started, halted, status, n, pipe }) {
  if (halted) {
    return (
      <p>
        <b>Short version:</b> it stopped itself on purpose, and only a person can clear that.
        Nothing else moves until someone does.
      </p>
    )
  }

  if (!started) {
    const total = n.members_total
    const pending = n.members_pending
    const excluded = n.members_excluded
    if (total == null) {
      return <p><b>Short version:</b> nothing is on the list yet. Tag people in the CRM and they land here.</p>
    }
    return (
      <p>
        <b>Short version:</b> the list is loaded and the brakes are on. <b>{num(total)}</b>{' '}
        {total === 1 ? 'person is' : 'people are'} tagged
        {pending != null && <> — <b>{num(pending)}</b> waiting to be called</>}
        {excluded ? <> and <b>{num(excluded)}</b> held back on purpose</> : null}.
        Nobody has been dialled, so every figure on this dashboard is a plan rather than a result.
        {status && status !== 'draft' && <> The campaign reads <b>{status}</b>.</>}
      </p>
    )
  }

  // Started. Each clause is written only if its number exists.
  const meetings = n.meetings
  const showPct = n.show_pct
  const bookPct = n.booking_pct
  return (
    <p>
      <b>Short version:</b> she has made <b>{num(n.dials)}</b> calls
      {n.connect_pct != null && <> and got through on <b>{pct(n.connect_pct)}</b> of them</>}
      {n.conversations != null && n.conversations > 0 && <>, holding <b>{num(n.conversations)}</b> real conversations</>}
      .
      {meetings != null && (
        <> That is <b>{num(meetings)}</b> {meetings === 1 ? 'meeting' : 'meetings'} booked
          {bookPct != null && <> — <span className="good">{pct(bookPct)}</span> of every conversation</>}.</>
      )}
      {showPct != null
        ? <> <span className={showPct >= 50 ? 'good' : 'bad'}>{pct(showPct)}</span> of them turned up.</>
        : (meetings > 0 && <> Nobody has been marked as turned up yet, so the show rate is still unknown.</>)}
    </p>
  )
}

function DoingWell({ n, scorecard }) {
  const strong = scorecard.filter((s) => s.pct != null && s.pct >= 80 && s.scored > 0)
  // Whole sentences, not a list joined with commas — a brief that reads like a
  // spreadsheet caption stops being read at all.
  const bits = []
  if (n.booking_pct != null) {
    bits.push(<>She is booking <b>{pct(n.booking_pct)}</b> of every conversation she holds. </>)
  }
  if (n.conversation_pct != null) {
    bits.push(<><b>{pct(n.conversation_pct)}</b> of the people who pick up stay on the line past the opener. </>)
  }
  if (!bits.length && !strong.length) return null

  return (
    <>
      <div className="mgr-h">What she is doing well</div>
      <p>
        {bits.map((x, i) => <span key={i}>{x}</span>)}
        {strong.length > 0 && (
          <>The scoring pass has her at{' '}
            {strong.map((s, i) => (
              <span key={s.rule}>
                {i > 0 && (i === strong.length - 1 ? ' and ' : ', ')}
                <span className="good">{pct(s.pct)}</span> on {s.label.toLowerCase()}
              </span>
            ))}
            .{' '}
          </>
        )}
        {n.conversation_pct != null && n.conversation_pct >= 70 && (
          <><b>I would not touch the pitch.</b> The front of the script is doing its job; what
            follows it is where the money is going.</>
        )}
      </p>
    </>
  )
}

/** The pre-flight. Every number here is a setting somebody chose, so it can be
 *  stated with confidence on a campaign that has done nothing at all. */
function ReadyToGo({ gate, kill, pacing, n }) {
  const hasPlan = gate.pilot_size != null || pacing.cap_today != null || n.members_pending > 0
  const hasFloors = kill.connect?.floor != null || kill.booking?.floor != null || kill.show?.floor != null
  // A heading with nothing under it reads as broken. If the settings have not
  // loaded, the section does not exist.
  if (!hasPlan && !hasFloors) return null

  return (
    <>
      <div className="mgr-h">What happens when you press go</div>
      {hasPlan && <p>
        {gate.pilot_size != null && (
          <>She makes <b>{num(gate.pilot_size)}</b> calls and then <b>stops on her own</b>
            {gate.required_pct != null && <>, and she will not go further unless <b>{pct(gate.required_pct)}</b> of those calls actually connected</>}
            . That is the plan's own gate and it is not a button I can skip. </>
        )}
        {pacing.cap_today != null && (
          <>After that she is capped at <b>{num(pacing.cap_today)}</b> calls a day
            {pacing.headroom != null && pacing.headroom !== pacing.cap_today && <> — <b>{num(pacing.headroom)}</b> of them are still free today</>}
            . </>
        )}
        {n.members_pending > 0 && (
          <>She has <b>{num(n.members_pending)}</b> {n.members_pending === 1 ? 'person' : 'people'} to work through. </>
        )}
      </p>}
      {hasFloors && (
        <p>
          And she calls it off herself if it is not working:{' '}
          {[
            kill.connect?.floor != null && `under ${pct(kill.connect.floor)} of calls connecting after ${num(kill.connect.after)}`,
            kill.booking?.floor != null && `under ${pct(kill.booking.floor)} of conversations booking after ${num(kill.booking.after)}`,
            kill.show?.floor != null && `under ${pct(kill.show.floor)} of meetings showing after ${num(kill.show.after)}`,
          ].filter(Boolean).join(', ')}. Any one of those stops the whole thing, and only you can
          restart it.
        </p>
      )}
    </>
  )
}

function ThreeThings({ started, worst, elsewhere, labelOf }) {
  // The campaign's own scored calls, worst first. This is the honest version of
  // the section and it is the only one that gets the plain heading.
  if (worst.length > 0) {
    const three = worst.slice(0, 3)
    return (
      <>
        <div className="mgr-h">
          {three.length === 1 ? 'One thing you need to talk to her about'
            : `${three.length === 2 ? 'Two' : 'Three'} things you need to talk to her about`}
        </div>
        <ol>
          {three.map((w) => (
            <li key={w.rule}>
              <b>{w.label || labelOf(w.rule)}</b> —{' '}
              <span className="bad">{pct(w.pct)}</span> of the calls where it applied
              {w.scored != null && <> ({num(w.scored)} scored)</>}.
              <span className="ev">{fixFor(w.rule)}</span>
            </li>
          ))}
        </ol>
      </>
    )
  }

  // Nothing in this campaign is scored. Say that, and then offer what IS known
  // — clearly labelled as coming from her calls elsewhere, because it does.
  if (elsewhere.length > 0) {
    return (
      <>
        <div className="mgr-h">Nothing here is scored yet — but this is already on record</div>
        <p>
          {started
            ? 'None of this campaign’s calls have been through the scoring pass yet, so I will not pretend to have a verdict on it. '
            : 'This campaign has made no calls, so there is nothing of its own to judge. '}
          What the scoring already flags on <b>her calls elsewhere in the system</b>, which is the
          same agent and the same script:
        </p>
        <ol>
          {elsewhere.slice(0, 3).map((e) => (
            <li key={e.rule}>
              <b>{labelOf(e.rule)}</b> — flagged <b>{num(e.n)}</b>{' '}
              {e.n === 1 ? 'time' : 'times'} in the last few scored calls.
              {e.example?.note && <span className="ev">{e.example.note}</span>}
              {e.example?.evidence && <span className="ev">“{e.example.evidence}”</span>}
            </li>
          ))}
        </ol>
      </>
    )
  }

  return null
}

function FixThis({ halted, camp, started, gate, kill, worst, labelOf, chores, n }) {
  let body = null

  if (halted) {
    body = (
      <p>
        Clear the halt, or nothing else on this page matters. It stopped for a reason
        (<span className="bad">{camp.halted_reason}</span>) and restarting without answering
        that reason just burns the rest of the list.
      </p>
    )
  } else {
    const armed = ['connect', 'booking', 'show']
      .map((k) => ({ k, ...(kill[k] || {}) }))
      .find((x) => x.armed && x.pct != null && x.floor != null && x.pct < x.floor)

    if (armed) {
      body = (
        <p>
          The <b>{armed.k}</b> rate is at <span className="bad">{pct(armed.pct)}</span> against a
          floor of <b>{pct(armed.floor)}</b> over {num(armed.sample)} calls. That is the number
          that stops the campaign, so it is the only one worth your attention today.
        </p>
      )
    } else if (started && gate.pilot_complete === false && gate.pilot_size != null) {
      body = (
        <p>
          Finish the pilot. <b>{num(gate.pilot_dials)}</b> of <b>{num(gate.pilot_size)}</b> calls are done and
          she holds at the end of it
          {gate.required_pct != null && <> unless <b>{pct(gate.required_pct)}</b> of them connected</>}
          . Everything else is a guess until that number exists.
        </p>
      )
    } else if (worst.length > 0) {
      const w = worst[0]
      body = (
        <p>
          <b>{w.label || labelOf(w.rule)}</b> is the worst of them at{' '}
          <span className="bad">{pct(w.pct)}</span>, and it is one line in the script rather than a
          rebuild. Fix that one and leave the rest of the pitch alone.
        </p>
      )
    } else if (!started) {
      body = (
        <p>
          Watch the connect rate on the first {gate.pilot_size != null ? num(gate.pilot_size) : 'fifty'} calls,
          and nothing else. If they do not connect, none of the rest of this is measurable — and
          that number belongs to the phone line, not to Sarah.
        </p>
      )
    } else if (chores.length > 0) {
      body = (
        <p>
          Clear the {num(chores.reduce((a, x) => a + x.n, 0))} things sitting in the list below.
          They are the only items here that no automation will pick up.
        </p>
      )
    } else if (n.show_pct != null && n.meetings > 0) {
      body = (
        <p>
          <b>{pct(n.show_pct)}</b> of booked meetings turn up. Every point of that is a real
          person in front of Ron off calls she has already made.
        </p>
      )
    }
  }

  if (!body) return null
  return (
    <>
      <div className="mgr-h">If we fix nothing else, fix this</div>
      {body}
    </>
  )
}

function Defence({ started, halted, pacing, n }) {
  if (halted) return null

  if (!started) {
    return (
      <p>
        And to be fair to her: she is not behind on anything. Nothing has been released to her yet,
        so there is no volume to be behind on and no result to defend.
      </p>
    )
  }

  const cap = pacing.cap_today
  const done = pacing.dialled_today
  if (cap != null && done != null && done >= cap * 0.95) {
    return (
      <p>
        And where she looks slow on volume, she is not — she has used{' '}
        <b>{num(done)}</b> of a <b>{num(cap)}</b> daily cap. <b>That is a cap problem, not a
        Sarah problem.</b> Raise the cap and it closes on its own.
      </p>
    )
  }

  if (n.revenue > 0) {
    return (
      <p>
        Worth saying out loud: <b>{money(n.revenue)}</b> has been signed off the back of this so
        far, and closing is Ron's half, not hers.
      </p>
    )
  }

  return null
}
