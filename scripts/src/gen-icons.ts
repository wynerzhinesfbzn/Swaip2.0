import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC = resolve(__dirname, '../../artifacts/swaip/public');

function makeSvg(size: number, radius: number, fontSize: number, text = 'SWAP') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0d2452"/>
      <stop offset="0.55" stop-color="#071535"/>
      <stop offset="1" stop-color="#020514"/>
    </linearGradient>
    <linearGradient id="ink" x1="${size*0.1}" y1="${size*0.2}" x2="${size*0.9}" y2="${size*0.8}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f0faff"/>
      <stop offset="0.4" stop-color="#38bdf8"/>
      <stop offset="1" stop-color="#0369a1"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${Math.max(2, size*0.015)}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${radius}" fill="none" stroke="rgba(56,189,248,0.22)" stroke-width="${Math.max(1.5, size*0.008)}"/>
  <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="central"
        font-family="Arial Black, Arial, sans-serif" font-weight="900"
        font-size="${fontSize}" fill="url(#ink)" letter-spacing="${-fontSize*0.02}" filter="url(#glow)">${text}</text>
</svg>`;
}

function makeOpengraph(w: number, h: number) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0d2452"/>
      <stop offset="0.5" stop-color="#071535"/>
      <stop offset="1" stop-color="#020514"/>
    </linearGradient>
    <linearGradient id="ink" x1="100" y1="80" x2="1100" y2="420" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f0faff"/>
      <stop offset="0.4" stop-color="#38bdf8"/>
      <stop offset="1" stop-color="#0369a1"/>
    </linearGradient>
    <radialGradient id="glow-bg" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="rgba(56,189,248,0.12)"/>
      <stop offset="1" stop-color="transparent"/>
    </radialGradient>
    <filter id="glow" x="-10%" y="-20%" width="120%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <ellipse cx="${w/2}" cy="${h/2}" rx="${w*0.55}" ry="${h*0.55}" fill="url(#glow-bg)"/>
  <text x="${w/2}" y="${h/2 - 24}" text-anchor="middle" dominant-baseline="central"
        font-family="Arial Black, Arial, sans-serif" font-weight="900"
        font-size="200" fill="url(#ink)" letter-spacing="-4" filter="url(#glow)">SWAP</text>
  <text x="${w/2}" y="${h/2 + 112}" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, sans-serif" font-weight="700"
        font-size="32" fill="rgba(148,200,240,0.75)" letter-spacing="2">Социальная сеть нового поколения</text>
</svg>`;
}

const icons: Array<{svg: string; out: string}> = [
  { svg: makeSvg(192, 38, 76), out: `${PUBLIC}/icon-192.png` },
  { svg: makeSvg(512, 96, 200), out: `${PUBLIC}/icon-512.png` },
  { svg: makeSvg(192, 38, 76), out: `${PUBLIC}/icon-maskable-192.png` },
  { svg: makeSvg(512, 96, 200), out: `${PUBLIC}/icon-maskable.png` },
  { svg: makeSvg(512, 96, 200), out: `${PUBLIC}/icon-app.png` },
  { svg: makeSvg(512, 96, 200), out: `${PUBLIC}/swaip-logo.png` },
  { svg: makeOpengraph(1200, 630), out: `${PUBLIC}/opengraph.png` },
];

for (const { svg, out } of icons) {
  const resvg = new Resvg(svg, { background: 'transparent' });
  const png = resvg.render().asPng();
  writeFileSync(out, png);
  console.log(`✓ ${out.split('/').slice(-1)[0]}  (${png.length} bytes)`);
}

console.log('\nAll icons generated ✓');
