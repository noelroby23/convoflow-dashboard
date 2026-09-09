import { useMemo } from 'react'
import { useCampaign } from '../useCampaign'
import { campaignPlan } from '../tabs/Targets'
import { toneFor } from '../format'

/**
 * THE ADAPTER. Every figure the Agent view renders is shaped here, once.
 *
 * 🔑 IT DERIVES NOTHING THE CLASSIC VIEW ALREADY DERIVES. `campaignPlan()` is
 * imported from the Targets tab rather than re-implemented, so the pace line,
 * "due by now" and every behind-plan verdict are the SAME arithmetic on both
 * views. Two views computing "behind plan" independently is CONTRACT rule 1
 * broken in the most expensive way available — this app has already shipped
 * three different answers for "meetings booked" once (§7 item 174's neighbour).
 *
 * 🔑 AND IT INVENTS NOTHING. Where the source design shows a figure this system
 * does not measure, the field comes back null and the page renders an em-dash.
 * There is no `?? 0` anywhere in this file, deliberately: a zero is a measured
 * result, and a reader acts on it (§7 item 56).
 *
 * ⚠️ Three things in the source design are DELIBERATELY ABSENT, and the design
 * says so itself: it sets `showFilters = false` on the reactivation page and
 * prints "Reactivation only, voice. Both sources still count toward one
 * combined campaign target."
 *   · the channel filter (Both / Voice / WhatsApp) — no channel dimension exists
 *   · the workspace filter (reactivation / lead qualification / all)
 *   · the bookings split bar by source — this whole page IS one source
 * Adding any of them would mean inventing a second population to divide by.
 */

const n = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

/** a / b as a rate, null when the denominator is missing or empty. */
const rate = (a, b) => {
  const x = n(a), y = n(b)
  return x == null || y == null || y <= 0 ? null : x / y
}

/**
 * The funnel, in the order the design draws it. Its `metric` strings are the
 * database's own, so a renamed row here fails loudly rather than rendering an
 * em-dash that looks like a quiet day.
 */
export const STEPS = [
  { metric: 'Leads dialled',      label: 'Dialled',       def: 'People this campaign has dialled at least once.' },
  { metric: 'Reached',            label: 'Reached',       def: 'The line connected to a human.' },
  { metric: 'Real conversations', label: 'Talked',        def: 'Got past the opener — a genuine conversation, not a hello and a hang-up.' },
  { metric: 'Meetings booked',    label: 'Booked',        def: 'A strategy call went in the calendar.' },
  { metric: 'Showed',             label: 'Showed',        def: 'They turned up.' },
  { metric: 'Closed',             label: 'Closed',        def: 'A deal was won.' },
]

/** Columns the design's Pipeline board draws, left to right, Sarah then Ron. */
export const BOARD_ORDER = [
  'waiting', 'first_attempt', 'in_follow_up', 'talked_not_booked', 'super_hot',
  'meeting_booked', 'no_show', 'turned_up', 'not_interested', 'in_discussion', 'won',
]

const COLOUR_BY_COL = {
  waiting: '#5F5B69', first_attempt: '#6BA8F5', in_follow_up: '#F59E0B',
  talked_not_booked: '#9CA3AF', super_hot: '#EC4899', meeting_booked: '#F9A8D4',
  no_show: '#EF4444', turned_up: '#22C55E', not_interested: '#6B7280',
  in_discussion: '#6BA8F5', won: '#22C55E',
}

export function useAgentModel() {
  const c = useCampaign()

  return useMemo(() => {
    const plan = campaignPlan(c)
    const ov = c.overview.data
    const st = ov?.stats
    const pipe = c.pipeline.data
    const dial = c.dialler.data

    /* ------------------------------------------------------------- the plan */

    const by = plan.byMetric
    const showed = by['Showed']
    const booked = by['Meetings booked']
    const talked = by['Real conversations']
    const dialled = by['Leads dialled']

    const showsLeft = showed?.target != null && showed?.actual != null
      ? Math.max(0, showed.target - showed.actual) : null

    // The show rate as it is actually running, and as the plan assumed. Both
    // come from figures the database already agreed on.
    const liveShow = rate(showed?.actual, booked?.actual)
    const planShow = rate(showed?.target, booked?.target)

    /**
     * What is still needed, worked backwards from the show target through the
     * rates ACTUALLY being achieved. Null the moment any rate is unmeasured —
     * "you need 0 more bookings" on day one is the worst possible answer.
     */
    const liveBook = rate(booked?.actual, talked?.actual)
    const liveTalk = rate(talked?.actual, dialled?.actual)

    const reqBookings = liveShow && showsLeft != null ? Math.ceil(showsLeft / liveShow) : null
    const reqTalks = liveBook && reqBookings != null ? Math.ceil(reqBookings / liveBook) : null
    const reqDials = liveTalk && reqTalks != null ? Math.ceil(reqTalks / liveTalk) : null

    /**
     * Which step of the chain is furthest off its plan. Only steps with enough
     * volume behind them are eligible: a 0% booking rate on four conversations
     * is noise, and naming it as "the step that is off" sends somebody to
     * rewrite a working prompt (§7 item 201 is what that costs).
     */
    const chain = [
      { label: 'Dialled to talked', live: liveTalk, plan: rate(talked?.target, dialled?.target), enough: n(dialled?.actual) >= 200 && n(talked?.actual) > 0 },
      { label: 'Talked to booked', live: liveBook, plan: rate(booked?.target, talked?.target), enough: n(talked?.actual) >= 20 && n(booked?.actual) > 0 },
      { label: 'Booked to showed', live: liveShow, plan: planShow, enough: n(booked?.actual) >= 5 && n(showed?.actual) > 0 },
    ]
    const measured = chain.filter((x) => x.enough && x.live != null && x.plan).length
    const worst = chain
      .filter((x) => x.enough && x.live != null && x.plan)
      .map((x) => ({ ...x, ratio: x.live / x.plan }))
      .sort((a, b) => a.ratio - b.ratio)[0] || null

    /* ------------------------------------------------------------ the board */

    const cols = pipe?.columns || []
    const colBy = Object.fromEntries(cols.map((k) => [k.col, k]))
    const board = BOARD_ORDER.map((id) => colBy[id]).filter(Boolean)
      .map((k) => ({ ...k, colour: COLOUR_BY_COL[k.col] || '#9CA3AF' }))

    const countOf = (id) => (colBy[id]?.count == null ? null : Number(colBy[id].count))
    const cardsOf = (id) => colBy[id]?.cards || []

    /** Every card the board holds, once — the Leads table and the Meetings page
     *  both read this rather than walking the columns again. */
    const allCards = cols.flatMap((k) =>
      (k.cards || []).map((card) => ({ ...card, col: k.col, colLabel: k.label, owner: k.owner })))

    /**
     * A meeting somebody still has to mark: it is on the books and its time has
     * passed. §5.6 makes that a human's decision and nothing writes it now, so
     * these accumulate until a person looks — which is precisely why the design
     * puts a counter on it.
     */
    const now = Date.now()
    const toMark = cardsOf('meeting_booked')
      .filter((k) => k.next_iso && new Date(k.next_iso).getTime() < now)

    /* -------------------------------------------------------------- the day */

    const today = c.shifts.data?.today || null

    return {
      c, plan, ov, st, pipe, dial, today,

      // the verdict
      showed, booked, talked, dialled, showsLeft,
      liveShow, planShow, liveBook, liveTalk,
      reqBookings, reqTalks, reqDials,
      worst, measured, chainLength: chain.length,

      // the funnel, in the design's own shape: each step with its conversion
      // from the step above and the plan's own conversion beside it
      steps: STEPS.map((s, i) => {
        const row = by[s.metric]
        const prev = i === 0 ? null : by[STEPS[i - 1].metric]
        const conv = i === 0 ? null : rate(row?.actual, prev?.actual)
        const convPlan = i === 0 ? null : rate(row?.target, prev?.target)
        return {
          ...s,
          actual: row?.actual ?? null,
          target: row?.target ?? null,
          due: row?.due ?? null,
          tone: row?.tone ?? 'na',
          conv, convPlan,
          convTone: conv == null || !convPlan ? 'na' : toneFor(conv, convPlan),
        }
      }),

      // the board
      board, colBy, countOf, cardsOf, allCards, toMark,
      sarahTotal: pipe?.sarah_total ?? null,
      ronTotal: pipe?.ron_total ?? null,

      // the counter strip: four things that each need a decision
      counters: [
        { key: 'super_hot', label: 'Needs a human today', count: countOf('super_hot'), go: 'Open handover', page: 'handover', hot: (countOf('super_hot') || 0) > 0 },
        { key: 'to_mark', label: 'Meetings to mark', count: toMark.length, go: 'Open meetings', page: 'meetings', hot: toMark.length > 0 },
        { key: 'overdue', label: 'Calls past due', count: c.ladder.data?.overdue_count ?? null, go: 'Open the queue', page: 'live', hot: (c.ladder.data?.overdue_count || 0) > 0 },
        { key: 'live', label: 'On the phone now', count: dial?.dialling_now ?? null, go: 'Open call log', page: 'live', live: (dial?.dialling_now || 0) > 0 },
      ],
    }
  }, [c])
}
