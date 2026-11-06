# Ingest mention sosmed (generik)

Penerima webhook generik + antrean + worker auto-tag. Ini BUKAN integrasi
platform: tidak ada aplikasi Meta/TikTok/X, token, atau subscription di sini.
Pengirim event adalah integrasi masa depan — atau simulator di bawah.

## Kontrak

- `POST /v1/ingest/mentions` — tanpa auth user; diamankan HMAC-SHA256 atas raw
  body memakai shared secret env `MENTION_WEBHOOK_SECRET`.
  Header: `X-Ootd-Signature: t=<unix>,v1=<hex>` (toleransi skew 5 menit).
  Body ≤ 64KB, `DisallowUnknownFields`:
  `{platform, external_id, author_handle?, image_url, caption?, occurred_at?}`.
  - `202 {id, status:"queued"}` bila baru.
  - `200 {id, status, duplicate:true}` bila `external_id` sudah ada (replay aman).
  - `503` bila env secret kosong; `401` bila signature salah; `429` bila limit.
- `GET /v1/ingest/mentions?status=` — butuh auth user; pantau antrean + snapshot
  `result` (brand/price_estimate/sources per piece).
- Rate limit: 120/jam per IP pengirim dan per platform.
- Worker (`ingest_worker.go`, jalan di proses API, interval env
  `INGEST_WORKER_INTERVAL_SECS` default 10 dtk): klaim batch via
  `SELECT ... FOR UPDATE SKIP LOCKED` → `AnalyzeOutfit` → `sanitizePieces` →
  `EstimatePrice` per piece → tulis outfit draft (`visibility=private`,
  `status=draft`, author `ootd_bot`) + pieces dalam satu transaksi → `done`
  dengan `outfit_id` + `result`. Gagal → antre lagi maks 3x lalu `failed`.
  Tanpa `AI_API_KEY`, item langsung `failed` (`ai not configured`).

## Simulator (pengganti "platform")

```sh
export API=http://localhost:8080 MENTION_WEBHOOK_SECRET=dev-secret
BODY='{"platform":"instagram","external_id":"sim-001","author_handle":"@brand","image_url":"https://picsum.photos/seed/fit1/600/800","caption":"OOTD!","occurred_at":"2026-11-06T10:00:00Z"}'
T=$(date +%s)
SIG="t=$T,v1=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$MENTION_WEBHOOK_SECRET" | awk '{print $2}')"
curl -s -X POST "$API/v1/ingest/mentions" -H "Content-Type: application/json" \
  -H "X-Ootd-Signature: $SIG" -d "$BODY"; echo
# Pantau (butuh JWT user):
curl -s "$API/v1/ingest/mentions" -H "Authorization: Bearer $JWT" | head -c 2000; echo
```

## Skema

`api/migrations/0015_mentions.sql` (Postgres polos): tabel `social_mentions`
(`external_id` unik untuk idempotensi, `result jsonb` snapshot identify,
`outfit_id` tautan draft, index parsial antrean) + seed user sistem `ootd_bot`.
