
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
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical UI Error Captured:", error, errorInfo);

    // Auto-Recovery for Deployment Sync Issues (Vite Chunk Failures)
    const isChunkError = error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('error loading dynamically imported module') ||
      error.message.includes('Importing a stopped module');

    if (isChunkError) {
      console.warn("Detected dynamic module handshake failure. Initiating automated node sync...");
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();

      // Prevent reload loops (only reload if last reload was > 5s ago)
      if (!lastReload || now - parseInt(lastReload) > 5000) {
        sessionStorage.setItem('last_chunk_reload', now.toString());
        window.location.reload();
      }
    }
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
          <h1 className="text-2xl font-bold mb-2">Portal Temporarily Unavailable</h1>
          <p className="mb-8 text-muted-foreground max-w-sm mx-auto">
            An unexpected error occurred in your current session.
          </p>
          {this.state.error && (
            <div className="mb-8 p-4 bg-red-500/5 border border-red-500/10 rounded-xl max-w-lg mx-auto text-left overflow-auto custom-scrollbar">
              <p className="text-red-400 font-mono text-[10px] uppercase font-black mb-2 tracking-widest">Instructional Exception</p>
              <p className="text-white/60 font-mono text-[11px] leading-relaxed">{this.state.error.message}</p>
            </div>
          )}
          <button
            onClick={() => {
              window.location.hash = '#/';
              window.location.reload();
            }}
            className="px-8 py-3 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            Synchronize Node
          </button>
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
