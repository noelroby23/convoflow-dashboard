import { useState } from 'react'
import {
  PhoneCall, Clock, CalendarDays, AlertTriangle, PauseCircle, Loader2,
} from 'lucide-react'
import {
  useCfHeadline, useCfQueue, useCfPipeline, useCfMeetings, useCfSplit,
  setLeadState,
} from '../hooks/useCfDesk'
import { toast } from 'sonner'

const DUBAI = 'Asia/Dubai'
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: DUBAI, hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: DUBAI, weekday: 'short', day: 'numeric', month: 'short' }) : '—'

// Tier is what actually decides dial order, so show it rather than a raw number.
const TIER = { 10: 'form', 50: 'callback', 500: 'reactivation' }

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
  const { data: head } = useCfHeadline(region)
  const { data: queue, loading: qLoading } = useCfQueue()
  const { data: pipeline } = useCfPipeline(region)
  const { data: meetings, refresh: refreshMeetings } = useCfMeetings(region)
  const [view, setView] = useState('followup')
  const { data: split } = useCfSplit(view, region)
  const [busyId, setBusyId] = useState(null)

  const paused = queue?.global_paused
  const breaker = queue?.breaker_active

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

      {/* "Should simply tell me" — PDF section 10 */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Stat label="Leads today" value={head?.leads_today} />
        <Stat label="Actually reached" value={head?.reached} />
        <Stat label="Connect rate" value={head?.connect_rate} suffix="%" />
        <Stat label="Bookings" value={head?.bookings} />
        <Stat label="Booking % of reached" value={head?.booking_rate} suffix="%" />
        <Stat label="Show-up (30d)" value={head?.showup_rate_30d} suffix="%" />
        <Stat label="Close rate (30d)" value={head?.close_rate_30d} suffix="%" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lead Desk 1 — Calling queue */}
        <Card
          title="Calling queue"
          icon={PhoneCall}
          right={<span className="text-xs text-[#6B7280]">{queue?.pending_total ?? 0} waiting</span>}
        >
          {qLoading ? (
            <Empty>Loading…</Empty>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wide text-[#9CA3AF] mb-2">On the line now</p>
                {queue?.dialing_now?.length ? (
                  queue.dialing_now.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#FDF2F8] rounded-lg px-3 py-2">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-[#6B7280]">since {fmtTime(c.since)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#9CA3AF]">Line is idle</p>
                )}
              </div>
              <p className="text-xs uppercase tracking-wide text-[#9CA3AF] mb-2">Up next</p>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#F3F4F6]">
                {queue?.up_next?.length ? queue.up_next.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{c.name}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {TIER[c.priority] || c.source}{c.dials > 0 ? ` · retry ${c.dials}` : ' · first call'}
                      </p>
                    </div>
                    <span className="text-xs text-[#6B7280] shrink-0">{fmtTime(c.due)}</span>
                  </div>
                )) : <Empty>Nothing queued</Empty>}
              </div>
            </>
          )}
        </Card>

        {/* Lead Desk 2 — Where every lead is */}
        <Card title="Where every lead is" icon={Clock}>
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
                  <td>{m.name}</td>
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
                <tr key={l.lead_id}>
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
    </div>
  )
}
