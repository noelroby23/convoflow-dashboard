/**
 * Execute the pages migration 315 changed — Week-over-Week, Target Progress, Sarah's
 * Performance, Creative Performance and Lead Lookup (the QA box and the EOD) — WITH
 * DATA, not just in their loading state.
 *
 * render-home.mjs proves a page body runs. That is not enough here: every change is
 * in the branch that draws numbers, and an empty stub never reaches it. So:
 *   · the supabase stub answers each RPC with a fixture captured from the live
 *     database (scripts/fixtures/pages/<rpc>.json);
 *   · the two query hooks are swapped for a cached version, the page is rendered once
 *     to start every query, the queries are awaited, and the page is rendered again.
 * The second render is the one checked: real numbers, drawn by the real components.
 *
 * Run: node scripts/render-pages.mjs
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const FIX = join(here, 'fixtures', 'pages')
const STUBS = join(here, 'stubs')

// ---- stubs, written here so the harness is one file to read
writeFileSync(join(STUBS, 'supabase-fixtures.js'), `
import { readFileSync, existsSync } from 'node:fs'
const DIR = ${JSON.stringify(FIX)}
export const calls = []
export const supabase = {
  rpc: async (name, args) => {
    calls.push(name)
    const f = DIR + '/' + name + '.json'
    if (!existsSync(f)) return { data: null, error: null }
    return { data: JSON.parse(readFileSync(f, 'utf8')), error: null }
  },
  auth: {
    getUser: async () => ({ data: { user: null } }),
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  functions: { invoke: async () => ({ data: null, error: null }) },
  from: () => ({ select: () => ({ data: [], error: null }) }),
}
export default supabase
`)

writeFileSync(join(STUBS, 'useSupabaseQuery-cached.js'), `
const cache = new Map()
export const pending = []
export function useSupabaseQuery(queryFn, deps = []) {
  const key = String(queryFn) + JSON.stringify(deps)
  if (cache.has(key)) return cache.get(key)
  const p = Promise.resolve().then(queryFn).then(
    ({ data, error }) => cache.set(key, { data: error ? null : data ?? null, loading: false, error: error ? String(error.message || error) : null }),
    (e) => cache.set(key, { data: null, loading: false, error: String(e.message || e) }))
  pending.push(p)
  return { data: null, loading: true, error: null }
}
`)

writeFileSync(join(STUBS, 'useCfDesk-cached.js'), `
import * as real from ${JSON.stringify(join(ROOT, 'src/hooks/useCfDesk.js'))}
import { supabase } from ${JSON.stringify(join(STUBS, 'supabase-fixtures.js'))}
import { pending } from ${JSON.stringify(join(STUBS, 'useSupabaseQuery-cached.js'))}
export * from ${JSON.stringify(join(ROOT, 'src/hooks/useCfDesk.js'))}
const cache = new Map()
export function useCfRpc(fn, args) {
  const key = fn + JSON.stringify(args ?? {})
  if (cache.has(key)) return cache.get(key)
  const p = supabase.rpc(fn, args).then(({ data }) => cache.set(key, { data, loading: false, error: null }))
  pending.push(p)
  return { data: null, loading: true, error: null, reload: () => {} }
}
export const useCfQaDigest = (days = 7) => useCfRpc('cf_qa_digest', { p_days: days })
export const useCfEod = (region = 'uae') => useCfRpc('cf_eod_summary', { p: { region } })
void real
`)

const server = await createServer({
  root: ROOT,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
  resolve: {
    alias: [
      { find: /^.*\/lib\/supabase$/, replacement: join(STUBS, 'supabase-fixtures.js') },
      { find: /^\.\/useSupabaseQuery$/, replacement: join(STUBS, 'useSupabaseQuery-cached.js') },
      { find: /^\.\.\/hooks\/useSupabaseQuery$/, replacement: join(STUBS, 'useSupabaseQuery-cached.js') },
      { find: /^\.\.\/hooks\/useCfDesk$/, replacement: join(STUBS, 'useCfDesk-cached.js') },
    ],
  },
})

const fx = (n) => JSON.parse(readFileSync(join(FIX, n + '.json'), 'utf8'))
let bad = 0
const expect = (page, html, needle, why) => {
  if (!html.includes(needle)) { console.error(`✗ ${page}: missing "${needle}" — ${why}`); bad++ }
  else console.log(`  ✓ ${page}: ${why}`)
}
const refuse = (page, html, needle, why) => {
  if (html.includes(needle)) { console.error(`✗ ${page}: still shows "${needle}" — ${why}`); bad++ }
  else console.log(`  ✓ ${page}: ${why}`)
}

try {
  const store = await server.ssrLoadModule('/src/store/dashboard.js')
  store.useDashboard.setState({ dateRange: { preset: 'custom', from: '2026-09-01', to: '2026-09-11' }, homeScope: 'ads' })
  const { MemoryRouter } = await server.ssrLoadModule('react-router-dom')
  const { pending } = await server.ssrLoadModule(join(STUBS, 'useSupabaseQuery-cached.js'))

  const render = async (path) => {
    const Page = (await server.ssrLoadModule(path)).default
    const el = () => React.createElement(MemoryRouter, null, React.createElement(Page))
    renderToStaticMarkup(el())
    while (pending.length) await Promise.all(pending.splice(0))
    renderToStaticMarkup(el())                     // hooks inside hooks start a second round
    while (pending.length) await Promise.all(pending.splice(0))
    return renderToStaticMarkup(el())
  }

  const tr = fx('cf_dash_trends'), k = fx('cf_dash_kpis'), t = fx('cf_targets_map')

  console.log('Week-over-Week')
  let html = await render('/src/pages/Trends.jsx')
  expect('Trends', html, `AED ${Math.round(tr.window.spend).toLocaleString()}`, 'spend is the real figure, not 0')
  expect('Trends', html, Number(tr.window.frequency).toFixed(2), "frequency is Meta's window figure")
  expect('Trends', html, `${tr.window.meta_leads} from Meta ads`, 'leads split Meta / website')
  expect('Trends', html, 'Frequency (Meta)', 'week table labels its frequency')
  refuse('Trends', html, 'No trend data', 'the page drew data')

  console.log('Target Progress')
  html = await render('/src/pages/Health.jsx')
  const days = Number(k.window_days)
  const leadsTarget = Math.max(1, Math.round(Number(t.monthly_leads) * days / 30))
  expect('Health', html, `Monthly targets scaled to the ${days} days selected`, 'targets are scaled to the window')
  expect('Health', html, `>${leadsTarget}<`, `leads target is ${t.monthly_leads} × ${days}/30 = ${leadsTarget}`)
  expect('Health', html, 'Open Pipeline', 'pipeline says it is all open deals')
  refuse('Health', html, 'Active Pipeline', 'the old all-time label is gone')

  console.log("Sarah's Performance")
  html = await render('/src/pages/SarahsPerformance.jsx')
  expect('Sarah', html, `Where each of those ${k.total_leads} people is now`, 'the breakdown counts the same people as Home')
  refuse('Sarah', html, "All non-test leads assigned to Sarah", 'old description gone')

  console.log('Creative Performance')
  html = await render('/src/pages/AdCreatives.jsx')
  const cov = fx('cf_dash_creative').coverage
  expect('Creative', html, `Meta reports ${cov.meta_leads}`, "coverage is measured against Meta's own count")
  refuse('Creative', html, 'carry an ad ID', 'the old coverage line is gone')

  console.log('Lead Lookup (QA box and EOD)')
  html = await render('/src/pages/LeadLookup.jsx')
  const qa = fx('cf_qa_digest')
  expect('LeadLookup', html, `${qa.tickets} calls and chats reviewed in the last 7 days`, 'QA box says what it counted')
  expect('LeadLookup', html, `${qa.open_tickets} findings still open, all time`, 'open findings say all time')
  refuse('LeadLookup', html, 'calls reviewed ·', 'old label gone')
  expect('LeadLookup', html, 'ConvoFlow EOD', 'the EOD renders')
  expect('LeadLookup', html, 'AI CALLS', 'the EOD covers the whole system')
} catch (e) {
  console.error('✗ a page threw:', e.stack || e.message)
  bad++
} finally {
  await server.close()
}
console.log(bad ? `\n${bad} check(s) failed` : '\nall page checks passed')
process.exit(bad ? 1 : 0)
