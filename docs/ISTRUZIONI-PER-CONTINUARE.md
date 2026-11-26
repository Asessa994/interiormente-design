# Stato e requisiti di Interiormente Design

Continua dal codice di `progetto-astro`. Avvia `/anteprima` per confrontare il comportamento con `anteprima-autonoma/anteprima-menu-tunnel.html`.

## Sequenza attuale

1. Sei colonne decorate, tre per lato, su fondo scuro e bagliore dall'alto. Si aprono allo scroll.
2. Entrano le due braccia; le dita si avvicinano, parte la scintilla e si attraversa la O di Interiormente.
3. Compaiono Percezione, Stile, Esperienza. Abitano la faccia del primo riquadro, senza parole generiche sovrapposte.
4. Ruota l'intero campo di 45 volumi. Al termine si stabilizza il menu.
5. Soltanto nove facce già esistenti sono cliccabili. Gli altri volumi rimangono elementi di contesto con parole di interior design.
6. Continuando lo scroll, la camera entra prima nel volume centrale e poi prosegue nel tunnel. Se viene scelta una voce, l'ingresso si orienta verso quella faccia.
7. La galleria contiene otto quadri aderenti alle pareti. Oscillano leggermente nel piano della parete quando lo scroll cambia velocità o direzione. I soggetti del collage vengono mostrati singolarmente.
8. Il tunnel arriva alla stanza grezza di Claude. Lo scroll comanda il filmato originale di 12 secondi: carta da parati, lastre, rivestimenti, arredi e atmosfera.
9. La stanza completata rimane visibile prima della ripartenza. Il suo fotogramma finale diventa la faccia di partenza della rotazione a 360 gradi, seguita dal tunnel verso Zona Notte.

## Menu approvato

| Sinistra | Centro | Destra |
| --- | --- | --- |
| Zona giorno | Zona notte | Zona bagno |
| Zona focus | Continua lo scroll | Progetti |
| Social | Dove trovarmi | Contatti |

Non aggiungere una nuova griglia sopra i volumi. Le superfici cliccabili devono seguire la proiezione delle nove facce originali. Su desktop il tunnel e i riquadri rimangono quadrati e centrati; il formato può adattarsi al telefono. Le immagini della stanza rimangono dritte.

## Scorrimento e ritorno

Lo scroll è nativo e reversibile. Il gesto che raggiunge il menu viene arrestato per stabilizzare la scena; un nuovo gesto riprende il percorso. Cliccando una voce, lo scroll viene accompagnato per circa 2,4 secondi; l'utente può interromperlo. Tornando indietro si ripercorre la stessa galleria e si ritrova il menu. Le destinazioni sono sezioni reali, non modali.

Mantieni i parametri approvati in `src/config/interiormente-intro.json`: comprendono 2,05 schermate e 400 ms per la prima intro, oltre alle regolazioni mobili di colonne, titolo e logo. I tempi della stanza e del tunnel sono gestiti dai rispettivi moduli.

## Correzione da conservare

Il contenitore `.claude-room` deve restare trasparente e nascosto finché non si raggiunge il suo inizio. Nascondere soltanto `.claude-room-stage` lasciava entrare dal basso un grande fondo beige che copriva la galleria. Ora `zona-giorno.js` gestisce la visibilità sia del contenitore sia del palco; `zona-giorno.css` mantiene trasparente il binario. L'altezza viene misurata dal palco effettivo.

Il primo fotogramma e l'ultimo devono usare la stessa impaginazione tra tunnel e stanza. Sul telefono viene mostrata l'inquadratura intera della stanza, come nel progetto di Claude.

## Direzione dei contenuti

Il sito parla in prima persona come l'interior designer: racconta come interpreta e migliora i diversi ambienti della casa. Il tono è semplice e personale. Lo stile visivo unisce richiami classici, colonne e sculture con accenti vaporwave, nero, bianco e oro; il font è Aboreto.

Prosegui con le indicazioni successive dell'utente, mantenendo questa versione come base.
