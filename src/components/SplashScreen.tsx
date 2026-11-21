import React, { useEffect } from 'react';

export interface SplashScreenProps {
  isLoading?: boolean;
  minDisplayTime?: number;
  minDuration?: number;
  onFinish?: () => void;
  onFinished?: () => void;
}

/**
 * SplashScreen Controller Institucional (Exact Control Docente steel-pro1)
 * Controla la transición de salida suave del Splash Screen institucional
 * y la aparición cinematográfica instantánea y fluida de la interfaz (sin bloqueos ni retrasos en negro).
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  minDisplayTime,
  minDuration,
  onFinish,
  onFinished
}) => {
  const duration = minDuration ?? minDisplayTime ?? 2200;
  const finishCallback = onFinished || onFinish;

  useEffect(() => {
    // Si estamos en entorno nativo Capacitor (Android APK), desvanecer el splash nativo suavemente
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.SplashScreen) {
        (window as any).Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
      }
    } catch (_) {}

    const splash = document.getElementById('upn-boot-splash');
    const root = document.getElementById('root');

    const makeInterfaceVisible = () => {
      if (root) {
        root.classList.add('app-ready');
      }
      document.documentElement.classList.remove('splash-active');
      document.body.classList.remove('splash-active');
    };

    // Liberar visibilidad de la interfaz de inmediato debajo del splash
    makeInterfaceVisible();

    if (!splash) {
      if (finishCallback) finishCallback();
      return;
    }

    let removeTimer: ReturnType<typeof setTimeout> | null = null;

    const timer = setTimeout(() => {
      const w = window as any;
      if (typeof w.__dismissUpnSplash === 'function') {
        w.__dismissUpnSplash();
        if (finishCallback) {
          removeTimer = setTimeout(() => finishCallback(), 580);
        }
        return;
      }

      // Iniciar desvanecimiento cinematográfico ultra suave 120fps del splash
      splash.style.transition = 'opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1)';
      splash.style.opacity = '0';
      splash.style.pointerEvents = 'none';

      // Una vez completado el fade cruzado, remover el nodo
      removeTimer = setTimeout(() => {
        try {
          if (splash && splash.parentNode) {
            splash.parentNode.removeChild(splash);
          }
        } catch (_) {}
        if (finishCallback) finishCallback();
      }, 580);
    }, duration);

    return () => {
      clearTimeout(timer);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, [duration, finishCallback]);

  return null;
};

export default SplashScreen;
