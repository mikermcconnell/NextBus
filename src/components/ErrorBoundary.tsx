'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="text-red-600">⚠️</div>
            <div>
              <h3 className="font-semibold text-red-800">Something went wrong</h3>
              <p className="text-sm text-red-600 mt-1">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
} 