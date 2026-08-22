import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { useCampaign, fetchExport } from './useCampaign'
import { num } from './format'

/**
 * The export sheet — §10.2.
 *
 * 🔑 IT ACTUALLY PRODUCES A FILE. A download button that opens a dialog and
 * writes nothing is the same fault as an agent narrating a tool it never
 * called (CLAUDE.md §7 item 96): everything looks like it worked. So CSV and
 * PDF are built here from real rows, and the one format this app genuinely
 * cannot produce — a real .xlsx — is DISABLED with a reason on it rather than
 * offered and quietly faked.
 *
 * ⚠️ TWO THINGS THE DATABASE INSISTS ON, AND WHY THEY ARE HONOURED HERE:
 *
 *   1. `newlines: 'space'` for anything tabular. A transcript carries commas,
 *      quotes AND newlines every single time. Papa quotes correctly, but the
 *      file is opened by Excel and by other people's scripts, and a raw
 *      newline inside a quoted cell is where those lose rows SILENTLY. The
 *      RPC offers the safe mode explicitly; a CSV that does not take it is a
 *      CSV that looks fine and is wrong in the middle.
 *
 *   2. `recording_call_id`, never a recording URL. cf.call.recording_url is
 *      VAPI's unsigned R2 path and 404s in a browser; the audio itself is gone
 *      after 14 days (§7 items 139/105). A column of those is a column of dead
 *      links that reads as working. The file therefore carries the call id and
 *      says where to play it — which is what the RPC already returns.
 */

/** One anchor-click download, defined once. LeadDrawer imports it rather than
 *  keeping a second copy — §7 item 127 is the record of what a hand-written
 *  duplicate costs when only one of the two gets fixed. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick — Safari cancels the download if the URL dies first.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const stamp = () => new Date().toISOString().slice(0, 10)

/**
 * What each tab means by "this". The export RPC filters by pipeline column and
 * by nothing else, so a tab whose subset it cannot express says the whole
 * campaign in plain words instead of implying a filter that is not applied.
 */
const CONTEXT = {
  overview:  { title: 'Everyone in the campaign',        column: null },
  targets:   { title: 'Everyone in the campaign',        column: null },
  queue:     { title: 'Everyone in the campaign',        column: null,
               note: 'The queue is a live view; the file is the whole list with each person’s stage.' },
  shifts:    { title: 'Everyone in the campaign',        column: null },
  pipeline:  { title: 'Pipeline — every stage',          column: null },
  followups: { title: 'Follow-ups — everyone mid-cycle', column: 'in_follow_up' },
  review:    { title: 'Everyone in the campaign',        column: null,
               note: 'Call review is per call; this file is per lead, carrying their last call.' },
  setup:     { title: 'Everyone in the campaign',        column: null },
}

const TOGGLES = [
  { key: 'contact', label: 'Contact details', on: true,
    hint: 'Name, phone, calling number, email, source, the date they first enquired' },
  { key: 'outcomes', label: 'Call outcomes', on: true,
    hint: 'Attempts, whether we reached them, last result, when, how long, the summary' },
  { key: 'transcripts', label: 'Full transcripts', on: false,
    hint: 'Every word of the last call, one row per lead. Makes the file large.' },
  { key: 'recordings', label: 'Recording links', on: false,
    hint: 'The call id for each recording. Audio expires after 14 days, so the file carries the id and you play it here — a stored link would be dead by the time anyone clicked it.' },
  { key: 'qualification', label: 'What Sarah captured', on: false,
    hint: 'Industry, lead volume, who follows up, budget, decision maker, main problem' },
]

/** Roughly how much each switched-on section adds per row. Deliberately coarse
 *  and labelled as a guess on screen — a precise-looking size that is wrong is
 *  worse than an obvious estimate. */
const BYTES = { base: 120, contact: 110, outcomes: 260, transcripts: 3200, recordings: 60, qualification: 130 }

const size = (bytes) => {
  if (!bytes || bytes < 0) return null
  if (bytes < 900_000) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

/** Column order for the sheet. Anything the RPC returns that is not named here
 *  is appended rather than dropped — a silently missing column is the one bug
 *  an export cannot afford. */
const ORDER = [
  'name', 'phone', 'calling_number', 'email', 'source', 'first_enquired',
  'column', 'member_status', 'not_called_because',
  'attempts', 'reached', 'last_outcome', 'last_call_at', 'duration_sec', 'summary',
  'industry', 'lead_volume', 'who_follows_up', 'budget', 'decision_maker', 'main_problem',
  'recording_call_id', 'recording_note', 'transcript', 'lead_id',
]

const orderFields = (rows) => {
  const seen = new Set()
  rows.forEach((r) => Object.keys(r).forEach((k) => seen.add(k)))
  const named = ORDER.filter((k) => seen.has(k))
  const rest = [...seen].filter((k) => !ORDER.includes(k)).sort()
  return [...named, ...rest]
}

export default function ExportSheet({ tab, onClose }) {
  const c = useCampaign()
  const ctx = CONTEXT[tab] || CONTEXT.overview

  const [want, setWant] = useState(() =>
    Object.fromEntries(TOGGLES.map((t) => [t.key, t.on])))
  const [fmt, setFmt] = useState('csv')
  const [busy, setBusy] = useState(false)

  /**
   * The row count comes from the pipeline feed the Pipeline tab reads, not from
   * a count of our own — CONTRACT rule 1. Two components counting "how many
   * people are in this campaign" is exactly how this app once had three
   * different answers for meetings booked.
   */
  const pipe = c.pipeline.data
  const rowsExpected = useMemo(() => {
    if (!pipe) return null
    if (!ctx.column) return pipe.members ?? null
    const col = (pipe.columns || []).find((x) => x.col === ctx.column)
    return col ? col.count : null
  }, [pipe, ctx.column])

  const estBytes = useMemo(() => {
    if (rowsExpected == null) return null
    const per = BYTES.base + TOGGLES.reduce((a, t) => a + (want[t.key] ? BYTES[t.key] : 0), 0)
    return rowsExpected * per
  }, [rowsExpected, want])

  const nothingChosen = !Object.values(want).some(Boolean)
  // A measured nought. Offering Download on it is the button-that-does-nothing
  // case, so it is refused with the reason on screen rather than after a click.
  const nothingToExport = rowsExpected === 0
  const estSize = size(estBytes)

  // Focus the panel so Esc — which the shell owns — reaches it from the off.
  useEffect(() => {
    const el = document.getElementById('rx-export')
    el?.focus?.()
  }, [])

  const run = async () => {
    if (nothingChosen) return
    setBusy(true)
    try {
      const out = await fetchExport({
        ...want,
        column: ctx.column,
        limit: 5000,
        // Both formats are read as a table, so both take the newline-safe mode.
        newlines: 'space',
      })
      const rows = out?.rows || []
      if (!rows.length) {
        toast.error('Nothing to export — no leads match that selection yet.')
        return
      }
      const base = `reactivation-${tab}-${stamp()}`
      if (fmt === 'csv') {
        const csv = Papa.unparse({ fields: orderFields(rows), data: rows })
        // The BOM is what makes Excel read Arabic names and the dirham sign
        // correctly instead of rendering them as mojibake.
        downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${base}.csv`)
      } else {
        await buildPdf(rows, ctx.title, `${base}.pdf`)
      }
      toast.success(`${num(rows.length)} ${rows.length === 1 ? 'row' : 'rows'} downloaded`)
      onClose()
    } catch (e) {
      toast.error(e.message || 'That export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="scrim" onClick={busy ? undefined : onClose} />
      <div className="exp" id="rx-export" role="dialog" aria-modal="true" aria-label="Export" tabIndex={-1}>
        <div className="exp-head">
          <h2>Export</h2>
          <p>{ctx.title}</p>
        </div>

        <div className="exp-body">
          {TOGGLES.map((t) => (
            <label className="opt" key={t.key}>
              <input
                type="checkbox" checked={!!want[t.key]}
                onChange={(e) => setWant((w) => ({ ...w, [t.key]: e.target.checked }))}
              />
              <span>
                <span className="t">{t.label}</span>
                <span className="d">{t.hint}</span>
              </span>
            </label>
          ))}

          <div style={{ marginTop: 14 }}>
            <span className="eyebrow" style={{ margin: 0 }}>Format</span>
            <div className="fmt">
              <button aria-pressed={fmt === 'csv'} onClick={() => setFmt('csv')}>CSV</button>
              <button
                disabled
                title="A real .xlsx needs a spreadsheet library this app does not ship. CSV opens in Excel — take that."
                style={{ opacity: 0.45, cursor: 'not-allowed' }}
              >
                Excel
              </button>
              <button aria-pressed={fmt === 'pdf'} onClick={() => setFmt('pdf')}>PDF</button>
            </div>
          </div>

          <p className="exp-note">
            {rowsExpected == null
              ? 'Row count is still loading — the file will carry everyone this selection covers.'
              : nothingToExport
                ? 'Nobody is in that selection yet, so there is nothing to download.'
                : <>About {num(rowsExpected)} {rowsExpected === 1 ? 'row' : 'rows'}
                    {estSize && <> · roughly {estSize}</>}
                    {want.transcripts && <>, most of it transcripts</>}.</>}
            {ctx.note && !nothingToExport && <> {ctx.note}</>}
            {fmt === 'pdf' && !nothingToExport && <> PDF is one block per lead and is best for a short list.</>}
            {nothingChosen && <><br /><span style={{ color: 'var(--warn)' }}>Pick at least one thing to include.</span></>}
          </p>
        </div>

        <div className="exp-foot">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn go" onClick={run}
            disabled={busy || nothingChosen || nothingToExport}
            title={nothingToExport ? 'Nobody is in that selection yet' : undefined}
          >
            {busy ? 'Building…' : 'Download'}
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * A real PDF, from jsPDF — the same library the rest of the app already loads
 * for its report download, imported dynamically so it is not in the first
 * paint of a dashboard most people open to read numbers.
 */
async function buildPdf(rows, title, filename) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 40
  const W = doc.internal.pageSize.getWidth() - M * 2
  const H = doc.internal.pageSize.getHeight()
  let y = M

  const line = (text, { size = 9, bold = false, colour = [40, 40, 40], gap = 13 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...colour)
    for (const part of doc.splitTextToSize(String(text), W)) {
      if (y > H - M) { doc.addPage(); y = M }
      doc.text(part, M, y)
      y += gap
    }
  }

  line('Reactivation — the old database, called again', { size: 14, bold: true, gap: 18 })
  line(`${title} · ${num(rows.length)} ${rows.length === 1 ? 'lead' : 'leads'} · ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} Dubai`,
    { size: 9, colour: [120, 120, 120], gap: 20 })

  rows.forEach((r, i) => {
    if (y > H - M - 40) { doc.addPage(); y = M }
    line(`${i + 1}. ${r.name ?? '—'}`, { size: 11, bold: true, gap: 15 })
    const meta = [
      r.phone, r.email, r.source,
      r.column && `stage: ${r.column}`,
      r.attempts != null && `${r.attempts} attempt${r.attempts === 1 ? '' : 's'}`,
      r.last_outcome && `last: ${r.last_outcome}`,
      r.last_call_at,
      r.not_called_because && `not called — ${r.not_called_because}`,
    ].filter(Boolean).join(' · ')
    if (meta) line(meta, { size: 8.5, colour: [110, 110, 110] })

    const qual = [
      r.industry && `industry ${r.industry}`,
      r.lead_volume && `volume ${r.lead_volume}`,
      r.who_follows_up && `follow-up ${r.who_follows_up}`,
      r.budget && `budget ${r.budget}`,
      r.decision_maker != null && `decision maker ${r.decision_maker}`,
      r.main_problem && `problem ${r.main_problem}`,
    ].filter(Boolean).join(' · ')
    if (qual) line(qual, { size: 8.5, colour: [90, 90, 90] })

    if (r.summary) line(r.summary, { size: 9 })
    if (r.recording_call_id) line(`recording: ${r.recording_call_id} — play it in the dashboard, links expire`, { size: 8, colour: [130, 130, 130] })
    if (r.transcript) line(r.transcript, { size: 8, colour: [70, 70, 70], gap: 11 })
    y += 8
  })

  doc.save(filename)
}
