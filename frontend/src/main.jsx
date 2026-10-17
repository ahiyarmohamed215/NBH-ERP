import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import RealtimeSync from './context/RealtimeSync';
import { ToastProvider } from './context/ToastContext';
import './style.css';
import './components/ErpDesignSystem.css';
import './components/ErpTables.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <RealtimeSync />
          <App />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
