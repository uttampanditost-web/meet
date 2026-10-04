import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle cross-origin "Script error." and benign background Vite WebSocket HMR messages gracefully
window.addEventListener('error', (e) => {
  if (
    e.message === 'Script error.' ||
    e.message?.includes('Script error') ||
    e.message?.includes('WebSocket') ||
    e.message?.includes('vite')
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const reasonStr = String(e.reason?.message || e.reason || '');
  if (reasonStr.includes('WebSocket') || reasonStr.includes('vite')) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
  console.warn('Unhandled promise rejection caught:', e.reason);
  e.preventDefault();
}, true);

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;
  declare setState: any;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    console.error("App boundary error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg shadow-2xl">
            <h2 className="text-base font-bold text-rose-400 mb-2">Application Issue Encountered</h2>
            <p className="text-xs text-slate-300 mb-2 font-mono break-words bg-slate-950/60 p-2 rounded border border-slate-800/80">
              {this.state.error?.message || "A temporary runtime error occurred."}
            </p>
            {this.state.error?.stack && (
              <pre className="text-[10px] text-slate-400 text-left bg-slate-950 p-2 rounded mb-4 overflow-auto max-h-36 font-mono whitespace-pre-wrap">
                {this.state.error.stack.split("\n").slice(0, 5).join("\n")}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
