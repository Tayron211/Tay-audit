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
 * y la aparición cinematográfica tipo fade suave de la interfaz (sin bloqueos ni scrollbars).
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  minDisplayTime,
  minDuration,
  onFinish,
  onFinished
}) => {
  const duration = minDuration || minDisplayTime || 1200;
  const finishCallback = onFinished || onFinish;

  useEffect(() => {
    // Si estamos en entorno nativo Capacitor (Android APK), desvanecer el splash nativo suavemente
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.SplashScreen) {
        (window as any).Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
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

    if (!splash) {
      makeInterfaceVisible();
      if (finishCallback) finishCallback();
      return;
    }

    const timer = setTimeout(() => {
      // 1. Iniciar aparición fluida con transición fade suave de la interfaz
      makeInterfaceVisible();

      // 2. Iniciar desvanecimiento cinematográfico ultra suave 120fps del splash
      splash.style.transition = 'opacity 0.65s cubic-bezier(0.4, 0, 0.2, 1)';
      splash.style.opacity = '0';
      splash.style.pointerEvents = 'none';

      // 3. Una vez completado el fade cruzado, remover el nodo
      const removeTimer = setTimeout(() => {
        try {
          if (splash && splash.parentNode) {
            splash.parentNode.removeChild(splash);
          }
        } catch (_) {}
        if (finishCallback) finishCallback();
      }, 700);

      return () => clearTimeout(removeTimer);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, finishCallback]);

  return null;
};

export default SplashScreen;
