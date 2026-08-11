import { useState } from 'react'
import {
  PhoneCall, Clock, CalendarDays, AlertTriangle, PauseCircle, Loader2,
  Target, BellRing, FileText, ListChecks,
} from 'lucide-react'
import {
  useCfHeadline, useCfQueue, useCfPipeline, useCfMeetings, useCfSplit,
  useCfTargets, useCfAttention, useCfCalls, useCfEod,
  useCfBoard, useCfToday, useCfActivity,
  setLeadState,
} from '../hooks/useCfDesk'
import { Board, TodaySoFar, ActivityFeed, BOARD_COLUMNS } from '../components/ui/CommandCenter'
import LiveListen from '../components/ui/LiveListen'
import LeadDetail from '../components/ui/LeadDetail'
import { exportCsv } from '../lib/exportCsv'
import { useDashboard } from '../store/dashboard'
import { toast } from 'sonner'

const DUBAI = 'Asia/Dubai'
// Yesterday in Dubai, as yyyy-MM-dd. Computed in the region's timezone rather
// than the viewer's, or someone in London gets a different "yesterday".
const yesterdayDubai = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DUBAI, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(Date.now() - 86_400_000))
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return `${v.year}-${v.month}-${v.day}`
}
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: DUBAI, hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: DUBAI, weekday: 'short', day: 'numeric', month: 'short' }) : '—'

// Tier is what actually decides dial order, so show it rather than a raw number.
const TIER = { 10: 'form', 50: 'callback', 500: 'reactivation' }

// A due time is only useful if you can tell today from tomorrow. Up next now
// reaches days ahead, so a bare HH:MM would read as "in a few minutes" for a
// call that is not happening until Thursday.
const isToday = (iso) => {
  if (!iso) return false
  const day = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: DUBAI }).format(d)
  return day(new Date(iso)) === day(new Date())
}
const fmtDue = (iso) => !iso ? '—' : isToday(iso) ? fmtTime(iso) : `${fmtDay(iso)} ${fmtTime(iso)}`

// queued = a real cf.call_queue row, this WILL be dialled.
// scheduled/callback = real but not yet committed; a reply or a kill can still
// cancel it. Saying which is which is the point — §5.1's whole failure mode is
// the system implying a commitment it has not made.
const UP_NEXT_KIND = {
  queued:    { label: 'queued',    tone: 'bg-sky-100 text-sky-800' },
  scheduled: { label: 'scheduled', tone: 'bg-[#F3F4F6] text-[#6D6B63]' },
  callback:  { label: 'callback',  tone: 'bg-amber-100 text-amber-900' },
}

function Card({ title, icon: Icon, right, children }) {
  return (
    <section className="bg-white rounded-2xl border border-[#EEE] p-5">
      <header className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#111]">
          {Icon && <Icon size={16} className="text-[#EC4899]" />}
          {title}
        </h2>
        {right}
      </header>
      {children}
    </section>
  )
}

function Stat({ label, value, suffix, tone }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EEE] p-4">
      <p className="text-xs text-[#6B7280]">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tone || 'text-[#111]'}`}>
        {value ?? '—'}{value != null && suffix ? <span className="text-base text-[#6B7280]">{suffix}</span> : null}
      </p>
    </div>
  )
}

function Empty({ children }) {
  return <p className="text-sm text-[#9CA3AF] py-6 text-center">{children}</p>
}

export default function LeadDesk() {
  const region = 'uae'
  // The header's date-range control drives the counted panels. The live
  // panels below it — queue, pipeline, meetings, attention — are deliberately
  // "right now" and ignore it; a queue filtered to last month is meaningless.
  const range = useDashboard(s => s.dateRange)
  const { data: head } = useCfHeadline(region, range)
  const { data: queue, loading: qLoading } = useCfQueue()
  const { data: pipeline } = useCfPipeline(region)
  const { data: meetings, refresh: refreshMeetings } = useCfMeetings(region)
  const [view, setView] = useState('followup')
  const { data: split } = useCfSplit(view, region)
  const { data: targets } = useCfTargets(region, range)
  const { data: attention } = useCfAttention(region)
  const { data: calls } = useCfCalls(region, range)
  const { data: eod } = useCfEod(region)
  const [busyId, setBusyId] = useState(null)
  // Which lead the drawer is showing. Every list on this page that knows a
  // lead_id opens the same drawer, so "click the person" means one thing
  // wherever you are on the desk.
  const [openLeadId, setOpenLeadId] = useState(null)

  // Command Center parity. `day` is its own control, separate from the page's
  // date range: the range scopes history, this scopes "what happened today".
  const [day, setDay] = useState('today')
  const [boardFilter, setBoardFilter] = useState('all')
  const [boardQ, setBoardQ] = useState('')
  // The board is a live work surface by default. "Use date range" makes it
  // follow the picker in the header instead, scoped by when the lead arrived.
  const [boardByDate, setBoardByDate] = useState(false)
  const dayParam = day === 'today' ? undefined : yesterdayDubai()
  const { data: today } = useCfToday(region, dayParam)
  const { data: activity } = useCfActivity(region, dayParam)
  const { data: board } = useCfBoard(
    region, boardFilter, boardByDate ? range : undefined, boardQ.trim() || undefined)

  const paused = queue?.global_paused
  const breaker = queue?.breaker_active

  // Flatten whatever the board is currently showing. Exporting what is on
  // screen — filter included — beats exporting a different set silently.
  const exportBoard = () => {
    const rows = BOARD_COLUMNS.flatMap(c =>
      (board?.[c.key]?.leads ?? []).map(l => ({
        column: c.label, name: l.name, phone: l.phone,
        status: l.status, state: l.state, age_days: l.age_days,
      })))
    if (!rows.length) { toast.error('Nothing on the board to export'); return }
    exportCsv(rows, `convoflow-board-${day}`)
  }

  const markAttendance = async (leadId, state) => {
    setBusyId(leadId)
    try {
      await setLeadState(leadId, state, 'marked from Lead Desk')
      toast.success(state === 'meeting_attended' ? 'Marked attended' : 'Marked missed')
      refreshMeetings()
    } catch (e) {
      toast.error(e.message || 'Could not update')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      {(paused || breaker) && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} />
          {paused
            ? 'Dialling is globally paused — nothing will be called until it is resumed.'
            : 'Circuit breaker tripped — dialling paused after repeated carrier failures.'}
        </div>
      )}

      {/* Today so far — the Command Center's opening strip. Reactivation and
          reminders are here because they answer questions the headline KPIs
          cannot: how hard is the agent working the old list, and is the
          meeting machinery actually firing. */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#111]">
            {day === 'today' ? 'Today so far' : 'Yesterday'}
          </h2>
          <div className="inline-flex rounded-lg border border-[#E9E9E7] overflow-hidden">
            {['today', 'yesterday'].map(d => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`px-2.5 py-1 text-xs capitalize ${
                  day === d ? 'bg-[#22211D] text-white' : 'bg-white text-[#6D6B63] hover:bg-[#F7F7F6]'
                }`}
              >{d}</button>
            ))}
          </div>
          <span className="ml-auto text-xs text-[#9CA3AF]">all times Dubai</span>
        </div>
        <TodaySoFar today={today} />
      </section>

      {/* The board. Cards move on their own as calls happen, and the one that
          is actually on a call carries a live-listen button. */}
      <Card
        title="Where every lead is"
        icon={ListChecks}
        right={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#E9E9E7] overflow-hidden">
              {[['all', 'All'], ['new', 'New'], ['booked', 'Booked'], ['old', 'Old / reactivation']]
                .map(([k, lbl]) => (
                  <button
                    key={k}
                    onClick={() => setBoardFilter(k)}
                    className={`px-2.5 py-1 text-xs ${
                      boardFilter === k ? 'bg-[#22211D] text-white' : 'bg-white text-[#6D6B63] hover:bg-[#F7F7F6]'
                    }`}
                  >{lbl}</button>
                ))}
            </div>
            <input
              value={boardQ}
              onChange={e => setBoardQ(e.target.value)}
              placeholder="Search name or phone…"
              className="text-xs px-2.5 py-1 rounded-lg border border-[#E9E9E7] w-44
                         text-[#22211D] placeholder:text-[#9CA3AF] outline-none focus:border-[#C9C8C4]"
            />
            <button
              onClick={() => setBoardByDate(v => !v)}
              title={boardByDate
                ? `Showing leads that arrived ${range?.from} to ${range?.to}`
                : 'Showing everything currently in play'}
              className={`text-xs px-2.5 py-1 rounded-lg border ${
                boardByDate
                  ? 'bg-[#22211D] text-white border-[#22211D]'
                  : 'border-[#E9E9E7] text-[#6D6B63] hover:bg-[#F7F7F6]'}`}
            >
              {boardByDate ? 'Date range on' : 'Use date range'}
            </button>
            <button onClick={exportBoard}
                    className="text-xs px-2.5 py-1 rounded-lg border border-[#E9E9E7] text-[#6D6B63] hover:bg-[#F7F7F6]">
              Export CSV
            </button>
          </div>
        }
      >
        <p className="text-xs text-[#9CA3AF] mb-3">
          {boardByDate
            ? `Leads that arrived ${range?.from} → ${range?.to}`
            : 'Everything currently in play — queued, scheduled, in a cadence, or moved in the last 14 days'}
          {boardQ.trim() ? ` · matching “${boardQ.trim()}”` : ''}
        </p>
        {/* Board has always accepted onOpen and LeadCard has always been a
            button — nothing was ever passed, so every card was a click that
            did nothing. Same shape as the no-caller bugs in §7 (items
            47/48/87/104): a prop with no provider looks exactly like a
            working one. */}
        <Board board={board} dialing={queue?.dialing_now}
               onOpen={(lead) => setOpenLeadId(lead.lead_id)} />
      </Card>

      {/* "Should simply tell me" — PDF section 10 */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Stat label={range?.from === range?.to ? 'Leads today' : 'Leads'} value={head?.leads_today} />
        {/* Dials and reached are separate on purpose: 59% of dials never
            connect (CLAUDE.md 7.7), so one number cannot carry both. */}
        <Stat label="Dials" value={head?.dials} />
        <Stat label="Actually reached" value={head?.reached} />
        <Stat label="Connect rate" value={head?.connect_rate} suffix="%" />
        <Stat label="Bookings" value={head?.bookings} />
        <Stat label="Booking % of reached" value={head?.booking_rate} suffix="%" />
        <Stat label="Show-up (30d)" value={head?.showup_rate_30d} suffix="%" />
        <Stat label="Close rate (30d)" value={head?.close_rate_30d} suffix="%" />
      </div>

      {/* Targets & Progress — PDF 5.9 "KPIs with targets for Ads · Agent · Sales" */}
      <Card title="Targets & progress" icon={Target}>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3">
          {targets?.length ? targets.map((t) => {
            const pct = Math.min(100, Number(t.pct) || 0)
            const tone = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-[#EC4899]' : 'bg-amber-400'
            return (
              <div key={`${t.metric}-${t.period}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">
                    {t.metric}
                    <span className="text-[10px] uppercase ml-2 px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]">{t.category}</span>
                    <span className="text-xs text-[#9CA3AF] ml-1">/{t.period}</span>
                  </span>
                  <span className="tabular-nums">{t.actual} <span className="text-[#9CA3AF]">/ {t.target}</span></span>
                </div>
                <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          }) : <Empty>No targets set</Empty>}
        </div>
      </Card>

      {/* Human Attention — PDF section 5: must be RELEVANT, no noise.
          Deliberately only handovers, bookings with no link, and info requests.
          The spec says to remove the old "Hot Lead" notification, so it is absent. */}
      <Card
        title="Human attention"
        icon={BellRing}
        right={<span className="text-xs text-[#6B7280]">{attention?.length ?? 0} need a person</span>}
      >
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {attention?.length ? attention.map((a, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-[#F3F4F6] pb-2 last:border-0">
              <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                a.kind === 'human_attention' ? 'bg-rose-100 text-rose-800'
                : a.kind === 'booking_no_link' ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-700'}`}>
                {a.kind.replace(/_/g, ' ')}
              </span>
              <div className="min-w-0">
                <p className="text-sm">{a.title}</p>
                <p className="text-xs text-[#6B7280] whitespace-pre-line">{a.body}</p>
              </div>
              <span className="text-xs text-[#9CA3AF] ml-auto shrink-0">{fmtTime(a.at)}</span>
            </div>
          )) : <Empty>Nothing needs a human right now</Empty>}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lead Desk 1 — Calling queue */}
        <Card
          title="Calling queue"
          icon={PhoneCall}
          right={
            <span className="text-xs text-[#6B7280]">
              {queue?.upcoming_total ?? 0} coming up
              {queue?.scheduled_total > 0 && (
                <span className="text-[#9CA3AF]"> · {queue.pending_total} queued</span>
              )}
            </span>
          }
        >
          {qLoading ? (
            <Empty>Loading…</Empty>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wide text-[#9CA3AF] mb-2">On the line now</p>
                {queue?.dialing_now?.length ? (
                  queue.dialing_now.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#FDF2F8] rounded-lg px-3 py-2">
                      <button onClick={() => setOpenLeadId(c.lead_id)}
                              className="text-sm font-medium hover:underline text-left">{c.name}</button>
                      <span className="text-xs text-[#6B7280]">since {fmtTime(c.since)}</span>
                      {/* VAPI streams the live audio of this call over
                          monitor.listenUrl. Captured by migration 030. */}
                      <span className="ml-auto"><LiveListen listenUrl={c.listen_url} name={c.name} /></span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#9CA3AF]">Line is idle</p>
                )}
              </div>
              <p className="text-xs uppercase tracking-wide text-[#9CA3AF] mb-2">Up next</p>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#F3F4F6]">
                {queue?.up_next?.length ? queue.up_next.map((c, i) => {
                  const kind = UP_NEXT_KIND[c.kind] || UP_NEXT_KIND.scheduled
                  return (
                    <button key={i} onClick={() => setOpenLeadId(c.lead_id)}
                      className="w-full text-left flex items-center justify-between gap-2 py-2 hover:bg-[#FAFAF9]">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{c.name}</p>
                        <p className="text-xs text-[#9CA3AF] truncate">
                          {TIER[c.priority] || c.source}
                          {c.cadence ? ` · ${c.cadence} step ${c.step}` : ''}
                          {c.dials > 0 ? ` · retry ${c.dials}` : ' · first call'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs text-[#6B7280] tabular-nums">{fmtDue(c.due)}</span>
                        <span className={`block text-[10px] px-1.5 rounded-full mt-0.5 ${kind.tone}`}>
                          {kind.label}
                        </span>
                      </div>
                    </button>
                  )
                }) : <Empty>Nobody is due to be called</Empty>}
              </div>
            </>
          )}
        </Card>

        {/* Lead Desk 2 — Where every lead is */}
        <Card title="Pipeline totals" icon={Clock}>
          <div className="space-y-1.5 max-h-[26rem] overflow-y-auto">
            {pipeline?.length ? pipeline.map((row) => (
              <div key={row.state} className="flex items-center gap-3">
                <span className="text-sm w-52 truncate">{row.stage_name || row.state}</span>
                <div className="flex-1 h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#EC4899]"
                    style={{ width: `${Math.min(100, (row.count / Math.max(...pipeline.map(r => r.count))) * 100)}%` }}
                  />
                </div>
                <span className="text-sm tabular-nums w-10 text-right">{row.count}</span>
              </div>
            )) : <Empty>No leads yet</Empty>}
          </div>
        </Card>
      </div>

      {/* Lead Desk 3 — Meetings, with write-back */}
      <Card title="Meetings" icon={CalendarDays}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9CA3AF]">
                <th className="py-2">When</th><th>Lead</th><th>Status</th><th>Link</th><th className="text-right">Mark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {meetings?.length ? meetings.map((m) => (
                <tr key={m.event_id}>
                  <td className="py-2 whitespace-nowrap">
                    {fmtDay(m.start_at)} <span className="text-[#6B7280]">{fmtTime(m.start_at)}</span>
                    {m.same_day && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">same-day</span>}
                  </td>
                  <td>
                    <button onClick={() => setOpenLeadId(m.lead_id)}
                            className="hover:underline text-left">{m.name}</button>
                  </td>
                  <td><span className="text-xs px-2 py-0.5 rounded-full bg-[#F3F4F6]">{m.status}</span></td>
                  <td>{m.link ? <a className="text-[#EC4899] text-xs" href={m.link} target="_blank" rel="noreferrer">open</a>
                              : <span className="text-xs text-amber-600">no link</span>}</td>
                  <td className="text-right whitespace-nowrap">
                    {busyId === m.lead_id ? <Loader2 size={14} className="animate-spin inline" /> : (
                      <>
                        <button onClick={() => markAttendance(m.lead_id, 'meeting_attended')}
                          className="text-xs px-2 py-1 rounded border border-[#EEE] hover:bg-[#F9FAFB]">Attended</button>
                        <button onClick={() => markAttendance(m.lead_id, 'meeting_missed')}
                          className="ml-1 text-xs px-2 py-1 rounded border border-[#EEE] hover:bg-[#F9FAFB]">No-show</button>
                      </>
                    )}
                  </td>
                </tr>
              )) : <tr><td colSpan={5}><Empty>No meetings in the next 14 days</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* The five split views — PDF section 5.9 */}
      <Card
        title="Split views"
        icon={PauseCircle}
        right={
          <div className="flex gap-1">
            {[
              ['followup', 'Primary & Follow-up'],
              ['reminder', 'Meeting Reminder'],
              ['missed', 'Meeting Missed'],
              ['reactivation', 'Reactivation'],
              ['chatbot', 'WA Chatbot'],
            ].map(([k, label]) => (
              <button key={k} onClick={() => setView(k)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  view === k ? 'bg-[#EC4899] text-white border-[#EC4899]' : 'border-[#EEE] text-[#6B7280]'}`}>
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9CA3AF]">
                <th className="py-2">Lead</th><th>State</th><th>Step</th><th>Dials</th><th>Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {split?.length ? split.map((l) => (
                <tr key={l.lead_id} onClick={() => setOpenLeadId(l.lead_id)}
                    className="cursor-pointer hover:bg-[#FAFAF9]">
                  <td className="py-2">{l.name}<span className="block text-xs text-[#9CA3AF]">{l.phone}</span></td>
                  <td className="text-xs">{l.state}</td>
                  <td className="tabular-nums">{l.step}</td>
                  {/* dials vs attempts differ: SIP failures dial without consuming a step */}
                  <td className="tabular-nums">{l.dials}<span className="text-[#9CA3AF]"> / {l.attempts} att</span></td>
                  <td className="text-xs">{l.next_action_at ? `${fmtDay(l.next_action_at)} ${fmtTime(l.next_action_at)}` : '—'}</td>
                </tr>
              )) : <tr><td colSpan={5}><Empty>Nothing in this view</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Calls & logs */}
      <Card
        title="Calls & logs"
        icon={ListChecks}
        right={<span className="text-xs text-[#6B7280]">last 50</span>}
      >
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9CA3AF]">
                <th className="py-2">When</th><th>Lead</th><th>Result</th><th>Secs</th><th>Summary</th><th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {calls?.length ? calls.map((c, i) => (
                <tr key={i} onClick={() => setOpenLeadId(c.lead_id)}
                    className="cursor-pointer hover:bg-[#FAFAF9]">
                  <td className="py-2 whitespace-nowrap text-xs text-[#6B7280]">{fmtTime(c.at)}</td>
                  <td className="whitespace-nowrap">{c.name}</td>
                  <td className="whitespace-nowrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      c.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {c.connected ? (c.outcome || 'connected') : 'no connect'}
                    </span>
                    {/* A SIP fault means the phone never rang — worth separating
                        from a genuine no-answer when reading the log. */}
                    {!c.connected && c.reason?.includes('sip') && (
                      <span className="ml-1 text-[10px] text-amber-700">carrier</span>
                    )}
                  </td>
                  <td className="tabular-nums text-xs">{c.secs ?? '—'}</td>
                  <td className="text-xs text-[#374151] max-w-md truncate">{c.summary || '—'}</td>
                  {/* This used to be <a href={c.recording}>play</a>. That URL is
                      VAPI's unsigned R2 object path and returns 400 in a
                      browser — it has never played anything, and a dead link
                      looks exactly like a working one. The audio needs a
                      presigned URL, which is minted server-side; the player
                      that does it lives in the drawer. */}
                  <td>{c.recording && <span className="text-xs text-[#EC4899]">listen</span>}</td>
                </tr>
              )) : <tr><td colSpan={6}><Empty>No calls yet</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reports */}
      {/* What just happened — one merged stream of state changes, calls and
          messages, so the desk shows motion rather than only totals. */}
      <Card title="What just happened" icon={BellRing}
            right={<span className="text-xs text-[#9CA3AF]">live · {day}</span>}>
        <ActivityFeed items={activity} />
      </Card>

      <Card title="Reports — end of day" icon={FileText}>
        <pre className="text-xs whitespace-pre-wrap font-sans text-[#374151] max-h-96 overflow-y-auto">
          {eod || 'No data yet.'}
        </pre>
      </Card>

      {/* One drawer for the whole desk. Keyed on the lead so switching from
          one lead to another remounts rather than showing the previous lead's
          calls under a new name. */}
      <LeadDetail key={openLeadId} leadId={openLeadId} onClose={() => setOpenLeadId(null)} />
    </div>
  )
}
