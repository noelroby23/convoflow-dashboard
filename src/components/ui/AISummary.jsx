import { Sparkles } from 'lucide-react'

export default function AISummary({ summary, loading = false }) {
  return (
    <div className="mt-6 rounded-xl border border-[#F9A8D4] bg-gradient-to-br from-pink-50 to-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-[#EC4899] flex items-center justify-center">
          <Sparkles size={12} className="text-white" />
        </div>
        <span className="text-xs font-semibold text-[#EC4899] uppercase tracking-wide">AI Summary</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-4/5" />
          <div className="skeleton h-4 w-3/5" />
        </div>
      ) : (
        <p className="text-sm text-[#333333] leading-relaxed">{summary}</p>
      )}
      <p className="text-[10px] text-[#9CA3AF] mt-3">Generated based on your current period data. Updates when new data syncs.</p>
    </div>
  )
}
