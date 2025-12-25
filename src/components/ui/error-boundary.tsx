'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { clientLog } from '@/lib/client-logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    clientLog.error('ErrorBoundary caught an error', { message: error.message, componentStack: errorInfo.componentStack });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-danger-100 p-2">
              <AlertTriangle className="h-6 w-6 text-danger-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-danger-900">
                Something went wrong
              </h3>
              <p className="mt-1 text-sm text-danger-700">
                An error occurred while rendering this component.
              </p>
              {this.state.error && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-danger-600 hover:text-danger-700">
                    Show error details
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-danger-100 p-3 text-xs text-danger-800">
                    {this.state.error.message}
                    {this.state.error.stack && (
                      <>
                        {'\n\n'}
                        {this.state.error.stack}
                      </>
                    )}
                  </pre>
                </details>
              )}
              <div className="mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={this.handleReset}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface SuspenseErrorBoundaryProps extends ErrorBoundaryProps {
  loadingFallback?: ReactNode;
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}
