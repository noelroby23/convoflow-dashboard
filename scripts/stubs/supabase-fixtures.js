
import { readFileSync, existsSync } from 'node:fs'
const DIR = "/Users/ina/Desktop/convoflow-dashboard/scripts/fixtures/pages"
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
