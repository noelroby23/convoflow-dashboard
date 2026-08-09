import { useState } from 'react'
import { AlertTriangle, Megaphone } from 'lucide-react'
import { useCfRpc } from '../hooks/useCfDesk'
import { useDashboard } from '../store/dashboard'
import { exportCsv } from '../lib/exportCsv'
import ErrorBoundary from '../components/ui/ErrorBoundary'

/**
 * Creative Performance, on cf.
 *
 * This page used to read the old project's multi-client `public` schema and
 * 404'd against convoflow-v2. It now reads cf_dash_creative, which joins Meta
 * spend to what the lead actually did — §5.9a's question is "Abdus's lead came
 * from ad set one, and Abdus's lead isn't getting booked", so bookings per ad
 * is the number, not lead count.
 *
 * Money is never coerced. An ad with no spend row shows blank, not AED 0.
 */

const money = (v) => (v == null ? '—' : `AED ${Number(v).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`)
const num = (v) => (v == null ? '—' : Number(v).toLocaleString('en-AE'))
const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(1)}%`)

const GROUPS = [['ad', 'By ad'], ['adset', 'By ad set'], ['campaign', 'By campaign']]

function Tile({ label, value, hint }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EEE] p-4">
      <p className="text-xs text-[#6B7280]">{label}</p>
      <p className="text-2xl font-semibold mt-1 text-[#111]">{value}</p>
      {hint && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{hint}</p>}
    </div>
  )
}

export default function AdCreatives() {
  const range = useDashboard(s => s.dateRange)
  const [group, setGroup] = useState('ad')
  const { data, loading, error } = useCfRpc('cf_dash_creative', {
    p: { region: 'uae', group_by: group, from: range?.from, to: range?.to },
  }, { intervalMs: 120_000 })

  const rows = data?.rows ?? []
  const totals = data?.totals ?? {}
  const cov = data?.coverage

  const exportRows = () => {
    if (!rows.length) return
    exportCsv(rows.map(r => ({
      name: r.name, spend: r.spend, impressions: r.impressions, clicks: r.clicks,
      meta_leads: r.leads_meta, leads_attributed: r.leads, reached: r.reached,
      booked: r.booked, cost_per_lead: r.cost_per_lead,
      cost_per_booking: r.cost_per_booking, booking_rate: r.booking_rate,
    })), `convoflow-creative-${group}-${range?.from}-${range?.to}`)
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#111]">
            <Megaphone size={16} className="text-[#EC4899]" /> Creative performance
          </h2>
          <div className="inline-flex rounded-lg border border-[#E9E9E7] overflow-hidden">
            {GROUPS.map(([k, lbl]) => (
              <button key={k} onClick={() => setGroup(k)}
                className={`px-2.5 py-1 text-xs ${group === k
                  ? 'bg-[#22211D] text-white' : 'bg-white text-[#6D6B63] hover:bg-[#F7F7F6]'}`}>
                {lbl}
              </button>
            ))}
          </div>
          <button onClick={exportRows}
            className="text-xs px-2.5 py-1 rounded-lg border border-[#E9E9E7] text-[#6D6B63] hover:bg-[#F7F7F6]">
            Export CSV
          </button>
          <span className="ml-auto text-xs text-[#9CA3AF]">{range?.from} → {range?.to}</span>
        </div>

        {/* The most important thing on this page. Half the spend sits against
            ads with no attributed leads, and that is a measurement gap, not a
            verdict on the creative. Saying so prevents a working ad being
            switched off on this page's evidence. */}
        {cov && cov.coverage_pct != null && cov.coverage_pct < 90 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                Only {pct(cov.coverage_pct)} of leads in this window carry an ad ID
                ({num(cov.leads_attributed)} of {num(cov.leads_total)}).
              </p>
              <p className="text-amber-800 mt-0.5">
                {num(cov.paid_source_unattributed)} more came from a paid source with no ad
                recorded, so an ad showing <strong>0 leads</strong> here has not been proven to
                produce none — we simply cannot tell which ad those leads came from. Historic
                attribution was inherited from the old system, which only ever tagged some
                contacts. New leads arriving through <code>cfv2/intake</code> are attributed at
                source, so this closes on its own from here.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Tile label="Spend" value={money(totals.spend)} />
          <Tile label="Leads attributed" value={num(totals.leads)} />
          <Tile label="Reached" value={num(totals.reached)} />
          <Tile label="Booked" value={num(totals.booked)} />
          <Tile label="Cost per lead" value={money(totals.cost_per_lead)} />
          <Tile label="Cost per booking" value={money(totals.cost_per_booking)} />
        </div>

        <section className="bg-white rounded-2xl border border-[#EEE] p-5">
          {loading && <p className="text-sm text-[#9CA3AF] py-6 text-center">Loading…</p>}
          {error && <p className="text-sm text-red-600 py-6 text-center">{String(error.message || error)}</p>}
          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-[#9CA3AF] py-6 text-center">
              No ad data in this range.
            </p>
          )}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[#9CA3AF] border-b border-[#F3F4F6]">
                    <th className="py-2 pr-3">{group === 'ad' ? 'Ad' : group === 'adset' ? 'Ad set' : 'Campaign'}</th>
                    <th className="py-2 px-2 text-right">Spend</th>
                    <th className="py-2 px-2 text-right">Impr.</th>
                    <th className="py-2 px-2 text-right">Clicks</th>
                    <th className="py-2 px-2 text-right" title="Meta's own lead count for this ad">Meta leads</th>
                    <th className="py-2 px-2 text-right" title="Leads in cf carrying this ad ID">Ours</th>
                    <th className="py-2 px-2 text-right">Reached</th>
                    <th className="py-2 px-2 text-right">Booked</th>
                    <th className="py-2 px-2 text-right">CPL</th>
                    <th className="py-2 px-2 text-right">Cost / booking</th>
                    <th className="py-2 pl-2 text-right">Book %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    // Meta says it produced leads and we attributed none: the
                    // gap is ours. Flag the row rather than let it read as a
                    // dead creative.
                    const gap = Number(r.leads_meta ?? 0) > 0 && Number(r.leads ?? 0) === 0
                    return (
                      <tr key={r.key} className="border-b border-[#F9FAFB] last:border-0">
                        <td className="py-2 pr-3">
                          <span className="text-[#111]">{r.name}</span>
                          {r.status && (
                            <span className="ml-2 text-[10px] uppercase text-[#9CA3AF]">{r.status}</span>
                          )}
                          {gap && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800"
                                  title="Meta reports leads for this ad but none of ours carry its ID">
                              not attributed
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{money(r.spend)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{num(r.impressions)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{num(r.clicks)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[#6B7280]">{num(r.leads_meta)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{num(r.leads)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{num(r.reached)}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-medium">{num(r.booked)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{money(r.cost_per_lead)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{money(r.cost_per_booking)}</td>
                        <td className="py-2 pl-2 text-right tabular-nums">{pct(r.booking_rate)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ErrorBoundary>
  )
}
