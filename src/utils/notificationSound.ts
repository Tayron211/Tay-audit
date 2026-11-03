// Sistema de Notificación Sonora y Vibración en Tiempo Real (Móviles y Windows)

let audioContext: AudioContext | null = null;
let cachedAudioBuffer: AudioBuffer | null = null;
let globalAudioEl: HTMLAudioElement | null = null;
let isAudioUnlocked = false;
let lastChimeTs = 0;
const appInitTimestamp = typeof window !== 'undefined' ? Date.now() : 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
    }
  }
  return audioContext;
}

function getGlobalAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!globalAudioEl && typeof Audio !== 'undefined') {
    globalAudioEl = new Audio('/notification.wav');
    globalAudioEl.preload = 'auto';
    globalAudioEl.volume = 1.0;
  }
  return globalAudioEl;
}

// Pre-cargar el buffer de audio a través de fetch para Web Audio API (cero latencia, 100% confiable)
async function preloadAudioBuffer() {
  if (typeof window === 'undefined' || cachedAudioBuffer) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const res = await fetch('/notification.wav');
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      cachedAudioBuffer = await ctx.decodeAudioData(arrayBuf);
    }
  } catch {
    // Si falla la decodificación por red, el sintetizador oscillator actuará como respaldo inmediato
  }
}

// Iniciar pre-carga en segundo plano inmediatamente
if (typeof window !== 'undefined') {
  preloadAudioBuffer();
}

/**
 * Desbloquea la reproducción de audio en navegadores móviles (Chrome/Safari/Edge/Firefox)
 * en el primer toque o interacción del usuario con la pantalla.
 */
export const unlockNotificationAudio = () => {
  if (typeof window === 'undefined') return;

  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(() => {
      isAudioUnlocked = true;
    }).catch(() => {});
  } else if (ctx && ctx.state === 'running') {
    isAudioUnlocked = true;
  }

  // Desbloqueo 100% inaudible (cero volumen / muestra silenciosa) sin emitir pitidos al iniciar
  if (ctx && ctx.state === 'running' && !isAudioUnlocked) {
    try {
      const silentBuf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silentBuf;
      src.connect(ctx.destination);
      src.start(0);
      isAudioUnlocked = true;
    } catch {}
  }

  if (!cachedAudioBuffer) {
    preloadAudioBuffer();
  }
};

// Auto-enlazar listeners para desbloquear con cualquier toque o interacción del usuario en la pantalla
if (typeof window !== 'undefined') {
  const handleInteraction = () => {
    unlockNotificationAudio();
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running' && isAudioUnlocked) {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('touchend', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    }
  };

  window.addEventListener('pointerdown', handleInteraction, { passive: true });
  window.addEventListener('touchstart', handleInteraction, { passive: true });
  window.addEventListener('touchend', handleInteraction, { passive: true });
  window.addEventListener('click', handleInteraction, { passive: true });
  window.addEventListener('keydown', handleInteraction, { passive: true });
}

/**
 * Síntesis acústica de campana de notificación cristalina mediante Web Audio API
 * Optimizada para altavoces de teléfonos móviles (frecuencias 880Hz - 1760Hz con alta claridad).
 */
const synthesizeChime = (ctx: AudioContext) => {
  try {
    const now = ctx.currentTime;

    // Master gain con salida alta y nítida
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.9, now);
    masterGain.connect(ctx.destination);

    // Tono 1: Campana base (A5: 880 Hz) con armónico cálido
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.75, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tono 2: Armónico medio brillante (D6: 1174.66 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.10);
    gain2.gain.setValueAtTime(0.85, now + 0.10);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.50);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.10);
    osc2.stop(now + 0.50);

    // Tono 3: Campana alta cristalina (A6: 1760 Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1760, now + 0.20);
    gain3.gain.setValueAtTime(0.95, now + 0.20);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.70);
    osc3.connect(gain3);
    gain3.connect(masterGain);
    osc3.start(now + 0.20);
    osc3.stop(now + 0.70);
  } catch {}
};

/**
 * Emite sonido de timbre acústico fuerte y vibración háptica optimizada para móviles
 */
export const playNotificationChime = () => {
  if (typeof window === 'undefined') return;

  // Supresión estricta de pitidos durante los primeros 4 segundos de apertura de la aplicación
  if (Date.now() - appInitTimestamp < 4000) {
    return;
  }

  // Throttle de 600ms para evitar solapamiento o chasquidos por llamadas repetitivas simultáneas
  const now = Date.now();
  if (now - lastChimeTs < 600) return;
  lastChimeTs = now;

  // 1. Vibración háptica en dispositivos móviles (patrón doble distintivo de notificación)
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([250, 100, 250, 100, 350]);
    } catch {}
  }

  // 2. Reproducir mediante Web Audio API si el contexto está disponible (el canal más robusto en móviles)
  const ctx = getAudioContext();
  let webAudioPlayed = false;

  if (ctx) {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (cachedAudioBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = cachedAudioBuffer;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.1, ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        webAudioPlayed = true;
      } catch {}
    }

    if (!webAudioPlayed) {
      synthesizeChime(ctx);
      webAudioPlayed = true;
    }
  }

  // 3. Fallback con elemento de audio HTML5 pre-desbloqueado
  if (!webAudioPlayed) {
    try {
      const audio = getGlobalAudio();
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch {}
  }
};
