// Genera un radar SVG (oscuro y claro) desde un JSON { title, axes: [{ label, value 0-100 }] }
// Uso: node scripts/radar.js assets/skills.json assets/radar
//      -> assets/radar-dark.svg y assets/radar-light.svg
const fs = require('fs');
const [, , dataFile, outPrefix] = process.argv;
if (!dataFile || !outPrefix) { console.error('uso: node scripts/radar.js <data.json> <salida>'); process.exit(1); }

const themes = {
  dark: { grid: '#30363D', spoke: '#21262D', label: '#C9D1D9', value: '#8B949E', title: '#E6EDF3', accent: '#3FB950' },
  light: { grid: '#D0D7DE', spoke: '#E6EAEF', label: '#1F2328', value: '#57606A', title: '#1F2328', accent: '#1A7F37' },
};

const { title, axes } = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const W = 620, H = 480, cx = W / 2, cy = H / 2 + 14, R = 150, n = axes.length;
const pt = (i, r) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const poly = r => axes.map((_, i) => pt(i, r).map(v => v.toFixed(1)).join(',')).join(' ');

function render(t) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">`;
  s += `<text x="${cx}" y="34" text-anchor="middle" font-family="${font}" font-size="15" font-weight="700" fill="${t.title}">${esc(title)}</text>`;
  for (let k = 1; k <= 4; k++) s += `<polygon points="${poly((R * k) / 4)}" fill="none" stroke="${t.grid}"/>`;
  axes.forEach((_, i) => { const [x, y] = pt(i, R); s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${t.spoke}"/>`; });

  // poligono con coordenadas relativas al centro
  const rel = (i, v) => pt(i, (R * v) / 100).map((c, j) => (c - (j ? cy : cx)).toFixed(1));
  s += `<g transform="translate(${cx} ${cy})"><g>`;
  s += `<polygon points="${axes.map((a, i) => rel(i, a.value).join(",")).join(" ")}" fill="${t.accent}" fill-opacity=".18" stroke="${t.accent}" stroke-width="2.5" stroke-linejoin="round"/>`;
  axes.forEach((a, i) => { const [x, y] = rel(i, a.value); s += `<circle cx="${x}" cy="${y}" r="4.5" fill="${t.accent}"/>`; });
  s += `</g></g>`;

  axes.forEach((a, i) => {
    const [x, y] = pt(i, R + 26);
    const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
    const dy = y < cy - R / 2 ? -6 : 4;
    s += `<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}" font-family="${font}" font-size="12">` +
         `<tspan fill="${t.label}" font-weight="600">${esc(a.label)}</tspan>` +
         `<tspan x="${x.toFixed(1)}" dy="15" fill="${t.value}" font-size="11">${a.value}</tspan></text>`;
  });
  return s + `</svg>\n`;
}

for (const name of Object.keys(themes)) fs.writeFileSync(`${outPrefix}-${name}.svg`, render(themes[name]));
console.log('ok', outPrefix);
