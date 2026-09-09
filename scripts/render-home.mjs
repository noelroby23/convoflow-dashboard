/**
 * Execute the Home page. A green `vite build` is not evidence it runs
 * (CLAUDE.md §7 item 178: rollup treats an unresolved identifier as a global
 * and ships it), and grep on a minified bundle is not evidence either
 * (§7 item 179) — this renders the component and fails on a ReferenceError.
 *
 * Rendered once per scope, because the ads / reactivation / both toggle picks
 * different branches in the page body.
 *
 * Run: node scripts/render-home.mjs
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const STUB = join(here, 'stubs', 'supabase.js')

const server = await createServer({
  root: ROOT,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
  resolve: { alias: [{ find: /^.*\/lib\/supabase$/, replacement: STUB }] },
})

let bad = 0
try {
  const store = await server.ssrLoadModule('/src/store/dashboard.js')
  const scopes = store.HOME_SCOPES
  if (!Array.isArray(scopes) || scopes.length !== 3) { console.error('✗ HOME_SCOPES missing or wrong shape'); bad++ }
  else console.log('✓ HOME_SCOPES:', scopes.map(s => s.id).join(', '))
  if (store.DEFAULT_HOME_SCOPE !== 'ads') { console.error('✗ default scope is not ads'); bad++ }
  else console.log('✓ default scope is ads')

  const { MemoryRouter } = await server.ssrLoadModule('react-router-dom')
  const { DailyAISummaryProvider } = await server.ssrLoadModule('/src/context/DailyAISummaryContext.jsx')
  const Overview = (await server.ssrLoadModule('/src/pages/Overview.jsx')).default

  for (const scope of ['ads', 'reactivation', 'both']) {
    store.useDashboard.setState({ homeScope: scope })
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, null,
        React.createElement(DailyAISummaryProvider, null, React.createElement(Overview)))
    )
    const hasSeg = html.includes('cf-seg')
    const hasLabel = html.toLowerCase().includes(scope === 'both' ? 'both' : scope)
    console.log(`✓ rendered scope=${scope} (${html.length} chars, toggle=${hasSeg}, label=${hasLabel})`)
    if (!hasSeg) { console.error(`✗ scope=${scope}: the toggle did not render`); bad++ }
    if (!hasLabel) { console.error(`✗ scope=${scope}: the eyebrow does not name the scope`); bad++ }
  }
} catch (e) {
  console.error('✗ Home threw:', e.message)
  bad++
} finally {
  await server.close()
}
process.exit(bad ? 1 : 0)
