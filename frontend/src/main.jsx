import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Fly My Cart CRM caught an unexpected UI error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0f172a', color: '#f8fafc', padding: '24px' }}>
          <div style={{ background: '#1e293b', padding: '36px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '460px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ color: '#ffffff', margin: '0 0 10px', fontSize: '19px', fontWeight: 700 }}>Something went wrong</h3>
            <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: '0 0 24px', lineHeight: 1.6 }}>
              The application encountered an unexpected display error. You can reload the page or return to login.
            </p>
            {this.state.error?.message && (
              <div style={{ background: '#0f172a', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', textAlign: 'left', marginBottom: '20px', overflowX: 'auto', fontFamily: 'monospace' }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                type="button"
                onClick={() => window.location.reload()}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13.5px' }}
              >
                Reload Page
              </button>
              <button 
                type="button"
                onClick={() => {
                  localStorage.removeItem('fmc_logged_in');
                  localStorage.removeItem('fmc_logged_out');
                  sessionStorage.clear();
                  window.location.href = '/login';
                }}
                style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13.5px' }}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
