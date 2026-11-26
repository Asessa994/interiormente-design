# Zona Giorno: trasformazione continua 3D

Anteprima della sola sezione Zona Giorno. La stanza passa dal grezzo al soggiorno arredato mentre l'utente scorre la pagina. La camera resta fissa e la sezione è un unico blocco sticky. Lo scroll comanda il tempo di **un solo MP4**, come nel riferimento Levanto.

## Stato della sorgente visiva

**Il filmato continuo è stato prodotto.** File: `assets/video/zona-giorno.mp4` (12 s, 60 fps, 1586×992, crf 21, fotogramma chiave ogni 6 e nessun B-frame per uno scorrimento reattivo, 25 MB: sotto il limite di 25 MiB per file di Cloudflare) e `assets/video/zona-giorno-mobile.mp4` (1024 px, 12 MB). `poster.png` e `ultimo.png` sono il primo e l'ultimo fotogramma senza compressione.

Non è un video generato con l'AI e non è un montaggio delle tre foto. Viene da un renderer 3D (`src/scene.js`) che ricostruisce la stanza con una camera tarata sulla prospettiva delle immagini:

| Fase | Cosa succede in 3D |
| --- | --- |
| Carta da parati | 11 teli su 4 pareti. Un rotolo cilindrico, con testate a spirale, scende lungo la parete in prospettiva. Sopra di lui la carta aderisce, con un leggero rigonfiamento che si appiattisce; sotto c'è un'ombra di contatto. Il rotolo passa dietro al focolare. |
| Pavimento | 76 lastre con spessore, ricavate dai giunti reali dell'immagine finita. Si posano fila per fila dal fondo verso la camera, con una leggera rotazione che si assesta e un'ombra sul massetto. |
| Travertino | 2 pannelli sul petto del camino e 6 lastre (fronte e piano) sul basamento: arrivano verso il muro e si fermano a filo. |
| Arredi | Superfici 3D (ellissoidi per poltrona, pouf e pianta; scatole per i tavolini; rilievo per divano, lampada e oggetti). Si muovono in 3D con ombra a terra; all'arrivo le ombre di contatto dell'immagine finale scuriscono il pavimento già posato, cambiando solo la luminosità e senza sostituire grana e fughe (solo scurimento, calcolato escludendo i pixel degli arredi: niente aloni). Le mascherine hanno un nucleo pieno e un bordo che resta solo dove l'arredo esiste davvero; la pianta è ritagliata sulle foglie. La lampada scivola da sinistra con la base dietro il divano; pouf e poltrona scivolano da destra, da fuori quadro e senza dissolvenza; la pianta sale da dietro la poltrona; il tavolino basso esce da sotto quello alto. Le mascherine sono salvate in tre immagini RGB senza canale alfa (`mascherine-a/b/c.png`), perché l'alfa dei PNG non arriva affidabile alla scheda grafica. |
| Atmosfera | Il fuoco si accende da sinistra a destra lungo il bruciatore, con un tremolio che si spegne sull'ultimo fotogramma; luce e riflessi arrivano a quelli dell'immagine finale. |

Le immagini sono proiettate sulle geometrie dal punto di vista della camera. Per questo i pixel del **primo fotogramma coincidono con `01-grezzo.png`** e l'**ultimo con `03-zona-giorno-finale.png`** (scarto medio 0,003 su 255, dovuto alle cuciture di qualche lastra).

### Limiti reali

- Gli arredi esistono solo come viste frontali dalla foto finale. L'unica parte nascosta completata è la base della poltrona dietro il pouf (`"completa": true` nel config): è ricostruita specchiando la fascia visibile appena sopra (`assets/tex/arredi.png`) e a riposo resta coperta dal pouf. Per le altre parti nascoste l'ordine di ingresso e i movimenti le tengono sempre coperte: il pouf entra prima della poltrona, la poltrona prima della pianta, il tavolino alto prima di quello basso. Per questo l'ordine differisce leggermente dal brief.
- I giunti del pavimento dell'immagine AI non sono perfettamente regolari: alcune lastre in volo possono mostrare un giunto disegnato al loro interno.
- Fra la foto 02 e la 03 la luce del sole sul pavimento e la grana delle superfici cambiano un poco. Questa differenza viene assorbita nella fase finale "atmosfera" (10,4–11,4 s): si percepisce come la luce che si assesta.
- Per una resa ancora più fisica, ad esempio arredi visti da più lati, servirebbero modelli 3D veri degli arredi oppure un video generato con un servizio AI. In quel caso basta sostituire l'MP4: `index.html` resta valido.

## File

| Percorso | Ruolo |
| --- | --- |
| `index.html` | **Anteprima consegnata**: sezione sticky, MP4 comandato dallo scroll (avanti e indietro), riproduzione automatica e barra manuale come controlli dell'anteprima, versione per telefono senza ritaglio. |
| `config/zona-giorno.json` | **Unico punto dei parametri**: camera, stanza, durata, tempi di ogni fase, contorni e movimenti degli arredi, scorrimento, codifica video. |
| `src/scene.js` | Renderer 3D (Three.js). `renderAt(t)` produce il fotogramma al tempo t. |
| `renderer.html` | Il renderer dal vivo, con barra del tempo: serve a controllare e regolare la sequenza. |
| `tools/prepara-asset.mjs` | Ricava dalle foto le texture, le mascherine degli arredi, le zone d'ombra e la griglia delle lastre (`assets/tex`, `assets/layout.json`). |
| `tools/registra-video.mjs` | Registra il renderer fotogramma per fotogramma (Chrome headless) e codifica gli MP4. |
| `tools/server.mjs` | Server statico locale (supporta le richieste a intervalli per il video). |

## Comandi

```
npm install
npm run prepara     # dopo aver cambiato contorni/arredi nel config
npm run video       # rigenera gli MP4 (circa 5 minuti)
npm run foto        # solo alcuni fotogrammi di controllo in work/foto
npm run serve       # http://localhost:8418/  (anteprima)  e  /renderer.html
```

`registra-video.mjs` usa Chrome o Edge installati; per un altro percorso imposta la variabile `CHROME`.

## Integrazione in Astro

Copia `assets/video/*`, il blocco `<section class="track">` e lo script di `index.html` in un componente `ZonaGiorno.astro`, poi passa i tempi delle fasi come props oppure importa il JSON. Il renderer 3D non serve in produzione: il sito usa solo l'MP4. L'intro con le colonne, le mani, la scintilla e la O non è stata toccata.
