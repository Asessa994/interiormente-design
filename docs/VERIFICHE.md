# Verifiche della consegna

26 novembre 2026. Ambiente usato: Node.js 24.22.3, npm 11.19.1, Astro 7.4.13.

- `npm run verify`: superato. Controlla risorse locali, sintassi dei moduli, 45 volumi e nove ingressi, sosta e ritorno del menu, ingresso centrale e parametri approvati.
- `npm run build`: superato. Sono state generate le quattro pagine `/`, `/intro`, `/anteprima` e `/regola`.
- Controllati nella build i riferimenti a immagini, CSS, script, geometria e video: nessun file mancante.
- Controllata la presenza degli otto quadri e la corrispondenza del JSON approvato in tutte le pagine.
- Confrontati i moduli estratti dall'ultima anteprima e le risorse esternalizzate. Il controller della stanza usa i file MP4 locali al posto dei dati base64.
- Inclusa l'anteprima autonoma corrente, verificata tramite SHA-256.

L'ultima anteprima è stata verificata nel browser durante lo scroll avanti e indietro, sul desktop e nella simulazione 390×844. In particolare è stata riprodotta e corretta la comparsa anticipata del fondo beige della Zona Giorno.

Le verifiche del pacchetto Astro consistono nei controlli dei sorgenti, della build e delle risorse sopra elencati.
