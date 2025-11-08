// ✅ Error Boundary Component
// Catches React errors and prevents full app crash
// Shows user-friendly error message with retry option

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console (in production, send to error tracking service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // In production, you might want to log this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom error UI
      return (
        <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 border-4 border-error-default">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-error-background rounded-full flex items-center justify-center">
                <AlertTriangle className="w-12 h-12 text-error-default" strokeWidth={2.5} />
              </div>
            </div>

            {/* Error Title */}
            <h1 className="text-3xl font-bold text-center text-error-text mb-3">
              Oops! Something went wrong
            </h1>

            <p className="text-center text-text-secondary mb-6">
              The application encountered an unexpected error. Don't worry, your data is safe.
            </p>

            {/* Error Details (collapsible) */}
            {this.state.error && (
              <details className="mb-6 bg-background-secondary rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-text-primary mb-2">
                  🔍 Technical Details (for developers)
                </summary>
                <div className="mt-3 space-y-2">
                  <div className="bg-error-background border-l-4 border-error-default p-3 rounded">
                    <p className="font-mono text-xs text-error-text break-all">
                      <strong>Error:</strong> {this.state.error.toString()}
                    </p>
                  </div>
                  {this.state.errorInfo && (
                    <div className="bg-background-tertiary p-3 rounded">
                      <p className="font-mono text-xs text-text-secondary whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-primary/90 transition shadow-lg"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>

              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-background-secondary text-text-primary font-semibold rounded-lg hover:bg-background-tertiary transition border-2 border-border-default"
              >
                <RefreshCw className="w-5 h-5" />
                Reload Page
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-success-background text-success-text font-semibold rounded-lg hover:bg-success-default/20 transition border-2 border-success-default"
              >
                <Home className="w-5 h-5" />
                Go to Dashboard
              </button>
            </div>

            {/* Error Count Warning */}
            {this.state.errorCount > 2 && (
              <div className="mt-6 p-4 bg-warning-background border-l-4 border-warning-default rounded">
                <p className="text-sm text-warning-text">
                  ⚠️ <strong>Multiple errors detected ({this.state.errorCount}).</strong>
                  If this persists, please try clearing your browser cache or contact support.
                </p>
              </div>
            )}

            {/* Support Info */}
            <div className="mt-6 pt-6 border-t border-border-default text-center">
              <p className="text-sm text-text-tertiary">
                Need help? Check the{' '}
                <a
                  href="https://github.com/anthropics/claude-code/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary hover:underline font-semibold"
                >
                  GitHub Issues
                </a>
                {' '}or reload the page.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;
