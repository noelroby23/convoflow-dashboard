// A supabase that answers nothing, so a page can be EXECUTED without a session.
// The point is not the data — it is that the component body runs and an
// unresolved identifier throws here instead of in a customer's browser.
export const supabase = {
  rpc: async () => ({ data: null, error: null }),
  auth: {
    getUser: async () => ({ data: { user: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from: () => ({ select: () => ({ data: [], error: null }) }),
}
export default supabase
