import { useState, useEffect } from 'react'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const hasData = (data) => {
  if (data === null || data === undefined) return false
  if (Array.isArray(data)) return data.length > 0
  if (typeof data === 'object') return Object.keys(data).length > 0
  return true
}

export function useSupabaseQuery(queryFn, deps = [], fallback = null) {
  const [data, setData] = useState(fallback)
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
          setData(fallback)
        } else {
          setData(hasData(data) ? data : fallback)
        }
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
        setData(fallback)
        setLoading(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}
