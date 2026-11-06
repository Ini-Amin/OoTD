package httpapi

// Generic social-mention ingest: a machine-called webhook receiver plus a
// queue reader. This is NOT a platform integration — no Meta/TikTok/X app,
// token, or subscription lives here. Senders authenticate with a shared
// HMAC secret (MENTION_WEBHOOK_SECRET); until a real platform integration
// exists, events arrive from the simulator documented in README.md.

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

const (
	ingestBodyLimit  = 64 << 10
	ingestSigHeader  = "X-Ootd-Signature"
	ingestClockSkew  = 5 * time.Minute
	ingestSecretEnv  = "MENTION_WEBHOOK_SECRET"
	ingestRateMax    = 120
	ingestRateWindow = time.Hour
)

type ingestMentionInput struct {
	Platform     string `json:"platform"`
	ExternalID   string `json:"external_id"`
	AuthorHandle string `json:"author_handle"`
	ImageURL     string `json:"image_url"`
	Caption      string `json:"caption"`
	OccurredAt   string `json:"occurred_at"`
}

type ingestMentionClean struct {
	Platform     string
	ExternalID   string
	AuthorHandle string
	ImageURL     string
	Caption      string
	OccurredAt   *time.Time
}

// validateIngestMention trims and bounds one webhook event. Pure: unit-testable.
func validateIngestMention(in ingestMentionInput) (ingestMentionClean, error) {
	var clean ingestMentionClean
	platform := strings.TrimSpace(in.Platform)
	if platform == "" || len(platform) > 32 {
		return clean, errors.New("platform must be 1-32 chars")
	}
	clean.Platform = platform
	externalID := strings.TrimSpace(in.ExternalID)
	if externalID == "" || len(externalID) > 128 {
		return clean, errors.New("external_id must be 1-128 chars")
	}
	clean.ExternalID = externalID
	author := strings.TrimSpace(in.AuthorHandle)
	if utf8.RuneCountInString(author) > 80 {
		return clean, errors.New("author_handle must be at most 80 characters")
	}
	clean.AuthorHandle = author
	u, err := url.ParseRequestURI(strings.TrimSpace(in.ImageURL))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return clean, errors.New("image_url must be a valid http(s) URL")
	}
	clean.ImageURL = u.String()
	caption := strings.TrimSpace(in.Caption)
	if utf8.RuneCountInString(caption) > 2000 {
		return clean, errors.New("caption must be at most 2000 characters")
	}
	clean.Caption = caption
	if raw := strings.TrimSpace(in.OccurredAt); raw != "" {
		ts, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return clean, errors.New("occurred_at must be RFC3339")
		}
		clean.OccurredAt = &ts
	}
	return clean, nil
}

// parseIngestSignature splits "t=<unix>,v1=<hex>". Pure: unit-testable.
func parseIngestSignature(header string) (int64, []byte, error) {
	parts := strings.Split(strings.TrimSpace(header), ",")
	if len(parts) != 2 {
		return 0, nil, errors.New("bad signature format")
	}
	tPart, ok := strings.CutPrefix(strings.TrimSpace(parts[0]), "t=")
	if !ok {
		return 0, nil, errors.New("bad signature format")
	}
	vPart, ok := strings.CutPrefix(strings.TrimSpace(parts[1]), "v1=")
	if !ok {
		return 0, nil, errors.New("bad signature format")
	}
	t, err := strconv.ParseInt(strings.TrimSpace(tPart), 10, 64)
	if err != nil {
		return 0, nil, errors.New("bad signature timestamp")
	}
	mac, err := hex.DecodeString(strings.TrimSpace(vPart))
	if err != nil || len(mac) != sha256.Size {
		return 0, nil, errors.New("bad signature value")
	}
	return t, mac, nil
}

// verifyIngestSignature checks the HMAC-SHA256 of the raw body against the
// header, plus a 5-minute clock-skew window. Pure: unit-testable.
func verifyIngestSignature(secret string, body []byte, header string, now time.Time) error {
	t, want, err := parseIngestSignature(header)
	if err != nil {
		return err
	}
	if dt := now.Unix() - t; dt > int64(ingestClockSkew/time.Second) || dt < -int64(ingestClockSkew/time.Second) {
		return errors.New("signature timestamp outside skew window")
	}
	sum := hmac.New(sha256.New, []byte(secret))
	sum.Write(body)
	if subtle.ConstantTimeCompare(sum.Sum(nil), want) != 1 {
		return errors.New("signature mismatch")
	}
	return nil
}

// signIngestBody builds an X-Ootd-Signature value. Exported for the simulator
// docs and tests; the production signer is whoever holds the shared secret.
func signIngestBody(secret string, body []byte, t time.Time) string {
	sum := hmac.New(sha256.New, []byte(secret))
	sum.Write(body)
	return "t=" + strconv.FormatInt(t.Unix(), 10) + ",v1=" + hex.EncodeToString(sum.Sum(nil))
}

func ingestClientIP(r *http.Request) string {
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

// ingestMention receives one webhook event. Machine-called: no user auth,
// secured by HMAC instead. 202 {id, status:queued} on enqueue; a replayed
// external_id returns 200 with the existing row and duplicate:true.
func (s *server) ingestMention(w http.ResponseWriter, r *http.Request) {
	secret := os.Getenv(ingestSecretEnv)
	if secret == "" {
		writeError(w, http.StatusServiceUnavailable, "ingest not configured")
		return
	}
	if !s.checkLimit(w, "ingest-ip:"+ingestClientIP(r), ingestRateMax, ingestRateWindow) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, ingestBodyLimit)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		writeError(w, http.StatusBadRequest, "cannot read body")
		return
	}
	if err := verifyIngestSignature(secret, body, r.Header.Get(ingestSigHeader), time.Now()); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid signature")
		return
	}
	dec := json.NewDecoder(strings.NewReader(string(body)))
	dec.DisallowUnknownFields()
	var in ingestMentionInput
	if err := dec.Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	clean, err := validateIngestMention(in)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !s.checkLimit(w, "ingest:"+clean.Platform, ingestRateMax, ingestRateWindow) {
		return
	}
	var id string
	err = s.db.QueryRow(r.Context(), `
		INSERT INTO social_mentions (platform, external_id, author_handle, image_url, caption, occurred_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (external_id) DO NOTHING
		RETURNING id::text
	`, clean.Platform, clean.ExternalID, clean.AuthorHandle, clean.ImageURL, clean.Caption, clean.OccurredAt).Scan(&id)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			serverError(w, err)
			return
		}
		var existing struct {
			ID     string
			Status string
		}
		if derr := s.db.QueryRow(r.Context(), `
			SELECT id::text, status FROM social_mentions WHERE external_id = $1
		`, clean.ExternalID).Scan(&existing.ID, &existing.Status); derr != nil {
			serverError(w, derr)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": existing.ID, "status": existing.Status, "duplicate": true,
		})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"id": id, "status": "queued"})
}

type ingestMentionRow struct {
	ID           string          `json:"id"`
	Platform     string          `json:"platform"`
	ExternalID   string          `json:"external_id"`
	AuthorHandle string          `json:"author_handle"`
	ImageURL     string          `json:"image_url"`
	Caption      string          `json:"caption"`
	OccurredAt   *time.Time      `json:"occurred_at"`
	Status       string          `json:"status"`
	Attempts     int             `json:"attempts"`
	OutfitID     *string         `json:"outfit_id"`
	Result       json.RawMessage `json:"result"`
	Error        string          `json:"error"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

var ingestStatuses = map[string]bool{
	"queued": true, "processing": true, "done": true, "failed": true,
}

// listIngestMentions reads the ingest queue (auth required). Optional
// ?status= filter; newest first, capped at 50 rows.
func (s *server) listIngestMentions(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	const base = `
		SELECT id::text, platform, external_id, author_handle, image_url, caption,
		       occurred_at, status, attempts, outfit_id::text, result, error,
		       created_at, updated_at
		FROM social_mentions`
	var (
		query string
		args  []any
	)
	if status == "" {
		query = base + ` ORDER BY created_at DESC LIMIT 50`
	} else {
		if !ingestStatuses[status] {
			writeError(w, http.StatusBadRequest, "status must be one of: queued, processing, done, failed")
			return
		}
		query = base + ` WHERE status = $1 ORDER BY created_at DESC LIMIT 50`
		args = []any{status}
	}
	dbRows, err := s.db.Query(r.Context(), query, args...)
	if err != nil {
		serverError(w, err)
		return
	}
	defer dbRows.Close()
	out := []ingestMentionRow{}
	for dbRows.Next() {
		var m ingestMentionRow
		var resultJSON *string
		if err := dbRows.Scan(
			&m.ID, &m.Platform, &m.ExternalID, &m.AuthorHandle, &m.ImageURL, &m.Caption,
			&m.OccurredAt, &m.Status, &m.Attempts, &m.OutfitID, &resultJSON, &m.Error,
			&m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			serverError(w, err)
			return
		}
		if resultJSON != nil {
			m.Result = json.RawMessage(*resultJSON)
		}
		out = append(out, m)
	}
	if err := dbRows.Err(); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string][]ingestMentionRow{"mentions": out})
}
