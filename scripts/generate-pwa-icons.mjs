import fs from 'fs';
import zlib from 'zlib';

// 1. Decodificar upn-arrow-icon.png original
const srcBuf = fs.readFileSync('public/upn-arrow-icon.png');
let pos = 8;
let ihdr = null;
let idatBuffers = [];
while (pos < srcBuf.length) {
  const len = srcBuf.readUInt32BE(pos);
  const type = srcBuf.toString('ascii', pos + 4, pos + 8);
  const data = srcBuf.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') ihdr = data;
  if (type === 'IDAT') idatBuffers.push(data);
  pos += 12 + len;
}

const srcW = ihdr.readUInt32BE(0); // 148
const srcH = ihdr.readUInt32BE(4); // 141
const rawInflated = zlib.inflateSync(Buffer.concat(idatBuffers));

// Convertir scanlines filtrados a píxeles RGBA limpios
const srcPixels = Buffer.alloc(srcW * srcH * 4);
const rowBytes = srcW * 4;
let prevRow = Buffer.alloc(rowBytes);

for (let y = 0; y < srcH; y++) {
  const filterType = rawInflated[y * (rowBytes + 1)];
  const rowStart = y * (rowBytes + 1) + 1;
  const currentRow = rawInflated.subarray(rowStart, rowStart + rowBytes);
  const uncompressedRow = Buffer.alloc(rowBytes);

  for (let x = 0; x < rowBytes; x++) {
    const rawVal = currentRow[x];
    const a = x >= 4 ? uncompressedRow[x - 4] : 0;
    const b = prevRow[x];
    const c = x >= 4 ? prevRow[x - 4] : 0;

    let val = 0;
    if (filterType === 0) val = rawVal;
    else if (filterType === 1) val = (rawVal + a) & 0xff;
    else if (filterType === 2) val = (rawVal + b) & 0xff;
    else if (filterType === 3) val = (rawVal + Math.floor((a + b) / 2)) & 0xff;
    else if (filterType === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      let pr = 0;
      if (pa <= pb && pa <= pc) pr = a;
      else if (pb <= pc) pr = b;
      else pr = c;
      val = (rawVal + pr) & 0xff;
    }
    uncompressedRow[x] = val;
  }

  uncompressedRow.copy(srcPixels, y * rowBytes);
  uncompressedRow.copy(prevRow);
}

function getSrcPixel(x, y) {
  if (x < 0 || x >= srcW || y < 0 || y >= srcH) return [0, 0, 0, 0];
  const offset = (Math.floor(y) * srcW + Math.floor(x)) * 4;
  return [
    srcPixels[offset],
    srcPixels[offset + 1],
    srcPixels[offset + 2],
    srcPixels[offset + 3]
  ];
}

// Generador de PNG estándar
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

// Función de escalado y centrado
function renderIcon(size, paddingRatio, bgDark = true) {
  const contentSize = size * (1 - paddingRatio * 2);
  const scale = contentSize / Math.max(srcW, srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const offsetX = (size - drawW) / 2;
  const offsetY = (size - drawH) / 2;

  return encodePng(size, size, (x, y) => {
    // Coordenadas relativas al gráfico del logo
    const imgX = (x - offsetX) / scale;
    const imgY = (y - offsetY) / scale;

    let [r, g, b, a] = [0, 0, 0, 0];
    if (imgX >= 0 && imgX < srcW && imgY >= 0 && imgY < srcH) {
      [r, g, b, a] = getSrcPixel(imgX, imgY);
    }

    if (bgDark) {
      // Fondo institucional #070c1e
      const bgR = 7, bgG = 12, bgB = 30;
      const alphaNorm = a / 255;
      const finalR = Math.round(r * alphaNorm + bgR * (1 - alphaNorm));
      const finalG = Math.round(g * alphaNorm + bgG * (1 - alphaNorm));
      const finalB = Math.round(b * alphaNorm + bgB * (1 - alphaNorm));
      return [finalR, finalG, finalB, 255];
    } else {
      return [r, g, b, a];
    }
  });
}

// 1. Icono estándar 192x192
fs.writeFileSync('public/icon-192.png', renderIcon(192, 0.12, true));
console.log('✓ public/icon-192.png generado');

// 2. Icono estándar 512x512
fs.writeFileSync('public/icon-512.png', renderIcon(512, 0.12, true));
console.log('✓ public/icon-512.png generado');

// 3. Icono maskable (zona segura de Android requiere 20% de padding)
fs.writeFileSync('public/icon-maskable-192.png', renderIcon(192, 0.22, true));
console.log('✓ public/icon-maskable-192.png generado');

fs.writeFileSync('public/icon-maskable-512.png', renderIcon(512, 0.22, true));
console.log('✓ public/icon-maskable-512.png generado');

// 4. Apple Touch Icon 180x180 para iPhone / iPad
fs.writeFileSync('public/apple-touch-icon.png', renderIcon(180, 0.14, true));
console.log('✓ public/apple-touch-icon.png generado');
