import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'

const icons = {
  critical: <AlertCircle size={14} />,
  warning: <AlertTriangle size={14} />,
  info: <Info size={14} />,
}

const colors = {
  critical: 'border-red-200 text-red-700',
  warning: 'border-amber-200 text-amber-700',
  info: 'border-blue-200 text-blue-700',
}

const bgColors = {
  critical: 'bg-red-50',
  warning: 'bg-amber-50',
  info: 'bg-blue-50',
}

const flashBg = 'bg-red-500'

export default function InsightsFeed({ insights = [] }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState([])
  const [flashingIdx, setFlashingIdx] = useState(null)
  const flashCount = useRef(0)
  const flashTimer = useRef(null)
  const visible = insights.filter((_, i) => !dismissed.includes(i))

  useEffect(() => () => { if (flashTimer.current) clearInterval(flashTimer.current) }, [])

  if (visible.length === 0) return null

  const startFlash = (i) => {
    if (flashTimer.current) clearInterval(flashTimer.current)
    flashCount.current = 0
    setFlashingIdx(i)
    flashTimer.current = setInterval(() => {
      flashCount.current += 1
      if (flashCount.current >= 6) { // 3 on + 3 off = 6 ticks
        clearInterval(flashTimer.current)
        setFlashingIdx(null)
      } else {
        setFlashingIdx(prev => prev === i ? null : i)
      }
    }, 180)
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {visible.map((insight, i) => {
        const isFlashing = flashingIdx === i
        const severity = insight.severity in colors ? insight.severity : 'info'
        const message = insight.title ?? insight.text ?? 'Insight available'

        return (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors duration-100 ${colors[severity]} ${isFlashing ? `${flashBg} text-white border-red-500` : bgColors[severity]}`}
            onClick={() => {
              startFlash(i)
              if (insight.href) setTimeout(() => navigate(insight.href), 600)
            }}
          >
            {icons[severity]}
            <span>{message}</span>
            <button
              className="ml-1 opacity-60 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); setDismissed([...dismissed, i]) }}
            >
              <X size={11} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
