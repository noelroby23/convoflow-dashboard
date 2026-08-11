import { useEffect, useState } from 'react'
import {
  X, PhoneCall, MessageSquare, GitBranch, FileText, ExternalLink,
  Loader2, ChevronDown, ChevronRight, Bug, CalendarCheck, Clock, Megaphone,
} from 'lucide-react'
import { useCfLeadDetail } from '../../hooks/useCfDesk'
import RecordingPlayer from './RecordingPlayer'

/**
 * Everything about one lead, opened by clicking a card on the board.
 *
 * The question it answers is the one §5.9 asks — "what happened to lead X,
 * where are they now, did the AI fail or the system" — for a specific person,
 * without typing their name into a search box and hoping the right row comes
 * back.
 *
 * Two things it deliberately shows that nothing else on the desk does:
 *  · BOTH numbers, labelled. §5.4b: the calling number is a separate field and
 *    must never be confused with the WhatsApp one.
 *  · WHAT IS QUEUED NEXT. Half of "where is this lead" is what the system is
 *    about to do to them, and until now that lived only in cf.call_queue and
 *    cf.message_queue, where no human looks.
 */

const DUBAI = 'Asia/Dubai'
const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('en-GB', {
  timeZone: DUBAI, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtT = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', {
  timeZone: DUBAI, hour: '2-digit', minute: '2-digit' }) : '—'

const OUTCOME_TONE = {
  booked: 'bg-emerald-100 text-emerald-800',
  meeting_booked: 'bg-emerald-100 text-emerald-800',
  qualified_no_meeting: 'bg-teal-100 text-teal-800',
  interested_no_meeting: 'bg-teal-100 text-teal-800',
  callback_requested: 'bg-sky-100 text-sky-800',
  human_requested: 'bg-rose-100 text-rose-800',
  not_interested: 'bg-slate-200 text-slate-700',
  disqualified: 'bg-slate-200 text-slate-700',
  wrong_number: 'bg-slate-200 text-slate-700',
  voicemail: 'bg-amber-100 text-amber-800',
  no_answer: 'bg-slate-100 text-slate-600',
  failed_to_connect: 'bg-amber-100 text-amber-900',
  ai_error: 'bg-rose-100 text-rose-800',
}
const VERDICT_TONE = {
  ai_failure: 'bg-rose-100 text-rose-800',
  system_failure: 'bg-amber-100 text-amber-800',
  lead_not_ready: 'bg-slate-100 text-slate-700',
  unclear: 'bg-slate-100 text-slate-500',
}

const Pill = ({ tone = 'bg-[#F3F4F6] text-[#6D6B63]', children }) => (
  <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${tone}`}>{children}</span>
)

function Field({ label, children, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <p className={`text-sm text-[#22211D] truncate ${mono ? 'tabular-nums' : ''}`}>{children ?? '—'}</p>
    </div>
  )
}

function Section({ title, icon: Icon, right, children }) {
  return (
    <section className="mb-5">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[#22211D] mb-2">
        {Icon && <Icon size={13} className="text-[#EC4899]" />}{title}
        {right && <span className="ml-auto font-normal text-[11px] text-[#9CA3AF]">{right}</span>}
      </h4>
      {children}
    </section>
  )
}

function Empty({ children }) {
  return <p className="text-xs text-[#9CA3AF] py-3">{children}</p>
}

/** One call: what happened, the audio, the summary, and the transcript. */
function CallCard({ call }) {
  const [openTx, setOpenTx] = useState(false)
  return (
    <div className="border border-[#E9E9E7] rounded-xl p-3 mb-2.5 bg-[#FAFAF9]">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs text-[#6D6B63] tabular-nums">{fmtDT(call.at)}</span>
        {/* started_at is null on a dial that never connected (§7 item 44), so
            the timestamp falls back to created_at. Say so rather than implying
            the call began. */}
        {!call.started && <Pill>never rang</Pill>}
        <Pill tone={call.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>
          {call.connected ? 'connected' : 'no connect'}
        </Pill>
        {call.outcome && <Pill tone={OUTCOME_TONE[call.outcome]}>{String(call.outcome).replace(/_/g, ' ')}</Pill>}
        {call.secs != null && <span className="text-[11px] text-[#9CA3AF] tabular-nums">{call.secs}s</span>}
        {call.role && <span className="text-[11px] text-[#9CA3AF]">{call.role}</span>}
        {!call.connected && call.ended_reason && (
          <span className="text-[11px] text-[#B5B3AC] truncate">{call.ended_reason}</span>
        )}
      </div>

      <div className="mb-2">
        <RecordingPlayer callId={call.vapi_call_id} secs={call.secs} hasRecording={call.has_recording} />
      </div>

      {call.summary && (
        <p className="text-xs text-[#374151] leading-relaxed mb-1.5 whitespace-pre-line">{call.summary}</p>
      )}

      {call.transcript ? (
        <>
          <button onClick={() => setOpenTx(v => !v)}
            className="flex items-center gap-1 text-[11px] text-[#6D6B63] hover:text-[#22211D]">
            {openTx ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Transcript
            <span className="text-[#B5B3AC]">
              ({call.transcript_chars} chars
              {call.transcript_chars > call.transcript.length ? ', truncated' : ''})
            </span>
          </button>
          {openTx && (
            <pre className="mt-1.5 text-[11px] leading-relaxed text-[#4B5563] whitespace-pre-wrap
                            font-sans bg-white border border-[#E9E9E7] rounded-lg p-2.5
                            max-h-72 overflow-y-auto">{call.transcript}</pre>
          )}
        </>
      ) : (
        <p className="text-[11px] text-[#B5B3AC]">No transcript — nobody spoke on this call.</p>
      )}
    </div>
  )
}

export default function LeadDetail({ leadId, onClose }) {
  const [tab, setTab] = useState('calls')
  const { data, loading } = useCfLeadDetail(leadId)

  useEffect(() => { setTab('calls') }, [leadId])

  useEffect(() => {
    if (!leadId) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    // Stop the page behind scrolling while the drawer is open.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [leadId, onClose])

  if (!leadId) return null

  const l = data?.lead
  const calls = data?.calls ?? []
  const msgs = data?.messages ?? []
  const attr = data?.attribution ?? {}
  const known = data?.known_answers ?? {}
  const qCalls = data?.queued_calls ?? []
  const qMsgs = data?.queued_messages ?? []

  const TABS = [
    ['calls', `Calls (${data?.calls_total ?? 0})`],
    ['chat', `WhatsApp (${data?.messages_total ?? 0})`],
    ['timeline', 'Timeline'],
    ['details', 'Details'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} aria-hidden />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Lead detail"
        className="relative w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col"
      >
        {/* ---- header: who, and where they stand ---- */}
        <header className="px-5 pt-4 pb-3 border-b border-[#EEE] shrink-0">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-[#22211D] truncate">
                  {l?.name || (loading ? 'Loading…' : '(no name)')}
                </h3>
                {l?.state && <Pill tone="bg-[#FDF2F8] text-[#9D174D]">{l.state.replace(/_/g, ' ')}</Pill>}
                {l?.killed && <Pill tone="bg-slate-200 text-slate-700">stopped: {l.kill_reason}</Pill>}
                {l?.deleted_at && <Pill tone="bg-rose-100 text-rose-800">contact deleted in GHL</Pill>}
              </div>
              {/* The board's own plain-English line, from the same function, so
                  the card and the drawer can never disagree (§7 item 52). */}
              <p className="text-sm text-[#6D6B63] mt-0.5">{l?.status || (loading ? '' : '—')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {l?.ghl_url && (
                <a href={l.ghl_url} target="_blank" rel="noreferrer"
                   className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#E9E9E7]
                              text-[#6D6B63] hover:bg-[#F7F7F6]">
                  Open in GHL <ExternalLink size={12} />
                </a>
              )}
              <button onClick={onClose} aria-label="Close"
                className="p-1.5 rounded-lg text-[#6D6B63] hover:bg-[#F7F7F6]"><X size={18} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {/* §5.4b: two different numbers. The calling number only appears
                when one is set, and is never presented as "the" number. */}
            <Field label="WhatsApp number" mono>{l?.phone}</Field>
            <Field label="Calling number" mono>
              {l?.call_phone
                ? <span className="text-[#22211D]">{l.call_phone}</span>
                : <span className="text-[#9CA3AF]">same as WhatsApp</span>}
            </Field>
            <Field label="Source">{l?.source}</Field>
            <Field label="First seen">{fmtDT(l?.created_at)}</Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 pt-3 border-t border-[#F3F4F6]">
            <Field label="Cadence">{l?.cadence}</Field>
            <Field label="Step" mono>{l?.step}</Field>
            {/* These two differ on purpose: a carrier failure dials without
                consuming a cadence step (§5.1). */}
            <Field label="Dials / attempts" mono>{l?.dials} / {l?.attempts}</Field>
            <Field label="Next action">{l?.next_action_at ? fmtDT(l.next_action_at) : 'nothing scheduled'}</Field>
            <Field label="Callback">{l?.callback_at ? fmtDT(l.callback_at) : '—'}</Field>
          </div>
        </header>

        <nav className="flex gap-1 px-5 border-b border-[#EEE] shrink-0">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === k ? 'border-[#EC4899] text-[#EC4899]'
                          : 'border-transparent text-[#6B7280] hover:text-[#22211D]'}`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && !data && (
            <p className="flex items-center gap-2 text-sm text-[#9CA3AF] py-8">
              <Loader2 size={14} className="animate-spin" /> Loading the lead…
            </p>
          )}

          {data && !data.found && (
            <p className="text-sm text-[#6B7280] py-8">
              This lead no longer exists{data.reason ? ` (${data.reason})` : ''}.
            </p>
          )}

          {data?.found && tab === 'calls' && (
            <Section title="Every call" icon={PhoneCall}
              right={calls.length < (data.calls_total ?? 0)
                ? `showing ${calls.length} of ${data.calls_total}` : null}>
              {calls.length
                ? calls.map(c => <CallCard key={c.vapi_call_id} call={c} />)
                : <Empty>This lead has never been dialled.</Empty>}
            </Section>
          )}

          {data?.found && tab === 'chat' && (
            <Section title="WhatsApp" icon={MessageSquare}
              right={msgs.length < (data.messages_total ?? 0)
                ? `newest ${msgs.length} of ${data.messages_total}` : null}>
              {msgs.length ? (
                <div className="space-y-2">
                  {msgs.map((m, i) => (
                    <div key={i} className={m.dir === 'inbound' ? '' : 'text-right'}>
                      <span className={`inline-block max-w-[80%] text-left px-3 py-1.5 rounded-2xl text-sm
                                        whitespace-pre-line ${
                        m.dir === 'inbound' ? 'bg-[#F3F4F6] text-[#22211D]' : 'bg-[#FDF2F8] text-[#22211D]'}`}>
                        {m.text || <span className="text-[#9CA3AF] italic">(no text — voice note or image)</span>}
                      </span>
                      <span className="block text-[10px] text-[#9CA3AF] mt-0.5">
                        {fmtDT(m.at)}{m.template ? ` · ${m.template}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <Empty>No messages either way.</Empty>}
            </Section>
          )}

          {data?.found && tab === 'timeline' && (
            <>
              {/* What is ABOUT to happen, before what already did — it is the
                  thing someone reading this screen can still change. */}
              <Section title="Queued next" icon={Clock}>
                {qCalls.length || qMsgs.length ? (
                  <ul className="space-y-1.5">
                    {qCalls.map(q => (
                      <li key={`c${q.id}`} className="flex items-center gap-2 text-xs">
                        <Pill tone={q.status === 'dialing' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}>
                          {q.status === 'dialing' ? 'dialling now' : 'call'}
                        </Pill>
                        <span className="text-[#22211D]">{fmtDT(q.due)}</span>
                        <span className="text-[#9CA3AF]">
                          {q.source}{q.cadence ? ` · ${q.cadence} step ${q.step}` : ''} · to {q.phone}
                        </span>
                      </li>
                    ))}
                    {qMsgs.map(q => (
                      <li key={`m${q.id}`} className="flex items-center gap-2 text-xs">
                        <Pill tone="bg-amber-100 text-amber-900">message</Pill>
                        <span className="text-[#22211D]">{fmtDT(q.due)}</span>
                        <span className="text-[#9CA3AF]">
                          {q.template}{q.cadence ? ` · ${q.cadence} step ${q.step}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : <Empty>Nothing queued — the system will not contact this lead again on its own.</Empty>}
              </Section>

              <Section title="How they got here" icon={GitBranch}>
                {data.journey?.length ? (
                  <ol className="space-y-1.5">
                    {data.journey.map((e, i) => (
                      <li key={i} className="flex gap-3 text-xs">
                        <span className="text-[#9CA3AF] w-28 shrink-0 tabular-nums">{fmtDT(e.at)}</span>
                        <span className="min-w-0">
                          {e.from ? <span className="text-[#9CA3AF]">{e.from} → </span> : null}
                          <strong className="text-[#22211D]">{e.to}</strong>
                          <span className="block text-[#9CA3AF]">{e.reason} · {e.by}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : <Empty>No state changes recorded.</Empty>}
              </Section>

              <Section title="Every action attempted" icon={FileText}
                right={data.actions?.length >= 100 ? 'newest 100' : null}>
                {data.actions?.length ? (
                  <table className="w-full text-[11px]">
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {data.actions.map((a, i) => (
                        <tr key={i}>
                          <td className="py-1 text-[#9CA3AF] whitespace-nowrap pr-2">{fmtDT(a.at)}</td>
                          <td className="pr-2">{a.flow}</td>
                          <td className="pr-2 text-[#6D6B63]">{a.channel}</td>
                          <td className={a.error ? 'text-rose-600' : 'text-[#6D6B63]'}>
                            {a.error || a.result || 'pending'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <Empty>Nothing logged.</Empty>}
              </Section>
            </>
          )}

          {data?.found && tab === 'details' && (
            <>
              <Section title="Meetings" icon={CalendarCheck}>
                {data.appointments?.length ? (
                  <ul className="space-y-1.5">
                    {data.appointments.map((a) => (
                      <li key={a.event_id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[#22211D] tabular-nums">{fmtDT(a.start_at)}</span>
                        <Pill tone={a.status === 'booked' ? 'bg-emerald-100 text-emerald-800' : undefined}>
                          {a.status}
                        </Pill>
                        {a.same_day && <Pill tone="bg-amber-100 text-amber-800">same-day</Pill>}
                        {a.link
                          ? <a className="text-[#EC4899]" href={a.link} target="_blank" rel="noreferrer">meet link</a>
                          : <span className="text-amber-700">no link</span>}
                        <span className="text-[#9CA3AF]">{a.booked_via}</span>
                      </li>
                    ))}
                  </ul>
                ) : <Empty>No meeting has ever been booked for this lead.</Empty>}
              </Section>

              <Section title="What they already told us" icon={FileText}>
                {Object.keys(known).length ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    {Object.entries(known).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs border-b border-[#F7F7F6] py-1">
                        <dt className="text-[#9CA3AF] w-40 shrink-0 truncate">{k.replace(/_/g, ' ')}</dt>
                        <dd className="text-[#22211D] min-w-0 break-words">
                          {typeof v === 'string' ? v : JSON.stringify(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : <Empty>Nothing captured yet.</Empty>}
              </Section>

              <Section title="Where they came from" icon={Megaphone}>
                {attr.meta_ad_id ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ad">{attr.ad_name || attr.meta_ad_id}</Field>
                    <Field label="Ad set">{attr.adset_name}</Field>
                    <Field label="Campaign">{attr.campaign_name}</Field>
                    {attr.preview_url && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF]">Creative</p>
                        <a className="text-sm text-[#EC4899]" href={attr.preview_url}
                           target="_blank" rel="noreferrer">see the ad</a>
                      </div>
                    )}
                  </div>
                ) : (
                  // §7 item 55: only ~27% of historic leads carry an ad id, so
                  // "no ad" would be a claim the data does not support.
                  <Empty>Not attributed to an ad — this lead arrived without ad tracking, which is
                    not the same as it having come from nowhere.</Empty>
                )}
              </Section>

              <Section title="Did the AI fail, or the system?" icon={Bug}>
                {data.qa?.length ? data.qa.map((t) => (
                  <div key={t.ticket_id} className="mb-2.5 border-b border-[#F3F4F6] pb-2 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={VERDICT_TONE[t.verdict]}>{t.verdict}</Pill>
                      <span className="text-[11px] text-[#9CA3AF]">severity {t.severity}/5</span>
                      <span className="text-xs font-medium text-[#22211D]">{t.title}</span>
                      <span className="text-[11px] text-[#9CA3AF] ml-auto">{fmtDT(t.at)}</span>
                    </div>
                    {t.analysis && <p className="text-xs text-[#374151] mt-1">{t.analysis}</p>}
                    {t.fix && <p className="text-xs text-[#059669] mt-1">Fix: {t.fix}</p>}
                  </div>
                )) : <Empty>No QA ticket has been raised for this lead.</Empty>}
              </Section>

              <Section title="Identifiers">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Lead id" mono>{l?.lead_id}</Field>
                  <Field label="GHL contact id" mono>{l?.ghl_contact_id}</Field>
                  <Field label="Region">{l?.region} · {l?.timezone}</Field>
                  <Field label="Pipeline stage">{l?.stage_name}</Field>
                </div>
              </Section>
            </>
          )}
        </div>

        <footer className="px-5 py-2 border-t border-[#EEE] text-[11px] text-[#9CA3AF] shrink-0">
          All times Dubai · refreshes every 20s while open
        </footer>
      </aside>
    </div>
  )
}
