// Interiormente Design — Zona Giorno
// Renderer 3D a camera fissa: la stanza è ricostruita con la prospettiva delle foto (camera tarata),
// le superfici e gli arredi sono geometrie animate su cui le immagini vengono proiettate dal punto di vista
// della camera (proiezione dalla posa di riposo). La funzione renderAt(t) produce il fotogramma al tempo t:
// lo stesso codice serve per l'anteprima dal vivo e per registrare il filmato (tools/registra-video.mjs).
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

// ---------------------------------------------------------------- utilità temporali
const clamp01 = x => Math.min(1, Math.max(0, x));
const lin = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = x => x * x * (3 - 2 * x);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// pseudo-casuale deterministico (stesso filmato a ogni registrazione)
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- GLSL condiviso
const GLSL_COMMON = /* glsl */`
uniform sampler2D tRaw, tFin, tFinal, tArr, tReg, tMatA, tMatB, tMatC, tRoiA, tRoiB, tRoiC, tFire, tShade; // mascherine: 3 arredi per immagine RGB (senza alfa)
uniform vec4 uCam;      // f, cx, cy, altezza camera
uniform vec2 uCanvas;   // 1586, 992
uniform vec3 uShadowA, uShadowB, uShadowC; // comparsa ombre/influenze degli arredi (0..1)
uniform float uGlow, uAtmos;
vec2 projUV(vec3 p) {   // p in coordinate mondo
  vec3 c = p - vec3(0.0, uCam.w, 0.0);
  float z = max(-c.z, 1e-3);
  return vec2(uCam.y + uCam.x * c.x / z, uCam.z - uCam.x * c.y / z) / uCanvas;
}
float max3(vec3 v) { return max(max(v.x, v.y), v.z); }
// colore "finito": finiture senza arredi, che diventa l'immagine finale dove arrivano ombre/arredi/fuoco
vec3 finished(vec2 uv) {
  vec3 fin = texture2D(tFin, uv).rgb;
  vec3 fnl = texture2D(tFinal, uv).rgb;
  vec3 ma = texture2D(tMatA, uv).rgb, mb = texture2D(tMatB, uv).rgb, mc = texture2D(tMatC, uv).rgb;
  vec3 ra = texture2D(tRoiA, uv).rgb, rb = texture2D(tRoiB, uv).rgb, rc = texture2D(tRoiC, uv).rgb;
  // ombre degli arredi: solo luminosità (stessa grana e stesse fughe del pavimento posato)
  float w = max(max3(uShadowA * ra * (1.0 - ma)), max(max3(uShadowB * rb * (1.0 - mb)), max3(uShadowC * rc * (1.0 - mc))));
  fin *= mix(1.0, texture2D(tShade, uv).r, w);
  float g = max(uGlow * texture2D(tFire, uv).r, uAtmos);
  return mix(fin, fnl, g);
}
`;

// materiale per le geometrie con immagine proiettata (lastre, rivestimenti, rotoli)
const PROJ_VERT = /* glsl */`
uniform vec4 uUvPlane; // asse (0=x,1=y,2=z), valore, attivo
varying vec3 vRest;
varying vec3 vN;
void main() {
  vec3 r = position;
  if (uUvPlane.z > 0.5) {
    if (uUvPlane.x < 0.5) r.x = uUvPlane.y; else if (uUvPlane.x < 1.5) r.y = uUvPlane.y; else r.z = uUvPlane.y;
  }
  vRest = r;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;
const PROJ_FRAG = /* glsl */`
${GLSL_COMMON}
uniform float uOpacity, uKind; // 0 lastra/rivestimento, 1 rotolo di carta
uniform float uMove;          // 1 in movimento, 0 a riposo (a riposo nessuna ombreggiatura: pixel identici all'immagine)
uniform vec3 uFaceN;          // normale della faccia "a vista" a riposo (per i rotoli: asse del rotolo)
varying vec3 vRest;
varying vec3 vN;
void main() {
  vec2 uv = clamp(projUV(vRest), vec2(0.0005), vec2(0.9995));
  vec3 col = finished(uv);
  vec3 L = normalize(vec3(0.55, 0.45, 0.70)); // luce diurna dalla finestra a destra
  if (uKind > 0.5) {
    vec3 n = normalize(vN);
    float cap = abs(dot(n, uFaceN));
    float d = max(dot(n, L), 0.0);
    col *= 0.72 + 0.40 * d;
    // testate del rotolo: spirale di carta più chiara con anelli sottili
    if (cap > 0.9) col = mix(col, vec3(0.93, 0.89, 0.82) * (0.86 + 0.08 * sin(length(vRest) * 900.0)), 0.85);
  } else {
    float facing = dot(normalize(vN), uFaceN);
    // faccia principale: leggera variazione con l'inclinazione; bordi: pietra in ombra
    float tilt = 1.0 - 0.9 * (1.0 - facing);
    float side = 0.66 + 0.14 * max(dot(normalize(vN), L), 0.0);
    col *= mix(1.0, (facing > 0.92) ? tilt : side, uMove);
  }
  gl_FragColor = vec4(col, uOpacity);
}`;

// arredi: superfici in rilievo / primitive, texture dell'immagine finale con la mascherina dell'oggetto
const OBJ_VERT = /* glsl */`
varying vec3 vRest;
void main() {
  vRest = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;
const OBJ_FRAG = /* glsl */`
${GLSL_COMMON}
uniform vec3 uSel; uniform float uSet; // immagine e canale della mascherina
uniform float uOpacity, uComplete; // uComplete: usa l'immagine con le parti nascoste completate
varying vec3 vRest;
void main() {
  vec2 uv = projUV(vRest);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
  vec3 m = uSet < 0.5 ? texture2D(tMatA, uv).rgb : (uSet < 1.5 ? texture2D(tMatB, uv).rgb : texture2D(tMatC, uv).rgb);
  float a = dot(m, uSel) * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4((uComplete > 0.5 ? texture2D(tArr, uv) : texture2D(tFinal, uv)).rgb, a);
}`;

// ombra morbida (oggetti sospesi): ellisse sfumata a moltiplicazione
const SHADOW_FRAG = /* glsl */`
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = dot(p, p);
  float a = uOpacity * exp(-3.2 * d) * (1.0 - smoothstep(0.75, 1.0, d));
  gl_FragColor = vec4(vec3(1.0 - a), 1.0);
}`;
const SHADOW_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`;

// sfondo a schermo intero: grezzo -> carta (per teli) / soffitto / vano fuoco / fiamme
const BASE_FRAG = /* glsl */`
${GLSL_COMMON}
#define NS 16
uniform vec4 uRoom;   // profondità parete, xSx, xDx, altezza cornice
uniform float uStripWall[NS], uStripS0[NS], uStripS1[NS], uStripY[NS], uStripA[NS];
uniform float uCeil, uFirebox, uFloorFill, uFireSweep, uFlick, uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 uv = vUv;
  vec2 px = uv * uCanvas;
  vec4 reg = texture2D(tReg, uv);
  vec3 raw = texture2D(tRaw, uv).rgb;
  vec3 col = raw;
  float wallId = floor(reg.r * 4.0 + 0.5);
  float f = uCam.x, cx = uCam.y, cy = uCam.z, h = uCam.w;
  if (wallId > 0.5) {
    // coordinate sulla parete: s lungo la parete, y altezza (metri)
    float s, y;
    if (wallId < 1.5) { float zd = f * uRoom.y / (px.x - cx); s = zd; y = h + (cy - px.y) * zd / f; }
    else if (wallId > 3.5) { float zd = f * uRoom.z / (px.x - cx); s = zd; y = h + (cy - px.y) * zd / f; }
    else { s = (px.x - cx) * uRoom.x / f; y = h + (cy - px.y) * uRoom.x / f; }
    float wid = (wallId < 1.5) ? 1.0 : (wallId > 3.5 ? 4.0 : 2.0);
    for (int i = 0; i < NS; i++) {
      if (abs(uStripWall[i] - wid) < 0.5 && s >= uStripS0[i] && s < uStripS1[i]) {
        float yr = uStripY[i];
        vec3 fin = finished(uv);
        if (y > yr) {
          // carta appena posata: leggero rigonfiamento che si appiattisce sopra il rotolo
          float d = y - yr;
          float bulge = uStripA[i] * (0.07 * exp(-d / 0.035) * sin(min(d / 0.05, 3.1416)) - 0.05 * exp(-d / 0.012));
          col = fin * (1.0 + bulge);
        } else {
          // ombra di contatto del rotolo sul muro grezzo
          float d = yr - y;
          col = raw * (1.0 - uStripA[i] * 0.32 * exp(-d / 0.05));
        }
      }
    }
  } else if (reg.g > 0.5) {
    // pavimento: massetto grezzo; le lastre sono geometrie. I bordi non coperti si completano a fine posa
    col = mix(raw, finished(uv), uFloorFill);
  } else if (reg.b > 0.5) {
    // petto e focolare in cemento: il travertino arriva con le lastre (geometrie)
    col = mix(raw, finished(uv), uFirebox);
  } else if (reg.a > 0.5) {
    // vano del fuoco: pannello brunito che si pulisce con il rivestimento
    vec3 fin = finished(uv);
    col = mix(raw, fin, uFirebox);
  } else {
    // soffitto, cornici, serramento: finitura progressiva dal fondo verso la camera
    float sp = clamp(length((uv - vec2(0.49, 0.12)) * vec2(1.0, 1.4)) / 0.75, 0.0, 1.0);
    float k = smoothstep(0.0, 1.0, clamp(uCeil * 1.6 - sp * 0.6, 0.0, 1.0));
    col = mix(raw, finished(uv), k);
  }
  // fiamme: accensione da sinistra a destra lungo il bruciatore, tremolio che si stabilizza
  if (reg.a > 0.5) {
    float fireMask = smoothstep(560.0, 600.0, px.y) * (1.0 - smoothstep(646.0, 652.0, px.y));
    float xn = (px.x - 600.0) / 390.0;
    float ign = uFireSweep > 0.0 ? smoothstep(max(xn, 0.0) - 0.12, max(xn, 0.0), uFireSweep * 1.12 - 0.06) : 0.0;
    if (ign > 0.0) {
      float n = noise(vec2(px.x * 0.06, uTime * 7.0)) - 0.5;
      vec2 duv = uv + vec2(0.0, n * 0.010 * uFlick * fireMask) ;
      vec3 fl = texture2D(tFinal, duv).rgb * (1.0 + 0.10 * uFlick * n * fireMask);
      col = mix(col, fl, ign);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- creazione scena
export async function createScene({ canvas, config, layout, texBase = 'assets/tex/', pixelRatio = 1 }) {
  const C = config, cam = C.camera, room = C.stanza, Wc = C.tela.w, Hc = C.tela.h;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(Wc, Hc, false);
  renderer.sortObjects = true;

  // camera tarata sulla foto: punto principale (cx, cy) e focale f in pixel
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, cam.altezza, 0);
  camera.updateMatrixWorld();
  const N = 0.05, F = 60;
  camera.projectionMatrix.set(
    2 * cam.f / Wc, 0, 1 - 2 * cam.cx / Wc, 0,
    0, 2 * cam.f / Hc, 2 * cam.cy / Hc - 1, 0,
    0, 0, -(F + N) / (F - N), -2 * F * N / (F - N),
    0, 0, -1, 0);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  // texture
  // ImageBitmap senza premoltiplicazione né gestione colore: i pixel arrivano identici ai PNG
  const loader = new THREE.ImageBitmapLoader();
  loader.setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const loadTex = name => new Promise((res, rej) => loader.load(texBase + name, bmp => {
    const t = new THREE.Texture(bmp);
    t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.premultiplyAlpha = false;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; res(t);
  }, undefined, rej));
  const names = ['grezzo', 'finito', 'finale', 'arredi', 'regioni', 'mascherine-a', 'mascherine-b', 'mascherine-c', 'influenza-a', 'influenza-b', 'influenza-c', 'fuoco', 'ombre'];
  const tx = Object.fromEntries(await Promise.all(names.map(async n => [n, await loadTex(n + '.png')])));

  const common = {
    tRaw: { value: tx.grezzo }, tFin: { value: tx.finito }, tFinal: { value: tx.finale }, tArr: { value: tx.arredi }, tReg: { value: tx.regioni },
    tMatA: { value: tx['mascherine-a'] }, tMatB: { value: tx['mascherine-b'] }, tMatC: { value: tx['mascherine-c'] },
    tRoiA: { value: tx['influenza-a'] }, tRoiB: { value: tx['influenza-b'] }, tRoiC: { value: tx['influenza-c'] },
    tFire: { value: tx.fuoco }, tShade: { value: tx.ombre },
    uCam: { value: new THREE.Vector4(cam.f, cam.cx, cam.cy, cam.altezza) }, uCanvas: { value: new THREE.Vector2(Wc, Hc) },
    uShadowA: { value: new THREE.Vector3() }, uShadowB: { value: new THREE.Vector3() }, uShadowC: { value: new THREE.Vector3() }, uGlow: { value: 0 }, uAtmos: { value: 0 },
  };
  const scene = new THREE.Scene();
  const unproject = (u, v, Z) => new THREE.Vector3((u - cam.cx) * Z / cam.f, cam.altezza - (v - cam.cy) * Z / cam.f, -Z);

  // ---------------- sfondo
  const strips = buildStrips(C);
  const NS = 16, pad = a => { const o = new Array(NS).fill(0); a.forEach((v, i) => (o[i] = v)); return o; };
  const baseU = {
    ...common,
    uRoom: { value: new THREE.Vector4(room.profonditaParete, room.xSinistra, room.xDestra, room.altezzaCornice) },
    uStripWall: { value: pad(strips.map(s => s.wall)) }, uStripS0: { value: pad(strips.map(s => s.s0)) }, uStripS1: { value: pad(strips.map(s => s.s1)) },
    uStripY: { value: new Array(NS).fill(99) }, uStripA: { value: new Array(NS).fill(0) },
    uCeil: { value: 0 }, uFirebox: { value: 0 }, uFloorFill: { value: 0 }, uFireSweep: { value: 0 }, uFlick: { value: 0 }, uTime: { value: 0 },
  };
  const base = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: baseU, vertexShader: 'varying vec2 vUv; void main(){ vUv = vec2(uv.x, 1.0 - uv.y); gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: BASE_FRAG, depthTest: false, depthWrite: false }));
  base.frustumCulled = false; base.renderOrder = 0; scene.add(base);

  // ---------------- occlusori invisibili (focolare e petto del camino)
  const D = room.profonditaParete, fh = room.focolare, pe = room.petto;
  const occMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const hx0 = (fh.u0 - cam.cx) * fh.fronte / cam.f, hx1 = (fh.u1 - cam.cx) * fh.fronte / cam.f;
  addBox(scene, occMat, [hx0, hx1], [-0.1, fh.altezza - 0.004], [-D, -fh.fronte - 0.004], 1);
  const px0 = (pe.u0 - cam.cx) * pe.fronte / cam.f, px1 = (pe.u1 - cam.cx) * pe.fronte / cam.f;
  const py0 = cam.altezza - (pe.v1 - cam.cy) * pe.fronte / cam.f;
  addBox(scene, occMat, [px0, px1], [py0, room.altezzaCornice + 0.3], [-D, -pe.fronte - 0.004], 1);

  // ---------------- materiale proiettato
  const projMat = (plane, faceN, kind = 0) => new THREE.ShaderMaterial({
    uniforms: { ...common, uUvPlane: { value: new THREE.Vector4(plane[0], plane[1], 1, 0) }, uOpacity: { value: 1 }, uMove: { value: 1 }, uKind: { value: kind }, uFaceN: { value: new THREE.Vector3(...faceN) } },
    vertexShader: PROJ_VERT, fragmentShader: PROJ_FRAG, transparent: true, depthTest: true, depthWrite: true });

  // ---------------- rotoli di carta da parati
  const rollGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, false);
  for (const s of strips) {
    let plane, axisRot;
    let axis;
    if (s.wall === 2) { plane = [2, -D]; axisRot = new THREE.Euler(0, 0, Math.PI / 2); axis = [1, 0, 0]; }
    else { plane = [0, s.wall === 1 ? room.xSinistra : room.xDestra]; axisRot = new THREE.Euler(Math.PI / 2, 0, 0); axis = [0, 0, 1]; }
    const mesh = new THREE.Mesh(rollGeo, projMat(plane, axis, 1));
    mesh.matrixAutoUpdate = false; mesh.renderOrder = 2; mesh.visible = false; mesh.userData = { s, axisRot };
    scene.add(mesh); s.mesh = mesh;
  }

  // ---------------- lastre del pavimento
  const R = rng(7);
  const tiles = [];
  const pv = C.tempi.pavimento;
  const rows = Math.max(...layout.lastre.map(t => t.riga)) + 1;
  for (const t of layout.lastre) {
    const geo = boxGeo([t.x0, t.x1], [-0.022, 0], [t.z0, t.z1]);
    const mat = projMat([1, 0], [0, 1, 0]);
    const mesh = new THREE.Mesh(geo, mat); mesh.matrixAutoUpdate = false; mesh.renderOrder = 3; scene.add(mesh);
    const rowStep = (pv.fine - pv.inizio - pv.durataLastra - 0.35) / Math.max(1, rows - 1);
    const t0 = pv.inizio + t.riga * rowStep + R() * 0.35;
    const center = new THREE.Vector3((t.x0 + t.x1) / 2, 0, (t.z0 + t.z1) / 2);
    const sh = shadowQuad(scene, (t.x1 - t.x0) * 1.15, (t.z1 - t.z0) * 1.3, center, -0.0015);
    tiles.push({ mesh, mat, center, t0, t1: t0 + pv.durataLastra, sh,
      rot: [(R() - 0.5) * 0.07, (R() - 0.5) * 0.06, (R() - 0.5) * 0.05], dz: 0.06 + R() * 0.06, dx: (R() - 0.5) * 0.05 });
  }

  // ---------------- rivestimento in travertino (pannelli del petto + focolare)
  const slabs = [];
  const cm = C.tempi.camino;
  const pyTop = cam.altezza + (cam.cy - pe.v0) * pe.fronte / cam.f;
  const midX = (793 - cam.cx) * pe.fronte / cam.f;
  const panel = (x0, x1, t0, dir) => {
    const mesh = new THREE.Mesh(boxGeo([x0, x1], [py0, pyTop], [-pe.fronte - 0.03, -pe.fronte]), projMat([2, -pe.fronte], [0, 0, 1]));
    mesh.matrixAutoUpdate = false; mesh.renderOrder = 3; scene.add(mesh);
    slabs.push({ mesh, t0, t1: t0 + 0.95, pivot: new THREE.Vector3((x0 + x1) / 2, (py0 + pyTop) / 2, -pe.fronte), from: { z: 0.55, y: 0.06, x: dir * 0.12, yaw: dir * 0.09 } });
  };
  panel(px0, midX, cm.inizio, -1);
  panel(midX, px1, cm.inizio + 0.25, 1);
  const nH = 3;
  for (let k = 0; k < nH; k++) {
    const x0 = hx0 + (hx1 - hx0) * k / nH, x1 = hx0 + (hx1 - hx0) * (k + 1) / nH;
    const t0 = cm.inizio + 0.55 + k * 0.22;
    const front = new THREE.Mesh(boxGeo([x0, x1], [0, fh.altezza], [-fh.fronte - 0.03, -fh.fronte]), projMat([2, -fh.fronte], [0, 0, 1]));
    front.matrixAutoUpdate = false; front.renderOrder = 3; scene.add(front);
    slabs.push({ mesh: front, t0, t1: t0 + 0.85, pivot: new THREE.Vector3((x0 + x1) / 2, fh.altezza / 2, -fh.fronte), from: { z: 0.45, y: 0.03, x: 0, yaw: (k - 1) * 0.05 } });
    const top = new THREE.Mesh(boxGeo([x0, x1], [fh.altezza - 0.03, fh.altezza], [-D, -fh.fronte]), projMat([1, fh.altezza], [0, 1, 0]));
    top.matrixAutoUpdate = false; top.renderOrder = 3; scene.add(top);
    slabs.push({ mesh: top, t0: t0 + 0.18, t1: t0 + 0.18 + 0.8, pivot: new THREE.Vector3((x0 + x1) / 2, fh.altezza, -(D + fh.fronte) / 2), from: { z: 0.1, y: 0.32, x: 0, yaw: 0 } });
  }

  // ---------------- arredi
  const furn = [];
  C.arredi.forEach((o, k) => {
    const L = layout.arredi.find(a => a.id === o.id);
    const geo = furnitureGeometry(o, L, C, unproject);
    const sel = new THREE.Vector3(); sel.setComponent(k % 3, 1);
    const mat = new THREE.ShaderMaterial({ uniforms: { ...common, uSel: { value: sel }, uSet: { value: Math.floor(k / 3) }, uOpacity: { value: 0 }, uComplete: { value: o.completa ? 1 : 0 } },
      vertexShader: OBJ_VERT, fragmentShader: OBJ_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
    geo.computeBoundingBox(); const bb = geo.boundingBox;
    const pivot = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.min.y, (bb.min.z + bb.max.z) / 2);
    const depth = -bb.max.z; // punto più vicino alla camera: ordine di disegno dal fondo
    const footW = (bb.max.x - bb.min.x) * 0.9, footD = Math.max(0.35, (bb.max.z - bb.min.z) * 0.9);
    const sh = shadowQuad(scene, footW * 1.25, footD * 1.4, new THREE.Vector3(pivot.x, 0, pivot.z), 0.003, o.profondita.modo === 'focolare' ? fh.altezza : 0);
    sh.material.depthTest = false; sh.renderOrder = 8;
    scene.add(mesh);
    furn.push({ o, k, mesh, mat, pivot, depth, sh });
  });
  furn.sort((a, b) => b.depth - a.depth).forEach((f, i) => (f.mesh.renderOrder = 10 + i));

  // ---------------------------------------------------------------- stato al tempo t
  const T = C.tempi;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  function placed(mesh, pivot, off, rx, ry, rz) {
    e.set(rx, ry, rz); q.setFromEuler(e);
    m4.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
    const r = new THREE.Matrix4().makeRotationFromQuaternion(q);
    const tr = new THREE.Matrix4().makeTranslation(pivot.x + off.x, pivot.y + off.y, pivot.z + off.z);
    mesh.matrix.copy(tr).multiply(r).multiply(m4);
    mesh.matrixWorldNeedsUpdate = true;
  }

  function setTime(t) {
    baseU.uTime.value = t;
    // carta da parati
    strips.forEach((s, i) => {
      const p = lin(t, s.t0, s.t0 + T.carta.durataTelo);
      const started = t >= s.t0;
      const yTop = room.altezzaCornice, y = started ? yTop - (yTop + 0.02) * easeInOut(p) : 99;
      baseU.uStripY.value[i] = p >= 1 ? -1 : y;
      const active = started && p < 1 ? smooth(lin(p, 0, 0.06)) * (1 - smooth(lin(p, 0.93, 1))) : 0;
      baseU.uStripA.value[i] = active;
      const mesh = s.mesh; mesh.visible = active > 0.001;
      if (mesh.visible) {
        const r = 0.075 * Math.sqrt(1 - 0.7 * p) * active;
        const len = s.s1 - s.s0, c = (s.s0 + s.s1) / 2;
        const pos = s.wall === 2 ? new THREE.Vector3(c, y + r * 0.2, -D + r + 0.004)
          : new THREE.Vector3((s.wall === 1 ? room.xSinistra + r + 0.004 : room.xDestra - r - 0.004), y + r * 0.2, -c);
        q.setFromEuler(mesh.userData.axisRot);
        mesh.matrix.compose(pos, q, new THREE.Vector3(r, len, r));
        mesh.matrixWorldNeedsUpdate = true;
      }
    });
    baseU.uCeil.value = smooth(lin(t, T.soffitto.inizio, T.soffitto.fine));
    // lastre
    for (const tl of tiles) {
      const p = lin(t, tl.t0, tl.t1);
      tl.mesh.visible = p > 0;
      const a = smooth(lin(p, 0, 0.28));
      tl.mat.uniforms.uOpacity.value = a;
      tl.mat.uniforms.uMove.value = 1 - smooth(lin(p, 0.85, 1));
      const k = easeOut(p);
      const lift = T.pavimento.altezzaPartenza * (1 - k);
      const wob = Math.pow(1 - p, 2) * Math.cos(p * Math.PI * 2.6);
      placed(tl.mesh, tl.center, { x: tl.dx * (1 - k), y: lift, z: tl.dz * (1 - k) }, tl.rot[0] * wob, tl.rot[1] * wob, tl.rot[2] * wob);
      tl.sh.visible = p > 0 && p < 1;
      tl.sh.material.uniforms.uOpacity.value = a * 0.5 * (1 - lift / T.pavimento.altezzaPartenza * 0.6) * (p < 1 ? 1 : 0);
    }
    // rivestimento
    for (const s of slabs) {
      const p = lin(t, s.t0, s.t1);
      s.mesh.visible = p > 0;
      s.mesh.material.uniforms.uOpacity.value = smooth(lin(p, 0, 0.3));
      s.mesh.material.uniforms.uMove.value = 1 - smooth(lin(p, 0.85, 1));
      const k = easeOut(p), wob = Math.pow(1 - p, 2) * Math.cos(p * Math.PI * 2.2);
      placed(s.mesh, s.pivot, { x: s.from.x * (1 - k), y: s.from.y * (1 - k), z: s.from.z * (1 - k) }, 0, s.from.yaw * wob, 0);
    }
    baseU.uFirebox.value = smooth(lin(t, T.camino.inizio + 0.4, T.camino.fine));
    baseU.uFloorFill.value = smooth(lin(t, T.pavimento.fine - 0.35, T.pavimento.fine + 0.25));
    // arredi
    const sh3 = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (const f of furn) {
      const o = f.o, p = lin(t, o.t[0], o.t[1]);
      const k = easeOut(p);
      const fade = o.dissolvenza > 0 ? smooth(lin(p, 0, o.dissolvenza)) : (p > 0 ? 1 : 0);
      f.mat.uniforms.uOpacity.value = fade;
      f.mesh.visible = p > 0;
      const d = o.da, yaw = (d.yaw || 0) * Math.PI / 180;
      const settle = Math.pow(1 - p, 2) * Math.cos(p * Math.PI * 2.0);
      placed(f.mesh, f.pivot, { x: d.x * (1 - k), y: d.y * (1 - k), z: d.z * (1 - k) }, 0, yaw * settle, 0);
      const land = smooth(lin(p, 0.72, 1.0));
      sh3[Math.floor(f.k / 3)].setComponent(f.k % 3, land);
      const lift = d.y * (1 - k);
      f.sh.visible = p > 0 && land < 1;
      const hov = d.y > 0.05 ? 0.30 : 0.16;
      f.sh.material.uniforms.uOpacity.value = fade * hov * (1 - Math.min(1, lift / 0.9)) * (1 - land);
      const sc = 1 + lift * 1.6;
      f.sh.scale.set(sc, 1, sc);
      f.sh.position.x = f.pivot.x + d.x * (1 - k); f.sh.position.z = f.pivot.z + d.z * (1 - k);
      f.sh.updateMatrix();
    }
    common.uShadowA.value.copy(sh3[0]); common.uShadowB.value.copy(sh3[1]); common.uShadowC.value.copy(sh3[2]);
    // fuoco e atmosfera
    const fs = lin(t, T.fuoco.inizio, T.fuoco.inizio + 0.8);
    baseU.uFireSweep.value = easeOut(fs);
    common.uGlow.value = smooth(lin(t, T.fuoco.inizio + 0.2, T.fuoco.fine));
    baseU.uFlick.value = fs > 0 ? smooth(lin(t, T.fuoco.inizio, T.fuoco.inizio + 0.5)) * (1 - smooth(lin(t, T.chiusura.inizio, C.durata))) : 0;
    common.uAtmos.value = smooth(lin(t, T.atmosfera.inizio, T.atmosfera.fine));
  }

  function renderAt(t) { setTime(t); renderer.render(scene, camera); }
  return { renderer, renderAt, duration: C.durata, canvas };
}

// ---------------------------------------------------------------- helper geometrici
function boxGeo(xr, yr, zr) {
  const g = new THREE.BoxGeometry(xr[1] - xr[0], yr[1] - yr[0], zr[1] - zr[0]);
  g.translate((xr[0] + xr[1]) / 2, (yr[0] + yr[1]) / 2, (zr[0] + zr[1]) / 2);
  return g;
}
function addBox(scene, mat, xr, yr, zr, order) { const m = new THREE.Mesh(boxGeo(xr, yr, zr), mat); m.renderOrder = order; scene.add(m); return m; }
function shadowQuad(scene, w, d, center, yOff, yBase = 0) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { uOpacity: { value: 0 } }, vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true }));
  m.position.set(center.x, yBase + yOff, center.z); m.renderOrder = 4; m.visible = false; m.updateMatrix(); m.matrixAutoUpdate = false;
  scene.add(m); return m;
}

// teli di carta: larghezza rotolo ~0,53 m, ordine dal camino verso l'esterno
function buildStrips(C) {
  const cam = C.camera, room = C.stanza, D = room.profonditaParete, pe = room.petto, T = C.tempi.carta;
  const bxL = (pe.u0 - cam.cx) * D / cam.f + 0.12, bxR = (pe.u1 - cam.cx) * D / cam.f - 0.12;
  const zL = cam.f * room.xSinistra / (0 - cam.cx), zR = cam.f * room.xDestra / (1478 - cam.cx);
  const out = [];
  const split = (a, b, w) => { const n = Math.max(1, Math.round((b - a) / w)); const r = []; for (let i = 0; i < n; i++) r.push([a + (b - a) * i / n, a + (b - a) * (i + 1) / n]); return r; };
  const left = split(room.xSinistra - 0.05, bxL, 0.53).reverse();   // dal camino verso sinistra
  const right = split(bxR, room.xDestra + 0.05, 0.53);              // dal camino verso destra
  const seq = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) { if (left[i]) seq.push({ wall: 2, s0: left[i][0], s1: left[i][1] }); if (right[i]) seq.push({ wall: 2, s0: right[i][0], s1: right[i][1] }); }
  split(zL - 0.05, D + 0.05, 0.53).reverse().forEach(r => seq.push({ wall: 1, s0: r[0], s1: r[1] }));
  seq.push({ wall: 4, s0: zR - 0.05, s1: D + 0.05 });
  const span = T.fine - T.inizio - T.durataTelo;
  seq.forEach((s, i) => (s.t0 = T.inizio + span * i / (seq.length - 1)));
  return seq;
}

// superficie di un arredo: griglia sui raggi della camera, profondità da primitive (rilievo, ellissoide, scatola)
function furnitureGeometry(o, L, C, unproject) {
  const cam = C.camera, [u0, v0, u1, v1] = L.bbox;
  const nx = 56, ny = 56;
  const fm = o.forma || { tipo: 'rilievo' };
  const prof = L.profilo;
  const zProfile = u => { const x = (u - u0) / (u1 - u0) * (prof.length - 1); const i = Math.max(0, Math.min(prof.length - 2, Math.floor(x))); const fr = x - i; return prof[i] * (1 - fr) + prof[i + 1] * fr; };
  let hit;
  if (fm.tipo === 'ellissoide') {
    const zMean = prof.reduce((a, b) => a + b, 0) / prof.length;
    const zc = fm.zCentro || (zMean + fm.rz * 0.6);
    const rx = (u1 - u0) / 2 * zc / cam.f * 1.04, ry = (v1 - v0) / 2 * zc / cam.f * 1.04;
    const c = unproject((u0 + u1) / 2, (v0 + v1) / 2, zc);
    hit = (dir) => rayEllipsoid(new THREE.Vector3(0, cam.altezza, 0), dir, c, new THREE.Vector3(rx, ry, fm.rz)) ?? zc;
  } else if (fm.tipo === 'scatola') {
    const bmin = new THREE.Vector3(fm.x[0], fm.y[0], fm.z[0]), bmax = new THREE.Vector3(fm.x[1], fm.y[1] + 0.25, fm.z[1]);
    const zFront = -fm.z[1];
    hit = (dir) => rayBox(new THREE.Vector3(0, cam.altezza, 0), dir, bmin, bmax) ?? zFront;
  }
  const pos = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = u0 + (u1 - u0) * i / nx, v = v0 + (v1 - v0) * j / ny;
    let Z;
    if (hit) { const dir = new THREE.Vector3((u - cam.cx) / cam.f, -(v - cam.cy) / cam.f, -1); Z = hit(dir); }
    else {
      const rel = o.profondita.rilievo || 0;
      const dx = (i / nx) * 2 - 1, dy = (j / ny) * 2 - 1;
      const dome = Math.sqrt(Math.max(0, 1 - Math.min(1, dx * dx * 0.9 + dy * dy * 0.6)));
      Z = (o.profondita.modo === 'costante' ? o.profondita.z : zProfile(u)) - rel * dome;
    }
    const p = unproject(u, v, Z); pos.push(p.x, p.y, p.z);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}
// restituiscono la profondità (distanza lungo -Z) del primo punto colpito
function rayEllipsoid(o, d, c, r) {
  const oc = new THREE.Vector3().subVectors(o, c).divide(r), dd = d.clone().divide(r);
  const A = dd.dot(dd), B = 2 * oc.dot(dd), Cc = oc.dot(oc) - 1, disc = B * B - 4 * A * Cc;
  if (disc < 0) return null; const t = (-B - Math.sqrt(disc)) / (2 * A); return t > 0 ? t : null; // d.z = -1 ⇒ t = profondità
}
function rayBox(o, d, bmin, bmax) {
  let tmin = -Infinity, tmax = Infinity;
  for (const k of ['x', 'y', 'z']) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < bmin[k] || o[k] > bmax[k]) return null; continue; }
    let t1 = (bmin[k] - o[k]) / d[k], t2 = (bmax[k] - o[k]) / d[k]; if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  }
  return tmax >= tmin && tmin > 0 ? tmin : null;
}
