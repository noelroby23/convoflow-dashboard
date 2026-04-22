import { Component } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-[#E5E7EB] gap-3">
          <AlertCircle size={24} className="text-[#DC2626]" />
          <p className="text-sm font-medium text-[#333333]">Something went wrong loading this section</p>
          <button
            className="flex items-center gap-2 text-xs text-[#EC4899] hover:underline"
            onClick={() => this.setState({ hasError: false })}
          >
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
