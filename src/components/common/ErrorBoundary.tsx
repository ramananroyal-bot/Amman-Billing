import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleWindowError = (event: ErrorEvent) => {
    console.error('Window error event caught:', event.error || event.message);
    this.setState({
      hasError: true,
      error: event.error || new Error(event.message || 'Unknown window error'),
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled rejection caught:', event.reason);
    const err = event.reason instanceof Error
      ? event.reason
      : new Error(typeof event.reason === 'string' ? event.reason : 'Unhandled Promise Rejection');
    this.setState({
      hasError: true,
      error: err,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearDataAndReload = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear local database data and reload? This will delete all locally stored records and reset the application.'
    );
    if (!confirmed) return;

    try {
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('VyaparGST_DB');
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear data:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
              <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-lg">
                !
              </div>
              <div>
                <h1 className="text-base font-bold text-white">Something went wrong</h1>
                <p className="text-xs text-slate-400">An unexpected application error was caught.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-mono space-y-2 max-h-60 overflow-y-auto">
              <div className="text-rose-400 font-semibold break-words">
                {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown error occurred'}
              </div>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
              {this.state.error?.stack && !this.state.errorInfo?.componentStack && (
                <pre className="text-[11px] text-slate-500 whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleClearDataAndReload}
                className="px-4 py-2 text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
              >
                Clear local data and reload
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
