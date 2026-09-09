import { useMemo, useState } from 'react'
import { num, ago, fmtWhen } from '../../format'
import { C, Card, Eyebrow, Dot, Pill, ghostBtn, fieldStyle, Feed, Empty } from '../ui'

/**
 * Leads — every person on the campaign, one row each.
 *
 * 📌 It reads the board rather than paging `cf_campaign_members`. The board is
 * already loaded and already holds all 2,029 people with their company, their
 * column and their last call, so a second paged read would be a second answer
 * to "where is this person" — and the two would disagree the moment one of them
 * was refreshed and the other was not.
 *
 * ⚠️ IT RENDERS A CAPPED SLICE, AND SAYS SO. Laying out two thousand rows drops
 * frames on every keystroke; a table that silently shows the first 200 of 2,029
 * is worse than one that says which. Search narrows the whole set, not the page.
 */

const CAP = 200

const COLS = [
  { id: 'name', label: 'Name', w: '1.2fr' },
  { id: 'company', label: 'Company', w: '1.3fr' },
  { id: 'phone', label: 'Number', w: '1.05fr', mono: true },
  { id: 'colLabel', label: 'Where they are', w: '1.1fr' },
  { id: 'attempt', label: 'Attempt', w: '0.6fr', mono: true },
  { id: 'last_call_at', label: 'Last call', w: '0.9fr', mono: true },
  { id: 'next_at', label: 'Next', w: '0.9fr', mono: true },
  { id: 'age_days', label: 'Age', w: '0.6fr', mono: true },
]

const GRID = COLS.map((k) => k.w).join(' ')

export default function Leads({ m, openLead }) {
  const [q, setQ] = useState('')
  const [col, setCol] = useState('all')
  const [sort, setSort] = useState({ key: 'last_call_at', dir: 'desc' })

  const options = useMemo(
    () => [{ id: 'all', label: `Everyone (${num(m.pipe?.members)})` }]
      .concat(m.board.map((k) => ({ id: k.col, label: `${k.label} (${num(k.count)})` }))),
    [m.board, m.pipe])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = m.allCards
    if (col !== 'all') out = out.filter((r) => r.col === col)
    if (needle) {
      out = out.filter((r) => [r.name, r.company, r.phone]
        .some((v) => v && String(v).toLowerCase().includes(needle)))
    }
    const { key, dir } = sort
    const sign = dir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const x = a[key], y = b[key]
      // Nulls always sort last, whichever way the column is pointing —
      // otherwise "sort by last call" leads with everyone never called.
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      if (key === 'last_call_at' || key === 'next_iso') return sign * (new Date(x) - new Date(y))
      if (typeof x === 'number' && typeof y === 'number') return sign * (x - y)
      return sign * String(x).localeCompare(String(y))
    })
  }, [m.allCards, q, col, sort])

  const exportCsv = () => {
    const head = COLS.map((k) => k.label)
    const body = rows.map((r) => COLS.map((k) => (k.id === 'last_call_at' ? (r.last_call_at || '') : (r[k.id] ?? ''))))
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [head.map(esc).join(','), ...body.map((r) => r.map(esc).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `reactivation-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const head = (id) => () => setSort((s) => ({ key: id, dir: s.key === id && s.dir === 'desc' ? 'asc' : 'desc' }))

  return (
    <div style={{ padding: 24 }}>
      <Feed feed={m.c.pipeline} what="the leads"
            empty={<Empty>Nobody is on the campaign yet.</Empty>}>
        {() => (
          <Card pad={22}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 19, fontWeight: 600 }}>Leads</div>
              <span className="mono" style={{ fontSize: 13, color: C.muted }}>
                {num(rows.length)} match{rows.length === 1 ? 'es' : ''}
                {rows.length > CAP ? ` · showing the first ${CAP}` : ''}
              </span>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
                <input className="cfa-field" value={q} onChange={(e) => setQ(e.target.value)}
                       placeholder="Search name, company or number" style={{ ...fieldStyle, width: 250 }} />
                <select className="cfa-field" value={col} onChange={(e) => setCol(e.target.value)} style={fieldStyle}>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <button className="cfa-ghost" style={{ ...ghostBtn, padding: '9px 14px', fontSize: 14 }} onClick={exportCsv}>
                  Export CSV
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, overflowX: 'auto' }}>
              <div style={{ minWidth: 1180 }}>
                <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '0 12px 10px', borderBottom: `1px solid ${C.line}` }}>
                  {COLS.map((k) => (
                    <button key={k.id} onClick={head(k.id)} style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                      fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700,
                      color: sort.key === k.id ? C.pinkSoft : C.dim, whiteSpace: 'nowrap',
                    }}>
                      {k.label}{sort.key === k.id ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '60vh', overflowY: 'auto' }}>
                  {rows.slice(0, CAP).map((r) => (
                    <div key={r.lead_id} onClick={() => openLead(r.lead_id)} className="cfa-row" style={{
                      display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: 12,
                      borderBottom: `1px solid ${C.lineSoft}`, cursor: 'pointer', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.name || 'Unnamed'}
                      </span>
                      <span style={{ fontSize: 13, color: C.soft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.company || '—'}
                      </span>
                      <span className="mono" style={{ fontSize: 13, color: C.muted }}>{r.phone}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <Dot color={m.colBy[r.col]?.colour || C.muted} size={7} />
                        <span style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.colLabel}
                        </span>
                      </span>
                      <span className="mono" style={{ fontSize: 13, color: C.muted }}>{r.attempt == null ? '—' : r.attempt}</span>
                      <span className="mono" style={{ fontSize: 13, color: C.muted }}>{r.last_call_at ? ago(r.last_call_at) : '—'}</span>
                      <span className="mono" style={{ fontSize: 13, color: r.next_at ? C.pinkSoft : C.dim }}>{r.next_at || '—'}</span>
                      <span className="mono" style={{ fontSize: 13, color: C.muted }}>{r.age_days == null ? '—' : `${r.age_days}d`}</span>
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <div style={{ fontSize: 14, color: C.muted, padding: '20px 12px' }}>No leads match these filters.</div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}
      </Feed>
    </div>
  )
}
