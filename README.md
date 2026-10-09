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
- [ ] Run both applications locally
- [ ] Replace sample data with PostgreSQL
- [ ] Add a real create-OoTD flow

## Local prerequisites

- Node.js 22+ and npm
- Go 1.22+
- PostgreSQL (needed in the next milestone, not yet for the sample API)

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

Useful starter endpoints:

```text
GET /health
GET /v1/outfits
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
