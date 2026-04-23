import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useDashboard as useDashboardStore } from './store/dashboard'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import AdCreatives from './pages/AdCreatives'
import LeadTracker from './pages/LeadTracker'
import Trends from './pages/Trends'
import Health from './pages/Health'
import Settings from './pages/Settings'
import SarahsPerformance from './pages/SarahsPerformance'
import SalesPerformance from './pages/SalesPerformance'
import Revenue from './pages/Revenue'
import ReportModal from './components/ui/ReportModal'
import { Toaster } from 'sonner'
import { DailyAISummaryProvider } from './context/DailyAISummaryContext'

function ProtectedRoute({ session, children }) {
  if (session === null) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  // Auto-load first available client
  useEffect(() => {
    supabase.from('funnel_summary').select('client_id, client_name').limit(1).single()
      .then(({ data }) => {
        if (data) {
          useDashboardStore.getState().setClient(data.client_id, data.client_name)
        }
      })
  }, [])

  const handleLogout = async () => { await supabase.auth.signOut() }

  // DEV BYPASS — set to true for local dev without auth; keep false in production
  const DEV_MODE = false

  if (!DEV_MODE && session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EC4899] flex items-center justify-center">
            <span className="text-white text-lg font-bold">C</span>
          </div>
          <p className="text-sm text-[#6B7280]">Loading...</p>
        </div>
      </div>
    )
  }

  const protectedSession = DEV_MODE ? true : session

  // Routes. Aliases cover differences between Mark's Layout link paths and
  // backend naming — any unknown path falls back to /overview via catch-all.
  const routes = [
    { path: '/home', component: <Overview /> },
    { path: '/overview', component: <Overview /> },
    { path: '/creative-performance', component: <AdCreatives /> },
    { path: '/creatives', component: <AdCreatives /> },
    { path: '/ad-creatives', component: <AdCreatives /> },
    { path: '/sarahs-performance', component: <SarahsPerformance /> },
    { path: '/sarah', component: <SarahsPerformance /> },
    { path: '/sales-performance', component: <SalesPerformance /> },
    { path: '/sales', component: <SalesPerformance /> },
    { path: '/revenue', component: <Revenue /> },
    { path: '/week-over-week', component: <Trends /> },
    { path: '/trends', component: <Trends /> },
    { path: '/target-progress', component: <Health /> },
    { path: '/health', component: <Health /> },
    { path: '/lead-tracker', component: <LeadTracker /> },
    { path: '/leads', component: <LeadTracker /> },
    { path: '/settings', component: <Settings /> },
  ]

  return (
    <DailyAISummaryProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <ReportModal />
        <Routes>
          <Route path="/login" element={(DEV_MODE || session) ? <Navigate to="/overview" replace /> : <Login />} />
          <Route path="/" element={<Navigate to="/overview" replace />} />
          {routes.map(({ path, component }) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute session={protectedSession}>
                  <Layout onLogout={handleLogout}>{component}</Layout>
                </ProtectedRoute>
              }
            />
          ))}
          {/* Catch-all: prevents blank pages from any sidebar link mismatches */}
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </DailyAISummaryProvider>
  )
}
