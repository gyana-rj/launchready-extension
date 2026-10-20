// Generates the extension icons (public/icons/icon-{16,32,48,128}.png): a white check mark on a
// blue rounded square. Pure Node, no dependencies. Run: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const SIZES = [16, 32, 48, 128];
const OUT = new URL("../public/icons/", import.meta.url);
const SUPERSAMPLE = 4;

// Everything is in a 0..1 square.
const RADIUS = 0.22;
// Toolbar sizes fill the square. The 128 px store icon follows Chrome's guideline: 96 px of artwork, 16 px transparent padding.
const MARGIN_FOR = (size) => (size === 128 ? 0.125 : 0.02);
const CHECK = [[0.27, 0.53], [0.44, 0.7], [0.74, 0.34]];
const CHECK_HALF_WIDTH = 0.065;
const TOP = [0x3b, 0x6d, 0xf0];
const BOTTOM = [0x1d, 0x46, 0xb5];

function insideRoundedSquare(x, y, margin) {
  const half = 0.5 - margin;
  const dx = Math.max(Math.abs(x - 0.5) - (half - RADIUS), 0);
  const dy = Math.max(Math.abs(y - 0.5) - (half - RADIUS), 0);
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function insideCheck(x, y) {
  return CHECK.slice(1).some((point, i) => distToSegment(x, y, CHECK[i], point) <= CHECK_HALF_WIDTH);
}

function render(size) {
  const margin = MARGIN_FOR(size);
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          if (!insideRoundedSquare(x, y, margin)) continue;
          a++;
          if (insideCheck(x, y)) {
            r += 255;
            g += 255;
            b += 255;
          } else {
            r += TOP[0] + (BOTTOM[0] - TOP[0]) * y;
            g += TOP[1] + (BOTTOM[1] - TOP[1]) * y;
            b += TOP[2] + (BOTTOM[2] - TOP[2]) * y;
          }
        }
      }
      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const o = (py * size + px) * 4;
      if (a > 0) {
        pixels[o] = Math.round(r / a);
        pixels[o + 1] = Math.round(g / a);
        pixels[o + 2] = Math.round(b / a);
      }
      pixels[o + 3] = Math.round((a / samples) * 255);
    }
  }
  return pixels;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  writeFileSync(new URL(`icon-${size}.png`, OUT), png(size, render(size)));
  console.log(`icon-${size}.png`);
}
