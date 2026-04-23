import { createContext, useContext, useMemo, useState } from 'react'

const DailyAISummaryContext = createContext(null)

export function DailyAISummaryProvider({ children }) {
  const [isEnabled, setIsEnabled] = useState(true)
  const [lastOpenedDate, setLastOpenedDate] = useState(null)
  const [hiddenForDate, setHiddenForDate] = useState(null)

  const value = useMemo(() => ({
    isEnabled,
    setIsEnabled,
    lastOpenedDate,
    setLastOpenedDate,
    hiddenForDate,
    setHiddenForDate,
  }), [hiddenForDate, isEnabled, lastOpenedDate])

  return (
    <DailyAISummaryContext.Provider value={value}>
      {children}
    </DailyAISummaryContext.Provider>
  )
}

export function useDailyAISummary() {
  const context = useContext(DailyAISummaryContext)

  if (!context) {
    throw new Error('useDailyAISummary must be used within DailyAISummaryProvider')
  }

  return context
}
