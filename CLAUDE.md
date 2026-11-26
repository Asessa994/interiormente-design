@AGENTS.md

# Interiormente Design: note per Claude

- Rispondi in italiano. Leggi `LEGGIMI.md` e `docs/ISTRUZIONI-PER-CONTINUARE.md` prima di modificare la sequenza: contengono i requisiti approvati (menu a 9 voci, parametri in `src/config/interiormente-intro.json`, correzione del fondo `.claude-room`).
- Gli script della sequenza sono JavaScript semplice in `public/interiormente-intro/`, caricati con `is:inline`: non passano dal bundler.
- Dopo ogni modifica: `npm run verify` e `npm run build`. La build fallisce se un file in `public/` supera 25 MiB (limite Cloudflare).
- La stanza della Zona Giorno si modifica nel renderer `sorgenti/zona-giorno/06-zona-giorno-3d` (config unico `config/zona-giorno.json`), poi si copiano video e fotogrammi in `public/interiormente-intro/zona-giorno/`.
