import { useState } from 'react'
import { Search, Loader2, PhoneCall, MessageSquare, GitBranch, Bug, FileText } from 'lucide-react'
import { lookupLead, useCfQaDigest, useCfEod } from '../hooks/useCfDesk'

const DUBAI = 'Asia/Dubai'
const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', {
    timeZone: DUBAI, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '—'

const VERDICT_STYLE = {
  ai_failure: 'bg-rose-100 text-rose-800',
  system_failure: 'bg-amber-100 text-amber-800',
  lead_not_ready: 'bg-slate-100 text-slate-700',
  unclear: 'bg-slate-100 text-slate-500',
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="bg-white rounded-2xl border border-[#EEE] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
        {Icon && <Icon size={15} className="text-[#EC4899]" />}{title}
      </h3>
      {children}
    </section>
  )
}

export default function LeadLookup() {
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const { data: qa } = useCfQaDigest(7)
  const { data: eod } = useCfEod('uae')

  const search = async (e) => {
    e?.preventDefault()
    if (!q.trim()) return
    setBusy(true); setErr(null)
    try {
      setRes(await lookupLead(q.trim()))
    } catch (e2) {
      setErr(e2.message || 'Lookup failed')
    } finally {
      setBusy(false)
    }
  }

  const lead = res?.lead

  return (
    <div className="space-y-6">
      {/* PDF section 10: "what happened to lead X, where are they now, did the
          AI fail or the system" */}
      <form onSubmit={search} className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone (+9715…) or GHL contact id"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#EEE] text-sm outline-none focus:border-[#EC4899]"
          />
        </div>
        <button type="submit" disabled={busy}
          className="px-4 py-2.5 rounded-xl bg-[#EC4899] text-white text-sm font-medium disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : 'Look up'}
        </button>
      </form>

      {err && <p className="text-sm text-rose-600">{err}</p>}
      {res && !res.found && <p className="text-sm text-[#6B7280]">No lead matched “{q}”.</p>}

      {lead && (
        <>
          <div className="bg-white rounded-2xl border border-[#EEE] p-5">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <h2 className="text-lg font-semibold">{lead.name || '(no name)'}</h2>
              <span className="text-sm text-[#6B7280]">{lead.phone}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#FDF2F8] text-[#9D174D]">{lead.state}</span>
              {lead.killed && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  stopped: {lead.kill_reason}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 text-sm">
              <div><p className="text-xs text-[#9CA3AF]">Cadence</p>{lead.cadence || '—'}</div>
              <div><p className="text-xs text-[#9CA3AF]">Step</p>{lead.step}</div>
              {/* These two differ on purpose: a SIP failure dials without
                  consuming a cadence step. */}
              <div><p className="text-xs text-[#9CA3AF]">Dials</p>{lead.dials}</div>
              <div><p className="text-xs text-[#9CA3AF]">Real attempts</p>{lead.attempts}</div>
              <div><p className="text-xs text-[#9CA3AF]">Next action</p>{fmt(lead.next_action_at)}</div>
            </div>
            {lead.reason && <p className="mt-3 text-sm text-[#6B7280]">Why: {lead.reason}</p>}
          </div>

          {res.qa?.length > 0 && (
            <Panel title="Did the AI fail, or the system?" icon={Bug}>
              {res.qa.map((t, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${VERDICT_STYLE[t.verdict] || ''}`}>
                      {t.verdict}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">severity {t.severity}/5</span>
                    <span className="text-sm font-medium">{t.title}</span>
                  </div>
                  <p className="text-sm text-[#374151] mt-1">{t.analysis}</p>
                  {t.fix && <p className="text-sm text-[#059669] mt-1">Fix: {t.fix}</p>}
                </div>
              ))}
            </Panel>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <Panel title="Journey" icon={GitBranch}>
              <ol className="space-y-2 max-h-80 overflow-y-auto">
                {res.journey?.map((e, i) => (
                  <li key={i} className="text-sm flex gap-3">
                    <span className="text-xs text-[#9CA3AF] w-28 shrink-0">{fmt(e.at)}</span>
                    <span>
                      {e.from ? `${e.from} → ` : ''}<strong>{e.to}</strong>
                      <span className="block text-xs text-[#9CA3AF]">{e.reason} · {e.by}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel title="Calls" icon={PhoneCall}>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {res.calls?.length ? res.calls.map((c, i) => (
                  <div key={i} className="text-sm border-b border-[#F3F4F6] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9CA3AF]">{fmt(c.at)}</span>
                      <span className={`text-xs px-1.5 rounded ${c.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {c.connected ? 'connected' : 'no connect'}
                      </span>
                      {c.outcome && <span className="text-xs">{c.outcome}</span>}
                      {c.secs != null && <span className="text-xs text-[#9CA3AF]">{c.secs}s</span>}
                    </div>
                    {c.summary && <p className="text-xs text-[#374151] mt-1">{c.summary}</p>}
                    {!c.connected && <p className="text-[11px] text-[#9CA3AF]">{c.reason}</p>}
                  </div>
                )) : <p className="text-sm text-[#9CA3AF]">No calls</p>}
              </div>
            </Panel>

            <Panel title="WhatsApp" icon={MessageSquare}>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {/* cf.message.direction is 'inbound'/'outbound'. It used to be
                    compared against 'in', which matches nothing — so every
                    message the LEAD sent rendered as one of ours. That is §7
                    item 47's two-vocabularies bug surviving in the UI after
                    migration 029 normalised the column. Verified live: 8,644
                    'inbound' and 31,560 'outbound', zero 'in'/'out'. */}
                {res.messages?.length ? res.messages.map((m, i) => (
                  <div key={i} className={`text-sm ${m.dir === 'inbound' ? '' : 'text-right'}`}>
                    <span className={`inline-block px-3 py-1.5 rounded-2xl ${
                      m.dir === 'inbound' ? 'bg-[#F3F4F6]' : 'bg-[#FDF2F8]'}`}>
                      {m.text}
                    </span>
                    <span className="block text-[11px] text-[#9CA3AF]">{fmt(m.at)}</span>
                  </div>
                )) : <p className="text-sm text-[#9CA3AF]">No messages</p>}
              </div>
            </Panel>

            <Panel title="Every action attempted" icon={FileText}>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {res.actions?.length ? res.actions.map((a, i) => (
                      <tr key={i}>
                        <td className="py-1.5 text-[#9CA3AF] whitespace-nowrap">{fmt(a.at)}</td>
                        <td>{a.flow}</td>
                        <td>{a.channel}</td>
                        <td className={a.error ? 'text-rose-600' : ''}>{a.result || 'pending'}</td>
                      </tr>
                    )) : <tr><td className="text-[#9CA3AF] py-2">No actions logged</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}

      {!lead && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Panel title="Where the issue is — last 7 days" icon={Bug}>
            {qa?.tickets ? (
              <>
                <p className="text-3xl font-semibold">{qa.ai_failure_rate ?? 0}<span className="text-base text-[#6B7280]">% AI failure</span></p>
                <p className="text-xs text-[#9CA3AF] mb-3">{qa.tickets} calls reviewed · {qa.open_tickets} open tickets</p>
                {qa.top_issues?.map((t, i) => (
                  <div key={i} className="text-sm border-t border-[#F3F4F6] pt-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${VERDICT_STYLE[t.verdict] || ''}`}>{t.verdict}</span>
                    {t.title}
                    {t.fix && <p className="text-xs text-[#059669] mt-0.5">{t.fix}</p>}
                  </div>
                ))}
              </>
            ) : <p className="text-sm text-[#9CA3AF]">No QA tickets yet.</p>}
          </Panel>

          <Panel title="EOD report" icon={FileText}>
            <pre className="text-xs whitespace-pre-wrap font-sans text-[#374151] max-h-96 overflow-y-auto">
              {eod || 'No data yet.'}
            </pre>
          </Panel>
        </div>
      )}
    </div>
  )
}
