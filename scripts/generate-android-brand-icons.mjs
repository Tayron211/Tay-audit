import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// ============================================================================
// GENERADOR MATEMÁTICO DE ICONOS UPN PARA ANDROID
// 100% Simetría Geométrica, Cero Recorte y Centrado Exacto en Safe Zone
// ============================================================================

// Coordenadas canónicas en canvas de 108 x 108 dp (Android Adaptive Icon Specs)
// Centro absoluto: (54.0, 54.0)
// Altura: 44.0 dp (Y de 32.0 a 76.0 -> Margen superior: 32dp, Margen inferior: 32dp)
// Ancho: 36.1 dp (X de 35.95 a 72.05 -> Margen izq: 35.95dp, Margen der: 35.95dp)
const LEFT_PILLAR_108 = [
  [52.65, 32.00], // Top inner
  [48.13, 32.00], // Top flat
  [35.95, 44.18], // Wing outer top
  [35.95, 51.41], // Wing outer bottom
  [46.22, 44.18], // Under-wing notch
  [46.22, 76.00], // Stem outer bottom
  [52.65, 76.00]  // Stem inner bottom
];

const RIGHT_PILLAR_108 = [
  [55.35, 32.00], // Top inner
  [59.87, 32.00], // Top flat
  [72.05, 44.18], // Wing outer top
  [72.05, 51.41], // Wing outer bottom
  [61.78, 44.18], // Under-wing notch
  [61.78, 76.00], // Stem outer bottom
  [55.35, 76.00]  // Stem inner bottom
];

// Colores Institucionales UPN / Tay-Audit
const COLOR_GOLD = [255, 184, 0];    // #FFB800 (Lúcuma Gold UPN)
const COLOR_NAVY = [7, 12, 30];       // #070C1E (Dark Navy institucional)

// Test de punto en polígono (Ray-casting)
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Encoder PNG optimizado
function encodePng(width, height, pixelFn) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ (c >>> 1);
        else c = c >>> 1;
      }
      table[n] = c;
    }
    let c = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
    }
    return (c ^ (-1)) >>> 0;
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// 1. Renderizador de Foreground Adaptativo (ic_launcher_foreground.png)
// Tamaño size x size, fondo 100% transparente, símbolo UPN dorado centrado con antialiasing
function renderLauncherForeground(size) {
  const scale = size / 108;
  const minX = 33 * scale, maxX = 75 * scale;
  const minY = 30 * scale, maxY = 78 * scale;
  const N = 4; // 4x4 = 16 submuestras por píxel

  return encodePng(size, size, (x, y) => {
    if (x < minX || x > maxX || y < minY || y > maxY) {
      return [0, 0, 0, 0];
    }

    let cov = 0;
    for (let sy = 0; sy < N; sy++) {
      for (let sx = 0; sx < N; sx++) {
        const cx = (x + (sx + 0.5) / N) / scale;
        const cy = (y + (sy + 0.5) / N) / scale;
        if (pointInPoly(cx, cy, LEFT_PILLAR_108) || pointInPoly(cx, cy, RIGHT_PILLAR_108)) {
          cov++;
        }
      }
    }

    if (cov === 0) return [0, 0, 0, 0];
    const alpha = Math.round((cov / (N * N)) * 255);
    return [COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2], alpha];
  });
}

// 2. Renderizador de Icono Redondo (ic_launcher_round.png)
// Fondo circular Deep Navy #070C1E, símbolo dorado centrado (altura = 56% del diámetro)
function renderLauncherRound(size) {
  const radius = size / 2;
  const center = size / 2;
  // Escalado del emblema UPN: en canvas de 108, la altura es 44. Queremos altura = size * 0.54
  const targetH = size * 0.54;
  const scale = targetH / 44; // escala relativa a los 44dp
  const N = 4;

  const minX = center - (19 * scale);
  const maxX = center + (19 * scale);
  const minY = center - (23 * scale);
  const maxY = center + (23 * scale);

  return encodePng(size, size, (x, y) => {
    const dx = (x + 0.5) - center;
    const dy = (y + 0.5) - center;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > radius) {
      return [0, 0, 0, 0];
    }
    const circleAlpha = Math.max(0, Math.min(1, radius - dist + 0.5));

    // Determinar cobertura del símbolo UPN
    let cov = 0;
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const subX = x + (sx + 0.5) / N;
          const subY = y + (sy + 0.5) / N;
          // Mapear de vuelta a canvas 108dp
          const canX = 54 + (subX - center) / scale;
          const canY = 54 + (subY - center) / scale;
          if (pointInPoly(canX, canY, LEFT_PILLAR_108) || pointInPoly(canX, canY, RIGHT_PILLAR_108)) {
            cov++;
          }
        }
      }
    }

    const emblemAlpha = cov / (N * N);
    const r = Math.round(COLOR_GOLD[0] * emblemAlpha + COLOR_NAVY[0] * (1 - emblemAlpha));
    const g = Math.round(COLOR_GOLD[1] * emblemAlpha + COLOR_NAVY[1] * (1 - emblemAlpha));
    const b = Math.round(COLOR_GOLD[2] * emblemAlpha + COLOR_NAVY[2] * (1 - emblemAlpha));
    const a = Math.round(255 * circleAlpha);

    return [r, g, b, a];
  });
}

// 3. Renderizador de Icono Clásico Cuadrado / Squircle (ic_launcher.png)
// Fondo Deep Navy #070C1E con esquinas redondeadas suaves, símbolo dorado centrado
function renderLauncherSquare(size) {
  const center = size / 2;
  const targetH = size * 0.54;
  const scale = targetH / 44;
  const N = 4;
  const cornerR = size * 0.20;

  const minX = center - (19 * scale);
  const maxX = center + (19 * scale);
  const minY = center - (23 * scale);
  const maxY = center + (23 * scale);

  return encodePng(size, size, (x, y) => {
    // Cálculo de distancia a esquinas redondeadas
    let inCardAlpha = 1;
    const px = x + 0.5, py = y + 0.5;
    const qx = Math.max(cornerR - px, px - (size - cornerR), 0);
    const qy = Math.max(cornerR - py, py - (size - cornerR), 0);
    if (qx > 0 && qy > 0) {
      const cornerDist = Math.sqrt(qx * qx + qy * qy);
      if (cornerDist > cornerR) return [0, 0, 0, 0];
      inCardAlpha = Math.max(0, Math.min(1, cornerR - cornerDist + 0.5));
    }

    let cov = 0;
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const subX = x + (sx + 0.5) / N;
          const subY = y + (sy + 0.5) / N;
          const canX = 54 + (subX - center) / scale;
          const canY = 54 + (subY - center) / scale;
          if (pointInPoly(canX, canY, LEFT_PILLAR_108) || pointInPoly(canX, canY, RIGHT_PILLAR_108)) {
            cov++;
          }
        }
      }
    }

    const emblemAlpha = cov / (N * N);
    const r = Math.round(COLOR_GOLD[0] * emblemAlpha + COLOR_NAVY[0] * (1 - emblemAlpha));
    const g = Math.round(COLOR_GOLD[1] * emblemAlpha + COLOR_NAVY[1] * (1 - emblemAlpha));
    const b = Math.round(COLOR_GOLD[2] * emblemAlpha + COLOR_NAVY[2] * (1 - emblemAlpha));
    const a = Math.round(255 * inCardAlpha);

    return [r, g, b, a];
  });
}

// 4. Renderizador de Pantalla Splash (splash.png)
// Fondo Deep Navy #070C1E, emblema dorado centrado con tamaño proporcional
function renderSplashScreen(w, h) {
  const minDim = Math.min(w, h);
  const targetH = Math.min(minDim * 0.35, 300);
  const scale = targetH / 44;
  const centerX = w / 2;
  const centerY = h / 2;
  const N = 4;

  const minX = centerX - (19 * scale);
  const maxX = centerX + (19 * scale);
  const minY = centerY - (23 * scale);
  const maxY = centerY + (23 * scale);

  return encodePng(w, h, (x, y) => {
    let cov = 0;
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const subX = x + (sx + 0.5) / N;
          const subY = y + (sy + 0.5) / N;
          const canX = 54 + (subX - centerX) / scale;
          const canY = 54 + (subY - centerY) / scale;
          if (pointInPoly(canX, canY, LEFT_PILLAR_108) || pointInPoly(canX, canY, RIGHT_PILLAR_108)) {
            cov++;
          }
        }
      }
    }

    const emblemAlpha = cov / (N * N);
    const r = Math.round(COLOR_GOLD[0] * emblemAlpha + COLOR_NAVY[0] * (1 - emblemAlpha));
    const g = Math.round(COLOR_GOLD[1] * emblemAlpha + COLOR_NAVY[1] * (1 - emblemAlpha));
    const b = Math.round(COLOR_GOLD[2] * emblemAlpha + COLOR_NAVY[2] * (1 - emblemAlpha));

    return [r, g, b, 255];
  });
}

console.log('--- GENERANDO ICONOS MATEMÁTICAMENTE CENTRADOS Y SIMÉTRICOS UPN ---');

// Matriz de densidades Android
const densities = [
  { folder: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
  { folder: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
  { folder: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
  { folder: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
  { folder: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 }
];

const resDir = path.resolve('android/app/src/main/res');

for (const d of densities) {
  const dir = path.join(resDir, d.folder);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), renderLauncherSquare(d.iconSize));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), renderLauncherRound(d.iconSize));
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), renderLauncherForeground(d.fgSize));

  console.log(`✓ ${d.folder}: ic_launcher (${d.iconSize}px), ic_launcher_round (${d.iconSize}px), ic_launcher_foreground (${d.fgSize}px)`);
}

// Generación de pantallas de Splash UPN
const splashConfigs = [
  { folder: 'drawable', w: 480, h: 800 },
  { folder: 'drawable-port-mdpi', w: 320, h: 480 },
  { folder: 'drawable-port-hdpi', w: 480, h: 800 },
  { folder: 'drawable-port-xhdpi', w: 720, h: 1280 },
  { folder: 'drawable-port-xxhdpi', w: 960, h: 1600 },
  { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  { folder: 'drawable-land-mdpi', w: 480, h: 320 },
  { folder: 'drawable-land-hdpi', w: 800, h: 480 },
  { folder: 'drawable-land-xhdpi', w: 1280, h: 720 },
  { folder: 'drawable-land-xxhdpi', w: 1600, h: 960 },
  { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280 }
];

for (const s of splashConfigs) {
  const sDir = path.join(resDir, s.folder);
  fs.mkdirSync(sDir, { recursive: true });
  fs.writeFileSync(path.join(sDir, 'splash.png'), renderSplashScreen(s.w, s.h));
  console.log(`✓ Splash UPN generado: ${s.folder}/splash.png (${s.w}x${s.h})`);
}

console.log('¡TODOS LOS RECURSOS DE MARCA UPN GENERADOS CON ÉXITO Y SIMETRÍA 100%!');
