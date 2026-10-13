// Genera assets/banner-{dark,light}.svg: ventana vim con elefante punteado (dither FS) + profile.yml
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

// ---------- elefante: formas -> escala de grises -> Floyd-Steinberg serpentina ----------
const W = 300, H = 340;

const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rrect = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
// trompa: circulos a lo largo de una bezier cubica, radio decreciente
const bezierTube = (p0, p1, p2, p3, r0, r1) => {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, u = 1 - t;
    const x = u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0];
    const y = u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1];
    pts.push([x, y, r0 + (r1 - r0) * t]);
  }
  return (x, y) => pts.some(([px, py, r]) => (x - px) ** 2 + (y - py) ** 2 <= r * r);
};

// capas en orden z (la ultima queda encima); fill = brillo del relleno
const layers = [
  { f: bezierTube([62, 170], [40, 185], [38, 215], [30, 228], 3, 2), fill: 0.6 },       // cola
  { f: rrect(78, 215, 112, 302, 12), fill: 0.04 },                                    // pata trasera atras
  { f: rrect(168, 215, 202, 302, 12), fill: 0.04 },                                   // pata delantera atras
  { f: ellipse(140, 190, 92, 68), fill: 0.07 },                                       // cuerpo
  { f: rrect(100, 222, 136, 306, 12), fill: 0.07 },                                   // pata trasera
  { f: rrect(188, 222, 224, 306, 12), fill: 0.07 },                                   // pata delantera
  { f: ellipse(222, 140, 52, 50), fill: 0.08 },                                       // cabeza
  { f: bezierTube([248, 160], [278, 195], [262, 250], [282, 272], 17, 8), fill: 0.08 }, // trompa
  { f: ellipse(196, 146, 36, 46), fill: 0.12 },                                       // oreja
  { f: bezierTube([238, 176], [246, 192], [256, 196], [266, 192], 4, 2), fill: 0.95 },  // colmillo
  { f: ellipse(238, 128, 6, 7), fill: 0 },                                          // ojo
];

function grayscale() {
  const top = new Int8Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    for (let i = layers.length - 1; i >= 0; i--) if (layers[i].f(x, y)) { top[y * W + x] = i; break; }

  const g = new Float32Array(W * H);
  const R = 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = top[y * W + x];
    if (k < 0) continue;
    // borde: algun vecino cercano pertenece a una capa inferior (o a ninguna)
    let edge = false;
    for (let dy = -R; dy <= R && !edge; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const nx = x + dx, ny = y + dy;
      const n = nx < 0 || ny < 0 || nx >= W || ny >= H ? -1 : top[ny * W + nx];
      if (n < k) { edge = true; break; }
    }
    // sombreado suave: mas luz arriba a la izquierda
    const shade = 0.05 * (1 - y / H) + 0.03 * (1 - x / W);
    g[y * W + x] = edge ? 0.6 : Math.min(1, layers[k].fill + shade);
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
  `<desc id="desc">Perfil en terminal tipo vim con un elefante punteado y profile.yml.</desc>` +
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
