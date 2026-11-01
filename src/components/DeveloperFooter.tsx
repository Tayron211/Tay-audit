import React from 'react';
import { Code } from 'lucide-react';

export const DeveloperFooter: React.FC = () => {
  return (
    <footer 
      className="tay-developer-footer"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 12px 6px',
        marginTop: '16px',
        boxSizing: 'border-box',
        userSelect: 'none'
      }}
    >
      <div 
        className="tay-discreet-signature"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.70rem',
          color: 'var(--text-muted)',
          opacity: 0.72,
          letterSpacing: '0.02em',
          transition: 'all 0.2s ease',
          padding: '4px 10px',
          borderRadius: '20px',
          background: 'rgba(148, 163, 184, 0.05)',
          border: '1px solid var(--border-acrylic)'
        }}
      >
        <Code size={12} style={{ color: 'var(--accent-primary)', opacity: 0.85 }} />
        <span>
          Desarrollado por <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Tayron</strong>
        </span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>Tay-Audit & STIVIE</span>
      </div>
    </footer>
  );
};

export default DeveloperFooter;
