// Utility condivise per gli script di preparazione (Node + sharp).
import sharp from 'sharp';
export const W = 1586, H = 992;
export async function load(path) {
  const img = sharp(path).removeAlpha();
  const m = await img.metadata();
  // estende a 1586x992 (l'immagine intermedia è larga 1585 px): replica l'ultima colonna
  const ext = img.extend({ right: W - m.width, bottom: H - m.height, extendWith: 'copy' });
  const { data } = await ext.raw().toBuffer({ resolveWithObject: true });
  const f = new Float32Array(W * H * 3);
  for (let i = 0; i < f.length; i++) f[i] = data[i] / 255;
  return f;
}
export async function save(path, arr, ch = 3) {
  const b = Buffer.alloc(W * H * ch);
  for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(arr[i] * 255)));
  await sharp(b, { raw: { width: W, height: H, channels: ch } }).png().toFile(path);
}
export const lum = (a, i) => 0.2126 * a[i * 3] + 0.7152 * a[i * 3 + 1] + 0.0722 * a[i * 3 + 2];
