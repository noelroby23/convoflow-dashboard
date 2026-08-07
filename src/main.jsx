import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/**
 * Root error boundary.
 *
 * Without this, any render-time throw produces a completely white page with
 * nothing in it — no message, no clue, nothing to act on. That is the single
 * worst failure mode for a dashboard, and it is what happened on the first
 * deploy. Show the error instead.
 */
class RootBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // eslint-disable-next-line no-console
    console.error('Dashboard crashed:', error, info)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ minHeight: '100vh', background: '#FAFAFA', padding: '2.5rem',
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', background: '#fff',
                      border: '1px solid #FECDD3', borderRadius: 16, padding: '1.75rem' }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#9F1239' }}>
            The dashboard hit an error
          </h1>
          <p style={{ color: '#6B7280', fontSize: 14, marginTop: 6 }}>
            Showing it rather than a blank page, so it can actually be fixed.
          </p>
          <pre style={{ marginTop: 16, padding: 14, background: '#FFF1F2', borderRadius: 10,
                        fontSize: 12, whiteSpace: 'pre-wrap', color: '#881337' }}>
            {String(error?.stack || error)}
          </pre>
          {info?.componentStack && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 13, cursor: 'pointer', color: '#6B7280' }}>
                Component stack
              </summary>
              <pre style={{ marginTop: 8, padding: 14, background: '#F9FAFB', borderRadius: 10,
                            fontSize: 12, whiteSpace: 'pre-wrap', color: '#374151' }}>
                {info.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.assign('/lead-desk')}
            style={{ marginTop: 18, padding: '8px 14px', borderRadius: 10, border: 0,
                     background: '#EC4899', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
            Go to Lead Desk
          </button>
        </div>
      </div>
    )
  }
}

// Async failures never reach an error boundary, so surface them too.
window.addEventListener('unhandledrejection', (e) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection:', e.reason)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </React.StrictMode>,
)
