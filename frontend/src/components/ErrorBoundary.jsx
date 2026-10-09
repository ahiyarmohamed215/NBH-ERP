import React from 'react';
import ErrorState from './ErrorState';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Securely log technical rendering error in console for developers
    console.error('ERP Interface Error Caught by Boundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '#view=dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
            }}
          >
            <ErrorState
              type="error"
              title="Something went wrong"
              message="The system encountered an unexpected issue while loading this view. Please try again."
              actionText="Reload Page"
              onRetry={this.handleReload}
              onNavigateHome={this.handleReset}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
