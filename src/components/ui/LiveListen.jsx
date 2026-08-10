import { useCallback, useEffect, useRef, useState } from 'react'
import { Headphones, Square, AlertTriangle } from 'lucide-react'

/**
 * Listen to a VAPI call while it is happening.
 *
 * Every call VAPI places returns `monitor.listenUrl` — a wss:// endpoint that
 * streams the live audio of that one call. v2 used to throw it away;
 * migration 030 stores it on cf.call_queue and cf_dash_queue returns it for
 * the row that is dialling right now.
 *
 * The stream is raw PCM, not a container format, so there is nothing an
 * <audio> tag can do with it. We decode frames ourselves and push them into
 * the Web Audio clock.
 *
 * SAMPLE RATE. VAPI does not reliably announce it, and the wrong value is
 * instantly audible — too slow and deep, or too fast and chipmunked. 16 kHz
 * was the first guess and it was wrong: Abdus could not make out the words.
 * 32 kHz is what actually plays back intelligibly, so that is the default.
 *
 * The selector stays, because "whatever plays back correctly" is an empirical
 * question and the next VAPI change could move it. Changing it now takes
 * effect on the NEXT AUDIO FRAME — the rate lives in a ref, not in state, so
 * you can hunt for the right one mid-call instead of stopping and
 * reconnecting each time.
 *
 * SECURITY. The listen URL is a capability — whoever holds it can hear the
 * call. It reaches the browser only through cf_dash_queue, which is granted to
 * `authenticated` alone, and it is never written to cf.call, so it stops
 * existing when the call ends.
 */

const DEFAULT_RATE = 32000
const RATES = [8000, 16000, 22050, 24000, 32000, 44100, 48000]

export default function LiveListen({ listenUrl, name }) {
  const [state, setState] = useState('idle')   // idle | connecting | live | error
  const [error, setError] = useState(null)
  const [rate, setRate] = useState(DEFAULT_RATE)

  const wsRef = useRef(null)
  const ctxRef = useRef(null)
  // Read on every frame, so a change applies immediately without a reconnect.
  const rateRef = useRef(DEFAULT_RATE)
  // Once a human has picked a rate, VAPI's own announcement must not undo it.
  // The announced value is what we started from and it was not intelligible,
  // so the ear in the room outranks the control frame.
  const userPickedRef = useRef(false)
  // When the next chunk should start. Scheduling against this rather than
  // "now" is what stops the audio clicking between frames.
  const playHeadRef = useRef(0)

  const stop = useCallback(() => {
    try { wsRef.current?.close() } catch { /* already gone */ }
    try { ctxRef.current?.close() } catch { /* already gone */ }
    wsRef.current = null
    ctxRef.current = null
    playHeadRef.current = 0
    setState('idle')
  }, [])

  // Never leave a socket or an audio context behind on unmount.
  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    if (!listenUrl) return
    setError(null)
    setState('connecting')

    let ctx
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      setError('This browser has no Web Audio support.')
      setState('error')
      return
    }
    ctxRef.current = ctx

    let ws
    try {
      ws = new WebSocket(listenUrl)
    } catch {
      setError('Could not open the audio stream.')
      setState('error')
      return
    }
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws


    ws.onopen = () => {
      setState('live')
      playHeadRef.current = ctx.currentTime + 0.15   // small jitter buffer
    }

    ws.onmessage = (ev) => {
      // VAPI may send a JSON frame describing the stream before any audio.
      if (typeof ev.data === 'string') {
        try {
          const meta = JSON.parse(ev.data)
          const r = Number(meta.sampleRate ?? meta.sample_rate)
          if (r > 0 && !userPickedRef.current) { rateRef.current = r; setRate(r) }
        } catch { /* not JSON — ignore, it is not audio either */ }
        return
      }

      const pcm = new Int16Array(ev.data)
      if (!pcm.length) return

      const buf = ctx.createBuffer(1, pcm.length, rateRef.current)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768  // s16 -> float

      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)

      // If we fell behind (tab throttled, network stall), jump back to now
      // rather than queueing an ever-growing delay.
      const now = ctx.currentTime
      if (playHeadRef.current < now) playHeadRef.current = now + 0.05
      src.start(playHeadRef.current)
      playHeadRef.current += buf.duration
    }

    ws.onerror = () => {
      setError('The audio stream dropped. The call may have ended.')
      setState('error')
    }
    ws.onclose = () => {
      // A close after a healthy stream just means the call finished.
      setState(s => (s === 'live' ? 'idle' : s))
    }
  }, [listenUrl])

  if (!listenUrl) {
    return <span className="text-xs text-[#9CA3AF]">no live audio</span>
  }

  return (
    <span className="inline-flex items-center gap-2">
      {state === 'live' || state === 'connecting' ? (
        <button
          onClick={stop}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded
                     bg-[#FEE2E2] text-[#B91C1C] hover:bg-[#FECACA]"
        >
          <Square size={12} /> {state === 'connecting' ? 'Connecting…' : 'Stop'}
        </button>
      ) : (
        <button
          onClick={start}
          title={`Listen to the live call with ${name || 'this lead'}`}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded
                     bg-[#E9EFFD] text-[#2E62E0] hover:bg-[#DBE5FC]"
        >
          <Headphones size={12} /> Listen live
        </button>
      )}

      {state === 'live' && (
        <>
          <span className="relative flex h-2 w-2" aria-label="streaming">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16A34A]" />
          </span>
          {/* Applies to the next frame — no reconnect, so you can find the
              right rate while the call is still running. */}
          <select
            value={rate}
            onChange={(e) => {
              const r = Number(e.target.value)
              userPickedRef.current = true
              rateRef.current = r
              setRate(r)
            }}
            title="If the voice sounds too slow and deep, go up. Too fast and squeaky, go down."
            className="text-[10px] text-[#6D6B63] bg-transparent border border-[#E9E9E7]
                       rounded px-1 py-0.5 outline-none cursor-pointer"
          >
            {RATES.map(r => (
              <option key={r} value={r}>{r / 1000}kHz</option>
            ))}
          </select>
        </>
      )}

      {state === 'error' && (
        <span className="inline-flex items-center gap-1 text-xs text-[#B91C1C]">
          <AlertTriangle size={12} /> {error}
        </span>
      )}
    </span>
  )
}
