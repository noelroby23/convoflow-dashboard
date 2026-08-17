import { PhoneCall, Clock, RotateCcw, CalendarCheck, XCircle, ArrowRight } from 'lucide-react'
import LiveListen from './LiveListen'

/**
 * The parts of the n8n Command Center (/webhook/cf-queue-view-8842) that were
 * worth keeping, rebuilt on cf.
 *
 * The idea being preserved is that a desk should read as sentences, not as
 * enum values. "Didn't answer — retrying 16:40" tells someone what to do;
 * `following_up` does not. The phrasing is computed in
 * cf.lead_status_phrase() so it can never drift from the state it describes.
 */

export const BOARD_COLUMNS = [
  { key: 'on_the_call',  label: 'On the call',       icon: PhoneCall,     accent: '#16A34A' },
  { key: 'up_next',      label: 'Up next',           icon: Clock,         accent: '#2E62E0' },
  { key: 'following_up', label: 'Following up',      icon: RotateCcw,     accent: '#E8AE35' },
  { key: 'callback',     label: 'Callback arranged', icon: ArrowRight,    accent: '#0C7291' },
  { key: 'booked',       label: 'Booked',            icon: CalendarCheck, accent: '#14794A' },
  { key: 'not_a_fit',    label: 'Not a fit',         icon: XCircle,       accent: '#B91C1C' },
]

function age(days) {
  const n = Number(days ?? 0)
  if (n <= 0) return 'today'
  if (n === 1) return '1d'
  if (n < 365) return `${n}d`
  return `${Math.floor(n / 365)}y`
}

function LeadCard({ lead, onOpen }) {
  return (
    <button
      onClick={() => onOpen?.(lead)}
      className="group w-full text-left bg-white border border-[#E9E9E7] rounded-lg px-2.5 py-2
                 transition-[transform,border-color,box-shadow] duration-200
                 hover:-translate-y-px hover:border-[#C9C8C4]
                 hover:shadow-[0_2px_10px_rgba(34,33,29,0.07)]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC4899]
                 focus-visible:ring-offset-1"
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 w-7 h-7 rounded-full bg-[#F0EFEC] text-[#6D6B63]
                         text-[11px] font-semibold grid place-items-center
                         transition-colors duration-200 group-hover:bg-[#22211D] group-hover:text-white">
          {lead.initials || '?'}
        </span>
        <span className="text-sm text-[#22211D] truncate flex-1">{lead.name}</span>
        <span className="font-meter text-[10px] text-[#9CA3AF] shrink-0">{age(lead.age_days)}</span>
      </div>
      <div className="mt-1 pl-9 text-[11px] text-[#6D6B63] truncate">{lead.status}</div>
      <div className="pl-9 font-meter text-[10px] text-[#B5B3AC] truncate">{lead.phone}</div>
    </button>
  )
}

export function Board({ board, dialing, onOpen }) {
  const liveByLead = new Map((dialing ?? []).map(d => [d.lead_id, d]))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
      {BOARD_COLUMNS.map(col => {
        const bucket = board?.[col.key]
        const leads = bucket?.leads ?? []
        const Icon = col.icon
        return (
          <div key={col.key} className="bg-[#FAFAF9] border border-[#E9E9E7] rounded-xl p-2.5">
            <div className="flex items-center gap-1.5 mb-2 px-0.5">
              <Icon size={13} style={{ color: col.accent }} />
              <span className="text-xs font-semibold text-[#22211D]">{col.label}</span>
              <span className="ml-auto text-xs text-[#6D6B63]">{bucket?.total ?? 0}</span>
            </div>
            <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
              {leads.length === 0 && (
                <p className="text-[11px] text-[#B5B3AC] py-3 text-center">Empty</p>
              )}
              {leads.map(lead => (
                <div key={lead.lead_id}>
                  <LeadCard lead={lead} onOpen={onOpen} />
                  {/* Only the row actually on a call can be listened to. */}
                  {liveByLead.has(lead.lead_id) && (
                    <div className="pl-9 pt-1">
                      <LiveListen
                        listenUrl={liveByLead.get(lead.lead_id)?.listen_url}
                        name={lead.name}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* TodaySoFar lived here — eight equal tiles reading the same cf_dash_today
   payload. Replaced by TodayRail, which renders it as a funnel so the connect
   rate is a shape rather than a division the reader has to do. */

const KIND_STYLE = {
  call:     { dot: '#2E62E0', label: 'call' },
  inbound:  { dot: '#16A34A', label: 'they said' },
  outbound: { dot: '#96660C', label: 'we sent' },
  state:    { dot: '#6D6B63', label: 'moved' },
}

export function ActivityFeed({ items, tz = 'Asia/Dubai' }) {
  if (!items?.length) {
    return <p className="text-sm text-[#9CA3AF] py-6 text-center">Nothing yet.</p>
  }
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {items.map((a, i) => {
        const s = KIND_STYLE[a.kind] ?? KIND_STYLE.state
        return (
          <div key={`${a.at}-${i}`} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: s.dot }} />
            <span className="text-[11px] text-[#9CA3AF] w-11 shrink-0 tabular-nums">
              {a.at ? new Date(a.at).toLocaleTimeString('en-GB',
                { timeZone: tz, hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
            <span className="text-[#22211D] font-medium shrink-0">{a.name}</span>
            <span className="text-[#6D6B63] truncate">{a.text}</span>
          </div>
        )
      })}
    </div>
  )
}
