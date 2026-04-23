import { formatReport, metricStatus } from './buildReport'

// ─── Home / Overview ────────────────────────────────────────────────────────
export function homeReport(funnel, pipeline) {
  const leads = funnel?.total_leads ?? 0
  const meetings = funnel?.meetings_booked ?? 0
  const showed = funnel?.showed_up ?? 0
  const active = funnel?.active_opportunities ?? 0
  const closed = funnel?.closed_won ?? 0
  const spend = funnel?.total_spend ?? 0
  const revenue = funnel?.closed_revenue ?? 0
  const cpl = funnel?.cost_per_lead ?? (leads > 0 ? +(spend / leads).toFixed(1) : 0)
  const showRate = funnel?.show_rate ?? (meetings > 0 ? +((showed / meetings) * 100).toFixed(1) : 0)
  const meetingRate = funnel?.meeting_rate ?? (leads > 0 ? +((meetings / leads) * 100).toFixed(1) : 0)
  const roas = funnel?.roas ?? (spend > 0 ? +(revenue / spend).toFixed(1) : 0)
  const pipelineValue = funnel?.pipeline_value ?? 0

  const recommendations = []
  if (cpl > 85) recommendations.push(`CPL is AED ${cpl} — pause ads with CPL above AED 120 and increase budget on best performers.`)
  if (showRate < 75 && showRate > 0) recommendations.push(`Show rate is ${showRate}% against a 75% target — add WhatsApp reminders 24h and 1h before each meeting.`)
  if (roas < 4 && closed > 0) recommendations.push(`ROAS is ${roas}x against a 4x target — prioritise closing the ${active} active opportunities in the pipeline.`)
  if (active > 0) recommendations.push(`${active} active opportunities worth AED ${pipelineValue.toLocaleString()} — follow up within 24h to keep deals warm.`)
  if (recommendations.length === 0) recommendations.push('Performance is on track. Continue current strategy and monitor CPL daily.')

  return formatReport({
    title: 'Home — Performance Overview',
    summary: `This period you generated ${leads} leads at AED ${cpl} CPL against a target of AED 85. Sarah booked ${meetings} meetings of which ${showed} showed up — a show rate of ${showRate}%. ${active} opportunities are active in the pipeline worth AED ${pipelineValue.toLocaleString()}. ${closed > 0 ? `You closed ${closed} deal${closed > 1 ? 's' : ''} generating AED ${revenue.toLocaleString()} in revenue and a ROAS of ${roas}x.` : 'No deals have closed yet — focus on progressing active opportunities to improve ROAS.'}`,
    metrics: [
      { label: 'Total Leads', value: leads, target: 100, unit: '', status: metricStatus(leads, 100) },
      { label: 'CPL', value: `AED ${cpl}`, target: 85, prefix: 'AED ', status: metricStatus(cpl, 85, true) },
      { label: 'Meetings Booked', value: meetings, target: 15, status: metricStatus(meetings, 15) },
      { label: 'Show Rate', value: `${showRate}%`, target: 75, status: metricStatus(showRate, 75) },
      { label: 'Meeting Rate', value: `${meetingRate}%`, target: 18, status: metricStatus(meetingRate, 18) },
      { label: 'ROAS', value: `${roas}x`, target: 4, status: metricStatus(roas, 4) },
    ],
    insights: [
      cpl > 85 ? { severity: 'critical', text: `CPL of AED ${cpl} is above the AED 85 target` } : { severity: 'info', text: `CPL of AED ${cpl} is within target` },
      showRate > 0 && showRate < 75 ? { severity: 'warning', text: `Show rate of ${showRate}% is below the 75% target` } : null,
      active > 0 ? { severity: 'info', text: `${active} active opportunities — total pipeline value AED ${pipelineValue.toLocaleString()}` } : null,
      pipeline?.length > 0 ? { severity: 'info', text: `${pipeline.length} leads currently in the active pipeline table` } : null,
    ].filter(Boolean),
    recommendations,
  })
}

// ─── Creative Performance ────────────────────────────────────────────────────
export function creativeReport(ads) {
  if (!ads?.length) return formatReport({ title: 'Creative Performance', summary: 'No ad data available yet.', metrics: [], insights: [], recommendations: [] })
  const active = ads.filter(a => a.status === 'active')
  const sorted = [...ads].filter(a => a.cost_per_lead).sort((a, b) => a.cost_per_lead - b.cost_per_lead)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const highFreq = ads.filter(a => (a.avg_frequency ?? 0) > 1.5)
  const totalSpend = ads.reduce((s, a) => s + (a.total_spend ?? 0), 0)
  const totalLeads = ads.reduce((s, a) => s + (a.total_leads ?? 0), 0)
  const blendedCPL = totalLeads > 0 ? +(totalSpend / totalLeads).toFixed(1) : 0

  const recommendations = []
  if (worst && (worst.cost_per_lead ?? 0) > 120) recommendations.push(`Pause "${worst.ad_name}" — CPL of AED ${+(worst.cost_per_lead).toFixed(0)} is above the AED 120 danger threshold.`)
  if (highFreq.length > 0) recommendations.push(`Refresh creative for: ${highFreq.map(a => a.ad_name).join(', ')} — frequency above 1.5 indicates audience fatigue.`)
  if (best) recommendations.push(`Scale budget on "${best.ad_name}" — best CPL at AED ${+(best.cost_per_lead ?? 0).toFixed(0)}.`)
  if (recommendations.length === 0) recommendations.push('All ads are performing within healthy ranges. Monitor daily for frequency creep.')

  return formatReport({
    title: 'Creative Performance Report',
    summary: `${active.length} of ${ads.length} ads are active. Blended CPL across all ads is AED ${blendedCPL}. Best performer is "${best?.ad_name}" at AED ${+(best?.cost_per_lead ?? 0).toFixed(0)} CPL. ${worst?.ad_name !== best?.ad_name ? `"${worst?.ad_name}" has the highest CPL at AED ${+(worst?.cost_per_lead ?? 0).toFixed(0)}.` : ''} ${highFreq.length > 0 ? `${highFreq.length} ad${highFreq.length > 1 ? 's are' : ' is'} showing frequency above 1.5 — creative refresh recommended.` : 'All ads are within healthy frequency ranges.'}`,
    metrics: [
      { label: 'Active Ads', value: active.length, status: 'info' },
      { label: 'Blended CPL', value: `AED ${blendedCPL}`, status: metricStatus(blendedCPL, 85, true) },
      { label: 'Total Leads', value: totalLeads, status: 'info' },
      { label: 'Total Spend', value: `AED ${totalSpend.toLocaleString()}`, status: 'info' },
      { label: 'Best CPL', value: `AED ${+(best?.cost_per_lead ?? 0).toFixed(0)}`, status: metricStatus(best?.cost_per_lead ?? 0, 85, true) },
      { label: 'High Frequency Ads', value: highFreq.length, status: highFreq.length > 0 ? 'amber' : 'green' },
    ],
    insights: [
      { severity: blendedCPL > 85 ? 'critical' : 'info', text: `Blended CPL is AED ${blendedCPL} vs AED 85 target` },
      highFreq.length > 0 ? { severity: 'warning', text: `${highFreq.map(a => a.ad_name).join(', ')} at risk of creative fatigue (frequency > 1.5)` } : { severity: 'info', text: 'All ads within healthy frequency range (< 1.5)' },
      worst && worst !== best ? { severity: (worst.cost_per_lead ?? 0) > 120 ? 'critical' : 'warning', text: `"${worst.ad_name}" is the lowest performer — CPL AED ${+(worst.cost_per_lead ?? 0).toFixed(0)}` } : null,
    ].filter(Boolean),
    recommendations,
  })
}

// ─── Sarah's Performance ─────────────────────────────────────────────────────
export function sarahReport(kpis, dqReasons) {
  const attempts = kpis?.callsAttempted ?? 0
  const connected = kpis?.callsConnected ?? 0
  const qualRate = kpis?.qualifiedRate ?? 0
  const booked = kpis?.meetingsBooked ?? 0
  const connectRate = attempts > 0 ? +((connected / attempts) * 100).toFixed(0) : 0
  const topDQ = dqReasons?.[0]

  const recommendations = []
  if (qualRate < 20) recommendations.push(`Qualified rate is ${qualRate}% vs 20% target — review Sarah's qualification script, particularly the budget and timing objection handling.`)
  if (booked < 15) recommendations.push(`${booked} meetings booked vs 15 target — increase daily call volume or tighten ICP targeting to improve conversion.`)
  if (topDQ) recommendations.push(`"${topDQ.reason}" is the top DQ reason (${topDQ.count} leads) — adjust ad targeting to attract leads with larger budgets.`)
  if (recommendations.length === 0) recommendations.push('Sarah is hitting targets. Focus on maintaining consistency and reducing no-show rate.')

  return formatReport({
    title: "Sarah's Performance Report",
    summary: `Sarah attempted ${attempts} calls, connecting with ${connected} — a ${connectRate}% connection rate. Of those connected, ${qualRate}% qualified, resulting in ${booked} meetings booked. The top disqualification reason is "${topDQ?.reason ?? 'N/A'}" (${topDQ?.count ?? 0} leads). ${qualRate >= 20 ? 'Qualified rate is on target.' : 'Qualified rate is below the 20% target.'}`,
    metrics: [
      { label: 'Calls Attempted', value: attempts, status: 'info' },
      { label: 'Calls Connected', value: connected, status: 'info' },
      { label: 'Connection Rate', value: `${connectRate}%`, status: 'info' },
      { label: 'Qualified Rate', value: `${qualRate}%`, target: 20, status: metricStatus(qualRate, 20) },
      { label: 'Meetings Booked', value: booked, target: 15, status: metricStatus(booked, 15) },
      { label: 'Top DQ Reason', value: topDQ?.reason ?? '—', status: 'info' },
    ],
    insights: [
      { severity: qualRate >= 20 ? 'info' : 'warning', text: `Qualified rate: ${qualRate}% (target 20%)` },
      { severity: booked >= 15 ? 'info' : 'warning', text: `Meetings booked: ${booked} (target 15)` },
      topDQ ? { severity: 'info', text: `Top DQ reason: "${topDQ.reason}" — ${topDQ.count} leads` } : null,
    ].filter(Boolean),
    recommendations,
  })
}

// ─── Sales Performance ───────────────────────────────────────────────────────
export function salesReport(reps) {
  const totalMeetings = reps?.reduce((s, r) => s + (r.meetings_scheduled ?? 0), 0) ?? 0
  const totalShows = reps?.reduce((s, r) => s + (r.shows ?? 0), 0) ?? 0
  const totalNoShows = reps?.reduce((s, r) => s + (r.no_shows ?? 0), 0) ?? 0
  const totalCloses = reps?.reduce((s, r) => s + (r.closes ?? 0), 0) ?? 0
  const totalRevenue = reps?.reduce((s, r) => s + (r.revenue_closed ?? 0), 0) ?? 0
  const showRate = totalMeetings > 0 ? +((totalShows / totalMeetings) * 100).toFixed(0) : 0

  const recommendations = []
  if (showRate < 75 && totalMeetings > 0) recommendations.push(`Show rate is ${showRate}% vs 75% target — implement WhatsApp confirmation reminders 24h and 1h before meetings.`)
  if (totalNoShows > 3) recommendations.push(`${totalNoShows} no-shows is elevated — review the re-engagement sequence for no-shows to recover bookings.`)
  if (totalCloses < 2) recommendations.push(`${totalCloses} closes vs target of 2 — review the proposal and follow-up process with each rep.`)
  if (recommendations.length === 0) recommendations.push('Team is performing well. Maintain follow-up speed and continue current close sequences.')

  return formatReport({
    title: 'Sales Performance Report',
    summary: `The sales team handled ${totalMeetings} meetings with ${totalShows} shows and ${totalNoShows} no-shows — a ${showRate}% show rate. The team closed ${totalCloses} deal${totalCloses !== 1 ? 's' : ''} generating AED ${totalRevenue.toLocaleString()} in revenue. ${totalNoShows > 3 ? `No-shows are elevated — review pre-meeting confirmation sequences.` : 'No-show volume is manageable.'}`,
    metrics: [
      { label: 'Meetings Scheduled', value: totalMeetings, status: 'info' },
      { label: 'Shows', value: totalShows, status: 'info' },
      { label: 'No-Shows', value: totalNoShows, status: totalNoShows > 3 ? 'red' : 'green' },
      { label: 'Show Rate', value: `${showRate}%`, target: 75, status: metricStatus(showRate, 75) },
      { label: 'Closes', value: totalCloses, target: 2, status: metricStatus(totalCloses, 2) },
      { label: 'Revenue Closed', value: `AED ${totalRevenue.toLocaleString()}`, status: 'info' },
    ],
    insights: [
      { severity: showRate >= 75 ? 'info' : 'warning', text: `Show rate: ${showRate}% (target 75%)` },
      totalNoShows > 3 ? { severity: 'warning', text: `${totalNoShows} no-shows — above healthy threshold of 3` } : null,
      { severity: totalCloses >= 2 ? 'info' : 'warning', text: `${totalCloses} close${totalCloses !== 1 ? 's' : ''} this period (target: 2)` },
    ].filter(Boolean),
    recommendations,
  })
}

// ─── Revenue & ROI ───────────────────────────────────────────────────────────
export function revenueReport() {
  const totalSpend = 9194
  const closedRevenue = 24000
  const activePipelineValue = 45000
  const historicalCloseRate = 0.2
  const projectedRevenue = closedRevenue + (activePipelineValue * historicalCloseRate)
  const roas = +(closedRevenue / totalSpend).toFixed(1)

  const recommendations = []
  if (roas < 4) recommendations.push(`ROAS is ${roas}x vs the 4x target — closing the AED ${activePipelineValue.toLocaleString()} active pipeline at 20% would bring projected ROAS above target.`)
  recommendations.push('Scale spend on the highest-ROAS ad creative to improve overall return.')
  recommendations.push('Review the 3–6 week lag between ad click and close — tighten the sales cycle to accelerate revenue recognition.')

  return formatReport({
    title: 'Revenue & ROI Report',
    summary: `You spent AED ${totalSpend.toLocaleString()} and closed AED ${closedRevenue.toLocaleString()} in revenue — a ROAS of ${roas}x. ${roas >= 4 ? 'ROAS is on target.' : 'ROAS is below the 4x target.'} AED ${activePipelineValue.toLocaleString()} in deals are actively being worked. Projected revenue including pipeline at a 20% close rate is AED ${Math.round(projectedRevenue).toLocaleString()}.`,
    metrics: [
      { label: 'Total Spend', value: `AED ${totalSpend.toLocaleString()}`, status: 'info' },
      { label: 'Closed Revenue', value: `AED ${closedRevenue.toLocaleString()}`, status: 'info' },
      { label: 'ROAS', value: `${roas}x`, target: 4, status: metricStatus(roas, 4) },
      { label: 'Active Pipeline', value: `AED ${activePipelineValue.toLocaleString()}`, status: 'info' },
      { label: 'Projected Revenue', value: `AED ${Math.round(projectedRevenue).toLocaleString()}`, status: 'info' },
      { label: 'Historical Close Rate', value: '20%', status: 'info' },
    ],
    insights: [
      { severity: roas >= 4 ? 'info' : 'warning', text: `ROAS ${roas}x (target 4x) — ${roas >= 4 ? 'on target' : `gap of ${(4 - roas).toFixed(1)}x`}` },
      { severity: 'info', text: `AED ${activePipelineValue.toLocaleString()} in active pipeline — estimated AED ${Math.round(activePipelineValue * historicalCloseRate).toLocaleString()} at 20% close rate` },
    ],
    recommendations,
  })
}

// ─── Week-over-Week / Trends ─────────────────────────────────────────────────
export function trendsReport(chartData, ads) {
  const filtered = (chartData ?? []).filter(d => d.cpl > 0)
  const avgCPL = filtered.length ? +(filtered.reduce((s, d) => s + d.cpl, 0) / filtered.length).toFixed(1) : 0
  const totalLeads = (chartData ?? []).reduce((s, d) => s + d.leads, 0)
  const totalSpend = (chartData ?? []).reduce((s, d) => s + d.spend, 0)
  const avgFreq = chartData?.length ? +((chartData ?? []).reduce((s, d) => s + d.frequency, 0) / chartData.length).toFixed(2) : 0
  const cplTrend = chartData?.length >= 2 ? +(chartData[chartData.length - 1].cpl - chartData[0].cpl).toFixed(1) : 0
  const highFreqAds = (ads ?? []).filter(a => (a.avg_frequency ?? 0) > 1.5)

  const recommendations = []
  if (avgCPL > 85) recommendations.push(`Average CPL of AED ${avgCPL} is above target — identify and pause ad sets driving the highest cost leads.`)
  if (cplTrend > 0) recommendations.push(`CPL is trending upward (+AED ${cplTrend}) — monitor daily and consider refreshing creatives.`)
  if (avgFreq > 2.0) recommendations.push(`Average frequency of ${avgFreq} is above 2.0 — upload new creative assets to combat audience fatigue.`)
  if (highFreqAds.length > 0) recommendations.push(`Rotate creatives for: ${highFreqAds.map(a => a.ad_name).join(', ')}.`)
  if (recommendations.length === 0) recommendations.push('Trends are positive. Maintain spend levels and watch for frequency creep above 1.5.')

  return formatReport({
    title: 'Week-over-Week Trends Report',
    summary: `Over this period you generated ${totalLeads} leads on AED ${totalSpend.toLocaleString()} in spend. Average daily CPL is AED ${avgCPL} vs the AED 85 target — ${avgCPL <= 85 ? 'within target.' : 'above target.'} CPL is ${cplTrend > 0 ? `trending up (+AED ${cplTrend}).` : cplTrend < 0 ? `trending down (AED ${cplTrend}) — positive direction.` : 'holding steady.'} Average audience frequency is ${avgFreq} — ${avgFreq > 2.0 ? 'above 2.0, creative fatigue risk is high.' : avgFreq > 1.5 ? 'approaching 1.5, monitor closely.' : 'within healthy range.'}`,
    metrics: [
      { label: 'Total Leads', value: totalLeads, status: 'info' },
      { label: 'Total Spend', value: `AED ${totalSpend.toLocaleString()}`, status: 'info' },
      { label: 'Avg Daily CPL', value: `AED ${avgCPL}`, status: metricStatus(avgCPL, 85, true) },
      { label: 'CPL Trend', value: cplTrend > 0 ? `↑ +AED ${cplTrend}` : cplTrend < 0 ? `↓ AED ${cplTrend}` : 'Stable', status: cplTrend > 0 ? 'red' : cplTrend < 0 ? 'green' : 'info' },
      { label: 'Avg Frequency', value: avgFreq, status: avgFreq > 2.0 ? 'red' : avgFreq > 1.5 ? 'amber' : 'green' },
      { label: 'High Freq Ads', value: highFreqAds.length, status: highFreqAds.length > 0 ? 'amber' : 'green' },
    ],
    insights: [
      { severity: avgCPL <= 85 ? 'info' : 'critical', text: `Avg CPL AED ${avgCPL} vs AED 85 target` },
      cplTrend > 5 ? { severity: 'warning', text: `CPL trending up +AED ${cplTrend} over the period` } : null,
      avgFreq > 2.0 ? { severity: 'critical', text: `Avg frequency ${avgFreq} — audience fatigue risk is HIGH` } : avgFreq > 1.5 ? { severity: 'warning', text: `Avg frequency ${avgFreq} — approaching fatigue threshold` } : null,
    ].filter(Boolean),
    recommendations,
  })
}

// ─── Health / Target Progress ────────────────────────────────────────────────
export function healthReport(data, healthScore, healthStatus) {
  const TARGETS = { total_leads: 100, meetings_booked: 15, showed_up: 12, closed_won: 2, revenue: 96000 }
  const leads = data?.total_leads ?? 0
  const meetings = data?.meetings_booked ?? 0
  const showed = data?.showed_up ?? 0
  const closed = data?.closed_won ?? 0
  const revenue = data?.closed_revenue ?? 0

  const recommendations = []
  if (leads < TARGETS.total_leads) recommendations.push(`Leads at ${leads} vs ${TARGETS.total_leads} target — increase ad spend or launch new creatives to drive more volume.`)
  if (meetings < TARGETS.meetings_booked) recommendations.push(`Meetings at ${meetings} vs ${TARGETS.meetings_booked} target — review Sarah's call volume and conversion rate.`)
  if (showed < TARGETS.showed_up) recommendations.push(`Show-ups at ${showed} vs ${TARGETS.showed_up} target — strengthen pre-meeting WhatsApp reminders.`)
  if (closed < TARGETS.closed_won) recommendations.push(`${closed} closed vs ${TARGETS.closed_won} target — prioritise the active pipeline and accelerate the sales cycle.`)
  if (recommendations.length === 0) recommendations.push('All metrics are on track. Maintain current pacing to hit month-end targets.')

  return formatReport({
    title: 'Target Progress Report',
    summary: `Overall health score is ${healthScore}% — ${healthStatus?.label ?? 'N/A'} status. Leads: ${leads}/${TARGETS.total_leads}, Meetings: ${meetings}/${TARGETS.meetings_booked}, Show-ups: ${showed}/${TARGETS.showed_up}, Closed: ${closed}/${TARGETS.closed_won}, Revenue: AED ${revenue.toLocaleString()}/AED ${TARGETS.revenue.toLocaleString()}. ${healthScore >= 80 ? 'Campaign is performing well across all key metrics.' : healthScore >= 60 ? 'Performance is moderate — focus on the metrics in yellow to avoid red.' : 'Performance is below target on multiple metrics — immediate action required.'}`,
    metrics: [
      { label: 'Health Score', value: `${healthScore}%`, status: healthScore >= 80 ? 'green' : healthScore >= 60 ? 'amber' : 'red' },
      { label: 'Leads', value: leads, target: TARGETS.total_leads, status: metricStatus(leads, TARGETS.total_leads) },
      { label: 'Meetings Booked', value: meetings, target: TARGETS.meetings_booked, status: metricStatus(meetings, TARGETS.meetings_booked) },
      { label: 'Showed Up', value: showed, target: TARGETS.showed_up, status: metricStatus(showed, TARGETS.showed_up) },
      { label: 'Closed Won', value: closed, target: TARGETS.closed_won, status: metricStatus(closed, TARGETS.closed_won) },
      { label: 'Revenue', value: `AED ${revenue.toLocaleString()}`, target: TARGETS.revenue, status: metricStatus(revenue, TARGETS.revenue) },
    ],
    insights: [
      { severity: healthScore >= 80 ? 'info' : healthScore >= 60 ? 'warning' : 'critical', text: `Health score: ${healthScore}% (${healthStatus?.label ?? 'N/A'})` },
      leads < TARGETS.total_leads * 0.6 ? { severity: 'critical', text: `Leads at ${Math.round((leads / TARGETS.total_leads) * 100)}% of target` } : null,
      closed < TARGETS.closed_won ? { severity: 'warning', text: `No closed deals yet — pipeline needs to convert` } : null,
    ].filter(Boolean),
    recommendations,
  })
}

// ─── Lead Tracker ────────────────────────────────────────────────────────────
export function leadsReport(contacts) {
  const total = contacts?.length ?? 0
  const active = contacts?.filter(c => ['active', 'proposal_sent', 'follow_up_meeting', 'meeting_booked'].includes(c.current_stage)).length ?? 0
  const closed = contacts?.filter(c => c.current_stage === 'closed_won').length ?? 0
  const dq = contacts?.filter(c => c.current_stage === 'disqualified').length ?? 0
  const hot = contacts?.filter(c => (c.lead_quality_score ?? 0) >= 7).length ?? 0
  const dqRate = total > 0 ? +((dq / total) * 100).toFixed(0) : 0

  const recommendations = []
  if (hot > 0) recommendations.push(`${hot} hot lead${hot > 1 ? 's' : ''} (quality score ≥7) — follow up within 4 hours to maximise conversion.`)
  if (dqRate > 30) recommendations.push(`DQ rate is high at ${dqRate}% — review ad targeting to attract better-fit leads and reduce wasted Sarah's time.`)
  if (active > 0) recommendations.push(`${active} leads are active in the pipeline — ensure each has a next-step scheduled within 24h.`)
  if (recommendations.length === 0) recommendations.push('Lead pipeline is healthy. Maintain follow-up cadence and review quality scores weekly.')

  return formatReport({
    title: 'Lead Tracker Report',
    summary: `${total} total leads in the system. ${active} are active in the pipeline, ${closed} have closed, and ${dq} were disqualified (${dqRate}% DQ rate). ${hot} lead${hot !== 1 ? 's' : ''} ha${hot !== 1 ? 've' : 's'} a quality score of 7 or above — highest priority for follow-up. ${dqRate > 30 ? `Disqualification rate of ${dqRate}% is high — review lead source quality.` : 'Disqualification rate is within normal range.'}`,
    metrics: [
      { label: 'Total Leads', value: total, status: 'info' },
      { label: 'Active in Pipeline', value: active, status: 'info' },
      { label: 'Closed Won', value: closed, status: closed > 0 ? 'green' : 'amber' },
      { label: 'Disqualified', value: dq, status: 'info' },
      { label: 'DQ Rate', value: `${dqRate}%`, status: dqRate > 30 ? 'red' : dqRate > 20 ? 'amber' : 'green' },
      { label: 'Hot Leads (≥7)', value: hot, status: hot > 0 ? 'green' : 'info' },
    ],
    insights: [
      hot > 0 ? { severity: 'info', text: `${hot} hot lead${hot !== 1 ? 's' : ''} need urgent follow-up` } : null,
      dqRate > 30 ? { severity: 'warning', text: `DQ rate of ${dqRate}% is high — review targeting` } : null,
      active > 0 ? { severity: 'info', text: `${active} active opportunities in the pipeline` } : null,
    ].filter(Boolean),
    recommendations,
  })
}
