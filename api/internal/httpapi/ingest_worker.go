package httpapi

// Ingest worker: polls social_mentions for queued rows (no Redis) and runs
// each through the same AI pipeline as POST /v1/analyze — AnalyzeOutfit,
// sanitizePieces, optional EstimatePrice per piece — then stores the result
// as a private draft outfit plus a JSON snapshot on the mention row.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ootd/ootd-api/internal/ai"
)

const (
	ingestWorkerIntervalEnv = "INGEST_WORKER_INTERVAL_SECS"
	ingestDefaultInterval   = 10 * time.Second
	ingestBatchSize         = 10
	ingestMaxAttempts       = 3
	// ingestProcessingReclaimMins bounds the reclaim window: a 'processing'
	// row untouched for this long is presumed orphaned and re-queued.
	ingestProcessingReclaimMins = 5
	ingestBotUsername           = "ootd_bot"
	ingestDraftAccent           = "#6b7280"
)

// IngestWorkerIntervalFromEnv reads the poll interval, defaulting to 10s.
func IngestWorkerIntervalFromEnv() time.Duration {
	if v := strings.TrimSpace(os.Getenv(ingestWorkerIntervalEnv)); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return time.Duration(n) * time.Second
		}
	}
	return ingestDefaultInterval
}

// ingestClaim is one queued row claimed for processing.
type ingestClaim struct {
	ID       string
	Platform string
	ImageURL string
	Attempts int
}

// ingestSnapshotPiece mirrors the MCP identify_outfit piece shape so the
// stored snapshot stays comparable with tool output.
type ingestSnapshotPiece struct {
	Category      string                 `json:"category"`
	Label         string                 `json:"label"`
	Brand         *string                `json:"brand"`
	PriceEstimate *ingestPriceEstimate   `json:"price_estimate"`
	Sources       []ingestSnapshotSource `json:"sources"`
}

type ingestPriceEstimate struct {
	MinIDR     int64  `json:"min_idr"`
	MaxIDR     int64  `json:"max_idr"`
	Currency   string `json:"currency"`
	Confidence string `json:"confidence"`
	Note       string `json:"note"`
}

type ingestSnapshotSource struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type ingestSnapshot struct {
	Title   string                `json:"title"`
	Caption string                `json:"caption"`
	Pieces  []ingestSnapshotPiece `json:"pieces"`
}

// RunIngestWorker polls the queue until ctx ends. It never returns an error:
// batch failures are logged and retried on the next tick.
func RunIngestWorker(ctx context.Context, pool *pgxpool.Pool, client *ai.Client, interval time.Duration) {
	if interval <= 0 {
		interval = ingestDefaultInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		if err := processIngestBatch(ctx, pool, client); err != nil && ctx.Err() == nil {
			log.Printf("ingest worker: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func processIngestBatch(ctx context.Context, pool *pgxpool.Pool, client *ai.Client) error {
	claimed, err := claimIngestBatch(ctx, pool)
	if err != nil {
		return err
	}
	for _, c := range claimed {
		if client == nil {
			if err := failIngestItemPermanent(ctx, pool, c.ID, "ai not configured"); err != nil {
				log.Printf("ingest worker: %v", err)
			}
			continue
		}
		if err := processIngestItem(ctx, pool, client, c); err != nil {
			log.Printf("ingest worker: mention %s: %v", c.ID, err)
		}
	}
	return nil
}

// claimIngestBatch locks up to ingestBatchSize queued rows with FOR UPDATE
// SKIP LOCKED so multiple workers never process the same row. Claiming bumps
// attempts; processing failures either requeue or fail permanently.
//
// Rows stuck in 'processing' — pool.Begin failed mid-item, the fail UPDATE
// itself errored, or the process died holding the claim — are reclaimed once
// stale (updated_at older than the reclaim age): their attempts counter
// survived, so the 3-retry budget still applies instead of silently dying.
func claimIngestBatch(ctx context.Context, pool *pgxpool.Pool) ([]ingestClaim, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `
		SELECT id::text, platform, image_url, attempts
		FROM social_mentions
		WHERE status = 'queued'
		   OR (status = 'processing' AND updated_at < now() - make_interval(mins => $2))
		ORDER BY created_at
		LIMIT $1
		FOR UPDATE SKIP LOCKED
	`, ingestBatchSize, ingestProcessingReclaimMins)
	if err != nil {
		return nil, err
	}
	var claimed []ingestClaim
	var ids []string
	for rows.Next() {
		var c ingestClaim
		if err := rows.Scan(&c.ID, &c.Platform, &c.ImageURL, &c.Attempts); err != nil {
			rows.Close()
			return nil, err
		}
		claimed = append(claimed, c)
		ids = append(ids, c.ID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, tx.Commit(ctx)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE social_mentions
		SET status = 'processing', attempts = attempts + 1, updated_at = now()
		WHERE id = ANY($1::uuid[])
	`, ids); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	for i := range claimed {
		claimed[i].Attempts++
	}
	return claimed, nil
}

// parseIngestResult decodes one AnalyzeOutfit payload into draft-ready data:
// sanitized pieces plus title/caption clamped to the outfits table bounds.
// Pure: unit-testable.
func parseIngestResult(raw, platform string) (title, caption string, pieces []magicPiece, err error) {
	var errCheck struct {
		Err string `json:"error"`
	}
	cleaned := stripCodeFences(raw)
	if derr := json.Unmarshal([]byte(cleaned), &errCheck); derr == nil && errCheck.Err != "" {
		return "", "", nil, fmt.Errorf("photo does not look like an outfit")
	}
	var res magicResult
	if derr := json.Unmarshal([]byte(cleaned), &res); derr != nil {
		return "", "", nil, fmt.Errorf("ai returned invalid JSON")
	}
	pieces = sanitizePieces(res.Pieces)
	if len(pieces) > maxOutfitPieces {
		pieces = pieces[:maxOutfitPieces]
	}
	title = strings.TrimSpace(res.Title)
	if utf8.RuneCountInString(title) == 0 || utf8.RuneCountInString(title) > 120 {
		title = "Auto-tagged " + platform + " mention"
	}
	caption = strings.TrimSpace(res.Caption)
	if utf8.RuneCountInString(caption) > 2000 {
		caption = string([]rune(caption)[:2000])
	}
	return title, caption, pieces, nil
}

// buildIngestLinks mirrors the MCP marketplace search URLs (small,
// deliberate duplication: the MCP package is a main package, not a library).
func buildIngestLinks(label string) []ingestSnapshotSource {
	q := url.QueryEscape(label)
	return []ingestSnapshotSource{
		{Label: "Tokopedia", URL: "https://www.tokopedia.com/search?q=" + q},
		{Label: "Shopee", URL: "https://shopee.co.id/search?keyword=" + q},
		{Label: "Google Shopping", URL: "https://www.google.com/search?tbm=shop&q=" + q},
	}
}

func processIngestItem(ctx context.Context, pool *pgxpool.Pool, client *ai.Client, c ingestClaim) error {
	fail := func(err error) error {
		if derr := failIngestItem(ctx, pool, c.ID, c.Attempts, err.Error()); derr != nil {
			return derr
		}
		return err
	}
	u, err := url.ParseRequestURI(strings.TrimSpace(c.ImageURL))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return fail(fmt.Errorf("image_url must be a valid http(s) URL"))
	}
	raw, err := client.AnalyzeOutfit(u.String())
	if err != nil {
		return fail(fmt.Errorf("ai request failed: %w", err))
	}
	title, caption, pieces, err := parseIngestResult(raw, c.Platform)
	if err != nil {
		return fail(err)
	}
	snap := ingestSnapshot{Title: title, Caption: caption, Pieces: make([]ingestSnapshotPiece, 0, len(pieces))}
	for _, p := range pieces {
		sp := ingestSnapshotPiece{
			Category: p.Category,
			Label:    p.Label,
			Brand:    p.Brand,
			Sources:  buildIngestLinks(p.Label),
		}
		if eraw, err := client.EstimatePrice(p.Label, p.Category, "new"); err == nil {
			if r, err := ai.ParseEstimate(eraw); err == nil {
				sp.PriceEstimate = &ingestPriceEstimate{
					MinIDR: r.MinIDR, MaxIDR: r.MaxIDR,
					Currency: "IDR", Confidence: "low", Note: ai.EstimateNote,
				}
			}
		}
		snap.Pieces = append(snap.Pieces, sp)
	}
	snapJSON, err := json.Marshal(snap)
	if err != nil {
		return fail(fmt.Errorf("encode snapshot: %w", err))
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var authorID string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM users WHERE username = $1`, ingestBotUsername).Scan(&authorID); err != nil {
		return fail(fmt.Errorf("ingest bot user missing: run migrations"))
	}
	var imgVal any
	if strings.HasPrefix(u.String(), "https://") {
		imgVal = u.String()
	}
	var outfitID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO outfits (author_id, title, caption, accent, image_url, visibility, status)
		VALUES ($1::uuid, $2, $3, $4, $5, 'private', 'draft')
		RETURNING id::text
	`, authorID, title, caption, ingestDraftAccent, imgVal).Scan(&outfitID); err != nil {
		return fail(fmt.Errorf("insert draft: %w", err))
	}
	for i, p := range pieces {
		if _, err := tx.Exec(ctx, `
			INSERT INTO outfit_pieces (outfit_id, category, label, x, y, w, h, sort_order)
			VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
		`, outfitID, p.Category, p.Label, p.Box.X, p.Box.Y, p.Box.W, p.Box.H, i); err != nil {
			return fail(fmt.Errorf("insert pieces: %w", err))
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE social_mentions
		SET status = 'done', outfit_id = $1::uuid, result = $2::jsonb, error = '', updated_at = now()
		WHERE id = $3::uuid
	`, outfitID, string(snapJSON), c.ID); err != nil {
		return fail(fmt.Errorf("mark done: %w", err))
	}
	return tx.Commit(ctx)
}

// truncateIngestError clamps an error message to the error column budget
// per-rune: AI errors carry arbitrary provider text, so a byte slice could
// split a multibyte rune and make the UPDATE itself fail with
// "invalid byte sequence", wedging the row in 'processing' forever.
func truncateIngestError(msg string) string {
	const maxRunes = 500
	if r := []rune(msg); len(r) > maxRunes {
		return string(r[:maxRunes]) + "…"
	}
	return msg
}

// failIngestItem requeues the row until ingestMaxAttempts, then fails it
// permanently with the last error.
func failIngestItem(ctx context.Context, pool *pgxpool.Pool, id string, attempts int, msg string) error {
	if attempts >= ingestMaxAttempts {
		return failIngestItemPermanent(ctx, pool, id, msg)
	}
	_, err := pool.Exec(ctx, `
		UPDATE social_mentions SET status = 'queued', error = $1, updated_at = now() WHERE id = $2::uuid
	`, truncateIngestError(msg), id)
	return err
}

// failIngestItemPermanent fails a row immediately, without consuming retries.
// Used for deterministic failures (AI unconfigured) that a retry cannot fix.
func failIngestItemPermanent(ctx context.Context, pool *pgxpool.Pool, id string, msg string) error {
	_, err := pool.Exec(ctx, `
		UPDATE social_mentions SET status = 'failed', error = $1, updated_at = now() WHERE id = $2::uuid
	`, truncateIngestError(msg), id)
	return err
}
