
import * as real from "/Users/ina/Desktop/convoflow-dashboard/src/hooks/useCfDesk.js"
import { supabase } from "/Users/ina/Desktop/convoflow-dashboard/scripts/stubs/supabase-fixtures.js"
import { pending } from "/Users/ina/Desktop/convoflow-dashboard/scripts/stubs/useSupabaseQuery-cached.js"
export * from "/Users/ina/Desktop/convoflow-dashboard/src/hooks/useCfDesk.js"
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
