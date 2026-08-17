// Catches the bug that shipped a broken dashboard on 2026-08-16: a helper was
// deleted while its five callers remained, and `vite build` reported success.
//
// Rollup does not error on an unresolved identifier — it assumes a global — so
// the build was green and the page threw ReferenceError on first render. The
// only thing that caught it was a human opening the site.
//
// This checks the SOURCE, not the bundle: every `useXxx(` call site must be
// defined in its own file or imported into it. Cheap, precise, no config.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = []
;(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.jsx?$/.test(p)) files.push(p)
  }
})('src')

// Hooks that come from libraries via named imports are resolved by the import
// scan below, so nothing needs hardcoding here.
let bad = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')

  const defined = new Set([
    ...[...src.matchAll(/(?:export\s+)?function\s+(use[A-Z]\w*)/g)].map(m => m[1]),
    ...[...src.matchAll(/(?:const|let|var)\s+(use[A-Z]\w*)\s*=/g)].map(m => m[1]),
    // anything imported, named or default
    ...[...src.matchAll(/import\s+\{([^}]+)\}/g)]
        .flatMap(m => m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop())),
    ...[...src.matchAll(/import\s+(\w+)\s+from/g)].map(m => m[1]),
  ])

  // Bare calls only: `useFoo(` not preceded by a dot or an identifier char.
  for (const m of src.matchAll(/(^|[^.\w$])(use[A-Z]\w*)\s*\(/g)) {
    const name = m[2]
    if (!defined.has(name)) {
      console.error(`check-source FAILED  ${f}: ${name}() is called but never defined or imported`)
      bad++
    }
  }
}
if (bad) {
  console.error('\nUsually: a function was deleted while its callers remained.')
  console.error('Vite will NOT catch this — it treats the name as a global.\n')
  process.exit(1)
}
console.log(`check-source ok — ${files.length} files, every hook call resolves`)
