import { createClient } from '@supabase/supabase-js'

// Which Supabase project this dashboard talks to.
//
// These were read from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. That went
// wrong on 2026-08-07: the cf schema moved to convoflow-v2, the Vercel
// variables were left pointing at the old project, and three consecutive
// production builds compiled the wrong host. Nothing failed — the app
// authenticated fine and read a database that no longer holds the live data.
// Build logs confirmed the builds were fresh, so it was never a cache issue.
//
// Neither value is a secret. Vite inlines them into the browser bundle either
// way, and the publishable key is designed to be public — it can do nothing on
// its own (calling a cf_* RPC unauthenticated returns 42501 permission denied;
// every dashboard RPC is granted to `authenticated` only). Keeping them in a
// dashboard setting bought no security and cost a silent misconfiguration, so
// they live here where a wrong value shows up in review.
//
// To point at a different project, change these two lines.
const SUPABASE_URL = 'https://lddzzuuovuqzqyujlbrb.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_D8lfDUGwYVmv18QSCrjrAA_1KxFg-30'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
