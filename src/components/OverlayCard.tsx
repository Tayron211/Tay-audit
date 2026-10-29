import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { scrollElementIntoView } from '../utils/autoScroll';

interface OverlayCardProps {
  isExpanded: boolean;
  /** Alto fijo de la tarjeta colapsada (igual para todas => grilla simétrica). */
  collapsedHeight: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Tarjeta de tamaño fijo en la grilla. Al desplegarse crece con una transición
 * suave y se superpone a las vecinas (position: absolute + z-index) sin empujarlas.
 */
export const OverlayCard: React.FC<OverlayCardProps> = ({
  isExpanded,
  collapsedHeight,
  className = '',
  children
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(collapsedHeight);
  const [raised, setRaised] = useState(false);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    setContentHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setContentHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mantiene la tarjeta por encima mientras dura la animación de cierre y auto-scrolea al desplegar
  useEffect(() => {
    if (isExpanded) {
      setRaised(true);
      const measured = measureRef.current
        ? Math.max(measureRef.current.scrollHeight, measureRef.current.offsetHeight)
        : contentHeight;
      scrollElementIntoView(cardRef.current, {
        targetHeight: Math.max(contentHeight, measured, collapsedHeight),
        delay: 50
      });
      return;
    }
    const t = setTimeout(() => setRaised(false), 450);
    return () => clearTimeout(t);
  }, [isExpanded, contentHeight, collapsedHeight]);

  return (
    <div ref={cardRef} style={{ position: 'relative', height: `${collapsedHeight}px`, zIndex: raised ? 40 : 1 }}>
      <div
        className={`acrylic-card ${className}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${isExpanded ? Math.max(contentHeight, collapsedHeight) : collapsedHeight}px`,
          overflow: 'hidden',
          minWidth: 0,
          borderRadius: '12px',
          border: `1px solid ${isExpanded ? 'var(--accent-primary)' : 'var(--border-acrylic)'}`,
          transition: 'height 0.42s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease',
          boxShadow: isExpanded ? '0 22px 48px -8px rgba(15, 23, 42, 0.45)' : '0 4px 12px rgba(0,0,0,0.1)',
          backgroundColor: 'var(--bg-canvas)',
          backgroundImage: 'linear-gradient(var(--bg-canvas-subtle), var(--bg-canvas-subtle))',
          backdropFilter: 'none',
          transform: 'none'
        }}
      >
        <div ref={measureRef} data-auto-scroll-measure="true" style={{ display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '28px',
            background: 'linear-gradient(to bottom, transparent, var(--bg-canvas-subtle))',
            opacity: isExpanded ? 0 : 1,
            transition: 'opacity 0.25s ease',
            pointerEvents: 'none'
          }}
        />
      </div>
    </div>
  );
};
