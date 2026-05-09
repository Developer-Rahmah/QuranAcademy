#!/usr/bin/env node
/**
 * generate-favicon-ico — packs the 16/32/48 PNG favicons in
 * `public/` into a single `public/favicon.ico` container.
 *
 * Why this exists:
 *   - Google Search and older browsers (and Safari on some surfaces)
 *     prefer a real `.ico` at `/favicon.ico` over an SVG-only setup.
 *   - The ICO format is a thin wrapper around 1+ embedded PNG/BMP
 *     images at standard sizes (16, 32, 48 are what we ship).
 *   - We deliberately avoid adding an npm dep (sharp / png-to-ico /
 *     to-ico) because the bundled-in `Buffer` API is enough — the
 *     header is 6 bytes + 16 bytes per entry + the PNG bytes.
 *
 * Usage:
 *   node scripts/generate-favicon-ico.mjs
 *
 * Inputs (must already exist in `public/`):
 *   - favicon-16x16.png
 *   - favicon-32x32.png
 *   - favicon-48x48.png   (Google Search's preferred crawl size)
 *
 * Output:
 *   - public/favicon.ico
 *
 * This is a one-shot generator. The `.ico` is checked in so the
 * regular Vite build doesn't have to run this script — re-run it
 * manually only when the source PNGs change.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');

/** Each entry: filesystem path + nominal pixel size. */
const ENTRIES = [
  { path: resolve(PUBLIC, 'favicon-16x16.png'), size: 16 },
  { path: resolve(PUBLIC, 'favicon-32x32.png'), size: 32 },
  { path: resolve(PUBLIC, 'favicon-48x48.png'), size: 48 },
];

const HEADER_SIZE = 6;
const DIRENTRY_SIZE = 16;

const images = ENTRIES.map(({ path, size }) => {
  const data = readFileSync(path);
  return { size, data };
});

// ICONDIR (6B): reserved=0, type=1 (icon), count=N
const header = Buffer.alloc(HEADER_SIZE);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

// Image data starts after the header + N directory entries.
let offset = HEADER_SIZE + DIRENTRY_SIZE * images.length;

const dir = Buffer.alloc(DIRENTRY_SIZE * images.length);
images.forEach((img, i) => {
  const base = i * DIRENTRY_SIZE;
  // 0 means 256 in the ICO spec — we never ship that size, but the
  // modulo keeps the encoding correct if we ever do.
  dir.writeUInt8(img.size % 256, base + 0);  // width
  dir.writeUInt8(img.size % 256, base + 1);  // height
  dir.writeUInt8(0, base + 2);               // colorCount (0 = true color)
  dir.writeUInt8(0, base + 3);               // reserved
  dir.writeUInt16LE(1, base + 4);            // planes
  dir.writeUInt16LE(32, base + 6);           // bitCount (PNG embedded)
  dir.writeUInt32LE(img.data.length, base + 8);  // bytesInRes
  dir.writeUInt32LE(offset, base + 12);          // imageOffset
  offset += img.data.length;
});

const out = Buffer.concat([header, dir, ...images.map((img) => img.data)]);
const outPath = resolve(PUBLIC, 'favicon.ico');
writeFileSync(outPath, out);

console.log(
  `✓ favicon.ico written (${images.length} sizes: ${images
    .map((i) => `${i.size}×${i.size}`)
    .join(', ')}) → ${outPath} (${out.length} bytes)`,
);
