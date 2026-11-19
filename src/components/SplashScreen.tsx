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
  const duration = minDuration ?? minDisplayTime ?? 300;
  const finishCallback = onFinished || onFinish;

  useEffect(() => {
    // Si estamos en entorno nativo Capacitor (Android APK), desvanecer el splash nativo suavemente
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.SplashScreen) {
        (window as any).Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
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

    // Liberar visibilidad de la interfaz de inmediato
    makeInterfaceVisible();

    if (!splash) {
      if (finishCallback) finishCallback();
      return;
    }

    const timer = setTimeout(() => {
      // Iniciar desvanecimiento cinematográfico ultra suave 120fps del splash
      splash.style.transition = 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
      splash.style.opacity = '0';
      splash.style.pointerEvents = 'none';

      // Una vez completado el fade cruzado, remover el nodo
      const removeTimer = setTimeout(() => {
        try {
          if (splash && splash.parentNode) {
            splash.parentNode.removeChild(splash);
          }
        } catch (_) {}
        if (finishCallback) finishCallback();
      }, 350);

      return () => clearTimeout(removeTimer);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, finishCallback]);

  return null;
};

export default SplashScreen;
