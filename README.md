# QuickSketch

Piattaforma web ispirata a Pictionary, realizzata per il corso di Tecnologie Web (traccia 4.A).
Gli utenti registrati scelgono una parola da un insieme predefinito, la disegnano su una canvas
entro un tempo limitato e pubblicano lo sketch. Gli altri utenti provano a indovinare la parola
in massimo 10 tentativi. La piattaforma gestisce classifiche e statistiche personali.

## Stack tecnologico

| Livello    | Tecnologia |
|------------|------------|
| Front-end  | Angular 20 (componenti standalone), SPA responsive |
| Back-end   | NestJS 11 (TypeScript), API REST |
| Database   | PostgreSQL 16 |
| ORM        | Prisma 6 |
| Auth       | JWT (Passport) + hashing password con Argon2 |
| Canvas     | HTML5 Canvas nativa |
| Test E2E   | Playwright |
| Unit test  | Jasmine/Karma (front-end), Jest (back-end) |

## Struttura del repository

```
.
├── backend/          API NestJS, Prisma, autenticazione, logica di gioco
├── frontend/         Single Page Application Angular
├── e2e/              Test End-to-End Playwright
├── docker-compose.yml  Database PostgreSQL
└── README.md
```

## Prerequisiti

- Node.js 20.19+ e npm
- Docker (per il database PostgreSQL)

## Configurazione

Le variabili d'ambiente del back-end sono in `backend/.env`. Un file di esempio è disponibile
in `backend/.env.example`. Per partire è sufficiente copiarlo:

```bash
cp backend/.env.example backend/.env
```

Variabili principali:

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `DATABASE_URL` | Stringa di connessione PostgreSQL | localhost:5432 |
| `JWT_SECRET` | Segreto per firmare i token JWT | da impostare |
| `JWT_EXPIRES_IN` | Durata del token | `1d` |
| `CORS_ORIGIN` | Origine consentita per il front-end | `http://localhost:4200` |
| `DRAW_TIME_LIMIT_SECONDS` | Durata della fase di disegno | `60` |
| `MAX_GUESSES` | Tentativi massimi per sketch | `10` |
| `MAX_IMAGE_BYTES` | Dimensione massima del disegno | `1500000` |

## Avvio passo-passo

### 1. Database

Dalla cartella radice del progetto:

```bash
docker compose up -d
```

Avvia un container PostgreSQL sulla porta 5432.

### 2. Back-end

```bash
cd backend
npm install
npm run prisma:migrate     # applica le migrazioni (al primo avvio)
npm run prisma:seed        # popola parole, utenti, sketch e partite di esempio
npm run start:dev          # avvia l'API su http://localhost:3000
```

### 3. Front-end

In un nuovo terminale:

```bash
cd frontend
npm install
npm start                  # avvia la SPA su http://localhost:4200
```

Aprire il browser su `http://localhost:4200`.

## Account demo

Il seed crea quattro utenti, tutti con password `password123`:

- `alice`
- `bob`
- `carol`
- `dave`

Sono già presenti sketch pubblicati e partite concluse, così classifiche e statistiche
sono popolate fin da subito.

## Test End-to-End

I test Playwright avviano automaticamente back-end e front-end e ripopolano il database
prima dell'esecuzione. È sufficiente che il container del database sia attivo.

```bash
cd e2e
npm install
npx playwright install chromium    # solo la prima volta
npm test
```

Sono implementati 11 scenari che coprono registrazione, login/logout, permessi degli utenti
anonimi, creazione di uno sketch, scadenza del timer, vittoria, sconfitta con rivelazione della
soluzione, blocco di una partita già conclusa, aggiornamento delle classifiche e statistiche.

## Requisiti di sicurezza

- **La parola non raggiunge mai il client durante il gioco.** Le risposte della galleria e del
  dettaglio non includono la parola; viene rivelata solo all'autore o al giocatore che ha vinto
  o perso la partita. Il confronto dei tentativi avviene esclusivamente lato server.
- **Timer validato lato server.** All'avvio di uno sketch il server registra `startedAt`; alla
  pubblicazione verifica che il tempo trascorso non superi il limite (più una piccola tolleranza),
  rendendo inutile manomettere il timer nel front-end.
- **Password** salvate solo come hash Argon2.
- **Autorizzazione lato server** su ogni endpoint sensibile tramite guard JWT; la separazione dei
  permessi nel front-end (guard di rotta, UI) è solo un complemento.
- **Validazione e sanitizzazione** degli input con `class-validator` e `ValidationPipe` globale
  (whitelist + `forbidNonWhitelisted`).
- **Upload del disegno** limitato come formato (solo PNG in data URL) e come dimensione.
- **JWT** con scadenza e segreto fuori dal codice sorgente, in variabili d'ambiente.

## Modello dei dati

- **User**: credenziali (hash Argon2) e profilo.
- **Word**: insieme predefinito di parole, popolato dal seed.
- **Sketch**: autore, parola, immagine PNG, stato (DRAFT/PUBLISHED), `startedAt`, `publishedAt`.
- **Game**: relazione tra un giocatore e uno sketch, con stato (IN_PROGRESS/WON/LOST). Vincolo di
  unicità `(sketch, player)`: ogni utente può giocare uno sketch una sola volta.
- **Guess**: singolo tentativo, con esito.

## Classifiche e statistiche

- **Migliori disegnatori**: ordinati per percentuale di partite vinte dagli altri sui propri
  sketch (vinte / concluse). Sono inclusi i disegnatori con almeno una partita conclusa sui
  propri sketch; a parità di percentuale prevale chi ha più sketch indovinati.
- **Migliori giocatori**: ordinati per numero di parole indovinate.
- **Statistiche personali**: disegni prodotti, parole indovinate, parole non indovinate, tentativi
  totali usati, partite in corso e percentuale di successo dei propri disegni.

## Endpoint principali (REST)

| Metodo | Endpoint | Auth | Descrizione |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | no | Registrazione |
| POST | `/api/auth/login` | no | Login |
| GET | `/api/auth/me` | sì | Utente corrente |
| GET | `/api/words` | sì | Parole disponibili |
| GET | `/api/sketches` | opzionale | Galleria pubblica |
| GET | `/api/sketches/:id` | opzionale | Dettaglio sketch |
| POST | `/api/sketches/start` | sì | Avvia uno sketch (timer) |
| POST | `/api/sketches/:id/publish` | sì | Pubblica il disegno |
| GET | `/api/games/sketch/:id` | sì | Stato della partita |
| POST | `/api/games/sketch/:id/guess` | sì | Invia un tentativo |
| GET | `/api/leaderboard/drawers` | no | Classifica disegnatori |
| GET | `/api/leaderboard/players` | no | Classifica giocatori |
| GET | `/api/stats/me` | sì | Statistiche personali |
