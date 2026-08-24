import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import '../reactivation/campaign.css'
import { CampaignProvider, useCampaign, campaignControl } from '../reactivation/useCampaign'
import { num } from '../reactivation/format'

import Overview   from '../reactivation/tabs/Overview'
import Targets    from '../reactivation/tabs/Targets'
import Queue      from '../reactivation/tabs/Queue'
import Shifts     from '../reactivation/tabs/Shifts'
import Pipeline   from '../reactivation/tabs/Pipeline'
import FollowUps  from '../reactivation/tabs/FollowUps'
import CallReview from '../reactivation/tabs/CallReview'
import Setup      from '../reactivation/tabs/Setup'

import LeadDrawer   from '../reactivation/LeadDrawer'
import ExportSheet  from '../reactivation/ExportSheet'
import ManagerBrief from '../reactivation/ManagerBrief'

/**
 * Reactivation — the old database, called again.
 *
 * Eight tabs answering the three questions a manager actually asks, in the
 * order they ask them:
 *
 *   How's it going?        → Overview · Targets · Shifts
 *   What's she doing now?  → Queue · Pipeline · Follow-ups
 *   What needs me?         → Manager brief · Super hot · Call review
 *
 * Two rules the layout follows from, both deliberately visual:
 *
 *   SARAH'S JOB ENDS WHEN SOMEONE TURNS UP. Calling, booking and getting the
 *   show are hers; running the meeting and closing are Ron's. Her numbers are
 *   pink, the team's blue and green, and the pipeline carries a literal handoff
 *   divider — so nobody has to argue about whose number a bad figure is.
 *
 *   PLAIN ENGLISH OVER JARGON. No "enrolled", "in flight", "released",
 *   "cadence", "kill criteria" on screen. A number that can be a sentence
 *   becomes one. That vocabulary lives in the database and stays there.
 *
 * ⚠️ NO DATE-RANGE PICKER, deliberately. A campaign is measured over its own
 * lifetime or over today. A global range silently rebases the pace line and
 * every "behind plan" figure hanging off it, so two readers on two ranges
 * disagree about whether the thing is working.
 */

const TABS = [
  { id: 'overview',  label: 'Overview',    Comp: Overview },
  { id: 'targets',   label: 'Targets',     Comp: Targets },
  { id: 'queue',     label: 'Queue',       Comp: Queue },
  { id: 'shifts',    label: 'Shifts',      Comp: Shifts },
  { id: 'pipeline',  label: 'Pipeline',    Comp: Pipeline },
  { id: 'followups', label: 'Follow-ups',  Comp: FollowUps },
  { id: 'review',    label: 'Call review', Comp: CallReview },
  { id: 'setup',     label: 'Setup',       Comp: Setup },
]

function Shell() {
  const c = useCampaign()
  const [tab, setTab] = useState('overview')
  const [openLead, setOpenLead] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [briefSeen, setBriefSeen] = useState(false)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const ov = c.overview.data
  const d = c.derived

  /**
   * The brief opens once on arrival and never again in the same session. It is
   * the "here is what to do today" entry point, and a panel that reopens on
   * every tab change stops being read by mid-morning.
   */
  useEffect(() => {
    if (briefSeen) return
    const t = setTimeout(() => { setBriefOpen(true); setBriefSeen(true) }, 600)
    return () => clearTimeout(t)
  }, [briefSeen])

  // Esc closes whatever is on top, innermost first.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (openLead) setOpenLead(null)
      else if (exportOpen) setExportOpen(false)
      else if (briefOpen) setBriefOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openLead, exportOpen, briefOpen])

  /**
   * The two tab badges. Both count things needing a decision, and both are
   * derived from the same feeds the tabs themselves read — a badge that
   * disagrees with the tab it points at is worse than no badge at all.
   */
  const offTrack = useMemo(() => {
    const rows = c.funnel.data?.rows || []
    return rows.filter((r) =>
      r.conservative != null && r.actual != null &&
      Number(r.actual) < Number(r.conservative) * 0.9).length
  }, [c.funnel.data])

  const unactioned = c.findings.data?.finding_count ?? 0

  const control = useCallback(async (action, saying) => {
    setBusy(true)
    try {
      await campaignControl(action)
      toast.success(saying)
      c.refreshAll()
    } catch (e) {
      // A refusal is the pacer explaining itself, not a failure to report as one.
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }, [c])

  const shared = {
    goTo: setTab,
    openLead: setOpenLead,
    openExport: () => setExportOpen(true),
    control, busy, search,
  }

  const Active = TABS.find((t) => t.id === tab)?.Comp || Overview

  // The orienting line. It says what it can rather than inventing a day number
  // for a campaign that has not started.
  const ctxLine = [
    d.eligible != null ? `${num(d.eligible)} leads` : null,
    d.dayOf != null ? `day ${d.dayOf}` : (ov?.status ? `not started — ${ov.status}` : null),
  ].filter(Boolean).join(' · ')

  return (
    <div className="rx">
      <header className="bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="views" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id} role="tab" data-p={t.id}
                aria-current={tab === t.id ? 'true' : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'targets' && offTrack > 0 && <span style={{ color: 'var(--bad)' }}> · {offTrack}</span>}
                {t.id === 'review' && unactioned > 0 && <span style={{ color: 'var(--warn)' }}> · {unactioned}</span>}
              </button>
            ))}
          </div>
          <span className="ctx">{ctxLine || '—'}</span>
        </div>

        <div className="tools">
          {/* Live only while something is genuinely on the phone, read from the
              shared state — so this pill and the queue's live row are one fact
              rather than two opinions. */}
          <DiallerPill />
          <button className="chip" onClick={() => setExportOpen(true)}>Export</button>
          <input
            className="search" placeholder="Find a name or number…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && search.trim()) setTab('queue') }}
          />
        </div>
      </header>

      <div className="panel">
        <div className="scroll">
          <div className="inner">
            <Active {...shared} />
          </div>
        </div>
      </div>

      {!briefOpen && (
        <button
          onClick={() => setBriefOpen(true)}
          className="mono"
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 40,
            background: '#2A0F1C', border: '1px solid #5E2340', color: 'var(--pink)',
            borderRadius: 999, padding: '11px 18px', cursor: 'pointer',
            fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
            boxShadow: '0 8px 30px rgba(0,0,0,.5)',
          }}
        >
          Manager brief
        </button>
      )}

      {briefOpen && (
        <ManagerBrief onClose={() => setBriefOpen(false)} goTo={(t) => { setTab(t); setBriefOpen(false) }} />
      )}
      {exportOpen && <ExportSheet tab={tab} onClose={() => setExportOpen(false)} />}
      {openLead && <LeadDrawer leadId={openLead} onClose={() => setOpenLead(null)} />}
    </div>
  )
}

/**
 * IS THE SYSTEM ON.
 *
 * 🔑 It is always visible, and when it is not calling it says WHY. The pill this
 * replaced only appeared while a call was mid-connect — on a trunk that rejects
 * in under a second that is a blink, so a dialler steadily working a queue of 74
 * looked exactly like one that had stopped, and there was no way to tell a
 * closed calling window from a global pause from an empty queue.
 *
 * Three states, and nothing else: ON (working), IDLE (nothing to do right now,
 * with the reason), OFF (paused or the breaker has tripped — needs a person).
 */
function DiallerPill() {
  const c = useCampaign()
  const d = c.dialler?.data
  if (!d?.found) return null

  const tone = d.state === 'on' ? 'good' : d.state === 'off' ? 'bad' : 'dim'
  const label = d.state === 'on' ? 'CALLING' : d.state === 'off' ? 'STOPPED' : 'IDLE'

  return (
    <span
      className="livepill"
      title={d.why}
      style={{
        background: 'transparent',
        border: `1px solid var(--${tone === 'dim' ? 'hairline' : tone})`,
        color: `var(--${tone === 'dim' ? 'dim' : tone})`,
        display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
      }}
    >
      <i style={{
        width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto',
        background: `var(--${tone === 'dim' ? 'hairline' : tone})`,
      }} />
      <b style={{ letterSpacing: '0.04em' }}>{label}</b>
      <span style={{ color: 'var(--dim)', fontWeight: 400 }}>
        {d.state === 'on' && d.dialling_now > 0
          ? `· on a call · ${num(d.queued)} queued`
          : `· ${d.why}`}
      </span>
    </span>
  )
}

export default function Reactivation() {
  return (
    <CampaignProvider>
      <Shell />
    </CampaignProvider>
  )
}
