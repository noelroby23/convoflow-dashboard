import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useCampaign, moveCard } from '../useCampaign'
import { Feed, Empty, Eyebrow } from '../bits'
import { humanise, money, num, widthPct } from '../format'
import { phraseTone } from './Queue'

/**
 * Pipeline — every lead in exactly one column.
 *
 * 🔑 THE COUNTS MUST SUM TO THE MEMBER TOTAL, and this page says the sum out
 * loud. `cf.campaign_column` is a single CASE expression in priority order, so
 * mutual exclusivity is a property of the structure rather than something an
 * author has to keep being careful about — and migration 222's B1 requires the
 * columns to add up to the member count. If they ever stop adding up, that is
 * worth seeing rather than hiding, because the moment a lead can appear twice
 * every number on the Targets tab becomes arguable.
 *
 * 🔑 WHO OWNS A COLUMN COMES FROM THE DATA. `cf.pipeline_column.owner` is
 * sarah | ron | dead, and the handoff divider is drawn where that value
 * changes. Hardcoding the split here would mean the board and the database
 * disagreed the first time somebody added a column — and the handoff is the one
 * thing on this page nobody is allowed to argue about: Sarah's job ends when
 * someone turns up.
 */

/* Sarah's columns run pink and heat toward her finish line; Ron's are blue and
   green, a different family entirely, so the boundary is visible from across
   the room. Keyed on the column id rather than on position, so inserting a
   column cannot silently re-colour its neighbours.

   No hex: the design's `#3A3740` for "not interested" is the stylesheet's own
   muted grey, which is what `--dim` already is. */
const ACCENT = {
  waiting: 'var(--s1)',
  first_attempt: 'var(--s1)',
  in_follow_up: 'var(--s2)',
  talked_not_booked: 'var(--s3)',
  not_interested: 'var(--dim)',
  super_hot: 'var(--s4)',
  meeting_booked: 'var(--s4)',
  // 278: booked and did not happen. Amber rather than pink — it is a warning
  // about a meeting, not a meeting.
  no_show: 'var(--warn)',
  turned_up: 'var(--s4)',
  in_discussion: 'var(--t1)',
  signed: 'var(--t2)',
}
const accentOf = (col) => ACCENT[col] || 'var(--hairline)'

/* Which accents are dark enough that the flow rail's dark-on-bright label
   would be unreadable on them. The rail sets `color:#140A10` by design. */
const DARK_ACCENT = new Set(['waiting', 'first_attempt', 'in_follow_up', 'not_interested',
  'in_discussion', 'never_answered', 'lost_after_meeting', 'excluded'])

/* The two columns the design gives a pink border: one needs a human today, the
   other is Sarah's finish line. */
const FINISH = {
  super_hot: 'Needs a human today',
  turned_up: "Sarah's finish line",
}

/**
 * BULK ACTIONS LIVE WHERE THE PROBLEM IS — and every one of them is disabled,
 * on purpose, because none of them has a write path.
 *
 * `cf_campaign_control` is the dashboard's only write and it does four things:
 * start, pause, resume, clear a halt. There is no RPC that assigns a lead to
 * Ron, sends a queued WhatsApp, or logs a meeting outcome. A button that looks
 * live and silently does nothing is the exact fault this whole rebuild exists
 * to remove (§7 items 96/106/111 — the agent called a dead tool, was told it
 * worked, and told the lead a call was coming), so each says what it would do
 * and says why it cannot yet.
 */
const BULK = {
  in_follow_up: { label: 'Chase the ones going cold', tone: '' },
  talked_not_booked: { label: 'Send the WhatsApps they asked for', tone: '' },
  super_hot: { label: (n) => `Assign all ${num(n)} to Ron`, tone: '' },
  meeting_booked: { label: 'Get Sarah to chase the unconfirmed', tone: '' },
  no_show: { label: 'Try the ones who did not show', tone: '' },
  turned_up: { label: 'Log the missing outcomes', tone: '' },
  in_discussion: { label: 'Nudge Ron on the quiet ones', tone: ' t' },
}
const NO_WRITE = 'Nothing behind this yet — the campaign can only be started, paused, resumed or cleared from here. Doing this today means moving the card in the CRM.'

/**
 * PLAIN ENGLISH ON SCREEN. `cf.pipeline_column.hint` is written for a reader,
 * but two of the thirteen hints carry the database's own vocabulary —
 * "enrolled, not released yet". Those words are banned on screen and live in
 * the schema, so they are swapped rather than the copy being re-authored here:
 * the database stays the author of what a column means, and this only fixes
 * the two words a human should never have to learn.
 */
const PLAIN = [[/\benrolled\b/gi, 'on the list'], [/\breleased\b/gi, 'started'],
               [/\bcadence\b/gi, 'ladder']]
const plain = (t) => humanise(PLAIN.reduce((a, [re, to]) => a.replace(re, to), String(t || '')))

/** An age in words. A reactivation lead is months old by definition, and "731
 *  days ago" is a number nobody reads as a length of time. */
const oldness = (days) => {
  if (days == null) return null
  const d = Number(days)
  if (!Number.isFinite(d)) return null
  if (d < 45) return `${Math.round(d)}d old`
  if (d < 400) return `${Math.round(d / 30)}mo old`
  return `${(d / 365).toFixed(1)}y old`
}

/** Four dots and the plan's own word for where they are. */
function Dots({ attempt, steps, ladder }) {
  const n = steps || 4
  const done = Math.max(0, Math.min(n, Number(attempt || 0)))
  const label = attempt && ladder?.[attempt - 1]?.label
    ? String(ladder[attempt - 1].label).split(/\s*[-–]\s*/)[0]
    : `${done} of ${n}`
  return (
    <span className="dots">
      {Array.from({ length: n }, (_, i) => <i key={i} className={i < done ? 'f' : undefined} />)}
      <b>{label}</b>
    </span>
  )
}

/* One colour per ask, shared with nothing else. Pink is Sarah's urgent, green
   is a win, amber is a soft no, dim is a non-event. */
const TAG_TONE = {
  'MEETING BOOKED': 'goodt',
  'CALL BACK BOOKED': 'hott',
  'ASKED FOR A HUMAN': 'hott',
  'ASKED FOR PRICING': 'hott',
  'READY TO MOVE': 'hott',
  'WANTS IT ON WHATSAPP': '',
  'NOT A FIT': 'warnt',
  'SAID NO': 'warnt',
  'VOICEMAIL': '',
  'NO ANSWER': '',
}

function Card({ card, steps, ladder, onOpen, onDragStart, onDragEnd, dragging }) {
  const open = () => onOpen(card.lead_id)
  return (
    <div
      className="lead" tabIndex={0} role="button"
      draggable
      onDragStart={(e) => {
        // The lead id travels on the event, so a drop needs no shared state and
        // cannot act on a stale selection.
        e.dataTransfer.setData('text/plain', card.lead_id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(card.lead_id)
      }}
      onDragEnd={() => onDragEnd?.()}
      style={dragging ? { opacity: 0.4 } : undefined}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
    >
      <div className="n">{card.name || '—'}</div>
      {/* The business they are from. GHL has carried `companyName` all along
          and nothing read it until migration 276 — 1,958 leads had one
          waiting. It goes under the name because that is where somebody
          picking up the phone looks for it. */}
      {card.company && <div className="co">{card.company}</div>}
      {/* The line that mattered, in their own words (migration 234). Verbatim
          from their own turn of the last connected call — never a summary, and
          never Sarah's side of it. A lead who has not spoken shows the number
          instead, because inventing a characterisation for a card somebody
          rings from is worse than showing nothing. */}
      {/* Quote first, reason second, number last (migrations 234 + 239). A
          disqualified lead's reason - "two staff, no sales team" - beats
          whatever they happened to say, and a lead nobody has spoken to shows
          the number rather than an invented characterisation. */}
      {card.said
        ? <div className="q" title={card.phone || undefined}>“{card.said}”</div>
        : card.why
          ? <div className="q" title={card.phone || undefined}>{card.why}</div>
          : <div className="q">{card.phone || '—'}</div>}
      <div className="meta">
        <Dots attempt={card.attempt} steps={steps} ladder={ladder} />
        {/* When we ring next beats how old they are: one is a plan, the other
            is trivia. Falls back to the age when nothing is scheduled. */}
        {card.next_at
          ? <span className="when" style={{ color: 'var(--pink)' }}>{card.next_at}</span>
          : card.waiting_hours != null && card.waiting_hours >= 4
            ? <span className="when" style={{ color: 'var(--warn)' }}>
                waiting {card.waiting_hours < 48
                  ? `${card.waiting_hours}h`
                  : `${Math.round(card.waiting_hours / 24)}d`}
              </span>
            : <span className="when">{oldness(card.age_days) || ''}</span>}
      </div>
      {/* WHAT THEY ASKED FOR, from the call itself - not the column they are
          in. Two leads sit in "talked, not booked" for the same reason and one
          asked for pricing while the other asked for a callback; the column
          cannot tell them apart and this can. */}
      {/* 🔑 NO FALLBACK TO THE LEAD'S HISTORICAL STATUS. `card.status` is
          cf.lead_status_phrase - the ordinary business's view of this person,
          often months old - and rendering it here put "MEETING BOOKED" on a
          lead with 0 of 4 attempts who has never been called by the campaign.
          A campaign card shows campaign facts or nothing; the column has
          already said where they are. */}
      {card.tag
        ? <span className={`tagline ${TAG_TONE[card.tag] || ''}`}>{card.tag}</span>
        : card.reason
          ? <span className="tagline warnt">{humanise(card.reason)}</span>
          : null}
    </div>
  )
}

function Column({ col, index, steps, ladder, onOpen, onDrop, dragging, onDragStart, onDragEnd }) {
  const [showAll, setShowAll] = useState(false)
  const [over, setOver] = useState(false)
  // A column that cannot be set by hand is not a drop target, and says so on
  // hover rather than accepting the card and bouncing it back.
  const settable = !!col.settable
  const cards = col.cards || []
  const CAP = 6
  const shown = showAll ? cards : cards.slice(0, CAP)
  const hiddenHere = cards.length - shown.length
  // The server caps the cards it sends, so a column can hold more people than
  // it can ever show. Said as two different sentences, because "6 more" you can
  // click and "1,204 not sent to the browser" you cannot.
  const beyond = Math.max(0, Number(col.count || 0) - cards.length)
  const bulk = BULK[col.col]
  const finish = FINISH[col.col]
  const dead = col.owner === 'dead'

  return (
    <section
      className={`col${finish ? ' finish' : ''}${dead ? ' parked' : ''}`}
      style={{
        '--accent': accentOf(col.col),
        // Only a settable column lights up. A card hovering over "Signed"
        // should look like it is going nowhere, because it is.
        ...(over && settable ? { outline: '2px solid var(--pink)', outlineOffset: 2 } : {}),
        ...(dragging && !settable ? { opacity: 0.45 } : {}),
      }}
      onDragOver={(e) => {
        if (!settable) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!over) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        if (!settable) return
        e.preventDefault()
        const leadId = e.dataTransfer.getData('text/plain')
        if (leadId) onDrop?.(leadId, col.col, col.label)
      }}
      title={!settable && col.refusal ? col.refusal : undefined}
    >
      <div className="col-head">
        <p className={`owner ${col.owner === 'ron' ? 't' : 's'}`}>
          {col.owner === 'sarah' ? `Sarah · ${index}` : col.owner === 'ron' ? 'Ron · after the meeting' : 'Parked'}
        </p>
        <div className="col-title">
          <h2>{col.label}</h2>
          <span className="col-count" style={dead ? { color: 'var(--muted)' } : undefined}>
            {num(col.count)}
          </span>
        </div>
        <p className="col-sub">{plain(col.hint)}</p>
        {finish && <span className="finish-tag">{finish}</span>}
      </div>

      <div className="stack">
        {shown.length === 0 && (
          // An empty column is normal, not broken — most of this board is
          // legitimately empty until the campaign starts releasing people.
          <p className="col-sub" style={{ padding: '10px 2px', margin: 0 }}>Nobody here yet.</p>
        )}
        {shown.map((card) => (
          <Card
            key={card.lead_id} card={card} steps={steps} ladder={ladder} onOpen={onOpen}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            dragging={dragging === card.lead_id}
          />
        ))}
        {hiddenHere > 0 && (
          <button className="more" onClick={() => setShowAll(true)}>{num(hiddenHere)} more</button>
        )}
        {beyond > 0 && (
          <div className="more" style={{ cursor: 'default', textAlign: 'center' }}>
            {num(beyond)} more not loaded
          </div>
        )}
      </div>

      {bulk && col.count > 0 && (
        <button
          className={`bulk${bulk.tone}`}
          disabled
          title={NO_WRITE}
          style={{ opacity: 0.45, cursor: 'not-allowed' }}
        >
          {typeof bulk.label === 'function' ? bulk.label(col.count) : bulk.label} →
        </button>
      )}
    </section>
  )
}

export default function Pipeline({ openLead }) {
  const c = useCampaign()
  const ov = c.overview.data
  const ladder = ov?.ladder ?? []
  const steps = ladder.length || null
  const stats = ov?.stats
  const [dragging, setDragging] = useState(null)

  /**
   * The drop. It writes through cf_campaign_move_card, which goes through
   * cf.set_state - so GHL gets the stage move and the tags too, not just this
   * board (migration 244).
   *
   * 🔑 NO OPTIMISTIC MOVE. The card stays where it is until the database has
   * confirmed, then the board refetches. An optimistic jump would be a lie for
   * the half-second before a refusal came back, and refusals are common here:
   * most columns are worked out from facts and cannot be set by hand.
   */
  const drop = useCallback(async (leadId, toCol, label) => {
    setDragging(null)
    try {
      const r = await moveCard(leadId, toCol)
      if (r?.moved) {
        toast.success(`Moved to ${label}${r.note ? ` — ${r.note}` : ''}`)
        c.refresh('pipeline')
        c.refresh('overview')
      } else {
        // A refusal is an answer. Show the reason rather than letting the card
        // silently snap back with nothing said.
        toast.error(r?.reason || 'That column cannot be set by hand')
      }
    } catch (e) {
      toast.error(e.message)
    }
  }, [c])

  return (
    <Feed
      feed={c.pipeline}
      what="the board"
      empty={<Empty title="No board yet">Nobody is on the campaign, so there is nothing to place.</Empty>}
    >
      {(pipe) => {
        const cols = pipe.columns || []
        const members = pipe.members ?? null
        const sum = cols.reduce((a, x) => a + Number(x.count || 0), 0)
        const adds = members == null || sum === members

        const sarah = cols.filter((x) => x.owner === 'sarah')
        const ron = cols.filter((x) => x.owner === 'ron')
        const dead = cols.filter((x) => x.owner === 'dead')
        const deadTotal = dead.reduce((a, x) => a + Number(x.count || 0), 0)

        /* The rail. Widths are the real counts, so the collapse from talked to
           booked is something you SEE before you read a number. Only columns
           with somebody in them get a segment — a zero-width bar is a bar
           nobody can read and a claim nobody made. */
        const seg = (x) => {
          const share = widthPct(x.count, sum)
          const tiny = share < 7
          return (
            <div
              key={x.col}
              className={`seg${tiny ? ' tiny' : ''}`}
              title={`${x.label} — ${num(x.count)}`}
              style={{
                flex: Number(x.count) || 0,
                background: accentOf(x.col),
                minWidth: tiny ? 34 : undefined,
                color: DARK_ACCENT.has(x.col) ? 'var(--text)' : undefined,
              }}
            >
              <span>{tiny ? num(x.count) : `${num(x.count)} ${x.label.toLowerCase()}`}</span>
            </div>
          )
        }

        return (
          <>
            <section>
              <div className="rail-head">
                <Eyebrow>
                  {members != null ? `All ${num(members)} leads, and where each one sits right now` : 'Where each lead sits right now'}
                </Eyebrow>
                {/* The sum, shown. Migration 222's non-negotiable, on screen
                    rather than in a test nobody reruns. */}
                <p className="rail-note" style={adds ? undefined : { color: 'var(--warn)' }}>
                  <b>Widths are real.</b>{' '}
                  {adds
                    ? <>{num(sum)} across {cols.length} columns · every lead in exactly one</>
                    : <>{num(sum)} across {cols.length} columns, but {num(members)} on the campaign — somebody is in two columns or none</>}
                </p>
              </div>

              {sum > 0 ? (
                <div className="flow">
                  {sarah.filter((x) => x.count > 0).map(seg)}
                  {ron.some((x) => x.count > 0) && <div className="cut" />}
                  {ron.filter((x) => x.count > 0).map(seg)}
                  {dead.filter((x) => x.count > 0).map(seg)}
                </div>
              ) : (
                <div className="flow">
                  <div className="seg" style={{ flex: 1, background: 'var(--hairline-soft)', color: 'var(--dim)' }}>
                    <span>Nobody on the campaign yet</span>
                  </div>
                </div>
              )}

              {/* Two ownership brackets, each scoring its own side. Sarah's
                  figures stop at the show; Ron's start at the deal — so a bad
                  number has an owner before anyone has to argue about it. */}
              <div className="brackets">
                <div className="brk sarah" style={{ flex: Math.max(Number(pipe.sarah_total) || 0, 1), minWidth: 200 }}>
                  <p>Sarah — call, book, get them to turn up</p>
                  <small>
                    {num(stats?.dials)} called · {num(stats?.connects)} picked up
                    {' · '}{num(stats?.meetings)} booked · {num(stats?.showed)} turned up
                  </small>
                </div>
                <div className="brk team" style={{ flex: Math.max(Number(pipe.ron_total) || 0, 1), minWidth: 150 }}>
                  <p>Your team</p>
                  <small>{num(stats?.closed)} signed · {money(stats?.revenue)}</small>
                </div>
                {deadTotal > 0 && (
                  <div className="brk" style={{ flex: deadTotal, minWidth: 120 }}>
                    <p style={{ color: 'var(--dim)' }}>Closed out</p>
                    <small>{num(deadTotal)} nobody is working</small>
                  </div>
                )}
              </div>
            </section>

            {/* An explicit height is the one adaptation the board needs: the
                design's `.board` fills a flex panel, and here it sits in the
                shell's own scroller. A max rather than a fixed height, so a
                near-empty board on day one stays compact instead of opening a
                screen of nothing. */}
            <main className="board" style={{ maxHeight: 'calc(100vh - 330px)', minHeight: 340, marginTop: 6 }}>
              {sarah.map((col, i) => (
                <Column key={col.col} col={col} index={i + 1} steps={steps} ladder={ladder}
                  onOpen={openLead} onDrop={drop} dragging={dragging}
                  onDragStart={setDragging} onDragEnd={() => setDragging(null)} />
              ))}

              {ron.length > 0 && (
                <div className="handoff-col"><p>Handoff</p><small>Sarah stops here</small></div>
              )}
              {ron.map((col) => (
                <Column key={col.col} col={col} index={0} steps={steps} ladder={ladder}
                  onOpen={openLead} onDrop={drop} dragging={dragging}
                  onDragStart={setDragging} onDragEnd={() => setDragging(null)} />
              ))}

              {dead.length > 0 && <div className="divider"><span>Dead end</span></div>}
              {dead.map((col) => (
                <Column key={col.col} col={col} index={0} steps={steps} ladder={ladder}
                  onOpen={openLead} onDrop={drop} dragging={dragging}
                  onDragStart={setDragging} onDragEnd={() => setDragging(null)} />
              ))}
            </main>
          </>
        )
      }}
    </Feed>
  )
}
