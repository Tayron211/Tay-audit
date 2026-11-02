// Sistema de Notificación Sonora y Vibración en Tiempo Real (Móviles y Windows)

let globalAudioEl: HTMLAudioElement | null = null;
let audioUnlocked = false;

/**
 * Desbloquea la reproducción de audio en navegadores móviles (Chrome/Safari/Edge)
 * en el primer toque o interacción del usuario con la pantalla.
 */
export const unlockNotificationAudio = () => {
  if (audioUnlocked || typeof window === 'undefined') return;
  try {
    if (!globalAudioEl && typeof Audio !== 'undefined') {
      globalAudioEl = new Audio('/notification.wav');
      globalAudioEl.preload = 'auto';
      globalAudioEl.volume = 1.0;
    }
    if (globalAudioEl) {
      const p = globalAudioEl.play();
      if (p) {
        p.then(() => {
          globalAudioEl?.pause();
          if (globalAudioEl) globalAudioEl.currentTime = 0;
          audioUnlocked = true;
        }).catch(() => {});
      }
    }
  } catch {}
};

/**
 * Generador de síntesis por Web Audio API en caso de que el archivo físico esté bloqueado
 */
const synthesizeChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Primer tono claro (D5: 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Segundo tono armónico brillante (A5: 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {}
};

/**
 * Emite sonido de timbre acústico fuerte y vibración táctil
 */
export const playNotificationChime = () => {
  if (typeof window === 'undefined') return;

  // 1. Vibración háptica en dispositivos móviles (patrón de doble campanada)
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([300, 150, 300, 150, 450]);
    } catch {}
  }

  // 2. Reproducir audio real del archivo notification.wav
  try {
    const audio = new Audio('/notification.wav');
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Fallback inmediato a síntesis Web Audio si el navegador impone restricciones
        synthesizeChime();
      });
    }
  } catch {
    synthesizeChime();
  }
};
