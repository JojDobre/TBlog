# Bytezone

Tech blog s recenziami a rebríčkami.
Express + MariaDB + EJS, vlastný CMS.

---

## Predpoklady

| Vec | Verzia | Pozn. |
|---|---|---|
| Node.js | 20+ | testované na 22.14 |
| Docker Desktop | aktuálna | s WSL2 backendom na Windowse |
| Git | aktuálna | |

Voliteľne: **VS Code** s odporúčanými rozšíreniami (Code ti ich ponúkne sám pri otvorení projektu — pozri `.vscode/extensions.json`).

---

## Prvotný setup (jednorazovo)

```bash
# 1. Naklonovať repo
git clone <url> bytezone
cd bytezone

# 2. Nainštalovať závislosti
npm install

# 3. Vytvoriť .env zo šablóny
cp .env.example .env
#   (na Windowse v PowerShell:)  copy .env.example .env

# 4. Vygenerovať bezpečný SESSION_SECRET a vložiť do .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 5. Spustiť MariaDB + phpMyAdmin lokálne
docker compose up -d

# 6. Overiť že DB beží
#    Otvor http://localhost:8080
#    Server: mariadb  |  User: bytezone_app  |  Heslo: applocaldev
#    Mala by tam byť prázdna DB `bytezone_dev`.
```

---

## Bežné príkazy

```bash
# Aplikácia
npm run dev                  # vývojový server (auto-reload cez nodemon)
npm start                    # produkčný server

# Databáza (Docker)
npm run db:up                # zapnúť MariaDB + phpMyAdmin
npm run db:down              # zastaviť (dáta zostanú)
npm run db:reset             # zastaviť + zmazať dáta (čistý reštart)
npm run db:logs              # pozrieť logy MariaDB

# Migrácie a seedy (knex)
npm run migrate              # spustiť všetky čakajúce migrácie
npm run migrate:rollback     # vrátiť poslednú migráciu
npm run migrate:status       # ktoré migrácie sú spustené
npm run migrate:make <name>  # vytvoriť novú migráciu
npm run seed                 # spustiť všetky seedy
npm run seed:make <name>     # vytvoriť nový seed súbor

# Setup
npm run setup:admin          # interaktívne vytvoriť admin účet (po migráciách)

# Kvalita kódu
npm run lint
npm run format
```

---

## Štruktúra projektu

```
bytezone/
├── backend/               # Node.js aplikácia
│   ├── src/               # Express server, routes, biznis logika
│   ├── migrations/        # knex migrácie (verziovaná schéma)
│   ├── seeds/             # inicializačné dáta
│   └── scripts/           # utility scripty (setup admina, atď.)
├── frontend/              # Verejná časť — TVOJ priestor
│   ├── views/             # EJS šablóny verejných stránok
│   └── public/            # CSS, JS, statické obrázky
├── uploads/               # nahrané súbory (gitignored)
├── docs/                  # dokumentácia projektu
│   └── db-schema-v1.md    # návrh databázy
├── .vscode/               # odporúčané rozšírenia + nastavenia
├── docker-compose.yml     # lokálna MariaDB + phpMyAdmin
├── knexfile.js            # konfigurácia knex
├── config.js              # globálna konfigurácia (verejné nastavenia)
├── .env.example           # šablóna pre .env
└── package.json
```

---

## Architektúra

Jediná Node.js aplikácia (Express) obsluhuje tri vrstvy URL:

| Prefix | Účel | Renderovanie |
|---|---|---|
| `/admin/*` | Admin panel | EJS + Bootstrap, len pre admin/editor |
| `/api/*` | REST API | JSON, pre admin SPA bity a budúce použitie |
| `/`, `/article/:slug`, `/categories/:slug` ... | Verejný web | SSR EJS s tvojím CSS |

**Frontend** je adresár tvojich šablón a štýlov, ktoré ti backend nakŕmi dátami.
**Backend** obsahuje admin UI aj všetku biznis logiku.

---

## Konfigurácia

Dva zdroje:

- **`.env`** — citlivé údaje (DB heslo, session secret). V `.gitignore`. Príklad v `.env.example`.
- **`config.js`** — verejné/odvodené (názov webu, počty per page, limity uploadu). Commitované.

Aplikácia sa pýta na konfiguráciu vždy z `config.js`, nie cez `process.env`. To je jediný "import point" pre konfiguráciu.

V budúcnosti niektoré z týchto nastavení (názov webu, počet článkov per page) prevezme tabuľka `settings` v DB, aby ich admin vedel meniť bez deployu.

---

## Dokumentácia

- **Návrh databázy:** [`docs/db-schema-v1.md`](docs/db-schema-v1.md) — všetky tabuľky, vzťahy, indexy, JSON štruktúra blokového obsahu.
- **Fázy vývoja:** dohodnuté v projekte (Fáza 0 = DB, Fáza 1 = setup, ... Fáza 16 = deploy).

---

## Bezpečnosť

- Heslá hashované cez bcrypt (cost 12)
- Sessions v DB, httpOnly cookies, SameSite=Lax
- CSRF cez `csrf-csrf` (double-submit cookie)
- Helmet (security headers), express-rate-limit, parametrizované queries
- HTML z editora sanitizovaný cez DOMPurify pred uložením
- IP v štatistikách iba ako SHA-256 hash s denným saltom (GDPR)

Detaily: `docs/db-schema-v1.md`, sekcia 10.

---

## Stav vývoja

Projekt v **Fáze 1.1 — setup prostredia**. Express server zatiaľ neexistuje (príde vo Fáze 1.3).

Aktuálne funkčné: lokálna DB cez Docker, štruktúra projektu, závislosti.
