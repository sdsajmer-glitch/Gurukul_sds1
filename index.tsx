
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOMClient from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { RoleProvider } from './contexts/RoleContext';

// Build-time shim for process.env in browser environments
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical UI Error Captured:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#08090a] text-foreground p-6 text-center">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-white">Portal Temporarily Unavailable</h1>
          <p className="mb-4 text-gray-400 max-w-sm mx-auto">An unexpected error occurred. We've logged the incident and are working on it.</p>

          {this.state.error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/20 rounded-xl max-w-2xl text-left w-full overflow-hidden">
              <p className="text-red-400 text-sm font-mono font-bold mb-2">Error: {this.state.error.message}</p>
              {this.state.error.stack && (
                <pre className="text-xs text-red-400/70 overflow-auto max-h-60 p-2 bg-black/30 rounded border border-red-500/10 whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-white text-black font-bold rounded-xl shadow-lg hover:bg-gray-200 transition-all active:scale-95"
            >
              Reload Page
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/';
              }}
              className="px-6 py-2.5 bg-red-600/20 text-red-500 border border-red-500/50 font-bold rounded-xl hover:bg-red-600/30 transition-all"
            >
              Clear Cache & Reset
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = ReactDOMClient.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <RoleProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </RoleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
