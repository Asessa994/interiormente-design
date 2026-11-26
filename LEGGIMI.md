# Interiormente Design

Sito Astro pubblicato su Cloudflare. La home è un percorso unico comandato dallo scroll: le colonne, le braccia con la scintilla e il passaggio nella O, le tre parole, il menu a 45 volumi, il tunnel con la galleria, la Zona Giorno (la stanza che si costruisce) e il passaggio verso la Zona Notte.

Lo stato del lavoro e i requisiti approvati da conservare sono in [docs/ISTRUZIONI-PER-CONTINUARE.md](docs/ISTRUZIONI-PER-CONTINUARE.md).

## Comandi

```
npm install
npm run dev       # http://localhost:4321/  ·  /anteprima (pulsanti di revisione)  ·  /regola (regolatore mobile)
npm run verify    # controlla risorse, sintassi dei moduli, 45 volumi / 9 ingressi, parametri approvati
npm run build     # sito statico in dist/ (con il controllo dei limiti Cloudflare)
npm run deploy    # build + pubblicazione con wrangler (richiede login Cloudflare)
```

## Struttura

| Percorso | Contenuto |
| --- | --- |
| `src/components/InteriormenteIntro.astro` | Markup della sequenza e delle sezioni. |
| `src/config/interiormente-intro.json` | Parametri approvati di colonne, mani, scintilla, O e layout mobile. |
| `src/pages/` | `/` (dalle colonne), `/anteprima` (dalle tre parole, con pulsanti), `/intro`, `/regola`. |
| `public/interiormente-intro/scene.js`, `architecture.js` | Prima intro e colonnato (Three.js incluso in `architecture.js`). |
| `public/interiormente-intro/tunnel-menu.js`, `giorno.js`, `menu-faces.css` | Rotazione, nove facce cliccabili, ingresso nella galleria. |
| `public/interiormente-intro/zona-giorno.js`, `zona-giorno.css`, `zona-giorno/` | Stanza comandata dallo scroll, video e fotogrammi. |
| `public/interiormente-intro/zone-transition.js`, `notte.js` | Passaggio a 360° verso la Zona Notte e sue interazioni. |
| `scripts/check-project.cjs` | Controlli di `npm run verify`. |
| `sorgenti/zona-giorno/` | Foto di partenza, maschere SVG e renderer 3D della stanza (`06-zona-giorno-3d`, con la sua guida `LEGGIMI.md`). |
| `modelli-sorgente/` | Sorgenti dei modelli: i sei GLB originali delle colonne (`colonne-originali/`) e i file Blender della prima versione. |
| `docs/` | Istruzioni per continuare, verifiche e corrispondenza con l'anteprima di ChatGPT. |

## Rigenerare il video della Zona Giorno

Dentro `sorgenti/zona-giorno/06-zona-giorno-3d`: `npm install`, poi `npm run video`. Copia `assets/video/zona-giorno.mp4`, `zona-giorno-mobile.mp4`, `poster.png` e `ultimo.png` in `public/interiormente-intro/zona-giorno/` (i video vanno nella sottocartella `video/`).

**Limite Cloudflare:** ogni file pubblicato deve pesare al massimo 25 MiB, altrimenti `npm run build` si ferma. Il video desktop è codificato con crf 21 (24 MiB); il valore è nel config del renderer (`video.crf`). Se una nuova versione supera il limite, alza il crf di 1.

## Storia

- Unione del 26 novembre 2026: il progetto completo consegnato da ChatGPT è stato portato in questo repository, mantenendo la configurazione Cloudflare. La versione precedente (intro `/scena` con colonna ionica e passaggio nella O) è salvata in `../interiormente-design-backup-prima-unione-2026-11-26.zip`.
- Il video desktop della Zona Giorno è stato ricodificato da 37,7 MiB (crf 17) a 24 MiB (crf 21), partendo da un master senza perdite del renderer, per rispettare il limite di Cloudflare.
- Il pacchetto di ChatGPT citava un'anteprima autonoma (`anteprima-autonoma/anteprima-menu-tunnel.html`) che però non era inclusa nella cartella ricevuta.

I contenuti delle pagine sono ancora provvisori: la Zona Notte ha un fondo uniforme; Bagno, Focus, Progetti, Social, Dove trovarmi e Contatti hanno testi di esempio. Le pagine sono `noindex,nofollow`.
