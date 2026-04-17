import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout({ children, onLogout }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="no-print"><Sidebar onLogout={onLogout} /></div>
      <div className="no-print"><Header /></div>
      <main className="ml-[220px] mt-16 p-6 min-h-[calc(100vh-64px)] print:ml-0 print:mt-0">
        {children}
      </main>
    </div>
  )
}
