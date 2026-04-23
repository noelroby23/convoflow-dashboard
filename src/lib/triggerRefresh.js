import { supabase } from './supabase'

export async function triggerRefresh(target = 'all') {
  const { data, error } = await supabase.functions.invoke('trigger-refresh', {
    body: { target }
  })

  if (error) {
    let parsedBody = null
    try {
      parsedBody = error.context?.response ? await error.context.response.json() : null
    } catch {
      // ignore body parse failures
    }

    return {
      ok: false,
      status: error.context?.status ?? 500,
      data: parsedBody ?? { error: error.message }
    }
  }

  return { ok: true, status: 200, data }
}
