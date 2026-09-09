/**
 * Paint the date-range calendar to real HTML and screenshot it.
 *
 * The grid is where "I can't click properly" lived, and neither a build nor a
 * character count can show you a duplicated 30 or a range with no shading.
 * Renders the REAL CalendarMonth against the REAL compiled CSS.
 *
 *   node scripts/snapshot-datepicker.mjs
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
 *     --disable-gpu --window-size=1000,560 --screenshot=out.png \
 *     file://$PWD/.snapshots/datepicker.html
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { CalendarMonth } = await vite.ssrLoadModule('/src/components/DateRangePicker.jsx')

const css = readdirSync(join(root, 'dist/assets')).find(f => f.endsWith('.css'))
const styles = readFileSync(join(root, 'dist/assets', css), 'utf-8')

const startDate = new Date(2026, 7, 30)   // Aug 30 — the "From" in the report
const endDate   = new Date(2026, 8, 9)    // Sep 9  — the "To"

const grid = renderToStaticMarkup(
  React.createElement('div', { className: 'cf-dr__panel', style: { position: 'static', transform: 'none', width: '900px', margin: '24px auto', padding: '24px' } },
    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' } },
      React.createElement(CalendarMonth, { month: new Date(2026, 7, 1), startDate, endDate, onSelectDate: () => {} }),
      React.createElement(CalendarMonth, { month: new Date(2026, 8, 1), startDate, endDate, onSelectDate: () => {} }),
    )))

mkdirSync(join(root, '.snapshots'), { recursive: true })
writeFileSync(join(root, '.snapshots/datepicker.html'),
  `<!doctype html><html><head><meta charset="utf-8"><style>${styles}</style>
   <style>body{background:#0B0B0D;margin:0}</style></head><body>${grid}</body></html>`)
console.log('wrote .snapshots/datepicker.html — Aug 30 → Sep 9')
await vite.close()
