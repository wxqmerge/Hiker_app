// Generates PWA PNG icons (192/512) from the favicon mountain+flag design.
// Uses a minimal PNG encoder (zlib is built into Node). No external deps.
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = rowStart + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const BG = [45, 106, 79, 255];
  const MOUNTAIN = [255, 255, 255, 255];
  const FLAG = [183, 228, 199, 255];
  const s = size / 48;
  const mountain = [[8, 42], [22, 12], [28, 24], [36, 16], [40, 42]].map(([x, y]) => [x * s, y * s]);
  const flag = [[36, 8], [42, 10], [36, 12]].map(([x, y]) => [x * s, y * s]);
  const poleX = 36 * s;
  const poleTopY = 8 * s;
  const poleBottomY = 16 * s;
  const poleW = Math.max(1, size / 96);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let c = BG;
      if (pointInPolygon(x + 0.5, y + 0.5, mountain)) c = MOUNTAIN;
      const onPole = x >= poleX - poleW && x <= poleX + poleW && y >= poleTopY && y <= poleBottomY;
      if (pointInPolygon(x + 0.5, y + 0.5, flag) || onPole) c = FLAG;
      rgba[idx] = c[0];
      rgba[idx + 1] = c[1];
      rgba[idx + 2] = c[2];
      rgba[idx + 3] = c[3];
    }
  }
  return rgba;
}

const outDir = resolve(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePng(size, size, renderIcon(size));
  writeFileSync(resolve(outDir, `icon-${size}.png`), png);
  console.log(`Wrote public/icons/icon-${size}.png (${png.length} bytes)`);
}
