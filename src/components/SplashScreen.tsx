import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  isLoading: boolean;
  minDisplayTime?: number;
  onFinish?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isLoading,
  minDisplayTime = 1200,
  onFinish
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    // Bloquear todo tipo de scrollbars globalmente en html y body mientras el SplashScreen esté presente
    document.documentElement.classList.add('splash-active');
    document.body.classList.add('splash-active');
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.documentElement.classList.remove('splash-active');
      document.body.classList.remove('splash-active');
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, Math.max(300, minDisplayTime - 500));

      const unmountTimer = setTimeout(() => {
        setIsMounted(false);
        window.scrollTo(0, 0);
        if (onFinish) onFinish();
      }, Math.max(800, minDisplayTime));

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(unmountTimer);
      };
    }
  }, [isLoading, minDisplayTime, onFinish]);

  if (!isMounted) return null;

  return (
    <div
      className={`tay-splash-screen ${isFadingOut ? 'splash-fade-out' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        pointerEvents: isFadingOut ? 'none' : 'auto'
      }}
    >
      {/* Luz ambiental cinematográfica tipo halo (estilo Netflix) */}
      <div
        className="splash-ambient-glow"
        style={{
          position: 'absolute',
          width: '750px',
          height: '750px',
          borderRadius: '50%',
          animation: 'splashCinematicGlow 3s ease-in-out infinite alternate',
          pointerEvents: 'none'
        }}
      />

      {/* Contenedor Central Sobrio, Limpio y Minimalista */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'splashCinematicEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Emblema Institucional UPN */}
        <div
          className="splash-logo-card"
          style={{
            width: '74px',
            height: '74px',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '26px',
            overflow: 'hidden'
          }}
        >
          <img 
            src="/icon.svg" 
            alt="UPN" 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
          />
        </div>

        {/* Tipografía Oficial del Brand (Space Grotesk) */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1
            className="splash-brand-title"
            style={{
              fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', sans-serif",
              fontSize: '2.8rem',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              margin: '0 0 6px 0',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span className="splash-title-tay">TAY</span>
            <span className="splash-title-audit">-AUDIT</span>
          </h1>

          {/* Subtítulo Institucional Sobrio con tracking elegante */}
          <div
            className="splash-sub-upn"
            style={{
              fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', sans-serif",
              fontSize: '0.76rem',
              fontWeight: 700,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              marginTop: '6px'
            }}
          >
            UNIVERSIDAD PRIVADA DEL NORTE
          </div>

          <div
            className="splash-sub-dept"
            style={{
              fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', sans-serif",
              fontSize: '0.66rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginTop: '8px'
            }}
          >
            Operaciones & Asistencia TI
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
