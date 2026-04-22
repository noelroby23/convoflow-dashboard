import { useState, useRef } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

export default function AudioTranscriptViewer({ recordingUrl, transcript, summary }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-3">
      {summary && (
        <div>
          <p className="text-xs font-semibold text-[#6B7280] mb-1.5">SARAH'S CALL SUMMARY</p>
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 text-sm text-[#333333] leading-relaxed">
            {summary}
          </div>
        </div>
      )}

      {recordingUrl && (
        <div>
          <p className="text-xs font-semibold text-[#6B7280] mb-1.5">CALL RECORDING</p>
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-[#EC4899] flex items-center justify-center flex-shrink-0 hover:bg-[#DB2777] transition-colors"
            >
              {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={progress}
                onChange={e => {
                  if (audioRef.current) audioRef.current.currentTime = Number(e.target.value)
                  setProgress(Number(e.target.value))
                }}
                className="w-full h-1.5 accent-[#EC4899] cursor-pointer"
              />
            </div>
            <span className="text-xs text-[#6B7280] flex-shrink-0">
              {formatTime(progress)} / {formatTime(duration)}
            </span>
            <Volume2 size={14} className="text-[#9CA3AF]" />
            <audio
              ref={audioRef}
              src={recordingUrl}
              onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
              onEnded={() => setPlaying(false)}
            />
          </div>
        </div>
      )}

      {transcript && (
        <div>
          <p className="text-xs font-semibold text-[#6B7280] mb-1.5">TRANSCRIPT</p>
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 text-xs text-[#6B7280] max-h-40 overflow-y-auto leading-relaxed print-expand">
            {transcript}
          </div>
        </div>
      )}

      {!recordingUrl && !transcript && !summary && (
        <p className="text-sm text-[#9CA3AF]">No call data available for this lead yet.</p>
      )}
    </div>
  )
}
