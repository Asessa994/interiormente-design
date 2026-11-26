// Registra il filmato continuo della trasformazione dal renderer 3D (stessa scena di renderer.html).
//   node tools/registra-video.mjs                 -> assets/video/zona-giorno.mp4 (+ versione leggera e poster)
//   node tools/registra-video.mjs --foto 0,3,6,12 -> solo fotogrammi PNG di controllo in work/foto
// Requisiti: Google Chrome installato (o CHROME=percorso), dipendenze npm del progetto.
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/zona-giorno.json'), 'utf8'));
const args = process.argv.slice(2);
const fotoArg = args.includes('--foto') ? args[args.indexOf('--foto') + 1] : null;
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));

// server statico temporaneo
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/renderer.html`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1586, height: 992 });
page.on('console', m => { if (m.type() === 'error') console.error('[pagina]', m.text()); });
await page.goto(url);
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
const grab = async t => {
  const b64 = await page.evaluate(time => { window.renderAt(time); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);
  return Buffer.from(b64, 'base64');
};

if (fotoArg) {
  const out = path.join(ROOT, 'work/foto'); fs.mkdirSync(out, { recursive: true });
  for (const t of fotoArg.split(',').map(Number)) { fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(5, '0')}.png`), await grab(t)); console.log('foto', t); }
} else {
  const outDir = path.join(ROOT, 'assets/video'); fs.mkdirSync(outDir, { recursive: true });
  const fps = cfg.video.fps, n = Math.round(cfg.durata * fps) + 1;
  // codifica principale: ogni fotogramma è chiave (-g 1) per scorrere avanti e indietro senza scatti
  const enc = (file, extra) => spawn(ffmpegPath, ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    ...extra, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-loglevel', 'error', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const full = enc(path.join(outDir, 'zona-giorno.mp4'), ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(cfg.video.crf), '-g', String(cfg.video.gop), '-bf', '0', '-tune', 'film']);
  const lite = enc(path.join(outDir, 'zona-giorno-mobile.mp4'), ['-vf', 'scale=1024:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-g', '1']);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = Math.min(cfg.durata, i / fps);
    const png = await grab(t);
    if (i === 0) fs.writeFileSync(path.join(outDir, 'poster.png'), png);
    if (i === n - 1) fs.writeFileSync(path.join(outDir, 'ultimo.png'), png);
    full.stdin.write(png); lite.stdin.write(png);
    // attende entrambi i codificatori (controllando lo stato attuale, per non perdere un evento 'drain' già emesso)
    await Promise.all([full, lite].map(p => p.stdin.writableNeedDrain ? new Promise(r => p.stdin.once('drain', r)) : null));
    if (i % 60 === 0) console.log(`fotogramma ${i}/${n - 1}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  full.stdin.end(); lite.stdin.end();
  await Promise.all([full, lite].map(p => new Promise(r => p.on('close', r))));
  for (const f of ['zona-giorno.mp4', 'zona-giorno-mobile.mp4']) console.log(f, (fs.statSync(path.join(outDir, f)).size / 1e6).toFixed(1), 'MB');
}
await browser.close(); server.close();
