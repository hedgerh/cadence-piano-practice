// Generates apps/desktop/resources/icon.ico (16/32/48/64/128/256) and icon-mac.png (1024, for
// electron-builder's macOS .icns) with no dependencies:
// a tangerine (#FF8A4C) rounded square with an ink (#211B16) "C", drawn as a round-capped arc
// (Fredoka's rounded stroke style) and anti-aliased with signed distance fields.
//
//   node apps/desktop/scripts/generate-icon.mjs
//
// Sizes below 256 are stored as 32-bit BMP (DIB) entries, 256 as PNG: the most compatible ICO
// layout for Explorer, rcedit (electron-builder) and NSIS.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 64, 128, 256];
const TANGERINE = [0xff, 0x8a, 0x4c];
const INK = [0x21, 0x1b, 0x16];

const resources = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources');
const outFile = join(resources, 'icon.ico');
const macFile = join(resources, 'icon-mac.png');
/** macOS icon grid: the 1024 canvas holds an 824px tile (100px margin) so it sits with the Dock's. */
const MAC_SIZE = 1024;
const MAC_INSET = 100;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Signed distance to a rounded rectangle centred at the origin (half extents hx, hy). */
function sdRoundRect(x, y, hx, hy, r) {
  const qx = Math.abs(x) - hx + r;
  const qy = Math.abs(y) - hy + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

/** Signed distance to a round-capped arc of centre radius rm and width w, open on the right. */
function sdC(x, y, rm, w, gapHalfAngle) {
  const theta = Math.atan2(y, x);
  if (Math.abs(theta) >= gapHalfAngle) return Math.abs(Math.hypot(x, y) - rm) - w / 2;
  const ex = rm * Math.cos(gapHalfAngle);
  const ey = rm * Math.sin(gapHalfAngle);
  return Math.min(Math.hypot(x - ex, y - ey), Math.hypot(x - ex, y + ey)) - w / 2;
}

/** Straight (non-premultiplied) RGBA, top-down rows. `insetPx` overrides the tile margin. */
function render(size, insetPx) {
  const px = new Uint8Array(size * size * 4);
  // Small sizes use the full cell to stay legible.
  const inset = insetPx ?? (size >= 48 ? size / 32 : 0);
  const half = size / 2 - inset;
  const radius = half * 0.44;
  // The C is drawn against the ICO's 256px tile proportions (tile = 240/256 of the cell); with a
  // custom margin (macOS) it scales with the tile instead, so it fills the tile the same way.
  const letter = insetPx === undefined ? size : (half * 2 * 256) / 240;
  const rm = letter * 0.235;
  const w = letter * (size <= 16 ? 0.19 : 0.165);
  const gap = (42 * Math.PI) / 180;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = i + 0.5 - size / 2;
      const y = j + 0.5 - size / 2;
      const bg = clamp01(0.5 - sdRoundRect(x, y, half, half, radius));
      const c = clamp01(0.5 - sdC(x + letter * 0.015, y, rm, w, gap));
      const o = (j * size + i) * 4;
      for (let k = 0; k < 3; k++) px[o + k] = Math.round(TANGERINE[k] * (1 - c) + INK[k] * c);
      px[o + 3] = Math.round(bg * 255);
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO DIB entry: BITMAPINFOHEADER + bottom-up BGRA + 1bpp AND mask (all zero; alpha rules). */
function encodeDib(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // XOR + AND masks
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      const d = ((size - 1 - y) * size + x) * 4;
      xor[d] = rgba[s + 2];
      xor[d + 1] = rgba[s + 1];
      xor[d + 2] = rgba[s];
      xor[d + 3] = rgba[s + 3];
    }
  }
  const maskRow = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, xor, Buffer.alloc(maskRow * size)]);
}

const images = SIZES.map((size) => {
  const rgba = render(size);
  return { size, data: size >= 256 ? encodePng(size, rgba) : encodeDib(size, rgba) };
});

const dir = Buffer.alloc(6 + 16 * images.length);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2); // type: icon
dir.writeUInt16LE(images.length, 4);
let offset = dir.length;
images.forEach(({ size, data }, i) => {
  const e = 6 + 16 * i;
  dir[e] = size >= 256 ? 0 : size;
  dir[e + 1] = size >= 256 ? 0 : size;
  dir.writeUInt16LE(1, e + 4); // planes
  dir.writeUInt16LE(32, e + 6); // bpp
  dir.writeUInt32LE(data.length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += data.length;
});

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, Buffer.concat([dir, ...images.map((img) => img.data)]));
console.log(`Wrote ${outFile} (${SIZES.join('/')}px, ${offset} bytes)`);

writeFileSync(macFile, encodePng(MAC_SIZE, render(MAC_SIZE, MAC_INSET)));
console.log(`Wrote ${macFile} (${MAC_SIZE}px)`);
