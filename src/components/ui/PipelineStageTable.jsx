import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

const DEFAULT_EXPANDED_PIPELINES = new Set(['mainFlow UAE', 'Post Meeting Sales UAE'])

function isHighValueStage(stageName) {
  const normalized = stageName.toLowerCase()
  return normalized.includes('meeting booked') || normalized.includes('meeting attended')
}

function formatCount(value) {
  return Number(value ?? 0).toLocaleString()
}

function groupPipelineRows(rows) {
  const pipelines = new Map()

  for (const row of rows ?? []) {
    const pipelineId = row.pipeline_id || row.pipeline_name
    const stageId = row.pipeline_stage_id || `${pipelineId}-${row.stage_name}`
    const pipeline = pipelines.get(pipelineId) ?? {
      id: pipelineId,
      name: row.pipeline_name || 'Unknown Pipeline',
      totalOpps: 0,
      stages: new Map(),
    }

    const stage = pipeline.stages.get(stageId) ?? {
      id: stageId,
      pipelineId,
      name: row.stage_name || 'Unknown Stage',
      position: Number(row.stage_position ?? 999),
      oppCount: 0,
      uniqueContactCount: 0,
    }

    const oppCount = Number(row.opp_count ?? 0)
    stage.oppCount += oppCount
    stage.uniqueContactCount += Number(row.unique_contact_count ?? 0)
    pipeline.totalOpps += oppCount
    pipeline.stages.set(stageId, stage)
    pipelines.set(pipelineId, pipeline)
  }

  return [...pipelines.values()]
    .map(pipeline => ({
      ...pipeline,
      stages: [...pipeline.stages.values()].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export default function PipelineStageTable({ rows, loading, error, onStageClick }) {
  const pipelines = useMemo(() => groupPipelineRows(rows), [rows])
  const [expanded, setExpanded] = useState(() => new Set())

  const togglePipeline = (pipelineId) => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(pipelineId)) next.delete(pipelineId)
      else next.add(pipelineId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-4 w-20" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => <div key={index} className="skeleton h-11 w-full rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm mb-6 overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E5E7EB]">
        <h2 className="text-sm font-bold text-[#0F0F1A]">Pipeline Stages</h2>
        <p className="text-xs text-[#6B7280] mt-1">Live CRM pipeline counts by stage</p>
      </div>

      {error ? (
        <p className="text-sm text-[#B91C1C] text-center py-8">Failed to load pipeline stages. Try refreshing.</p>
      ) : !pipelines.length ? (
        <p className="text-sm text-[#9CA3AF] text-center py-8">No pipeline stages found for this date range.</p>
      ) : (
        <div className="divide-y divide-[#E5E7EB]">
          {pipelines.map(pipeline => {
            const isEmpty = Number(pipeline.totalOpps ?? 0) === 0
            const isDefaultExpanded = DEFAULT_EXPANDED_PIPELINES.has(pipeline.name) && !isEmpty
            const isExpanded = isDefaultExpanded || expanded.has(pipeline.id)
            const Icon = isExpanded ? ChevronDown : ChevronRight

            return (
              <section key={pipeline.id} className={isEmpty ? 'bg-[#FCFCFD]' : 'bg-white'}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDefaultExpanded) togglePipeline(pipeline.id)
                  }}
                  className="w-full flex items-center justify-between gap-3 px-4 md:px-6 py-3 text-left hover:bg-[#FAFAFA] transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon size={16} className={isEmpty ? 'text-[#9CA3AF] flex-shrink-0' : 'text-[#6B7280] flex-shrink-0'} />
                    <span className={`truncate text-sm font-semibold ${isEmpty ? 'text-[#9CA3AF]' : 'text-[#0F0F1A]'}`}>{pipeline.name}</span>
                  </div>
                  <span className={`text-xs font-semibold whitespace-nowrap ${isEmpty ? 'text-[#9CA3AF]' : 'text-[#333333]'}`}>
                    {formatCount(pipeline.totalOpps)} opps
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 md:px-6 pb-3">
                    <div className="overflow-hidden rounded-lg border border-[#F3F4F6]">
                      {pipeline.stages.map(stage => {
                        const highlighted = isHighValueStage(stage.name)

                        return (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => onStageClick?.({ pipelineId: pipeline.id, stageId: stage.id })}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-pink-50 ${highlighted ? 'bg-pink-50/50' : 'bg-white'} border-b border-[#F3F4F6] last:border-b-0`}
                          >
                            <span className={`min-w-0 truncate ${highlighted ? 'font-semibold text-[#0F0F1A]' : 'text-[#333333]'}`}>{stage.name}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${highlighted ? 'bg-[#F357A0] text-white' : 'bg-[#F3F4F6] text-[#333333]'}`}>
                              {formatCount(stage.oppCount)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
