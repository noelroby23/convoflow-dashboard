import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Loader2, AlertCircle, Download } from 'lucide-react'
import { getRecordingUrl } from '../../hooks/useCfDesk'

/**
 * Plays one VAPI call recording.
 *
 * The URL is fetched ON CLICK, not when the drawer opens. A lead can have 43
 * calls; minting a presigned URL for each one on open would be 43 VAPI round
 * trips for audio nobody asked to hear, and each URL would start expiring
 * immediately.
 *
 * The signature lasts 30 minutes. If someone leaves the drawer open over lunch
 * and then presses play, the media element fails with a bare MEDIA_ERR — which
 * looks exactly like a corrupt recording. So an error after a successful fetch
 * re-mints once before giving up.
 */

const mmss = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function RecordingPlayer({ callId, secs, hasRecording }) {
  const audioRef = useRef(null)
  const [url, setUrl] = useState(null)
  const [state, setState] = useState('idle')   // idle | loading | ready | error
  const [err, setErr] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  // Fall back to the duration cf.call recorded, so the scrubber has a scale
  // before the browser has read the file's own metadata.
  const [dur, setDur] = useState(Number(secs) || 0)
  const retried = useRef(false)

  useEffect(() => {
    // A different call is being shown — drop everything, including a URL that
    // would otherwise play the previous call's audio under a new heading.
    setUrl(null); setState('idle'); setErr(null)
    setPlaying(false); setPos(0); setDur(Number(secs) || 0)
    retried.current = false
  }, [callId, secs])

  const fetchUrl = async () => {
    setState('loading'); setErr(null)
    try {
      const r = await getRecordingUrl(callId)
      setUrl(r.url)
      setState('ready')
      return r.url
    } catch (e) {
      setErr(e)
      setState('error')
      return null
    }
  }

  const toggle = async () => {
    if (playing) { audioRef.current?.pause(); setPlaying(false); return }
    let src = url
    if (!src) src = await fetchUrl()
    if (!src) return
    // The <audio> element may not have picked the src up yet on the first
    // click, so wait a tick before asking it to play.
    setTimeout(() => { audioRef.current?.play().catch(() => {}) }, 0)
    setPlaying(true)
  }

  const onMediaError = async () => {
    setPlaying(false)
    if (retried.current || !url) {
      setState('error')
      setErr(new Error('The recording would not play'))
      return
    }
    // Most likely the 30-minute signature ran out while the drawer sat open.
    retried.current = true
    const fresh = await fetchUrl()
    if (fresh) setTimeout(() => { audioRef.current?.play().catch(() => {}); setPlaying(true) }, 0)
  }

  if (!hasRecording) {
    return <p className="text-xs text-[#9CA3AF]">No recording was made for this call.</p>
  }

  if (state === 'error') {
    // "Expired" is not a fault and must not be dressed as one — VAPI keeps
    // audio 14 days by plan, and the transcript below is permanent.
    const expired = err?.reason === 'expired'
    return (
      <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
        expired ? 'border-[#E9E9E7] bg-[#FAFAF9] text-[#6D6B63]'
                : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">
            {expired
              ? `Audio expired${err.ageDays != null ? ` — this call is ${err.ageDays} days old` : ''}`
              : err?.message || 'Could not load the recording'}
          </p>
          {expired
            ? <p className="mt-0.5">VAPI keeps recordings for 14 days. The transcript below is kept for ever.</p>
            : <button onClick={fetchUrl} className="mt-1 underline">Try again</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#E9E9E7] bg-white px-3 py-2">
      <button
        onClick={toggle}
        disabled={state === 'loading'}
        aria-label={playing ? 'Pause recording' : 'Play recording'}
        className="w-8 h-8 shrink-0 rounded-full bg-[#EC4899] hover:bg-[#DB2777] disabled:opacity-60
                   grid place-items-center transition-colors"
      >
        {state === 'loading'
          ? <Loader2 size={14} className="text-white animate-spin" />
          : playing ? <Pause size={14} className="text-white" />
                    : <Play size={14} className="text-white ml-0.5" />}
      </button>

      <input
        type="range"
        min={0}
        max={dur || 100}
        value={pos}
        disabled={!url}
        onChange={(e) => {
          const t = Number(e.target.value)
          if (audioRef.current) audioRef.current.currentTime = t
          setPos(t)
        }}
        className="flex-1 h-1.5 accent-[#EC4899] cursor-pointer disabled:cursor-default"
      />

      <span className="text-[11px] tabular-nums text-[#6D6B63] shrink-0">
        {mmss(pos)} / {mmss(dur)}
      </span>

      {url && (
        <a href={url} download target="_blank" rel="noreferrer" title="Download this recording"
           className="text-[#9CA3AF] hover:text-[#6D6B63] shrink-0">
          <Download size={13} />
        </a>
      )}

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="none"
          onTimeUpdate={() => setPos(audioRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => {
            const d = audioRef.current?.duration
            if (Number.isFinite(d) && d > 0) setDur(d)
          }}
          onEnded={() => { setPlaying(false); setPos(0) }}
          onError={onMediaError}
        />
      )}
    </div>
  )
}
