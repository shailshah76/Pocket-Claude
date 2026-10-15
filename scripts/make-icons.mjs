// Renders the app icon (clay chat bubble with a ">_" prompt) to PNGs with signed-distance shapes.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [20, 20, 19], BUBBLE = [217, 119, 87], INK = [250, 246, 238];

function seg(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}
function rrect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function tri(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s = (x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d1 = s(ax, ay, bx, by), d2 = s(bx, by, cx, cy), d3 = s(cx, cy, ax, ay);
  const inside = !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  const d = Math.min(seg(px, py, ax, ay, bx, by), seg(px, py, bx, by, cx, cy), seg(px, py, cx, cy, ax, ay));
  return inside ? -d : d;
}
const cov = (d, aa) => Math.max(0, Math.min(1, 0.5 - d / aa));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function render(size, { bg = BG, scale = 1, mono = false } = {}) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // `scale` < 1 shrinks the glyph toward the centre (Android adaptive-icon safe zone).
      const px = ((x + 0.5) / size - 0.5) / scale + 0.5, py = ((y + 0.5) / size - 0.5) / scale + 0.5;
      const aa = 1 / (size * scale);
      let c = bg ?? [0, 0, 0];
      let alpha = bg ? 1 : 0;
      const bubble = Math.min(rrect(px, py, 0.5, 0.46, 0.27, 0.2, 0.09), tri(px, py, [0.34, 0.6], [0.47, 0.6], [0.32, 0.75]));
      const cb = cov(bubble, aa);
      c = mix(c, mono ? [255, 255, 255] : BUBBLE, bg ? cb : cb > 0 ? 1 : 0);
      alpha = Math.max(alpha, cb);
      const w = 0.032;
      const chevron = Math.min(seg(px, py, 0.37, 0.38, 0.45, 0.46), seg(px, py, 0.45, 0.46, 0.37, 0.54)) - w;
      const under = seg(px, py, 0.51, 0.54, 0.63, 0.54) - w;
      const ci = cov(Math.min(chevron, under), aa);
      // Monochrome icons punch the prompt out of the bubble instead of painting it.
      if (mono) alpha = Math.min(alpha, 1 - ci);
      else c = mix(c, INK, ci);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = Math.round(alpha * 255);
    }
  }
  return png(size, raw);
}

function png(size, raw) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const web = new URL('../web/public/', import.meta.url);
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) writeFileSync(new URL(name, web), render(size));

const mobile = new URL('../mobile/assets/', import.meta.url);
writeFileSync(new URL('icon.png', mobile), render(1024));
writeFileSync(new URL('android-icon-foreground.png', mobile), render(1024, { bg: null, scale: 0.72 }));
writeFileSync(new URL('android-icon-background.png', mobile), render(1024, { bg: BG, scale: 0.0001 }));
writeFileSync(new URL('android-icon-monochrome.png', mobile), render(1024, { bg: null, scale: 0.72, mono: true }));
writeFileSync(new URL('splash-icon.png', mobile), render(1024, { bg: null, scale: 1 }));
console.log('icons written');
