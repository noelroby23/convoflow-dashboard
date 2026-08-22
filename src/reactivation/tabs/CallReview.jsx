import { useEffect, useState, useSyncExternalStore } from 'react'
import { useCampaign, fetchCall } from '../useCampaign'
import { Feed, Empty, SectionHead } from '../bits'
import { num, pct, dur } from '../format'
import { CallRecording, CallTranscript } from '../../components/ui/CallRecording'

/**
 * Call review — the QA engine.
 *
 * 🔑 THE SCORECARD SHOWS ITS DENOMINATOR, ALWAYS. A rule at 100% on 3 calls
 * with 11 that did not apply is a different claim from 100% on 14, and hiding
 * that is how a scorecard starts lying. It is also the whole reason `passed` is
 * nullable in `cf.call_score`: most calls contain no objection, so scoring "did
 * not apply" as a failure would put the objection tile at 27% and somebody
 * would spend a week rewriting a prompt that is working perfectly. The rate is
 * over the calls where the moment actually arrived; the not-applicable count
 * sits next to it so nobody has to guess.
 *
 * ⚠️ APPLY NEVER WRITES LIVE. There is no staging RPC yet, so an edit staged
 * here lives in this browser tab and nothing else — the card says so, and the
 * Setup tab's publish button reads the same store. That is deliberately visible
 * rather than a button that looks live and does nothing (CLAUDE.md §7 item 96 —
 * an agent, or a person, cannot tell a failed action from a successful one when
 * the failure is silent).
 */

/* ── the staging area ────────────────────────────────────────────────────────
 * A module store rather than component state, because the edit is staged here
 * and published on Setup, and the two tabs never exist at the same time. It is
 * NOT a cache of anything the database knows — no figure is derived here, only
 * a list of what a human clicked this session.
 * ────────────────────────────────────────────────────────────────────────── */

let stagedEdits = []
const listeners = new Set()
const emit = () => listeners.forEach((f) => f())

export const pendingEdits = {
  subscribe(f) { listeners.add(f); return () => listeners.delete(f) },
  read() { return stagedEdits },
  stage(e) {
    if (stagedEdits.some((s) => s.rule === e.rule)) return
    stagedEdits = [...stagedEdits, { ...e, at: Date.now() }]
    emit()
  },
  unstage(rule) {
    stagedEdits = stagedEdits.filter((s) => s.rule !== rule)
    emit()
  },
}

export function usePendingEdits() {
  return useSyncExternalStore(pendingEdits.subscribe, pendingEdits.read, pendingEdits.read)
}

/* ── scorecard ───────────────────────────────────────────────────────────── */

/** A display threshold only — it colours a tile, it does not decide anything.
 *  A rule nobody has scored gets no verdict at all rather than a red one. */
const tileClass = (p) => (p == null ? 'sc' : p >= 75 ? 'sc ok' : 'sc bad')

function Scorecard({ s }) {
  const rules = s.rules || []
  if (!rules.length) {
    return (
      <Empty title="No call has been scored yet">
        Every conversation is read and scored against four rules. The tiles fill in
        once the scorer has read its first call.
      </Empty>
    )
  }
  return (
    <div className="scorebar">
      {rules.map((r) => (
        <div key={r.rule} className={tileClass(r.pct)}>
          <div className="k">{r.label}</div>
          <div className="v" style={r.pct == null ? { color: 'var(--dim)' } : undefined}>{pct(r.pct)}</div>
          <div className="n">
            {r.scored > 0
              ? <>{num(r.passed)} of {num(r.scored)} calls where it applied</>
              : <>never applied on a scored call</>}
            {r.not_applicable > 0 && (
              <span style={{ color: 'var(--dim)' }}> · {num(r.not_applicable)} didn't apply</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── the player behind "hear all N calls" ────────────────────────────────── */

function CallPlayer({ calls, onClose }) {
  const [i, setI] = useState(0)
  const [state, setState] = useState({ loading: true, error: null, call: null })
  const id = calls[i]

  useEffect(() => {
    let alive = true
    setState({ loading: true, error: null, call: null })
    fetchCall(id)
      .then((call) => { if (alive) setState({ loading: false, error: null, call }) })
      .catch((error) => { if (alive) setState({ loading: false, error, call: null }) })
    return () => { alive = false }
  }, [id])

  const { loading, error, call } = state

  return (
    <div className="quote" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="sp" style={{ margin: 0 }}>
          Call {num(i + 1)} of {num(calls.length)}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
          <button className="btn" disabled={i >= calls.length - 1} onClick={() => setI(i + 1)}>Next</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>

      {loading && <div className="rx-loading">loading the call…</div>}
      {error && <div className="rx-error">Could not load this call. {error.message}</div>}

      {!loading && !error && call?.found === false && (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          This call is not in the campaign's own records — the reviewer read it from
          earlier traffic, and only campaign calls can be played back here.
          <div className="mono" style={{ color: 'var(--dim)', fontSize: 11, marginTop: 6 }}>{id}</div>
        </div>
      )}

      {!loading && !error && call?.found && (
        <>
          <div style={{ marginBottom: 8 }}>
            <b style={{ color: 'var(--text)' }}>{call.name || 'Unnamed'}</b>
            <span className="mono" style={{ color: 'var(--dim)', fontSize: 11 }}>
              {' '}· {call.phone || '—'} · {call.at_label || '—'}
              {call.duration_sec != null ? ` · ${dur(call.duration_sec)}` : ''}
            </span>
          </div>
          <CallRecording callId={call.vapi_call_id} hasRecording={call.has_recording} />
          {call.summary && (
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '10px 0 0' }}>{call.summary}</p>
          )}
          {call.transcript
            ? <div style={{ marginTop: 10 }}><CallTranscript text={call.transcript} /></div>
            : <p style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 10 }}>No transcript stored for this call.</p>}
        </>
      )}
    </div>
  )
}

/* ── one finding ─────────────────────────────────────────────────────────── */

/** Severity is a colour, not a measurement — it bands the failure rate the
 *  database already computed so the eye sorts the cards. */
const sev = (p) => (p == null ? 'sev3' : p >= 50 ? 'sev1' : p >= 20 ? 'sev2' : 'sev3')
const sevWord = (p) => (p == null ? 'Rate unknown' : p >= 50 ? 'Most calls' : p >= 20 ? 'Often' : 'Occasional')

function Finding({ f, staged, onStage, onUnstage, onDismiss }) {
  const [playing, setPlaying] = useState(false)
  const calls = (f.calls || []).filter(Boolean)
  const examples = f.examples || []

  return (
    <div className={`finding ${sev(f.pct_failing)}`}>
      <div className="f-head">
        <h3>{f.label || f.rule}</h3>
        <span className="sev">{sevWord(f.pct_failing)}</span>
      </div>

      <div className="f-body">
        <p className="f-stat">
          <b>{num(f.failures)} calls</b> out of the <b>{num(f.of_applicable)}</b> where this
          moment actually came up{f.pct_failing != null ? <> — <b>{pct(f.pct_failing)}</b> of them</> : null}.
        </p>

        {examples.length ? examples.map((x, i) => (
          <div className="quote" key={i}>
            <span className="sp">
              {x.call ? `call ${String(x.call).slice(0, 8)}` : 'from a scored call'}
            </span>
            {x.evidence ? <em>“{x.evidence}”</em> : <span style={{ color: 'var(--dim)' }}>No line quoted.</span>}
            {x.note && <span className="lead-said">{x.note}</span>}
          </div>
        )) : (
          <div className="quote">
            <span className="sp">No quote saved</span>
            <span style={{ color: 'var(--dim)' }}>
              The scorer marked this rule failed without keeping the line, so there is
              nothing to read back here.
            </span>
          </div>
        )}

        {f.guidance && (
          <div className="fix">
            <div className="lbl">Prompt edit</div>
            <code>{f.guidance}</code>
          </div>
        )}

        {staged && (
          <p style={{ color: 'var(--good)', fontSize: 12.5, marginTop: 12 }}>
            <b>Staged.</b> Nothing has changed in Sarah's prompt — publishing happens on
            the Setup tab. This is held in this browser tab only and is lost on refresh,
            because the versioning that would store it is not built yet.
          </p>
        )}

        {playing && calls.length > 0 && (
          <CallPlayer calls={calls} onClose={() => setPlaying(false)} />
        )}
      </div>

      <div className="f-actions">
        {staged ? (
          <button className="btn" onClick={() => onUnstage(f.rule)}>Un-stage this edit</button>
        ) : (
          <button
            className="btn go"
            disabled={!f.guidance}
            title={f.guidance
              ? 'Stages the edit for this session. Publishing happens on Setup.'
              : 'No prompt edit written for this finding yet.'}
            onClick={() => onStage(f)}
          >
            Apply to prompt
          </button>
        )}

        <button
          className="btn"
          disabled={!calls.length}
          title={calls.length ? undefined : 'No call ids saved against this finding.'}
          onClick={() => setPlaying((v) => !v)}
        >
          {playing ? 'Hide the calls' : `Hear ${calls.length ? `all ${num(calls.length)}` : 'the'} calls`}
        </button>

        <button
          className="btn"
          title="Hides this card for the rest of this session. Nothing is saved — it is back on refresh."
          onClick={() => onDismiss(f.rule)}
        >
          Not a problem
        </button>
      </div>
    </div>
  )
}

/* ── the tab ─────────────────────────────────────────────────────────────── */

export default function CallReview() {
  const c = useCampaign()
  const staged = usePendingEdits()
  const [dismissed, setDismissed] = useState([])

  const stagedRules = new Set(staged.map((s) => s.rule))

  return (
    <>
      <Feed feed={c.scores} what="the scorecard">
        {(s) => (
          <>
            <SectionHead
              eyebrow={`Call review · ${num(s.calls_scored)} calls read`}
              title="What Sarah is getting wrong"
              sub="Every conversation is read and scored. These are patterns, not one-offs — each one comes with the prompt change that fixes it."
            />

            {s.awaiting_scoring > 0 && (
              <p className="mono" style={{
                color: 'var(--warn)', fontSize: 11.5, letterSpacing: '.06em',
                margin: '0 0 14px',
              }}>
                {num(s.awaiting_scoring)} calls are still waiting to be read
              </p>
            )}

            <Scorecard s={s} />

            <p style={{ color: 'var(--dim)', fontSize: 12.5, margin: '10px 0 0' }}>
              Each rate is over the calls where that moment actually came up. Calls where
              it did not apply are counted separately and kept out of both halves — a
              rule that never came up is unknown, not failed.
            </p>
          </>
        )}
      </Feed>

      <section className="sec">
        <Feed
          feed={c.findings}
          what="the findings"
          empty={<Empty title="Nothing to fix yet">
            A finding appears once the same problem shows up across several calls.
          </Empty>}
        >
          {(f) => {
            const findings = (f.findings || []).filter((x) => !dismissed.includes(x.rule))
            const hidden = (f.findings || []).length - findings.length

            if (!(f.findings || []).length) {
              return (
                <Empty title="No recurring problem found">
                  The scorer has read the calls and has not found the same failure twice.
                </Empty>
              )
            }

            return (
              <>
                <p className="eyebrow">Findings</p>
                <h2 className="sec-title" style={{ marginBottom: 4 }}>
                  {num(f.finding_count)} {f.finding_count === 1 ? 'pattern' : 'patterns'} worth fixing
                </h2>
                <p className="sec-sub">
                  Ordered by how often the failure happens. Each card carries the calls
                  behind it, so nothing here has to be taken on trust.
                </p>

                {findings.map((x) => (
                  <Finding
                    key={x.rule}
                    f={x}
                    staged={stagedRules.has(x.rule)}
                    onStage={(fi) => pendingEdits.stage({
                      rule: fi.rule, label: fi.label, guidance: fi.guidance,
                    })}
                    onUnstage={(rule) => pendingEdits.unstage(rule)}
                    onDismiss={(rule) => setDismissed((d) => [...d, rule])}
                  />
                ))}

                {hidden > 0 && (
                  <p style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 14 }}>
                    {num(hidden)} {hidden === 1 ? 'finding is' : 'findings are'} hidden for this
                    session only — nothing was saved, and they are back on refresh.{' '}
                    <button className="btn" style={{ marginLeft: 8 }} onClick={() => setDismissed([])}>
                      Show them again
                    </button>
                  </p>
                )}

                <p style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 24 }}>
                  Applying an edit stages it and nothing more. Sarah's prompt does not change
                  until somebody publishes on the Setup tab — and the versioning that would
                  record who changed what is not built yet, so a staged edit lives in this
                  browser tab only.
                </p>
              </>
            )
          }}
        </Feed>
      </section>
    </>
  )
}
