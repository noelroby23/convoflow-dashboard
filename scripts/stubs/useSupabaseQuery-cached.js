
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
