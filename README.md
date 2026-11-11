# NewLMS

Learning Management System per una singola organizzazione. Il piano completo dell'MVP è in [PLAN/plan.md](PLAN/plan.md).

Stack: Next.js (App Router) · TypeScript · PostgreSQL · Drizzle ORM · Better Auth · next-intl · Tailwind CSS.

## Sviluppo in locale

Requisiti: Node 22, pnpm, Docker.

```bash
cp .env.example .env        # poi imposta BETTER_AUTH_SECRET (openssl rand -base64 32) e SEED_ADMIN_*
pnpm install
pnpm db:up                  # PostgreSQL su localhost:5433
pnpm db:migrate             # applica le migrazioni
pnpm seed:admin             # crea il primo admin da SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
pnpm dev                    # http://localhost:3000
```

## Script

| Script | Cosa fa |
|--------|---------|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | TypeScript, ESLint, Vitest |
| `pnpm db:up` / `pnpm db:down` | PostgreSQL di sviluppo (Docker) |
| `pnpm db:generate` | genera una migrazione dallo schema in `db/schema` |
| `pnpm db:migrate` | applica le migrazioni |
| `pnpm auth:schema` | rigenera `db/schema/auth.ts` dopo aver cambiato i plugin di Better Auth |
| `pnpm seed:admin` | crea (o promuove) il primo admin |
| `pnpm e2e` | test end-to-end con Playwright (vedi sotto) |
| `pnpm fixture:scorm` | crea `tests/fixtures/scorm/basic.zip`, un pacchetto SCORM 1.2 minimo per provare il player |
| `pnpm seed:dev` | solo sviluppo: crea `docente@newlms.test` e `studente@newlms.test` con la password `SEED_DEV_PASSWORD` |

## Struttura

- `app/` — pagine e API (App Router). `app/(app)/` contiene le pagine autenticate.
- `modules/auth` — Better Auth, sessione, ruoli globali.
- `modules/courses` — corsi, lezioni, iscrizioni; le regole dei permessi sono in `permissions.ts`.
- `modules/progress` — regole di completamento e progressi.
- `modules/files` — storage su disco (`FILES_DIR`), upload e download.
- `modules/i18n` — configurazione `next-intl`; i testi sono in `messages/it.json`.
- `modules/config` — variabili d'ambiente validate (limiti di upload, directory dei file).
- `db/` — schema Drizzle e migrazioni SQL.

- `modules/scorm` — pacchetti SCORM 1.2: estrazione sicura, manifest, API (`window.API`), token di avvio e tracciamento.
- `proxy.ts` — separa l'host dell'app dall'host SCORM.

I video (MP4, senza transcodifica) usano `modules/files` per upload e streaming con range request, e `modules/progress/video.ts` per la regola del 90% guardato.

## Convenzioni

- **Permessi**: ogni pagina, server action e route handler chiama `requireUser()` / `requireAdmin()` da `modules/auth/session.ts`. Il layout non protegge le pagine.
- **Pagine autenticate**: il contenuto che legge la sessione va dentro `<Suspense fallback={<PageFallback />}>` (richiesto da Cache Components per avere navigazioni istantanee).
- **Corsi**: pagine e azioni ottengono il corso con `getViewableCourse()` / `getManageableCourse()` (`modules/courses/access.ts`); chi non ha accesso riceve un 404.
- **File**: mai serviti direttamente; si scaricano da `/api/files/[id]` dopo il controllo dell'iscrizione, sempre come allegato.
- **Video**: si guardano da `/api/videos/[id]` dopo il controllo dell'iscrizione. Il player invia gli intervalli riprodotti e il server ne calcola l'unione: saltare in avanti non conta come visto.
- **Testi**: nessuna stringa visibile nel codice; tutto passa da `messages/it.json`.
- **Utenti**: la registrazione pubblica è disattivata; gli account li crea un admin da `/admin/users`.

## Test end-to-end

`pnpm e2e` costruisce l'app in modalità produzione, la avvia sulla porta 3100 con un database dedicato
(`newlms_e2e`, ricreato a ogni esecuzione) e una cartella file dedicata, poi esegue i flussi principali:
login, creazione di corsi e ruoli, caricamento di lezioni di testo, file, video e SCORM, completamento del
corso da studente, separazione degli host. In ogni pagina principale controlla anche l'accessibilità
(WCAG 2.1 A/AA, regole verificabili in automatico con axe).

Requisiti: PostgreSQL di sviluppo avviato (`pnpm db:up`) e Google Chrome installato (il Chromium di
Playwright non riproduce i video H.264).

## SCORM

- I pacchetti sono codice di terzi, quindi girano su un'origine separata (`SCORM_ORIGIN`), servita dalla stessa app. In sviluppo è `http://scorm.localhost:3000`, senza configurazione aggiuntiva.
- La pagina della lezione incorpora il player (`/scorm/<token>/player`) con un token firmato, valido 4 ore, legato a un utente e a una lezione. Il player e il salvataggio ricontrollano l'iscrizione nel database; i file del pacchetto controllano solo il token.
- Le due origini sono sullo stesso *sito*: ogni endpoint dell'app che modifica dati deve controllare l'origine della richiesta (`isAppOriginRequest`), come già fanno server action e Better Auth.
- Limiti noti dell'MVP: solo SCORM 1.2; nei pacchetti con più SCO viene avviato solo il primo; un solo tentativo per utente, che si può riprendere.

## Deploy (Coolify)

La guida completa, con la prova locale dello stack di produzione, è in [docs/deploy-coolify.md](docs/deploy-coolify.md).

- `Dockerfile` produce l'immagine dell'app (output `standalone`). All'avvio il container applica le migrazioni e crea il primo admin da `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, se non ne esiste già uno.
- `docker-compose.yml` definisce app + PostgreSQL con i volumi persistenti `newlms-files` (file, video, SCORM) e `newlms-db`.
- Servono due domini instradati alla stessa app: `BETTER_AUTH_URL` e `SCORM_ORIGIN`.
- Health check: `GET /api/health`.
