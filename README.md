# OoTD

A creator-first fashion discovery platform where people share outfits, discover styles, save inspiration, and optionally attach product or affiliate links.

This repository is being built as a learning project. The first milestone is intentionally small: a SvelteKit feed UI and a Go API that returns sample outfit data.

## Repository layout

```text
web/                  SvelteKit frontend
api/                  Go HTTP API
PRODUCT_PLAN.md       Product direction and roadmap
TECHNICAL_REQUIREMENTS.md
                      Architecture, safety, and technical requirements
```

## First milestone

- [x] SvelteKit application scaffold
- [x] Go API structure and sample endpoints
- [x] Run both applications locally
- [x] Replace sample data with PostgreSQL (`api/migrations/`)
- [x] 7 curated profile theme presets (`themes` table, picker on the feed)
- [x] Add a real create-OoTD flow (`/new` form, `POST /v1/outfits`, `GET /v1/users`)

## Local prerequisites

- Node.js 22+ and npm
- Go 1.22+
- PostgreSQL 16+ (local server for the API; Supabase or any Postgres works via `DATABASE_URL`)

## Run the web app

```sh
cd web
npm install
npm run dev
```

The web app runs at `http://localhost:5173` by default.

## Run the API

```sh
cd api
go run ./cmd/api
```

The API runs at `http://localhost:8080` by default.

Required env (copy `api/.env.example` to `api/.env`; the API does not read `.env` itself, so export it or use `set -a; . ./.env`):

```text
DATABASE_URL   Postgres connection string
PORT           default 8080
ALLOWED_ORIGIN web origin for CORS, default http://localhost:5173
```

Local Postgres without Docker:

```sh
initdb -D api/tmp/pgdata -U ootd --auth=trust
pg_ctl -D api/tmp/pgdata -o "-p 5433 -k /tmp -c listen_addresses=''" -l api/tmp/pg.log start
createdb -h /tmp -p 5433 -U ootd ootd
```

Migrations in `api/migrations/*.sql` are applied automatically on API start. Set `VITE_API_URL` in `web/.env` if the API is not on `localhost:8080`.

Useful starter endpoints:

```text
GET /health
GET /v1/outfits
GET /v1/themes
GET /v1/users
POST /v1/outfits
GET /v1/outfits/{id}     (includes tagged pieces)
GET /v1/users/{username}
GET /v1/search?q=        (keyword search over styles, piece types, words)
POST /v1/requests        (craftsmaker request)
```

The frontend shows preview data when the API is not running, then automatically uses the API when it becomes available.

## Learning rule

We will add one vertical feature at a time and understand it before continuing:

1. Static feed and API contract
2. PostgreSQL-backed outfits
3. Profiles
4. Create an OoTD
5. Likes and saves
6. Auth and authorization
