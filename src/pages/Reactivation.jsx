import { useEffect, useMemo, useState } from 'react'
import {
  Play, Pause, RotateCcw, ShieldAlert, Search, Voicemail, Loader2,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'
import { Panel } from '../components/ui/Console'
import { useDashboard } from '../store/dashboard'
import { toast } from 'sonner'
import {
  useCampaignOverview, useCampaignFunnel, useCampaignDaily,
  useCampaignMembers, useCampaignEvents, useCampaignPool,
  campaignControl,
} from '../hooks/useCfCampaign'

/**
 * Reactivation — the old database, called again.
 *
 * The page answers one question before any other: WHY IS NOTHING DIALLING?
 * That is almost never a fault — it is the launch gate holding the campaign
 * back until the pilot proves a connect rate, or a kill criterion having
 * fired, or the day's dial cap being spent. So the gate, the kill meters and
 * today's pacing sit at the top, above the funnel and the numbers, and the
 * pacer's own decision log sits at the bottom in its own words.
 *
 * 🔑 A MISSING MEASUREMENT IS AN EM-DASH, NEVER A ZERO. Every *_pct comes back
 * null when its denominator is zero, and "0% show rate" on zero meetings is a
 * measured claim nobody measured (CLAUDE.md §7 item 56). `pct()` and `num()`
 * are the only two things that render a number on this page, so there is one
 * place for that rule to hold rather than forty.
 */

const DUBAI = 'Asia/Dubai'

// The two renderers. Nothing else on this page prints a number.
const num = (n) =>
  n == null || n === '' || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })

const pct = (n) =>
  n == null || Number.isNaN(Number(n)) ? '—' : `${Number(n).toFixed(Number(n) % 1 ? 1 : 0)}%`

const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: DUBAI, hour: '2-digit', minute: '2-digit' }) : '—'

const fmtDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: DUBAI, day: 'numeric', month: 'short' }) : '—'

const fmtWhen = (iso) => (iso ? `${fmtDay(iso)} ${fmtTime(iso)}` : '—')

const words = (s) => String(s ?? '').replace(/_/g, ' ')

// A pacer event's `detail` is free-form. Print an object as readable pairs
// rather than raw JSON — this log is read by a person asking why the campaign
// is quiet, not by a parser.
const detailText = (d) => {
  if (d == null) return ''
  if (typeof d === 'string') return d
  if (typeof d !== 'object') return String(d)
  return Object.entries(d).map(([k, v]) => `${words(k)}: ${v == null ? '—' : v}`).join(' · ')
}

const STATUS_TONE = {
  draft: 'bg-slate-100 text-slate-700',
  piloting: 'bg-blue-100 text-blue-800',
  running: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-amber-100 text-amber-800',
  halted: 'bg-rose-100 text-rose-800',
  done: 'bg-slate-100 text-slate-700',
}

// Chart tones. Recharts takes colours as props, so they cannot come from a
// class — these are the same dark-ground values Console's GrowthChart uses, so
// the two charts read as one system and neither depends on the light-to-dark
// remap in index.css.
const TONE_DIALS = '#60A5FA'
const TONE_CONNECTS = '#10B981'
const TONE_RATE = '#EC4899'

function Empty({ children }) {
  return <p className="text-sm text-[#9CA3AF] py-6 text-center">{children}</p>
}

function Pill({ tone, children }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${tone}`}>
      {children}
    </span>
  )
}

/** A labelled figure. The label is quiet, the number is the point. */
function Stat({ label, value, note }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <p className="text-lg font-medium text-[#111] tabular-nums">{value}</p>
      {note && <p className="text-[11px] text-[#6B7280] truncate">{note}</p>}
    </div>
  )
}

/** A bar filled to `value` against `max`. Colour comes from a class, never an
 *  inline literal — only the width is inline (the Lead Desk targets pattern). */
function Bar2({ value, max, tone = 'bg-[#EC4899]' }) {
  const p = value == null || !max ? 0 : Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100))
  return (
    <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
      <div className={`h-full ${tone}`} style={{ width: `${p}%` }} />
    </div>
  )
}

export default function Reactivation() {
  const range = useDashboard(s => s.dateRange)

  const { data: overview, loading, error, refresh: refreshOverview } = useCampaignOverview()
  const { data: funnel } = useCampaignFunnel()
  const { data: daily } = useCampaignDaily(range)
  const { data: events, refresh: refreshEvents } = useCampaignEvents(40)
  const { data: pool } = useCampaignPool()

  const [busy, setBusy] = useState(null)

  // Members: filtered, searched and paged. The search is debounced so a slow
  // RPC is not called on every keystroke.
  const PAGE = 25
  const [memberStatus, setMemberStatus] = useState('all')
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => setSearch(typed.trim()), 350)
    return () => clearTimeout(id)
  }, [typed])

  // Any change of filter or search puts you back on page one — otherwise a
  // narrower result silently renders empty because the offset is past its end.
  useEffect(() => { setOffset(0) }, [memberStatus, search])

  const { data: members, loading: membersLoading } = useCampaignMembers({
    status: memberStatus, q: search || undefined, limit: PAGE, offset,
  })

  const status = overview?.status
  const gate = overview?.gate
  const kill = overview?.kill
  const stats = overview?.stats

  const act = async (action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(action)
    try {
      const out = await campaignControl(action)
      toast.success(`Campaign ${words(out?.status ?? action)}${out?.was ? ` · was ${words(out.was)}` : ''}`)
      refreshOverview()
      refreshEvents()
    } catch (e) {
      // A refusal from the pacer is the useful answer, not a failure to hide.
      toast.error(e.message || 'The campaign refused that action')
    } finally {
      setBusy(null)
    }
  }

  const chartRows = useMemo(() => (daily?.rows ?? []).map(d => ({
    label: fmtDay(d.date),
    dials: d.dials == null ? null : Number(d.dials),
    connects: d.connects == null ? null : Number(d.connects),
    // Deliberately preserved as null rather than coerced to 0: a day with no
    // dials has no connect rate, and a 0% point drags the line to the floor.
    connect_pct: d.connect_pct == null ? null : Number(d.connect_pct),
  })), [daily])

  if (loading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-40 w-full" />)}</div>
  }

  if (error) {
    return (
      <Panel eyebrow="Reactivation" title="Could not read the campaign">
        <Empty>{String(error.message || error)}</Empty>
      </Panel>
    )
  }

  if (!overview?.found) {
    return (
      <Panel eyebrow="Reactivation" title="No campaign configured">
        <Empty>
          Nothing is enrolled and no campaign exists yet. Once one is created it appears here
          with its launch gate, its pacing and its decision log.
        </Empty>
      </Panel>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── 1. Status ─────────────────────────────────────────────────── */}
      <Panel
        eyebrow="Reactivation campaign"
        title={overview.name || 'Reactivation'}
        right={
          <div className="flex items-center gap-2">
            <Pill tone={STATUS_TONE[status] ?? 'bg-slate-100 text-slate-700'}>{words(status)}</Pill>
            {busy && <Loader2 size={13} className="animate-spin text-[#9CA3AF]" />}

            {status === 'draft' && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => act('start',
                  'Start the reactivation campaign? The pilot dials real leads from the old database.')}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#EC4899] text-white disabled:opacity-50"
              >
                <Play size={12} /> Start campaign
              </button>
            )}

            {(status === 'piloting' || status === 'running') && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => act('pause')}
                className="cf-newbtn disabled:opacity-50"
              >
                <Pause size={12} /> Pause
              </button>
            )}

            {status === 'paused' && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => act('resume')}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#EC4899] text-white disabled:opacity-50"
              >
                <Play size={12} /> Resume
              </button>
            )}

            {status === 'halted' && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => act('clear_halt',
                  'Clear the halt? The campaign stopped itself because a kill criterion was breached — clearing it lets dialling start again.')}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#EC4899] text-white disabled:opacity-50"
              >
                <RotateCcw size={12} /> Clear halt
              </button>
            )}
          </div>
        }
      >
        {status === 'halted' && (
          <div className="cf-emptyrange">
            <ShieldAlert size={14} />
            <span>
              <em>The campaign halted itself.</em>{' '}
              {overview.halted_reason || 'No reason was recorded.'} Nothing will dial until the halt is cleared.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          <Stat label="Region" value={overview.region || '—'} note={overview.timezone || ''} />
          <Stat label="Cadence" value={overview.cadence_id || '—'} />
          <Stat label="Started" value={overview.started_at ? fmtWhen(overview.started_at) : '—'}
                note={overview.started_at ? '' : 'not started yet'} />
          <Stat label="Enrolled" value={num(stats?.members_total)}
                note={`${num(stats?.members_pending)} still to call`} />
          <Stat label="In flight" value={num(stats?.in_flight)} />
          <Stat label="Released" value={num(stats?.members_released)}
                note={`${num(stats?.members_excluded)} excluded`} />
        </div>

        {overview.last_event && (
          <p className="mt-4 text-xs text-[#6B7280]">
            Last decision {fmtWhen(overview.last_event.at)} ·{' '}
            <span className="text-[#111]">{words(overview.last_event.kind)}</span>
            {overview.last_event.detail ? ` · ${detailText(overview.last_event.detail)}` : ''}
          </p>
        )}
      </Panel>

      {/* ── 2. The launch gate ────────────────────────────────────────── */}
      {/* The single most important thing on the page: it is the answer to
          "why is nothing dialling" on almost every day the campaign is quiet. */}
      <Panel
        eyebrow="Launch gate"
        title={gate?.passed ? 'Pilot passed — the campaign may run' : 'Holding until the pilot proves itself'}
        glow={!gate?.passed}
        right={
          <Pill tone={gate?.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
            {gate?.passed ? 'passed' : 'holding'}
          </Pill>
        }
      >
        {!gate?.passed && (
          <p className="text-sm text-[#374151] mb-4">
            {gate?.pilot_complete
              ? <>The pilot is complete and its connect rate is <b>{pct(gate?.connect_pct)}</b> against a
                  required <b>{pct(gate?.required_pct)}</b>. The campaign is holding and will not dial
                  beyond the pilot until that is met.</>
              : <>The pilot has made <b>{num(gate?.pilot_dials)}</b> of <b>{num(gate?.pilot_size)}</b> dials.
                  Nothing beyond the pilot dials until it finishes and clears
                  a <b>{pct(gate?.required_pct)}</b> connect rate.</>}
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Pilot progress</span>
              <span className="tabular-nums">
                {num(gate?.pilot_dials)} <span className="text-[#9CA3AF]">/ {num(gate?.pilot_size)}</span>
              </span>
            </div>
            <Bar2 value={gate?.pilot_dials} max={gate?.pilot_size} />
            <p className="text-[11px] text-[#9CA3AF] mt-1">
              {gate?.pilot_complete ? 'Pilot complete' : 'Pilot in progress'}
            </p>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Measured connect rate</span>
              <span className="tabular-nums">
                {pct(gate?.connect_pct)} <span className="text-[#9CA3AF]">/ {pct(gate?.required_pct)} required</span>
              </span>
            </div>
            <Bar2
              value={gate?.connect_pct}
              max={gate?.required_pct}
              tone={gate?.connect_pct == null ? 'bg-[#F3F4F6]'
                : Number(gate.connect_pct) >= Number(gate.required_pct) ? 'bg-emerald-500' : 'bg-amber-400'}
            />
            <p className="text-[11px] text-[#9CA3AF] mt-1">
              {gate?.connect_pct == null
                ? 'No dials yet — nothing has been measured'
                : `${num(gate?.pilot_dials)} dials measured`}
            </p>
          </div>
        </div>
      </Panel>

      {/* ── 3. Kill criteria ──────────────────────────────────────────── */}
      <Panel
        eyebrow="Kill criteria"
        title="What would stop the campaign"
        right={<span className="text-xs text-[#6B7280]">a criterion only fires once it has enough sample</span>}
      >
        <div className="grid md:grid-cols-3 gap-x-8 gap-y-5">
          {[
            ['connect', 'Connect rate', kill?.connect],
            ['booking', 'Booking rate', kill?.booking],
            ['show', 'Show rate', kill?.show],
          ].map(([key, label, k]) => {
            // An UNARMED criterion has not got enough sample to fire. It must
            // never read as "passing" — that is a measured claim about a
            // measurement nobody has taken yet.
            const armed = !!k?.armed
            const breached = armed && k?.pct != null && Number(k.pct) < Number(k.floor)
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">{label}</span>
                  <Pill tone={
                    !armed ? 'bg-slate-100 text-slate-700'
                    : breached ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                  }>
                    {!armed ? 'not enough data yet' : breached ? 'below floor' : 'holding'}
                  </Pill>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="tabular-nums text-[#111]">{pct(k?.pct)}</span>
                  <span className="text-xs text-[#9CA3AF] tabular-nums">floor {pct(k?.floor)}</span>
                </div>
                <Bar2
                  value={k?.pct}
                  max={k?.floor}
                  tone={!armed ? 'bg-[#F3F4F6]' : breached ? 'bg-rose-500' : 'bg-emerald-500'}
                />
                <p className="text-[11px] text-[#9CA3AF] mt-1">
                  {armed
                    ? `${num(k?.sample)} measured · arms after ${num(k?.after)}`
                    : `${num(k?.sample)} of ${num(k?.after)} needed before this can fire`}
                </p>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* ── 4. Today's pacing ─────────────────────────────────────────── */}
      <Panel
        eyebrow="Pacing"
        title="Today"
        right={
          <span className="text-xs text-[#6B7280]">
            {num(overview.dial_spacing_seconds)}s between dials · ramping over {num(overview.ramp_days)} days
          </span>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Stat label="Cap today" value={num(overview.daily_dial_cap)}
                note={`steady ${num(overview.dial_cap_steady)}`} />
          <Stat label="Scheduled today" value={num(overview.scheduled_today)} />
          <Stat label="Dialled today" value={num(stats?.dials_today)} />
          <Stat label="Headroom left" value={num(overview.headroom_today)} />
          <Stat label="Pilot size" value={num(overview.pilot_size)} />
        </div>
        <Bar2 value={stats?.dials_today} max={overview.daily_dial_cap} />
        <p className="text-[11px] text-[#9CA3AF] mt-1">
          {overview.daily_dial_cap
            ? `${num(stats?.dials_today)} of ${num(overview.daily_dial_cap)} dials used`
            : 'No cap set for today'}
        </p>
      </Panel>

      {/* ── 5. Funnel ─────────────────────────────────────────────────── */}
      <Panel eyebrow="Outcomes" title="Against plan"
             right={<span className="text-xs text-[#6B7280]">conservative · target · stretch</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9CA3AF]">
                <th className="py-2">Metric</th>
                <th className="text-right">Actual</th>
                <th className="text-right">Conservative</th>
                <th className="text-right">Target</th>
                <th className="text-right">Stretch</th>
                <th className="w-40">vs target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {funnel?.rows?.length ? [...funnel.rows]
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((r) => {
                  const hit = r.actual != null && r.target != null && Number(r.actual) >= Number(r.target)
                  return (
                    <tr key={r.metric}>
                      <td className="py-2">{r.metric}</td>
                      <td className="text-right tabular-nums text-[#111]">{num(r.actual)}</td>
                      <td className="text-right tabular-nums text-[#6B7280]">{num(r.conservative)}</td>
                      <td className="text-right tabular-nums text-[#6B7280]">{num(r.target)}</td>
                      <td className="text-right tabular-nums text-[#6B7280]">{num(r.stretch)}</td>
                      <td className="pl-4">
                        {/* No target means no comparison to draw — an empty bar
                            would read as "missed it". */}
                        {r.target == null || r.actual == null
                          ? <span className="text-xs text-[#9CA3AF]">—</span>
                          : <Bar2 value={r.actual} max={r.target}
                                  tone={hit ? 'bg-emerald-500' : 'bg-[#EC4899]'} />}
                      </td>
                    </tr>
                  )
                }) : <tr><td colSpan={6}><Empty>Nothing measured yet</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── 6. The ladder ─────────────────────────────────────────────── */}
      <Panel eyebrow="The cadence" title="How each lead is worked"
             right={<span className="text-xs text-[#6B7280]">all times Dubai</span>}>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {overview.ladder?.length ? overview.ladder.map((s) => (
            <div key={s.step} className="cf-col">
              <div className="cf-col__head">
                <span className="cf-col__title">Attempt {s.step}</span>
                <span className="cf-col__count">{num(s.dials)} dials</span>
              </div>
              <p className="text-sm text-[#111] mt-1">{s.label || '—'}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{s.window || '—'}</p>
              {s.voicemail && (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 w-fit">
                  <Voicemail size={10} /> leaves a voicemail
                </span>
              )}
            </div>
          )) : <Empty>No ladder configured</Empty>}
        </div>
      </Panel>

      {/* ── 7. Daily chart ────────────────────────────────────────────── */}
      <Panel
        eyebrow="Over time"
        title="Dials, connects and connect rate"
        right={<span className="text-xs text-[#6B7280]">{range?.from} → {range?.to}</span>}
      >
        {chartRows.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartRows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#8A8781', fontSize: 11 }}
                     axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis yAxisId="count" tick={{ fill: '#8A8781', fontSize: 11 }}
                     axisLine={false} tickLine={false} width={44} />
              <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} unit="%"
                     tick={{ fill: '#8A8781', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,.05)' }}
                contentStyle={{
                  background: 'rgba(18,18,22,.94)', border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 12, color: '#FAFAF9', fontSize: 12,
                }}
                labelStyle={{ color: '#8A8781' }}
                formatter={(v, n) => [v == null ? '—' : (n === 'Connect rate' ? `${v}%` : v), n]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8A8781' }} />
              <Bar yAxisId="count" dataKey="dials" name="Dials" fill={TONE_DIALS} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="count" dataKey="connects" name="Connects" fill={TONE_CONNECTS} radius={[3, 3, 0, 0]} />
              {/* connectNulls stays false: a day with no dials has no rate, and
                  bridging the gap would draw a measurement that was never made. */}
              <Line yAxisId="rate" type="monotone" dataKey="connect_pct" name="Connect rate"
                    stroke={TONE_RATE} strokeWidth={2} dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <Empty>No days in this range</Empty>}
      </Panel>

      {/* ── 8. Members ────────────────────────────────────────────────── */}
      <Panel
        eyebrow="Who is in it"
        title="Members"
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder="Search name or phone…"
                className="text-xs pl-7 pr-2.5 py-1 rounded-lg border border-[#E9E9E7] w-48
                           text-[#22211D] placeholder:text-[#9CA3AF] outline-none focus:border-[#C9C8C4]"
              />
            </div>
            <span className="text-xs text-[#6B7280]">{num(members?.total)} in view</span>
          </div>
        }
      >
        {/* The breakdown as chips. It is both the filter and the answer to
            "how many were excluded, and for what" — the reason lives in the
            key, so it must be readable rather than hidden behind a dropdown. */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button type="button" onClick={() => setMemberStatus('all')}
                  className={`cf-seg-btn${memberStatus === 'all' ? ' is-on' : ''}`}>
            All {members?.total != null ? `· ${num(members.total)}` : ''}
          </button>
          {Object.entries(members?.breakdown ?? {}).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setMemberStatus(k)}
                    className={`cf-seg-btn${memberStatus === k ? ' is-on' : ''}`}>
              {words(k)} · {num(v)}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9CA3AF]">
                <th className="py-2">Lead</th>
                <th>Status</th>
                <th>Lead state</th>
                <th className="text-right">Step</th>
                <th className="text-right">Attempts</th>
                <th>Reached</th>
                <th>Last outcome</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {membersLoading ? (
                <tr><td colSpan={8}><Empty>Loading…</Empty></td></tr>
              ) : members?.rows?.length ? members.rows.map((m) => (
                <tr key={m.lead_id}>
                  <td className="py-2">
                    {m.name || '—'}
                    <span className="block text-xs text-[#9CA3AF]">{m.phone || '—'}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <Pill tone={
                      m.status === 'released' ? 'bg-emerald-100 text-emerald-800'
                      : m.status === 'excluded' ? 'bg-slate-100 text-slate-700'
                      : 'bg-blue-100 text-blue-800'
                    }>{words(m.status)}</Pill>
                    {/* Never hidden: an excluded row without its reason is a
                        row nobody can act on. */}
                    {m.exclude_reason && (
                      <span className="block text-[11px] text-[#6B7280] mt-0.5">{words(m.exclude_reason)}</span>
                    )}
                  </td>
                  <td className="text-xs">{words(m.lead_state) || '—'}</td>
                  <td className="text-right tabular-nums">{m.step_no ?? '—'}</td>
                  <td className="text-right tabular-nums">{num(m.attempts)}</td>
                  <td className="text-xs">{m.reached ? 'yes' : 'no'}</td>
                  <td className="text-xs">{words(m.last_outcome) || '—'}</td>
                  <td className="text-xs whitespace-nowrap">{fmtWhen(m.next_action_at)}</td>
                </tr>
              )) : <tr><td colSpan={8}><Empty>Nobody matches that</Empty></td></tr>}
            </tbody>
          </table>
        </div>

        {(members?.total ?? 0) > PAGE && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-[#6B7280]">
              {num(offset + 1)}–{num(Math.min(offset + PAGE, members.total))} of {num(members.total)}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={offset === 0}
                      onClick={() => setOffset(o => Math.max(0, o - PAGE))}
                      className="cf-seg-btn disabled:opacity-40">Previous</button>
              <button type="button" disabled={offset + PAGE >= (members?.total ?? 0)}
                      onClick={() => setOffset(o => o + PAGE)}
                      className="cf-seg-btn disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </Panel>

      {/* ── 9. The pacer's decision log ───────────────────────────────── */}
      <Panel
        eyebrow="Why it is doing that"
        title="Pacer decisions"
        right={<span className="text-xs text-[#6B7280]">newest first</span>}
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events?.rows?.length ? events.rows.map((e) => (
            <div key={e.id} className="flex items-start gap-3 border-b border-[#F3F4F6] pb-2 last:border-0">
              <Pill tone={
                e.kind === 'halted' ? 'bg-rose-100 text-rose-800'
                : e.kind === 'held' ? 'bg-amber-100 text-amber-800'
                : e.kind === 'released' ? 'bg-emerald-100 text-emerald-800'
                : e.kind === 'ramped' ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-700'
              }>{words(e.kind)}</Pill>
              <p className="text-xs text-[#374151] min-w-0 flex-1">{detailText(e.detail) || '—'}</p>
              <span className="text-xs text-[#9CA3AF] shrink-0 whitespace-nowrap">{fmtWhen(e.at)}</span>
            </div>
          )) : <Empty>The pacer has not made a decision yet</Empty>}
        </div>
      </Panel>

      {/* ── 10. The pool ──────────────────────────────────────────────── */}
      <Panel
        eyebrow="The callable list"
        title={`${num(pool?.eligible)} of ${num(pool?.total)} leads can be called`}
        right={<span className="text-xs text-[#6B7280]">why the rest cannot</span>}
      >
        {Object.keys(pool?.breakdown ?? {}).length ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-2">
            {Object.entries(pool.breakdown)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .map(([reason, count]) => (
                <div key={reason}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate">{words(reason)}</span>
                    <span className="tabular-nums text-[#6B7280]">{num(count)}</span>
                  </div>
                  <Bar2 value={count} max={pool?.total} tone="bg-[#EC4899]" />
                </div>
              ))}
          </div>
        ) : <Empty>Nothing has been assessed for this campaign yet</Empty>}
      </Panel>
    </div>
  )
}
