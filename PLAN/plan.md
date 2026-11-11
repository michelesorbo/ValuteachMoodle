# Plan: NewLMS – MVP

- **Stato:** Bozza
- **Autore:** Mattia
- **Data:** 2026-11-09
- **Ultimo aggiornamento:** 2026-11-09

## 1. Contesto
NewLMS è un Learning Management System nuovo, per una singola organizzazione, costruito da zero (nessun sistema precedente e nessuna migrazione di dati). Lo sviluppa una sola persona in circa 6-8 settimane per arrivare all'MVP.

## 2. Obiettivi
- [ ] Gestire corsi con lezioni (testo, video, file).
- [ ] Permettere l'iscrizione ai corsi e tracciare i progressi.
- [ ] Supportare contenuti SCORM 1.2 (importazione, riproduzione, tracciamento).
- [ ] Gestire i ruoli come appartenenza al singolo corso.

## 3. Non-obiettivi (fuori scope)
- Quiz nativi, certificati, forum, pagamenti.
- Multi-tenant (più organizzazioni).
- SCORM 2004 (da rivalutare dopo l'MVP).
- Single sign-on aziendale e login social (previsto in futuro, non nell'MVP).
- Conformità WCAG formale.
- Migrazione da altri sistemi.

## 4. Requisiti
### Funzionali
- Ruoli: **admin** (globale) e **studente / docente** (relativi al singolo corso: la stessa persona può essere docente in un corso e studente in un altro).
- Creazione e gestione di corsi e lezioni (testo, video, file).
- Iscrizione degli utenti ai corsi con assegnazione del ruolo nel corso.
- Tracciamento dei progressi per utente e per corso.
- Caricamento di pacchetti SCORM 1.2 e riproduzione in un player, con salvataggio dei dati di tracciamento. Il **completamento** va tracciato (stato della lezione, punteggio, tempo di sessione e dati di ripresa).
- Solo l'admin crea i corsi e assegna i docenti; il docente di un corso ne gestisce lezioni e iscritti.
- Autenticazione con email e password; gli utenti sono creati o approvati dall'admin.
- Regole di completamento: lezione SCORM completata quando il pacchetto invia `completed` o `passed`; testo e file con il pulsante "segna come completata"; video completato al 90% guardato; corso completato quando tutte le sue lezioni lo sono.
- Upload di video e pacchetti SCORM consentito solo all'admin e ai docenti del corso.
### Non funzionali (performance, sicurezza, accessibilità…)
- Lingua: interfaccia in italiano, con localizzazione in inglese prevista (i testi vanno predisposti per la traduzione fin dall'inizio).
- Accessibilità di base: navigazione da tastiera, contrasti, etichette. Nessuna certificazione WCAG nell'MVP.
- Autenticazione estendibile al login social in futuro.
- Limiti di upload configurabili da variabili d'ambiente (valori iniziali: 500 MB per i pacchetti SCORM, 1 GB per i video).
- Estrazione degli zip protetta da percorsi malevoli (zip-slip) e archivi enormi (zip bomb).
- Storage di file, video e SCORM in una directory del server (non servita direttamente: l'accesso passa dall'app con controllo dei permessi).

## 5. Approccio / Design
Applicazione TypeScript full-stack: Next.js (frontend e API) con PostgreSQL e Drizzle ORM.

Autenticazione: Better Auth, con email e password nell'MVP e provider social aggiungibili in seguito.

Storage: file, video (MP4) e pacchetti SCORM estratti stanno in una directory specifica del server. Va quindi previsto un hosting su server proprio o VPS, non una piattaforma serverless.

Hosting: VPS Linux con Coolify; tutto gira in container (app, PostgreSQL). La directory dei file è un volume persistente montato nel container dell'app. HTTPS e routing sono gestiti da Coolify.

Video: file MP4 serviti dall'app con richieste a intervalli (range request), senza transcodifica.

SCORM: pacchetto estratto nella directory dei file e riprodotto in un iframe, servito solo a chi è iscritto al corso, da un sottodominio separato. La pagina del player sta nello stesso sottodominio e quindi nella stessa origine del contenuto: espone l'API SCORM 1.2 (`window.API`) e salva stato, punteggio, tempo di sessione e dati di ripresa sull'app con un token a breve scadenza.

Localizzazione: `next-intl` (standard de facto per Next.js App Router). Italiano nell'MVP, testi già in file di traduzione per aggiungere l'inglese.

Modello dei ruoli: l'utente ha un ruolo globale (admin o utente); il ruolo di studente o docente sta nell'iscrizione al corso (utente, corso, ruolo).

### Alternative considerate
| Opzione | Pro | Contro | Scelta |
|---------|-----|--------|--------|
| TypeScript full-stack (Next.js + PostgreSQL) | Un solo linguaggio, un solo progetto, adatto a uno sviluppatore | Il player SCORM e i video pesanti richiedono scelte dedicate | ✅ |

## 6. Task
### Fase 1 – Fondamenta (sett. 1)
- [ ] Progetto Next.js (App Router) in TypeScript, repository su GitHub — `/`
- [ ] PostgreSQL e Drizzle ORM, prime migrazioni — `db/`
- [ ] Container e deploy automatico da `main` su Coolify, volume persistente per i file
- [ ] Better Auth con email e password, utenti creati o approvati dall'admin, ruolo admin — `modules/auth`
- [ ] `next-intl` configurato con l'italiano e testi in file di traduzione — `modules/i18n`

### Fase 2 – Corsi e iscrizioni (sett. 2-3)
- [ ] Corsi e lezioni di testo e file, gestiti da admin e docenti del corso — `modules/courses`
- [ ] Iscrizioni con ruolo studente o docente relativo al corso, e controllo dei permessi
- [ ] Modello dei progressi per lezione e per corso, con "segna come completata" per testo e file — `modules/progress`
- [ ] Upload dei file con limiti configurabili da env — `modules/files`

### Fase 3 – SCORM 1.2 (sett. 4-5)
- [ ] Upload del pacchetto con estrazione protetta (zip-slip, zip bomb) — `modules/scorm`
- [ ] Sottodominio separato e servizio dei file SCORM con controllo dell'iscrizione al corso
- [ ] Player con API SCORM 1.2 (`window.API`) nella stessa origine del contenuto
- [ ] Salvataggio di stato, punteggio, tempo di sessione e dati di ripresa con token a breve scadenza
- [ ] Completamento del corso collegato allo stato SCORM

### Fase 4 – Video (sett. 6)
- [ ] Upload e streaming MP4 con range request — `modules/files`
- [ ] Completamento del video al 90% guardato — `modules/progress`

### Fase 5 – Rifinitura e rilascio (sett. 7-8)
- [ ] Accessibilità di base: tastiera, contrasti, etichette
- [ ] Test end-to-end con Playwright e prova con pacchetti SCORM reali
- [ ] Prova su una copia, primo rilascio su Coolify
- [ ] Le due settimane servono anche da cuscinetto per SCORM

## 7. File / moduli impattati
Progetto nuovo: un solo repository Next.js (App Router) con questi moduli.
- `modules/auth` — Better Auth, ruoli
- `modules/courses` — corsi, lezioni, iscrizioni
- `modules/progress` — progressi e regole di completamento
- `modules/files` — upload e streaming
- `modules/scorm` — estrazione, player e API SCORM
- `modules/i18n` — `next-intl` e file di traduzione
- `db/` — schema Drizzle e migrazioni

## 8. Test e verifica
- [ ] Test unitari con Vitest: permessi per corso, tracciamento dei progressi, API SCORM 1.2.
- [ ] Test end-to-end con Playwright sui flussi principali (login, iscrizione, lezione, SCORM).
- [ ] Prova con pacchetti SCORM 1.2 reali, verificando il completamento.
- Criteri di accettazione:
  - Un admin crea un corso, assegna un docente e iscrive uno studente.
  - Il docente carica una lezione di testo, un file, un video MP4 e un pacchetto SCORM 1.2.
  - Lo studente vede solo i corsi a cui è iscritto, completa le lezioni e vede il progresso.
  - Un pacchetto SCORM reale registra il completamento e il corso risulta completato.
  - Una stessa persona è docente in un corso e studente in un altro, con i permessi corretti.
  - Il tutto gira su Coolify con HTTPS, e i test unitari ed end-to-end passano.

## 9. Rischi e dipendenze
| Rischio / Dipendenza | Impatto | Mitigazione |
|----------------------|---------|-------------|
| SCORM: pacchetti non standard o con comportamenti particolari | Alto, può occupare molte settimane | Solo SCORM 1.2; testare con pacchetti reali presto |
| Storage su directory del server: nessuna ridondanza | Medio, perdita dei file se il disco si guasta | Backup non previsti per ora (scelta accettata); da rivedere prima di usare dati reali |
| Un solo sviluppatore, 6-8 settimane | Medio | Tenere l'MVP minimo |

## 10. Domande aperte
- Nessuna al momento.

## 11. Rollout / Rollback
- Repository Git su GitHub collegato a Coolify, con deploy automatico dal ramo `main`.
- Un solo ambiente (produzione). Prima del primo rilascio con dati reali, prova su una copia.
- Rollback: ripristino dell'immagine precedente da Coolify.

## 12. Note e log decisioni
- 2026-11-09 — Progetto da zero per una sola organizzazione, senza migrazione.
- 2026-11-09 — Ruoli studente/docente relativi al corso; admin globale.
- 2026-11-09 — MVP: corsi, lezioni, iscrizioni, progressi e SCORM; quiz, certificati, forum e pagamenti rimandati.
- 2026-11-09 — Stack: TypeScript, Next.js, PostgreSQL.
- 2026-11-09 — Team di una persona, 6-8 settimane.
- 2026-11-09 — SCORM: solo 1.2 nell'MVP.
- 2026-11-09 — Solo l'admin crea i corsi e assegna i docenti.
- 2026-11-09 — Autenticazione con Better Auth, email e password; login social in futuro.
- 2026-11-09 — File, video e SCORM in una directory del server (no storage a oggetti, no hosting serverless).
- 2026-11-09 — Interfaccia in italiano con accessibilità di base; localizzazione in inglese prevista.
- 2026-11-09 — Hosting: VPS Linux con Coolify, tutto in container.
- 2026-11-09 — Backup rimandati (rischio accettato per ora).
- 2026-11-09 — Video: MP4 con range request, senza transcodifica.
- 2026-11-09 — SCORM in iframe da sottodominio separato, con tracciamento del completamento.
- 2026-11-09 — i18n con `next-intl`.
- 2026-11-09 — Test: Vitest, Playwright e pacchetti SCORM reali.
- 2026-11-09 — Player SCORM nel sottodominio separato, con API esposta lì e salvataggio sull'app con token a breve scadenza.
- 2026-11-09 — Regole di completamento: SCORM dallo stato del pacchetto, testo e file col pulsante, video al 90%, corso a lezioni tutte completate.
- 2026-11-09 — Upload solo per admin e docenti del corso; limiti configurabili da env.
- 2026-11-09 — Fasi in cinque tappe, con SCORM prima dei video perché è il punto più rischioso.
- 2026-11-09 — Un solo repository con moduli separati; Drizzle come ORM.
- 2026-11-09 — Rollout: GitHub, deploy da `main` con Coolify, un ambiente, rollback all'immagine precedente.
