import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { moveCard } from '../../useCampaign'
import { num, ago } from '../../format'
import { C, MONO, Card, Eyebrow, Dot, Feed, Empty } from '../ui'

/**
 * Pipeline — the design's horizontal board, over the campaign's real columns.
 *
 * 🔑 A CARD DOES NOT MOVE UNTIL THE DATABASE SAYS IT DID. Most columns here are
 * worked out from facts — a meeting exists or it does not, a deal is won in GHL
 * or it is not — so a refusal is the normal case, not a fault. An optimistic
 * jump would be a lie for the half-second before the refusal came back.
 *
 * 📌 The design's two side panels are kept, with the campaign's own inputs:
 * "Past due" is `ladder.overdue`, which is the same list the classic view's
 * Follow-ups tab reads. The design's "Worth a look" flag engine has no
 * equivalent here — nothing scores a lead as unanswered-and-unbooked — so that
 * panel shows the nearest thing this system actually measures: people who had a
 * real conversation and did not book, with their own words on the card.
 */

export default function Pipeline({ m, openLead }) {
  const c = m.c
  const [dragging, setDragging] = useState(null)

  const drop = useCallback(async (leadId, toCol, label) => {
    setDragging(null)
    try {
      const r = await moveCard(leadId, toCol)
      if (r?.moved) {
        toast.success(`Moved to ${label}${r.note ? ` — ${r.note}` : ''}`)
        c.refresh('pipeline'); c.refresh('overview')
      } else {
        toast.error(r?.reason || 'That column cannot be set by hand')
      }
    } catch (e) { toast.error(e.message) }
  }, [c])

  return (
    <Feed feed={c.pipeline} what="the board"
          empty={<div style={{ padding: 24 }}><Empty>Nobody is on the campaign, so there is nothing to place.</Empty></div>}>
      {() => (
        <div style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Board m={m} openLead={openLead} drop={drop} dragging={dragging} setDragging={setDragging} />
          <Side m={m} openLead={openLead} />
        </div>
      )}
    </Feed>
  )
}

/* -------------------------------------------------------------------- board */

function Board({ m, openLead, drop, dragging, setDragging }) {
  const sarah = m.board.filter((k) => k.owner === 'sarah')
  const ron = m.board.filter((k) => k.owner !== 'sarah')

  return (
    <Card style={{ flex: 1, minWidth: 320 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Pipeline</div>
        <div style={{ fontSize: 13, color: C.muted, flex: 1, minWidth: 240, lineHeight: 1.5, textWrap: 'pretty' }}>
          Sarah&rsquo;s job ends when someone turns up — {num(m.sarahTotal)} people are hers.
          The {num(m.ronTotal)} past the divider are Ron&rsquo;s. Only the columns a person owns
          can be dragged; the rest are where the campaign has got to.
        </div>
      </div>

      <div style={{ marginTop: 16, overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {sarah.map((col) => (
            <Column key={col.col} col={col} openLead={openLead} drop={drop}
                    dragging={dragging} setDragging={setDragging} />
          ))}

          {/* The literal handoff. It is a line on the board, so nobody has to
              argue about whose number a bad figure is. */}
          {ron.length > 0 && (
            <div style={{
              flex: '0 0 auto', alignSelf: 'stretch', width: 1, margin: '0 6px',
              background: 'linear-gradient(180deg,transparent,rgba(107,168,245,0.6),transparent)',
            }} />
          )}

          {ron.map((col) => (
            <Column key={col.col} col={col} openLead={openLead} drop={drop}
                    dragging={dragging} setDragging={setDragging} />
          ))}
        </div>
      </div>
    </Card>
  )
}

/** A column shows its first 40 cards. The waiting column holds 1,243 people and
 *  a browser asked to lay all of them out drops frames on every drag. */
const CAP = 40

function Column({ col, openLead, drop, dragging, setDragging }) {
  const [over, setOver] = useState(false)
  const settable = !!col.settable
  const cards = col.cards || []
  const shown = cards.slice(0, CAP)

  return (
    <div
      onDragOver={(e) => { if (settable) { e.preventDefault(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false)
        if (!settable) return
        const leadId = e.dataTransfer.getData('text/plain')
        if (leadId) drop(leadId, col.col, col.label)
      }}
      title={!settable && col.refusal ? col.refusal : undefined}
      style={{
        flex: '0 0 auto', width: 208, background: C.raised, borderRadius: 14, padding: 12,
        border: `1px solid ${over && settable ? C.pink : C.lineSoft}`,
        opacity: dragging && !settable ? 0.45 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px 10px' }}>
        <Dot color={col.colour} size={8} />
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{col.label}</span>
        <span className="mono" style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>{num(col.count)}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '56vh', overflowY: 'auto' }}>
        {shown.map((k) => (
          <LeadCard key={k.lead_id} card={k} colour={col.colour} settable={settable}
                    onOpen={() => openLead(k.lead_id)} setDragging={setDragging} />
        ))}

        {cards.length > CAP && (
          <div style={{ fontSize: 11, color: C.dim, padding: '4px 2px' }} className="mono">
            + {num(cards.length - CAP)} more
          </div>
        )}
        {cards.length === 0 && (
          <div style={{ fontSize: 12, color: C.muted, padding: '4px 2px', lineHeight: 1.45 }}>
            {col.hint || 'Nobody here.'}
          </div>
        )}
      </div>
    </div>
  )
}

function LeadCard({ card, colour, settable, onOpen, setDragging }) {
  return (
    <div
      draggable={settable}
      onDragStart={(e) => {
        if (!settable) { e.preventDefault(); return }
        e.dataTransfer.setData('text/plain', card.lead_id)
        e.dataTransfer.effectAllowed = 'move'
        setDragging(card.lead_id)
      }}
      onDragEnd={() => setDragging(null)}
      onClick={onOpen}
      className="cfa-outline"
      style={{
        background: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 11,
        padding: '10px 11px', cursor: settable ? 'grab' : 'pointer',
        borderLeft: `3px solid ${colour}`,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {card.name || 'Unnamed'}
      </div>
      {card.company && (
        <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
          {card.company}
        </div>
      )}
      <div className="mono" style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>
        {[card.attempt != null ? `attempt ${card.attempt}` : null,
          card.last_call_at ? ago(card.last_call_at) : null].filter(Boolean).join(' · ') || card.phone}
      </div>
      {card.next_at && (
        <div className="mono" style={{
          fontSize: 11, color: C.pinkSoft, marginTop: 5,
          borderTop: `1px solid ${C.lineSoft}`, paddingTop: 5,
        }}>next {card.next_at}</div>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- side panels */

function Side({ m, openLead }) {
  const overdue = m.c.ladder.data?.overdue || []
  const talked = (m.cardsOf('talked_not_booked') || []).filter((k) => k.said).slice(0, 12)

  return (
    <div style={{ width: 320, minWidth: 280, flex: '0 1 320px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card edge="rgba(245,158,11,0.4)" pad={18} style={{ borderStyle: 'dashed' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Talked, no meeting</div>
          <span className="mono" style={{
            fontSize: 12, color: C.muted, background: 'rgba(255,255,255,0.06)',
            padding: '2px 8px', borderRadius: 999,
          }}>{num(m.countOf('talked_not_booked'))}</span>
          <div style={{ fontSize: 11, color: C.muted, width: '100%', lineHeight: 1.45, marginTop: 4 }}>
            Reached, had a real conversation, no meeting agreed. Their own words, so you can see
            which are worth a second call.
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {talked.map((k) => (
            <div key={k.lead_id} onClick={() => openLead(k.lead_id)} className="cfa-outline"
                 style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 10, padding: '9px 11px', cursor: 'pointer' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{k.name || 'Unnamed'}</div>
              <div style={{
                fontSize: 12, color: C.soft, marginTop: 4, lineHeight: 1.45,
                borderLeft: `2px solid rgba(236,72,153,0.4)`, paddingLeft: 9, textWrap: 'pretty',
              }}>{k.said}</div>
            </div>
          ))}
          {talked.length === 0 && (
            <div style={{ fontSize: 13, color: C.muted }}>Nobody has been reached and left unbooked yet.</div>
          )}
        </div>
      </Card>

      <Card pad={18}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Past due</div>
          <span className="mono" style={{
            fontSize: 12, color: C.muted, background: 'rgba(255,255,255,0.06)',
            padding: '2px 8px', borderRadius: 999,
          }}>{num(m.c.ladder.data?.overdue_count)}</span>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
          {overdue.slice(0, 20).map((r) => (
            <div key={r.lead_id} onClick={() => openLead(r.lead_id)} className="cfa-row"
                 style={{ padding: '8px 10px', borderRadius: 9, cursor: 'pointer' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name || 'Unnamed'}</div>
              <div className="mono" style={{ fontSize: 11, color: C.warn, marginTop: 2 }}>
                attempt {r.step} · {r.late_minutes != null ? `${num(r.late_minutes)} min late` : 'past due'}
                {r.reason ? ` · ${r.reason}` : ''}
              </div>
            </div>
          ))}
          {overdue.length === 0 && (
            <div style={{ fontSize: 13, color: C.muted }}>Nothing is past the time it should have been called.</div>
          )}
        </div>
      </Card>
    </div>
  )
}
