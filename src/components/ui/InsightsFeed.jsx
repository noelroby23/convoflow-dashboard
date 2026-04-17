import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const icons = {
  critical: <AlertCircle size={14} />,
  warning: <AlertTriangle size={14} />,
  info: <Info size={14} />,
}

const colors = {
  critical: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
}

export default function InsightsFeed({ insights = [] }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState([])

  const visible = insights.filter((_, i) => !dismissed.includes(i))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {visible.map((insight, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${colors[insight.severity]}`}
          onClick={() => insight.href && navigate(insight.href)}
        >
          {icons[insight.severity]}
          <span>{insight.title}</span>
          <button
            className="ml-1 opacity-60 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); setDismissed([...dismissed, i]) }}
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  )
}
