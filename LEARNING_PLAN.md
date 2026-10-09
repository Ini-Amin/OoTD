# OoTD Learning Plan — Build From Scratch

> Build OoTD one understandable feature at a time. The goal is not only to finish an app; it is to understand how a real social-fashion product works.

## 1. Goal

By following this plan, you will learn to build a small but real version of OoTD:

- Public fashion profiles
- OoTD outfit posts
- A discovery feed
- Likes and saves
- Profile themes and movable sections
- A Go API
- PostgreSQL data storage
- Basic safety features

Later, after the core product works, you can add product links, brand catalogs, styling requests, affiliate tracking, and other marketplace features.

## 2. Stack

### Backend and data

```text
Go                 API, business rules, background workers
PostgreSQL         Main database
S3-compatible storage
                   Outfit/profile images later
```

### Frontend: choose one before Phase 2

Do **not** learn Astro and SvelteKit at the same time for this project. Pick one.

| Choice | Best when | Trade-off |
|---|---|---|
| **SvelteKit** | OoTD is app-first: interactive feed, profile editor, create form, likes, comments | More JavaScript shipped than Astro for static pages |
| **Astro** | OoTD is content-first: public profiles, discover pages, excellent SEO, fast initial load | Interactive features require islands/client-side components |

The current repository has a SvelteKit scaffold in `web/`. If you decide to use Astro, replace that scaffold **before Phase 2**, while there is still very little frontend code.

## 3. Learning method

For every phase:

1. **Learn the concept** — understand why the tool or pattern exists.
2. **Build one small result** — avoid building several features at once.
3. **Test it yourself** — use the browser, API requests, or automated tests.
4. **Explain it back** — write one or two sentences describing what happened.
5. **Commit it** — use a small, descriptive Git commit once Git is initialized.

### Important rule

Never copy a large solution without understanding it. Ask for an explanation of every new file, function, SQL query, or command you do not understand.

---

## 4. Current project state

| Item | Status |
|---|---|
| Product plan | Complete — `PRODUCT_PLAN.md` |
| Technical requirements | Complete — `TECHNICAL_REQUIREMENTS.md` |
| Learning plan | Complete — this file |
| SvelteKit starter | Created in `web/` |
| Go API starter | Created in `api/` |
| Go installation | Available locally: Go `1.27.1` |
| PostgreSQL client | Available: `psql` `18.6` |
| PostgreSQL server | Not installed/running yet |
| API persistence | Not started; API currently returns temporary sample data |
| Authentication | Not started |

The first app screen and API are intentionally small. That is good: you can understand them before adding complexity.

---

## 5. Phase 0 — Development foundations

**Goal:** Be comfortable opening the project, running commands, and reading its structure.

### Learn

- Terminal basics: `cd`, `ls`, `mkdir`, `cat`
- Git basics: `status`, `add`, `commit`, `log`, branches
- What frontend, backend, API, database, and environment variables mean
- How a browser sends an HTTP request to an API

### Build/check

- [ ] Install and start a local PostgreSQL server.
- [ ] Initialize Git in the repository.
- [ ] Create a first commit containing the project plans and starter code.
- [ ] Run the web app.
- [ ] Run the Go API.
- [ ] Open `GET /health` in the browser or with `curl`.

### Evidence of understanding

Be able to explain:

> The frontend shows pages to people. The Go API receives requests and decides what is allowed. PostgreSQL stores the data permanently.

---

## 6. Phase 1 — Static OoTD frontend

**Goal:** Understand UI structure before adding a database or login system.

### Learn

- Components/pages
- HTML semantics: `header`, `nav`, `main`, `section`, `article`, `button`
- CSS layout: Flexbox, Grid, responsive breakpoints
- TypeScript types
- Client-side state

### Build

- [x] OoTD home/discovery page
- [x] Outfit-card component idea
- [x] Temporary local outfit data
- [ ] Public profile-page design
- [ ] OoTD detail-page design
- [ ] Mobile navigation
- [ ] Empty/loading/error states

### Small exercise

Add a fourth local outfit to `web/src/lib/outfits.ts`, then change its title, tags, creator name, and accent color. Confirm it appears in the feed.

### Evidence of understanding

Be able to explain:

> A component is a reusable piece of interface. The feed currently loops over an array of temporary outfit objects and creates one card for each object.

---

## 7. Phase 2 — Go and HTTP API basics

**Goal:** Understand the backend before adding PostgreSQL.

### Learn

- Go packages, functions, structs, and error handling
- HTTP methods: `GET`, `POST`, `PATCH`, `DELETE`
- JSON requests and responses
- Status codes: `200`, `201`, `400`, `401`, `403`, `404`, `500`
- Why an API should validate input

### Current starter endpoints

```text
GET /health
GET /v1/outfits
```

### Build

- [x] `GET /health`
- [x] `GET /v1/outfits` with temporary data
- [ ] Add `GET /v1/outfits/{id}`
- [ ] Return `404 Not Found` for an unknown outfit
- [ ] Add API tests using Go's `net/http/httptest`
- [ ] Add structured error JSON

### Small exercise

Change one temporary outfit in `api/internal/httpapi/server.go`. Reload the browser and confirm that the frontend shows data from the Go API, not local preview data.

### Evidence of understanding

Be able to explain:

> The Go API returns JSON. The frontend calls `GET /v1/outfits`, receives JSON, and updates the feed when the API is available.

---

## 8. Phase 3 — PostgreSQL and data modeling

**Goal:** Replace temporary Go data with real database rows.

### Learn

- Tables, rows, columns, primary keys, and foreign keys
- SQL: `CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE`
- Database migrations
- Indexes
- Transactions
- Why money and timestamps need careful data types

### First database tables

Start only with these:

```text
users
profiles
outfits
outfit_media
```

Do **not** create affiliate, payment, brand, or pre-loved tables yet.

### Build

- [ ] Install/start PostgreSQL server.
- [ ] Create local database: `ootd`.
- [ ] Create migrations for `users`, `profiles`, and `outfits`.
- [ ] Add a Go database connection.
- [ ] Seed three sample users and outfits.
- [ ] Change `GET /v1/outfits` to read from PostgreSQL.
- [ ] Add pagination before the feed grows.

### Evidence of understanding

Be able to explain:

> PostgreSQL is the source of truth. The API queries the database; the frontend never connects directly to PostgreSQL.

---

## 9. Phase 4 — First real vertical slice: publish an OoTD

**Goal:** Build one complete feature from browser to database.

```text
Create OoTD form
    → Go validates input
    → PostgreSQL stores outfit
    → API returns created outfit
    → Feed displays it
```

### Learn

- Form handling
- Request validation
- Server-side authorization preparation
- `POST` requests and `201 Created`
- Database transactions
- Optimistic vs. confirmed UI updates

### Build

- [ ] Create OoTD form with title, caption, and tags.
- [ ] Implement `POST /v1/outfits`.
- [ ] Validate required title/caption length and tag count.
- [ ] Store the outfit in PostgreSQL.
- [ ] Show the new outfit in the feed.
- [ ] Show useful form errors.
- [ ] Add API and end-to-end tests for publishing.

### Definition of done

A person can submit an outfit using the browser, reload the page, and still see it because it is stored in PostgreSQL.

---

## 10. Phase 5 — Profiles and safe themes

**Goal:** Build OoTD's personal-homepage identity without unsafe MySpace-style code execution.

### Learn

- URL parameters and public profile routes
- Ownership checks
- JSON configuration validation
- Accessibility and color contrast
- Why user-supplied HTML/CSS/JavaScript is unsafe

### Build

- [ ] Public route such as `/u/{username}`.
- [ ] Profile bio, avatar placeholder, and outfit grid.
- [ ] Built-in theme choices: color palette, font pair, grid preset.
- [ ] Save a theme selection to PostgreSQL.
- [ ] Move/reorder an allowlisted profile module.
- [ ] Prevent custom HTML, JavaScript, arbitrary CSS, and embeds.

### Later feature

A theme marketplace comes much later. First prove that people actually use and enjoy basic themes.

---

## 11. Phase 6 — Social actions

**Goal:** Make discovery useful and create reasons to return.

### Learn

- Join tables and relational modeling
- Idempotent actions
- Pagination/cursor pagination
- Rate limits
- Basic notification events

### Build in this order

1. [ ] Save an OoTD
2. [ ] Saved collections / mood boards
3. [ ] Follow a creator
4. [ ] Simple chronological feed
5. [ ] Likes
6. [ ] Comments

Start with saves, not likes. Saving is a stronger signal for a fashion-inspiration product.

---

## 12. Phase 7 — Images and media safety

**Goal:** Let users add real outfit images safely.

### Learn

- Object storage versus database storage
- Presigned uploads or controlled upload endpoints
- File validation
- Image resizing/derivatives
- EXIF/GPS privacy risks
- CDN concepts

### Build

- [ ] Allow JPEG, PNG, and WebP uploads only.
- [ ] Validate MIME type, file size, and dimensions server-side.
- [ ] Strip GPS/EXIF data where appropriate.
- [ ] Store original and display-size image versions.
- [ ] Add meaningful alt-text prompts.
- [ ] Add a moderation status before public publication.

Do not accept arbitrary file uploads.

---

## 13. Phase 8 — Discovery, search, and fairness

**Goal:** Help people find style inspiration without creating a pay-to-win feed.

### Learn

- Search indexes
- Tag normalization
- Feed candidate selection
- Ranking signals
- Product metrics and fairness metrics

### Build

- [ ] Search creators and style tags.
- [ ] Filter by style, occasion, and season.
- [ ] Add recent/followed/explore feed candidates.
- [ ] Prefer saves and meaningful engagement over raw likes.
- [ ] Give a limited exploration slot to new creators.
- [ ] Track creator and brand concentration in feed impressions.

Do **not** use affiliate commission amount as a feed-ranking signal.

---

## 14. Phase 9 — Safety, moderation, and external links

**Goal:** Make the community safer before adding commerce.

### Learn

- Authorization versus authentication
- Report/block workflows
- Audit logs
- URL validation and SSRF protection
- Content moderation states

### Build

- [ ] Report an outfit, comment, user, link, or product.
- [ ] Block another user.
- [ ] Moderator-only review route.
- [ ] Audit record for sensitive decisions.
- [ ] Automated safety checks for ordinary external links.
- [ ] Strong verification workflow for brand-catalog products.

Ordinary creator links should be technically checked, not manually verified one-by-one. Brand-catalog products receive stronger verification.

---

## 15. Phase 10 — Product links and brand catalog

**Goal:** Add commerce without turning OoTD into a brand-controlled feed.

### Build

- [ ] Tag a product on an OoTD.
- [ ] Mark a link as external or affiliate.
- [ ] Track outbound clicks.
- [ ] Create verified brand-catalog pages.
- [ ] Allow brand admins to manage products only.
- [ ] Prevent brands from publishing social OoTD posts or commenting as brands.
- [ ] Keep checkout, fulfillment, returns, and delivery with merchants.

---

## 16. Later phases — only after the core loop works

Build these only when posting, saving, following, and returning are already healthy.

### Styling services

- Free, tip-based, or paid service chosen by the creator
- Styling requests and deliveries
- Clear scope and agreement
- Payment provider integration after local legal/payout requirements are understood
- Extra protection for live or in-person work

### Theme creator marketplace

- Safe theme packages only
- Accessibility/copyright moderation
- Payout/KYC rules before paid themes

### Separate pre-loved product/site

- Give-away, swap, resale, and donation flows
- Separate safety, location, payment, and shipping design
- Potentially shared OoTD identity later

---

## 17. Suggested project structure

```text
OoTD/
├── web/                       # SvelteKit now; replace with Astro only if chosen before Phase 2
│   ├── src/
│   └── package.json
├── api/
│   ├── cmd/api/               # Go HTTP server entry point
│   ├── cmd/worker/            # Future background-worker entry point
│   ├── internal/              # Private Go application packages
│   └── migrations/            # Future PostgreSQL migrations
├── PRODUCT_PLAN.md
├── TECHNICAL_REQUIREMENTS.md
├── LEARNING_PLAN.md
└── README.md
```

---

## 18. Commands you will use often

### Web

```sh
cd web
npm install
npm run dev
npm run check
npm run build
```

### Go API

```sh
cd api
go run ./cmd/api
go test ./...
go vet ./...
gofmt -w cmd/api/main.go internal/httpapi/server.go
```

### PostgreSQL later

```sh
psql -d ootd
```

---

## 19. First next task

Before adding features, complete this small setup checkpoint:

1. Install/start a PostgreSQL server.
2. Run the Go API locally.
3. Run the frontend locally.
4. Confirm the feed status changes from `Local preview data` to `Live from Go API`.

Then begin **Phase 3: PostgreSQL and data modeling**. The first database task will be creating the `users`, `profiles`, and `outfits` tables.
