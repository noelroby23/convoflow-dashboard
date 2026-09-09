import { useState } from 'react'
import { toast } from 'sonner'
import { num, ago } from '../../format'
import { C, Card, Eyebrow, Num, Dot, Pill, ghostBtn } from '../ui'

/**
 * Handover — the people a human has to pick up, and why.
 *
 * Three groups, each from a column the board already owns:
 *
 *   SUPER HOT      a call said this needs a person today. `super_hot` carries
 *                  `stops_contact`, so the robot has already gone quiet on them
 *                  — nothing is chasing these while they sit here.
 *   DIDN'T TURN UP they agreed to a meeting and it did not happen (§7 item 224).
 *   TALKED, NO MEETING  reached, had a real conversation, no meeting agreed.
 *
 * ⚠️ NOTHING HERE CAN BE "MARKED DONE". The source design has a Done button that
 * writes to localStorage; a button whose only effect is on the machine that
 * pressed it is the promise-with-nothing-behind-it pattern this project has paid
 * for repeatedly (§7 items 96/106/111). Moving somebody out of a group is a real
 * write, and it lives on the Pipeline board where the refusal reasons are shown.
 */

export default function Handover({ m, openLead, goTo }) {
  const groups = [
    {
      id: 'super_hot',
      title: 'Needs a human today',
      note: 'A call flagged these as ready. The dialler has already stopped on them, so nothing is happening until somebody rings.',
      colour: C.pink, edge: 'rgba(236,72,153,0.35)',
    },
    {
      id: 'no_show',
      title: 'Booked and did not turn up',
      note: 'They agreed to a meeting and it did not happen. Worth one more call before this goes cold.',
      colour: C.bad, edge: 'rgba(239,68,68,0.3)',
    },
    {
      id: 'talked_not_booked',
      title: 'Talked, no meeting agreed',
      note: 'Reached and had a real conversation. Their own words are on the card, so you can pick the ones worth a second try.',
      colour: C.muted, edge: C.lineSoft,
    },
  ].map((g) => ({ ...g, count: m.countOf(g.id), cards: m.cardsOf(g.id) }))

  const total = groups.reduce((n, g) => n + (g.count || 0), 0)

  return (
    <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
      <Card pad={24} style={{ borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <Num size={44} color={C.pink}>{num(total)}</Num>
          <div style={{ flex: 1, minWidth: 220, fontSize: 15, fontWeight: 500, lineHeight: 1.5, textWrap: 'pretty' }}>
            people the agent has taken as far as it can. Everything below this line is a
            conversation a person has to have.
          </div>
        </div>
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {groups.map((g) => (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              border: `1px solid ${C.lineSoft}`, borderRadius: 12,
            }}>
              <Dot color={g.colour} size={8} />
              <span style={{ fontSize: 12, color: C.muted, flex: 1, minWidth: 0, lineHeight: 1.35 }}>{g.title}</span>
              <span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{num(g.count)}</span>
            </div>
          ))}
        </div>
      </Card>

      {groups.map((g) => (
        <Card key={g.id} edge={g.edge} pad={22} style={{ borderRadius: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
            <Dot color={g.colour} size={9} />
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.008em' }}>{g.title}</div>
            <span className="mono" style={{
              fontSize: 12, color: C.muted, background: 'rgba(255,255,255,0.06)',
              padding: '2px 9px', borderRadius: 999,
            }}>{num(g.count)}</span>
            <button className="cfa-ghost" style={{ ...ghostBtn, marginLeft: 'auto', fontSize: 12, padding: '6px 11px' }}
                    onClick={() => goTo('pipeline')}>Move on the board</button>
          </div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>{g.note}</div>

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {g.cards.slice(0, 25).map((r) => <Person key={r.lead_id} r={r} openLead={openLead} />)}
            {g.count === 0 && <div style={{ fontSize: 14, color: C.muted }}>Nobody here right now.</div>}
            {g.cards.length > 25 && (
              <div className="mono" style={{ fontSize: 12, color: C.dim }}>+ {num(g.cards.length - 25)} more on the board</div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

const initials = (name) => (name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

function Person({ r, openLead }) {
  const [copied, setCopied] = useState(false)

  const copy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(r.phone || '')
      setCopied(true); setTimeout(() => setCopied(false), 1600)
    } catch { toast.error('Could not reach the clipboard — select the number and copy it') }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
      padding: '14px 0', borderTop: `1px solid ${C.lineSoft}`,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 12, flex: '0 0 auto',
        background: 'rgba(236,72,153,0.14)', color: C.pinkSoft,
        display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
      }}>{initials(r.name)}</div>

      <div onClick={() => openLead(r.lead_id)} style={{ flex: 1, minWidth: 220, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.005em' }}>{r.name || 'Unnamed'}</span>
          {r.company && <span style={{ fontSize: 14, color: C.soft }}>{r.company}</span>}
          <span className="mono" style={{ fontSize: 13, color: C.muted, userSelect: 'all' }}>{r.phone}</span>
          {r.last_call_at && <span className="mono" style={{ fontSize: 12, color: C.warn }}>{ago(r.last_call_at)}</span>}
        </div>
        {r.said && (
          <div style={{
            fontSize: 15, color: C.text, marginTop: 8, lineHeight: 1.55, textWrap: 'pretty',
            borderLeft: '2px solid rgba(236,72,153,0.45)', paddingLeft: 11,
          }}>{r.said}</div>
        )}
        <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
          {r.tag && <Pill tone="booked">{r.tag}</Pill>}
          {r.status && <Pill tone="cancelled">{r.status}</Pill>}
          {r.attempt != null && <Pill tone="cancelled">attempt {r.attempt}</Pill>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="cfa-ghost" style={ghostBtn} onClick={copy}>
          {copied ? 'Copied' : 'Copy number'}
        </button>
        {r.phone && (
          <a className="cfa-ghost cfa-link" style={{ ...ghostBtn, textDecoration: 'none' }}
             href={`https://wa.me/${String(r.phone).replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"
             onClick={(e) => e.stopPropagation()}>WhatsApp</a>
        )}
      </div>
    </div>
  )
}
