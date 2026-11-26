// Prepara le texture e il layout usati dal renderer 3D.
// Ingresso: le tre immagini complete + config/zona-giorno.json + maschere SVG del pacchetto.
// Uscita: assets/tex/*.png e assets/layout.json
// Uso: node tools/prepara-asset.mjs
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { load, W, H, lum } from './lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const PKG = path.resolve(ROOT, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/zona-giorno.json'), 'utf8'));
const OUT = path.join(ROOT, 'assets/tex');
fs.mkdirSync(OUT, { recursive: true });
const N = W * H;
const { f, cx, cy, altezza: CAMH } = cfg.camera;

// ---------- utilità ----------
async function svgMask(inner) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="black"/>${inner}</svg>`;
  const { data } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true });
  const m = new Float32Array(N); for (let i = 0; i < N; i++) m[i] = data[i] / 255; return m;
}
const polySvg = (p, fill = 'white') => `<polygon fill="${fill}" points="${p.map(q => q.join(',')).join(' ')}"/>`;
function boxBlur(a, r) {
  if (r < 1) return a.slice();
  const t = new Float32Array(N), o = new Float32Array(N), k = 2 * r + 1;
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) { t[y * W + x] = s / k; s += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) { o[y * W + x] = s / k; s += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x]; } }
  return o;
}
const blur = (a, r) => boxBlur(boxBlur(boxBlur(a, r), r), r); // ~gaussiana
function erode(a, r) { const b = boxBlur(a, r); const o = new Float32Array(N); for (let i = 0; i < N; i++) o[i] = b[i] > 0.998 ? 1 : 0; return o; }
function dilate(a, r) { const b = boxBlur(a, r); const o = new Float32Array(N); for (let i = 0; i < N; i++) o[i] = b[i] > 0.002 ? 1 : 0; return o; }
const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
async function savePng(name, chans) { // chans: array di Float32Array (1..4 canali)
  const c = chans.length, b = Buffer.alloc(N * c);
  for (let i = 0; i < N; i++) for (let k = 0; k < c; k++) b[i * c + k] = Math.max(0, Math.min(255, Math.round(chans[k][i] * 255)));
  await sharp(b, { raw: { width: W, height: H, channels: c } }).png({ compressionLevel: 6 }).toFile(path.join(OUT, name));
}
async function saveRgb(name, A) { const b = Buffer.alloc(N * 3); for (let i = 0; i < N * 3; i++) b[i] = Math.max(0, Math.min(255, Math.round(A[i] * 255)));
  await sharp(b, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 6 }).toFile(path.join(OUT, name)); }

// ---------- immagini ----------
const RAW = await load(path.join(PKG, '01-immagini-complete/01-grezzo.png'));
const CLEAN = await load(path.join(PKG, '01-immagini-complete/02-finiture-senza-arredi.png'));
const FINAL = await load(path.join(PKG, '01-immagini-complete/03-zona-giorno-finale.png'));
const D0 = new Float32Array(N);
for (let i = 0; i < N; i++) { let s = 0; for (let c = 0; c < 3; c++) s += Math.abs(FINAL[i * 3 + c] - CLEAN[i * 3 + c]); D0[i] = s; }
const D = boxBlur(D0, 1), Ds = blur(D0, 2);

// ---------- regioni architettoniche ----------
const svgTxt = n => fs.readFileSync(path.join(PKG, '03-maschere-svg', n), 'utf8').replace(/<\/?svg[^>]*>/g, '');
const walls = [];
for (let k = 1; k <= 4; k++) walls.push(await svgMask(svgTxt(`parete-${k}.svg`)));
const floor = await svgMask(svgTxt('area-pavimento.svg'));
const fh = cfg.stanza.focolare, pe = cfg.stanza.petto;
const vHearthFront = cy + f * (CAMH) / fh.fronte; // base del focolare
const vHearthTop = cy + f * (CAMH - fh.altezza) / fh.fronte;
const chimney = await svgMask(`<rect x="${pe.u0}" y="${pe.v0}" width="${pe.u1 - pe.u0}" height="${pe.v1 - pe.v0}" fill="white"/><rect x="${fh.u0}" y="${vHearthTop - 15}" width="${fh.u1 - fh.u0}" height="${vHearthFront - vHearthTop + 15}" fill="white"/>`);
const firebox = await svgMask(`<rect x="537" y="531" width="526" height="104" fill="white"/>`);
const fireRoi = blur(await svgMask(`<rect x="530" y="526" width="540" height="128" fill="white"/>`), 4);

// ---------- arredi: mascherine ----------
const objs = cfg.arredi;
const polyMask = {};
for (const o of objs) {
  let inner = '';
  if (o.poligono) inner += polySvg(o.poligono);
  if (o.linea) inner += `<polyline fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="${o.spessoreLinea * 2}" points="${o.linea.map(q => q.join(',')).join(' ')}"/>`;
  if (o.ellisse) inner += `<ellipse fill="white" cx="${o.ellisse[0]}" cy="${o.ellisse[1]}" rx="${o.ellisse[2]}" ry="${o.ellisse[3]}"/>`;
  polyMask[o.id] = await svgMask(inner);
}
const matte = {};
for (const o of objs) {
  const pm = polyMask[o.id]; const m = new Float32Array(N);
  const edge = !o.linea && !o.rifinitura; // contorno disegnato a mano: allargato di 4 px e poi ripulito con la differenza 03/02
  const grow = edge ? dilate(pm, 4) : pm;
  const behind = new Float32Array(N); // contorni degli arredi che stanno dietro a questo (es. la pianta dietro la poltrona)
  for (const p of objs) if ((p.sottrai || []).includes(o.id)) { const q = polyMask[p.id]; for (let i = 0; i < N; i++) behind[i] = Math.max(behind[i], q[i]); }
  for (let i = 0; i < N; i++) {
    let a = grow[i];
    if (o.rifinitura === 'differenza') a *= ss(0.05, 0.15, D[i]);
    if (o.rifinitura === 'verde') { // solo foglie e steli: verde netto oppure molto più scuro della parete senza arredi
      const r = FINAL[i * 3], g = FINAL[i * 3 + 1], bb = FINAL[i * 3 + 2];
      const green = ss(0.006, 0.035, g - Math.max(r, bb)), dark = ss(0.10, 0.22, lum(CLEAN, i) - lum(FINAL, i));
      a *= Math.max(green, dark);
    }
    if (o.escludiVerde) { const r = FINAL[i * 3], g = FINAL[i * 3 + 1], bb = FINAL[i * 3 + 2]; a *= 1 - ss(0.0, 0.04, g - Math.max(r, bb));
      // foglie in ombra dentro il contorno della pianta: scure rispetto alla parete senza arredi
      if (behind[i] > 0) a *= 1 - behind[i] * ss(0.10, 0.22, lum(CLEAN, i) - lum(FINAL, i)); }
    m[i] = a;
  }
  if (o.linea) { // il gambo sottile: margine stretto ripulito con la differenza, nucleo pieno
    const core = await svgMask(`<polyline fill="none" stroke="white" stroke-width="3.5" points="${o.linea.map(q => q.join(',')).join(' ')}"/>`);
    for (let i = 0; i < N; i++) {
      const inLine = pm[i] > 0;
      if (inLine) m[i] = Math.max(core[i], pm[i] * ss(0.035, 0.09, D[i]));
    }
    // il cappello e la base restano pieni
    const solid = await svgMask(polySvg(o.poligono) + `<ellipse fill="white" cx="${o.ellisse[0]}" cy="${o.ellisse[1]}" rx="${o.ellisse[2]}" ry="${o.ellisse[3]}"/>`);
    for (let i = 0; i < N; i++) m[i] = Math.max(m[i], solid[i]);
  }
  if (edge) {
    const core = erode(pm, 7);
    for (let i = 0; i < N; i++) if (grow[i] > 0 && core[i] < 1) m[i] *= Math.max(core[i], ss(0.06, 0.14, Ds[i])); // differenza ammorbidita: bordo continuo, senza puntini
    // il bordo non prende pixel dentro il contorno di un arredo (a contorno) che sta dietro: quei pixel restano a lui (es. seduta della poltrona sopra il pouf)
    const behindEdge = new Float32Array(N);
    for (const p of objs) if (!p.linea && !p.rifinitura && (p.sottrai || []).includes(o.id)) { const q = polyMask[p.id]; for (let i = 0; i < N; i++) behindEdge[i] = Math.max(behindEdge[i], q[i]); }
    for (let i = 0; i < N; i++) if (core[i] < 1 && behindEdge[i] > 0 && pm[i] < 0.5) m[i] *= 1 - behindEdge[i];
    // dentro il contorno di un arredo che sta dietro (la pianta), via anche le foglie appena più scure o verdi
    if (o.escludiVerde) for (let i = 0; i < N; i++) if (behind[i] > 0) {
      const r = FINAL[i * 3], g = FINAL[i * 3 + 1], bb = FINAL[i * 3 + 2];
      m[i] *= 1 - behind[i] * Math.max(ss(0.03, 0.09, lum(CLEAN, i) - lum(FINAL, i)), ss(-0.01, 0.02, g - Math.max(r, bb)));
    }
  }
  matte[o.id] = m;
}
// un arredo davanti all'altro: si toglie la mascherina effettiva di quello davanti (a riposo le due si completano senza fessure)
const matte0 = Object.fromEntries(objs.map(o => [o.id, matte[o.id].slice()]));
for (const o of objs) for (const s of (o.sottrai || [])) { const m = matte[o.id], q = matte0[s]; for (let i = 0; i < N; i++) m[i] *= 1 - q[i]; }
// "completa": la parte di un arredo coperta da quello davanti (es. la base della poltrona dietro il pouf) viene ricostruita
// specchiando verso il basso la fascia visibile appena sopra. A riposo resta coperta; in movimento non lascia buchi.
const ARR = FINAL.slice();
for (const o of objs) if (o.completa) {
  const pm = polyMask[o.id], m = matte[o.id], m0 = matte0[o.id];
  const hid = new Float32Array(N);
  for (const sId of o.sottrai || []) { const q = matte0[sId]; for (let i = 0; i < N; i++) if (pm[i] > 0.5 && q[i] > 0.5) hid[i] = 1; }
  for (let x = 0; x < W; x++) {
    let yb = -1; for (let y = 0; y < H; y++) if (hid[y * W + x]) { yb = y; break; }
    if (yb < 0) continue;
    for (let y = yb; y < H && hid[y * W + x]; y++) {
      const ys = 2 * yb - 1 - y; if (ys < 0) break;
      const i = y * W + x, j = ys * W + x;
      for (let c = 0; c < 3; c++) ARR[i * 3 + c] = FINAL[j * 3 + c];
      m[i] = Math.max(m[i], m0[j]);
    }
  }
}

// ---------- zona d'influenza (ombre, riflessi) e fondo "finito senza arredi" ----------
// base: sagome complete (anche le parti scartate dalla rifinitura, es. bordi delle foglie)
const union = new Float32Array(N); for (const o of objs) { const m = polyMask[o.id]; for (let i = 0; i < N; i++) union[i] = Math.max(union[i], m[i]); }
const near = dilate(union, 150), ring = dilate(union, 22);
const infl = new Float32Array(N);
for (let i = 0; i < N; i++) infl[i] = Math.max(ring[i], near[i] * (D[i] > 0.055 ? 1 : 0));
const inflS = blur(dilate(boxBlur(infl, 4).map(v => v > 0.3 ? 1 : 0), 14), 22); // bordo molto morbido: nessuna cucitura visibile
const M = new Float32Array(N); for (let i = 0; i < N; i++) M[i] = Math.max(inflS[i], fireRoi[i]);
// differenza tonale media fra 03 e 02 fuori dalle zone degli arredi
const off = [0, 0, 0]; let cnt = 0;
for (let i = 0; i < N; i++) if (M[i] < 0.01 && floor[i] + walls[1][i] + walls[2][i] > 0.5) { for (let c = 0; c < 3; c++) off[c] += FINAL[i * 3 + c] - CLEAN[i * 3 + c]; cnt++; }
for (let c = 0; c < 3; c++) off[c] /= cnt;
console.log('scarto tonale 03-02', off.map(v => (v * 255).toFixed(2)));
const FIN = new Float32Array(N * 3);
// pavimento: sempre dall'immagine senza arredi (le ombre e la luce del sole finali arrivano con gli arredi e l'atmosfera)
const floorS = blur(floor, 2);
for (let i = 0; i < N; i++) { const w = Math.max(M[i], floorS[i]); for (let c = 0; c < 3; c++) FIN[i * 3 + c] = FINAL[i * 3 + c] * (1 - w) + (CLEAN[i * 3 + c] + off[c]) * w; }

// zona d'influenza di ciascun arredo: sfumatura morbida attorno alla sua sagoma (nessuna partizione a bordi netti)
const roi = {};
for (const o of objs) { const pr = blur(matte[o.id], 26); roi[o.id] = pr.map(v => ss(0.02, 0.30, v)); }
// dove il fuoco e un arredo si sovrappongono, vince l'arredo
const fireOnly = new Float32Array(N); for (let i = 0; i < N; i++) fireOnly[i] = fireRoi[i] * (1 - inflS[i]);

// ---------- scrittura texture ----------
await saveRgb('grezzo.png', RAW);
await saveRgb('finito.png', FIN);
await saveRgb('finale.png', FINAL);
await saveRgb('arredi.png', ARR); // immagine finale con le parti nascoste degli arredi completate
const wallId = new Float32Array(N); for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) if (walls[k][i] > 0.5) wallId[i] = (k + 1) / 4;
await savePng('regioni.png', [wallId, floor, chimney, firebox]);
const pad = new Float32Array(N);
const ch = k => (objs[k] ? matte[objs[k].id] : pad), rk = k => (objs[k] ? roi[objs[k].id] : pad);
// 3 arredi per immagine, solo RGB: il canale alfa dei PNG non arriva affidabile alla GPU
if (objs.length > 9) throw new Error('massimo 9 arredi');
for (const [s, n] of [['a', 0], ['b', 3], ['c', 6]]) {
  await savePng(`mascherine-${s}.png`, [ch(n), ch(n + 1), ch(n + 2)]);
  await savePng(`influenza-${s}.png`, [rk(n), rk(n + 1), rk(n + 2)]);
}
await savePng('fuoco.png', [fireOnly]);
// ombre degli arredi come rapporto di luminosità a bassa frequenza (03 / finito), solo scurimento (<= 1):
// la sfocatura esclude i pixel degli arredi, così la loro luminosità non si spande attorno (niente aloni);
// le differenze di luce del sole fra 02 e 03 arrivano solo con l'atmosfera finale
const U = new Float32Array(N); for (const o of objs) { const m = polyMask[o.id]; for (let i = 0; i < N; i++) U[i] = Math.max(U[i], m[i]); }
const free = dilate(U, 3).map(v => 1 - v);
const lF = new Float32Array(N), lC = new Float32Array(N);
for (let i = 0; i < N; i++) { lF[i] = lum(FINAL, i) * free[i]; lC[i] = lum(FIN, i) * free[i]; }
const bF = blur(lF, 9), bC = blur(lC, 9), bW = blur(free, 9); const shade = new Float32Array(N);
for (let i = 0; i < N; i++) shade[i] = bW[i] < 0.05 ? 1 : Math.min(1, Math.max(0.3, bF[i] / Math.max(0.02, bC[i])));
await savePng('ombre.png', [shade, shade, shade]);

// ---------- profili di profondità degli arredi ----------
const layout = { arredi: [], lastre: [] };
for (const o of objs) {
  const m = matte[o.id]; let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x] > 0.02) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bbox = [Math.max(0, x0 - 4), Math.max(0, y0 - 4), Math.min(W - 1, x1 + 4), Math.min(H - 1, y1 + 4)];
  const cols = 24, zs = [];
  for (let c = 0; c <= cols; c++) {
    const u0 = Math.round(bbox[0] + (bbox[2] - bbox[0]) * (c - 0.5) / cols), u1 = Math.round(bbox[0] + (bbox[2] - bbox[0]) * (c + 0.5) / cols);
    let vb = -1; for (let u = Math.max(bbox[0], u0); u <= Math.min(bbox[2], u1); u++) for (let v = bbox[3]; v >= bbox[1]; v--) if (m[v * W + u] > 0.5) { if (v > vb) vb = v; break; }
    let z = null;
    if (o.profondita.modo === 'pavimento' && vb > cy + 5) z = f * CAMH / (vb - cy);
    if (o.profondita.modo === 'focolare' && vb > cy + 5) z = f * (CAMH - fh.altezza) / (vb - cy);
    if (o.profondita.modo === 'costante') z = o.profondita.z;
    zs.push(z);
  }
  // riempie i buchi e smussa (mediana su 5)
  const valid = zs.filter(v => v != null); const fill = valid.length ? valid.reduce((a, b) => a + b) / valid.length : 6;
  const z1 = zs.map(v => v ?? fill);
  const z2 = z1.map((_, i) => { const w = z1.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b); return w[w.length >> 1]; });
  layout.arredi.push({ id: o.id, bbox, profilo: z2.map(v => +v.toFixed(3)) });
}

// ---------- lastre del pavimento: righe e giunti rilevati sull'immagine finita ----------
const Lf = new Float32Array(N); for (let i = 0; i < N; i++) Lf[i] = lum(FIN, i);
const samp = (x, y) => { if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) return NaN; const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * W + x0; return Lf[i] * (1 - fx) * (1 - fy) + Lf[i + 1] * fx * (1 - fy) + Lf[i + W] * (1 - fx) * fy + Lf[i + W + 1] * fx * fy; };
const rowV = [718, 754, 775, 799, 825, 865, 902, 943, 1040];
const Zof = v => f * CAMH / (v - cy), Xof = (u, Z) => (u - cx) * Z / f;
const XL = cfg.stanza.xSinistra, XR = cfg.stanza.xDestra;
for (let r = 0; r < rowV.length - 1; r++) {
  const va = rowV[r], vb = rowV[r + 1], vm = (va + Math.min(vb, H - 2)) / 2;
  const Za = Zof(va), Zb = Zof(vb), Zm = Zof(vm);
  // profilo lungo la riga (media lungo i raggi dal punto di fuga, entro la fascia)
  const prof = [];
  for (let u = 0; u < W; u++) { let s = 0, n = 0; for (let y = va + 4; y <= Math.min(vb, H - 1) - 4; y += 1) { const x = cx + (u - cx) * (y - cy) / (vm - cy); const val = samp(x, y); if (!isNaN(val)) { s += val; n++; } } prof.push(n ? s / n : NaN); }
  const sm = prof.map((_, i) => { let s = 0, n = 0; for (let k = -1; k <= 1; k++) { const v = prof[i + k]; if (v != null && !isNaN(v)) { s += v; n++; } } return n ? s / n : NaN; });
  // minimi con contrasto: candidati giunto (in coordinate X mondo alla profondità media)
  const minLen = 0.42, maxLen = 1.05; const cand = [];
  const pxR = Math.max(3, Math.round(0.08 * f / Zm));
  for (let i = pxR; i < W - pxR; i++) {
    const v = sm[i]; if (isNaN(v)) continue; let isMin = true;
    for (let k = -pxR; k <= pxR; k++) if (k && sm[i + k] < v) { isMin = false; break; }
    if (!isMin) continue; const ctx = (sm[i - pxR] + sm[i + pxR]) / 2;
    if (ctx - v > 0.012) cand.push({ X: Xof(i, Zm), c: ctx - v });
  }
  cand.sort((a, b) => b.c - a.c);
  const joints = [];
  for (const c of cand) if (joints.every(j => Math.abs(j - c.X) >= minLen)) joints.push(c.X);
  joints.push(XL, XR); joints.sort((a, b) => a - b);
  const xs = [joints[0]];
  for (let k = 1; k < joints.length; k++) { const a = xs[xs.length - 1], b = joints[k]; if (b - a < 0.15) continue; const n = Math.ceil((b - a) / maxLen); for (let s = 1; s <= n; s++) xs.push(a + (b - a) * s / n); }
  for (let k = 0; k < xs.length - 1; k++) {
    const x0 = Math.max(XL, xs[k]), x1 = Math.min(XR, xs[k + 1]); if (x1 - x0 < 0.05) continue;
    // scarta lastre completamente nascoste dal focolare o fuori quadro
    const zNear = Zb, zFar = Za; const uL = cx + f * x0 / zNear, uR = cx + f * x1 / zNear, uLf = cx + f * x0 / zFar, uRf = cx + f * x1 / zFar;
    if (Math.max(uR, uRf) < -40 || Math.min(uL, uLf) > W + 40) continue;
    layout.lastre.push({ riga: r, x0: +x0.toFixed(4), x1: +x1.toFixed(4), z0: +(-zFar).toFixed(4), z1: +(-zNear).toFixed(4) });
  }
}
console.log('lastre', layout.lastre.length);
layout.scartoTonale = off;
fs.writeFileSync(path.join(ROOT, 'assets/layout.json'), JSON.stringify(layout, null, 1));

// anteprima di controllo: lastre e mascherine sopra l'immagine finita
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
const P = (X, Z) => [cx + f * X / -Z, cy + f * CAMH / -Z];
for (const t of layout.lastre) { const q = [P(t.x0, t.z0), P(t.x1, t.z0), P(t.x1, t.z1), P(t.x0, t.z1)]; svg += `<polygon points="${q.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#ff0060" stroke-width="1"/>`; }
svg += '</svg>';
const ov = Buffer.alloc(N * 4);
const colors = [[255, 0, 0], [0, 0, 255], [255, 0, 255], [0, 200, 255], [0, 255, 0], [255, 255, 0], [0, 255, 255], [255, 128, 0]];
for (let i = 0; i < N; i++) { let r = 0, g = 0, b = 0, a = 0; objs.forEach((o, k) => { const m = matte[o.id][i]; if (m > a) { a = m; [r, g, b] = colors[k]; } }); ov[i * 4] = r; ov[i * 4 + 1] = g; ov[i * 4 + 2] = b; ov[i * 4 + 3] = Math.round(a * 110 + M[i] * 40); }
const ovPng = await sharp(ov, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
await sharp(path.join(OUT, 'finale.png')).composite([{ input: ovPng }, { input: Buffer.from(svg) }]).toFile(path.join(ROOT, 'work/controllo-layout.png'));
console.log('fatto');
