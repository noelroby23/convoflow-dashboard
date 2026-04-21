import { useEffect } from 'react'
import { Sparkles, X, Copy, Download, CheckCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useDashboard } from '../../store/dashboard'
import { toMarkdown } from '../../lib/reports/buildReport'

const STATUS_COLORS = {
  green:  { dot: 'bg-[#16A34A]', text: 'text-[#16A34A]', bar: '#16A34A' },
  amber:  { dot: 'bg-[#F59E0B]', text: 'text-[#F59E0B]', bar: '#F59E0B' },
  red:    { dot: 'bg-[#DC2626]', text: 'text-[#DC2626]', bar: '#DC2626' },
  info:   { dot: 'bg-[#2563EB]', text: 'text-[#6B7280]', bar: '#2563EB' },
}

const SEVERITY_COLORS = {
  critical: { dot: 'bg-[#DC2626]', label: 'text-[#DC2626]' },
  warning:  { dot: 'bg-[#F59E0B]', label: 'text-[#F59E0B]' },
  info:     { dot: 'bg-[#2563EB]', label: 'text-[#6B7280]' },
}

export default function ReportModal() {
  const { isReportOpen, reportContent, closeReport } = useDashboard()
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!isReportOpen) return
    const onKey = (e) => { if (e.key === 'Escape') closeReport() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isReportOpen, closeReport])

  if (!isReportOpen || !reportContent) return null

  const report = reportContent

  const handleCopy = async () => {
    await navigator.clipboard.writeText(toMarkdown(report))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const card = document.querySelector('.report-modal-card')
      const scrollBody = card?.querySelector('.overflow-y-auto')
      const footer = card?.querySelector('.report-modal-footer')

      // Expand to full height so nothing is clipped
      const savedCard = card.style.cssText
      card.style.maxHeight = 'none'
      card.style.boxShadow = 'none'
      card.style.borderRadius = '0'
      if (scrollBody) { scrollBody.style.maxHeight = 'none'; scrollBody.style.overflow = 'visible' }
      if (footer) footer.style.display = 'none'

      await new Promise(r => setTimeout(r, 100))

      const canvas = await html2canvas(card, { scale: 2, useCORS: true, logging: false })

      // Restore immediately after capture
      card.style.cssText = savedCard
      if (scrollBody) { scrollBody.style.maxHeight = ''; scrollBody.style.overflow = '' }
      if (footer) footer.style.display = ''

      // Scale canvas to fit one A4 page (210×297mm, 8mm margin each side)
      const MARGIN = 8
      const A4_W = 210
      const A4_H = 297
      const availW = A4_W - MARGIN * 2
      const availH = A4_H - MARGIN * 2

      // Canvas px → mm at 96dpi (scale=2 means 2px per CSS px)
      const contentW = (canvas.width / 2) * (25.4 / 96)
      const contentH = (canvas.height / 2) * (25.4 / 96)

      const ratio = Math.min(availW / contentW, availH / contentH)
      const finalW = contentW * ratio
      const finalH = contentH * ratio

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.97), 'JPEG', MARGIN, MARGIN, finalW, finalH)
      pdf.save(`${report.title} — ${report.period}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="report-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 15, 26, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) closeReport() }}
    >
      <div className="report-modal-card bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#EC4899] to-[#DB2777] flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#EC4899]">AI Report</p>
              <h2 className="text-sm font-bold text-[#0F0F1A] leading-tight">{report.title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9CA3AF]">{report.period}</span>
            <button onClick={closeReport} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#333333] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Executive Summary */}
          <div className="rounded-xl bg-gradient-to-br from-pink-50 to-white border border-[#F9A8D4] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#EC4899] mb-2">Executive Summary</p>
            <p className="text-sm text-[#333333] leading-relaxed">{report.summary}</p>
          </div>

          {/* Metrics Grid */}
          {report.metrics.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3">Key Metrics</p>
              <div className="grid grid-cols-2 gap-3">
                {report.metrics.map((m) => {
                  const colors = STATUS_COLORS[m.status] ?? STATUS_COLORS.info
                  return (
                    <div key={m.label} className="bg-[#F9FAFB] rounded-xl p-4 border border-[#E5E7EB]">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-xs text-[#6B7280] font-medium">{m.label}</p>
                        <span className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${colors.dot}`} />
                      </div>
                      <p className={`text-lg font-bold ${colors.text}`}>{m.value}</p>
                      {m.target != null && (
                        <p className="text-xs text-[#9CA3AF] mt-1">Target: {m.prefix ?? ''}{m.target}{m.unit ?? ''}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Insights */}
          {report.insights.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3">Insights</p>
              <div className="space-y-2">
                {report.insights.map((ins, i) => {
                  const colors = SEVERITY_COLORS[ins.severity] ?? SEVERITY_COLORS.info
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                      <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${colors.dot}`} />
                      <p className="text-sm text-[#333333]">{ins.text}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3">Recommendations</p>
              <div className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-pink-50 rounded-lg border border-[#F9A8D4]">
                    <span className="w-5 h-5 rounded-full bg-[#EC4899] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-sm text-[#333333]">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-[#9CA3AF] text-center pb-1">Generated from live dashboard data · {report.period}</p>
        </div>

        {/* Footer */}
        <div className="report-modal-footer flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] flex-shrink-0 bg-[#F9FAFB] rounded-b-2xl">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] hover:bg-white transition-colors"
          >
            {copied ? <CheckCircle size={14} className="text-[#16A34A]" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy as Markdown'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E5E7EB] text-sm text-[#6B7280] hover:bg-white transition-colors disabled:opacity-50"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
            <button
              onClick={closeReport}
              className="px-4 py-2 rounded-lg bg-[#EC4899] text-white text-sm font-medium hover:bg-[#DB2777] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
