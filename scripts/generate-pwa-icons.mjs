import fs from 'fs';
import zlib from 'zlib';

// Coordenadas canónicas en canvas de 108 x 108 dp
const LEFT_PILLAR_108 = [
  [52.65, 32.00],
  [48.13, 32.00],
  [35.95, 44.18],
  [35.95, 51.41],
  [46.22, 44.18],
  [46.22, 76.00],
  [52.65, 76.00]
];

const RIGHT_PILLAR_108 = [
  [55.35, 32.00],
  [59.87, 32.00],
  [72.05, 44.18],
  [72.05, 51.41],
  [61.78, 44.18],
  [61.78, 76.00],
  [55.35, 76.00]
];

const COLOR_GOLD = [255, 184, 0];    // #FFB800
const COLOR_NAVY = [7, 12, 30];       // #070C1E

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

function encodePng(width, height, pixelFn) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;
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
  ihdrData[9] = 6;
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

function renderPwaIcon(size, emblemRatio = 0.54, cornerRadiusRatio = 0) {
  const center = size / 2;
  const targetH = size * emblemRatio;
  const scale = targetH / 44;
  const N = 4;
  const cornerR = size * cornerRadiusRatio;

  const minX = center - (19 * scale);
  const maxX = center + (19 * scale);
  const minY = center - (23 * scale);
  const maxY = center + (23 * scale);

  return encodePng(size, size, (x, y) => {
    let inCardAlpha = 1;
    if (cornerR > 0) {
      const px = x + 0.5, py = y + 0.5;
      const qx = Math.max(cornerR - px, px - (size - cornerR), 0);
      const qy = Math.max(cornerR - py, py - (size - cornerR), 0);
      if (qx > 0 && qy > 0) {
        const cornerDist = Math.sqrt(qx * qx + qy * qy);
        if (cornerDist > cornerR) return [0, 0, 0, 0];
        inCardAlpha = Math.max(0, Math.min(1, cornerR - cornerDist + 0.5));
      }
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

// 1. Icono estándar 192x192
fs.writeFileSync('public/icon-192.png', renderPwaIcon(192, 0.56, 0.18));
console.log('✓ public/icon-192.png generado');

// 2. Icono estándar 512x512
fs.writeFileSync('public/icon-512.png', renderPwaIcon(512, 0.56, 0.18));
console.log('✓ public/icon-512.png generado');

// 3. Icono maskable (zona segura de Android requiere 40% de altura de icono para que no corte)
fs.writeFileSync('public/icon-maskable-192.png', renderPwaIcon(192, 0.44, 0));
console.log('✓ public/icon-maskable-192.png generado');

fs.writeFileSync('public/icon-maskable-512.png', renderPwaIcon(512, 0.44, 0));
console.log('✓ public/icon-maskable-512.png generado');

// 4. Apple Touch Icon 180x180 para iPhone / iPad
fs.writeFileSync('public/apple-touch-icon.png', renderPwaIcon(180, 0.54, 0));
console.log('✓ public/apple-touch-icon.png generado');
