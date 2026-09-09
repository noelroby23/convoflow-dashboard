/**
 * Render every Agent-view page against REAL data and assert it paints.
 *
 * 🔑 A GREEN `vite build` IS NOT EVIDENCE THE CODE RUNS. Rollup does not error
 * on an unresolved identifier — it assumes a global and ships it — which is how
 * this dashboard once shipped a `ReferenceError` on every page with a clean
 * build (CLAUDE.md §7 item 178). `check-bundle.mjs` catches the call sites it
 * can see statically; this catches the rest by executing them.
 *
 * The fixtures in scripts/fixtures/ are captured verbatim from the live
 * database, so a page that only looks right against invented data fails here.
 * Recapture them with the psql helper in the main repo when a shape changes.
 *
 * Run: node scripts/render-agent.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const here = dirname(fileURLToPath(import.meta.url))
const fix = (name) => JSON.parse(readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8'))

/** The feed envelope `useCampaign` hands every consumer. */
const feed = (data) => ({ data, error: null, loading: false })

const FEEDS = {
  overview: fix('cf_campaign_overview'),
  funnel: fix('cf_campaign_funnel'),
  pipeline: fix('cf_campaign_pipeline'),
  ladder: fix('cf_campaign_ladder'),
  pool: fix('cf_campaign_pool'),
  dialler: fix('cf_dialler_status'),
  daily: fix('cf_campaign_daily'),
  events: fix('cf_campaign_events'),
  shifts: fix('cf_shifts'),
  scores: fix('cf_score_summary'),
  findings: fix('cf_score_findings'),
  brief: null,
}


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

const server = await createServer({
  root: join(here, '..'),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

let failures = 0
const fail = (what, why) => { failures++; console.error(`  ✗ ${what} — ${why}`) }
const pass = (what, note) => console.log(`  ✓ ${what}${note ? ` — ${note}` : ''}`)

try {
  const { buildModel } = await server.ssrLoadModule('/src/reactivation/agent/model.js')

  /** Three worlds every page has to survive, not just the happy one. */
  const WORLDS = {
    live: Object.fromEntries(Object.entries(FEEDS).map(([k, v]) => [k, feed(v)])),
    loading: Object.fromEntries(Object.keys(FEEDS).map((k) => [k, { data: null, error: null, loading: true }])),
    // The campaign resting in draft: found, but nothing has happened.
    empty: Object.fromEntries(Object.entries(FEEDS).map(([k, v]) => [k,
      feed(v && typeof v === 'object' && !Array.isArray(v) ? { found: false } : null)])),
  }

  const withApi = (state) => ({ ...state, derived: derivedFrom(state), refresh: () => {}, refreshAll: () => {} })

  const PAGES = ['Overview', 'Pipeline', 'Meetings', 'Live', 'Leads', 'Handover', 'Deals', 'Performance']

  for (const [world, state] of Object.entries(WORLDS)) {
    console.log(`\n${world}:`)
    const c = withApi(state)
    let m
    try {
      m = buildModel(c)
    } catch (e) {
      fail(`buildModel (${world})`, e.message)
      continue
    }

    for (const name of PAGES) {
      try {
        const mod = await server.ssrLoadModule(`/src/reactivation/agent/pages/${name}.jsx`)
        const html = renderToStaticMarkup(
          React.createElement(mod.default, { m, c, goTo: () => {}, openLead: () => {} }))
        if (!html || html.length < 40) fail(`${name} (${world})`, `rendered ${html.length} chars`)
        else pass(`${name} (${world})`, `${html.length} chars`)
      } catch (e) {
        fail(`${name} (${world})`, e.message)
      }
    }
  }

  /* The shell itself. Rendered under the real provider: SSR runs no effects, so
     every feed is still loading — which is exactly the state a reader hits on a
     cold load, and the one a page is most likely to get wrong. */
  console.log('\nshell:')
  try {
    const view = await server.ssrLoadModule('/src/reactivation/agent/AgentView.jsx')
    const prov = await server.ssrLoadModule('/src/reactivation/useCampaign.jsx')
    const html = renderToStaticMarkup(
      React.createElement(prov.CampaignProvider, null,
        React.createElement(view.default, { onSwitchView: () => {} })))
    if (!/Convo/.test(html)) fail('AgentView', 'the brand never rendered')
    else if (!/Classic view/.test(html)) fail('AgentView', 'the switch back to the classic view is missing')
    else pass('AgentView under a cold provider', `${html.length} chars`)
  } catch (e) {
    fail('AgentView', e.message)
  }

  /* The live world's numbers must be the database's own, not a plausible
     re-derivation. Checked against the fixture rather than against a literal,
     so recapturing the fixtures keeps these honest. */
  console.log('\nfigures (live):')
  const m = buildModel(withApi(WORLDS.live))
  const row = (metric) => FEEDS.funnel.rows.find((r) => r.metric === metric)
  const eq = (what, got, want) => (String(got) === String(want)
    ? pass(what, `${got}`) : fail(what, `got ${got}, the database says ${want}`))

  eq('Showed actual', m.showed?.actual, row('Showed').actual)
  eq('Booked actual', m.booked?.actual, row('Meetings booked').actual)
  eq('Dialled actual', m.dialled?.actual, row('Leads dialled').actual)
  eq('board columns', m.board.length, FEEDS.pipeline.columns.length)
  eq('board people', m.board.reduce((n, k) => n + k.count, 0),
     FEEDS.pipeline.columns.reduce((n, k) => n + k.count, 0))
  eq('every column has a colour', m.board.filter((k) => !k.colour).length, 0)
  eq('every member has a card', m.allCards.length,
     FEEDS.pipeline.columns.reduce((n, k) => n + (k.cards?.length || 0), 0))
  eq('super hot counter', m.counters[0].count, FEEDS.pipeline.columns.find((k) => k.col === 'super_hot').count)

  // The rule the whole page rests on: an unmeasured rate is null, never 0.
  const noShows = buildModel(withApi({
    ...WORLDS.live,
    funnel: feed({ ...FEEDS.funnel, rows: FEEDS.funnel.rows.map((r) => (r.metric === 'Showed' ? { ...r, actual: 0 } : r)) }),
  }))
  if (noShows.liveShow === 0) pass('zero shows gives a 0% rate, not a null', '0')
  else fail('zero shows', `expected 0, got ${noShows.liveShow}`)

  const noBookings = buildModel(withApi({
    ...WORLDS.live,
    funnel: feed({ ...FEEDS.funnel, rows: FEEDS.funnel.rows.map((r) => (r.metric === 'Meetings booked' ? { ...r, actual: 0 } : r)) }),
  }))
  if (noBookings.liveShow === null) pass('no bookings gives NULL show rate, never 0%')
  else fail('no bookings', `expected null show rate, got ${noBookings.liveShow}`)
} finally {
  await server.close()
}

console.log(failures ? `\n${failures} failure(s)` : '\nall green')
process.exit(failures ? 1 : 0)
