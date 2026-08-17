import { useEffect, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'

/**
 * The app shell.
 *
 * The dark glass theme lives HERE, not on a page, so every route inherits one
 * ground instead of Home being dark next to a light Lead Desk. `data-rail`
 * drives the sidebar width, the header offset and the content margin from a
 * single attribute, so those three can never disagree about how wide the rail
 * currently is.
 */
export default function Layout({ children, onLogout }) {
  const [railOpen, setRailOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem('cf.rail') !== 'closed'
  })

  useEffect(() => {
    window.localStorage.setItem('cf.rail', railOpen ? 'open' : 'closed')
  }, [railOpen])

  return (
    <div className="cf-app" data-rail={railOpen ? 'open' : 'closed'}>
      <div className="no-print"><Sidebar onLogout={onLogout} /></div>

      {/* Deliberately outside the rail: a toggle that lives inside the panel it
          collapses is invisible the moment the panel is narrow. It sits on the
          seam in brand pink so it reads as the one control on the shell. */}
      <button
        type="button"
        onClick={() => setRailOpen(v => !v)}
        className="cf-railtoggle no-print"
        aria-expanded={railOpen}
        aria-label={railOpen ? 'Collapse the menu' : 'Expand the menu'}
        title={railOpen ? 'Collapse the menu' : 'Expand the menu'}
      >
        {railOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </button>

      <div className="no-print"><Header /></div>

      <main className="cf-main print:ml-0 print:mt-0">
        {children}
      </main>
    </div>
  )
}
