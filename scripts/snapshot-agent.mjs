/**
 * Paint the Agent view to real HTML files and screenshot them.
 *
 * The render harness proves the pages EXECUTE. This proves they LOOK like the
 * design — which is the actual deliverable here, and the one thing neither a
 * build nor a character count can tell you.
 *
 * It renders against the same live fixtures, inlines index.css + agent.css, and
 * writes one file per page to .snapshots/. Screenshot them with:
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless --disable-gpu --window-size=1600,1200 \
 *     --screenshot=out.png --default-background-color=0 file://.../page.html
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(root, '.snapshots')
mkdirSync(out, { recursive: true })

const fix = (n) => JSON.parse(readFileSync(join(here, 'fixtures', `${n}.json`), 'utf8'))
const feed = (data) => ({ data, error: null, loading: false })

const state = {
  overview: feed(fix('cf_campaign_overview')),
  funnel: feed(fix('cf_campaign_funnel')),
  pipeline: feed(fix('cf_campaign_pipeline')),
  ladder: feed(fix('cf_campaign_ladder')),
  pool: feed(fix('cf_campaign_pool')),
  dialler: feed(fix('cf_dialler_status')),
  daily: feed(fix('cf_campaign_daily')),
  events: feed(fix('cf_campaign_events')),
  shifts: feed(fix('cf_shifts')),
  scores: feed(fix('cf_score_summary')),
  findings: feed(fix('cf_score_findings')),
  brief: feed(null),
  refresh: () => {}, refreshAll: () => {},
}
state.derived = derivedFrom(state)


/**
 * `derived` as CampaignProvider computes it. Without this every figure hanging
 * off `dayOf` — the pace line, "due by now", every traffic light — is null, and
 * the snapshot shows a page that is missing half its numbers for a reason that
 * exists only in the harness.
 */
function derivedFrom(state) {
  const ov = state.overview.data
  const pool = state.pool.data
  const pipe = state.pipeline.data
  const started = ov?.started_at ? new Date(ov.started_at) : null
  const dayOf = started ? Math.max(1, Math.floor((Date.now() - started.getTime()) / 86400000) + 1) : null
  const eligible = pool?.eligible ?? null
  const worked = pool?.worked ?? null
  const remaining = pool?.remaining ?? eligible
  const perDay = dayOf && worked ? worked / dayOf : null
  return {
    eligible, worked, remaining, dayOf, perDay,
    daysLeft: perDay && perDay > 0 && remaining != null ? Math.ceil(remaining / perDay) : null,
    dialingNow: ov?.stats?.in_flight ?? 0,
    status: ov?.status ?? null,
    halted: !!ov?.halted_reason,
    isLive: ov?.status === 'running' || ov?.status === 'piloting',
    sarahTotal: pipe?.sarah_total ?? null,
    ronTotal: pipe?.ron_total ?? null,
  }
}

/**
 * SSR NEVER RUNS AN EFFECT, so the two pages that load their own rows —
 * Meetings and the call log — would snapshot for ever as "loading…", which is
 * the one state nobody needs to look at.
 *
 * The harness seeds their initial state instead. It is a build-time transform
 * rather than a prop on the components: a `rows` escape hatch in production
 * code exists to be passed by accident, and then one page on a live dashboard
 * is quietly reading a fixture.
 */
const seed = {
  name: 'seed-page-state',
  transform(code, id) {
    if (id.endsWith('agent/pages/Meetings.jsx')) {
      return code.replace('const [all, setAll] = useState(null)',
        `const [all, setAll] = useState(${JSON.stringify(fix('cf_dash_meetings'))})`)
    }
    if (id.endsWith('agent/pages/Live.jsx')) {
      const rows = JSON.stringify(fix('cf_campaign_members').rows)
      return code
        .replace('const [queue, setQueue] = useState(null)', `const [queue, setQueue] = useState(${rows})`)
        .replace('const [log, setLog] = useState(null)', `const [log, setLog] = useState(${rows})`)
    }
    return null
  },
}

const server = await createServer({
  root, plugins: [seed], server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error',
})

const css = [
  readFileSync(join(root, 'src/reactivation/agent/agent.css'), 'utf8'),
  readFileSync(join(root, 'src/index.css'), 'utf8').replace(/@tailwind[^;]*;/g, ''),
].join('\n')

try {
  const { buildModel } = await server.ssrLoadModule('/src/reactivation/agent/model.js')
  const m = buildModel(state)

  const PAGES = ['Overview', 'Pipeline', 'Meetings', 'Live', 'Leads', 'Handover', 'Deals', 'Performance']
  for (const name of PAGES) {
    const mod = await server.ssrLoadModule(`/src/reactivation/agent/pages/${name}.jsx`)
    const body = renderToStaticMarkup(
      React.createElement(mod.default, { m, c: state, goTo: () => {}, openLead: () => {} }))
    writeFileSync(join(out, `${name}.html`), `<!doctype html><meta charset="utf-8">
<style>${css}
  html,body{margin:0;background:#0F0F1A}
  .cfa{height:auto;min-height:100vh;overflow:visible;display:block}
</style>
<div class="cfa">${body}</div>`)
    console.log(`wrote .snapshots/${name}.html`)
  }
} finally { await server.close() }
