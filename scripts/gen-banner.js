// Genera assets/banner-{dark,light}.svg: ventana vim con elefante PostgreSQL punteado (dither FS) + profile.yml
const fs = require('fs');
const path = require('path');
// Uso: node scripts/gen-banner.js  (escribe en assets/)
const out = process.argv[2] || path.join(__dirname, '..', 'assets');

const themes = {
  dark: { bg: '#0A0F14', win: '#0D1520', panel: '#101C28', line: '#22344A', muted: '#7D8FA3',
    text: '#E6EDF3', top: '#E6EDF3', key: '#3FB950', accent: '#39C5CF', dot: '#3FB950',
    pill: '#1C2B3A', pillText: '#E6EDF3', bar: '#3FB950', barText: '#0A0F14' },
  light: { bg: '#EEF3F1', win: '#F8FAF9', panel: '#FFFFFF', line: '#CFDBD6', muted: '#5F6E7A',
    text: '#1F2328', top: '#1F2328', key: '#1A7F37', accent: '#0A7A8A', dot: '#1A7F37',
    pill: '#E3EEEA', pillText: '#1F2328', bar: '#1A7F37', barText: '#FFFFFF' },
};

const MONO = "ui-monospace,SFMono-Regular,'JetBrains Mono',Consolas,monospace";
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- elefante de PostgreSQL: PNG -> escala de grises -> Floyd-Steinberg serpentina ----------
// Fuente: assets/source/postgres-elephant.png (300x340, fondo magenta = transparente)
const zlib = require('zlib');
const SOURCE = path.join(__dirname, '..', 'assets', 'source', 'postgres-elephant.png');

// decodificador PNG minimo: 8 bits, RGB o RGBA, sin entrelazado
function readPng(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, width, height, channels, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      channels = { 2: 3, 6: 4 }[data[9]];
      if (data[8] !== 8 || !channels || data[12] !== 0) throw new Error('PNG no soportado');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels, px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[dst + i - channels] : 0;
      const b = y > 0 ? px[dst - stride + i] : 0;
      const c = y > 0 && i >= channels ? px[dst - stride + i - channels] : 0;
      let v = raw[src + i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + i] = v & 255;
    }
  }
  return { width, height, channels, px };
}

const img = readPng(SOURCE);
const W = img.width, H = img.height;

// tono por color: lineas blancas y contorno negro densos, relleno azul disperso, magenta vacio
function grayscale() {
  const g = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = img.px[i * img.channels], gr = img.px[i * img.channels + 1], b = img.px[i * img.channels + 2];
    if (r > 180 && b > 180 && gr < 110) g[i] = 0;          // fondo
    else if (r > 200 && gr > 200 && b > 200) g[i] = 0.5;   // lineas blancas
    else if (r < 70 && gr < 70 && b < 70) g[i] = 0.2;      // contorno negro
    else g[i] = 0.05 + 0.04 * (1 - (i / W) / H);           // relleno azul
  }
  return g;
}

function dither(g) {
  const pts = [];
  for (let y = 0; y < H; y++) {
    const ltr = y % 2 === 0, dir = ltr ? 1 : -1;
    for (let i = 0; i < W; i++) {
      const x = ltr ? i : W - 1 - i, idx = y * W + x;
      const old = g[idx], v = old >= 0.5 ? 1 : 0, err = old - v;
      if (v) pts.push([x, y]);
      const add = (dx, dy, w) => {
        const nx = x + dx * dir, ny = y + dy;
        if (nx >= 0 && nx < W && ny < H) g[ny * W + nx] += err * w;
      };
      add(1, 0, 7 / 16); add(-1, 1, 3 / 16); add(0, 1, 5 / 16); add(1, 1, 1 / 16);
    }
  }
  return pts;
}

const POINTS = dither(grayscale());

function stipple(t) {
  const ox = 94, oy = 150;
  // un solo path con trazos de 1px: mucho mas liviano que un <rect> por punto
  let d = '';
  for (const [x, y] of POINTS) d += `M${ox + x} ${oy + y}h1`;
  return `<path d="${d}" stroke="${t.dot}" stroke-width="1.3" stroke-linecap="square" opacity="0">` +
         `<animate attributeName="opacity" from="0" to="1" dur="1.2s" fill="freeze"/></path>`;
}

// ---------- profile.yml ----------
const yml = [
  [0, 'profile', ''],
  [1, 'user', 'DiegoG29'],
  [1, 'role', 'Full Stack Developer'],
  [1, 'focus', 'Web apps · APIs · Bases de datos'],
  [1, 'status', 'Construyendo · Aprendiendo · Desplegando'],
  [0, 'stack', ''],
  [1, 'backend', 'PHP · Laravel · Node.js · Python'],
  [1, 'frontend', 'Blade · React · Next.js · TypeScript'],
  [1, 'database', 'PostgreSQL'],
  [1, 'languages', 'PHP · JavaScript · TypeScript · Python'],
  [1, 'tools', 'Git · GitHub · Composer · npm'],
  [0, 'contact', ''],
  [1, 'github', 'DiegoG29'],
];
const ymlText = yml.map(([lvl, k, v]) => `${'  '.repeat(lvl)}${k}:${v ? ' ' + v : ''}`).join('\n') + '\n';
const ymlBytes = Buffer.byteLength(ymlText, 'utf8');

function yaml(t) {
  const x0 = 520, y0 = 158, lh = 27;
  let s = `<g font-family="${MONO}" font-size="15">`;
  yml.forEach(([lvl, key, val], i) => {
    const y = y0 + i * lh;
    const begin = (0.3 + i * 0.15).toFixed(2);
    s += `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${begin}s" dur="0.2s" fill="freeze"/>`;
    s += `<text x="${x0 - 22}" y="${y}" text-anchor="end" fill="${t.muted}" font-size="12">${i + 1}</text>`;
    s += lvl === 0
      ? `<text x="${x0}" y="${y}" fill="${t.top}" font-weight="700">${key}:</text>`
      : `<text x="${x0 + 20}" y="${y}"><tspan fill="${t.key}">${key}:</tspan> <tspan fill="${t.text}">${esc(val)}</tspan></text>`;
    s += `</g>`;
  });
  return s + `</g>`;
}

function banner(name) {
  const t = themes[name];
  const n = yml.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="610" viewBox="0 0 1180 610" role="img" aria-labelledby="title desc">` +
  `<title id="title">DiegoG29 — Full Stack Developer</title>` +
  `<desc id="desc">Perfil en terminal tipo vim con el elefante de PostgreSQL punteado y profile.yml.</desc>` +
  `<rect width="1180" height="610" rx="18" fill="${t.bg}"/>` +
  `<rect x="13" y="13" width="1154" height="584" rx="13" fill="${t.win}" stroke="${t.line}"/>` +
  `<path d="M13 62H1167" stroke="${t.line}"/>` +
  `<circle cx="38" cy="38" r="6" fill="#FF5F57"/><circle cx="59" cy="38" r="6" fill="#FEBC2E"/><circle cx="80" cy="38" r="6" fill="#28C840"/>` +
  `<text x="590" y="43" text-anchor="middle" fill="${t.muted}" font-family="${MONO}" font-size="13">vim profile.yml</text>` +
  // panel izquierdo
  `<g font-family="${MONO}">` +
  `<rect x="35" y="88" width="418" height="472" rx="6" fill="${t.panel}" stroke="${t.line}"/>` +
  `<path d="M35 124H453" stroke="${t.line}"/>` +
  `<text x="49" y="111" fill="${t.top}" font-size="13" font-weight="700" letter-spacing="1.2">VISUAL.MAP</text>` +
  `<text x="438" y="111" text-anchor="end" fill="${t.muted}" font-size="11">${W}×${H} / 1-BIT</text>` +
  `<path d="M49 141h12M49 141v12M439 141h-12M439 141v12M49 539h12M49 539v-12M439 539h-12M439 539v-12" fill="none" stroke="${t.muted}" opacity=".7"/>` +
  `<text x="64" y="552" fill="${t.muted}" font-size="10" letter-spacing=".6">PTS ${POINTS.length} · FS/SERPENTINE</text>` +
  `</g>` +
  stipple(t) +
  // panel derecho
  `<g font-family="${MONO}">` +
  `<rect x="473" y="88" width="672" height="472" rx="6" fill="${t.panel}" stroke="${t.line}"/>` +
  `<path d="M473 124H1145" stroke="${t.line}"/>` +
  `<text x="487" y="111" font-size="13"><tspan fill="${t.top}" font-weight="700">profile.yml</tspan> <tspan fill="${t.muted}" font-size="11">[YAML]</tspan></text>` +
  `<rect x="1011" y="97" width="120" height="24" rx="12" fill="${t.pill}"/>` +
  `<text x="1071" y="113" text-anchor="middle" fill="${t.pillText}" font-size="12" font-weight="700">@DiegoG29</text>` +
  `</g>` +
  yaml(t) +
  // barra de estado tipo vim
  `<g font-family="${MONO}" font-size="11">` +
  `<path d="M473 524H1145" stroke="${t.line}"/>` +
  `<rect x="485" y="533" width="66" height="18" rx="3" fill="${t.bar}"/>` +
  `<text x="518" y="546" text-anchor="middle" fill="${t.barText}" font-weight="700">NORMAL</text>` +
  `<text x="563" y="546" fill="${t.top}" font-weight="700" font-size="12">profile.yml</text>` +
  `<text x="740" y="546" fill="${t.muted}">[utf-8]</text>` +
  `<text x="1131" y="546" text-anchor="end" fill="${t.muted}">${n}L, ${ymlBytes}B 100% ${n}:1</text>` +
  `</g></svg>\n`;
}

for (const name of Object.keys(themes)) fs.writeFileSync(path.join(out, `banner-${name}.svg`), banner(name));
console.log('points', POINTS.length);
