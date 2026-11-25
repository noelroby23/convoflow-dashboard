// ConvoFlow Command Center -- runtime configuration (deployed build).
//
// mode is 'live' with NO snapshot file shipped alongside it, deliberately.
// cf-snapshot.json is a real read of production: customer names, phone numbers
// and whole call transcripts. It is fine on a laptop for the test suite and it
// must never sit on a public URL. Without it the page has exactly one source --
// the database, read as a signed-in user.
//
// The publishable key is public by design (it is already in this repo's
// vercel.json). It grants nothing on its own: every cf_* RPC is granted to
// `authenticated` and revoked for `anon` and PUBLIC by migrations 513 and 515,
// so an unauthenticated caller gets 42501. Verified over HTTP, not assumed.
window.CF_CONFIG = {
  url: 'https://lddzzuuovuqzqyujlbrb.supabase.co',
  publishableKey: 'sb_publishable_D8lfDUGwYVmv18QSCrjrAA_1KxFg-30',
  mode: 'live',
  region: 'uae',
  timezone: 'Asia/Dubai',
};
