import { useEffect, useMemo, useState } from 'react'
import { useDashboard } from '../../store/dashboard'
import { useCampaign } from '../useCampaign'
import LeadDrawer from '../LeadDrawer'
import { useAgentModel } from './model'
import { C, MONO, Chip, ghostBtn } from './ui'
import './agent.css'

import Overview from './pages/Overview'
import Pipeline from './pages/Pipeline'
import Meetings from './pages/Meetings'
import Live from './pages/Live'
import Leads from './pages/Leads'
import Handover from './pages/Handover'
import Deals from './pages/Deals'
import Performance from './pages/Performance'

/**
 * The Agent view — the CTO's layout, over the reactivation campaign's own data.
 *
 * A left rail and one page at a time, where the classic view is a tab strip and
 * a single scroll. Same feeds, same arithmetic, different shape: this one is
 * built to be watched during a dialling day, the classic one to be read.
 *
 * ⚠️ TWO THINGS FROM THE SOURCE DESIGN ARE NOT HERE, AND THE DESIGN AGREES.
 * It sets `showFilters = false` on the reactivation page and prints "Reactivation
 * only, voice", so the channel filter and the workspace filter are switched off
 * by the design itself rather than dropped by the port. The bookings split bar
 * goes with them: this page is one source, and a bar dividing it by source would
 * be dividing by a population that does not exist here.
 *
 * 📌 The source design's "Edit targets" modal is also absent. `cf.campaign_target`
 * has no write RPC, so the button would open a form whose Save changes nothing —
 * the promise-with-nothing-behind-it this project has paid for repeatedly
 * (§7 items 96/106/111). Targets are read-only on both views until a writer exists.
 */

const RAIL = [
  { id: 'overview', label: 'Overview', Comp: Overview, icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { id: 'pipeline', label: 'Pipeline', Comp: Pipeline, icon: 'M3 4h5v16H3zM10 4h5v11h-5zM17 4h4v7h-4z' },
  { id: 'meetings', label: 'Meetings', Comp: Meetings, icon: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4' },
  { id: 'live', label: 'Live and call log', Comp: Live, icon: 'M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4' },
  { id: 'leads', label: 'Leads', Comp: Leads, icon: 'M4 7h16M4 12h16M4 17h10' },
  { id: 'handover', label: 'Handover', Comp: Handover, icon: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M13.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M17 11h4M19 9v4' },
  { id: 'deals', label: 'Deals', Comp: Deals, icon: 'M3 7h18v12H3zM3 11h18M8 7V5h8v2' },
]

/**
 * The range chips, mapped onto the app's OWN date store rather than a second
 * one. Both views then read the same window, so scrubbing to yesterday on one
 * and back on the other cannot leave them disagreeing about the same day.
 *
 * 📌 "Campaign to date" is `all_time`. Every feed behind this page is already
 * campaign-scoped, so the widest window IS the campaign's life — the label says
 * what the reader gets rather than what the store calls it.
 */
const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'all_time', label: 'Campaign to date' },
]

const fmtDay = (iso) => (iso
  ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short' }).format(new Date(iso))
  : null)

export default function AgentView({ onSwitchView }) {
  const c = useCampaign()
  const m = useAgentModel()

  const [page, setPage] = useState('overview')
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1000)
  const [openLead, setOpenLead] = useState(null)
  const [clock, setClock] = useState(() => new Date())

  const range = useDashboard((s) => s.dateRange)
  const setDatePreset = useDashboard((s) => s.setDatePreset)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1000)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The header clock. A minute is enough — a ticking second hand on a page that
  // polls every 5 seconds is motion for its own sake.
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && openLead) setOpenLead(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openLead])

  const isAudit = page === 'audit'
  const active = RAIL.find((r) => r.id === page)
  const Active = isAudit ? Performance : (active?.Comp || Overview)
  const title = isAudit ? 'Agent performance' : (active?.label || 'Overview')

  /** The orienting line. It says only what it can: a campaign that has not
   *  started has no day number, and inventing one claims it has begun. */
  const campaignLine = useMemo(() => {
    const ov = m.ov
    const bits = []
    if (ov?.started_at) bits.push(`Started ${fmtDay(ov.started_at)}`)
    if (m.plan.dayOf != null && m.plan.lengthDays != null) {
      bits.push(`day ${m.plan.dayOf} of ${m.plan.lengthDays}`)
      if (m.plan.daysLeft != null) bits.push(`${m.plan.daysLeft} dialling day${m.plan.daysLeft === 1 ? '' : 's'} left`)
    } else if (ov?.status) {
      bits.push(`not started — ${ov.status}`)
    }
    return bits.join(' · ')
  }, [m.ov, m.plan])

  const badges = {
    meetings: m.toMark.length || null,
    handover: m.countOf('super_hot') || null,
    deals: m.countOf('in_discussion') || null,
  }

  const shared = { m, c, goTo: setPage, openLead: setOpenLead }

  return (
    <div className="cfa">
      {/* ------------------------------------------------------------- rail */}
      <div style={{
        width: narrow ? 64 : 204, flex: '0 0 auto', borderRight: `1px solid ${C.line}`,
        background: C.rail, height: '100vh', overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: narrow ? '18px 0' : '18px 16px',
          justifyContent: narrow ? 'center' : 'flex-start',
          borderBottom: `1px solid ${C.lineSoft}`,
        }}>
          {narrow ? (
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: C.pink, color: '#fff',
              display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15,
            }}>C</div>
          ) : (
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Convo<span style={{ color: C.pink }}>Flow</span>
            </div>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 8px' }}>
          {RAIL.map((r) => {
            const on = page === r.id
            return (
              <button
                key={r.id} className="cfa-nav" title={r.label}
                onClick={() => setPage(r.id)}
                aria-current={on ? 'page' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: narrow ? '11px 0' : '10px 12px',
                  justifyContent: narrow ? 'center' : 'flex-start',
                  background: on ? 'rgba(236,72,153,0.14)' : 'transparent',
                  border: `1px solid ${on ? 'rgba(236,72,153,0.35)' : 'transparent'}`,
                  borderRadius: 12, color: on ? C.pinkSoft : C.muted,
                  fontSize: 14, fontWeight: on ? 600 : 500, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>
                  <path d={r.icon} />
                </svg>
                {!narrow && <span>{r.label}</span>}
                {!narrow && badges[r.id] ? (
                  <span className="mono" style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#fff',
                    background: C.pink, padding: '1px 7px', borderRadius: 999,
                  }}>{badges[r.id]}</span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ------------------------------------------------------------- body */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <header style={{
          flex: 'none', background: 'rgba(15,15,26,0.94)', backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.line}`,
        }}>
          <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 'auto', minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
              <div className="mono" style={{ fontSize: 12, color: C.muted }}>{campaignLine || '—'}</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <DiallerPill dial={m.dial} />
              <span className="mono" style={{ fontSize: 13, color: C.muted }}>
                {new Intl.DateTimeFormat('en-GB', {
                  timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit',
                }).format(clock)} GST
              </span>
              <button className="cfa-ghost" style={{ ...ghostBtn, borderRadius: 999, padding: '8px 14px', fontSize: 14 }}
                      onClick={() => setPage(isAudit ? 'overview' : 'audit')}>
                {isAudit ? 'Back to the dashboard' : 'Agent performance'}
              </button>
              <ViewSwitch onSwitchView={onSwitchView} />
            </div>
          </div>

          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: C.muted, fontWeight: 600, marginRight: 2,
            }}>Range</span>
            {RANGES.map((r) => (
              <Chip key={r.id} active={range?.preset === r.id} onClick={() => setDatePreset(r.id)}>
                {r.label}
              </Chip>
            ))}
            {range?.preset === 'custom' && (
              <Chip active onClick={() => {}}>{range.from} to {range.to}</Chip>
            )}
            <span style={{ fontSize: 12, color: C.dim, marginLeft: 6 }}>
              Reactivation only, voice. Bookings, meetings and deals are this campaign&rsquo;s alone.
            </span>
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <Active {...shared} />
        </div>
      </div>

      {/* The lead drawer is the classic view's, unchanged. `display:contents`
          gives it the `.rx` ancestor its stylesheet needs without putting a box
          on the page — the two design systems never share a variable scope. */}
      {openLead && (
        <div className="rx" style={{ display: 'contents' }}>
          <LeadDrawer leadId={openLead} onClose={() => setOpenLead(null)} />
        </div>
      )}
    </div>
  )
}

/**
 * IS THE SYSTEM ON — the classic view's pill, in this palette.
 *
 * 🔑 Always visible, and when it is not calling it says WHY. On a trunk that
 * rejects in under a second a dialler steadily working a queue looks exactly
 * like one that has stopped, and a closed window, a global pause and an empty
 * queue are three different problems.
 */
function DiallerPill({ dial }) {
  if (!dial?.found) return null
  const tone = dial.state === 'on' ? C.good : dial.state === 'off' ? C.bad : C.dim
  const label = dial.state === 'on' ? 'Calling' : dial.state === 'off' ? 'Stopped' : 'Idle'
  return (
    <span title={dial.why} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
      border: `1px solid ${tone}`, color: tone, borderRadius: 999,
      padding: '5px 11px', fontSize: 11, fontFamily: MONO,
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>
      <i style={{
        width: 7, height: 7, borderRadius: '50%', background: tone,
        animation: dial.state === 'on' ? 'cfpulse 1.6s infinite' : undefined,
      }} />
      <b>{label}</b>
      <span style={{ color: C.muted, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
        {dial.state === 'on' && dial.dialling_now > 0
          ? `on a call · ${dial.queued} queued`
          : dial.why}
      </span>
    </span>
  )
}

/** The switch back to the classic view. Present on both, so neither is a
 *  one-way door. */
function ViewSwitch({ onSwitchView }) {
  return (
    <button
      className="cfa-solid"
      onClick={onSwitchView}
      title="Switch back to the classic reactivation view"
      style={{
        background: C.pink, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
        padding: '8px 15px', borderRadius: 999, cursor: 'pointer',
        boxShadow: '0 12px 32px rgba(236,72,153,0.28)',
      }}
    >Classic view</button>
  )
}
