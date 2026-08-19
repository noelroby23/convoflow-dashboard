import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Banknote, Loader2, ExternalLink, Plus, UserPlus, X} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'
import { Panel, PipelineFlow } from '../components/ui/Console'
import { useDashboardOverview, useCfGrowth } from '../hooks/useDashboardOverview'
import PrepSheet from '../components/ui/PrepSheet'
import { toast } from 'sonner'

/**
 * Sales Desk — everything after the booking is done.
 *
 * Two boards because the two questions live in two different GHL pipelines:
 * meetings move through mainFlow UAE, deals through Post Meeting Sales UAE.
 * Cards on both, dragged the same way, so there is one interaction to learn.
 *
 * 🔑 A DROP WRITES TO GHL FIRST. cf-deal-move updates the opportunity and only
 * records the move here if GHL accepted it. If GHL refuses, the card springs
 * back and says why — a board that shows a move the CRM never took is worse
 * than one that refuses.
 */

const AED = (n) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
const DUBAI = 'Asia/Dubai'
const when = (iso) => iso
  ? new Date(iso).toLocaleString('en-GB', { timeZone: DUBAI, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—'

// Meeting columns map onto lead_state, which cf.set_state already mirrors to
// GHL. Nothing new is invented here.
// Kept in step with cf.lead_channel. A label here and a key there is fine;
// two lists of CHANNELS would drift, which is why the picker reads cf_channels.
const CHANNEL_LABEL = {
  meta_ads: 'Meta ads', website: 'Website', referral: 'Referral',
  organic: 'Organic', outbound: 'Outbound', partner: 'Partner', other: 'Other',
}


// Adds somebody to the sales pipeline. Two callers, one path: a brand-new
// prospect typed into the desk, and an attended lead that has no deal yet.
//
// 🔑 IT GOES THROUGH THE EDGE FUNCTION, NOT STRAIGHT TO THE DATABASE, because
// GHL owns the sale. cf-prospect creates the contact and the opportunity there
// FIRST and records them here only on success — a deal that exists in the
// dashboard and not in GHL is invisible to the people actually selling.
async function addToPipeline(body) {
  const { data: session } = await supabase.auth.getSession()
  const token = session?.session?.access_token
  const res = await fetch(`${supabase.supabaseUrl}/functions/v1/cf-prospect`, {
    method: 'POST',
    headers: {
      apikey: supabase.supabaseKey,
      Authorization: `Bearer ${token ?? supabase.supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const out = await res.json().catch(() => null)
  if (!res.ok || out?.ok === false) {
    throw new Error(out?.error ? `${out.error}` : `HTTP ${res.status}`)
  }
  return out
}


// Abdus: "I need to be able to create cards and create prospects in the sales
// desk. Also some people have come in organically through my other channels."
//
// The channel is asked for at creation rather than inferred, because that is
// the whole point: a lead that arrived through a referral must not have ad
// spend divided by it (§7 item 172's neighbour — cost per lead is only honest
// over the leads the ads actually produced).
function NewProspect({ channels, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState('referral')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try { await onCreate({ name: name.trim(), phone: phone.trim() || null, channel, value: Number(value) || 0 }) }
    finally { setSaving(false) }
  }

  return (
    <div className="cf-ld__scrim" onClick={onClose}>
      <form className="cf-new" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <header className="cf-ld__head">
          <h2 className="cf-ld__name">New prospect</h2>
          <button type="button" onClick={onClose} className="cf-ld__x"><X size={13} /> Close</button>
        </header>
        <div className="cf-new__body">
          <label className="cf-new__f">
            <span>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus required />
          </label>
          <label className="cf-new__f">
            <span>Phone</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+9715…" />
          </label>
          <label className="cf-new__f">
            <span>Where did they come from?</span>
            <select value={channel} onChange={e => setChannel(e.target.value)}>
              {channels.map(c => (
                <option key={c.channel_key} value={c.channel_key}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="cf-new__f">
            <span>Deal value (AED)</span>
            <input value={value} onChange={e => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
                   inputMode="decimal" placeholder="0" />
          </label>
          <p className="cf-new__note">
            Creates the contact and the opportunity in GHL first, then records it here.
          </p>
        </div>
        <footer className="cf-new__foot">
          <button type="submit" className="cf-new__go" disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Add to pipeline'}
          </button>
        </footer>
      </form>
    </div>
  )
}

const MEETING_STATE = {
  booked: 'meeting_booked',
  attended: 'meeting_attended',
  missed: 'meeting_missed',
  // Abdus: "a lot of these I didn't attend because they are disqualified."
  // Filing that as a no-show would hand the lead to the 10-touch recovery —
  // ten calls and seven messages chasing somebody already ruled out.
  disqualified: 'disqualified',
}

function Card({ children, onDragStart, dim, onOpen }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className={`cf-card${dim ? ' is-dim' : ''}${onOpen ? ' is-clickable' : ''}`}
    >
      {children}
    </div>
  )
}

function Column({ title, count, value, tone, onDrop, onDragOver, over, children, hint }) {
  return (
    <div
      className={`cf-col${over ? ' is-over' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="cf-col__head">
        <span className="cf-col__dot" style={{ background: tone }} />
        <span className="cf-col__title">{title}</span>
        <span className="cf-col__count">{count}</span>
      </div>
      {value != null && (
        <div className="cf-col__value">AED {AED(value)}</div>
      )}
      <div className="cf-col__body">
        {children}
        {count === 0 && <p className="cf-col__empty">{hint ?? 'Empty'}</p>}
      </div>
    </div>
  )
}

export default function SalesDesk() {
  const refreshKey = useDashboard(s => s.refreshKey)
  const dateRange = useDashboard(s => s.dateRange)
  // The header's date range applies, the same as every other page. It was
  // opt-in behind a second toggle, which meant setting the picker did nothing
  // and looked broken — a filter you have to find twice is not a filter.
  //
  // The risk it was guarding is real though: 129 of 144 open deals opened more
  // than three weeks ago, so a short range empties the board. So the range
  // applies AND the page offers a way straight out of it, rather than hiding
  // the control and the consequence both.
  const [showAll, setShowAll] = useState(false)
  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [drag, setDrag] = useState(null)     // { kind, id, from }
  const [over, setOver] = useState(null)
  const [newOpen, setNewOpen] = useState(false)
  const [channels, setChannels] = useState([])
  // Same hook Home uses, deliberately: one source means the funnel reads
  // identically on both pages and cannot drift.
  const { data: overview } = useDashboardOverview(dateRange?.from, dateRange?.to)
  const { data: growth } = useCfGrowth(dateRange?.from, dateRange?.to)
  // Clicking a card opens the prep sheet, not the full record: this page
  // is used in the minute before a call, not for a post-mortem.
  const [prep, setPrep] = useState(null)

  const load = useCallback(async () => {
    const p = showAll
      ? { region: 'uae' }
      : { region: 'uae', from: dateRange.from, to: dateRange.to }
    const { data, error } = await supabase.rpc('cf_dash_sales_board', { p })
    if (error) { toast.error(error.message); setLoading(false); return }
    setBoard(Array.isArray(data) ? data[0] : data)
    setLoading(false)
  }, [showAll, dateRange.from, dateRange.to])

  useEffect(() => { load() }, [load, refreshKey])

  // ── moving a deal ──────────────────────────────────────────────────────
  const moveDeal = async (opportunityId, stageId) => {
    setBusy(opportunityId)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const res = await fetch(
        `${supabase.supabaseUrl}/functions/v1/cf-deal-move`,
        {
          method: 'POST',
          headers: {
            apikey: supabase.supabaseKey,
            Authorization: `Bearer ${token ?? supabase.supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ opportunity_id: opportunityId, stage_id: stageId }),
        })
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.ok === false) {
        // Say where it failed. "Something went wrong" sends someone to the
        // wrong system to look for it.
        throw new Error(body?.where === 'ghl'
          ? `GHL refused the move — ${String(body.error).slice(0, 120)}`
          : (body?.error ?? `HTTP ${res.status}`))
      }
      toast.success(`Moved to ${body.stage}${body.status !== 'open' ? ` · ${body.status}` : ''}`)
      await load()
    } catch (e) {
      toast.error(e.message || 'Could not move that deal')
      await load()   // snap the card back to the truth
    } finally {
      setBusy(null)
    }
  }

  // ── setting a deal's value ─────────────────────────────────────────────
  // Same write as a move — GHL first, then us — because the value lives on the
  // GHL opportunity and revenue is computed from it. Sending the deal's own
  // stage means the card does not move, only the number changes.
  const setValue = async (deal, stageId) => {
    const raw = window.prompt(`Deal value for ${deal.name} (AED)`, deal.value ?? '')
    if (raw === null) return
    const cleaned = String(raw).replace(/[^0-9.]/g, '')
    if (cleaned === '') { toast.error('Enter a number, or cancel'); return }
    setBusy(deal.id)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/cf-deal-move`, {
        method: 'POST',
        headers: {
          apikey: supabase.supabaseKey,
          Authorization: `Bearer ${token ?? supabase.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opportunity_id: deal.id, stage_id: stageId, value: Number(cleaned) }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.where === 'ghl'
          ? `GHL refused it — ${String(body.error).slice(0, 120)}`
          : (body?.error ?? `HTTP ${res.status}`))
      }
      toast.success(`Value saved to GHL · AED ${AED(cleaned)}`)
      await load()
    } catch (e) {
      toast.error(e.message || 'Could not save that value')
      await load()
    } finally {
      setBusy(null)
    }
  }

  // ── moving a meeting ───────────────────────────────────────────────────
  // One verb, cf_set_meeting_outcome, because a meeting outcome lives in two
  // places: the appointment (what Home, Lead Desk and this board all count)
  // and the lead's state (what GHL mirrors). The first version of this called
  // cf_dash_set_state, which writes only the second — so Home never moved and
  // the card sprang back to its old column, since this board reads the first.
  const moveMeeting = async (eventId, columnKey) => {
    if (!MEETING_STATE[columnKey] && columnKey !== 'cancelled') {
      toast.error('Meetings cannot be dragged to that column'); return
    }
    setBusy(eventId)
    try {
      const { data, error } = await supabase.rpc('cf_set_meeting_outcome', {
        p: { ghl_event_id: eventId, outcome: columnKey },
      })
      const body = Array.isArray(data) ? data[0] : data
      if (error) throw new Error(error.message)
      if (body?.ok === false) throw new Error(body.error)
      toast.success(`Marked ${columnKey === 'missed' ? 'no-show' : columnKey} · Home and GHL updated`)

      // Attending is what puts somebody into the sales pipeline. Doing it on
      // the drag rather than on a separate strip means one action, not two —
      // and a lead can no longer sit attended-but-invisible, which is how 13
      // of 23 ended up on no sales board at all.
      if (columnKey === 'attended') {
        const card = (board?.meetings ?? [])
          .flatMap(c => c.cards ?? []).find(c => c.id === eventId)
        if (card?.lead_id) {
          try {
            const r = await addToPipeline({
              name: card.name, phone: card.phone, channel: card.channel,
              ghl_contact_id: card.ghl_contact_id, lead_id: card.lead_id,
            })
            if (r?.already) toast.message(`${card.name} is already in the pipeline`)
            else toast.success(`${card.name} added to the sales pipeline`)
          } catch (e) {
            // The meeting outcome is already saved; only the pipeline step
            // failed. Say which, rather than implying the drag was lost.
            toast.error(`Marked attended, but not added to the pipeline — ${e.message}`)
          }
        }
      }
      await load()
    } catch (e) {
      toast.error(e.message || 'Could not update that meeting')
      await load()   // snap the card back to the truth
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    supabase.rpc('cf_channels', { p: {} }).then(({ data }) => setChannels(data ?? []))
  }, [])

  // Promote an attended lead. The contact already exists in GHL, so only the
  // opportunity is created.
  const promote = async (lead) => {
    setBusy(lead.lead_id)
    try {
      await addToPipeline({
        name: lead.name, phone: lead.phone,
        ghl_contact_id: lead.ghl_contact_id, channel: lead.channel,
      })
      toast.success(`${lead.name} added to the pipeline`)
      await load()
    } catch (e) {
      toast.error(e.message || 'Could not add them')
    } finally {
      setBusy(null)
    }
  }

  const onDrop = (kind, target) => (e) => {
    e.preventDefault()
    setOver(null)
    if (!drag || drag.kind !== kind) return
    if (drag.from === target) return
    if (kind === 'deal') moveDeal(drag.id, target)
    else moveMeeting(drag.id, target)
    setDrag(null)
  }

  const allow = (key) => (e) => { e.preventDefault(); setOver(key) }

  const stalled = useMemo(() => {
    const cols = board?.sales ?? []
    return cols.flatMap(c => (c.deals ?? []).filter(d => d.age_days >= 21)
      .map(d => ({ ...d, stage: c.stage_name })))
  }, [board])

  if (loading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 w-full" />)}</div>
  }

  return (
    <div className="space-y-5">
      <PrepSheet leadId={prep} onClose={() => setPrep(null)} />

      {/* The same funnel Home shows, fed by the same hook, so the two pages
          cannot report different numbers for one window. */}
      <Panel eyebrow="The pipeline" title="Where the money is coming from">
        <PipelineFlow kpis={overview} growth={growth} />
      </Panel>
      {/* Meetings first: nothing reaches the sales board until a meeting has
          happened, so the order on screen matches the order in real life. */}
      <Panel eyebrow="After the booking" title="Meetings"
             right={<span className="text-[11px] text-[#57544E]">drag a card to change the outcome · writes to GHL</span>}>
        <div className="cf-board">
          {(board?.meetings ?? []).map(col => (
            <Column
              key={col.key}
              title={col.label}
              count={col.count}
              tone={col.key === 'attended' ? '#34D399' : col.key === 'missed' ? '#F87171'
                   : col.key === 'disqualified' ? '#A78BFA'
                   : col.key === 'cancelled' ? '#6B6862' : '#EC4899'}
              over={over === `m:${col.key}`}
              onDragOver={allow(`m:${col.key}`)}
              onDrop={onDrop('meeting', col.key)}
              hint={col.key === 'booked' ? 'Nothing booked'
                  : col.key === 'disqualified' ? 'Drag here if they are not a fit'
                  : col.key === 'missed' ? 'Drag here if they did not show'
                  : 'None'}
            >
              {(col.cards ?? []).map(c => (
                <Card key={c.id} dim={busy === c.id}
                      onOpen={() => c.lead_id && setPrep(c.lead_id)}
                      onDragStart={() => setDrag({ kind: 'meeting', id: c.id, leadId: c.lead_id, from: col.key })}>
                  <div className="cf-card__name">{c.name}</div>
                  <div className="cf-card__meta">{when(c.when)}</div>
                  {c.channel && <div className="cf-card__tag">{CHANNEL_LABEL[c.channel] ?? c.channel}</div>}
                  {c.ad && <div className="cf-card__tag">{c.ad}</div>}
                  {c.link && (
                    <a href={c.link} target="_blank" rel="noreferrer" className="cf-card__link">
                      <ExternalLink size={11} /> join
                    </a>
                  )}
                </Card>
              ))}
            </Column>
          ))}
        </div>

      </Panel>

      {newOpen && (
        <NewProspect
          channels={channels}
          onClose={() => setNewOpen(false)}
          onCreate={async (body) => {
            try {
              await addToPipeline(body)
              toast.success(`${body.name} added to the pipeline`)
              setNewOpen(false)
              await load()
            } catch (e) {
              toast.error(e.message || 'Could not create that prospect')
            }
          }}
        />
      )}

      {/* Sales */}
      <Panel eyebrow="Sales pipeline"
             title={`AED ${AED(board?.pipeline_value)} open`}
             right={
               <div className="flex items-center gap-3">
                 {/* Always say what is hidden. A board that quietly drops 132
                     of 144 deals reads as data loss, not as a filter. */}
                 <span className="text-[11px] text-[#57544E]">
                   {board?.ranged
                     ? `${board?.deals_shown ?? 0} of ${board?.deals_total ?? 0} open deals opened in this range`
                     : `${board?.deals_total ?? 0} open · ${board?.won_all ?? 0} won · ${board?.lost_all ?? 0} lost`}
                 </span>
                 <button type="button" onClick={() => setNewOpen(true)} className="cf-newbtn">
                   <UserPlus size={12} /> New prospect
                 </button>
                 <button type="button" onClick={() => setShowAll(v => !v)}
                   title={showAll
                     ? 'Currently ignoring the date range'
                     : `Deals opened ${dateRange.from} to ${dateRange.to}`}
                   className={`cf-seg-btn${showAll ? ' is-on' : ''}`}>
                   {showAll ? 'Showing all dates' : 'Show all dates'}
                 </button>
               </div>
             }>
        {board?.ranged && (board?.deals_shown ?? 0) === 0 && (board?.deals_total ?? 0) > 0 && (
          <div className="cf-emptyrange">
            No deals were <em>opened</em> between {dateRange.from} and {dateRange.to}.
            Your {board.deals_total} open deals are all older than that.
            <button type="button" onClick={() => setShowAll(true)} className="cf-emptyrange__btn">
              Show all dates
            </button>
          </div>
        )}
        <div className="cf-board cf-board--wide">
          {(board?.sales ?? []).map(col => (
            <Column
              key={col.stage_id}
              title={col.stage_name}
              count={col.count}
              value={col.value}
              tone={col.is_won ? '#10B981' : col.is_lost ? '#F43F5E' : '#60A5FA'}
              over={over === `s:${col.stage_id}`}
              onDragOver={allow(`s:${col.stage_id}`)}
              onDrop={onDrop('deal', col.stage_id)}
            >
              {(col.deals ?? []).map(d => (
                <Card key={d.id} dim={busy === d.id}
                      onOpen={() => d.lead_id && setPrep(d.lead_id)}
                      onDragStart={() => setDrag({ kind: 'deal', id: d.id, from: col.stage_id })}>
                  <div className="cf-card__name">{d.name}</div>
                  <div className="cf-card__row">
                    <button type="button"
                            onClick={(e) => { e.stopPropagation(); setValue(d, col.stage_id) }}
                            title="Set the deal value — saves to GHL"
                            className={`cf-card__money cf-card__money--set${d.value ? '' : ' is-empty'}`}>
                      {d.value ? `AED ${AED(d.value)}` : '+ add value'}
                    </button>
                    {/* Age is the signal a count cannot give: a deal three
                        weeks in Proposal Sent is the thing to act on. */}
                    <span className={`cf-card__age${d.age_days >= 21 ? ' is-old' : ''}`}>{d.age_days}d</span>
                  </div>
                  {d.ad && <div className="cf-card__tag">{d.ad}</div>}
                </Card>
              ))}
            </Column>
          ))}
        </div>
      </Panel>

      {/* The quiet cost: deals nobody has touched. */}
      {stalled.length > 0 && (
        <Panel eyebrow="Needs a nudge" title={`${stalled.length} deals sitting over 3 weeks`}>
          <div className="cf-stalled">
            {stalled.slice(0, 12).map(d => (
              <div key={d.id} className="cf-stalled__row">
                <span className="cf-stalled__name">{d.name}</span>
                <span className="cf-stalled__stage">{d.stage}</span>
                <span className="cf-stalled__money">{d.value ? `AED ${AED(d.value)}` : '—'}</span>
                <span className="cf-stalled__age">{d.age_days}d</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {busy && (
        <div className="cf-saving"><Loader2 size={13} className="animate-spin" /> saving to GHL…</div>
      )}
    </div>
  )
}
