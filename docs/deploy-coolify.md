# Rilascio su Coolify

Guida al primo rilascio di NewLMS su un VPS con Coolify. I passaggi dentro Coolify non sono stati provati
da chi ha scritto questa guida: lo stack è stato verificato solo in locale con Docker Compose (vedi
"Prova su una copia"). Controlla ogni passaggio sull'interfaccia della tua versione di Coolify.

## Cosa serve

- Repository su GitHub con il ramo `main`.
- Due nomi di dominio che puntano al VPS, **sotto lo stesso dominio registrato**:
  - uno per l'app, per esempio `lms.example.com`;
  - uno per i contenuti SCORM, per esempio `scorm.example.com`.
- Coolify con accesso al repository.

I due domini devono essere diversi: l'app non parte se `SCORM_ORIGIN` ha lo stesso host di `BETTER_AUTH_URL`.

## Prova su una copia (in locale)

Prima di toccare il server, avvia lo stesso stack che userà Coolify:

```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export BETTER_AUTH_URL=http://localhost:3200
export SCORM_ORIGIN=http://scorm.localhost:3200
export SEED_ADMIN_EMAIL=admin@example.com
export SEED_ADMIN_PASSWORD='una-password-di-almeno-10-caratteri'
docker compose -p newlms-trial -f docker-compose.yml -f docker-compose.local.yml up -d --build --wait
```

Apri `http://localhost:3200`, accedi con l'admin, crea un corso e carica un pacchetto SCORM reale.
Per rimuovere tutto, dati compresi:

```bash
docker compose -p newlms-trial -f docker-compose.yml -f docker-compose.local.yml down -v
```

## Configurazione in Coolify

1. **Nuova risorsa** dal repository GitHub, ramo `main`, tipo **Docker Compose**, file `docker-compose.yml`.
2. **Domini** del servizio `app` (porta 3000): assegna **entrambi** i domini, quello dell'app e quello SCORM.
   Il servizio `db` non deve avere domini né porte pubblicate.
3. **Variabili d'ambiente**:

   | Variabile | Valore |
   |-----------|--------|
   | `POSTGRES_PASSWORD` | password casuale lunga |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | `https://lms.example.com` |
   | `SCORM_ORIGIN` | `https://scorm.example.com` |
   | `SEED_ADMIN_EMAIL` | email del primo amministratore |
   | `SEED_ADMIN_PASSWORD` | password iniziale (almeno 10 caratteri) |

   Facoltative: `SEED_ADMIN_NAME`, `MAX_FILE_UPLOAD_MB` (100), `MAX_SCORM_UPLOAD_MB` (500),
   `MAX_SCORM_EXTRACTED_MB` (2000), `MAX_VIDEO_UPLOAD_MB` (1024).

   Non cambiare `BETTER_AUTH_SECRET` dopo il rilascio: invaliderebbe le sessioni e i link SCORM aperti.
4. **Volumi**: `newlms-files` (file, video e pacchetti SCORM) e `newlms-db` (database) sono definiti nel
   file compose e devono restare persistenti tra un rilascio e l'altro.
5. **Limite di upload del proxy**: i video arrivano fino a 1 GB e i pacchetti SCORM fino a 500 MB.
   Verifica che il proxy di Coolify (Traefik o Caddy) non imponga un limite più basso al corpo delle
   richieste e che il timeout basti per la tua connessione.
6. **Deploy automatico**: attiva il deploy a ogni push su `main`.

## Primo avvio

All'avvio il container applica le migrazioni del database e, se non esiste ancora un amministratore,
lo crea da `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD`. Nei log devono comparire:

```
[startup] database migrations applied
[startup] first admin created: …
```

Dopo il primo accesso rimuovi `SEED_ADMIN_PASSWORD` dalle variabili: non serve più.

## Controlli dopo il rilascio

- `https://lms.example.com/api/health` risponde `{"status":"ok"}`.
- `https://lms.example.com/login` mostra la pagina di accesso e l'admin riesce a entrare.
- `https://scorm.example.com/login` risponde 404 (sull'host SCORM non esiste l'app).
- Crea un corso, carica una lezione di testo, un file, un video MP4 e un pacchetto SCORM reale.
- Con un utente studente iscritto: apri la lezione SCORM, sospendi, riapri (deve riprendere), completa.
  Il corso deve risultare completato.
- Riavvia il servizio da Coolify: file e dati devono essere ancora presenti.

## Rollback

Da Coolify ripristina il deploy precedente (immagine precedente). Attenzione alle migrazioni: se la
versione più recente ha modificato lo schema, l'immagine precedente potrebbe non funzionare con il
database aggiornato. Finché i dati non sono reali, il modo più semplice è ripartire da un database vuoto.

## Prima di usare dati reali

- **Backup**: non sono previsti (rischio accettato nel piano). Prima di inserire dati reali attiva almeno
  il backup del database da Coolify e una copia periodica del volume `newlms-files`.
- **Pacchetti SCORM reali**: prova quelli che userai davvero; il player è stato verificato solo con un
  pacchetto minimo di test.
- **Email**: l'app non invia email. Le password iniziali vanno comunicate agli utenti a parte, e non
  esiste il recupero della password: un admin deve creare un nuovo account.
