import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { fetchMeetings, setMeetingOutcome } from '../../useCampaign'
import { num, pct, fmtTime, fmtDay, fmtDow } from '../../format'
import { C, Card, Eyebrow, Num, Pill, Dot, ghostBtn, solidBtn, Loading, Failed } from '../ui'

/**
 * Meetings — booked, to mark, and settled.
 *
 * 🔑 NOTHING ON THIS PAGE MARKS A MEETING BY ITSELF. §5.6: an outcome is set by
 * a human and never by the system. The no-show sweep was stripped of its write
 * in migration 285 precisely because a GHL workflow was stamping every meeting
 * "attended" thirty minutes after its start — so a meeting whose time has passed
 * now waits here until a person says what happened, and the counter at the top
 * is the only prompt anybody gets.
 *
 * ⚠️ The meetings feed is the whole location's, not the campaign's. It is
 * filtered to the campaign's own people here, using the member list the board
 * already loaded — see `fetchMeetings`'s note.
 */

export default function Meetings({ m, openLead }) {
  const [all, setAll] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    try {
      // The whole visible span in one read: the feed self-limits to the last
      // two days and the next fourteen unless a window is passed.
      setAll(await fetchMeetings({}) || [])
      setError(null)
    } catch (e) { setError(e) }
  }, [])

  useEffect(() => { load() }, [load])

  /** Only this campaign's people. A lead id not on the board is somebody else's
   *  meeting, and counting it here would put the main funnel's numbers under
   *  the campaign's name (§7 item 210). */
  const mine = useMemo(() => {
    if (!all || !m.pipe) return null
    const card = new Map(m.allCards.map((k) => [k.lead_id, k]))
    return all.filter((a) => card.has(a.lead_id)).map((a) => ({
      ...a,
      // 🔑 THE NAME COMES OFF THE BOARD, not off this feed. `cf_dash_meetings`
      // returns `cf.lead.full_name` raw, where the board passes it through
      // `cf.proper_name()` — so the same person read "nicolas abinader" here and
      // "Nicolas Abinader" one page across. Case-fixing it in the component
      // would have been a third spelling: `initcap` flattens McDonald and
      // O'Brien, which is exactly why that function exists in SQL.
      name: card.get(a.lead_id)?.name || a.name,
      company: card.get(a.lead_id)?.company || null,
    }))
  }, [all, m.pipe, m.allCards])

  const mark = async (a, outcome) => {
    setBusy(a.event_id)
    try {
      await setMeetingOutcome(a.event_id, outcome)
      toast.success(`${a.name} marked ${outcome === 'attended' ? 'showed' : outcome}`)
      await load()
      m.c.refresh('pipeline'); m.c.refresh('overview'); m.c.refresh('funnel')
    } catch (e) {
      toast.error(e.message)
    } finally { setBusy(null) }
  }

  const now = Date.now()
  const groups = useMemo(() => {
    if (!mine) return null
    const upcoming = [], toMark = [], settled = []
    for (const a of mine) {
      const t = new Date(a.start_at).getTime()
      if (a.status === 'booked' || a.status === 'confirmed') (t > now ? upcoming : toMark).push(a)
      else settled.push(a)
    }
    const byTime = (x, y) => new Date(x.start_at) - new Date(y.start_at)
    return { upcoming: upcoming.sort(byTime), toMark: toMark.sort(byTime), settled: settled.sort((x, y) => -byTime(x, y)) }
  }, [mine, now])

  const showRate = m.liveShow == null ? null : Math.round(m.liveShow * 100)

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.015em' }}>Meetings</div>
        <Stat label="Show rate" value={showRate == null ? '—' : `${showRate}%`}
              sub={`${num(m.showed?.actual)} of ${num(m.booked?.actual)} booked`}
              color={showRate == null ? C.muted : showRate >= 50 ? C.good : showRate >= 35 ? C.warn : C.bad} />
        <Stat label="Booked" value={num(m.booked?.actual)} />
        <Stat label="To mark" value={num(groups?.toMark.length)}
              color={groups?.toMark.length ? C.warn : C.text} />
      </div>

      {error && <Failed error={error} what="the meetings" />}
      {!mine && !error && <Loading what="the meetings" />}

      {groups && (
        <>
          <Group
            label="Needs an outcome" count={groups.toMark.length}
            note="These have happened and nobody has said what happened. Nothing in the system will decide it — the show rate above stays wrong until somebody does."
            empty="Every meeting that has happened has an outcome on it."
          >
            {groups.toMark.map((a) => (
              <Row key={a.event_id} a={a} openLead={openLead} busy={busy === a.event_id}
                   actions={[
                     { label: 'Showed', tone: 'good', onClick: () => mark(a, 'attended') },
                     { label: 'No-show', tone: 'bad', onClick: () => mark(a, 'missed') },
                     { label: 'Cancelled', tone: 'dim', onClick: () => mark(a, 'cancelled') },
                   ]} />
            ))}
          </Group>

          <Group label="Still to come" count={groups.upcoming.length}
                 empty="No meetings on the books.">
            {groups.upcoming.map((a) => (
              <Row key={a.event_id} a={a} openLead={openLead} busy={busy === a.event_id} />
            ))}
          </Group>

          <Group label="Settled" count={groups.settled.length}
                 empty="Nothing settled in this campaign yet.">
            {groups.settled.map((a) => (
              <Row key={a.event_id} a={a} openLead={openLead} busy={busy === a.event_id} />
            ))}
          </Group>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color = C.text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <Eyebrow size={12} style={{ fontWeight: 600 }}>{label}</Eyebrow>
      <span className="mono" style={{ fontSize: 17, fontWeight: 700, color }}>{value}</span>
      {sub && <span className="mono" style={{ fontSize: 12, color: C.muted }}>{sub}</span>}
    </div>
  )
}

function Group({ label, count, note, empty, children }) {
  const any = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <Eyebrow size={11} style={{ letterSpacing: '0.12em' }}>{label}</Eyebrow>
        <span className="mono" style={{ fontSize: 12, color: C.muted }}>{num(count)}</span>
      </div>
      {note && any && (
        <div style={{ fontSize: 13, color: C.warn, marginBottom: 12, lineHeight: 1.5, maxWidth: '70ch', textWrap: 'pretty' }}>{note}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {any ? children : <div style={{ fontSize: 14, color: C.muted }}>{empty}</div>}
      </div>
    </div>
  )
}

const TONE_OF = { attended: 'showed', missed: 'no_show', cancelled: 'cancelled', booked: 'booked', confirmed: 'booked' }

function Row({ a, openLead, actions, busy }) {
  const t = new Date(a.start_at)
  const past = t.getTime() < Date.now()

  return (
    <Card pad={14} style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      borderColor: actions ? 'rgba(245,158,11,0.35)' : C.lineSoft,
    }}>
      <div style={{ width: 76, flex: '0 0 auto' }}>
        <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: past ? C.muted : C.text }}>
          {fmtTime(a.start_at)}
        </div>
        <div className="mono" style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
          {fmtDow(a.start_at)} {fmtDay(a.start_at)}
        </div>
      </div>

      <div onClick={() => openLead(a.lead_id)} style={{ flex: 1, minWidth: 200, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.005em' }}>{a.name}</span>
          {a.company && <span style={{ fontSize: 14, color: C.soft }}>{a.company}</span>}
          <Pill tone={TONE_OF[a.status] || 'cancelled'}>{a.status}</Pill>
          {a.same_day && <Pill tone="booked">same day</Pill>}
        </div>
        <div className="mono" style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{a.phone}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        {a.link && (
          <a className="cfa-ghost cfa-link" href={a.link} target="_blank" rel="noreferrer"
             style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}>Meet link</a>
        )}
        {actions?.map((b) => (
          <button key={b.label} onClick={b.onClick} disabled={busy}
                  className={b.tone === 'good' ? 'cfa-solid' : 'cfa-ghost'}
                  style={b.tone === 'good'
                    ? { ...solidBtn, padding: '7px 13px', fontSize: 13, opacity: busy ? 0.5 : 1 }
                    : { ...ghostBtn, opacity: busy ? 0.5 : 1, color: b.tone === 'bad' ? C.badSoft : C.muted }}>
            {b.label}
          </button>
        ))}
      </div>
    </Card>
  )
}
