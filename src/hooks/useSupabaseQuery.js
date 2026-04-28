import { useState, useEffect } from 'react'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export function useSupabaseQuery(queryFn, deps = [], fallback = null) {
  const [data, setData] = useState(USE_MOCK ? fallback : null)
  const [loading, setLoading] = useState(!USE_MOCK)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (USE_MOCK) return

    let cancelled = false
    setLoading(true)
    setError(null)

    queryFn()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
          setData(null)
        } else {
          setData(data ?? null)
        }
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
        setData(null)
        setLoading(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}
