import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error capturado:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '32px 24px',
          margin: '40px auto',
          maxWidth: '520px',
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '24px',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          color: '#0f172a'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'rgba(244, 63, 94, 0.12)',
            color: '#f43f5e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <AlertTriangle size={24} strokeWidth={2.2} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800 }}>
            Se produjo un problema al renderizar esta sección
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: '#64748b', wordBreak: 'break-word', fontFamily: 'monospace' }}>
            {this.state.error?.message || 'Error inesperado'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              backgroundColor: '#FDBA30',
              color: '#000',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(253, 186, 48, 0.35)'
            }}
          >
            <RotateCcw size={16} strokeWidth={2.4} />
            <span>Recargar Aplicación</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
