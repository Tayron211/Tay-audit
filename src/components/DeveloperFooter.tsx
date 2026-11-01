import React from 'react';
import { Code, ShieldCheck } from 'lucide-react';
import { UpnBrandLogo } from './Navbar';

export const DeveloperFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      className="tay-developer-footer"
      style={{
        width: '100%',
        maxWidth: '1280px',
        margin: '28px auto 8px',
        padding: '0 16px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="acrylic-card tay-signature-card"
        style={{
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid var(--border-acrylic)',
          background: 'var(--bg-acrylic-card)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Línea de Acento Luminiscente Superior */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '15%',
          right: '15%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
          opacity: 0.85
        }} />

        {/* Fila Principal: Logo + Firma del Desarrollador */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px var(--accent-glow)'
          }}>
            <UpnBrandLogo size={16} color="var(--accent-contrast, #000000)" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              fontSize: '0.86rem', 
              fontWeight: 800, 
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em'
            }}>
              TAY-AUDIT <span style={{ color: 'var(--accent-primary)' }}>&</span> STIVIE 24/7
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>•</span>
            <span style={{ 
              fontSize: '0.8rem', 
              fontWeight: 700, 
              color: 'var(--accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Code size={13} />
              Desarrollado por Tayron
            </span>
          </div>
        </div>

        {/* Subtexto Institucional y de Plataforma */}
        <div style={{
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          maxWidth: '680px'
        }}>
          Sistema Integral de Operaciones, Auditoría de Hardware & Asistencia Inteligente TI
        </div>

        {/* Badges de Garantía y Universidad Privada del Norte */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          marginTop: '2px',
          fontSize: '0.66rem',
          color: 'var(--text-muted)'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={12} color="#10b981" />
            Cloud Edge 24/7
          </span>
          <span>•</span>
          <span>Universidad Privada del Norte (UPN)</span>
          <span>•</span>
          <span>© {currentYear} Todos los derechos reservados</span>
        </div>
      </div>
    </footer>
  );
};

export default DeveloperFooter;
