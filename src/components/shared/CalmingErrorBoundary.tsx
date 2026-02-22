import React, { Component, ErrorInfo, ReactNode } from 'react';
import { CloudRain, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class CalmingErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NeuroAdaptive OS Boundary Caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CloudRain className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight mb-2">The network is a bit noisy right now.</h1>
            <p className="text-sm text-slate-500 leading-relaxed mb-8">
              A temporary desync occurred in the cognitive processing layer. Take a deep breath, and let's try that again.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" /> Re-establish Connection
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}