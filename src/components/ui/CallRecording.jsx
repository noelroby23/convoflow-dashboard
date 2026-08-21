import { useMemo, useRef, useState } from 'react'
import { Loader2, Play, Pause } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * The one VAPI call player, and the one VAPI transcript renderer.
 *
 * Both lived inside LeadDetail until the Reactivation queue needed the same
 * two things. They are EXTRACTED rather than copied: CLAUDE.md §7 item 127 is
 * the record of what a second hand-written implementation costs — the SQL was
 * fixed and two n8n mirrors kept sending "900 AM" for a day, because a comment
 * saying "mirrors X" is a claim about the past, not a link.
 *
 * 🔑 THE PLAYER TAKES A CALL ID, NEVER A URL. cf.call.recording_url is VAPI's
 * unsigned R2 object path and returns 400 InvalidArgument in a browser — 267
 * "play" links in this app had never played anything (§7 item 139). Only the
 * cf-recording edge function can mint a presigned URL, and only with the
 * private VAPI key, which cannot ship in a Vite bundle.
 *
 * The class names are the `cf-ld__*` ones from index.css. They are global, not
 * nested under .cf-ld, so they style correctly wherever this is mounted — which
 * is why this needed no stylesheet change.
 */

/** Plays a call. The URL is minted on demand — VAPI's presigned links expire
 *  in 30 minutes, so one fetched at page load would be dead by the time
 *  anybody pressed play. */
export function CallRecording({ callId, hasRecording }) {
  const [state, setState] = useState('idle')   // idle | loading | ready | gone | error
  const [msg, setMsg] = useState('')
  const audioRef = useRef(null)

  if (!hasRecording) return <span className="cf-ld__norec">no recording</span>

  const play = async () => {
    if (state === 'ready') {
      const el = audioRef.current
      if (el) { el.paused ? el.play() : el.pause() }
      return
    }
    setState('loading')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/cf-recording`, {
        method: 'POST',
        headers: {
          apikey: supabase.supabaseKey,
          Authorization: `Bearer ${token ?? supabase.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ call_id: callId }),
      })
      const body = await res.json().catch(() => null)
      if (res.status === 404 || body?.expired) {
        // VAPI keeps audio 14 days. "Gone" and "broken" need different words
        // and different reactions (§7 item 140).
        setState('gone'); setMsg('audio expired — VAPI keeps 14 days'); return
      }
      if (!res.ok || !body?.url) throw new Error(body?.error ?? `HTTP ${res.status}`)
      audioRef.current.src = body.url
      await audioRef.current.play()
      setState('ready')
    } catch (e) {
      setState('error'); setMsg(e.message || 'could not load the audio')
    }
  }

  return (
    <span className="cf-ld__rec">
      <button type="button" onClick={play} disabled={state === 'loading' || state === 'gone'}
              className="cf-ld__play">
        {state === 'loading' ? <Loader2 size={11} className="animate-spin" />
          : state === 'ready' ? <Pause size={11} /> : <Play size={11} />}
        {state === 'gone' ? 'expired' : state === 'error' ? 'failed' : 'play'}
      </button>
      {(state === 'gone' || state === 'error') && <span className="cf-ld__recnote">{msg}</span>}
      <audio ref={audioRef} preload="none" controls={state === 'ready'} className="cf-ld__audio" />
    </span>
  )
}

/** A VAPI transcript is "AI:" / "User:" lines. Split it so the lead's words
 *  are visibly theirs, the same as the WhatsApp thread. */
export function CallTranscript({ text }) {
  const lines = useMemo(() => {
    if (!text) return []
    return text.split('\n').filter(Boolean).map(l => {
      const m = l.match(/^\s*(AI|User)\s*:\s*(.*)$/i)
      return m ? { who: m[1].toLowerCase() === 'user' ? 'lead' : 'us', text: m[2] }
               : { who: 'us', text: l }
    })
  }, [text])
  if (!lines.length) return <p className="cf-ld__empty">No transcript.</p>
  return (
    <div className="cf-ld__transcript">
      {lines.map((l, i) => (
        <div key={i} className={`cf-ld__line cf-ld__line--${l.who}`}>
          <span className="cf-ld__who">{l.who === 'lead' ? 'them' : 'Sarah'}</span>
          <span>{l.text}</span>
        </div>
      ))}
    </div>
  )
}
