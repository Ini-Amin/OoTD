# OoTD

A creator-first fashion discovery platform where people share outfits, discover styles, save inspiration, and optionally attach product or affiliate links.

## Built during the Meta Global AI Developer Hackathon (Oct 27 – Nov 4, 2026)

Two AI features powered by Meta's **Muse Spark** (Meta Model API, Baseten as fallback):

- **✨ Magic Tag** — paste an outfit photo URL on `/new` and the AI auto-generates the title, caption, style tags, and per-piece bounding boxes. (`POST /v1/analyze`)
- **💬 AI Stylist** — chat for outfit advice in Indonesian, with hijab and tropical-weather context. (`POST /v1/stylist`)

Implementation: `api/internal/ai/`. Note: Muse Spark is a reasoning model — it spends ~1900 tokens on chain-of-thought, so `max_tokens` is set to 4000 in `api/internal/ai/client.go`.

**3D Mannequin + Closet** (`/mannequin`, built before the hackathon): a rotatable Three.js dress-form figure. Save garment pieces from any outfit into your closet, tap to try them on the mannequin (photo-textured 3D garments), then find similar looks or request a craftsman.

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
SUPABASE_URL   project URL; the API verifies Supabase Auth JWTs against its JWKS
PORT           default 8080
ALLOWED_ORIGIN web origin for CORS, default http://localhost:5173
```

Web env (`web/.env`): `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the anon key is public by design). Never put the service-role key in `web/`.

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

## MCP server

`api/cmd/mcp` exposes one MCP tool over stdio — `identify_outfit` — so an AI
assistant can identify garments in an outfit photo. It reuses the same
`internal/ai` client as `POST /v1/analyze` (no duplicated AI logic) and
returns `{pieces: [{category, label, description}]}`. There is no price data
in this repo, so every piece reports `"price": null` with a `price_note`
explaining a catalog is needed — prices are never invented.

Build:

```sh
cd api
go build -o /tmp/ootd-mcp ./cmd/mcp
```

Required env (same AI settings as the API; no database needed):

```text
AI_BASE_URL      e.g. https://api.meta.ai/v1
AI_API_KEY       secret key
AI_VISION_MODEL  e.g. muse-spark-1.3
AI_CHAT_MODEL    e.g. muse-spark-1.3
```

Claude Code (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "ootd-outfit": {
      "command": "/tmp/ootd-mcp",
      "env": {
        "AI_BASE_URL": "https://api.meta.ai/v1",
        "AI_API_KEY": "...",
        "AI_VISION_MODEL": "muse-spark-1.3",
        "AI_CHAT_MODEL": "muse-spark-1.3"
      }
    }
  }
}
```

## Learning rule

We will add one vertical feature at a time and understand it before continuing:

1. Static feed and API contract
2. PostgreSQL-backed outfits
3. Profiles
4. Create an OoTD
5. Likes and saves
6. Auth and authorization
