import { useState } from 'react'
import { num, pct } from '../../format'
import { CallRecording, CallTranscript } from '../../../components/ui/CallRecording'
import { fetchCall } from '../../useCampaign'
import { C, Card, Eyebrow, Num, Bar, hexFor, Feed, Empty, ghostBtn } from '../ui'

/**
 * Agent performance — how the calls themselves went, not how many there were.
 *
 * 🔑 "DID NOT APPLY" IS NOT A FAILURE, AND THAT DECISION IS THE WHOLE TILE.
 * Most calls contain no objection and never reach a booking, so scoring those
 * as fails would put the objection tile at 27% and the booking tile at 7% —
 * measuring how many leads objected rather than how well she handled the ones
 * who did, and sending somebody to rewrite a prompt that is working (§7 item
 * 201). `not_applicable` is out of both halves of every rate here.
 *
 * ⚠️ AND THE SCORER IS NOT THE AGENT. It is a separate pass over the transcript
 * with the system's own record of what happened beside it, because an agent
 * cannot tell a broken tool from a working one and neither could a reviewer
 * reading only what was said (§7 item 162 cost four false severity-5 tickets).
 */

export default function Performance({ m, openLead }) {
  return (
    <div style={{ padding: 24, maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Eyebrow size={12} color={C.pink} style={{ letterSpacing: '0.12em', fontWeight: 600 }}>Transcript audit</Eyebrow>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.015em', marginTop: 8 }}>
            How the calls actually went
          </div>
          <div className="mono" style={{ fontSize: 14, color: C.muted, marginTop: 10 }}>
            {num(m.c.scores.data?.calls_scored)} of this campaign&rsquo;s calls scored
            {m.c.scores.data?.awaiting_scoring
              ? ` · ${num(m.c.scores.data.awaiting_scoring)} still in the queue` : ''}
          </div>
        </div>
      </div>

      <Feed feed={m.c.scores} what="the scorecard"
            empty={<Empty>No calls have been scored yet. The scorer runs every ten minutes.</Empty>}>
        {(d) => <Scorecard d={d} />}
      </Feed>

      <Feed feed={m.c.findings} what="the findings"
            empty={<Empty>Nothing is failing often enough to name.</Empty>}>
        {(d) => <Findings d={d} openLead={openLead} />}
      </Feed>
    </div>
  )
}

/* --------------------------------------------------------------- scorecard */

function Scorecard({ d }) {
  const rules = d.rules || []
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
      gap: 1, background: C.track, borderRadius: 16, overflow: 'hidden',
    }}>
      {rules.map((r) => {
        // A rate with nothing under it is grey, never green. `scored` here is
        // the applicable count — n/a calls are already out of it.
        const tone = r.pct == null || !r.scored ? 'na'
          : r.pct >= 90 ? 'good' : r.pct >= 75 ? 'warn' : 'bad'
        return (
          <div key={r.rule} style={{ background: C.surface, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Eyebrow>{r.label}</Eyebrow>
            <Num size={30} color={hexFor(tone)}>{r.pct == null ? '—' : `${r.pct}%`}</Num>
            <Bar value={r.passed} of={r.scored} color={hexFor(tone)} height={5} />
            <div className="mono" style={{ fontSize: 11, color: C.dim }}>
              {r.scored ? `${num(r.passed)} of ${num(r.scored)} where it applied` : 'never came up'}
              {r.not_applicable ? ` · ${num(r.not_applicable)} n/a` : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- findings */

function Findings({ d, openLead }) {
  const [open, setOpen] = useState(null)
  const findings = d.findings || []

  return (
    <Card pad={22}>
      <div style={{ fontSize: 20, fontWeight: 600 }}>What is going wrong, and where</div>
      <div style={{ fontSize: 14, color: C.muted, marginTop: 5, lineHeight: 1.5, textWrap: 'pretty' }}>
        Counted, with the lead&rsquo;s own words underneath. Open one to hear the call it came from.
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {findings.map((f) => {
          const on = open === f.rule
          const tone = f.pct_failing == null ? 'na' : f.pct_failing >= 25 ? 'bad' : f.pct_failing >= 10 ? 'warn' : 'good'
          return (
            <div key={f.rule}>
              <div onClick={() => setOpen(on ? null : f.rule)} className="cfa-outline" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
                border: `1px solid ${C.lineSoft}`, borderRadius: 12, cursor: 'pointer', flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 200, fontSize: 16, fontWeight: 600 }}>{f.label}</div>
                <div style={{ width: 110 }}><Bar value={f.failures} of={f.of_applicable} color={hexFor(tone)} height={8} /></div>
                <div className="mono" style={{ fontSize: 14, width: 170, textAlign: 'right', color: C.text }}>
                  {num(f.failures)} of {num(f.of_applicable)} · {f.pct_failing == null ? '—' : `${f.pct_failing}%`}
                </div>
              </div>

              {on && (
                <div style={{ padding: '12px 4px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {f.guidance && (
                    <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, textWrap: 'pretty' }}>{f.guidance}</div>
                  )}
                  {(f.examples || []).map((e, i) => <Example key={i} e={e} />)}
                  {!f.examples?.length && <div style={{ fontSize: 13, color: C.muted }}>No quoted examples on this one.</div>}
                </div>
              )}
            </div>
          )
        })}
        {findings.length === 0 && (
          <div style={{ fontSize: 14, color: C.muted }}>Nothing is failing often enough to name.</div>
        )}
      </div>
    </Card>
  )
}

function Example({ e }) {
  const [text, setText] = useState(null)
  const [busy, setBusy] = useState(false)

  const read = async () => {
    setBusy(true)
    try { const d = await fetchCall(e.call); setText(d?.transcript || '') }
    catch (err) { setText(`could not load the transcript — ${err.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ padding: '12px 14px', border: `1px solid ${C.lineSoft}`, borderRadius: 12 }}>
      <div style={{
        fontSize: 14, color: C.text, lineHeight: 1.55, textWrap: 'pretty',
        borderLeft: '2px solid rgba(236,72,153,0.45)', paddingLeft: 11,
      }}>{e.evidence}</div>
      {e.note && <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>{e.note}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <CallRecording callId={e.call} hasRecording />
        {text == null && (
          <button onClick={read} disabled={busy} style={{
            background: 'transparent', border: 'none', color: C.pinkLink,
            fontSize: 13, fontWeight: 600, padding: 0, cursor: 'pointer',
          }}>{busy ? 'loading the transcript…' : 'Read the transcript'}</button>
        )}
      </div>

      {text != null && (
        <div style={{
          marginTop: 10, background: C.bg, border: `1px solid ${C.lineSoft}`,
          borderRadius: 12, padding: 14, maxHeight: 260, overflowY: 'auto',
        }}>
          <CallTranscript text={text} />
        </div>
      )}
    </div>
  )
}
