# ootd-identify-outfit (MCP server, v0.2.0)

MCP stdio server exposing two tools. It reuses `internal/ai` (the same client
as `POST /v1/analyze`), so Magic Tag behavior stays identical everywhere.

## Tools

### identify_outfit

Arguments (`additionalProperties: false`):

```json
{
  "image_url": "https://example.com/fit.jpg",
  "max_pieces": 8,
  "include_price_estimate": true,
  "condition": "thrift"
}
```

- `image_url` (required): public http(s) URL.
- `max_pieces` (optional, default 8, max 20).
- `include_price_estimate` (optional, default false): when true, each piece
  carries `price_estimate`. Old calls without it behave exactly as v0.1.0
  (plus the new always-on `brand`/`sources` fields).
- `condition` (optional, `new`|`thrift`, default `new`): forwarded to estimates.

Response (`content[0].text` JSON):

```json
{
  "pieces": [
    {
      "category": "top",
      "label": "Oversized white poplin shirt",
      "description": "Oversized white poplin shirt",
      "brand": "Uniqlo",
      "price": null,
      "price_estimate": {
        "min_idr": 150000,
        "max_idr": 350000,
        "currency": "IDR",
        "confidence": "low",
        "note": "Estimasi AI, bukan harga pasar aktual"
      },
      "links": {
        "tokopedia_search": "https://www.tokopedia.com/search?q=...",
        "shopee_search": "https://shopee.co.id/search?keyword=...",
        "google_shopping": "https://www.google.com/search?tbm=shop&q=..."
      },
      "sources": [
        {"label": "Tokopedia", "url": "https://www.tokopedia.com/search?q=..."},
        {"label": "Shopee", "url": "https://shopee.co.id/search?keyword=..."},
        {"label": "Google Shopping", "url": "https://www.google.com/search?tbm=shop&q=..."}
      ]
    }
  ],
  "price_note": "OoTD has no price catalog: every piece reports price null. ..."
}
```

### estimate_price

Arguments: `{label, category?, condition?}`. Returns one range:

```json
{
  "min_idr": 150000,
  "max_idr": 350000,
  "currency": "IDR",
  "confidence": "low",
  "note": "Estimasi AI, bukan harga pasar aktual",
  "sources": [{"label": "Tokopedia", "url": "https://..."}]
}
```

## Honesty gate (jangan dilonggarkan)

- `price` selalu `null`: repo ini tidak punya katalog harga.
- `brand` hanya diisi bila logo/wordmark terlihat jelas di foto, selain itu `null`.
- `price_estimate` adalah tebakan AI low-confidence (rentang lebar), bukan harga
  pasar. Output model yang absurd (nol/negatif/desimal/min>max/>Rp1M) ditolak
  sebagai tool error — tidak pernah di-clamp. Gate-nya di `internal/ai`.
- `links`/`sources` adalah URL *pencarian* marketplace dari label, bukan
  listing/rekomendasi toko.

## Menjalankan lokal (stdio)

```sh
cd api
AI_BASE_URL=... AI_API_KEY=... AI_VISION_MODEL=... AI_CHAT_MODEL=... \
  go run ./cmd/mcp
```

Contoh sesi (satu JSON-RPC per baris; `Content-Length` framing juga diterima):

```
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"identify_outfit","arguments":{"image_url":"https://example.com/fit.jpg","include_price_estimate":true}}}
```

Tanpa `AI_API_KEY`, tools menjawab `ai not configured` (exit tetap 0).

## Registry

`server.json` memegang metadata untuk MCP Registry resmi
(`registry.modelcontextprotocol.io`). Publikasi butuh aksi parent:
`mcp-publisher login` (GitHub OIDC) + `mcp-publisher publish`, dan image
`ghcr.io/ini-amin/ootd-identify-outfit` harus dipush dulu (lihat `Dockerfile`;
build dari root repo agar modul `api/` ikut: `docker build -f api/cmd/mcp/Dockerfile .`).
