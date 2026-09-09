import { num, money, ago } from '../../format'
import { C, Card, Eyebrow, Num, Dot, Bar, hexFor, Feed, Empty } from '../ui'

/**
 * Deals — the far side of the handoff.
 *
 * Sarah's job ends when somebody turns up. Everything on this page is Ron's, and
 * the two columns are the campaign's own contribution to the sales pipeline.
 *
 * ⚠️ THE SOURCE DESIGN'S SEVEN-COLUMN DEAL BOARD IS NOT BUILT, and the reason is
 * data rather than time. Its cards carry a value, a tier, a stage and a next
 * action; `cf_campaign_pipeline` carries none of those, and `cf.deal` — which
 * does — is a MIRROR of GHL's Post Meeting Sales Pipeline that is deliberately
 * NOT campaign-scoped (§5.11a: one lead is one person, and a campaign lead who
 * books has to appear on the Sales Desk like anybody else). Drawing seven
 * columns with em-dashes in every value slot would look like a broken board
 * rather than an honest one, so the page shows what the campaign can answer and
 * says plainly where the rest lives.
 */

export default function Deals({ m, openLead }) {
  const closed = m.plan.byMetric?.['Closed']
  const mrr = m.plan.byMetric?.['MRR added (AED)']

  const cols = m.board.filter((k) => k.owner !== 'sarah')
  const turnedUp = m.countOf('turned_up')

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Feed feed={m.c.pipeline} what="the deals"
            empty={<Empty>Nothing has reached the handoff yet.</Empty>}>
        {() => (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 240, flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.015em' }}>Deals</div>
                <div style={{ fontSize: 14, color: C.muted, marginTop: 5, lineHeight: 1.5, textWrap: 'pretty' }}>
                  A meeting that showed becomes a deal here. Values, stages and lost reasons are
                  kept in GoHighLevel&rsquo;s sales pipeline and mirrored to the Sales Desk — this
                  page counts only what the campaign put into it.
                </div>
              </div>

              <Stat label="Turned up" value={num(turnedUp)} sub="Sarah's finish line" />
              <Stat label="Closed" value={num(closed?.actual)} sub={`of ${num(closed?.target)} planned`}
                    color={hexFor(closed?.tone || 'na')} />
              <Stat label="MRR added" value={money(mrr?.actual)} sub={`of ${money(mrr?.target)} planned`}
                    color={hexFor(mrr?.tone || 'na')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
              {[closed, mrr].filter(Boolean).map((row) => (
                <Card key={row.metric}>
                  <Eyebrow size={12} style={{ fontWeight: 600 }}>{row.metric}</Eyebrow>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                    <Num size={32} color={hexFor(row.tone)}>
                      {row.metric.startsWith('MRR') ? money(row.actual) : num(row.actual)}
                    </Num>
                    <span className="mono" style={{ fontSize: 13, color: C.muted }}>
                      of {row.metric.startsWith('MRR') ? money(row.due) : num(row.due)} due by now
                    </span>
                  </div>
                  <div style={{ marginTop: 12 }}><Bar value={row.actual} of={row.due} color={hexFor(row.tone)} /></div>
                </Card>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {cols.map((col) => (
                <Card key={col.col} style={{ flex: '1 1 300px', minWidth: 280 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dot color={col.colour} size={8} />
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {col.label}
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>{num(col.count)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>{col.hint}</div>

                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9, maxHeight: '48vh', overflowY: 'auto' }}>
                    {(col.cards || []).map((k) => (
                      <div key={k.lead_id} onClick={() => openLead(k.lead_id)} className="cfa-outline"
                           style={{
                             background: C.raised, border: `1px solid ${C.lineSoft}`, borderRadius: 12,
                             padding: '12px 13px', cursor: 'pointer', borderLeft: `3px solid ${col.colour}`,
                           }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {k.company || k.name || 'Unnamed'}
                          </span>
                          {k.age_days != null && (
                            <span className="mono" style={{ fontSize: 11, color: k.age_days > 30 ? C.warn : C.dim }}>{k.age_days}d</span>
                          )}
                        </div>
                        {k.company && <div style={{ fontSize: 12, color: C.soft, marginTop: 3 }}>{k.name}</div>}
                        <div className="mono" style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>
                          {k.last_call_at ? `last spoke ${ago(k.last_call_at)}` : k.phone}
                        </div>
                        {k.said && (
                          <div style={{
                            fontSize: 12, color: C.soft, marginTop: 8, lineHeight: 1.45, textWrap: 'pretty',
                            borderLeft: '2px solid rgba(107,168,245,0.45)', paddingLeft: 9,
                          }}>{k.said}</div>
                        )}
                      </div>
                    ))}
                    {(col.count || 0) === 0 && (
                      <div style={{ fontSize: 13, color: C.muted }}>Nobody here yet.</div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </Feed>
    </div>
  )
}

function Stat({ label, value, sub, color = C.text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Eyebrow>{label}</Eyebrow>
      <span className="mono" style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</span>
      {sub && <span className="mono" style={{ fontSize: 11, color: C.dim }}>{sub}</span>}
    </div>
  )
}
